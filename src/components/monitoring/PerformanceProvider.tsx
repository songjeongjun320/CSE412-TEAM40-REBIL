/**
 * Performance Monitoring Provider for Rebil Application
 *
 * Features:
 * - Global performance monitoring initialization
 * - Automatic API call instrumentation
 * - Component render tracking
 * - WebSocket performance monitoring
 * - Integration with React Query and Supabase
 * - Minimal performance overhead
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useEffect, useRef } from 'react';

import { performanceMonitor } from '@/lib/monitoring/performanceMonitor';

interface PerformanceContextValue {
    trackAPICall: (endpoint: string, parameters?: Record<string, any>) => () => void;
    trackSupabaseCall: <T>(
        operation: string,
        queryFn: () => Promise<T>,
        parameters?: Record<string, any>,
    ) => Promise<T>;
    trackComponentRender: (componentName: string) => () => void;
    trackWebSocketMessage: (direction: 'send' | 'receive', size: number) => void;
    isMonitoring: boolean;
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function usePerformanceContext(): PerformanceContextValue {
    const context = useContext(PerformanceContext);
    if (!context) {
        throw new Error('usePerformanceContext must be used within a PerformanceProvider');
    }
    return context;
}

interface PerformanceProviderProps {
    children: React.ReactNode;
    /** Enable monitoring in development */
    enableInDevelopment?: boolean;
    /** Enable monitoring in production */
    enableInProduction?: boolean;
    /** Custom configuration for monitoring */
    config?: {
        sampleRate?: number;
        slowQueryThreshold?: number;
        enableCacheTracking?: boolean;
        enableWebSocketTracking?: boolean;
    };
}

const defaultNoOpTracker = () => () => {};
const defaultNoOpMessage = () => {};
const defaultNoOpSupabase = async (
    _operation: string,
    queryFn: () => Promise<any>,
): Promise<any> => {
    return queryFn();
};

