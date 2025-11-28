import { createClient } from '@/lib/supabase/supabaseClient';

import {
    IndonesianDistrict,
    IndonesianProvince,
    IndonesianRegency,
    IndonesianVillage,
    indonesianAddressService,
} from './indonesianAddressService';

// Compatibility aliases for existing code
type IdnProvince = IndonesianProvince;
type IdnRegency = IndonesianRegency;
type IdnDistrict = IndonesianDistrict;
type IdnVillage = IndonesianVillage;

// Types for existing database
// interface DbProvince {
//     id: string;
//     name: string;
//     code: string;
//     island_group: string;
//     is_special_region: boolean;
// }

// interface DbCity {
//     id: string;
//     name: string;
//     type: string;
//     is_capital: boolean;
//     is_major_city: boolean;
//     population?: number;
// }

// Mapping result types
export interface ProvinceMapping {
    uuid: string;
    governmentCode: string;
    dbName: string;
    idnName: string;
    matchConfidence: number;
}

export interface CityMapping {
    uuid: string;
    governmentCode: string;
    dbName: string;
    idnName: string;
    provinceUuid: string;
    matchConfidence: number;
}

/**
 * Normalize Indonesian place names for better matching
 */
export function normalizeName(name: string): string {
    return name
        .toUpperCase()
        .replace(/^(KABUPATEN|KOTA|PROVINSI)\s+/, '') // Remove administrative prefixes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

/**
 * Calculate name similarity score between two strings
 */
export function calculateSimilarity(name1: string, name2: string): number {
    const norm1 = normalizeName(name1);
    const norm2 = normalizeName(name2);

    if (norm1 === norm2) return 1.0;

    // Check if one is contained in the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;

    // Simple word overlap calculation
    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');
    const commonWords = words1.filter((word) => words2.includes(word));

    return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Map existing database provinces to Supabase Indonesian provinces
 */
export async function mapProvincesToGovernmentCodes(): Promise<ProvinceMapping[]> {
    try {
        const supabase = createClient();
        const idnProvinces = await indonesianAddressService.getProvinces();

        const { data: dbProvinces, error } = await supabase
            .from('indonesian_provinces')
            .select('*');

        if (error) throw error;

        const mappings: ProvinceMapping[] = [];

        for (const dbProvince of dbProvinces || []) {
            let bestMatch: IdnProvince | null = null;
            let bestScore = 0;

            for (const idnProvince of idnProvinces) {
                const similarity = calculateSimilarity(dbProvince.name, idnProvince.name);
                if (similarity > bestScore) {
                    bestScore = similarity;
                    bestMatch = idnProvince;
                }
            }

            if (bestMatch && bestScore > 0.7) {
                mappings.push({
                    uuid: dbProvince.id,
                    governmentCode: bestMatch.code,
                    dbName: dbProvince.name,
                    idnName: bestMatch.name,
                    matchConfidence: bestScore,
                });
            }
        }

        return mappings;
    } catch (error) {
        console.error('Error mapping provinces:', error);
        throw error;
    }
}

/**
 * Map existing database cities to Supabase Indonesian regencies
 */
export async function mapCitiesToGovernmentCodes(): Promise<CityMapping[]> {
    try {
        const supabase = createClient();
        const idnRegencies = await indonesianAddressService.getAllRegencies();
        const provinceMappings = await mapProvincesToGovernmentCodes();

        const { data: dbCities, error } = await supabase.rpc('get_cities_by_province', {
            province_identifier: null, // Get all cities
        });

        if (error) throw error;

        const mappings: CityMapping[] = [];

        for (const dbCity of dbCities || []) {
            let bestMatch: IdnRegency | null = null;
            let bestScore = 0;

            // Find province mapping first to narrow search
            const provinceMapping = provinceMappings.find((p) => p.uuid === dbCity.province_id);
            const targetRegencies = provinceMapping
                ? idnRegencies.filter((r) => r.province_id === provinceMapping.uuid)
                : idnRegencies;

            for (const idnRegency of targetRegencies) {
                const similarity = calculateSimilarity(dbCity.name, idnRegency.name);
                if (similarity > bestScore) {
                    bestScore = similarity;
                    bestMatch = idnRegency;
                }
            }

            if (bestMatch && bestScore > 0.6) {
                mappings.push({
                    uuid: dbCity.id,
                    governmentCode: bestMatch.code,
                    dbName: dbCity.name,
                    idnName: bestMatch.name,
                    provinceUuid: dbCity.province_id,
                    matchConfidence: bestScore,
                });
            }
        }

        return mappings;
    } catch (error) {
        console.error('Error mapping cities:', error);
        throw error;
    }
}

/**
 * Get districts by city UUID using government code mapping
 */
export async function getDistrictsByCity(cityUuid: string): Promise<IdnDistrict[]> {
    try {
        const cityMappings = await mapCitiesToGovernmentCodes();
        const cityMapping = cityMappings.find((m) => m.uuid === cityUuid);

        if (!cityMapping) {
            console.warn(`No government code mapping found for city UUID: ${cityUuid}`);
            return [];
        }

        // Find regency by government code first
        const regency = await indonesianAddressService.getRegencyByCode(cityMapping.governmentCode);
        if (!regency) {
            console.warn(`No regency found for government code: ${cityMapping.governmentCode}`);
            return [];
        }

        // Get districts by regency_id
        return await indonesianAddressService.getDistrictsByRegencyId(regency.id);
    } catch (error) {
        console.error('Error getting districts by city:', error);
        return [];
    }
}

/**
 * Get villages by district code
 */
export async function getVillagesByDistrict(districtCode: string): Promise<IdnVillage[]> {
    try {
        // Find district by code first
        const district = await indonesianAddressService.getDistrictByCode(districtCode);
        if (!district) {
            console.warn(`No district found for code: ${districtCode}`);
            return [];
        }

        // Get villages by district_id
        return await indonesianAddressService.getVillagesByDistrictId(district.id);
    } catch (error) {
        console.error('Error getting villages by district:', error);
        return [];
    }
}

/**
 * Find district by government code
 */
export async function findDistrictByCode(code: string): Promise<IdnDistrict | null> {
    try {
        const allDistricts = await indonesianAddressService.getAllDistricts();
        return allDistricts.find((district) => district.code === code) || null;
    } catch (error) {
        console.error('Error finding district by code:', error);
        return null;
    }
}

/**
 * Find village by government code
 */
export async function findVillageByCode(code: string): Promise<IdnVillage | null> {
    try {
        const allVillages = await indonesianAddressService.getAllVillages();
        return allVillages.find((village) => village.code === code) || null;
    } catch (error) {
        console.error('Error finding village by code:', error);
        return null;
    }
}

/**
 * Get comprehensive mapping statistics
 */
export async function getMappingStatistics() {
    try {
        const [provinceMappings, cityMappings] = await Promise.all([
            mapProvincesToGovernmentCodes(),
            mapCitiesToGovernmentCodes(),
        ]);

        const supabase = createClient();
        const { data: totalProvinces } = await supabase
            .from('indonesian_provinces')
            .select('id', { count: 'exact' });
        const { data: totalCities } = await supabase
            .from('indonesian_regencies')
            .select('id', { count: 'exact' });

        const result = {
            provinces: {
                total: totalProvinces?.length || 0,
                mapped: provinceMappings.length,
                coverage: provinceMappings.length / (totalProvinces?.length || 1),
                averageConfidence:
                    provinceMappings.reduce((sum, m) => sum + m.matchConfidence, 0) /
                    provinceMappings.length,
            },
            cities: {
                total: totalCities?.length || 0,
                mapped: cityMappings.length,
                coverage: cityMappings.length / (totalCities?.length || 1),
                averageConfidence:
                    cityMappings.reduce((sum, m) => sum + m.matchConfidence, 0) /
                    cityMappings.length,
            },
        };
        return result;
    } catch (error) {
        console.error('Error getting mapping statistics:', error);
        throw error;
    }
}

export type MappingStatistics = Awaited<ReturnType<typeof getMappingStatistics>>;
