/**
 * Cached Vehicle Data Hooks - Addresses 10x cars API call issue
 *
 * Features:
 * - Intelligent caching with search result optimization
 * - Background refetching for fresh data
 * - Optimistic updates for vehicle changes
 * - Smart invalidation patterns
 * - Memory-efficient pagination support
 * - Integration with existing optimized queries
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { cacheInvalidation, createEnhancedQueryOptions, queryKeys } from '@/lib/cache/queryCache';
import {
    OptimizedCarWithDetails,
    PaginationOptions,
    SearchFilters,
    SearchResult,
    clearSearchCache,
    searchVehiclesOptimized,
} from '@/lib/supabase/optimizedQueries';
import { createClient } from '@/lib/supabase/supabaseClient';
import type { Tables, TablesUpdate } from '@/types/base/database.types';

export interface UseVehiclesOptions {
    enabled?: boolean;
    refetchInBackground?: boolean;
    staleTime?: number;
}

export interface UseVehicleSearchOptions extends UseVehiclesOptions {
    /** Enable infinite scroll pagination */
    infiniteScroll?: boolean;
    /** Page size for pagination */
    pageSize?: number;
    /** Automatically refetch when filters change */
    refetchOnFilterChange?: boolean;
}

export interface UseVehiclesReturn {
    vehicles: OptimizedCarWithDetails[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    isRefetching: boolean;
    refetch: () => void;
}

export interface UseVehicleReturn {
    vehicle: OptimizedCarWithDetails | null;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    isRefetching: boolean;
    refetch: () => void;
}

export interface UseVehicleSearchReturn {
    vehicles: OptimizedCarWithDetails[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    isRefetching: boolean;
    refetch: () => void;
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    goToPage: () => void;
    nextPage: () => void;
    previousPage: () => void;
}

export interface UseInfiniteVehicleSearchReturn {
    vehicles: OptimizedCarWithDetails[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    isRefetching: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
    refetch: () => void;
}

/**
 * Hook for searching vehicles with advanced caching and pagination
 */
export function useVehicleSearch(
    filters: SearchFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 12 },
    options: UseVehicleSearchOptions = {},
): UseVehicleSearchReturn {
    const queryClient = useQueryClient();

    const { data, isLoading, isError, error, isRefetching, refetch } = useQuery({
        ...createEnhancedQueryOptions<SearchResult>(
            'search-results',
            queryKeys.searchResults(JSON.stringify(filters), filters),
            'global',
            undefined,
            { ...filters, ...pagination },
            {
                enabled: options.enabled !== false,
                staleTime: options.staleTime || 3 * 60 * 1000, // 3 minutes
                refetchInterval: options.refetchInBackground ? 5 * 60 * 1000 : undefined, // 5 minutes
            },
        ),
        queryFn: () => searchVehiclesOptimized(filters, pagination),
    });

    const goToPage = useCallback(() => {
        queryClient.invalidateQueries({
            queryKey: queryKeys.searchResults(JSON.stringify(filters), filters),
        });
        // The query will automatically refetch with new pagination
    }, [filters, queryClient]);

    const nextPage = useCallback(() => {
        if (data?.hasNextPage) {
            goToPage();
        }
    }, [data?.hasNextPage, goToPage]);

    const previousPage = useCallback(() => {
        if (data?.hasPreviousPage) {
            goToPage();
        }
    }, [data?.hasPreviousPage, goToPage]);

    return {
        vehicles: data?.vehicles || [],
        isLoading,
        isError,
        error: error as Error | null,
        isRefetching,
        refetch,
        totalCount: data?.totalCount || 0,
        currentPage: data?.currentPage || 1,
        totalPages: data?.totalPages || 0,
        hasNextPage: data?.hasNextPage || false,
        hasPreviousPage: data?.hasPreviousPage || false,
        goToPage,
        nextPage,
        previousPage,
    };
}

/**
 * Hook for infinite scroll vehicle search with optimized loading
 */
export function useInfiniteVehicleSearch(
    filters: SearchFilters = {},
    options: UseVehicleSearchOptions = {},
): UseInfiniteVehicleSearchReturn {
    const pageSize = options.pageSize || 12;

    const {
        data,
        isLoading,
        isError,
        error,
        isRefetching,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
    } = useInfiniteQuery({
        queryKey: [...queryKeys.searchResults(JSON.stringify(filters), filters), 'infinite'],
        queryFn: ({ pageParam = 1 }) =>
            searchVehiclesOptimized(filters, { page: pageParam, limit: pageSize }),
        getNextPageParam: (lastPage) =>
            lastPage.hasNextPage ? lastPage.currentPage + 1 : undefined,
        initialPageParam: 1,
        enabled: options.enabled !== false,
        staleTime: options.staleTime || 3 * 60 * 1000,
        refetchInterval: options.refetchInBackground ? 5 * 60 * 1000 : undefined,
    });

    // Flatten all pages into a single array
    const vehicles = useMemo(() => {
        return data?.pages.flatMap((page) => page.vehicles) || [];
    }, [data?.pages]);

    return {
        vehicles,
        isLoading,
        isError,
        error: error as Error | null,
        isRefetching,
        hasNextPage: hasNextPage || false,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
    };
}

/**
 * Hook for getting a single vehicle with caching
 */
export function useVehicle(vehicleId: string | undefined, options: UseVehiclesOptions = {}) {
    const queryClient = useQueryClient();
    const supabase = createClient();

    const {
        data: vehicle,
        isLoading,
        isError,
        error,
        isRefetching,
        refetch,
    } = useQuery({
        ...createEnhancedQueryOptions<OptimizedCarWithDetails>(
            'vehicle-details',
            queryKeys.vehicleDetails(vehicleId!),
            'vehicle',
            vehicleId,
            undefined,
            {
                enabled: options.enabled !== false && !!vehicleId,
                staleTime: options.staleTime || 10 * 60 * 1000, // 10 minutes
                refetchInterval: options.refetchInBackground ? 15 * 60 * 1000 : undefined, // 15 minutes
            },
        ),
        queryFn: async (): Promise<OptimizedCarWithDetails> => {
            if (!vehicleId) {
                throw new Error('Vehicle ID is required');
            }

            const { data: vehicle, error: vehicleError } = await supabase
                .from('cars')
                .select(
                    `
          *,
          car_images(*),
          host_profile:user_profiles!cars_host_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `,
                )
                .eq('id', vehicleId)
                .eq('status', 'ACTIVE')
                .single();

            if (vehicleError) {
                throw new Error(`Vehicle fetch error: ${vehicleError.message}`);
            }

            if (!vehicle) {
                throw new Error(`Vehicle not found: ${vehicleId}`);
            }

            // Process the data to match OptimizedCarWithDetails interface
            const primaryImage = vehicle.car_images?.find((img: any) => img.is_primary);

            return {
                ...vehicle,
                host_profile: Array.isArray(vehicle.host_profile)
                    ? vehicle.host_profile[0]
                    : vehicle.host_profile,
                car_images: vehicle.car_images || [],
                availability_status: 'not_specified' as const,
                primary_image_url:
                    primaryImage?.image_url || vehicle.car_images?.[0]?.image_url || '',
            };
        },
    });

    // Vehicle update mutation with optimistic updates
    const {
        mutateAsync: updateVehicle,
        isPending: isUpdating,
        error: updateError,
    } = useMutation({
        mutationFn: async (updates: TablesUpdate<'cars'>): Promise<OptimizedCarWithDetails> => {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error('User not authenticated');
            }

            if (!vehicleId) {
                throw new Error('Vehicle ID is required');
            }

            // Check if user owns this vehicle
            if (vehicle && vehicle.host_id !== user.id) {
                throw new Error('Cannot update vehicle owned by another user');
            }

            const { data: updatedVehicle, error: updateError } = await supabase
                .from('cars')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', vehicleId)
                .select(
                    `
          *,
          car_images(*),
          host_profile:user_profiles!cars_host_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `,
                )
                .single();

            if (updateError) {
                throw new Error(`Vehicle update error: ${updateError.message}`);
            }

            // Process the updated data
            const primaryImage = updatedVehicle.car_images?.find((img: any) => img.is_primary);

            return {
                ...updatedVehicle,
                host_profile: Array.isArray(updatedVehicle.host_profile)
                    ? updatedVehicle.host_profile[0]
                    : updatedVehicle.host_profile,
                car_images: updatedVehicle.car_images || [],
                availability_status: 'not_specified' as const,
                primary_image_url:
                    primaryImage?.image_url || updatedVehicle.car_images?.[0]?.image_url || '',
            };
        },
        onMutate: async (updates) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey: queryKeys.vehicleDetails(vehicleId!),
            });

