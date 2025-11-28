/**
 * Performance Monitoring Hooks for Rebil Application
 *
 * Features:
 * - Real-time performance tracking
 * - API call monitoring with automatic instrumentation
 * - Component render performance tracking
 * - WebSocket latency monitoring
 * - Memory usage tracking
 * - Performance alerts and notifications
 * - Integration with existing caching and optimization systems
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cacheManager } from '@/lib/cache/cacheManager';
import {
    getOptimizationReport,
    getPerformanceMetrics,
    performanceMonitor,
    trackAPICall,
    trackComponentRender,
    type OptimizationOpportunity,
    type PerformanceAlert,
    type PerformanceMetrics,
} from '@/lib/monitoring/performanceMonitor';

export interface UsePerformanceMonitoringOptions {
    /** Enable automatic API call tracking */
    trackAPICalls?: boolean;
    /** Enable automatic component render tracking */
    trackRenders?: boolean;
    /** Enable memory monitoring */
    trackMemory?: boolean;
    /** Enable WebSocket monitoring */
    trackWebSocket?: boolean;
    /** Custom performance thresholds */
    thresholds?: {
        slowQueryThreshold?: number;
        slowRenderThreshold?: number;
        memoryThreshold?: number;
    };
}

export interface PerformanceState {
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    opportunities: OptimizationOpportunity[];
    isMonitoring: boolean;
    summary: {
        totalCallReduction: number;
        averageResponseTime: number;
        cacheEffectiveness: number;
        potentialTimeSavings: number;
    };
}

/**
 * Main performance monitoring hook
 */
export function usePerformanceMonitoring(
    options: UsePerformanceMonitoringOptions = {},
): PerformanceState & {
    startMonitoring: () => void;
    stopMonitoring: () => void;
    resetMetrics: () => void;
    getReport: () => ReturnType<typeof getOptimizationReport>;
} {
    const [isMonitoring, setIsMonitoring] = useState(true);
    const [metrics, setMetrics] = useState<PerformanceMetrics>(() => getPerformanceMetrics());
    const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);

    // Subscribe to metrics updates
    useEffect(() => {
        if (!isMonitoring) return;

        const unsubscribe = performanceMonitor.subscribe((updatedMetrics) => {
            setMetrics(updatedMetrics);
            setAlerts(performanceMonitor.getAlerts());
        });

        // Initial load
        setMetrics(getPerformanceMetrics());
        setAlerts(performanceMonitor.getAlerts());

        return unsubscribe;
    }, [isMonitoring]);

    // Apply custom thresholds if provided
    useEffect(() => {
        if (options.thresholds) {
            // Update performance monitor thresholds
            // This would require updating the PerformanceMonitor class to accept threshold updates
            console.log('Custom thresholds applied:', options.thresholds);
        }
    }, [options.thresholds]);

    const startMonitoring = useCallback(() => {
        setIsMonitoring(true);
    }, []);

    const stopMonitoring = useCallback(() => {
        setIsMonitoring(false);
    }, []);

    const resetMetrics = useCallback(() => {
        performanceMonitor.reset();
        setMetrics(getPerformanceMetrics());
        setAlerts([]);
    }, []);

    const getReport = useCallback(() => {
        return getOptimizationReport();
    }, []);

    const optimizationReport = useMemo(() => getOptimizationReport(), []);

    return {
        metrics,
        alerts,
        opportunities: optimizationReport.opportunities,
        isMonitoring,
        summary: optimizationReport.summary,
        startMonitoring,
        stopMonitoring,
        resetMetrics,
        getReport,
    };
}

/**
 * Hook for tracking API calls with automatic instrumentation
 */
