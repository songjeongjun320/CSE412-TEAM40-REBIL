'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { VehicleListMapView } from '@/components/layout/VehicleListMapView';
import { VehicleMapSearch } from '@/components/search/VehicleMapSearch';
import { createClient } from '@/lib/supabase/supabaseClient';
import { DEFAULT_CENTER, resolveCityCoordinates } from '@/lib/utils/cityCoordinates';
import {
    getBestCoordinatesFromCodes,
    getLocationStringFromCodes,
} from '@/lib/utils/codeToCoordinates';
import {
    ProcessedVehicleLocation,
    applyCoordinateJitter,
    batchProcessVehicleLocations,
} from '@/lib/utils/vehicleLocationUtils';
import { Tables } from '@/types/base/database.types';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

interface VehicleWithLocation extends Car {
    car_images: CarImage[];
    coordinates?: {
        lat: number;
        lng: number;
    };
    locationInfo?: ProcessedVehicleLocation;
}

interface SearchFilters {
    priceRange: string;
    carType: string;
    transmission: string;
    fuelType: string;
}

interface LocationInfo {
    lat: number;
    lng: number;
    address: string;
    // Hierarchical address fields
    provinceId?: string;
    cityId?: string;
    districtId?: string;
    villageId?: string;
    // Display names
    provinceName?: string;
    cityName?: string;
    districtName?: string;
    villageName?: string;
}