export function PerformanceProvider({
    children,
    enableInDevelopment = true,
    enableInProduction = false,
    config = {},
}: PerformanceProviderProps) {
    const queryClient = useQueryClient();
    const performanceRef = useRef<any>(null);
    const isInitialized = useRef(false);

    // Determine if monitoring should be enabled
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldEnableMonitoring =
        (isDevelopment && enableInDevelopment) ||
        (isProduction && enableInProduction) ||
        process.env.ENABLE_PERFORMANCE_MONITORING === 'true';

    const isMonitoring = shouldEnableMonitoring;

    // Initialize performance monitoring
    useEffect(() => {
        if (!shouldEnableMonitoring || isInitialized.current) return;

        try {
            // Performance monitor is already initialized as singleton
            // No need to call initialize method

            // Cache manager is already initialized as singleton
            // No need to call initialize method

            // Set up React Query integration
            if (queryClient) {
                const defaultQueryClient = queryClient;
                const originalFetch = defaultQueryClient.fetchQuery.bind(defaultQueryClient);

                defaultQueryClient.fetchQuery = async (options: any): Promise<any> => {
                    const queryKey = JSON.stringify(options.queryKey || 'unknown');

                    try {
                        const result = await originalFetch(options);

                        if (performanceMonitor?.trackAPICall) {
                            const stopTracking = performanceMonitor.trackAPICall(
                                `ReactQuery:${queryKey}`,
                                { queryKey: options.queryKey },
                            );
                            stopTracking();
                        }

                        return result;
                    } catch (error) {
                        if (performanceMonitor?.trackAPICall) {
                            const stopTracking = performanceMonitor.trackAPICall(
                                `ReactQuery:${queryKey}`,
                                { queryKey: options.queryKey, error: error?.toString() },
                            );
                            stopTracking(true);
                        }
                        throw error;
                    }
                };
            }

            performanceRef.current = performanceMonitor;
            isInitialized.current = true;

            if (isDevelopment) {
                console.log('🚀 Performance monitoring initialized');
            }
        } catch (error) {
            console.warn('Performance monitoring initialization failed:', error);
        }

        return () => {
            if (performanceMonitor?.destroy) {
                performanceMonitor.destroy();
            }
            isInitialized.current = false;
        };
    }, [shouldEnableMonitoring, queryClient, config, isDevelopment]);

    // Track API calls
    const trackCall = (endpoint: string, parameters?: Record<string, any>) => {
        if (!shouldEnableMonitoring || !performanceMonitor) {
            return defaultNoOpTracker;
        }

        return performanceMonitor.trackAPICall(endpoint, parameters);
    };

    // Track Supabase calls
    const trackSupabaseCall = async (
        operation: string,
        queryFn: () => Promise<any>,
        parameters?: Record<string, any>,
    ): Promise<any> => {
        if (!shouldEnableMonitoring || !performanceMonitor) {
            return queryFn();
        }

        try {
            const result = await queryFn();

            if (performanceMonitor.trackAPICall) {
                const stopTracking = performanceMonitor.trackAPICall(
                    `Supabase:${operation}`,
                    parameters,
                );
                stopTracking();
            }

            return result;
        } catch (error) {
            if (performanceMonitor.trackAPICall) {
                const stopTracking = performanceMonitor.trackAPICall(`Supabase:${operation}`, {
                    ...parameters,
                    error: error?.toString(),
                });
                stopTracking(true);
            }
            throw error;
        }
    };

    // Track component renders
    const trackComponentRender = (componentName: string) => {
        if (!shouldEnableMonitoring || !performanceMonitor) {
            return defaultNoOpTracker;
        }

        return performanceMonitor.trackComponentRender(componentName);
    };

    // Track WebSocket messages
    const trackWebSocketMessage = (direction: 'send' | 'receive', size: number) => {
        if (!shouldEnableMonitoring || !performanceMonitor) {
            return;
        }

        try {
            // Use network request tracking for WebSocket messages
            if (performanceMonitor.trackNetworkRequest) {
                performanceMonitor.trackNetworkRequest(
                    `websocket:${direction}`,
                    'WEBSOCKET',
                    size,
                    false,
                );
            }
        } catch (error) {
            console.warn('WebSocket tracking failed:', error);
        }
    };

    // Context value
    const contextValue: PerformanceContextValue = {
        trackAPICall: trackCall,
        trackSupabaseCall,
        trackComponentRender,
        trackWebSocketMessage,
        isMonitoring,
    };

    if (!shouldEnableMonitoring) {
        // Provide no-op context when monitoring is disabled
        const noOpContextValue: PerformanceContextValue = {
            trackAPICall: defaultNoOpTracker,
            trackSupabaseCall: defaultNoOpSupabase,
            trackComponentRender: defaultNoOpTracker,
            trackWebSocketMessage: defaultNoOpMessage,
            isMonitoring: false,
        };

        return (
            <PerformanceContext.Provider value={noOpContextValue}>
                {children}
            </PerformanceContext.Provider>
        );
    }

    return (
        <PerformanceContext.Provider value={contextValue}>{children}</PerformanceContext.Provider>
    );
}

// Higher-order component for automatic component tracking
export function withPerformanceTracking<P extends Record<string, any>>(
    WrappedComponent: React.ComponentType<P>,
    componentName?: string,
) {
    const TrackedComponent = (props: P) => {
        const { trackComponentRender } = usePerformanceContext();
        const renderName =
            componentName || WrappedComponent.displayName || WrappedComponent.name || 'Unknown';

        useEffect(() => {
            const stopTracking = trackComponentRender(renderName);
            return stopTracking;
        }, [trackComponentRender, renderName]);

        return <WrappedComponent {...props} />;
    };

    TrackedComponent.displayName = `withPerformanceTracking(${componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return TrackedComponent;
}

// Critical alert banner component
export function CriticalAlertBanner() {
    const { isMonitoring } = usePerformanceContext();

    if (!isMonitoring || process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-2 text-sm">
            🚀 Performance monitoring active
        </div>
    );
}

export default PerformanceProvider;