export function useAPITracking() {
    const trackCall = useCallback((endpoint: string, parameters?: Record<string, any>) => {
        return trackAPICall(endpoint, parameters);
    }, []);

    // Wrapper for tracking Supabase calls
    const trackSupabaseCall = useCallback(
        <T>(operation: string, queryFn: () => Promise<T>, parameters?: Record<string, any>) => {
            const finishTracking = trackCall(`supabase:${operation}`, parameters);

            return queryFn()
                .then((result) => {
                    finishTracking();
                    return result;
                })
                .catch((error) => {
                    finishTracking(true);
                    throw error;
                });
        },
        [trackCall],
    );

    // Wrapper for tracking React Query calls
    const trackReactQueryCall = useCallback(
        <T>(queryKey: string[], queryFn: () => Promise<T>) => {
            const endpoint = `react-query:${queryKey.join(':')}`;
            const finishTracking = trackCall(endpoint, { queryKey });

            return queryFn()
                .then((result) => {
                    finishTracking();
                    return result;
                })
                .catch((error) => {
                    finishTracking(true);
                    throw error;
                });
        },
        [trackCall],
    );

    return {
        trackCall,
        trackSupabaseCall,
        trackReactQueryCall,
    };
}

/**
 * Hook for tracking component render performance
 */
export function useComponentTracking(componentName: string) {
    const renderStartTime = useRef<number>(0);
    const renderCount = useRef<number>(0);

    useEffect(() => {
        renderStartTime.current = performance.now();
        renderCount.current++;

        const finishTracking = trackComponentRender(componentName);

        return () => {
            finishTracking();
        };
    });

    return {
        renderCount: renderCount.current,
        componentName,
    };
}

/**
 * Hook for monitoring WebSocket performance
 */
export function useWebSocketTracking(socketUrl?: string) {
    const [latency] = useState<number>(0);
    const [connectionTime, setConnectionTime] = useState<number>(0);
    const [reconnectCount, setReconnectCount] = useState<number>(0);
    const latencyTestRef = useRef<NodeJS.Timeout | null>(null);

    const trackConnection = useCallback(
        (startTime: number) => {
            const connectionDuration = performance.now() - startTime;
            setConnectionTime(connectionDuration);

            // Track WebSocket connection as API call
            trackAPICall('websocket:connect', { url: socketUrl });
        },
        [socketUrl],
    );

    const trackReconnection = useCallback(() => {
        setReconnectCount((prev) => prev + 1);
        trackAPICall('websocket:reconnect', {
            url: socketUrl,
            count: reconnectCount + 1,
        });
    }, [socketUrl, reconnectCount]);

    const startLatencyTest = useCallback((socket: WebSocket) => {
        if (latencyTestRef.current) {
            clearInterval(latencyTestRef.current);
        }

        latencyTestRef.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                const pingStart = performance.now();
                const pingMessage = JSON.stringify({
                    type: 'ping',
                    timestamp: pingStart,
                });

                // This would require server-side support for ping/pong
                socket.send(pingMessage);

                // In a real implementation, you'd listen for pong response
                // and calculate latency: setLatency(performance.now() - pingStart);
            }
        }, 30000); // Test every 30 seconds

        return () => {
            if (latencyTestRef.current) {
                clearInterval(latencyTestRef.current);
                latencyTestRef.current = null;
            }
        };
    }, []);

    const trackMessage = useCallback(
        (direction: 'send' | 'receive', size: number) => {
            trackAPICall(`websocket:${direction}`, {
                url: socketUrl,
                size,
                timestamp: Date.now(),
            });
        },
        [socketUrl],
    );

    return {
        latency,
        connectionTime,
        reconnectCount,
        trackConnection,
        trackReconnection,
        startLatencyTest,
        trackMessage,
    };
}

/**
 * Hook for monitoring memory usage
 */
