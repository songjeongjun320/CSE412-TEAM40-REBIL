'use client';

/**
 * React Query Provider with Cache Integration
 *
 * Features:
 * - Global React Query configuration
 * - Integration with custom cache manager
 * - Development tools for cache debugging
 * - Performance monitoring and logging
 * - Error boundary integration
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useEffect, useState } from 'react';

import { cacheManager } from '@/lib/cache/cacheManager';
import { getQueryClient, queryPerformance } from '@/lib/cache/queryCache';

interface QueryProviderProps {
    children: ReactNode;
}

/**
 * Query Provider component that wraps the entire application
 */
export function QueryProvider({ children }: QueryProviderProps) {
    const [queryClient] = useState(() => getQueryClient());
    const [performanceUnsubscribe, setPerformanceUnsubscribe] = useState<(() => void) | null>(null);

    // Set up performance monitoring in development
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const unsubscribe = queryPerformance.startPerformanceMonitoring();
            setPerformanceUnsubscribe(() => unsubscribe);

            // Log cache statistics periodically (reduced frequency to minimize performance impact)
            const statsInterval = setInterval(() => {
                const stats = queryPerformance.getCacheStats();
                // Only log if there are significant changes to reduce console noise
                if (stats.total.entryCount > 0) {
                    console.log('📊 Cache Statistics:', {
                        timestamp: new Date().toISOString(),
                        total: {
                            entryCount: stats.total.entryCount,
                            hitRate: stats.total.hitRate.toFixed(1) + '%',
                            totalSize: (stats.total.totalSize / 1024).toFixed(1) + 'KB',
                        },
                    });
                }
            }, 300000); // Every 5 minutes instead of every minute

            return () => {
                clearInterval(statsInterval);
                if (unsubscribe) {
                    unsubscribe();
                }
            };
        }
    }, []);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (performanceUnsubscribe) {
                performanceUnsubscribe();
            }
        };
    }, [performanceUnsubscribe]);

    // Set up global error handling
    useEffect(() => {
        const errorHandler = (error: any, query: any) => {
            console.error('❌ React Query Error:', {
                error: error?.message || error,
                queryKey: query?.queryKey,
                queryHash: query?.queryHash,
                state: query?.state,
                errorType: typeof error,
                errorStack: error?.stack,
                errorCode: error?.code,
                errorDetails: error?.details,
            });

            // Could integrate with error reporting service here
            // reportError(error, { context: 'react-query', queryKey: query?.queryKey });
        };

        // Subscribe to query cache events (optimized logging)
        queryClient.getQueryCache().subscribe((event) => {
            // Only log errors and important state changes to reduce noise
            if (event?.query?.state?.error) {
                console.error('❌ React Query Observer Error:', {
                    error: event.query.state.error,
                    queryKey: event.query.queryKey,
                    queryHash: event.query.queryHash,
                });
                errorHandler(event.query.state.error, event.query);
            }
        });

        // Subscribe to mutation cache events (optimized logging)
        queryClient.getMutationCache().subscribe((event) => {
            // Only log mutation errors to reduce console noise
            if (event?.type === 'updated' && event.mutation?.state?.error) {
                console.error('❌ React Query Mutation Error:', {
                    error: event.mutation.state.error,
                    mutationKey: event.mutation.options?.mutationKey,
                    variables: event.mutation.state?.variables,
                    errorMessage: event.mutation.state.error?.message,
                });
            }
        });
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            )}
            {process.env.NODE_ENV === 'development' && <CacheDebugPanel />}
        </QueryClientProvider>
    );
}

/**
 * Cache Debug Panel for development
 * Displays real-time cache statistics and controls
 */
function CacheDebugPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            const updateStats = () => {
                const cacheStats = cacheManager.getStatistics();
                console.log('📊 Cache Debug Panel: Updating statistics:', {
                    timestamp: new Date().toISOString(),
                    totalEntries: cacheStats.total.entryCount,
                    totalHitRate: cacheStats.total.hitRate.toFixed(1) + '%',
                    storageUsed: (cacheStats.storage.used / 1024).toFixed(1) + 'KB',
                });
                setStats(cacheStats);
            };

            updateStats();
            const interval = setInterval(updateStats, 1000);

            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const clearAllCaches = () => {
        console.log('🧹 Clearing all caches...');
        cacheManager.clearAll();
        const queryClient = getQueryClient();
        queryClient.clear();
        console.log('✅ All caches cleared successfully');
    };

    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 9999,
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
            >
                Cache Debug
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '70px',
                        right: '20px',
                        width: '300px',
                        maxHeight: '400px',
                        backgroundColor: 'white',
                        border: '1px solid #e1e5e9',
                        borderRadius: '8px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        zIndex: 9998,
                        overflow: 'auto',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                    }}
                >
                    <div
                        style={{
                            padding: '12px',
                            borderBottom: '1px solid #e1e5e9',
                            backgroundColor: '#f8f9fa',
                            fontWeight: 'bold',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            color: '#000000',
                        }}
                    >
                        <span>Cache Statistics</span>
                        <button
                            onClick={clearAllCaches}
                            style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '10px',
                            }}
                        >
                            Clear All
                        </button>
                    </div>

                    <div style={{ padding: '12px', color: '#000000' }}>
                        {stats ? (
                            <div>
                                <div style={{ marginBottom: '12px' }}>
                                    <strong>Total Cache:</strong>
                                    <div>Entries: {stats.total.entryCount}</div>
                                    <div>Hit Rate: {stats.total.hitRate.toFixed(1)}%</div>
                                    <div>
                                        Size: {(stats.total.totalSize / 1024).toFixed(1)}
                                        KB
                                    </div>
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                    <strong>By Type:</strong>
                                    {Object.entries(stats.byType).map(
                                        ([type, typeStats]: [string, any]) => (
                                            <div
                                                key={type}
                                                style={{
                                                    marginLeft: '8px',
                                                    marginBottom: '4px',
                                                }}
                                            >
                                                <div style={{ fontWeight: 'bold' }}>{type}:</div>
                                                <div style={{ marginLeft: '8px' }}>
                                                    <div>Hits: {typeStats.hits}</div>
                                                    <div>Misses: {typeStats.misses}</div>
                                                    <div>Entries: {typeStats.entryCount}</div>
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>

                                <div>
                                    <strong>Storage:</strong>
                                    <div>Used: {(stats.storage.used / 1024).toFixed(1)}KB</div>
                                    <div>Usage: {stats.storage.percentage.toFixed(1)}%</div>
                                </div>
                            </div>
                        ) : (
                            <div>Loading stats...</div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default QueryProvider;
