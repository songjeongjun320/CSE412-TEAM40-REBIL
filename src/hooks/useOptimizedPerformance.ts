/**
 * Optimized Performance Hooks - Integration with Existing Components
 *
 * Features:
 * - Seamless integration with existing cached hooks
 * - VehicleCard render performance tracking
 * - Search query performance monitoring
 * - Supabase query instrumentation
 * - WebSocket real-time monitoring
 * - Cache effectiveness tracking
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { usePerformanceContext } from '@/components/monitoring/PerformanceProvider';
import { createClient } from '@/lib/supabase/supabaseClient';

/**
 * Enhanced version of useQuery with automatic performance tracking
 */
export function useOptimizedQuery<T>(
    queryKey: any[],
    queryFn: () => Promise<T>,
    options: any = {},
    trackingOptions?: {
        trackingName?: string;
        enableMetrics?: boolean;
        slowQueryThreshold?: number;
    },
) {
    const { trackAPICall } = usePerformanceContext();

    const trackedQueryFn = useCallback(async () => {
        const trackingName =
            trackingOptions?.trackingName ||
            `query:${Array.isArray(queryKey) ? queryKey.join(':') : queryKey}`;

        const finishTracking = trackAPICall(trackingName, {
            queryKey,
            enableMetrics: trackingOptions?.enableMetrics ?? true,
        });

        try {
            const startTime = performance.now();
            const result = await queryFn();
            const duration = performance.now() - startTime;

            // Check for slow queries
            const threshold = trackingOptions?.slowQueryThreshold || 1000;
            if (duration > threshold) {
                console.warn(`Slow query detected: ${trackingName} took ${duration.toFixed(2)}ms`);
            }

            finishTracking();
            return result;
        } catch (error) {
            finishTracking();
            throw error;
        }
    }, [queryKey, queryFn, trackAPICall, trackingOptions]);

    return useQuery({
        queryKey,
        queryFn: trackedQueryFn,
        ...options,
    });
}

/**
 * Enhanced version of useMutation with automatic performance tracking
 */
export function useOptimizedMutation<T, V>(
    mutationFn: (variables: V) => Promise<T>,
    options: any = {},
    trackingOptions?: {
        trackingName?: string;
        enableMetrics?: boolean;
    },
) {
    const { trackAPICall } = usePerformanceContext();

    const trackedMutationFn = useCallback(
        async (variables: V) => {
            const trackingName = trackingOptions?.trackingName || 'mutation:unknown';
            const finishTracking = trackAPICall(trackingName, {
                variables,
                enableMetrics: trackingOptions?.enableMetrics ?? true,
            });

            try {
                const result = await mutationFn(variables);
                finishTracking();
                return result;
            } catch (error) {
                finishTracking();
                throw error;
            }
        },
        [mutationFn, trackAPICall, trackingOptions],
    );

    return useMutation({
        mutationFn: trackedMutationFn,
        ...options,
    });
}

/**
 * Hook for tracking component render performance with detailed metrics
 */
export function useComponentPerformanceTracking(
    componentName: string,
    options: {
        enableMetrics?: boolean;
        trackReRenders?: boolean;
        slowRenderThreshold?: number;
    } = {},
) {
    const renderCountRef = useRef(0);
    const lastRenderTimeRef = useRef<number>(0);
    const { trackComponentRender } = usePerformanceContext();

    useEffect(() => {
        if (!options.enableMetrics) return;

        renderCountRef.current++;
        const startTime = performance.now();
        const finishTracking = trackComponentRender(componentName);
        const renderCountAtMount = renderCountRef.current;

        return () => {
            const renderTime = performance.now() - startTime;
            lastRenderTimeRef.current = renderTime;

            // Check for slow renders
            const threshold = options.slowRenderThreshold || 100;
            if (renderTime > threshold) {
                console.warn(
                    `Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`,
                );
            }

            // Track re-renders if enabled
            if (options.trackReRenders && renderCountAtMount > 1) {
                console.log(`Component ${componentName} re-rendered ${renderCountAtMount} times`);
            }

            finishTracking();
        };
    }, [componentName, options, trackComponentRender]);

    return {
        renderCount: renderCountRef.current,
        lastRenderTime: lastRenderTimeRef.current,
        componentName,
    };
}