            // Snapshot the previous value
            const previousVehicle = queryClient.getQueryData<OptimizedCarWithDetails>(
                queryKeys.vehicleDetails(vehicleId!),
            );

            // Optimistically update to the new value
            if (previousVehicle) {
                queryClient.setQueryData<OptimizedCarWithDetails>(
                    queryKeys.vehicleDetails(vehicleId!),
                    {
                        ...previousVehicle,
                        ...updates,
                        updated_at: new Date().toISOString(),
                    },
                );
            }

            return { previousVehicle };
        },
        onError: (error, updates, context) => {
            // Rollback to previous value on error
            if (context?.previousVehicle) {
                queryClient.setQueryData(
                    queryKeys.vehicleDetails(vehicleId!),
                    context.previousVehicle,
                );
            }
        },
        onSuccess: (updatedVehicle) => {
            // Update the cache with the server response
            queryClient.setQueryData(queryKeys.vehicleDetails(vehicleId!), updatedVehicle);

            // Invalidate related caches
            cacheInvalidation.invalidateVehicles(queryClient, vehicleId, updatedVehicle.host_id);
        },
    });

    return {
        vehicle,
        isLoading,
        isError,
        error: error as Error | null,
        isRefetching,
        refetch,
        updateVehicle,
        isUpdating,
        updateError: updateError as Error | null,
    };
}

