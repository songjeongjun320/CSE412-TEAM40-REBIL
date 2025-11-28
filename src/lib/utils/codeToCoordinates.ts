// Helper functions to map Indonesian administrative codes to coordinates
// This provides better map centering for hierarchical address searches

interface Coordinates {
    lat: number;
    lng: number;
}

// Province code to coordinates mapping (approximate centers)
const PROVINCE_COORDINATES: Record<string, Coordinates> = {
    // Major provinces with known coordinates
    '31': { lat: -6.2088, lng: 106.8456 }, // DKI Jakarta
    '32': { lat: -6.9175, lng: 107.6191 }, // West Java (Bandung)
    '33': { lat: -7.7956, lng: 110.3695 }, // Central Java (Yogyakarta)
    '34': { lat: -7.2504, lng: 112.7688 }, // East Java (Surabaya)
    '35': { lat: -8.65, lng: 115.2167 }, // Bali (Denpasar)
    '36': { lat: -6.1745, lng: 106.8227 }, // Banten (Serang)
    // Add more as needed
};

// City/Regency code to coordinates mapping (major cities)
const CITY_COORDINATES: Record<string, Coordinates> = {
    // DKI Jakarta
    '31.71': { lat: -6.2088, lng: 106.8456 }, // Jakarta (Central)
    '31.72': { lat: -6.135, lng: 106.8133 }, // Jakarta North
    '31.73': { lat: -6.2615, lng: 106.7837 }, // Jakarta West
    '31.74': { lat: -6.2648, lng: 106.8443 }, // Jakarta South
    '31.75': { lat: -6.2295, lng: 106.9239 }, // Jakarta East
    '31.76': { lat: -6.3671, lng: 106.8328 }, // Kepulauan Seribu

    // West Java major cities
    '32.01': { lat: -6.5934, lng: 106.7894 }, // Bogor
    '32.02': { lat: -6.2264, lng: 107.0051 }, // Sukabumi
    '32.03': { lat: -6.8168, lng: 108.2049 }, // Cianjur
    '32.04': { lat: -6.9175, lng: 107.6191 }, // Bandung
    '32.73': { lat: -6.9033, lng: 107.6186 }, // Bandung City
    '32.76': { lat: -6.1619, lng: 106.6308 }, // Depok

    // Add more major cities as needed
};

/**
 * Get coordinates for a province code
 */
export function getProvinceCoordinates(provinceCode: string): Coordinates | null {
    return PROVINCE_COORDINATES[provinceCode] || null;
}

/**
 * Get coordinates for a city/regency code
 */
export function getCityCoordinates(cityCode: string): Coordinates | null {
    return CITY_COORDINATES[cityCode] || null;
}

/**
 * Get the best available coordinates from hierarchical address codes
 * Prioritizes: Village > District > City > Province > Default
 */
export function getBestCoordinatesFromCodes(provinceCode?: string, cityCode?: string): Coordinates {
    // Default coordinates (Indonesia center-ish)
    const DEFAULT_COORDS: Coordinates = { lat: -6.2088, lng: 106.8456 }; // Jakarta as default

    // Try city first (most specific available)
    if (cityCode) {
        const cityCoords = getCityCoordinates(cityCode);
        if (cityCoords) return cityCoords;
    }

    // Fallback to province
    if (provinceCode) {
        const provinceCoords = getProvinceCoordinates(provinceCode);
        if (provinceCoords) return provinceCoords;
    }

    // Final fallback
    return DEFAULT_COORDS;
}

/**
 * Get human-readable location string from codes
 * This is a simple implementation - in production you'd want to fetch actual names
 */
export function getLocationStringFromCodes(
    provinceCode?: string,
    cityCode?: string,
    districtCode?: string,
    villageCode?: string,
): string {
    const parts = [];
    if (villageCode) parts.push(`Village ${villageCode}`);
    if (districtCode) parts.push(`District ${districtCode}`);
    if (cityCode) parts.push(`City ${cityCode}`);
    if (provinceCode) parts.push(`Province ${provinceCode}`);

    return parts.join(', ') || 'Indonesia';
}

/**
 * Check if coordinates are likely valid for Indonesia
 */
export function isValidIndonesianCoordinates(lat: number, lng: number): boolean {
    // Indonesia approximate bounds
    // Latitude: -11° to 6°
    // Longitude: 95° to 141°
    return lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141;
}

/**
 * Get map zoom level based on the specificity of the address
 */
export function getAppropriateZoomLevel(
    provinceCode?: string,
    cityCode?: string,
    districtCode?: string,
    villageCode?: string,
): number {
    if (villageCode) return 15; // Village level - high zoom
    if (districtCode) return 13; // District level - medium zoom
    if (cityCode) return 11; // City level - moderate zoom
    if (provinceCode) return 8; // Province level - low zoom
    return 6; // Default - very low zoom (country level)
}
