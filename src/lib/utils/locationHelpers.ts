/**
 * Location Helper Utilities
 * Handles both legacy and Indonesian address formats
 */

import { createClient } from '@/lib/supabase/supabaseClient';

// Type definitions for different location formats
export interface LegacyAddress {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
}

export interface IndonesianAddress {
    street_address: string;
    postal_code?: string; // validation에서 필수로 검증
    additional_info?: string;
    // Nested format only - validation에서 필수로 검증
    province?: {
        code: string;
        name: string;
    };
    city?: {
        code: string;
        name: string;
    };
    district?: {
        code: string;
        name: string;
    };
    village?: {
        code: string;
        name: string;
    };
    // Legacy support (기존 호환성을 위해 유지, 하지만 저장시에는 사용 안 함)
    city_id?: string;
    province_id?: string;
    district_id?: string;
    village_id?: string;
    province_name?: string;
    city_name?: string;
    district_name?: string;
    village_name?: string;
}

export type LocationData = LegacyAddress | IndonesianAddress | null;

// Cache for city/province lookups
const locationCache = new Map<string, string>();

// Helper types and functions
type Named = { name: string };
function getNameFromPossiblyString(part?: string | Named | null): string | null {
    if (!part) return null;
    return typeof part === 'string' ? part : (part.name ?? null);
}

/**
 * Check if location data is in Indonesian format
 */
export function isIndonesianAddress(location: any): location is IndonesianAddress {
    return (
        location &&
        typeof location === 'object' &&
        ('city_id' in location || 'province_id' in location)
    );
}

/**
 * Check if location data is in legacy format
 */
export function isLegacyAddress(location: any): location is LegacyAddress {
    return (
        location &&
        typeof location === 'object' &&
        ('city' in location || 'state' in location) &&
        !('city_id' in location)
    );
}

/**
 * Build location payload from form data for database submission
 * Handles both flat fields and nested objects with proper validation
 */
export function buildLocationPayload(locationFormData: any): {
    locationData: any;
    isValid: boolean;
    error?: string;
} {
    const locationData: any = {
        street_address: locationFormData.street_address || '',
        postal_code: locationFormData.postal_code || '',
        additional_info: locationFormData.additional_info || '',
    };

    // Helper function to add nested object if valid
    const addNestedObject = (obj: any, key: string) => {
        if (obj && typeof obj === 'object' && obj.code?.trim() && obj.name?.trim()) {
            locationData[key] = {
                code: obj.code.trim(),
                name: obj.name.trim(),
            };
        }
    };

    // Add nested objects only (no _id fields)
    addNestedObject(locationFormData.province, 'province');
    addNestedObject(locationFormData.city, 'city');
    addNestedObject(locationFormData.district, 'district');
    addNestedObject(locationFormData.village, 'village');

    // Remove undefined or null values
    Object.keys(locationData).forEach((key) => {
        if (locationData[key] === undefined || locationData[key] === null) {
            delete locationData[key];
        }
    });

    // 기본 정보 필수 검증
    const hasValidBasicInfo =
        locationData.street_address?.trim() && locationData.postal_code?.trim();

    if (!hasValidBasicInfo) {
        console.error('Location validation failed: Missing street address or postal code');
        console.error('Street address:', locationData.street_address);
        console.error('Postal code:', locationData.postal_code);
        return {
            locationData,
            isValid: false,
            error: 'Street address and postal code are required.',
        };
    }

    // nested 객체들만 검증 (모든 필드가 필수)
    const hasValidNestedFields =
        locationData.province?.code?.trim() &&
        locationData.city?.code?.trim() &&
        locationData.district?.code?.trim() &&
        locationData.village?.code?.trim();

    if (!hasValidNestedFields) {
        console.error('Location validation failed: Missing required location data');
        console.error(
            'Nested fields - province:',
            locationData.province,
            'city:',
            locationData.city,
            'district:',
            locationData.district,
            'village:',
            locationData.village,
        );
        return {
            locationData,
            isValid: false,
            error: 'Complete address is required. Please select province, city, district, and village.',
        };
    }

    // Ensure the location data can be serialized to JSON
    try {
        JSON.stringify(locationData);
    } catch (jsonError) {
        console.error('Location data cannot be serialized to JSON:', jsonError);
        return {
            locationData,
            isValid: false,
            error: 'Location data format error. Please refresh and try again.',
        };
    }

    return {
        locationData,
        isValid: true,
    };
}

/**
 * Get city name from city_id
 */