/**
 * Hook for getting vehicles by host ID with caching
 */
export function useHostVehicles(
    hostId: string | undefined,
    options: UseVehiclesOptions = {},
): UseVehiclesReturn {
    const supabase = createClient();

    const {
        data: vehicles,
        isLoading,
        isError,
        error,
        isRefetching,
        refetch,
    } = useQuery({
        ...createEnhancedQueryOptions<OptimizedCarWithDetails[]>(
            'vehicle-list',
            queryKeys.vehiclesByHost(hostId!),
            'host',
            hostId,
            undefined,
            {
                enabled: options.enabled !== false && !!hostId,
                staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes
                refetchInterval: options.refetchInBackground ? 10 * 60 * 1000 : undefined, // 10 minutes
            },
        ),
        queryFn: async (): Promise<OptimizedCarWithDetails[]> => {
            if (!hostId) {
                throw new Error('Host ID is required');
            }

            const { data: vehicles, error: vehiclesError } = await supabase
                .from('cars')
                .select(
                    `
          *,
          car_images(*),
          host_profile:user_profiles!cars_host_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `,
                )
                .eq('host_id', hostId)
                .eq('status', 'ACTIVE')
                .order('created_at', { ascending: false });

            if (vehiclesError) {
                throw new Error(`Vehicles fetch error: ${vehiclesError.message}`);
            }

            return (vehicles || []).map((vehicle) => {
                const primaryImage = vehicle.car_images?.find((img: any) => img.is_primary);

                return {
                    ...vehicle,
                    host_profile: Array.isArray(vehicle.host_profile)
                        ? vehicle.host_profile[0]
                        : vehicle.host_profile,
                    car_images: vehicle.car_images || [],
                    availability_status: 'not_specified' as const,
                    primary_image_url:
                        primaryImage?.image_url || vehicle.car_images?.[0]?.image_url || '',
                };
            });
        },
    });

    return {
        vehicles: vehicles || [],
        isLoading,
        isError,
        error: error as Error | null,
        isRefetching,
        refetch,
    };
}

/**
 * Hook for creating a new vehicle with cache invalidation
 */
