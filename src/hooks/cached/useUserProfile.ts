/**
 * Cached User Profile Hook - Addresses 6x user_profiles API call issue
 *
 * Features:
 * - Intelligent caching with smart invalidation
 * - Background refetching for fresh data
 * - Optimistic updates for profile changes
 * - Batch loading for multiple users
 * - Memory-efficient with automatic cleanup
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { cacheInvalidation, createEnhancedQueryOptions, queryKeys } from '@/lib/cache/queryCache';
import { createClient } from '@/lib/supabase/supabaseClient';
import { Tables } from '@/types/base/database.types';

type UserProfile = Tables<'user_profiles'>;
type UserProfileUpdate = Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;

export interface UseUserProfileOptions {
    /** Whether to fetch the user profile immediately */
    enabled?: boolean;
    /** Whether to refetch in the background */
    refetchInBackground?: boolean;
    /** Custom stale time override */
    staleTime?: number;
}

export interface UseUserProfileReturn {
    profile: UserProfile | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    isRefetching: boolean;
    refetch: () => void;
    updateProfile: (updates: UserProfileUpdate) => Promise<UserProfile>;
    isUpdating: boolean;
    updateError: Error | null;
}

/**
 * Hook for accessing current user's profile with caching
 */
export function useCurrentUserProfile(options: UseUserProfileOptions = {}): UseUserProfileReturn {
    const queryClient = useQueryClient();
    const supabase = createClient();

    // Fetch current user profile
    const {
        data: profile,
        isLoading,
        isError,
        error,
        isRefetching,
        refetch,
    } = useQuery({
        ...createEnhancedQueryOptions<UserProfile>(
            'user-profile',
            queryKeys.currentUserProfile(),
            'current',
            'current',
            undefined,
            {
                enabled: options.enabled !== false,
                staleTime: options.staleTime,
                refetchInterval: options.refetchInBackground ? 10 * 60 * 1000 : undefined, // 10 minutes
            },
        ),
        queryFn: async (): Promise<UserProfile> => {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) {
                throw new Error(`Authentication error: ${authError.message}`);
            }

            if (!user) {
                throw new Error('No authenticated user found');
            }

            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                throw new Error(`Profile fetch error: ${profileError.message}`);
            }

            if (!profile) {
                throw new Error('User profile not found');
            }

            return profile;
        },
    });

    // Profile update mutation with optimistic updates
    const {
        mutateAsync: updateProfile,
        isPending: isUpdating,
        error: updateError,
    } = useMutation({
        mutationFn: async (updates: UserProfileUpdate): Promise<UserProfile> => {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error('User not authenticated');
            }

            const { data: updatedProfile, error: updateError } = await supabase
                .from('user_profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id)
                .select()
                .single();

            if (updateError) {
                throw new Error(`Profile update error: ${updateError.message}`);
            }

            return updatedProfile;
        },
        onMutate: async (updates) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.currentUserProfile() });

            // Snapshot the previous value
            const previousProfile = queryClient.getQueryData<UserProfile>(
                queryKeys.currentUserProfile(),
            );

            // Optimistically update to the new value
            if (previousProfile) {
                queryClient.setQueryData<UserProfile>(queryKeys.currentUserProfile(), {
                    ...previousProfile,
                    ...updates,
                    updated_at: new Date().toISOString(),
                });
            }

            return { previousProfile };
        },
        onError: (error, updates, context) => {
            // Rollback to previous value on error
            if (context?.previousProfile) {
                queryClient.setQueryData(queryKeys.currentUserProfile(), context.previousProfile);
            }
        },
        onSuccess: (updatedProfile) => {
            // Update the cache with the server response
            queryClient.setQueryData(queryKeys.currentUserProfile(), updatedProfile);

            // Invalidate related caches
            cacheInvalidation.invalidateUserProfile(queryClient, updatedProfile.id);
        },
    });

    return {
        profile,
        isLoading,
        isError,
        error: error as Error | null,
        isRefetching,
        refetch,
        updateProfile,
        isUpdating,
        updateError: updateError as Error | null,
    };
}

/**
 * Hook for accessing any user's profile by ID with caching
 */
export function useUserProfile(
    userId: string | undefined,
    options: UseUserProfileOptions = {},
): UseUserProfileReturn {
    const queryClient = useQueryClient();
    const supabase = createClient();

    // Fetch user profile by ID
    const {
        data: profile,
        isLoading,
        isError,
        error,
        isRefetching,
        refetch,
    } = useQuery({
        ...createEnhancedQueryOptions<UserProfile>(
            'user-profile',
            queryKeys.userProfile(userId!),
            'user',
            userId,
            undefined,
            {
                enabled: options.enabled !== false && !!userId,
                staleTime: options.staleTime,
                refetchInterval: options.refetchInBackground ? 10 * 60 * 1000 : undefined,
            },
        ),
        queryFn: async (): Promise<UserProfile> => {
            if (!userId) {
                throw new Error('User ID is required');
            }

            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileError) {
                throw new Error(`Profile fetch error: ${profileError.message}`);
            }

            if (!profile) {
                throw new Error(`User profile not found for ID: ${userId}`);
            }

            return profile;
        },
    });

    // Profile update mutation (only for current user)
    const {
        mutateAsync: updateProfile,
        isPending: isUpdating,
        error: updateError,
    } = useMutation({
        mutationFn: async (updates: UserProfileUpdate): Promise<UserProfile> => {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error('User not authenticated');
            }

            if (user.id !== userId) {
                throw new Error("Cannot update another user's profile");
            }

            const { data: updatedProfile, error: updateError } = await supabase
                .from('user_profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId)
                .select()
                .single();

            if (updateError) {
                throw new Error(`Profile update error: ${updateError.message}`);
            }

            return updatedProfile;
        },
        onSuccess: (updatedProfile) => {
            // Update the cache with the server response
            queryClient.setQueryData(queryKeys.userProfile(userId!), updatedProfile);

            // Invalidate related caches
            cacheInvalidation.invalidateUserProfile(queryClient, updatedProfile.id);
        },
    });

    return {
        profile,
        isLoading,
        isError,
        error: error as Error | null,
        isRefetching,
        refetch,
        updateProfile,
        isUpdating,
        updateError: updateError as Error | null,
    };
}