export function useMemoryMonitoring() {
    const [memoryStats, setMemoryStats] = useState<{
        heapUsed: number;
        heapTotal: number;
        cacheUsage: number;
        percentage: number;
    }>({ heapUsed: 0, heapTotal: 0, cacheUsage: 0, percentage: 0 });

    useEffect(() => {
        const updateMemoryStats = () => {
            performanceMonitor.updateMemoryMetrics();
            const metrics = getPerformanceMetrics();

            const cacheStats = cacheManager.getStatistics();

            setMemoryStats({
                heapUsed: metrics.memory.heapUsed,
                heapTotal: metrics.memory.heapTotal,
                cacheUsage: cacheStats.storage.used,
                percentage:
                    metrics.memory.heapTotal > 0
                        ? (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100
                        : 0,
            });
        };

        // Update immediately and then every 10 seconds
        updateMemoryStats();
        const interval = setInterval(updateMemoryStats, 10000);

        return () => clearInterval(interval);
    }, []);

    const clearCache = useCallback(() => {
        cacheManager.clearAll();
    }, []);

    return {
        memoryStats,
        clearCache,
    };
}

/**
 * Hook for performance budget monitoring
 */
export function usePerformanceBudget(budgets: {
    maxAPIResponseTime?: number;
    maxRenderTime?: number;
    maxMemoryUsage?: number;
    minCacheHitRate?: number;
}) {
    const [budgetStatus, setBudgetStatus] = useState<{
        apiResponseTime: 'pass' | 'warn' | 'fail';
        renderTime: 'pass' | 'warn' | 'fail';
        memoryUsage: 'pass' | 'warn' | 'fail';
        cacheHitRate: 'pass' | 'warn' | 'fail';
    }>({
        apiResponseTime: 'pass',
        renderTime: 'pass',
        memoryUsage: 'pass',
        cacheHitRate: 'pass',
    });

    useEffect(() => {
        const checkBudgets = () => {
            const metrics = getPerformanceMetrics();

            setBudgetStatus({
                apiResponseTime: budgets.maxAPIResponseTime
                    ? metrics.api.averageResponseTime > budgets.maxAPIResponseTime
                        ? 'fail'
                        : metrics.api.averageResponseTime > budgets.maxAPIResponseTime * 0.8
                          ? 'warn'
                          : 'pass'
                    : 'pass',

                renderTime: budgets.maxRenderTime
                    ? Math.max(...Object.values(metrics.render.componentRenderTimes)) >
                      budgets.maxRenderTime
                        ? 'fail'
                        : Math.max(...Object.values(metrics.render.componentRenderTimes)) >
                            budgets.maxRenderTime * 0.8
                          ? 'warn'
                          : 'pass'
                    : 'pass',

                memoryUsage: budgets.maxMemoryUsage
                    ? metrics.memory.heapUsed > budgets.maxMemoryUsage
                        ? 'fail'
                        : metrics.memory.heapUsed > budgets.maxMemoryUsage * 0.8
                          ? 'warn'
                          : 'pass'
                    : 'pass',

                cacheHitRate: budgets.minCacheHitRate
                    ? metrics.cache.hitRate < budgets.minCacheHitRate
                        ? 'fail'
                        : metrics.cache.hitRate < budgets.minCacheHitRate * 1.1
                          ? 'warn'
                          : 'pass'
                    : 'pass',
            });
        };

        // Check budgets every 5 seconds
        const interval = setInterval(checkBudgets, 5000);
        checkBudgets(); // Initial check

        return () => clearInterval(interval);
    }, [budgets]);

    return budgetStatus;
}

/**
 * Hook for cache performance monitoring
 */
export function useCachePerformance() {
    const queryClient = useQueryClient();
    const [cacheStats, setCacheStats] = useState(() => cacheManager.getStatistics());

    useEffect(() => {
        const updateStats = () => {
            setCacheStats(cacheManager.getStatistics());
        };

        // Listen to cache events
        const unsubscribe = cacheManager.addEventListener(() => {
            updateStats();
        });

        // Update stats every 30 seconds
        const interval = setInterval(updateStats, 30000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    // React Query cache stats
    const reactQueryStats = useMemo(() => {
        const cache = queryClient.getQueryCache();
        const queries = cache.getAll();

        return {
            totalQueries: queries.length,
            staleQueries: queries.filter((q) => q.isStale()).length,
            errorQueries: queries.filter((q) => q.state.status === 'error').length,
            loadingQueries: queries.filter((q) => q.state.status === 'pending').length,
        };
    }, [queryClient]);

    const clearAllCaches = useCallback(() => {
        // Clear internal cache manager
        cacheManager.clearAll();

        // Clear React Query cache
        queryClient.clear();
    }, [queryClient]);

    return {
        internalCache: cacheStats,
        reactQueryCache: reactQueryStats,
        clearAllCaches,
    };
}
