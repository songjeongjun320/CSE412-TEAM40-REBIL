/**
 * React Query configuration and query cache optimization
 * Integrates with our custom cache manager for intelligent caching strategies
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';

import { cacheManager, createCacheKey, invalidationPatterns } from './cacheManager';
import type {
    CacheConfigs,
    CacheKeyType,
    EnhancedQueryOptions,
    InvalidationPattern,
} from './types';

// React Query configuration presets for different data types
const QUERY_PRESETS: CacheConfigs = {
    userProfile: {
        ttl: 15 * 60 * 1000,
        maxSize: 1000,
        compress: false,
        enableMetrics: true,
        staleTime: 10 * 60 * 1000, // 10 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        retry: 2,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
    },
    vehicleList: {
        ttl: 5 * 60 * 1000,
        maxSize: 500,
        compress: true,
        enableMetrics: true,
        staleTime: 3 * 60 * 1000, // 3 minutes
        cacheTime: 15 * 60 * 1000, // 15 minutes
        retry: 3,
        retryDelay: 500,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
    },
    vehicleDetails: {
        ttl: 10 * 60 * 1000,
        maxSize: 200,
        compress: true,
        enableMetrics: true,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 20 * 60 * 1000, // 20 minutes
        retry: 2,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
    },
    searchResults: {
        ttl: 3 * 60 * 1000,
        maxSize: 100,
        compress: true,
        enableMetrics: true,
        staleTime: 2 * 60 * 1000, // 2 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        retry: 2,
        retryDelay: 500,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchInterval: 5 * 60 * 1000, // Background refetch every 5 minutes
    },
    authState: {
        ttl: 30 * 60 * 1000,
        maxSize: 10,
        compress: false,
        enableMetrics: true,
        staleTime: 15 * 60 * 1000, // 15 minutes
        cacheTime: 60 * 60 * 1000, // 1 hour
        retry: 1,
        retryDelay: 2000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    },
    locationData: {
        ttl: 60 * 60 * 1000,
        maxSize: 200,
        compress: false,
        enableMetrics: true,
        staleTime: 30 * 60 * 1000, // 30 minutes
        cacheTime: 2 * 60 * 60 * 1000, // 2 hours
        retry: 2,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    },
    bookingData: {
        ttl: 2 * 60 * 1000,
        maxSize: 100,
        compress: false,
        enableMetrics: true,
        staleTime: 1 * 60 * 1000, // 1 minute
        cacheTime: 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: 500,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    },
    adminData: {
        ttl: 1 * 60 * 1000,
        maxSize: 50,
        compress: false,
        enableMetrics: true,
        staleTime: 30 * 1000, // 30 seconds
        cacheTime: 2 * 60 * 1000, // 2 minutes
        retry: 2,
        retryDelay: 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: 60 * 1000, // Background refetch every minute
    },
    notificationData: {
        ttl: 30 * 1000,
        maxSize: 100,
        compress: false,
        enableMetrics: true,
        staleTime: 10 * 1000, // 10 seconds
        cacheTime: 1 * 60 * 1000, // 1 minute
        retry: 1,
        retryDelay: 500,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: 30 * 1000, // Background refetch every 30 seconds
    },
};

// Custom query client configuration with enhanced features
const defaultQueryClientConfig: QueryClientConfig = {
    defaultOptions: {
        queries: {
            // Global defaults
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: (failureCount, error: any) => {
                // Don't retry on 4xx errors (except 429 rate limit)
                if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
                    return false;
                }
                // Retry up to 3 times for other errors
                return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
        },
        mutations: {
            retry: (failureCount, error: any) => {
                // Don't retry mutations on 4xx errors
                if (error?.status >= 400 && error?.status < 500) {
                    return false;
                }
                return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        },
    },
};

// Create the query client with enhanced error handling and logging
export const createQueryClient = (): QueryClient => {
    return new QueryClient({
        ...defaultQueryClientConfig,
    });
};

// Singleton query client instance
let queryClientInstance: QueryClient | null = null;

export const getQueryClient = (): QueryClient => {
    if (!queryClientInstance) {
        queryClientInstance = createQueryClient();

        // Set up global error handling
        queryClientInstance.setMutationDefaults(['mutation'], {
            onError: (error: any) => {
                console.error('Mutation error:', error);
                // Could integrate with toast notifications here
            },
        });
    }

    return queryClientInstance;
};

/**
 * Enhanced query options factory that integrates with our cache manager
 */
