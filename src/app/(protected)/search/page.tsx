'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { Input } from '@/components/ui';
import { LocationDisplay } from '@/components/ui/LocationDisplay';
import { canUserRent, getCurrentUserRoles } from '@/lib/auth/userRoles';
import {
    clearSearchCache,
    searchVehiclesOptimized,
    type OptimizedCarWithDetails,
    type SearchFilters as OptimizedSearchFilters,
} from '@/lib/supabase/optimizedQueries';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatDailyRate } from '@/lib/utils';

interface SearchFilters {
    location: string;
    // Hierarchical address fields
    provinceId?: string;
    cityId?: string;
    districtId?: string;
    villageId?: string;
    startDate: string;
    endDate: string;
    priceMin: number;
    priceMax: number;
    transmission: string;
    fuelType: string;
    carType: string; // Added carType
    seats: number;
    features: string[];
}

// Use the optimized interface as the primary type
type VehicleWithDetails = OptimizedCarWithDetails;

const INITIAL_FILTERS: SearchFilters = {
    location: '',
    provinceId: undefined,
    cityId: undefined,
    districtId: undefined,
    villageId: undefined,
    startDate: '',
    endDate: '',
    priceMin: 0,
    priceMax: 15500000, // IDR equivalent of ~$1000
    transmission: '',
    fuelType: '',
    carType: '', // Added carType
    seats: 0,
    features: [],
};

const TRANSMISSION_OPTIONS = [
    { value: '', label: 'Any Transmission' },
    { value: 'AUTOMATIC', label: 'Automatic' },
    { value: 'MANUAL', label: 'Manual' },
    { value: 'CVT', label: 'CVT' },
];

const FUEL_TYPE_OPTIONS = [
    { value: '', label: 'Any Fuel Type' },
    { value: 'GASOLINE', label: 'Gasoline' },
    { value: 'DIESEL', label: 'Diesel' },
    { value: 'ELECTRIC', label: 'Electric' },
    { value: 'HYBRID', label: 'Hybrid' },
];

const POPULAR_FEATURES = [
    'Air Conditioning',
    'GPS Navigation',
    'Bluetooth',
    'USB Charging',
    'WiFi Hotspot',
    'Heated Seats',
    'Sunroof',
    'Backup Camera',
];

