/**
 * Vehicle Location Processing Utilities
 * Optimized functions for parsing and processing vehicle location data
 */

import { getCityCoordinatesByName, resolveCityCoordinates } from '@/lib/utils/cityCoordinates';
import {
    getCityName,
    getProvinceName,
    isIndonesianAddress,
    isLegacyAddress,
} from '@/lib/utils/locationHelpers';

export interface VehicleCoordinates {
    lat: number;
    lng: number;
    confidence: 'high' | 'medium' | 'low'; // Confidence level of coordinate accuracy
    source: 'direct' | 'geocoded' | 'city_mapping' | 'fallback'; // Source of coordinates
}

export interface ProcessedVehicleLocation {
    coordinates: VehicleCoordinates;
    address: string;
    displayAddress: string;
}

/**
 * Extract coordinates from vehicle location data with improved efficiency
 */
export async function parseVehicleLocation(
    locationData: any,
    fallbackCoordinates?: { lat: number; lng: number },
): Promise<ProcessedVehicleLocation> {
    const fallback = fallbackCoordinates || { lat: -6.2088, lng: 106.8456 }; // Jakarta

    const result: ProcessedVehicleLocation = {
        coordinates: {
            lat: fallback.lat,
            lng: fallback.lng,
            confidence: 'low',
            source: 'fallback',
        },
        address: 'Unknown Location',
        displayAddress: 'Location not specified',
    };

    if (!locationData || typeof locationData !== 'object') {
        return result;
    }

    try {
        // Strategy 1: Direct numeric/string coordinates (highest priority)
        const directCoords = await extractDirectCoordinates(locationData);
        if (directCoords) {
            result.coordinates = {
                ...directCoords,
                confidence: 'high',
                source: 'direct',
            };
            result.address = formatLocationAddress(locationData);
            result.displayAddress = result.address;
            return result;
        }

        // Strategy 2: Indonesian structured address
        if (isIndonesianAddress(locationData)) {
            const structuredResult = await processIndonesianAddress(locationData);
            if (
                structuredResult.coordinates.lat !== fallback.lat ||
                structuredResult.coordinates.lng !== fallback.lng
            ) {
                return structuredResult;
            }
        }

        // Strategy 3: Legacy address format
        if (isLegacyAddress(locationData)) {
            const legacyResult = await processLegacyAddress(locationData);
            if (
                legacyResult.coordinates.lat !== fallback.lat ||
                legacyResult.coordinates.lng !== fallback.lng
            ) {
                return legacyResult;
            }
        }

        // Strategy 4: Additional info extraction
        const additionalResult = await extractFromAdditionalInfo(locationData);
        if (additionalResult) {
            return additionalResult;
        }
    } catch (error) {
        console.warn('Error processing vehicle location:', error);
    }

    return result;
}

/**
 * Extract direct coordinates (lat/lng) from location data
 */
async function extractDirectCoordinates(
    locationData: any,
): Promise<{ lat: number; lng: number } | null> {
    const directLat = locationData.lat ?? locationData.latitude;
    const directLng = locationData.lng ?? locationData.longitude;

    if (directLat != null && directLng != null) {
        const latNum = typeof directLat === 'string' ? parseFloat(directLat) : Number(directLat);
        const lngNum = typeof directLng === 'string' ? parseFloat(directLng) : Number(directLng);

        if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
            // Validate coordinates are within Indonesian bounds
            if (latNum >= -11 && latNum <= 6 && lngNum >= 95 && lngNum <= 141) {
                return { lat: latNum, lng: lngNum };
            }
        }
    }

    return null;
}

/**
 * Process Indonesian structured address to coordinates
 */