export const createEnhancedQueryOptions = <T>(
    cacheKeyType: CacheKeyType,
    queryKey: string[],
    scope: string,
    entity?: string,
    params?: Record<string, any>,
    overrides?: Partial<EnhancedQueryOptions<T>>,
): EnhancedQueryOptions<T> => {
    const preset = QUERY_PRESETS[cacheKeyType as keyof CacheConfigs];
    const hierarchicalKey = createCacheKey(cacheKeyType, scope, entity, params);

    // Use defaults if preset is not found
    const defaultPreset = {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchInterval: undefined,
    };

    const finalPreset = preset || defaultPreset;

    return {
        queryKey,
        staleTime: finalPreset.staleTime,
        retry: finalPreset.retry,
        retryDelay: finalPreset.retryDelay,
        refetchOnWindowFocus: finalPreset.refetchOnWindowFocus,
        refetchOnReconnect: finalPreset.refetchOnReconnect,
        refetchInterval: finalPreset.refetchInterval,
        cacheKey: hierarchicalKey,
        ...overrides,
    };
};

/**
 * Helper functions for common query key patterns
 */
export const queryKeys = {
    // User profile queries
    userProfile: (userId: string) => ['user-profile', userId],
    currentUserProfile: () => ['user-profile', 'current'],

    // Vehicle queries
    vehicles: () => ['vehicles'],
    vehicleList: (filters?: Record<string, any>) => [
        'vehicles',
        'list',
        ...(filters ? [JSON.stringify(filters)] : []),
    ],
    vehicleDetails: (vehicleId: string) => ['vehicles', 'details', vehicleId],
    vehiclesByHost: (hostId: string) => ['vehicles', 'by-host', hostId],

    // Search queries
    searchResults: (query: string, filters?: Record<string, any>) => [
        'search',
        query,
        ...(filters ? [JSON.stringify(filters)] : []),
    ],

    // Booking queries
    bookings: () => ['bookings'],
    userBookings: (userId: string) => ['bookings', 'by-user', userId],
    hostBookings: (hostId: string) => ['bookings', 'by-host', hostId],
    bookingDetails: (bookingId: string) => ['bookings', 'details', bookingId],

    // Admin queries
    pendingApprovals: () => ['admin', 'pending-approvals'],
    adminNotifications: (adminId: string) => ['admin', 'notifications', adminId],

    // Location queries
    locations: () => ['locations'],
    geocoding: (address: string) => ['locations', 'geocoding', address],
    reverseGeocoding: (lat: number, lng: number) => [
        'locations',
        'reverse-geocoding',
        `${lat},${lng}`,
    ],

    // Auth queries
    authUser: () => ['auth', 'user'],
    userRoles: (userId: string) => ['auth', 'roles', userId],

    // Notifications
    notifications: (userId: string) => ['notifications', userId],
    unreadNotifications: (userId: string) => ['notifications', 'unread', userId],
};

/**
 * Cache invalidation utilities for React Query integration
 */