/**
 * Hook for tracking Supabase operations with detailed performance metrics
 */
export function useSupabasePerformanceTracking() {
    const { trackSupabaseCall } = usePerformanceContext();
    const supabase = createClient();

    const trackQuery = useCallback(
        async <T>(
            operation: string,
            queryBuilder: any,
            options: {
                tableName?: string;
                queryType?: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
                parameters?: Record<string, any>;
            } = {},
        ): Promise<T> => {
            const operationName = `${options.tableName || 'unknown'}:${options.queryType || operation}`;

            return trackSupabaseCall(operationName, () => queryBuilder, {
                operation,
                ...options.parameters,
            });
        },
        [trackSupabaseCall],
    );

    const trackSelect = useCallback(
        async <T>(tableName: string, query: any, parameters?: Record<string, any>): Promise<T> => {
            return trackQuery('select', query, {
                tableName,
                queryType: 'select',
                parameters,
            });
        },
        [trackQuery],
    );

    const trackInsert = useCallback(
        async <T>(tableName: string, query: any, parameters?: Record<string, any>): Promise<T> => {
            return trackQuery('insert', query, {
                tableName,
                queryType: 'insert',
                parameters,
            });
        },
        [trackQuery],
    );

    const trackUpdate = useCallback(
        async <T>(tableName: string, query: any, parameters?: Record<string, any>): Promise<T> => {
            return trackQuery('update', query, {
                tableName,
                queryType: 'update',
                parameters,
            });
        },
        [trackQuery],
    );

    const trackRPC = useCallback(
        async <T>(
            functionName: string,
            query: any,
            parameters?: Record<string, any>,
        ): Promise<T> => {
            return trackQuery(functionName, query, {
                tableName: 'rpc',
                queryType: 'rpc',
                parameters: { functionName, ...parameters },
            });
        },
        [trackQuery],
    );

    return {
        supabase,
        trackQuery,
        trackSelect,
        trackInsert,
        trackUpdate,
        trackRPC,
    };
}

/**
 * Hook for tracking search performance specifically
 */
export function useSearchPerformanceTracking() {
    const { trackAPICall } = usePerformanceContext();
    const performanceDataRef = useRef<{
        searchTimes: number[];
        avgSearchTime: number;
        totalSearches: number;
    }>({
        searchTimes: [],
        avgSearchTime: 0,
        totalSearches: 0,
    });

    const trackSearch = useCallback(
        (searchFilters: any, searchType: 'vehicle' | 'location' | 'general' = 'general') => {
            const startTime = performance.now();
            const finishTracking = trackAPICall(`search:${searchType}`, {
                filters: searchFilters,
                searchType,
            });

            return () => {
                const searchTime = performance.now() - startTime;

                // Update performance data
                const data = performanceDataRef.current;
                data.searchTimes.push(searchTime);
                data.totalSearches++;

                // Keep only last 50 search times for calculating average
                if (data.searchTimes.length > 50) {
                    data.searchTimes.shift();
                }

                // Calculate average
                data.avgSearchTime =
                    data.searchTimes.reduce((sum, time) => sum + time, 0) / data.searchTimes.length;

                // Check for slow searches
                if (searchTime > 2000) {
                    // 2 second threshold
                    console.warn(
                        `Slow search detected: ${searchType} search took ${searchTime.toFixed(2)}ms`,
                    );
                }

                finishTracking();

                return {
                    searchTime,
                    avgSearchTime: data.avgSearchTime,
                    totalSearches: data.totalSearches,
                };
            };
        },
        [trackAPICall],
    );

    const getSearchMetrics = useCallback(() => {
        return {
            ...performanceDataRef.current,
            recentSearchTimes: [...performanceDataRef.current.searchTimes],
        };
    }, []);

    return {
        trackSearch,
        getSearchMetrics,
    };
}

