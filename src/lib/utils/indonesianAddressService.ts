import { createClient } from '@/lib/supabase/supabaseClient';

// Types for Indonesian address data
export interface IndonesianProvince {
    id: string;
    name: string;
    code: string;
}

export interface IndonesianRegency {
    id: string;
    name: string;
    code: string;
    province_id: string;
}

export interface IndonesianDistrict {
    id: string;
    name: string;
    code: string;
    regency_id: string;
}

export interface IndonesianVillage {
    id: string;
    name: string;
    code: string;
    district_id: string;
}

// Enhanced types for flexible location search
export interface FlexibleLocationResult {
    id: string;
    name: string;
    type: 'province' | 'regency' | 'district' | 'village';
    fullPath: string; // e.g., "Jakarta, DKI Jakarta" or "Bandung, Jawa Barat"
    displayText: string; // Optimized display text for UI
    hierarchy: {
        province?: { id: string; name: string; code?: string };
        regency?: { id: string; name: string; code?: string };
        district?: { id: string; name: string; code?: string };
        village?: { id: string; name: string; code?: string };
    };
    searchConditions: Record<string, string>; // For vehicle search queries
}

// Service class for Indonesian address operations
export class IndonesianAddressService {
    private supabase = createClient();

    /**
     * Get all provinces
     */
    async getProvinces(): Promise<IndonesianProvince[]> {
        const { data, error } = await this.supabase
            .from('indonesian_provinces')
            .select('id, name, code')
            .order('code');

        if (error) {
            console.error('Error fetching provinces:', error);
            throw new Error(`Failed to fetch provinces: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get regencies by province ID (correct FK relationship)
     */
    async getRegenciesByProvinceId(provinceId: string): Promise<IndonesianRegency[]> {
        const { data, error } = await this.supabase
            .from('indonesian_regencies')
            .select('id, name, code, province_id')
            .eq('province_id', provinceId)
            .order('code');

        if (error) {
            console.error('Error fetching regencies:', error);
            throw new Error('Failed to fetch regencies');
        }

        return data || [];
    }

    /**
     * Get regencies by province code (backward compatibility)
     */
    async getRegenciesByProvinceCode(provinceCode: string): Promise<IndonesianRegency[]> {
        // First find province by code
        const province = await this.getProvinceByCode(provinceCode);
        if (!province) {
            throw new Error(`Province not found for code: ${provinceCode}`);
        }

        return this.getRegenciesByProvinceId(province.id);
    }

    /**
     * Get all regencies (for compatibility)
     */
    async getAllRegencies(): Promise<IndonesianRegency[]> {
        const { data, error } = await this.supabase
            .from('indonesian_regencies')
            .select('id, name, code, province_id')
            .order('code');

        if (error) {
            console.error('Error fetching all regencies:', error);
            throw new Error('Failed to fetch all regencies');
        }

        return data || [];
    }

    /**
     * Get districts by regency ID (correct FK relationship)
     */
    async getDistrictsByRegencyId(regencyId: string): Promise<IndonesianDistrict[]> {
        const { data, error } = await this.supabase
            .from('indonesian_districts')
            .select('id, name, code, regency_id')
            .eq('regency_id', regencyId)
            .order('code');

        if (error) {
            console.error('Error fetching districts:', error);
            throw new Error('Failed to fetch districts');
        }

        return data || [];
    }

    /**
     * Get districts by regency code (backward compatibility)
     */
    async getDistrictsByRegencyCode(regencyCode: string): Promise<IndonesianDistrict[]> {
        // First find regency by code
        const regency = await this.getRegencyByCode(regencyCode);
        if (!regency) {
            throw new Error(`Regency not found for code: ${regencyCode}`);
        }

        return this.getDistrictsByRegencyId(regency.id);
    }

    /**
     * Get all districts (for compatibility)
     */
    async getAllDistricts(): Promise<IndonesianDistrict[]> {
        const { data, error } = await this.supabase
            .from('indonesian_districts')
            .select('id, name, code, regency_id')
            .order('code');

        if (error) {
            console.error('Error fetching all districts:', error);
            throw new Error('Failed to fetch all districts');
        }

        return data || [];
    }

    /**
     * Get villages by district ID (correct FK relationship)
     */
    async getVillagesByDistrictId(districtId: string): Promise<IndonesianVillage[]> {
        const { data, error } = await this.supabase
            .from('indonesian_villages')
            .select('id, name, code, district_id')
            .eq('district_id', districtId)
            .order('code');

        if (error) {
            console.error('Error fetching villages:', error);
            throw new Error('Failed to fetch villages');
        }

        return data || [];
    }

    /**
     * Get villages by district code (backward compatibility)
     */
    async getVillagesByDistrictCode(districtCode: string): Promise<IndonesianVillage[]> {
        // First find district by code
        const district = await this.getDistrictByCode(districtCode);
        if (!district) {
            throw new Error(`District not found for code: ${districtCode}`);
        }

        return this.getVillagesByDistrictId(district.id);
    }

    /**
     * Get all villages (for compatibility)
     */
    async getAllVillages(): Promise<IndonesianVillage[]> {
        const { data, error } = await this.supabase
            .from('indonesian_villages')
            .select('id, name, code, district_id')
            .order('code');

        if (error) {
            console.error('Error fetching all villages:', error);
            throw new Error('Failed to fetch all villages');
        }

        return data || [];
    }

    /**
     * Get province by code
     */
    async getProvinceByCode(code: string): Promise<IndonesianProvince | null> {
        const { data, error } = await this.supabase
            .from('indonesian_provinces')
            .select('id, name, code')
            .eq('code', code)
            .single();

        if (error) {
            console.error('Error fetching province by code:', error);
            return null;
        }

        return data;
    }

    /**
     * Get regency by code
     */
    async getRegencyByCode(code: string): Promise<IndonesianRegency | null> {
        const { data, error } = await this.supabase
            .from('indonesian_regencies')
            .select('id, name, code, province_id')
            .eq('code', code)
            .single();

        if (error) {
            console.error('Error fetching regency by code:', error);
            return null;
        }

        return data;
    }

    /**
     * Get district by code
     */
    async getDistrictByCode(code: string): Promise<IndonesianDistrict | null> {
        const { data, error } = await this.supabase
            .from('indonesian_districts')
            .select('id, name, code, regency_id')
            .eq('code', code)
            .single();

        if (error) {
            console.error('Error fetching district by code:', error);
            return null;
        }

        return data;
    }

    /**
     * Get village by code
     */
    async getVillageByCode(code: string): Promise<IndonesianVillage | null> {
        const { data, error } = await this.supabase
            .from('indonesian_villages')
            .select('id, name, code, district_id')
            .eq('code', code)
            .single();

        if (error) {
            console.error('Error fetching village by code:', error);
            return null;
        }

        return data;
    }

    /**
     * Search locations by name (for autocomplete)
     */
    async searchLocations(query: string, type?: 'province' | 'regency' | 'district' | 'village') {
        const results: any[] = [];

        if (!type || type === 'province') {
            const { data: provinces } = await this.supabase
                .from('indonesian_provinces')
                .select('id, name, code')
                .ilike('name', `%${query}%`)
                .limit(10);

            if (provinces) {
                results.push(...provinces.map((p) => ({ ...p, type: 'province' })));
            }
        }

        if (!type || type === 'regency') {
            const { data: regencies } = await this.supabase
                .from('indonesian_regencies')
                .select('id, name, code, province_id')
                .ilike('name', `%${query}%`)
                .limit(10);

            if (regencies) {
                results.push(...regencies.map((r) => ({ ...r, type: 'regency' })));
            }
        }

        if (!type || type === 'district') {
            const { data: districts } = await this.supabase
                .from('indonesian_districts')
                .select('id, name, code, regency_id')
                .ilike('name', `%${query}%`)
                .limit(10);

            if (districts) {
                results.push(...districts.map((d) => ({ ...d, type: 'district' })));
            }
        }

        if (!type || type === 'village') {
            const { data: villages } = await this.supabase
                .from('indonesian_villages')
                .select('id, name, code, district_id')
                .ilike('name', `%${query}%`)
                .limit(10);

            if (villages) {
                results.push(...villages.map((v) => ({ ...v, type: 'village' })));
            }
        }

        return results;
    }

    /**
     * Enhanced flexible search for "where are you traveling" functionality
     * Simplified to return only regency/city names for Google Maps integration
     */
    async flexibleLocationSearch(
        query: string,
        limit: number = 10,
    ): Promise<FlexibleLocationResult[]> {
        if (!query || query.trim().length < 2) {
            return [];
        }

        const normalizedQuery = query.trim().toLowerCase();

        try {
            // Search only regencies (cities) for simplicity
            const { data, error } = await this.supabase
                .from('indonesian_regencies')
                .select('*')
                .ilike('name', `%${normalizedQuery}%`)
                .limit(limit);

            if (error) {
                console.error('Error in flexible location search:', error);
                return [];
            }

            return (data || []).map((regency) => ({
                id: regency.id,
                name: regency.name,
                type: 'regency' as const,
                fullPath: regency.name,
                displayText: regency.name,
                hierarchy: {
                    regency: {
                        id: regency.id,
                        name: regency.name,
                        code: regency.code,
                    },
                },
                searchConditions: {
                    'location->city_id': regency.id,
                },
            }));
        } catch (error) {
            console.error('Error in flexible location search:', error);
            return [];
        }
    }

    private async searchProvincesWithHierarchy(query: string): Promise<FlexibleLocationResult[]> {
        const { data, error } = await this.supabase
            .from('indonesian_provinces')
            .select('*')
            .ilike('name', `%${query}%`)
            .limit(5);

        if (error) {
            console.error('Error searching provinces with hierarchy:', error);
            return [];
        }

        return (data || []).map((province) => ({
            id: province.id,
            name: province.name,
            type: 'province' as const,
            fullPath: province.name,
            displayText: province.name,
            hierarchy: {
                province: {
                    id: province.id,
                    name: province.name,
                    code: province.code,
                },
            },
            searchConditions: {
                'location->province_id': province.id,
            },
        }));
    }

    private async searchRegenciesWithHierarchy(query: string): Promise<FlexibleLocationResult[]> {
        const { data, error } = await this.supabase
            .from('indonesian_regencies')
            .select(
                `
                *,
                indonesian_provinces!province_id(id, name, code)
            `,
            )
            .ilike('name', `%${query}%`)
            .limit(5);

        if (error) {
            console.error('Error searching regencies with hierarchy:', error);
            console.error('Full error details:', JSON.stringify(error, null, 2));
            return [];
        }

        // DEBUG: 실제 데이터 구조 확인
        console.log('🔍 REGENCY DEBUG - Raw data from Supabase:', JSON.stringify(data, null, 2));
        console.log('🔍 REGENCY DEBUG - First item structure:', data?.[0]);
        if (data?.[0]) {
            console.log('🔍 REGENCY DEBUG - Province data:', data[0].indonesian_provinces);
        }

        return (data || []).map((regency) => {
            // DEBUG: 각 regency 매핑 전 구조 확인
            console.log('🔍 REGENCY MAPPING - Processing regency:', regency.name);
            console.log('🔍 REGENCY MAPPING - Province access:', regency.indonesian_provinces);

            return {
                id: regency.id,
                name: regency.name,
                type: 'regency' as const,
                fullPath: `${regency.name}, ${regency.indonesian_provinces.name}`,
                displayText: `${regency.name}, ${regency.indonesian_provinces.name}`,
                hierarchy: {
                    province: {
                        id: regency.indonesian_provinces.id,
                        name: regency.indonesian_provinces.name,
                        code: regency.indonesian_provinces.code,
                    },
                    regency: {
                        id: regency.id,
                        name: regency.name,
                        code: regency.code,
                    },
                },
                searchConditions: {
                    'location->city_id': regency.id,
                },
            };
        });
    }

    private async searchDistrictsWithHierarchy(query: string): Promise<FlexibleLocationResult[]> {
        const { data, error } = await this.supabase
            .from('indonesian_districts')
            .select(
                `
                *,
                indonesian_regencies!regency_id(
                    id, name, code,
                    indonesian_provinces!province_id(id, name, code)
                )
            `,
            )
            .ilike('name', `%${query}%`)
            .limit(5);

        if (error) {
            console.error('Error searching districts with hierarchy:', error);
            console.error('Full error details:', JSON.stringify(error, null, 2));
            return [];
        }

        // DEBUG: 실제 데이터 구조 확인
        console.log('🔍 DISTRICT DEBUG - Raw data from Supabase:', JSON.stringify(data, null, 2));
        console.log('🔍 DISTRICT DEBUG - First item structure:', data?.[0]);
        if (data?.[0]) {
            console.log('🔍 DISTRICT DEBUG - Regency data:', data[0].indonesian_regencies);
            console.log(
                '🔍 DISTRICT DEBUG - Province data:',
                data[0].indonesian_regencies?.indonesian_provinces,
            );
        }

        return (data || []).map((district) => {
            // DEBUG: 각 district 매핑 전 구조 확인
            console.log('🔍 DISTRICT MAPPING - Processing district:', district.name);
            console.log('🔍 DISTRICT MAPPING - Regency access:', district.indonesian_regencies);

            return {
                id: district.id,
                name: district.name,
                type: 'district' as const,
                fullPath: `${district.name}, ${district.indonesian_regencies.name}, ${district.indonesian_regencies.indonesian_provinces.name}`,
                displayText: `${district.name}, ${district.indonesian_regencies.name}`,
                hierarchy: {
                    province: {
                        id: district.indonesian_regencies.indonesian_provinces.id,
                        name: district.indonesian_regencies.indonesian_provinces.name,
                        code: district.indonesian_regencies.indonesian_provinces.code,
                    },
                    regency: {
                        id: district.indonesian_regencies.id,
                        name: district.indonesian_regencies.name,
                        code: district.indonesian_regencies.code,
                    },
                    district: {
                        id: district.id,
                        name: district.name,
                        code: district.code,
                    },
                },
                searchConditions: {
                    'location->district_id': district.id,
                },
            };
        });
    }

    private async searchVillagesWithHierarchy(query: string): Promise<FlexibleLocationResult[]> {
        const { data, error } = await this.supabase
            .from('indonesian_villages')
            .select(
                `
                *,
                indonesian_districts!district_id(
                    id, name, code,
                    indonesian_regencies!regency_id(
                        id, name, code,
                        indonesian_provinces!province_id(id, name, code)
                    )
                )
            `,
            )
            .ilike('name', `%${query}%`)
            .limit(5);

        if (error) {
            console.error('Error searching villages with hierarchy:', error);
            console.error('Full error details:', JSON.stringify(error, null, 2));
            return [];
        }

        // DEBUG: 실제 데이터 구조 확인
        console.log('🔍 VILLAGE DEBUG - Raw data from Supabase:', JSON.stringify(data, null, 2));
        console.log('🔍 VILLAGE DEBUG - First item structure:', data?.[0]);
        if (data?.[0]) {
            console.log('🔍 VILLAGE DEBUG - District data:', data[0].indonesian_districts);
            console.log(
                '🔍 VILLAGE DEBUG - Regency data:',
                data[0].indonesian_districts?.indonesian_regencies,
            );
            console.log(
                '🔍 VILLAGE DEBUG - Province data:',
                data[0].indonesian_districts?.indonesian_regencies?.indonesian_provinces,
            );
        }

        return (data || []).map((village) => {
            // DEBUG: 각 village 매핑 전 구조 확인
            console.log('🔍 VILLAGE MAPPING - Processing village:', village.name);
            console.log('🔍 VILLAGE MAPPING - District access:', village.indonesian_districts);

            return {
                id: village.id,
                name: village.name,
                type: 'village' as const,
                fullPath: `${village.name}, ${village.indonesian_districts.name}, ${village.indonesian_districts.indonesian_regencies.name}, ${village.indonesian_districts.indonesian_regencies.indonesian_provinces.name}`,
                displayText: `${village.name}, ${village.indonesian_districts.name}, ${village.indonesian_districts.indonesian_regencies.name}`,
                hierarchy: {
                    province: {
                        id: village.indonesian_districts.indonesian_regencies.indonesian_provinces
                            .id,
                        name: village.indonesian_districts.indonesian_regencies.indonesian_provinces
                            .name,
                        code: village.indonesian_districts.indonesian_regencies.indonesian_provinces
                            .code,
                    },
                    regency: {
                        id: village.indonesian_districts.indonesian_regencies.id,
                        name: village.indonesian_districts.indonesian_regencies.name,
                        code: village.indonesian_districts.indonesian_regencies.code,
                    },
                    district: {
                        id: village.indonesian_districts.id,
                        name: village.indonesian_districts.name,
                        code: village.indonesian_districts.code,
                    },
                    village: {
                        id: village.id,
                        name: village.name,
                        code: village.code,
                    },
                },
                searchConditions: {
                    'location->village_id': village.id,
                },
            };
        });
    }

    private sortAndLimitFlexibleResults(
        results: FlexibleLocationResult[],
        query: string,
        limit: number,
    ): FlexibleLocationResult[] {
        // Sort by relevance: exact matches first, then partial matches
        const sorted = results.sort((a, b) => {
            const aExact = a.name.toLowerCase() === query;
            const bExact = b.name.toLowerCase() === query;

            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = a.name.toLowerCase().startsWith(query);
            const bStarts = b.name.toLowerCase().startsWith(query);

            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            // Prefer higher-level locations (provinces > regencies > districts > villages)
            const typeOrder = { province: 1, regency: 2, district: 3, village: 4 };
            return typeOrder[a.type] - typeOrder[b.type];
        });

        return sorted.slice(0, limit);
    }

    /**
     * Get popular travel destinations - simplified for Google Maps
     */
    async getPopularDestinations(limit: number = 10): Promise<FlexibleLocationResult[]> {
        try {
            const popularCities = [
                'Jakarta',
                'Surabaya',
                'Bandung',
                'Medan',
                'Semarang',
                'Makassar',
                'Palembang',
                'Tangerang',
                'Depok',
                'Bogor',
            ];

            const results: FlexibleLocationResult[] = [];

            for (const cityName of popularCities.slice(0, limit)) {
                // Search for the city in regencies table
                const { data, error } = await this.supabase
                    .from('indonesian_regencies')
                    .select('*')
                    .ilike('name', `%${cityName}%`)
                    .limit(1);

                if (!error && data && data.length > 0) {
                    const regency = data[0];
                    results.push({
                        id: regency.id,
                        name: regency.name,
                        type: 'regency' as const,
                        fullPath: regency.name,
                        displayText: regency.name,
                        hierarchy: {
                            regency: {
                                id: regency.id,
                                name: regency.name,
                                code: regency.code,
                            },
                        },
                        searchConditions: {
                            'location->city_id': regency.id,
                        },
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error getting popular destinations:', error);
            return [];
        }
    }
}

// Export singleton instance
export const indonesianAddressService = new IndonesianAddressService();

// Export individual functions for backward compatibility
export const getProvinces = () => indonesianAddressService.getProvinces();
export const getRegencies = (options?: { provinceCode?: string; provinceId?: string }) => {
    if (options?.provinceId) {
        return indonesianAddressService.getRegenciesByProvinceId(options.provinceId);
    } else if (options?.provinceCode) {
        return indonesianAddressService.getRegenciesByProvinceCode(options.provinceCode);
    } else {
        return indonesianAddressService.getAllRegencies();
    }
};
export const getDistricts = (options?: { regencyCode?: string; regencyId?: string }) => {
    if (options?.regencyId) {
        return indonesianAddressService.getDistrictsByRegencyId(options.regencyId);
    } else if (options?.regencyCode) {
        return indonesianAddressService.getDistrictsByRegencyCode(options.regencyCode);
    } else {
        return indonesianAddressService.getAllDistricts();
    }
};
export const getVillages = (options?: { districtCode?: string; districtId?: string }) => {
    if (options?.districtId) {
        return indonesianAddressService.getVillagesByDistrictId(options.districtId);
    } else if (options?.districtCode) {
        return indonesianAddressService.getVillagesByDistrictCode(options.districtCode);
    } else {
        return indonesianAddressService.getAllVillages();
    }
};
