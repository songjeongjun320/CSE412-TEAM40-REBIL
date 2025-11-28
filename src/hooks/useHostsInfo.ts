import { useCallback, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';

export interface HostInfo {
    id: string;
    full_name: string | null;
    profile_image_url: string | null;
    email: string;
}

export interface UseHostsInfoReturn {
    hostsInfo: Map<string, HostInfo>;
    loading: boolean;
    error: string | null;
    fetchHostsInfo: (hostIds: string[]) => Promise<void>;
    getHostInfo: (hostId: string) => HostInfo | undefined;
}

/**
 * Custom hook for batch fetching host information to eliminate redundant API calls
 * in VehicleCard components.
 *
 * Features:
 * - Batch fetching of multiple host profiles in a single API call
 * - Caching to prevent redundant requests for already-fetched hosts
 * - Optimized data structure using Map for O(1) lookups
 * - Error handling and loading states
 * - Memory-efficient with automatic deduplication
 */
export function useHostsInfo(): UseHostsInfoReturn {
    const [hostsInfo, setHostsInfo] = useState<Map<string, HostInfo>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch host information for multiple host IDs in a single batch request
     * Only fetches hosts that aren't already cached
     */
    const fetchHostsInfo = useCallback(
        async (hostIds: string[]) => {
            if (!hostIds || hostIds.length === 0) return;

            // Filter out already cached host IDs to avoid redundant API calls
            const uncachedHostIds = hostIds.filter((id) => !hostsInfo.has(id));

            if (uncachedHostIds.length === 0) {
                // All requested hosts are already cached
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const supabase = createClient();

                // Batch fetch user profiles for all unique host IDs
                const { data: hostProfiles, error: fetchError } = await supabase
                    .from('user_profiles')
                    .select('id, full_name, profile_image_url, email')
                    .in('id', uncachedHostIds);

                if (fetchError) {
                    throw new Error(`Failed to fetch host profiles: ${fetchError.message}`);
                }

                if (hostProfiles) {
                    setHostsInfo((prevHostsInfo) => {
                        const newHostsInfo = new Map(prevHostsInfo);

                        // Add newly fetched host information to the cache
                        hostProfiles.forEach((profile) => {
                            newHostsInfo.set(profile.id, {
                                id: profile.id,
                                full_name: profile.full_name,
                                profile_image_url: profile.profile_image_url,
                                email: profile.email,
                            });
                        });

                        return newHostsInfo;
                    });
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                console.error('Error fetching hosts info:', errorMessage);
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        },
        [hostsInfo],
    );

    /**
     * Get cached host information by host ID
     * Returns undefined if host info is not yet cached
     */
    const getHostInfo = useCallback(
        (hostId: string): HostInfo | undefined => {
            return hostsInfo.get(hostId);
        },
        [hostsInfo],
    );

    // Auto-cleanup effect to prevent memory leaks
    useEffect(() => {
        return () => {
            setHostsInfo(new Map());
            setError(null);
        };
    }, []);

    return {
        hostsInfo,
        loading,
        error,
        fetchHostsInfo,
        getHostInfo,
    };
}

/**
 * Utility function to extract unique host IDs from an array of cars
 */
export function extractUniqueHostIds<T extends { host_id: string }>(cars: T[]): string[] {
    const hostIds = new Set<string>();
    cars.forEach((car) => {
        if (car.host_id) {
            hostIds.add(car.host_id);
        }
    });
    return Array.from(hostIds);
}

/**
 * React Hook for pre-fetching host information when cars data becomes available
 * Automatically extracts unique host IDs and triggers batch fetch
 */
export function useAutoFetchHostsInfo<T extends { host_id: string }>(
    cars: T[],
): UseHostsInfoReturn {
    const hostsInfoHook = useHostsInfo();

    useEffect(() => {
        if (cars && cars.length > 0) {
            const uniqueHostIds = extractUniqueHostIds(cars);
            if (uniqueHostIds.length > 0) {
                hostsInfoHook.fetchHostsInfo(uniqueHostIds);
            }
        }
    }, [cars, hostsInfoHook]);

    return hostsInfoHook;
}