export const cacheInvalidation = {
    // Invalidate user profile data
    invalidateUserProfile: (queryClient: QueryClient, userId?: string) => {
        const patterns = userId
            ? [invalidationPatterns.userProfile(userId)]
            : [{ type: 'user-profile' as CacheKeyType }];

        cacheManager.invalidate(patterns);

        if (userId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId) });
        } else {
            queryClient.invalidateQueries({ queryKey: ['user-profile'] });
        }
    },

    // Invalidate vehicle data
    invalidateVehicles: (queryClient: QueryClient, vehicleId?: string, hostId?: string) => {
        const patterns: InvalidationPattern[] = [];

        if (vehicleId) {
            patterns.push({ type: 'vehicle-details', entity: vehicleId });
        }

        if (hostId) {
            patterns.push(invalidationPatterns.vehiclesByHost(hostId));
        } else {
            patterns.push(...invalidationPatterns.allVehicleData());
        }

        cacheManager.invalidate(patterns);

        // Invalidate React Query caches
        queryClient.invalidateQueries({ queryKey: queryKeys.vehicles() });
        if (vehicleId) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.vehicleDetails(vehicleId),
            });
        }
        if (hostId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.vehiclesByHost(hostId) });
        }
    },

    // Invalidate search results
    invalidateSearchResults: (queryClient: QueryClient) => {
        cacheManager.invalidate([invalidationPatterns.searchResults()]);
        queryClient.invalidateQueries({ queryKey: ['search'] });
    },

    // Invalidate booking data
    invalidateBookings: (queryClient: QueryClient, userId?: string, hostId?: string) => {
        const patterns: InvalidationPattern[] = [{ type: 'booking-data' }];
        cacheManager.invalidate(patterns);

        queryClient.invalidateQueries({ queryKey: queryKeys.bookings() });
        if (userId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.userBookings(userId) });
        }
        if (hostId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.hostBookings(hostId) });
        }
    },

    // Invalidate auth state
    invalidateAuth: (queryClient: QueryClient, userId?: string) => {
        cacheManager.invalidate([invalidationPatterns.authState(userId)]);
        queryClient.invalidateQueries({ queryKey: queryKeys.authUser() });
        if (userId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.userRoles(userId) });
        }
    },

    // Invalidate admin data
    invalidateAdminData: (queryClient: QueryClient, adminId?: string) => {
        const patterns: InvalidationPattern[] = [{ type: 'admin-data' }];
        cacheManager.invalidate(patterns);

        queryClient.invalidateQueries({ queryKey: queryKeys.pendingApprovals() });
        if (adminId) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.adminNotifications(adminId),
            });
        }
    },

    // Invalidate all cache data (use sparingly)
    invalidateAll: (queryClient: QueryClient) => {
        cacheManager.clearAll();
        queryClient.clear();
    },
};

/**
 * Cache warming utilities for preloading frequently accessed data
 */
export const cacheWarming = {
    // Warm user profile cache
    warmUserProfile: async (
        queryClient: QueryClient,
        userId: string,
        dataFetcher: () => Promise<any>,
    ) => {
        const cacheKey = createCacheKey('user-profile', 'user', userId);
        await cacheManager.warmCache(cacheKey, dataFetcher);

        // Also warm React Query cache
        queryClient.prefetchQuery({
            queryKey: queryKeys.userProfile(userId),
            queryFn: dataFetcher,
            ...QUERY_PRESETS.userProfile,
        });
    },

    // Warm vehicle list cache
    warmVehicleList: async (
        queryClient: QueryClient,
        filters: Record<string, any>,
        dataFetcher: () => Promise<any>,
    ) => {
        const cacheKey = createCacheKey('vehicle-list', 'global', undefined, filters);
        await cacheManager.warmCache(cacheKey, dataFetcher);

        queryClient.prefetchQuery({
            queryKey: queryKeys.vehicleList(filters),
            queryFn: dataFetcher,
            ...QUERY_PRESETS.vehicleList,
        });
    },

    // Warm search results
    warmSearchResults: async (
        queryClient: QueryClient,
        query: string,
        filters: Record<string, any>,
        dataFetcher: () => Promise<any>,
    ) => {
        const cacheKey = createCacheKey('search-results', 'global', undefined, {
            query,
            ...filters,
        });
        await cacheManager.warmCache(cacheKey, dataFetcher);

        queryClient.prefetchQuery({
            queryKey: queryKeys.searchResults(query, filters),
            queryFn: dataFetcher,
            ...QUERY_PRESETS.searchResults,
        });
    },
};

/**
 * Performance monitoring for query cache
 */
export const queryPerformance = {
    // Log slow queries
    onQueryStart: (queryKey: readonly unknown[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.time(`Query: ${JSON.stringify(queryKey)}`);
        }
    },

    onQueryEnd: (queryKey: readonly unknown[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.timeEnd(`Query: ${JSON.stringify(queryKey)}`);
        }
    },

    // Get cache statistics
    getCacheStats: () => cacheManager.getStatistics(),

    // Monitor cache performance
    startPerformanceMonitoring: () => {
        return cacheManager.addEventListener((event) => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`Cache ${event.type}:`, {
                    key: event.key,
                    duration: event.duration,
                    timestamp: new Date(event.timestamp).toISOString(),
                    metadata: event.metadata,
                });
            }
        });
    },
};

// Export the presets for direct use
export { QUERY_PRESETS as queryPresets };

// Default export
const QueryCacheUtils = {
    createQueryClient,
    getQueryClient,
    createEnhancedQueryOptions,
    queryKeys,
    cacheInvalidation,
    cacheWarming,
    queryPerformance,
};

export default QueryCacheUtils;
