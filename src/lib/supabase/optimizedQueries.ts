/**
 * Optimized Supabase queries for vehicle search functionality
 * This file contains optimized queries that eliminate N+1 problems
 * and implement proper JOIN operations for efficient data retrieval
 */

import type { Database } from '../../types/base/database.types';
import { createClient } from './supabaseClient';

type Tables = Database['public']['Tables'];
type Car = Tables['cars']['Row'];
type CarImage = Tables['car_images']['Row'];
type UserProfile = Tables['user_profiles']['Row'];

// Enhanced Car type with joined data
export interface OptimizedCarWithDetails extends Car {
    car_images: CarImage[];
    host_profile: Pick<UserProfile, 'id' | 'full_name' | 'profile_image_url'>;
    availability_status: 'available' | 'unavailable' | 'not_specified';
    primary_image_url?: string;
}

export interface SearchFilters {
    location?: string;
    startDate?: string;
    endDate?: string;
    priceMin?: number;
    priceMax?: number;
    transmission?: string;
    fuelType?: string;
    carType?: string; // Added carType
    seats?: number;
    features?: string[];
}

export interface PaginationOptions {
    page: number;
    limit: number;
}

export interface SearchResult {
    vehicles: OptimizedCarWithDetails[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

// Cache for search results to avoid re-querying on pagination
const searchCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
    data: SearchResult;
    timestamp: number;
}

function getCacheKey(filters: SearchFilters, page: number, limit: number): string {
    return JSON.stringify({ filters, page, limit });
}

function getCachedResult(key: string): SearchResult | null {
    const entry = searchCache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;
    if (isExpired) {
        searchCache.delete(key);
        return null;
    }

    return entry.data;
}

function setCachedResult(key: string, data: SearchResult): void {
    const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
    };
    searchCache.set(key, entry);

    // Clean up old cache entries (keep only last 20)
    if (searchCache.size > 20) {
        const keys = Array.from(searchCache.keys());
        const oldestKey = keys[0];
        if (oldestKey) {
            searchCache.delete(oldestKey);
        }
    }
}

/**
 * Optimized vehicle search with comprehensive JOIN queries
 * Eliminates N+1 problems by fetching all related data in a single query
 */
export async function searchVehiclesOptimized(
    filters: SearchFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 12 },
): Promise<SearchResult> {
    console.log('🚀 [DEBUG] searchVehiclesOptimized called');
    console.log('🚀 [DEBUG] Input filters:', JSON.stringify(filters, null, 2));
    console.log('🚀 [DEBUG] Input pagination:', JSON.stringify(pagination, null, 2));

    // Check cache first
    const cacheKey = getCacheKey(filters, pagination.page, pagination.limit);
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
        console.log('🚀 [DEBUG] Returning cached result');
        return cachedResult;
    }

    try {
        // Use the optimized RPC function for complex availability checking
        if (filters.startDate && filters.endDate) {
            console.log('🚀 [DEBUG] Using searchWithAvailabilityOptimized (with dates)');
            return await searchWithAvailabilityOptimized(filters, pagination);
        }

        // For searches without dates, use simpler optimized query
        console.log('🚀 [DEBUG] Using searchWithoutDatesOptimized (without dates)');
        return await searchWithoutDatesOptimized(filters, pagination);
    } catch (error) {
        console.error('❌ [DEBUG] Optimized search failed, falling back to basic search:', error);
        console.error('❌ [DEBUG] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        // If the optimized search function doesn't exist, log a helpful message
        if (
            error instanceof Error &&
            error.message.includes('Optimized search function not available')
        ) {
            console.warn(
                '💡 [INFO] Optimized search function is not available in the database. Running fallback search.',
            );
            console.warn(
                '💡 [INFO] To enable optimized search, apply the SQL file: DB_SQL/28-optimized_search_available_vehicles.sql',
            );
        }

        return await searchFallback(filters, pagination);
    }
}

/**
 * Optimized search with availability checking using RPC function
 */
