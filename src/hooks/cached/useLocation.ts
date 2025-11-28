/**
 * Cached Location and Address Hooks
 *
 * Features:
 * - Geocoding result caching with long TTL
 * - Address validation and formatting
 * - Location-based search optimization
 * - Smart invalidation for location data
 * - Indonesia-specific address handling
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { IndonesianAddress } from '@/components/address';
import { createEnhancedQueryOptions, queryKeys } from '@/lib/cache/queryCache';

// Simple replacement functions for deleted addressHelpers
function formatAddressDisplay(
    address: IndonesianAddress | { street_address: string; city_id: string; province_id: string },
): string {
    if (!address) return 'No address provided';
    return address.street_address || 'Address not specified';
}

function validateIndonesianAddressFormat(address: any): address is IndonesianAddress {
    if (!address || typeof address !== 'object') return false;
    return !!(address.street_address && (address.city_id || address.province_id));
}

interface LocationCoordinates {
    lat: number;
    lng: number;
}

interface GeocodingResult {
    address: string;
    formattedAddress: string;
    coordinates: LocationCoordinates;
    addressComponents: IndonesianAddress;
    placeId?: string;
    types?: string[];
}

interface ReverseGeocodingResult extends GeocodingResult {
    accuracy: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
}

export interface UseLocationOptions {
    enabled?: boolean;
    staleTime?: number;
    refetchInBackground?: boolean;
}

interface UseGeocodingReturn {
    result: GeocodingResult | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
}

interface UseReverseGeocodingReturn {
    result: ReverseGeocodingResult | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Mock geocoding service (replace with actual service like Google Maps)
 * This is a placeholder implementation
 */
const mockGeocoding = {
    async geocode(address: string): Promise<GeocodingResult> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Mock implementation - replace with actual geocoding service
        const mockCoordinates: LocationCoordinates = {
            lat: -6.2088 + (Math.random() - 0.5) * 0.1,
            lng: 106.8456 + (Math.random() - 0.5) * 0.1,
        };

        const addressComponents = {
            street_address: address,
            city_id: '',
            province_id: '',
        };

        return {
            address,
            formattedAddress: formatAddressDisplay({
                street_address: address,
                city_id: '',
                province_id: '',
            }),
            coordinates: mockCoordinates,
            addressComponents,
            placeId: `place_${Date.now()}`,
            types: ['street_address'],
        };
    },

    async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Mock implementation - replace with actual reverse geocoding service
        const mockAddress = `Jl. Mock Street No. ${Math.floor(Math.random() * 100)}, Jakarta Pusat, DKI Jakarta 10110`;
        const addressComponents = {
            street_address: mockAddress,
            city_id: '',
            province_id: '',
        };

        return {
            address: mockAddress,
            formattedAddress: formatAddressDisplay({
                street_address: mockAddress,
                city_id: '',
                province_id: '',
            }),
            coordinates: { lat, lng },
            addressComponents,
            placeId: `place_${Date.now()}`,
            types: ['street_address'],
            accuracy: 'ROOFTOP',
        };
    },

    async searchNearby(coordinates: LocationCoordinates): Promise<GeocodingResult[]> {
        // Mock implementation for nearby places search
        await new Promise((resolve) => setTimeout(resolve, 400));

        const mockResults: GeocodingResult[] = [];
        for (let i = 0; i < 5; i++) {
            const mockCoordinates: LocationCoordinates = {
                lat: coordinates.lat + (Math.random() - 0.5) * 0.01,
                lng: coordinates.lng + (Math.random() - 0.5) * 0.01,
            };

            const mockAddress = `Jl. Nearby Street ${i + 1}, Jakarta Pusat, DKI Jakarta`;
            const addressComponents = {
                street_address: mockAddress,
                city_id: '',
                province_id: '',
            };

            mockResults.push({
                address: mockAddress,
                formattedAddress: formatAddressDisplay({
                    street_address: mockAddress,
                    city_id: '',
                    province_id: '',
                }),
                coordinates: mockCoordinates,
                addressComponents,
                placeId: `nearby_${i}_${Date.now()}`,
                types: ['establishment'],
            });
        }

        return mockResults;
    },
};

/**
 * Hook for geocoding addresses with caching
 */
