/**
 * Cached Hooks Index
 *
 * Centralized export of all cached hooks for easy imports
 * and consistent usage patterns across the application.
 */

import { memo } from 'react';

import { cacheManager } from '@/lib/cache/cacheManager';
import type { CacheKeyType } from '@/lib/cache/types';

// User Profile Hooks
export {
    useCurrentUserProfile,
    useUserProfile,
    useBatchUserProfiles,
    usePreloadUserProfiles,
    useUserProfileCacheStats,
} from './useUserProfile';

// Vehicle Hooks
export {
    useVehicleSearch,
    useInfiniteVehicleSearch,
    useVehicle,
    useHostVehicles,
    useCreateVehicle,
    useDeleteVehicle,
    usePreloadVehicles,
    useVehicleCacheStats,
} from './useVehicles';

// Authentication Hooks
export { useAuth, useUserRoles, usePermissions, useSession, useAuthCache } from './useAuth';

// Location Hooks
export {
    useGeocoding,
    useReverseGeocoding,
    useNearbyPlaces,
    useAddressValidation,
    useCurrentLocation,
    useLocationUtils,
    useLocationCache,
} from './useLocation';

// Re-export types for convenience
export type { UseUserProfileOptions, UseUserProfileReturn } from './useUserProfile';

export type {
    UseVehiclesOptions,
    UseVehicleSearchOptions,
    UseVehicleReturn,
    UseVehiclesReturn,
    UseInfiniteVehicleSearchReturn,
} from './useVehicles';

export type { UseLocationOptions } from './useLocation';

// Cache utilities and managers
export { cacheManager, createCacheKey, invalidationPatterns } from '@/lib/cache/cacheManager';
export {
    getQueryClient,
    createEnhancedQueryOptions,
    queryKeys,
    cacheInvalidation,
    cacheWarming,
    queryPerformance,
    queryPresets,
} from '@/lib/cache/queryCache';

export type {
    CacheKeyType,
    HierarchicalCacheKey,
    InvalidationPattern,
    EnhancedQueryOptions,
    EnhancedMutationOptions,
} from '@/lib/cache/types';

// Cache configuration and utilities
export {
    CACHE_CONFIG,
    PERFORMANCE_THRESHOLDS,
    CACHE_WARMING_STRATEGIES,
    CACHE_HEALTH_CHECKS,
    DEV_UTILITIES,
    COMMON_CACHE_CONFIGS,
} from '@/utils/cacheConfig';

/**
 * Migration helpers for upgrading existing components to use cached hooks
 */

// Hook migration patterns
export const MIGRATION_PATTERNS = {
    // Example migration from direct Supabase calls to cached hooks
    userProfile: {
        before: `
      // Old pattern
      const [profile, setProfile] = useState(null);
      const [loading, setLoading] = useState(true);
      
      useEffect(() => {
        const fetchProfile = async () => {
          const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
          setProfile(data);
          setLoading(false);
        };
        fetchProfile();
      }, [userId]);
    `,
        after: `
      // New cached pattern
      const { profile, isLoading } = useUserProfile(userId);
    `,
    },

    vehicleSearch: {
        before: `
      // Old pattern
      const [vehicles, setVehicles] = useState([]);
      const [loading, setLoading] = useState(true);
      
      useEffect(() => {
        const fetchVehicles = async () => {
          const result = await searchVehiclesOptimized(filters, pagination);
          setVehicles(result.vehicles);
          setLoading(false);
        };
        fetchVehicles();
      }, [filters, pagination]);
    `,
        after: `
      // New cached pattern
      const { vehicles, isLoading } = useVehicleSearch(filters, pagination);
    `,
    },

    batchUserProfiles: {
        before: `
      // Old pattern with N+1 problem
      const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
      
      useEffect(() => {
        const fetchProfiles = async () => {
          const profilePromises = userIds.map(id => 
            supabase.from('user_profiles').select('*').eq('id', id).single()
          );
          const results = await Promise.all(profilePromises);
          // ... handle results
        };
        fetchProfiles();
      }, [userIds]);
    `,
        after: `
      // New batch cached pattern
      const { profilesMap } = useBatchUserProfiles(userIds);
    `,
    },
} as const;

/**
 * Performance optimization utilities for cached components
 */
export const OPTIMIZATION_UTILS = {
    // Memoization helpers
    createVehicleCardMemo: () => {
        const MemoizedVehicleCard = memo((props: any) => {
            return (
                props.car.id === props.car.id &&
                props.car.updated_at === props.car.updated_at &&
                props.hostId === props.hostId
            );
        });
        MemoizedVehicleCard.displayName = 'MemoizedVehicleCard';
        return MemoizedVehicleCard;
    },

    // Preloading strategies
    preloadCommonData: async () => {
        // Note: This would be called from within a React component
        // that has access to the hooks
        const commonSearches = [
            { location: 'Jakarta' },
            { transmission: 'Automatic' },
            { priceMax: 500000 },
        ];

        // Implementation would be done in a React component context
        console.log('Common searches to preload:', commonSearches);
    },

    // Cache warming on user actions
    warmCacheOnUserInteraction: (interaction: string, data: any) => {
        if (typeof window !== 'undefined') {
            // Use the warming strategies from config
            import('@/utils/cacheConfig').then(({ CACHE_WARMING_STRATEGIES }) => {
                CACHE_WARMING_STRATEGIES.onUserInteraction(interaction, data);
            });
        }
    },
} as const;

/**
 * Development utilities for cache debugging
 */
export const DEBUG_UTILS = {
    // Log cache statistics
    logCacheStats: () => {
        if (process.env.NODE_ENV === 'development') {
            const stats = cacheManager.getStatistics();
            console.group('Cache Statistics');
            console.table(stats.byType);
            console.log('Total:', stats.total);
            console.log('Storage:', stats.storage);
            console.groupEnd();
        }
    },

    // Monitor specific cache type
    monitorCacheType: (type: CacheKeyType) => {
        if (process.env.NODE_ENV === 'development') {
            return cacheManager.addEventListener((event) => {
                if (event.key.includes(type)) {
                    console.log(`[${type.toUpperCase()}]`, event);
                }
            });
        }
        return () => {};
    },

    // Validate cache health
    validateCacheHealth: () => {
        if (process.env.NODE_ENV === 'development') {
            import('@/utils/cacheConfig').then(({ CACHE_HEALTH_CHECKS }) => {
                const stats = cacheManager.getStatistics();

                const hitRateCheck = CACHE_HEALTH_CHECKS.checkHitRate(stats);
                const memoryCheck = CACHE_HEALTH_CHECKS.checkMemoryUsage(stats);

                console.group('Cache Health Check');
                console.log('Hit Rate:', hitRateCheck);
                console.log('Memory Usage:', memoryCheck);
                console.groupEnd();

                if (!hitRateCheck.healthy || !memoryCheck.healthy) {
                    console.warn('Cache health issues detected!');
                }
            });
        }
    },
} as const;