async function searchWithAvailabilityOptimized(
    filters: SearchFilters,
    pagination: PaginationOptions,
): Promise<SearchResult> {
    const supabase = createClient();
    const { page, limit } = pagination;

    // Prepare RPC parameters
    const searchFilters = {
        transmission: filters.transmission || null,
        fuel_type: filters.fuelType || null,
        min_seats: filters.seats && filters.seats > 0 ? filters.seats : null,
        max_price: filters.priceMax && filters.priceMax < 15500000 ? filters.priceMax : null,
    };

    const startDate = filters.startDate ? `${filters.startDate}T00:00:00Z` : undefined;
    const endDate = filters.endDate ? `${filters.endDate}T23:59:59Z` : undefined;

    console.log('🔍 [AVAILABILITY CHECK] Using RPC with dates:', { startDate, endDate });

    // Call the optimized RPC function
    const { data: rpcResults, error: rpcError } = await supabase.rpc(
        'search_available_vehicles_optimized',
        {
            p_start_date: startDate,
            p_end_date: endDate,
            p_location: filters.location || null,
            p_filters: searchFilters,
        },
    );

    if (rpcError) {
        console.error('RPC search failed:', rpcError);
        // If the function doesn't exist, throw an error to trigger fallback
        if (
            rpcError.message?.includes('function') &&
            rpcError.message?.includes('does not exist')
        ) {
            throw new Error('Optimized search function not available');
        }
        throw rpcError;
    }

    const results = rpcResults || [];

    // Apply feature filtering client-side if needed
    let filteredResults = results;
    if (filters.features && filters.features.length > 0) {
        filteredResults = results.filter((vehicle: any) =>
            filters.features!.some(
                (feature) => vehicle.features && vehicle.features.includes(feature),
            ),
        );
    }

    const totalCount = filteredResults.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Apply pagination
    const paginatedResults = filteredResults.slice(0, limit); // Use 0, limit for pagination

    // Get detailed car information with images for paginated results
    const vehicleIds = paginatedResults.map((v: any) => v.car_id);
    const detailedVehicles = await getVehiclesWithDetailsOptimized(vehicleIds);

    // Merge RPC results with detailed vehicle data
    const optimizedVehicles: OptimizedCarWithDetails[] = paginatedResults.map((rpcResult: any) => {
        const detailedVehicle = detailedVehicles.find((v) => (v as any).id === rpcResult.car_id);
        if (!detailedVehicle) {
            throw new Error(`Vehicle details not found for ID: ${rpcResult.car_id}`);
        }

        return {
            ...detailedVehicle,
            availability_status: rpcResult.availability_status as
                | 'available'
                | 'unavailable'
                | 'not_specified',
            primary_image_url: rpcResult.primary_image_url || detailedVehicle.primary_image_url,
        };
    });

    const result: SearchResult = {
        vehicles: optimizedVehicles,
        totalCount,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };

    // Cache the result
    setCachedResult(getCacheKey(filters, page, limit), result);

    return result;
}

/**
 * Optimized search without date filtering
 * Uses single query with JOINs to fetch all related data
 */