export function useCreateVehicle() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (
            vehicleData: Omit<Tables<'cars'>, 'id' | 'created_at' | 'updated_at'>,
        ): Promise<Tables<'cars'>> => {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error('User not authenticated');
            }

            const { data: newVehicle, error: createError } = await supabase
                .from('cars')
                .insert({
                    ...vehicleData,
                    host_id: user.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (createError) {
                throw new Error(`Vehicle creation error: ${createError.message}`);
            }

            return newVehicle;
        },
        onSuccess: (newVehicle) => {
            // Invalidate related caches
            cacheInvalidation.invalidateVehicles(queryClient, undefined, newVehicle.host_id);
            cacheInvalidation.invalidateSearchResults(queryClient);

            // Clear the optimized search cache as well
            clearSearchCache();
        },
    });
}

/**
 * Hook for deleting a vehicle with cache invalidation
 */
export function useDeleteVehicle() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (vehicleId: string): Promise<void> => {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error('User not authenticated');
            }

            // Get vehicle details first to check ownership and get host_id
            const { data: vehicle, error: fetchError } = await supabase
                .from('cars')
                .select('host_id')
                .eq('id', vehicleId)
                .single();

            if (fetchError) {
                throw new Error(`Vehicle fetch error: ${fetchError.message}`);
            }

            if (vehicle.host_id !== user.id) {
                throw new Error('Cannot delete vehicle owned by another user');
            }

            const { error: deleteError } = await supabase
                .from('cars')
                .update({ status: 'INACTIVE' })
                .eq('id', vehicleId);

            if (deleteError) {
                throw new Error(`Vehicle deletion error: ${deleteError.message}`);
            }
        },
        onSuccess: (_, vehicleId) => {
            // Remove from cache immediately
            queryClient.removeQueries({ queryKey: queryKeys.vehicleDetails(vehicleId) });

            // Invalidate related caches
            cacheInvalidation.invalidateVehicles(queryClient);
            cacheInvalidation.invalidateSearchResults(queryClient);

            // Clear the optimized search cache
            clearSearchCache();
        },
    });
}

/**
 * Preload vehicles for better UX
 */
export function usePreloadVehicles() {
    const queryClient = useQueryClient();

    const preloadVehicleSearch = useCallback(
        async (filters: SearchFilters, pagination: PaginationOptions = { page: 1, limit: 12 }) => {
            const queryKey = queryKeys.searchResults(JSON.stringify(filters), filters);
            const cached = queryClient.getQueryData(queryKey);

            if (!cached) {
                try {
                    const data = await searchVehiclesOptimized(filters, pagination);
                    queryClient.setQueryData(queryKey, data);
                } catch (error) {
                    console.error('Error preloading vehicle search:', error);
                }
            }
        },
        [queryClient],
    );

    const preloadVehicle = useCallback(
        async (vehicleId: string) => {
            const queryKey = queryKeys.vehicleDetails(vehicleId);
            const cached = queryClient.getQueryData(queryKey);

            if (!cached) {
                // This would be implemented using the same logic as useVehicle
                // For brevity, we'll just mark it for future implementation
                console.log(`Preloading vehicle ${vehicleId} - implementation needed`);
            }
        },
        [queryClient],
    );

    return { preloadVehicleSearch, preloadVehicle };
}

/**
 * Cache statistics for vehicles
 */
export function useVehicleCacheStats() {
    const queryClient = useQueryClient();

    return useMemo(() => {
        const cache = queryClient.getQueryCache();
        const vehicleQueries = cache.findAll({
            predicate: (query) => {
                const queryKey = query.queryKey;
                return (
                    Array.isArray(queryKey) &&
                    (queryKey.includes('vehicles') ||
                        queryKey.includes('search') ||
                        queryKey[0] === 'vehicle-details' ||
                        queryKey[0] === 'vehicle-list')
                );
            },
        });

        return {
            totalCached: vehicleQueries.length,
            staleCount: vehicleQueries.filter((query) => query.isStale()).length,
            errorCount: vehicleQueries.filter((query) => query.state.status === 'error').length,
            loadingCount: vehicleQueries.filter((query) => query.state.status === 'pending').length,
            searchQueries: vehicleQueries.filter((q) => q.queryKey.includes('search')).length,
            detailQueries: vehicleQueries.filter((q) => q.queryKey.includes('details')).length,
            listQueries: vehicleQueries.filter((q) => q.queryKey.includes('vehicles')).length,
        };
    }, [queryClient]);
}