async function processIndonesianAddress(locationData: any): Promise<ProcessedVehicleLocation> {
    const fallback = { lat: -6.2088, lng: 106.8456 };

    try {
        // Extract city and province names - prefer nested objects, fallback to ID lookup
        let cityName = '';
        let provinceName = '';

        // Try nested objects first (more reliable)
        if (locationData.city && typeof locationData.city === 'object' && locationData.city.name) {
            cityName = locationData.city.name;
        } else if (locationData.city_name) {
            cityName = locationData.city_name;
        } else if (locationData.city_id && typeof locationData.city_id === 'string') {
            // Only lookup if it looks like a UUID (contains hyphens) not a code like "31.71"
            if (locationData.city_id.includes('-')) {
                cityName = await getCityName(locationData.city_id);
            }
        }

        if (
            locationData.province &&
            typeof locationData.province === 'object' &&
            locationData.province.name
        ) {
            provinceName = locationData.province.name;
        } else if (locationData.province_name) {
            provinceName = locationData.province_name;
        } else if (locationData.province_id && typeof locationData.province_id === 'string') {
            // Only lookup if it looks like a UUID not a code like "31"
            if (locationData.province_id.includes('-')) {
                provinceName = await getProvinceName(locationData.province_id);
            }
        }

        // Extract district and village names
        const districtName =
            locationData.district?.name ||
            locationData.district_name ||
            locationData.district ||
            '';
        const villageName =
            locationData.village?.name || locationData.village_name || locationData.village || '';

        // Check if we have detailed address information
        const hasDetailedAddress =
            locationData.address || locationData.street || districtName || villageName;

        let coordinates = null;
        let source: 'city_mapping' | 'geocoded' = 'geocoded';
        let confidence: 'high' | 'medium' | 'low' = 'medium';

        // If we have detailed address, prioritize Google Geocoding for accuracy
        if (hasDetailedAddress) {
            const detailedAddress = [
                locationData.address,
                locationData.street,
                villageName,
                districtName,
                cityName,
                provinceName,
                'Indonesia', // Always add country for better geocoding
            ]
                .filter((part) => part && typeof part === 'string' && part.trim().length > 0)
                .join(', ');

            // Try Google Geocoding first for detailed addresses
            coordinates = await resolveCityCoordinates(detailedAddress);
            if (coordinates) {
                source = 'geocoded';
                confidence = 'high'; // High confidence for geocoded detailed addresses
            }
        }

        // If no detailed address or geocoding failed, use city mapping
        if (!coordinates) {
            const addressParts = [cityName, provinceName].filter(Boolean);
            const addressString = addressParts.join(', ');

            if (addressParts.length > 0) {
                // Try city mapping (faster but less accurate)
                coordinates =
                    getCityCoordinatesByName(addressString) ||
                    (cityName ? getCityCoordinatesByName(cityName) : null);

                if (coordinates) {
                    source = 'city_mapping';
                    confidence = 'medium';
                } else {
                    // Fallback to geocoding city name
                    coordinates = await resolveCityCoordinates(addressString);
                    if (coordinates) {
                        source = 'geocoded';
                        confidence = 'medium';
                    }
                }
            }
        }

        if (coordinates) {
            return {
                coordinates: {
                    lat: coordinates.lat,
                    lng: coordinates.lng,
                    confidence,
                    source,
                },
                address:
                    locationData.address || [cityName, provinceName].filter(Boolean).join(', '),
                displayAddress: formatIndonesianAddress(locationData, cityName, provinceName),
            };
        }
    } catch (error) {
        console.warn('Error processing Indonesian address:', error);
    }

    return {
        coordinates: {
            lat: fallback.lat,
            lng: fallback.lng,
            confidence: 'low',
            source: 'fallback',
        },
        address: 'Indonesia',
        displayAddress: 'Location in Indonesia',
    };
}

/**
 * Process legacy address format
 */