async function searchWithoutDatesOptimized(
    filters: SearchFilters,
    pagination: PaginationOptions,
): Promise<SearchResult> {
    const supabase = createClient();
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    console.log(
        '🔍 [DEBUG] searchWithoutDatesOptimized called with filters:',
        JSON.stringify(filters, null, 2),
    );
    console.log('🔍 [DEBUG] Pagination options:', JSON.stringify(pagination, null, 2));

    // Build the main query with JOINs
    let query = supabase
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
        .eq('status', 'ACTIVE');

    console.log('🔍 [DEBUG] Base query built with status=ACTIVE');

    // Apply filters with detailed logging
    if (filters.transmission) {
        console.log('🔍 [DEBUG] Adding transmission filter:', filters.transmission);
        query = query.eq('transmission', filters.transmission);
    }
    if (filters.fuelType) {
        console.log('🔍 [DEBUG] Adding fuel_type filter:', filters.fuelType);
        query = query.eq('fuel_type', filters.fuelType);
    }
    if (filters.carType) {
        console.log('🔍 [DEBUG] Adding car_type filter:', filters.carType);
        query = query.eq('car_type', filters.carType);
    }
    if (filters.seats && filters.seats > 0) {
        console.log('🔍 [DEBUG] Adding seats filter:', filters.seats);
        query = query.gte('seats', filters.seats);
    }
    if (filters.priceMax && filters.priceMax < 15500000) {
        console.log('🔍 [DEBUG] Adding price filter:', filters.priceMax);
        query = query.lte('daily_rate', filters.priceMax);
    }
    if (filters.location) {
        console.log('🔍 [DEBUG] Adding location filter:', filters.location);
        query = query.ilike('location', `%${filters.location}%`);
    }

    console.log('🔍 [DEBUG] All filters applied, building count query...');

    // Get total count for pagination
    const { count, error: countError } = await supabase
        .from('cars')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE');

    if (countError) {
        console.error('❌ [DEBUG] Count query failed:', countError);
        throw countError;
    }

    console.log('🔍 [DEBUG] Count query successful, count:', count);

    // Get paginated results
    console.log('🔍 [DEBUG] Executing main query with range:', offset, 'to', offset + limit - 1);

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('❌ [DEBUG] Main query failed:', error);
        console.error('❌ [DEBUG] Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
        });

        // Log the actual query that was sent
        console.error('❌ [DEBUG] Query parameters that caused error:', {
            filters: filters,
            pagination: pagination,
            offset: offset,
            limit: limit,
        });

        throw error;
    }

    console.log('🔍 [DEBUG] Main query successful, data length:', data?.length || 0);

    let vehicles = data || [];

    // Apply feature filtering client-side
    if (filters.features && filters.features.length > 0) {
        console.log('🔍 [DEBUG] Applying feature filtering for:', filters.features);
        vehicles = vehicles.filter((vehicle) =>
            filters.features!.some(
                (feature) => vehicle.features && vehicle.features.includes(feature),
            ),
        );
        console.log('🔍 [DEBUG] After feature filtering, vehicles count:', vehicles.length);
    }

    const optimizedVehicles: OptimizedCarWithDetails[] = vehicles.map((vehicle) => ({
        ...vehicle,
        host_profile: Array.isArray(vehicle.host_profile)
            ? vehicle.host_profile[0]
            : vehicle.host_profile,
        car_images: vehicle.car_images || [],
        availability_status: 'not_specified' as const,
        primary_image_url: getPrimaryImageUrl(vehicle.car_images || []),
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    console.log('🔍 [DEBUG] Final result:', {
        vehiclesCount: optimizedVehicles.length,
        totalCount: totalCount,
        totalPages: totalPages,
        currentPage: page,
    });

    const result: SearchResult = {
        vehicles: optimizedVehicles,
        totalCount,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };

    // Cache the result
    setCachedResult(getCacheKey(filters, page, limit), result);

    return result;
}

/**
 * Get detailed vehicle information with images using optimized JOINs
 */
async function getVehiclesWithDetailsOptimized(
    vehicleIds: string[],
): Promise<OptimizedCarWithDetails[]> {
    if (vehicleIds.length === 0) return [];

    const supabase = createClient();

    const { data, error } = await supabase
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
        .in('id', vehicleIds)
        .eq('status', 'ACTIVE');

    if (error) {
        throw error;
    }

    return (data || []).map((vehicle) => ({
        ...vehicle,
        host_profile: Array.isArray(vehicle.host_profile)
            ? vehicle.host_profile[0]
            : vehicle.host_profile,
        car_images: vehicle.car_images || [],
        availability_status: 'not_specified' as const,
        primary_image_url: getPrimaryImageUrl(vehicle.car_images || []),
    }));
}

/**
 * Fallback search method for when optimized queries fail
 */
async function searchFallback(
    filters: SearchFilters,
    pagination: PaginationOptions,
): Promise<SearchResult> {
    const supabase = createClient();
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    console.log('🔄 [DEBUG] searchFallback called');
    console.log('🔄 [DEBUG] Fallback filters:', JSON.stringify(filters, null, 2));
    console.log('🔄 [DEBUG] Fallback pagination:', JSON.stringify(pagination, null, 2));

    // Basic query without JOINs
    let query = supabase.from('cars').select('*', { count: 'exact' }).eq('status', 'ACTIVE');

    console.log('🔄 [DEBUG] Building fallback query with status=ACTIVE');

    // Apply basic filters
    if (filters.transmission) {
        console.log('🔄 [DEBUG] Adding transmission filter:', filters.transmission);
        query = query.eq('transmission', filters.transmission);
    }
    if (filters.fuelType) {
        console.log('🔄 [DEBUG] Adding fuel_type filter:', filters.fuelType);
        query = query.eq('fuel_type', filters.fuelType);
    }
    if (filters.carType) {
        console.log('🔄 [DEBUG] Adding car_type filter:', filters.carType);
        query = query.eq('car_type', filters.carType);
    }
    if (filters.seats && filters.seats > 0) {
        console.log('🔄 [DEBUG] Adding seats filter:', filters.seats);
        query = query.gte('seats', filters.seats);
    }
    if (filters.priceMax && filters.priceMax < 15500000) {
        console.log('🔄 [DEBUG] Adding price filter:', filters.priceMax);
        query = query.lte('daily_rate', filters.priceMax);
    }
    if (filters.location) {
        console.log('🔄 [DEBUG] Adding location filter:', filters.location);
        query = query.ilike('location', `%${filters.location}%`);
    }

    console.log(
        '🔄 [DEBUG] Executing fallback query with range:',
        offset,
        'to',
        offset + limit - 1,
    );

    const {
        data: cars,
        error,
        count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
        console.error('❌ [DEBUG] Fallback query failed:', error);
        console.error('❌ [DEBUG] Fallback error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
        });
        throw error;
    }

    console.log('🔄 [DEBUG] Fallback query successful, cars count:', cars?.length || 0);

    // Batch fetch images and host profiles
    const vehicleIds = (cars || []).map((car) => car.id);
    console.log('🔄 [DEBUG] Fetching images and host profiles for', vehicleIds.length, 'vehicles');

    const [images, hostProfiles] = await Promise.all([
        getCarImagesBatch(vehicleIds),
        getHostProfilesBatch((cars || []).map((car) => car.host_id)),
    ]);

    console.log(
        '🔄 [DEBUG] Batch fetch completed - images:',
        Object.keys(images).length,
        'hosts:',
        Object.keys(hostProfiles).length,
    );

    const optimizedVehicles: OptimizedCarWithDetails[] = (cars || []).map((car) => {
        const carImages = images[car.id] || [];
        const hostProfile = hostProfiles[car.host_id];

        return {
            ...car,
            car_images: carImages,
            host_profile: hostProfile || {
                id: car.host_id,
                full_name: 'Unknown',
                profile_image_url: null,
            },
            availability_status: 'not_specified' as const,
            primary_image_url: getPrimaryImageUrl(carImages),
        };
    });

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
        vehicles: optimizedVehicles,
        totalCount,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
}

/**
 * Batch fetch car images to avoid N+1 queries
 */
async function getCarImagesBatch(vehicleIds: string[]): Promise<Record<string, CarImage[]>> {
    if (vehicleIds.length === 0) return {};

    const supabase = createClient();
    const { data, error } = await supabase
        .from('car_images')
        .select('*')
        .in('car_id', vehicleIds)
        .order('display_order');

    if (error) {
        console.error('Error fetching car images:', error);
        return {};
    }

    // Group images by car_id
    const imageMap: Record<string, CarImage[]> = {};
    (data || []).forEach((image) => {
        if (!imageMap[image.car_id]) {
            imageMap[image.car_id] = [];
        }
        imageMap[image.car_id].push(image);
    });

    return imageMap;
}

/**
 * Batch fetch host profiles to avoid N+1 queries
 */
async function getHostProfilesBatch(
    hostIds: string[],
): Promise<Record<string, Pick<UserProfile, 'id' | 'full_name' | 'profile_image_url'>>> {
    if (hostIds.length === 0) return {};

    const supabase = createClient();
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, profile_image_url')
        .in('id', Array.from(new Set(hostIds))); // Remove duplicates

    if (error) {
        console.error('Error fetching host profiles:', error);
        return {};
    }

    // Create lookup map
    const profileMap: Record<
        string,
        Pick<UserProfile, 'id' | 'full_name' | 'profile_image_url'>
    > = {};
    (data || []).forEach((profile) => {
        profileMap[profile.id] = profile;
    });

    return profileMap;
}

/**
 * Get primary image URL from car images array
 */
function getPrimaryImageUrl(images: CarImage[]): string {
    const primary = images.find((img) => img.is_primary);
    return primary?.image_url || images[0]?.image_url || '';
}

/**
 * Clear search cache manually if needed
 */
export function clearSearchCache(): void {
    searchCache.clear();
}

/**
 * Client-side availability checking for fallback scenarios
 */
export async function checkClientSideAvailability(
    carId: string,
    startDate: string,
    endDate: string,
): Promise<boolean> {
    const supabase = createClient();

    try {
        console.log(`🔍 [AVAILABILITY CHECK] Car: ${carId}, Search: ${startDate} to ${endDate}`);

        // Check for booking conflicts (fixed date overlap logic)
        const { data: bookings } = await supabase
            .from('bookings')
            .select('start_date, end_date, status')
            .eq('car_id', carId)
            .in('status', ['PENDING', 'AUTO_APPROVED', 'CONFIRMED', 'IN_PROGRESS'])
            .gt('end_date', startDate) // Existing booking end > new booking start
            .lt('start_date', endDate); // Existing booking start < new booking end

        console.log(
            `📋 [BOOKING CONFLICTS] Car ${carId} has ${bookings?.length || 0} conflicting bookings:`,
            bookings,
        );

        if (bookings && bookings.length > 0) {
            return false; // Vehicle is booked
        }

        // Check for manual availability blocks (fixed date overlap logic)
        const { data: availability } = await supabase
            .from('car_availability')
            .select('is_available, start_date, end_date, reason')
            .eq('car_id', carId)
            .eq('is_available', false)
            .gt('end_date', startDate) // Block end > search start
            .lt('start_date', endDate); // Block start < search end

        console.log(
            `🚫 [AVAILABILITY BLOCKS] Car ${carId} has ${availability?.length || 0} blocking periods:`,
            availability,
        );

        if (availability && availability.length > 0) {
            console.log(`❌ [BLOCKED] Car ${carId} is manually blocked`);
            return false; // Vehicle is manually blocked
        }

        console.log(`✅ [AVAILABLE] Car ${carId} is available for ${startDate} to ${endDate}`);
        return true; // Vehicle is available
    } catch (error) {
        console.error('❌ [ERROR] Error checking client-side availability:', error);
        return true; // Assume available if check fails
    }
}