/**
 * Hook for batch loading multiple user profiles with smart caching
 * Addresses N+1 query problems when displaying multiple users
 */
export function useBatchUserProfiles(userIds: string[], options: UseUserProfileOptions = {}) {
    const queryClient = useQueryClient();
    const supabase = createClient();

    // Filter out already cached user IDs to avoid duplicate requests
    const uncachedUserIds = useMemo(() => {
        return userIds.filter((userId) => {
            const cachedData = queryClient.getQueryData(queryKeys.userProfile(userId));
            return !cachedData;
        });
    }, [userIds, queryClient]);

    // Batch fetch uncached profiles
    const {
        data: profiles,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ['user-profiles', 'batch', ...userIds.sort()],
        queryFn: async (): Promise<UserProfile[]> => {
            if (uncachedUserIds.length === 0) {
                // All profiles are cached, return them
                return userIds
                    .map((userId) =>
                        queryClient.getQueryData<UserProfile>(queryKeys.userProfile(userId)),
                    )
                    .filter((profile): profile is UserProfile => profile !== undefined);
            }

            // Batch fetch uncached profiles
            const { data: batchProfiles, error: batchError } = await supabase
                .from('user_profiles')
                .select('*')
                .in('id', uncachedUserIds);

            if (batchError) {
                throw new Error(`Batch profile fetch error: ${batchError.message}`);
            }

            // Cache individual profiles
            batchProfiles?.forEach((profile) => {
                queryClient.setQueryData(queryKeys.userProfile(profile.id), profile);
            });

            // Return all profiles (cached + newly fetched)
            return userIds
                .map((userId) => {
                    const cached = queryClient.getQueryData<UserProfile>(
                        queryKeys.userProfile(userId),
                    );
                    if (cached) return cached;
                    return batchProfiles?.find((p) => p.id === userId);
                })
                .filter((profile): profile is UserProfile => profile !== undefined);
        },
        enabled: options.enabled !== false && userIds.length > 0,
        staleTime: options.staleTime || 10 * 60 * 1000, // 10 minutes
        refetchInterval: options.refetchInBackground ? 15 * 60 * 1000 : undefined, // 15 minutes
    });

    // Helper function to get individual profile by ID
    const getProfile = useCallback(
        (userId: string): UserProfile | undefined => {
            return profiles?.find((profile) => profile.id === userId);
        },
        [profiles],
    );

    // Helper function to check if profile is loading
    const isProfileLoading = useCallback(
        (userId: string): boolean => {
            return isLoading && !queryClient.getQueryData(queryKeys.userProfile(userId));
        },
        [isLoading, queryClient],
    );

    return {
        profiles: profiles || [],
        profilesMap: useMemo(() => {
            const map = new Map<string, UserProfile>();
            profiles?.forEach((profile) => map.set(profile.id, profile));
            return map;
        }, [profiles]),
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
        getProfile,
        isProfileLoading,
        totalProfiles: profiles?.length || 0,
        requestedCount: userIds.length,
    };
}

/**
 * Preload user profiles for better UX
 */
export function usePreloadUserProfiles() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    const preloadProfiles = useCallback(
        async (userIds: string[]) => {
            const uncachedIds = userIds.filter((userId) => {
                const cached = queryClient.getQueryData(queryKeys.userProfile(userId));
                return !cached;
            });

            if (uncachedIds.length === 0) return;

            try {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .in('id', uncachedIds);

                profiles?.forEach((profile) => {
                    queryClient.setQueryData(queryKeys.userProfile(profile.id), profile);
                });
            } catch (error) {
                console.error('Error preloading user profiles:', error);
            }
        },
        [queryClient, supabase],
    );

    return { preloadProfiles };
}

/**
 * Cache statistics for user profiles
 */
export function useUserProfileCacheStats() {
    const queryClient = useQueryClient();

    return useMemo(() => {
        const cache = queryClient.getQueryCache();
        const userProfileQueries = cache.findAll({
            queryKey: ['user-profile'],
        });

        return {
            totalCached: userProfileQueries.length,
            staleCount: userProfileQueries.filter((query) => query.isStale()).length,
            errorCount: userProfileQueries.filter((query) => query.state.status === 'error').length,
            loadingCount: userProfileQueries.filter((query) => query.state.status === 'pending')
                .length,
        };
    }, [queryClient]);
}