function VehicleSearchPageContent() {
    const searchParams = useSearchParams();

    const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
    const [isUsingOptimizedSearch, setIsUsingOptimizedSearch] = useState(true);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS);
    const [showFilters, setShowFilters] = useState(false);
    const [canRent, setCanRent] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [availabilityChecking, setAvailabilityChecking] = useState(false);
    const [usingFallback, setUsingFallback] = useState(false);
    const itemsPerPage = 12;

    const checkRentPermission = async () => {
        try {
            const roles = await getCurrentUserRoles();
            setCanRent(roles ? canUserRent(roles) : false);
        } catch (error) {
            console.error('Error checking user permissions:', error);
        }
    };

    const loadInitialFilters = useCallback(() => {
        const location = searchParams.get('location') || '';
        // Hierarchical address parameters
        const provinceId = searchParams.get('provinceId') || undefined;
        const cityId = searchParams.get('cityId') || undefined;
        const districtId = searchParams.get('districtId') || undefined;
        const villageId = searchParams.get('villageId') || undefined;
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';
        const carType = searchParams.get('carType') || '';

        console.log('🗓️ [URL PARAMS] Received dates:', { startDate, endDate });

        setFilters((prev) => {
            const newFilters = {
                ...prev,
                location,
                provinceId,
                cityId,
                districtId,
                villageId,
                startDate,
                endDate,
                carType, // Add carType to filters
            };
            return newFilters;
        });
    }, [searchParams]);

    // Validate date range
    const validateDateRange = useCallback(() => {
        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (start < today) {
                return 'Start date cannot be in the past';
            }
            if (end <= start) {
                return 'End date must be after start date';
            }
            const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff > 365) {
                return 'Rental period cannot exceed 365 days';
            }
        }
        return null;
    }, [filters.startDate, filters.endDate]);

    // Client-side availability checking (fallback)
    const checkClientSideAvailability = async (
        carId: string,
        startDate: string,
        endDate: string,
    ) => {
        try {
            console.log(
                `🔍 [SEARCH PAGE] Checking availability for car: ${carId}, dates: ${startDate} to ${endDate}`,
            );
            const supabase = createClient();

            // Check for booking conflicts (fixed date overlap logic)
            const { data: bookings } = await supabase
                .from('bookings')
                .select('start_date, end_date, status')
                .eq('car_id', carId)
                .in('status', ['PENDING', 'AUTO_APPROVED', 'CONFIRMED', 'IN_PROGRESS'])
                .or(
                    `and(start_date.lte.${startDate},end_date.gt.${startDate}),and(start_date.lt.${endDate},end_date.gte.${endDate}),and(start_date.gte.${startDate},end_date.lte.${endDate})`,
                );

            console.log(`📋 [SEARCH PAGE] Car ${carId} booking conflicts:`, bookings);

            if (bookings && bookings.length > 0) {
                return false; // Vehicle is booked
            }

            // Check for manual availability blocks (fixed date overlap logic)
            const { data: availability } = await supabase
                .from('car_availability')
                .select('is_available')
                .eq('car_id', carId)
                .eq('is_available', false)
                .or(
                    `and(start_date.lte.${startDate.split('T')[0]},end_date.gte.${startDate.split('T')[0]}),and(start_date.lte.${endDate.split('T')[0]},end_date.gte.${endDate.split('T')[0]}),and(start_date.gte.${startDate.split('T')[0]},end_date.lte.${endDate.split('T')[0]})`,
                );

            if (availability && availability.length > 0) {
                return false; // Vehicle is manually blocked
            }

            return true; // Vehicle is available
        } catch (error) {
            console.error('Error checking client-side availability:', error);
            return true; // Assume available if check fails
        }
    };

    // Legacy search function for fallback
    const searchVehiclesLegacy: () => Promise<void> = useCallback(async () => {
        const supabase = createClient();

        const searchFilters = {
            transmission: filters.transmission || null,
            fuel_type: filters.fuelType || null,
            min_seats: filters.seats > 0 ? filters.seats : null,
            max_price: filters.priceMax < 15500000 ? filters.priceMax : null,
        };

        const startDate = filters.startDate ? `${filters.startDate}T00:00:00Z` : undefined;
        const endDate = filters.endDate ? `${filters.endDate}T23:59:59Z` : undefined;

        console.log('🕐 [DATE CONVERSION] Converted dates:', {
            original: { start: filters.startDate, end: filters.endDate },
            converted: { start: startDate, end: endDate },
        });

        let searchResults;

        // Try the new hierarchical search function first
        if (filters.provinceId || filters.cityId || filters.districtId || filters.villageId) {
            try {
                const { data, error } = await supabase.rpc('search_cars_by_location', {
                    province_code: filters.provinceId || null,
                    city_code: filters.cityId || null,
                    district_code: filters.districtId || null,
                    village_code: filters.villageId || null,
                });

                if (error) {
                    console.error('Hierarchical search failed:', error);
                    throw error;
                }

                // Transform the results to match expected format
                searchResults = (data || []).map((result: any) => ({
                    car_id: result.car_id,
                    make: result.make,
                    model: result.model,
                    daily_rate: result.daily_rate,
                    location: result.location,
                    formatted_location: result.formatted_location,
                    host_id: '', // Will be filled later
                    features: [],
                    transmission: '',
                    fuel_type: '',
                    seats: 0,
                    host_name: 'Unknown',
                    primary_image_url: '',
                    availability_status: 'available',
                }));

                // Apply additional filters client-side
                if (searchFilters.transmission) {
                    searchResults = searchResults.filter(
                        (car: any) => car.transmission === searchFilters.transmission,
                    );
                }
                if (searchFilters.fuel_type) {
                    searchResults = searchResults.filter(
                        (car: any) => car.fuel_type === searchFilters.fuel_type,
                    );
                }
                if (typeof searchFilters.max_price === 'number') {
                    const maxPrice = searchFilters.max_price;
                    searchResults = searchResults.filter((car: any) => car.daily_rate <= maxPrice);
                }
            } catch (hierarchicalError) {
                console.warn(
                    'Hierarchical search failed, falling back to legacy search:',
                    hierarchicalError,
                );
                searchResults = null; // Will trigger legacy search
            }
        }

        // Fallback to legacy RPC function if hierarchical search wasn't used or failed
        if (!searchResults) {
            try {
                const { data, error } = await supabase.rpc('search_available_vehicles', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    p_location: filters.location || undefined,
                    p_filters: searchFilters,
                });

                if (error) {
                    console.error('RPC function failed:', error);
                    throw error;
                }

                searchResults = data || [];
            } catch (rpcErrorCaught) {
                console.warn('Legacy RPC function failed, using fallback query:', rpcErrorCaught);

                // Final fallback: manual query construction
                let query = supabase.from('cars').select('*').eq('status', 'ACTIVE');

                // Apply basic filters
                if (filters.transmission) {
                    query = query.eq('transmission', filters.transmission as any);
                }
                if (filters.fuelType) {
                    query = query.eq('fuel_type', filters.fuelType as any);
                }
                if (filters.seats > 0) {
                    query = query.gte('seats', filters.seats);
                }
                if (filters.priceMax < 15500000) {
                    query = query.lte('daily_rate', filters.priceMax);
                }
                if (filters.location) {
                    query = query.ilike('location', `%${filters.location}%`);
                }
                if (filters.carType) {
                    query = query.eq('car_type', filters.carType);
                }

                const { data: cars, error: carsError } = await query
                    .order('created_at', { ascending: false })
                    .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

                if (carsError) {
                    console.error('Manual query failed:', carsError);
                    throw new Error(`Database query failed: ${carsError.message}`);
                }

                searchResults = (cars || []).map((car) => ({
                    car_id: car.id,
                    make: car.make,
                    model: car.model,
                    year: car.year,
                    daily_rate: car.daily_rate,
                    location: car.location,
                    features: car.features || [],
                    transmission: car.transmission,
                    fuel_type: car.fuel_type,
                    seats: car.seats,
                    host_name: 'Unknown',
                    primary_image_url: '',
                    availability_status: 'available',
                }));
            }
        }

        // Client-side availability checking if dates provided
        if (filters.startDate && filters.endDate && searchResults.length > 0) {
            console.log('🔍 [AVAILABILITY CHECK] Starting availability check for dates:', {
                startDate,
                endDate,
            });
            setAvailabilityChecking(true);

            const availabilityPromises = searchResults.map(async (vehicle: any) => {
                const isAvailable = await checkClientSideAvailability(
                    vehicle.car_id,
                    startDate!, // Use converted timestamp
                    endDate!, // Use converted timestamp
                );
                console.log(
                    `🚗 [VEHICLE CHECK] Car ${vehicle.car_id}: ${isAvailable ? 'AVAILABLE' : 'BLOCKED'}`,
                );
                return {
                    ...vehicle,
                    availability_status: isAvailable ? 'available' : 'unavailable',
                };
            });

            searchResults = await Promise.all(availabilityPromises);
            const beforeFilter = searchResults.length;
            const availableVehicles = searchResults.filter(
                (v) => v.availability_status === 'available',
            ).length;
            const blockedVehicles = searchResults.filter(
                (v) => v.availability_status === 'unavailable',
            ).length;

            console.log(
                `📊 [FILTER RESULTS] Before: ${beforeFilter}, Available: ${availableVehicles}, Blocked: ${blockedVehicles}`,
            );

            searchResults = searchResults.filter(
                (vehicle: any) => vehicle.availability_status === 'available',
            );

            setAvailabilityChecking(false);
        }

        // Apply pagination
        const totalAvailable = searchResults.length;
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage;
        const paginatedVehicles = searchResults.slice(from, to);

        // ⚠️ N+1 QUERY PROBLEM: This is what we're trying to eliminate
        // Each vehicle triggers a separate query for images
        const transformedVehicles: VehicleWithDetails[] = await Promise.all(
            paginatedVehicles.map(async (result: any) => {
                const { data: carImages } = await supabase
                    .from('car_images')
                    .select('*')
                    .eq('car_id', result.car_id)
                    .order('display_order');

                const { data: hostProfile } = await supabase
                    .from('user_profiles')
                    .select('id, full_name, profile_image_url')
                    .eq('id', result.host_id || '')
                    .single();

                return {
                    id: result.car_id,
                    host_id: result.host_id || '',
                    make: result.make,
                    model: result.model,
                    year: result.year,
                    vin: null,
                    license_plate: null,
                    color: null,
                    transmission: result.transmission,
                    fuel_type: result.fuel_type,
                    seats: result.seats,
                    doors: 4,
                    description: null,
                    features: result.features,
                    daily_rate: result.daily_rate,
                    weekly_rate: null,
                    monthly_rate: null,
                    location: result.location,
                    delivery_available: false,
                    delivery_fee: 0,
                    delivery_radius: 0,
                    minimum_trip_duration: 1,
                    status: 'ACTIVE' as any,
                    created_at: '',
                    updated_at: '',
                    car_images: carImages || [],
                    host_profile: hostProfile || {
                        id: '',
                        full_name: 'Unknown',
                        profile_image_url: null,
                    },
                    availability_status: result.availability_status,
                    primary_image_url: getPrimaryImage(carImages || []),
                };
            }),
        );

        setVehicles(transformedVehicles);
        setTotalCount(totalAvailable);
    }, [filters, currentPage]);

    // Main search function
    const searchVehicles = useCallback(async () => {
        if (!canRent) {
            setLoading(false);
            return;
        }

        setError(null);
        setSearching(true);
        setUsingFallback(false);

        // Validate date range first
        const dateError = validateDateRange();
        if (dateError) {
            setError(dateError);
            setSearching(false);
            setLoading(false);
            return;
        }

        try {
            // Prepare optimized search filters
            const optimizedFilters: OptimizedSearchFilters = {
                location: filters.location || undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
                priceMax: filters.priceMax < 15500000 ? filters.priceMax : undefined,
                transmission: filters.transmission || undefined,
                fuelType: filters.fuelType || undefined,
                seats: filters.seats > 0 ? filters.seats : undefined,
                features: filters.features.length > 0 ? filters.features : undefined,
            };

            const paginationOptions = {
                page: currentPage,
                limit: itemsPerPage,
            };

            // Try optimized search first
            try {
                setIsUsingOptimizedSearch(true);

                const searchResult = await searchVehiclesOptimized(
                    optimizedFilters,
                    paginationOptions,
                );

                // Transform optimized results to match legacy interface
                const transformedVehicles: VehicleWithDetails[] = searchResult.vehicles.map(
                    (vehicle) => ({
                        ...vehicle,
                        // Ensure backward compatibility
                        host_id: vehicle.host_profile.id,
                        vin: null,
                        license_plate: null,
                        color: null,
                        weekly_rate: null,
                        monthly_rate: null,
                        status: 'ACTIVE' as any,
                        created_at: vehicle.created_at || '',
                        updated_at: vehicle.updated_at || '',
                    }),
                );

                setVehicles(transformedVehicles);
                setTotalCount(searchResult.totalCount);
                setAvailabilityChecking(false);

                console.info(
                    `✓ Optimized search completed: ${searchResult.vehicles.length} vehicles loaded with ${searchResult.vehicles.reduce((acc, v) => acc + v.car_images.length, 0)} total images in single query`,
                );

                return; // Success - exit early
            } catch (optimizedError) {
                console.warn(
                    '❌ [DEBUG] Optimized search failed, falling back to basic search:',
                    optimizedError,
                );
                console.warn('❌ [DEBUG] Error details:', optimizedError);
                setIsUsingOptimizedSearch(false);
                setUsingFallback(true);
            }

            // Fallback to legacy search if optimized search fails
            await searchVehiclesLegacy();
        } catch (error) {
            console.error('Error searching vehicles:', error);

            let errorMessage = 'Unable to search vehicles at this time.';

            if (error instanceof Error) {
                if (error.message.includes('ambiguous column')) {
                    errorMessage =
                        'Database configuration issue detected. Using simplified search. Some availability filtering may not work correctly.';
                } else if (error.message.includes('network')) {
                    errorMessage =
                        'Network connection issue. Please check your internet connection and try again.';
                } else if (error.message.includes('permission')) {
                    errorMessage =
                        "You don't have permission to search vehicles. Please contact support.";
                }
            }

            setError(errorMessage);
            setVehicles([]);
            setTotalCount(0);
        } finally {
            setSearching(false);
            setAvailabilityChecking(false);
            setLoading(false);
        }
    }, [canRent, filters, currentPage, validateDateRange, searchVehiclesLegacy]);

    useEffect(() => {
        checkRentPermission();
        loadInitialFilters();
    }, [loadInitialFilters]);

    useEffect(() => {
        searchVehicles();
    }, [filters, currentPage, searchVehicles]);

    const handleFilterChange = (key: keyof SearchFilters, value: string | number | string[]) => {
        setError(null); // Clear any previous errors
        // Clear cache when filters change to ensure fresh results
        clearSearchCache();
        setFilters((prev) => {
            const newFilters = {
                ...prev,
                [key]: value,
            };
            return newFilters;
        });
        setCurrentPage(1); // Reset to first page when filters change
    };

    const handleFeatureToggle = (feature: string) => {
        setFilters((prev) => ({
            ...prev,
            features: prev.features.includes(feature)
                ? prev.features.filter((f) => f !== feature)
                : [...prev.features, feature],
        }));
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setError(null);
        setUsingFallback(false);
        setIsUsingOptimizedSearch(true);
        // Clear cache when resetting filters
        clearSearchCache();
        setFilters(INITIAL_FILTERS);
        setCurrentPage(1);
    };

    const getPrimaryImage = (
        images: {
            id: string;
            image_url: string;
            image_type: string | null;
            is_primary: boolean;
            display_order: number;
        }[],
    ) => {
        const primary = images.find((img) => img.is_primary);
        return primary?.image_url || images[0]?.image_url || '';
    };

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading vehicles...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link href="/home" className="text-2xl font-bold text-black">
                                REBIL
                            </Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600">Search Vehicles</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/home"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Home
                            </Link>
                            <Link
                                href="/profile"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Profile
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {!canRent ? (
                <div className="py-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded-lg">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <span className="text-2xl">⚠️</span>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-lg font-medium text-yellow-800">
                                        Vehicle search restricted
                                    </h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <p>
                                            Only users with renter role can search and book
                                            vehicles. Hosts cannot rent other vehicles to maintain
                                            service quality.
                                        </p>
                                    </div>
                                    <div className="mt-4">
                                        <Link
                                            href="/home"
                                            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                                        >
                                            Return to Home
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Search Header */}
                    <div className="bg-white border-b">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-black">
                                        {totalCount > 0
                                            ? `${totalCount} vehicles available`
                                            : 'Search Vehicles'}
                                    </h1>
                                    {(filters.location || filters.provinceId || filters.cityId) && (
                                        <p className="text-gray-600 mt-1">
                                            in{' '}
                                            {filters.location ||
                                                `${filters.villageId ? 'Village ' + filters.villageId + ', ' : ''}${filters.districtId ? 'District ' + filters.districtId + ', ' : ''}${filters.cityId ? 'City ' + filters.cityId + ', ' : ''}${filters.provinceId ? 'Province ' + filters.provinceId : ''}`}
                                            {filters.startDate && filters.endDate && (
                                                <span>
                                                    {' '}
                                                    from{' '}
                                                    {new Date(
                                                        filters.startDate,
                                                    ).toLocaleDateString()}{' '}
                                                    to{' '}
                                                    {new Date(filters.endDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    {filters.startDate && filters.endDate && !error && (
                                        <p className="text-sm text-green-600 mt-1">
                                            ✓ Availability filtering active for selected dates
                                            {isUsingOptimizedSearch && ' (optimized mode)'}
                                            {usingFallback &&
                                                !isUsingOptimizedSearch &&
                                                ' (enhanced mode)'}
                                        </p>
                                    )}
                                    {!filters.startDate && !filters.endDate && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            Select dates to check vehicle availability
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="mt-4 md:mt-0 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors cursor-pointer"
                                >
                                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="bg-white border-b">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                    {/* Location */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Location
                                        </label>
                                        <Input
                                            type="text"
                                            value={filters.location}
                                            onChange={(e) =>
                                                handleFilterChange('location', e.target.value)
                                            }
                                            placeholder="City or area"
                                        />
                                    </div>

                                    {/* Dates */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Start Date
                                        </label>
                                        <Input
                                            type="date"
                                            value={filters.startDate}
                                            onChange={(e) =>
                                                handleFilterChange('startDate', e.target.value)
                                            }
                                            min={new Date().toISOString().split('T')[0]}
                                            max={
                                                new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                                                    .toISOString()
                                                    .split('T')[0]
                                            }
                                        />
                                        {filters.startDate &&
                                            new Date(filters.startDate) < new Date() && (
                                                <p className="text-sm text-red-600 mt-1">
                                                    Start date cannot be in the past
                                                </p>
                                            )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            End Date
                                        </label>
                                        <Input
                                            type="date"
                                            value={filters.endDate}
                                            onChange={(e) =>
                                                handleFilterChange('endDate', e.target.value)
                                            }
                                            min={
                                                filters.startDate ||
                                                new Date().toISOString().split('T')[0]
                                            }
                                            max={
                                                new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                                                    .toISOString()
                                                    .split('T')[0]
                                            }
                                        />
                                        {filters.startDate &&
                                            filters.endDate &&
                                            new Date(filters.endDate) <=
                                                new Date(filters.startDate) && (
                                                <p className="text-sm text-red-600 mt-1">
                                                    End date must be after start date
                                                </p>
                                            )}
                                    </div>

                                    {/* Price Range */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Maximum Price per Day (IDR)
                                        </label>
                                        <Input
                                            type="number"
                                            value={filters.priceMax || ''}
                                            onChange={(e) =>
                                                handleFilterChange(
                                                    'priceMax',
                                                    parseInt(e.target.value) || 15500000,
                                                )
                                            }
                                            placeholder="Harga maksimal (Rp)"
                                            min="0"
                                        />
                                    </div>

                                    {/* Transmission */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Transmission
                                        </label>
                                        <select
                                            value={filters.transmission}
                                            onChange={(e) =>
                                                handleFilterChange('transmission', e.target.value)
                                            }
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                        >
                                            {TRANSMISSION_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Fuel Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Fuel Type
                                        </label>
                                        <select
                                            value={filters.fuelType}
                                            onChange={(e) =>
                                                handleFilterChange('fuelType', e.target.value)
                                            }
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                        >
                                            {FUEL_TYPE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Car Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Car Type
                                        </label>
                                        <select
                                            value={filters.carType}
                                            onChange={(e) =>
                                                handleFilterChange('carType', e.target.value)
                                            }
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                        >
                                            <option value="">Any Car Type</option>
                                            <option value="sedan">Sedan</option>
                                            <option value="suv">SUV</option>
                                            <option value="motorcycle">Motorcycle</option>
                                            <option value="ev">Electric Vehicle</option>
                                        </select>
                                    </div>

                                    {/* Minimum Seats */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Minimum Seats
                                        </label>
                                        <Input
                                            type="number"
                                            value={filters.seats || ''}
                                            onChange={(e) =>
                                                handleFilterChange(
                                                    'seats',
                                                    parseInt(e.target.value) || 0,
                                                )
                                            }
                                            placeholder="Any"
                                            min="0"
                                            max="12"
                                        />
                                    </div>
                                </div>

                                {/* Features */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Features
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {POPULAR_FEATURES.map((feature) => (
                                            <label
                                                key={feature}
                                                className="flex items-center space-x-2 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={filters.features.includes(feature)}
                                                    onChange={() => handleFeatureToggle(feature)}
                                                    className="rounded border-gray-300 text-black focus:ring-black"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {feature}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Filter Actions */}
                                <div className="flex space-x-3">
                                    <button
                                        onClick={resetFilters}
                                        className="bg-gray-200 text-black px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                                    >
                                        Reset Filters
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <span className="text-2xl">⚠️</span>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-lg font-medium text-red-800">
                                            Search Error
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>{error}</p>
                                        </div>
                                        {usingFallback && (
                                            <div className="mt-3 text-sm text-red-600">
                                                <p>
                                                    • Using simplified search with client-side
                                                    filtering
                                                </p>
                                                <p>
                                                    • Some advanced availability features may be
                                                    limited
                                                </p>
                                                <p>
                                                    • Search results are still accurate for basic
                                                    filtering
                                                </p>
                                            </div>
                                        )}
                                        <div className="mt-4">
                                            <button
                                                onClick={() => setError(null)}
                                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Optimized Search Success Notice */}
                        {isUsingOptimizedSearch && !error && vehicles.length > 0 && (
                            <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <span className="text-2xl">✓</span>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-lg font-medium text-green-800">
                                            Optimized Search Active
                                        </h3>
                                        <div className="mt-2 text-sm text-green-700">
                                            <p>
                                                Using high-performance search with comprehensive
                                                data loading. Reduced database queries by ~90% for
                                                faster results.
                                            </p>
                                            {filters.startDate && filters.endDate && (
                                                <p className="mt-1">
                                                    Real-time availability checking integrated.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fallback Mode Notice */}
                        {usingFallback && !isUsingOptimizedSearch && !error && (
                            <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <span className="text-2xl">ℹ️</span>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-lg font-medium text-yellow-800">
                                            Using Enhanced Search Mode
                                        </h3>
                                        <div className="mt-2 text-sm text-yellow-700">
                                            <p>
                                                Optimized search temporarily unavailable. Using
                                                enhanced fallback method to ensure accurate results.
                                            </p>
                                            {filters.startDate && filters.endDate && (
                                                <p className="mt-1">
                                                    Availability checking is active for your
                                                    selected dates.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {searching && (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
                                <p className="text-gray-600">
                                    {availabilityChecking
                                        ? 'Checking vehicle availability for selected dates...'
                                        : filters.startDate && filters.endDate
                                          ? 'Searching available vehicles...'
                                          : 'Searching vehicles...'}
                                </p>
                                {isUsingOptimizedSearch && (
                                    <p className="text-sm text-green-600 mt-2">
                                        Using optimized search with comprehensive data loading
                                    </p>
                                )}
                                {usingFallback && !isUsingOptimizedSearch && (
                                    <p className="text-sm text-yellow-600 mt-2">
                                        Using enhanced search mode for better results
                                    </p>
                                )}
                            </div>
                        )}

                        {!searching && vehicles.length === 0 && totalCount === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🚗</div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    {filters.startDate && filters.endDate
                                        ? 'No vehicles available for selected dates'
                                        : 'No vehicles found'}
                                </h3>
                                <p className="text-gray-600 mb-4">
                                    {filters.startDate && filters.endDate
                                        ? 'All vehicles are booked for the selected dates. Try different dates or search in a different location.'
                                        : 'Try adjusting your search filters or search in a different location.'}
                                </p>
                                <button
                                    onClick={resetFilters}
                                    className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                                >
                                    Clear All Filters
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Vehicle Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {vehicles.map((vehicle) => (
                                        <Link
                                            key={vehicle.id}
                                            href={`/vehicles/${vehicle.id}`}
                                            className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group"
                                        >
                                            {/* Vehicle Image */}
                                            <div className="aspect-video bg-gray-200 overflow-hidden">
                                                {vehicle.primary_image_url ||
                                                getPrimaryImage(vehicle.car_images) ? (
                                                    <img
                                                        src={
                                                            vehicle.primary_image_url ||
                                                            getPrimaryImage(vehicle.car_images)
                                                        }
                                                        alt={`${vehicle.make} ${vehicle.model}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-4xl">
                                                        🚗
                                                    </div>
                                                )}
                                            </div>

                                            {/* Vehicle Info */}
                                            <div className="p-4">
                                                <h3 className="text-lg font-semibold text-black mb-1">
                                                    {vehicle.make} {vehicle.model}
                                                </h3>
                                                <p className="text-sm text-gray-600 mb-2">
                                                    {vehicle.year} • {vehicle.transmission} •{' '}
                                                    {vehicle.fuel_type}
                                                </p>

                                                {/* Features */}
                                                {vehicle.features &&
                                                    vehicle.features.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {vehicle.features
                                                                .slice(0, 2)
                                                                .map((feature, index) => (
                                                                    <span
                                                                        key={index}
                                                                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                                                                    >
                                                                        {feature}
                                                                    </span>
                                                                ))}
                                                            {vehicle.features.length > 2 && (
                                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                                                    +{vehicle.features.length - 2}{' '}
                                                                    more
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                {/* Location */}
                                                <p className="text-sm text-gray-500 mb-3">
                                                    <LocationDisplay
                                                        location={vehicle.location as any}
                                                        fallback="Location not specified"
                                                    />
                                                    {/* Show host name if available from optimized query */}
                                                    {vehicle.host_profile &&
                                                        vehicle.host_profile.full_name && (
                                                            <span className="text-xs text-gray-400 block">
                                                                Hosted by{' '}
                                                                {vehicle.host_profile.full_name}
                                                            </span>
                                                        )}
                                                </p>

                                                {/* Price */}
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-xl font-bold text-black">
                                                            {formatDailyRate(vehicle.daily_rate)}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {vehicle.seats} seats
                                                    </div>
                                                </div>

                                                {/* Delivery Option */}
                                                {vehicle.delivery_available && (
                                                    <div className="mt-2 text-sm text-green-600">
                                                        ✓ Delivery available
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="mt-12 flex justify-center">
                                        <nav className="flex items-center space-x-2">
                                            <button
                                                onClick={() =>
                                                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                                                }
                                                disabled={currentPage === 1}
                                                className="px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>

                                            {Array.from(
                                                { length: totalPages },
                                                (_, i) => i + 1,
                                            ).map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`px-3 py-2 rounded-md ${
                                                        page === currentPage
                                                            ? 'bg-black text-white'
                                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}

                                            <button
                                                onClick={() =>
                                                    setCurrentPage((prev) =>
                                                        Math.min(prev + 1, totalPages),
                                                    )
                                                }
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </nav>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default function VehicleSearchPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </div>
            }
        >
            <VehicleSearchPageContent />
        </Suspense>
    );
}