export async function getCityName(cityIdentifier: string): Promise<string> {
    const cacheKey = `city_${cityIdentifier}`;

    if (locationCache.has(cacheKey)) {
        return locationCache.get(cacheKey)!;
    }

    try {
        const supabase = createClient();

        // Method 1: Try UUID lookup first (more direct and reliable)
        try {
            const { data: uuidData, error: uuidError } = await supabase
                .from('indonesian_regencies')
                .select('name')
                .eq('id', cityIdentifier)
                .single();

            if (!uuidError && uuidData) {
                locationCache.set(cacheKey, uuidData.name);
                return uuidData.name;
            }
        } catch {
            // UUID lookup failed, continue to government code lookup
        }

        // Method 2: Fallback to government code lookup
        const { data: govData, error: govError } = await supabase
            .from('indonesian_regencies')
            .select('name')
            .eq('code', cityIdentifier)
            .single();

        if (!govError && govData) {
            locationCache.set(cacheKey, govData.name);
            return govData.name;
        }

        console.warn('City not found for identifier:', cityIdentifier);
        return cityIdentifier; // Return the identifier as fallback
    } catch (error) {
        console.error('Error fetching city name:', error);
        return cityIdentifier; // Return the identifier as fallback
    }
}

/**
 * Get province name from province_id
 */
export async function getProvinceName(provinceIdentifier: string): Promise<string> {
    const cacheKey = `province_${provinceIdentifier}`;

    if (locationCache.has(cacheKey)) {
        return locationCache.get(cacheKey)!;
    }

    try {
        const supabase = createClient();

        // Method 1: Try UUID lookup first (more direct and reliable)
        try {
            const { data: uuidData, error: uuidError } = await supabase
                .from('indonesian_provinces')
                .select('name')
                .eq('id', provinceIdentifier)
                .single();

            if (!uuidError && uuidData) {
                locationCache.set(cacheKey, uuidData.name);
                return uuidData.name;
            }
        } catch {
            // UUID lookup failed, continue to government code lookup
        }

        // Method 2: Fallback to government code lookup
        const { data: govData, error: govError } = await supabase
            .from('indonesian_provinces')
            .select('name')
            .eq('government_code', provinceIdentifier)
            .single();

        if (!govError && govData) {
            locationCache.set(cacheKey, govData.name);
            return govData.name;
        }

        console.warn('Province not found for identifier:', provinceIdentifier);
        return provinceIdentifier; // Return the identifier as fallback
    } catch (error) {
        console.error('Error fetching province name:', error);
        return provinceIdentifier; // Return the identifier as fallback
    }
}

/**
 * Format location data for display
 * Handles both legacy and Indonesian formats
 */
/**
 * Simple synchronous location display formatter - uses only available nested data
 */
export function formatLocationDisplaySync(location: LocationData): string {
    if (!location || typeof location !== 'object') {
        return 'Location not specified';
    }

    try {
        if (isIndonesianAddress(location)) {
            const parts: string[] = [];

            // Use nested object format if available
            if (location.village?.name) parts.push(location.village.name);
            if (location.district?.name) parts.push(location.district.name);
            if (location.city?.name) parts.push(location.city.name);
            if (location.province?.name) parts.push(location.province.name);

            // Fallback to legacy _name properties
            if (parts.length === 0) {
                if (location.village_name) parts.push(location.village_name);
                if (location.district_name) parts.push(location.district_name);
                if (location.city_name) parts.push(location.city_name);
                if (location.province_name) parts.push(location.province_name);
            }

            return parts.filter(Boolean).join(', ') || 'Location not specified';
        }

        if (isLegacyAddress(location)) {
            const parts: string[] = [];
            if (location.city) parts.push(location.city);
            if (location.state) parts.push(location.state);
            if (location.country) parts.push(location.country);
            return parts.filter(Boolean).join(', ') || 'Location not specified';
        }

        return 'Location not specified';
    } catch (error) {
        console.error('Error formatting location display:', error);
        return 'Location not specified';
    }
}