function SearchWithMapContent() {
    const searchParams = useSearchParams();
    const [vehicles, setVehicles] = useState<VehicleWithLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search state
    const [searchLocation, setSearchLocation] = useState<LocationInfo | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchFilters, setSearchFilters] = useState<SearchFilters>({
        priceRange: '',
        carType: '',
        transmission: '',
        fuelType: '',
    });

    const supabase = useMemo(() => createClient(), []);

    // Ref for debounce timeout - moved before handleMapBoundsChanged to avoid ReferenceError
    const mapBoundsChangeTimeout = useRef<NodeJS.Timeout | null>(null);

    // Load initial filters from URL parameters
    const loadInitialFilters = useCallback(() => {
        const location = searchParams.get('location') || '';
        // New city name-based parameters (prioritized for Google Maps)
        const cityName = searchParams.get('cityName') || '';
        const cityCode = searchParams.get('cityCode') || '';
        const provinceName = searchParams.get('provinceName') || '';
        // Legacy hierarchical address parameters (fallback)
        const provinceId = searchParams.get('provinceId') || '';
        const cityId = searchParams.get('cityId') || '';
        const districtId = searchParams.get('districtId') || '';
        const villageId = searchParams.get('villageId') || '';
        const startDateParam = searchParams.get('startDate') || '';
        const endDateParam = searchParams.get('endDate') || '';
        const priceRange = searchParams.get('priceRange') || '';
        const carType = searchParams.get('carType') || '';
        const transmission = searchParams.get('transmission') || '';
        const fuelType = searchParams.get('fuelType') || '';

        // Loaded filters from URL

        // Priority 1: City name-based location (Google Maps compatible)
        if (cityName) {
            (async () => {
                const coords = (await resolveCityCoordinates(cityName)) || DEFAULT_CENTER;
                setSearchLocation({
                    lat: coords.lat,
                    lng: coords.lng,
                    address: cityName,
                    cityName: cityName,
                    provinceName: provinceName || undefined,
                    cityId: cityCode || undefined, // Use cityCode for database queries if needed
                });
                // Applied city name location with Google Maps integration
            })();
        } else if (provinceId || cityId || districtId || villageId) {
            // Priority 2: Legacy hierarchical address with smart coordinate mapping
            const coords = getBestCoordinatesFromCodes(provinceId, cityId);
            const addressString = getLocationStringFromCodes(
                provinceId,
                cityId,
                districtId,
                villageId,
            );

            setSearchLocation({
                lat: coords.lat,
                lng: coords.lng,
                address: addressString,
                provinceId,
                cityId,
                districtId,
                villageId,
                cityName: cityId ? `City ${cityId}` : undefined,
                provinceName: provinceId ? `Province ${provinceId}` : undefined,
                districtName: districtId ? `District ${districtId}` : undefined,
                villageName: villageId ? `Village ${villageId}` : undefined,
            });

            // Applied hierarchical location
        } else if (location) {
            // Priority 3: Fallback to text-based location
            (async () => {
                const coords = (await resolveCityCoordinates(location)) || DEFAULT_CENTER;
                setSearchLocation({
                    lat: coords.lat,
                    lng: coords.lng,
                    address: location,
                    cityName: location,
                });
                // Applied text location
            })();
        }

        setStartDate(startDateParam);
        setEndDate(endDateParam);
        setSearchFilters({
            priceRange,
            carType,
            transmission,
            fuelType,
        });
    }, [searchParams]);

    // Load initial vehicle data
    const loadVehicles = useCallback(
        async (customLocation?: LocationInfo | null) => {
            try {
                setLoading(true);
                setError(null);

                let carsData = [];

                // Use custom location if provided (from map drag), otherwise use searchLocation
                const locationToUse =
                    customLocation !== undefined ? customLocation : searchLocation;

                // Location-based search - removed broken RPC call
                // Will use location filtering in the main query below

                // Main query with location filtering
                if (carsData.length === 0) {
                    // Using regular database query
                    let query = supabase
                        .from('cars')
                        .select(
                            `
                        *,
                        car_images (*)
                    `,
                        )
                        .eq('status', 'ACTIVE');

                    // Apply location filter if search location is specified
                    if (locationToUse?.cityName) {
                        console.log('🔍 Filtering by city name:', locationToUse.cityName);
                        // Filter by city name in location JSONB field
                        // Use partial match but be more specific to avoid false positives
                        // Match against city-specific fields, not full address
                        query = query.or(
                            `location->>city_name.ilike.%${locationToUse.cityName}%,location->city->>name.ilike.%${locationToUse.cityName}%`,
                        );
                    }

                    // Apply filters
                    if (searchFilters.priceRange) {
                        const [min, max] = searchFilters.priceRange.split('-').map(Number);
                        if (min) query = query.gte('daily_rate', min);
                        if (max) query = query.lte('daily_rate', max);
                    }

                    if (searchFilters.carType) {
                        query = query.eq('car_type', searchFilters.carType);
                    }

                    if (searchFilters.transmission) {
                        query = query.eq('transmission', searchFilters.transmission);
                    }

                    if (searchFilters.fuelType) {
                        query = query.eq('fuel_type', searchFilters.fuelType);
                    }

                    const { data: regularData, error: carsError } = await query.limit(50);

                    if (carsError) throw carsError;
                    carsData = regularData || [];

                    // Debug: Log filtered results
                    console.log(
                        `✅ Found ${carsData.length} vehicles matching filters`,
                        searchLocation?.cityName
                            ? `for city: ${searchLocation.cityName}`
                            : '(no location filter)',
                    );
                    if (carsData.length > 0 && searchLocation?.cityName) {
                        console.log(
                            '📍 Sample vehicle locations:',
                            carsData.slice(0, 3).map((c: any) => ({
                                id: c.id.slice(0, 8),
                                location: c.location,
                            })),
                        );
                    }
                }

                // Loaded vehicles count

                // Optimized vehicle location processing using batch utilities
                const fallbackCoords = searchLocation
                    ? { lat: searchLocation.lat, lng: searchLocation.lng }
                    : DEFAULT_CENTER;

                // Batch process all vehicle locations for better performance
                const locationMap = await batchProcessVehicleLocations(
                    carsData || [],
                    fallbackCoords,
                );

                // Create vehicles with processed coordinates and location info
                const vehiclesWithCoordinates: VehicleWithLocation[] = (carsData || []).map(
                    (car: any) => {
                        const locationInfo = locationMap.get(car.id);
                        let finalCoords = fallbackCoords;

                        if (locationInfo) {
                            finalCoords = locationInfo.coordinates;
                        }

                        // Apply jitter to prevent marker overlap
                        const jitteredCoords = applyCoordinateJitter(finalCoords, car.id);

                        return {
                            ...car,
                            coordinates: jitteredCoords,
                            locationInfo,
                        };
                    },
                );

                setVehicles(vehiclesWithCoordinates);
            } catch (err) {
                console.error('Error loading vehicles:', err);
                setError(err instanceof Error ? err.message : 'Failed to load vehicles');
            } finally {
                setLoading(false);
            }
        },
        [searchLocation, searchFilters, supabase],
    );

    useEffect(() => {
        loadInitialFilters();
    }, [loadInitialFilters]);

    // Reload vehicles when search parameters change
    useEffect(() => {
        loadVehicles();
    }, [searchLocation, searchFilters, startDate, endDate, loadVehicles]);

    // Cleanup timeout on component unmount to prevent state updates on unmounted component
    useEffect(() => {
        return () => {
            if (mapBoundsChangeTimeout.current) {
                clearTimeout(mapBoundsChangeTimeout.current);
            }
        };
    }, []);

    const handleSearch = () => {
        // Trigger search with current filters

        // Reload vehicles with current filters
        loadVehicles();
    };

    const handleVehicleSelect = () => {
        // Vehicle selected - placeholder function
        // TODO: Navigate to vehicle detail page or show modal
    };

    // Handle map bounds change with debounce
    const handleMapBoundsChanged = useCallback(
        (center: { lat: number; lng: number }, zoom: number) => {
            console.log('🗺️ Map moved to:', center, 'zoom:', zoom);

            // Use debounce to avoid too many API calls
            if (mapBoundsChangeTimeout.current) {
                clearTimeout(mapBoundsChangeTimeout.current);
            }

            mapBoundsChangeTimeout.current = setTimeout(async () => {
                console.log('🔄 Refreshing vehicles for new map location');

                // Reverse geocode to get city name from coordinates
                try {
                    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                    if (!apiKey) {
                        console.warn('Google Maps API key not found');
                        return;
                    }

                    const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${center.lat},${center.lng}&key=${apiKey}`,
                    );
                    const data = await response.json();

                    if (data.status === 'OK' && data.results[0]) {
                        // Extract city name from address components
                        const addressComponents = data.results[0].address_components;
                        let cityName = '';

                        for (const component of addressComponents) {
                            if (
                                component.types.includes('administrative_area_level_2') ||
                                component.types.includes('locality')
                            ) {
                                cityName = component.long_name;
                                break;
                            }
                        }

                        if (cityName) {
                            const newLocation: LocationInfo = {
                                lat: center.lat,
                                lng: center.lng,
                                address: data.results[0].formatted_address,
                                cityName: cityName,
                            };

                            console.log('📍 New location:', cityName);
                            setSearchLocation(newLocation);
                        }
                    }
                } catch (error) {
                    console.error('Error reverse geocoding:', error);
                }
            }, 1000); // 1 second debounce
        },
        [],
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="container mx-auto px-4 py-8">
                    <div className="animate-pulse">
                        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                            <div className="h-24 bg-gray-200 rounded"></div>
                        </div>
                        <div className="h-96 bg-gray-200 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center p-8">
                    <div className="text-4xl text-red-400 mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">
                        Error Loading Vehicles
                    </h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => loadVehicles()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sticky header section */}
            <div
                data-testid="app-header"
                className="sticky top-0 z-50 bg-gradient-to-r from-white via-blue-50 to-white shadow-lg border-b border-gray-200 backdrop-blur-sm"
            >
                <div className="mx-auto px-6 py-3">
                    {/* Page header */}
                    <div className="mb-3">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center">
                            <span className="text-2xl mr-2">🗺️</span>
                            <span>Find Vehicles on Map</span>
                            {(searchLocation?.cityName || searchLocation?.address) && (
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium ml-3">
                                    📍 {searchLocation.cityName || searchLocation.address}
                                </span>
                            )}
                        </h1>
                    </div>

                    {/* Search component */}
                    <VehicleMapSearch
                        onLocationChange={setSearchLocation}
                        onDateRangeChange={(start, end) => {
                            setStartDate(start);
                            setEndDate(end);
                        }}
                        onFiltersChange={setSearchFilters}
                        onSearch={handleSearch}
                        canRent={true}
                        initialLocation={searchLocation || undefined}
                        initialStartDate={startDate}
                        initialEndDate={endDate}
                        initialFilters={searchFilters}
                    />
                </div>
            </div>

            {/* Map and list view */}
            <div className="pt-2 px-6 bg-white">
                <VehicleListMapView
                    vehicles={vehicles}
                    canRent={true}
                    searchFilters={{
                        location: searchLocation,
                        dateRange: startDate && endDate ? { startDate, endDate } : null,
                    }}
                    onVehicleSelect={handleVehicleSelect}
                    onMapBoundsChanged={handleMapBoundsChanged}
                />
            </div>
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                        <div className="h-24 bg-gray-200 rounded"></div>
                    </div>
                    <div className="h-96 bg-gray-200 rounded-lg"></div>
                </div>
            </div>
        </div>
    );
}

export default function SearchWithMapPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <SearchWithMapContent />
        </Suspense>
    );
}
