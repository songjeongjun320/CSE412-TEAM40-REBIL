export interface LatLng {
    lat: number;
    lng: number;
}

// Normalized mapping of major Indonesian cities to coordinates
// Extend as needed; prefer using Google Geocoding when API key is available
const CITY_COORDINATES: Record<string, LatLng> = {
    // Major cities
    jakarta: { lat: -6.2088, lng: 106.8456 },
    surabaya: { lat: -7.2575, lng: 112.7521 },
    bandung: { lat: -6.9175, lng: 107.6191 },
    medan: { lat: 3.5952, lng: 98.6722 },
    semarang: { lat: -6.9667, lng: 110.4167 },
    makassar: { lat: -5.1477, lng: 119.4327 },
    palembang: { lat: -2.9761, lng: 104.7754 },
    tangerang: { lat: -6.1783, lng: 106.6319 },
    depok: { lat: -6.4025, lng: 106.7942 },
    bogor: { lat: -6.595, lng: 106.8166 },
    yogyakarta: { lat: -7.7956, lng: 110.3695 },
    denpasar: { lat: -8.6705, lng: 115.2126 },
    bali: { lat: -8.3405, lng: 115.092 },

    // Additional popular cities
    bekasi: { lat: -6.2383, lng: 106.9756 },
    malang: { lat: -7.9666, lng: 112.6326 },
    solo: { lat: -7.5755, lng: 110.8243 },
    surakarta: { lat: -7.5755, lng: 110.8243 }, // Same as Solo
    padang: { lat: -0.9471, lng: 100.4172 },
    pekanbaru: { lat: 0.5333, lng: 101.45 },
    balikpapan: { lat: -1.2675, lng: 116.8289 },
    samarinda: { lat: -0.5022, lng: 117.1536 },
    pontianak: { lat: -0.0263, lng: 109.3425 },
    banjarmasin: { lat: -3.3194, lng: 114.5906 },
    manado: { lat: 1.4748, lng: 124.8421 },
    batam: { lat: 1.1307, lng: 104.053 },
    'bandar lampung': { lat: -5.3971, lng: 105.2669 },
    lampung: { lat: -5.3971, lng: 105.2669 }, // Same as Bandar Lampung
    jambi: { lat: -1.6101, lng: 103.6131 },
    bengkulu: { lat: -3.7928, lng: 102.2607 },
    mataram: { lat: -8.5833, lng: 116.1167 },
    kupang: { lat: -10.1718, lng: 123.6075 },

    // Java cities variations
    'kota jakarta': { lat: -6.2088, lng: 106.8456 },
    'kota bandung': { lat: -6.9175, lng: 107.6191 },
    'kota surabaya': { lat: -7.2575, lng: 112.7521 },
    'kota semarang': { lat: -6.9667, lng: 110.4167 },
    'kota yogyakarta': { lat: -7.7956, lng: 110.3695 },
    'kota malang': { lat: -7.9666, lng: 112.6326 },

    // Common alternative names
    jogja: { lat: -7.7956, lng: 110.3695 }, // Yogyakarta
    dps: { lat: -8.6705, lng: 115.2126 }, // Denpasar
    jkt: { lat: -6.2088, lng: 106.8456 }, // Jakarta
    sby: { lat: -7.2575, lng: 112.7521 }, // Surabaya
    bdg: { lat: -6.9175, lng: 107.6191 }, // Bandung
};

function normalizeCityName(name: string): string {
    return name.trim().toLowerCase();
}

/**
 * Resolve coordinates for a given city name using a local mapping.
 * Accepts inputs like "City", "City, Province" and tries the city part.
 */
export function getCityCoordinatesByName(cityOrAddress: string | any): LatLng | null {
    // Type safety check - ensure we have a valid string
    if (!cityOrAddress || typeof cityOrAddress !== 'string') return null;

    // Try exact city (before comma)
    const cityOnly = cityOrAddress.split(',')[0];
    const key = normalizeCityName(cityOnly);
    if (CITY_COORDINATES[key]) return CITY_COORDINATES[key];

    // Try splitting by spaces, prefer longer tokens last (e.g., "bali denpasar" -> try "denpasar" then "bali")
    const tokens = key.split(/\s+/).filter(Boolean);
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        if (CITY_COORDINATES[token]) return CITY_COORDINATES[token];
    }

    return null;
}

/**
 * Try resolving coordinates via Google Geocoding API if key is available
 */
export async function geocodeCityWithGoogle(cityOrAddress: string | any): Promise<LatLng | null> {
    // Type safety check
    if (!cityOrAddress || typeof cityOrAddress !== 'string') return null;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;
    const q = encodeURIComponent(`${cityOrAddress}, Indonesia`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results[0]) {
            const loc = data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Resolve a city to coordinates using local mapping first, then Google Geocoding if available.
 */
export async function resolveCityCoordinates(cityOrAddress: string | any): Promise<LatLng | null> {
    // Type safety check
    if (!cityOrAddress || typeof cityOrAddress !== 'string') return null;

    const local = getCityCoordinatesByName(cityOrAddress);
    if (local) return local;
    return await geocodeCityWithGoogle(cityOrAddress);
}

export const DEFAULT_CENTER: LatLng = { lat: -6.2088, lng: 106.8456 }; // Jakarta