async function processLegacyAddress(locationData: any): Promise<ProcessedVehicleLocation> {
    const fallback = { lat: -6.2088, lng: 106.8456 };

    try {
        const parts = [
            locationData.street,
            locationData.city,
            locationData.state,
            locationData.country,
        ].filter(Boolean);

        const addressString = parts.join(', ');
        let coordinates = null;
        let source: 'city_mapping' | 'geocoded' = 'geocoded';
        let confidence: 'high' | 'medium' | 'low' = 'medium';

        // If we have street address, prioritize Google Geocoding
        if (locationData.street && addressString) {
            coordinates = await resolveCityCoordinates(addressString);
            if (coordinates) {
                source = 'geocoded';
                confidence = 'high'; // High confidence for full address geocoding
            }
        }

        // Fallback to city mapping if no street or geocoding failed
        if (!coordinates && locationData.city) {
            coordinates = getCityCoordinatesByName(locationData.city);
            if (coordinates) {
                source = 'city_mapping';
                confidence = 'medium';
            } else if (addressString) {
                // Last resort: try geocoding city/state
                coordinates = await resolveCityCoordinates(addressString);
                if (coordinates) {
                    source = 'geocoded';
                    confidence = 'medium';
                }
            }
        }

        if (coordinates) {
            return {
                coordinates: {
                    lat: coordinates.lat,
                    lng: coordinates.lng,
                    confidence,
                    source,
                },
                address: addressString,
                displayAddress: addressString,
            };
        }
    } catch (error) {
        console.warn('Error processing legacy address:', error);
    }

    return {
        coordinates: {
            lat: fallback.lat,
            lng: fallback.lng,
            confidence: 'low',
            source: 'fallback',
        },
        address: 'Unknown Location',
        displayAddress: 'Location not specified',
    };
}

/**
 * Extract coordinates from additional_info field
 */
async function extractFromAdditionalInfo(
    locationData: any,
): Promise<ProcessedVehicleLocation | null> {
    if (typeof locationData.additional_info === 'string') {
        const match = locationData.additional_info.match(/Original:\s*([^,]+)/);
        const city = match ? match[1].trim() : '';

        if (city) {
            const coordinates =
                getCityCoordinatesByName(city) || (await resolveCityCoordinates(city));

            if (coordinates) {
                return {
                    coordinates: {
                        lat: coordinates.lat,
                        lng: coordinates.lng,
                        confidence: 'low',
                        source: 'city_mapping',
                    },
                    address: city,
                    displayAddress: city,
                };
            }
        }
    }

    return null;
}

/**
 * Format Indonesian address for display
 */
function formatIndonesianAddress(
    locationData: any,
    cityName?: string,
    provinceName?: string,
): string {
    const parts = [
        locationData.street_address,
        locationData.village,
        locationData.district,
        cityName,
        provinceName,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Indonesia';
}

/**
 * Format generic location address
 */
function formatLocationAddress(locationData: any): string {
    const parts = [
        locationData.street_address,
        locationData.address,
        locationData.city,
        locationData.state,
        locationData.country,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Location';
}

/**
 * Apply deterministic jitter to coordinates to prevent marker overlap
 */
export function applyCoordinateJitter(
    coordinates: { lat: number; lng: number },
    vehicleId: string,
    maxJitter: number = 0.0015,
): { lat: number; lng: number } {
    let hash = 0;
    for (let i = 0; i < vehicleId.length; i++) {
        hash = (hash * 31 + vehicleId.charCodeAt(i)) | 0;
    }

    // Map hash to jitter range
    const j1 = ((hash % 1000) / 1000) * 2 - 1; // [-1,1]
    const j2 = (((hash >> 5) % 1000) / 1000) * 2 - 1; // [-1,1]

    return {
        lat: coordinates.lat + j1 * maxJitter,
        lng: coordinates.lng + j2 * maxJitter,
    };
}

/**
 * Batch process multiple vehicle locations for improved performance
 */
export async function batchProcessVehicleLocations(
    vehicles: any[],
    fallbackCoordinates?: { lat: number; lng: number },
): Promise<Map<string, ProcessedVehicleLocation>> {
    const resultMap = new Map<string, ProcessedVehicleLocation>();

    // Process in batches to avoid overwhelming the geocoding service
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < vehicles.length; i += batchSize) {
        batches.push(vehicles.slice(i, i + batchSize));
    }

    for (const batch of batches) {
        const batchPromises = batch.map(async (vehicle) => {
            // Skip vehicles without valid location data
            if (!vehicle.location || typeof vehicle.location !== 'object') {
                return null;
            }

            const processed = await parseVehicleLocation(vehicle.location, fallbackCoordinates);

            // Only include vehicles with real coordinates (not fallback)
            // This prevents showing all vehicles at the fallback location
            if (processed.coordinates.source === 'fallback') {
                return null;
            }

            return { id: vehicle.id, processed };
        });

        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
            if (result) {
                resultMap.set(result.id, result.processed);
            }
        }

        // Small delay between batches to be respectful to geocoding service
        if (batches.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    return resultMap;
}