export async function formatLocationDisplay(location: LocationData): Promise<string> {
    if (!location || typeof location !== 'object') {
        return 'Location not specified';
    }

    try {
        if (isIndonesianAddress(location)) {
            const parts: string[] = [];

            // Method 1: Check for nested/structured format
            if (
                getNameFromPossiblyString(location.province) ||
                getNameFromPossiblyString(location.city)
            ) {
                const villageName = getNameFromPossiblyString(location.village as any);
                const districtName = getNameFromPossiblyString(location.district as any);
                const cityName = getNameFromPossiblyString(location.city as any);
                const provinceName = getNameFromPossiblyString(location.province as any);

                if (villageName) parts.push(villageName);
                if (districtName) parts.push(districtName);
                if (cityName) parts.push(cityName);
                if (provinceName) parts.push(provinceName);
                return parts.filter(Boolean).join(', ') || 'Location not specified';
            }

            // Method 2: Check for flat format (_name properties)
            if (location.province_name || location.city_name) {
                if (location.village_name) parts.push(location.village_name);
                if (location.district_name) parts.push(location.district_name);
                if (location.city_name) parts.push(location.city_name);
                if (location.province_name) parts.push(location.province_name);
                return parts.filter(Boolean).join(', ') || 'Location not specified';
            }

            // Method 3: Legacy ID format - resolve IDs to names
            const cityName = location.city_id ? await getCityName(location.city_id) : null;
            const provinceName = location.province_id
                ? await getProvinceName(location.province_id)
                : null;

            const villageName = getNameFromPossiblyString(location.village as any);
            const districtName = getNameFromPossiblyString(location.district as any);
            if (villageName) parts.push(villageName);
            if (districtName) parts.push(districtName);
            if (cityName && cityName !== location.city_id) parts.push(cityName);
            if (provinceName && provinceName !== location.province_id) parts.push(provinceName);

            return parts.filter(Boolean).join(', ') || 'Location not specified';
        }

        if (isLegacyAddress(location)) {
            // Legacy format: use city and state directly
            const parts: string[] = [];
            if (location.city) parts.push(location.city);
            if (location.state) parts.push(location.state);
            return parts.filter(Boolean).join(', ') || 'Location not specified';
        }

        // Fallback: try to extract meaningful values from any object
        const locationObj = location as any;
        const meaningfulParts: string[] = [];

        // Look for common meaningful fields
        const meaningfulKeys = [
            'city_name',
            'province_name',
            'district_name',
            'village_name',
            'city',
            'state',
            'province',
        ];
        for (const key of meaningfulKeys) {
            if (locationObj[key] && typeof locationObj[key] === 'string') {
                meaningfulParts.push(locationObj[key]);
            }
        }

        return meaningfulParts.join(', ') || 'Location not specified';
    } catch (error) {
        console.error('Error formatting location:', error);
        return 'Location not specified';
    }
}

/**
 * Format location for search/filtering
 * Creates searchable text from location data
 */
export async function formatLocationForSearch(location: LocationData): Promise<string> {
    if (!location || typeof location !== 'object') {
        return '';
    }

    try {
        const parts: string[] = [];

        if (isIndonesianAddress(location)) {
            // Indonesian format
            if (location.street_address) parts.push(location.street_address);
            const villageName = getNameFromPossiblyString(location.village as any);
            const districtName = getNameFromPossiblyString(location.district as any);
            if (villageName) parts.push(villageName);
            if (districtName) parts.push(districtName);

            if (location.city_id) {
                const cityName = await getCityName(location.city_id);
                parts.push(cityName);
            }

            if (location.province_id) {
                const provinceName = await getProvinceName(location.province_id);
                parts.push(provinceName);
            }

            if (location.postal_code) parts.push(location.postal_code);
        }

        if (isLegacyAddress(location)) {
            // Legacy format
            if (location.street) parts.push(location.street);
            if (location.city) parts.push(location.city);
            if (location.state) parts.push(location.state);
            if (location.country) parts.push(location.country);
            if (location.postal_code) parts.push(location.postal_code);
        }

        return parts.filter(Boolean).join(' ').toLowerCase();
    } catch (error) {
        console.error('Error formatting location for search:', error);
        return '';
    }
}

/**
 * Convert legacy address to Indonesian format
 */
export function convertLegacyToIndonesian(legacy: LegacyAddress): Partial<IndonesianAddress> {
    return {
        street_address: legacy.street || '',
        // Note: city and state names would need to be mapped to IDs
        // This is a placeholder conversion
        postal_code: legacy.postal_code || '',
        additional_info: `Converted from legacy format: ${legacy.city || ''}, ${legacy.state || ''}`,
    };
}

/**
 * Get full address string for booking/pickup locations
 */
export async function getFullAddressString(location: LocationData): Promise<string> {
    if (!location || typeof location !== 'object') {
        return 'Address not specified';
    }

    try {
        const parts: string[] = [];

        if (isIndonesianAddress(location)) {
            if (location.street_address) parts.push(location.street_address);
            const villageName = getNameFromPossiblyString(location.village as any);
            const districtName = getNameFromPossiblyString(location.district as any);
            if (villageName) parts.push(villageName);
            if (districtName) parts.push(districtName);

            if (location.city_id) {
                const cityName = await getCityName(location.city_id);
                parts.push(cityName);
            }

            if (location.province_id) {
                const provinceName = await getProvinceName(location.province_id);
                parts.push(provinceName);
            }

            if (location.postal_code) parts.push(location.postal_code);
        }

        if (isLegacyAddress(location)) {
            if (location.street) parts.push(location.street);
            if (location.city) parts.push(location.city);
            if (location.state) parts.push(location.state);
            if (location.postal_code) parts.push(location.postal_code);
            if (location.country && location.country !== 'Indonesia') parts.push(location.country);
        }

        return parts.filter(Boolean).join(', ') || 'Address not specified';
    } catch (error) {
        console.error('Error getting full address:', error);
        return 'Address not specified';
    }
}