export function useGeocoding(
    address: string | undefined,
    options: UseLocationOptions = {},
): UseGeocodingReturn {
    const {
        data: result,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        ...createEnhancedQueryOptions<GeocodingResult>(
            'location-data',
            queryKeys.geocoding(address!),
            'global',
            undefined,
            { address },
            {
                enabled: options.enabled !== false && !!address && address.length > 3,
                staleTime: options.staleTime || 60 * 60 * 1000, // 1 hour - geocoding results are stable
                refetchInterval: options.refetchInBackground ? undefined : undefined, // Don't background refetch
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
            },
        ),
        queryFn: async (): Promise<GeocodingResult> => {
            if (!address) {
                throw new Error('Address is required for geocoding');
            }

            // Validate Indonesian address format
            const addressComponents = {
                street_address: address,
                city_id: '',
                province_id: '',
            };
            const isValid = validateIndonesianAddressFormat(addressComponents);

            if (!isValid) {
                throw new Error('Invalid Indonesian address format');
            }

            try {
                const result = await mockGeocoding.geocode(address);
                return result;
            } catch (error) {
                throw new Error(
                    `Geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
            }
        },
        retry: (failureCount, error: any) => {
            // Don't retry for validation errors
            if (error?.message?.includes('Invalid Indonesian address')) {
                return false;
            }
            return failureCount < 2;
        },
    });

    return {
        result,
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
    };
}

/**
 * Hook for reverse geocoding coordinates with caching
 */
export function useReverseGeocoding(
    coordinates: LocationCoordinates | undefined,
    options: UseLocationOptions = {},
): UseReverseGeocodingReturn {
    const {
        data: result,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        ...createEnhancedQueryOptions<ReverseGeocodingResult>(
            'location-data',
            queryKeys.reverseGeocoding(coordinates?.lat || 0, coordinates?.lng || 0),
            'global',
            undefined,
            coordinates,
            {
                enabled: options.enabled !== false && !!coordinates,
                staleTime: options.staleTime || 30 * 60 * 1000, // 30 minutes
                refetchInterval: options.refetchInBackground ? undefined : undefined,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
            },
        ),
        queryFn: async (): Promise<ReverseGeocodingResult> => {
            if (!coordinates) {
                throw new Error('Coordinates are required for reverse geocoding');
            }

            const { lat, lng } = coordinates;

            // Validate coordinates (Indonesia bounds check)
            if (lat < -11 || lat > 6 || lng < 95 || lng > 141) {
                throw new Error('Coordinates are outside Indonesia bounds');
            }

            try {
                const result = await mockGeocoding.reverseGeocode(lat, lng);
                return result;
            } catch (error) {
                throw new Error(
                    `Reverse geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
            }
        },
    });

    return {
        result,
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
    };
}

/**
 * Hook for searching nearby places with caching
 */
