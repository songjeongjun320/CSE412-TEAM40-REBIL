/**
 * Location Conversion Utilities
 * Converts between different address formats used across the application
 */

import {
    DEFAULT_CENTER,
    getCityCoordinatesByName,
    resolveCityCoordinates,
} from '@/lib/utils/cityCoordinates';
import { getBestCoordinatesFromCodes } from '@/lib/utils/codeToCoordinates';
import { FlexibleLocationResult } from '@/lib/utils/indonesianAddressService';

/**
 * Location info interface for map search functionality
 */
export interface LocationInfo {
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

/**
 * Convert FlexibleLocationResult to LocationInfo for map search compatibility
 */
export async function convertFlexibleResultToLocationInfo(
    flexibleResult: FlexibleLocationResult,
): Promise<LocationInfo> {
    const hierarchy = flexibleResult.hierarchy;

    // Extract IDs and codes from hierarchy
    const provinceId = hierarchy.province?.id;
    const provinceName = hierarchy.province?.name;
    const provinceCode = hierarchy.province?.code;

    const cityId = hierarchy.regency?.id;
    const cityName = hierarchy.regency?.name;
    const cityCode = hierarchy.regency?.code;

    const districtId = hierarchy.district?.id;
    const districtName = hierarchy.district?.name;

    const villageId = hierarchy.village?.id;
    const villageName = hierarchy.village?.name;

    // Get coordinates with simplified city-first approach
    let coordinates = { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };

    try {
        // Strategy 1: Direct city name lookup (prioritized for Google Maps)
        if (cityName) {
            const cityCoords = getCityCoordinatesByName(cityName);
            if (cityCoords) {
                coordinates = cityCoords;
            } else {
                // Try geocoding service for cities not in our local mapping
                const geocodedCoords = await resolveCityCoordinates(cityName);
                if (geocodedCoords) {
                    coordinates = geocodedCoords;
                }
            }
        }

        // Strategy 2: Use flexibleResult name directly if city name didn't work
        if (coordinates.lat === DEFAULT_CENTER.lat) {
            const directCoords = getCityCoordinatesByName(flexibleResult.name);
            if (directCoords) {
                coordinates = directCoords;
            } else {
                const geocodedDirectCoords = await resolveCityCoordinates(flexibleResult.name);
                if (geocodedDirectCoords) {
                    coordinates = geocodedDirectCoords;
                }
            }
        }

        // Strategy 3: Province name lookup (if still no coordinates)
        if (coordinates.lat === DEFAULT_CENTER.lat && provinceName) {
            const provinceCoords = getCityCoordinatesByName(provinceName);
            if (provinceCoords) {
                coordinates = provinceCoords;
            } else {
                const geocodedProvinceCoords = await resolveCityCoordinates(provinceName);
                if (geocodedProvinceCoords) {
                    coordinates = geocodedProvinceCoords;
                }
            }
        }

        // Strategy 4: Hierarchical code mapping (last resort)
        if (coordinates.lat === DEFAULT_CENTER.lat && (provinceCode || cityCode)) {
            const codeCoords = getBestCoordinatesFromCodes(provinceCode, cityCode);
            if (codeCoords) {
                coordinates = codeCoords;
            }
        }
    } catch (error) {
        console.warn(
            'Error resolving coordinates for location:',
            flexibleResult.displayText,
            error,
        );
        // Keep default coordinates on error
    }

    return {
        lat: coordinates.lat,
        lng: coordinates.lng,
        address: flexibleResult.displayText,
        provinceId,
        cityId,
        districtId,
        villageId,
        provinceName,
        cityName,
        districtName,
        villageName,
    };
}

/**
 * Convert text location to LocationInfo (for compatibility with existing flows)
 */
export async function convertTextToLocationInfo(locationText: string): Promise<LocationInfo> {
    try {
        const coordinates =
            (await resolveCityCoordinates(locationText)) ||
            getCityCoordinatesByName(locationText) ||
            DEFAULT_CENTER;

        return {
            lat: coordinates.lat,
            lng: coordinates.lng,
            address: locationText,
            cityName: locationText,
        };
    } catch (error) {
        console.warn('Error converting text location:', locationText, error);
        return {
            lat: DEFAULT_CENTER.lat,
            lng: DEFAULT_CENTER.lng,
            address: locationText,
            cityName: locationText,
        };
    }
}

/**
 * Extract search conditions from FlexibleLocationResult for vehicle filtering
 */
export function extractSearchConditions(
    flexibleResult: FlexibleLocationResult,
): Record<string, string> {
    return flexibleResult.searchConditions || {};
}

/**
 * Determine the appropriate zoom level based on location specificity
 */
export function getLocationZoomLevel(locationInfo: LocationInfo): number {
    if (locationInfo.villageId) return 15; // Village level
    if (locationInfo.districtId) return 13; // District level
    if (locationInfo.cityId) return 11; // City level
    if (locationInfo.provinceId) return 8; // Province level
    return 6; // Default country level
}

/**
 * Create a displayable address string from LocationInfo
 */
export function formatLocationAddress(locationInfo: LocationInfo): string {
    const parts = [
        locationInfo.villageName,
        locationInfo.districtName,
        locationInfo.cityName,
        locationInfo.provinceName,
    ].filter(Boolean);

    return parts.join(', ') || locationInfo.address;
}
