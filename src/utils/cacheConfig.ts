/**
 * Cache Configuration and Utilities
 *
 * Centralized configuration for cache settings, preloading strategies,
 * and performance optimization utilities.
 */

import type { CacheKeyType, CacheManagerConfig } from '@/lib/cache/types';

// Global cache configuration
export const CACHE_CONFIG: CacheManagerConfig = {
    storage: {
        type: 'memory',
        persistent: false,
        maxStorageSize: 50 * 1024 * 1024, // 50MB
        cleanupThreshold: 0.8, // Cleanup when 80% full
    },

    compression: {
        enabled: true,
        threshold: 1024, // Compress data larger than 1KB
        algorithm: 'gzip',
        level: 6, // Balanced compression level
    },

    performance: {
        enabled: true,
        sampleRate: 0.1, // Monitor 10% of operations
        metricsEndpoint: undefined, // Could be configured for production metrics
    },

    backgroundSync: {
        enabled: true,
        interval: 5 * 60 * 1000, // 5 minutes
        maxRetries: 3,
        backoffStrategy: 'exponential',
    },

    preloading: {
        userProfiles: [], // Will be populated at runtime
        vehicles: [], // Will be populated at runtime
        searchQueries: [
            // Common search queries to preload
            { location: 'Jakarta' },
            { location: 'Bandung' },
            { location: 'Surabaya' },
            { transmission: 'Automatic' },
            { fuelType: 'Petrol' },
            { seats: 4 },
            { priceMax: 500000 },
        ],
    },

    warming: {
        enabled: true,
        strategy: 'background',
        triggers: ['user-login', 'page-load', 'search-started'],
        priority: 'medium',
    },

    configs: {
        userProfile: {
            ttl: 15 * 60 * 1000, // 15 minutes
            maxSize: 1000,
            compress: false,
            enableMetrics: true,
            staleTime: 10 * 60 * 1000,
            cacheTime: 30 * 60 * 1000,
            retry: 2,
            retryDelay: 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },

        vehicleList: {
            ttl: 5 * 60 * 1000, // 5 minutes
            maxSize: 500,
            compress: true,
            enableMetrics: true,
            staleTime: 3 * 60 * 1000,
            cacheTime: 15 * 60 * 1000,
            retry: 3,
            retryDelay: 500,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },

        vehicleDetails: {
            ttl: 10 * 60 * 1000, // 10 minutes
            maxSize: 200,
            compress: true,
            enableMetrics: true,
            staleTime: 5 * 60 * 1000,
            cacheTime: 20 * 60 * 1000,
            retry: 2,
            retryDelay: 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },

        searchResults: {
            ttl: 3 * 60 * 1000, // 3 minutes
            maxSize: 100,
            compress: true,
            enableMetrics: true,
            staleTime: 2 * 60 * 1000,
            cacheTime: 10 * 60 * 1000,
            retry: 2,
            retryDelay: 500,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchInterval: 5 * 60 * 1000, // Background refetch
        },

        authState: {
            ttl: 30 * 60 * 1000, // 30 minutes
            maxSize: 10,
            compress: false,
            enableMetrics: true,
            staleTime: 15 * 60 * 1000,
            cacheTime: 60 * 60 * 1000,
            retry: 1,
            retryDelay: 2000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        },

        locationData: {
            ttl: 60 * 60 * 1000, // 1 hour
            maxSize: 200,
            compress: false,
            enableMetrics: true,
            staleTime: 30 * 60 * 1000,
            cacheTime: 2 * 60 * 60 * 1000,
            retry: 2,
            retryDelay: 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
        },

        bookingData: {
            ttl: 2 * 60 * 1000, // 2 minutes
            maxSize: 100,
            compress: false,
            enableMetrics: true,
            staleTime: 1 * 60 * 1000,
            cacheTime: 5 * 60 * 1000,
            retry: 3,
            retryDelay: 500,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        },

        adminData: {
            ttl: 1 * 60 * 1000, // 1 minute
            maxSize: 50,
            compress: false,
            enableMetrics: true,
            staleTime: 30 * 1000,
            cacheTime: 2 * 60 * 1000,
            retry: 2,
            retryDelay: 1000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchInterval: 60 * 1000, // Background refetch
        },

        notificationData: {
            ttl: 30 * 1000, // 30 seconds
            maxSize: 100,
            compress: false,
            enableMetrics: true,
            staleTime: 10 * 1000,
            cacheTime: 1 * 60 * 1000,
            retry: 1,
            retryDelay: 500,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchInterval: 30 * 1000, // Background refetch
        },
    },
};

// Cache performance thresholds
export const PERFORMANCE_THRESHOLDS = {
    slowQuery: 2000, // 2 seconds
    highMemoryUsage: 0.8, // 80% of max storage
    lowHitRate: 0.6, // 60% hit rate
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    maxEntries: 10000,
};