/**
 * Hook for tracking WebSocket real-time connection performance
 */
export function useWebSocketPerformanceTracking() {
    const { trackWebSocketMessage } = usePerformanceContext();
    const metricsRef = useRef<{
        connectionTime: number;
        messagesSent: number;
        messagesReceived: number;
        averageLatency: number;
        latencyHistory: number[];
    }>({
        connectionTime: 0,
        messagesSent: 0,
        messagesReceived: 0,
        averageLatency: 0,
        latencyHistory: [],
    });

    const trackConnection = useCallback((connectionStartTime: number) => {
        metricsRef.current.connectionTime = performance.now() - connectionStartTime;
    }, []);

    const trackMessage = useCallback(
        (direction: 'send' | 'receive', message: any, latency?: number) => {
            const messageSize = JSON.stringify(message).length;
            trackWebSocketMessage(direction, messageSize);

            // Update local metrics
            const metrics = metricsRef.current;
            if (direction === 'send') {
                metrics.messagesSent++;
            } else {
                metrics.messagesReceived++;
            }

            // Track latency if provided
            if (latency !== undefined) {
                metrics.latencyHistory.push(latency);
                if (metrics.latencyHistory.length > 20) {
                    metrics.latencyHistory.shift();
                }
                metrics.averageLatency =
                    metrics.latencyHistory.reduce((sum, l) => sum + l, 0) /
                    metrics.latencyHistory.length;
            }
        },
        [trackWebSocketMessage],
    );

    const getWebSocketMetrics = useCallback(() => {
        return { ...metricsRef.current };
    }, []);

    return {
        trackConnection,
        trackMessage,
        getWebSocketMetrics,
    };
}

/**
 * Hook for tracking VehicleCard specific performance
 */
export function useVehicleCardPerformance(vehicleId: string) {
    const { trackComponentRender } = usePerformanceContext();
    const renderMetricsRef = useRef<{
        totalRenderTime: number;
        renderCount: number;
        averageRenderTime: number;
        lastRenderTime: number;
    }>({
        totalRenderTime: 0,
        renderCount: 0,
        averageRenderTime: 0,
        lastRenderTime: 0,
    });

    useEffect(() => {
        const startTime = performance.now();
        const finishTracking = trackComponentRender(`VehicleCard:${vehicleId}`);
        const metricsAtMount = { ...renderMetricsRef.current };

        return () => {
            const renderTime = performance.now() - startTime;
            const metrics = metricsAtMount;

            metrics.renderCount++;
            metrics.totalRenderTime += renderTime;
            metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
            metrics.lastRenderTime = renderTime;

            // Alert for slow VehicleCard renders (they should be very fast)
            if (renderTime > 50) {
                console.warn(
                    `Slow VehicleCard render: ${vehicleId} took ${renderTime.toFixed(2)}ms`,
                );
            }

            finishTracking();
        };
    }, [vehicleId, trackComponentRender]);

    return {
        getRenderMetrics: () => ({ ...renderMetricsRef.current }),
        vehicleId,
    };
}

/**
 * Hook for tracking cache effectiveness for specific operations
 */
export function useCacheEffectivenessTracking(operationName: string) {
    const cacheHitsRef = useRef(0);
    const cacheMissesRef = useRef(0);

    const recordCacheHit = useCallback(() => {
        cacheHitsRef.current++;
    }, []);

    const recordCacheMiss = useCallback(() => {
        cacheMissesRef.current++;
    }, []);

    const getCacheStats = useCallback(() => {
        const total = cacheHitsRef.current + cacheMissesRef.current;
        const hitRate = total > 0 ? (cacheHitsRef.current / total) * 100 : 0;

        return {
            hits: cacheHitsRef.current,
            misses: cacheMissesRef.current,
            hitRate,
            total,
            operationName,
        };
    }, [operationName]);

    return {
        recordCacheHit,
        recordCacheMiss,
        getCacheStats,
    };
}