export function useNearbyPlaces(
    coordinates: LocationCoordinates | undefined,
    radius: number = 1000,
    options: UseLocationOptions = {},
) {
    const {
        data: places,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        ...createEnhancedQueryOptions<GeocodingResult[]>(
            'location-data',
            [
                'locations',
                'nearby',
                String(coordinates?.lat || 0),
                String(coordinates?.lng || 0),
                String(radius),
            ],
            'global',
            undefined,
            { ...coordinates, radius },
            {
                enabled: options.enabled !== false && !!coordinates,
                staleTime: options.staleTime || 15 * 60 * 1000, // 15 minutes
                refetchInterval: options.refetchInBackground ? undefined : undefined,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
            },
        ),
        queryFn: async (): Promise<GeocodingResult[]> => {
            if (!coordinates) {
                throw new Error('Coordinates are required for nearby search');
            }

            try {
                const results = await mockGeocoding.searchNearby(coordinates);
                return results;
            } catch (error) {
                throw new Error(
                    `Nearby search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
            }
        },
    });

    return {
        places: places || [],
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
        totalPlaces: places?.length || 0,
    };
}

/**
 * Hook for address validation and formatting
 */
export function useAddressValidation() {
    const validateAddress = useCallback(
        (
            address: string,
        ): {
            isValid: boolean;
            errors: string[];
            formatted?: string;
            components?: IndonesianAddress;
        } => {
            try {
                const components = {
                    street_address: address,
                    city_id: '',
                    province_id: '',
                };
                const isValid = validateIndonesianAddressFormat(components);

                if (isValid) {
                    return {
                        isValid: true,
                        errors: [],
                        formatted: formatAddressDisplay(components),
                        components,
                    };
                } else {
                    return {
                        isValid: false,
                        errors: ['Invalid Indonesian address format'],
                    };
                }
            } catch (error) {
                return {
                    isValid: false,
                    errors: [error instanceof Error ? error.message : 'Address validation failed'],
                };
            }
        },
        [],
    );

    const formatAddress = useCallback((components: IndonesianAddress): string => {
        return formatAddressDisplay(components);
    }, []);

    const parseAddress = useCallback((address: string): IndonesianAddress => {
        return { street_address: address, city_id: '', province_id: '' };
    }, []);

    return {
        validateAddress,
        formatAddress,
        parseAddress,
    };
}

/**
 * Hook for user's current location with caching
 */
export function useCurrentLocation(options: UseLocationOptions = {}) {
    const {
        data: location,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ['location', 'current'],
        queryFn: async (): Promise<LocationCoordinates> => {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported by this browser'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                    },
                    (error) => {
                        let errorMessage = 'Failed to get current location';

                        switch (error.code) {
                            case error.PERMISSION_DENIED:
                                errorMessage = 'Location access denied by user';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMessage = 'Location information is unavailable';
                                break;
                            case error.TIMEOUT:
                                errorMessage = 'Location request timed out';
                                break;
                        }

                        reject(new Error(errorMessage));
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 5 * 60 * 1000, // 5 minutes
                    },
                );
            });
        },
        enabled: options.enabled !== false,
        staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes
        retry: 2,
        refetchInterval: options.refetchInBackground ? 10 * 60 * 1000 : undefined, // 10 minutes
    });

    return {
        location,
        isLoading,
        isError,
        error: error as Error | null,
        refetch,
    };
}

/**
 * Hook for distance calculation utilities
 */
export function useLocationUtils() {
    const calculateDistance = useCallback(
        (point1: LocationCoordinates, point2: LocationCoordinates): number => {
            const R = 6371; // Earth's radius in kilometers
            const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
            const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;

            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((point1.lat * Math.PI) / 180) *
                    Math.cos((point2.lat * Math.PI) / 180) *
                    Math.sin(dLng / 2) *
                    Math.sin(dLng / 2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c; // Distance in kilometers
        },
        [],
    );

    const isWithinRadius = useCallback(
        (center: LocationCoordinates, point: LocationCoordinates, radiusKm: number): boolean => {
            const distance = calculateDistance(center, point);
            return distance <= radiusKm;
        },
        [calculateDistance],
    );

    const getBoundingBox = useCallback(
        (
            center: LocationCoordinates,
            radiusKm: number,
        ): {
            north: number;
            south: number;
            east: number;
            west: number;
        } => {
            const lat = center.lat;
            const lng = center.lng;

            // Rough conversion: 1 degree ≈ 111 km
            const latOffset = radiusKm / 111;
            const lngOffset = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

            return {
                north: lat + latOffset,
                south: lat - latOffset,
                east: lng + lngOffset,
                west: lng - lngOffset,
            };
        },
        [],
    );

    return {
        calculateDistance,
        isWithinRadius,
        getBoundingBox,
    };
}

/**
 * Hook for location cache management
 */
export function useLocationCache() {
    const queryClient = useQueryClient();

    const clearLocationCache = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['locations'] });
    }, [queryClient]);

    const preloadLocationData = useCallback(
        async (addresses: string[]) => {
            const promises = addresses.map((address) => {
                const queryKey = queryKeys.geocoding(address);
                const cached = queryClient.getQueryData(queryKey);

                if (!cached) {
                    return queryClient.prefetchQuery({
                        queryKey,
                        queryFn: () => mockGeocoding.geocode(address),
                        staleTime: 60 * 60 * 1000, // 1 hour
                    });
                }
                return Promise.resolve();
            });

            try {
                await Promise.all(promises);
            } catch (error) {
                console.error('Error preloading location data:', error);
            }
        },
        [queryClient],
    );

    const getLocationCacheStats = useCallback(() => {
        const cache = queryClient.getQueryCache();
        const locationQueries = cache.findAll({
            queryKey: ['locations'],
        });

        return {
            totalCached: locationQueries.length,
            staleCount: locationQueries.filter((query) => query.isStale()).length,
            errorCount: locationQueries.filter((query) => query.state.status === 'error').length,
            loadingCount: locationQueries.filter((query) => query.state.status === 'pending')
                .length,
            geocodingQueries: locationQueries.filter((q) => q.queryKey.includes('geocoding'))
                .length,
            reverseGeocodingQueries: locationQueries.filter((q) =>
                q.queryKey.includes('reverse-geocoding'),
            ).length,
        };
    }, [queryClient]);

    return {
        clearLocationCache,
        preloadLocationData,
        getLocationCacheStats,
    };
}