// Cache warming strategies
export const CACHE_WARMING_STRATEGIES = {
    // Warm caches on user login
    onUserLogin: async (userId: string) => {
        // Preload user profile - this would need to be done in a React component
        // For now, we'll skip this to avoid hook usage outside of components
        console.log('User login detected, would preload profiles for:', userId);

        // Preload common vehicle searches - this would need to be done in a React component
        // For now, we'll skip this to avoid hook usage outside of components
        console.log('Would preload vehicle searches for common queries');
    },

    // Warm caches on page load
    onPageLoad: async (pageName: string) => {
        switch (pageName) {
            case 'search':
            case 'home':
                // Preload common vehicle searches - this would need to be done in a React component
                // For now, we'll skip this to avoid hook usage outside of components
                console.log('Would preload vehicle searches for search/home page');
                break;

            case 'admin':
                // Preload admin data
                // Implementation would go here
                break;

            default:
                break;
        }
    },

    // Warm caches based on user behavior
    onUserInteraction: async (interaction: string, data: any) => {
        switch (interaction) {
            case 'search-started':
                // Preload related search results - this would need to be done in a React component
                // For now, we'll skip this to avoid hook usage outside of components
                console.log('Would preload similar searches for:', data.filters);
                break;

            case 'vehicle-viewed':
                // Preload related vehicles

                if (data.hostId) {
                    // Preload other vehicles from the same host
                    // Implementation would use host vehicle search
                }
                break;

            default:
                break;
        }
    },
};

// Cache health monitoring
export const CACHE_HEALTH_CHECKS = {
    // Check cache hit rate
    checkHitRate: (stats: any): { healthy: boolean; message?: string } => {
        const hitRate = stats.total.hitRate;

        if (hitRate < PERFORMANCE_THRESHOLDS.lowHitRate * 100) {
            return {
                healthy: false,
                message: `Low cache hit rate: ${hitRate.toFixed(1)}%. Consider adjusting TTL or preloading strategies.`,
            };
        }

        return { healthy: true };
    },

    // Check memory usage
    checkMemoryUsage: (stats: any): { healthy: boolean; message?: string } => {
        const usagePercentage = stats.storage.percentage;

        if (usagePercentage > PERFORMANCE_THRESHOLDS.highMemoryUsage * 100) {
            return {
                healthy: false,
                message: `High memory usage: ${usagePercentage.toFixed(1)}%. Consider increasing cleanup frequency.`,
            };
        }

        return { healthy: true };
    },

    // Check for slow queries
    checkQueryPerformance: (slowQueries: any[]): { healthy: boolean; message?: string } => {
        const slowCount = slowQueries.filter(
            (q) => q.duration > PERFORMANCE_THRESHOLDS.slowQuery,
        ).length;

        if (slowCount > 5) {
            return {
                healthy: false,
                message: `${slowCount} slow queries detected. Check network conditions or optimize queries.`,
            };
        }

        return { healthy: true };
    },
};

// Development utilities
export const DEV_UTILITIES = {
    // Log cache operations
    enableCacheLogging: () => {
        if (process.env.NODE_ENV === 'development') {
            import('@/lib/cache/cacheManager').then(({ cacheManager }) => {
                cacheManager.addEventListener((event) => {
                    console.log(`[Cache ${event.type.toUpperCase()}]`, {
                        key: event.key,
                        timestamp: new Date(event.timestamp).toISOString(),
                        duration: event.duration,
                        metadata: event.metadata,
                    });
                });
            });
        }
    },

    // Simulate cache pressure for testing
    simulateCachePressure: async () => {
        import('@/lib/cache/cacheManager').then(({ cacheManager, createCacheKey }) => {
            // Fill cache with dummy data
            for (let i = 0; i < 1000; i++) {
                const key = createCacheKey('search-results', 'test', undefined, {
                    test: i,
                });

                cacheManager.set(key, {
                    data: new Array(1000).fill(`test-data-${i}`),
                    timestamp: Date.now(),
                });
            }

            console.log('Cache pressure simulation complete');
        });
    },

    // Clear specific cache types
    clearCacheType: async (type: CacheKeyType) => {
        import('@/lib/cache/cacheManager').then(({ cacheManager }) => {
            const cleared = cacheManager.clearType(type);
            console.log(`Cleared ${cleared} entries of type: ${type}`);
        });
    },
};

// Export commonly used configurations
export const COMMON_CACHE_CONFIGS = {
    // Short-lived data (real-time updates)
    shortLived: {
        ttl: 30 * 1000, // 30 seconds
        staleTime: 10 * 1000,
        refetchInterval: 30 * 1000,
    },

    // Medium-lived data (semi-static content)
    mediumLived: {
        ttl: 5 * 60 * 1000, // 5 minutes
        staleTime: 3 * 60 * 1000,
        refetchInterval: undefined,
    },

    // Long-lived data (static or rarely changing)
    longLived: {
        ttl: 60 * 60 * 1000, // 1 hour
        staleTime: 30 * 60 * 1000,
        refetchInterval: undefined,
    },

    // Critical data (user auth, etc.)
    critical: {
        ttl: 30 * 60 * 1000, // 30 minutes
        staleTime: 15 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: 3,
    },
};
