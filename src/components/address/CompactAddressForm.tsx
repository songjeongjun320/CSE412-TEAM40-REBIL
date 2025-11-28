'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { IndonesianAddress } from './index';

// Types for Supabase Indonesian address data
interface IdnProvince {
    id: string;
    code: string;
    name: string;
}

interface IdnRegency {
    id: string;
    code: string;
    name: string;
    province_code: string;
}

interface IdnDistrict {
    id: string;
    code: string;
    name: string;
    regency_code: string;
}

interface IdnVillage {
    id: string;
    code: string;
    name: string;
    district_code: string;
}

interface CompactAddressFormProps {
    onChange: (address: IndonesianAddress) => void;
    onLocationStringChange?: (locationString: string) => void;
    disabled?: boolean;
    className?: string;
    required?: boolean;
    enableDetailedMode?: boolean; // Enable district and village selection
    initialAddress?: IndonesianAddress | null; // Initial address data
}

export default function CompactAddressForm({
    onChange,
    onLocationStringChange,
    disabled = false,
    className = '',
    enableDetailedMode = false,
    initialAddress = null,
}: CompactAddressFormProps) {
    // State for dropdown data from Supabase Indonesian address tables
    const [provinces, setProvinces] = useState<IdnProvince[]>([]);
    const [cities, setCities] = useState<IdnRegency[]>([]);
    const [districts, setDistricts] = useState<IdnDistrict[]>([]);
    const [villages, setVillages] = useState<IdnVillage[]>([]);

    // Loading states
    const [loading, setLoading] = useState(false);
    const [citiesLoading, setCitiesLoading] = useState(false);
    const [districtsLoading, setDistrictsLoading] = useState(false);
    const [villagesLoading, setVillagesLoading] = useState(false);

    // Initialization state to prevent infinite loops
    const [isInitialized, setIsInitialized] = useState(false);

    // Form state - using nested structure directly
    const [formData, setFormData] = useState<IndonesianAddress>(() => {
        const data = {
            street_address: initialAddress?.street_address || '',
            province: initialAddress?.province || undefined,
            city: initialAddress?.city || undefined,
            district: initialAddress?.district || undefined,
            village: initialAddress?.village || undefined,
            postal_code: initialAddress?.postal_code || '',
        };

        console.log('🔄 CompactAddressForm: Initializing with nested structure:', {
            province: data.province,
            city: data.city,
            district: data.district,
            village: data.village,
        });

        return data;
    });

    // Sort provinces alphabetically
    const sortedProvinces = useMemo(() => {
        return [...provinces].sort((a, b) => a.name.localeCompare(b.name));
    }, [provinces]);

    // Sort cities alphabetically (package doesn't have priority flags)
    const sortedCities = useMemo(() => {
        return [...cities].sort((a, b) => a.name.localeCompare(b.name));
    }, [cities]);

    // Fetch provinces from API
    const fetchProvinces = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/indonesian-data/provinces');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                setProvinces(result.data || []);
            } else {
                throw new Error(result.error);
            }
        } catch {
            setProvinces([]); // Reset on error
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch cities (regencies) from API based on selected province
    const fetchCities = useCallback(async (provinceCode: string) => {
        setCitiesLoading(true);
        setCities([]);
        setDistricts([]);
        setVillages([]);
        try {
            const response = await fetch(
                `/api/indonesian-data/regencies?provinceCode=${provinceCode}`,
            );
            const result = await response.json();

            if (result.success) {
                const citiesData = result.data || [];
                console.log(
                    `🏙️ fetchCities: Loaded ${citiesData.length} cities for province ${provinceCode}`,
                );
                setCities(citiesData);
                return citiesData; // Return the data for immediate use
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error fetching cities:', error);
            return [];
        } finally {
            setCitiesLoading(false);
        }
    }, []);

    // Fetch districts from API based on selected regency
    const fetchDistricts = useCallback(
        async (regencyCode: string) => {
            if (!enableDetailedMode) return [];

            setDistrictsLoading(true);
            setDistricts([]);
            setVillages([]);

            try {
                const response = await fetch(
                    `/api/indonesian-data/districts?regencyCode=${regencyCode}`,
                );
                const result = await response.json();

                if (result.success) {
                    const districtsData = result.data || [];
                    console.log(
                        `🏘️ fetchDistricts: Loaded ${districtsData.length} districts for regency ${regencyCode}`,
                    );
                    setDistricts(districtsData);
                    return districtsData; // Return the data for immediate use
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error fetching districts:', error);
                return [];
            } finally {
                setDistrictsLoading(false);
            }
        },
        [enableDetailedMode],
    );

    // Fetch villages from API based on selected district
    const fetchVillages = useCallback(
        async (districtCode: string) => {
            if (!enableDetailedMode) return [];

            setVillagesLoading(true);
            setVillages([]);

            try {
                const response = await fetch(
                    `/api/indonesian-data/villages?districtCode=${districtCode}`,
                );
                const result = await response.json();

                if (result.success) {
                    const villagesData = result.data || [];
                    console.log(
                        `🏡 fetchVillages: Loaded ${villagesData.length} villages for district ${districtCode}`,
                    );
                    setVillages(villagesData);
                    return villagesData; // Return the data for immediate use
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error fetching villages:', error);
                return [];
            } finally {
                setVillagesLoading(false);
            }
        },
        [enableDetailedMode],
    );

    useEffect(() => {
        fetchProvinces();
    }, [fetchProvinces]);

    // Reset initialization when initialAddress changes
    useEffect(() => {
        setIsInitialized(false);
    }, [initialAddress]);

    // Load initial data based on initialAddress - only once
    useEffect(() => {
        const loadInitialData = async () => {
            if (!initialAddress || isInitialized) {
                return;
            }

            console.log('🔍 CompactAddressForm: Starting initialization with initialAddress');

            // Extract codes from nested structure
            const provinceCode = initialAddress.province?.code;
            const cityCode = initialAddress.city?.code;
            const districtCode = initialAddress.district?.code;
            const villageCode = initialAddress.village?.code;

            console.log('🔍 CompactAddressForm: Loading initial data with extracted codes:', {
                provinceCode,
                cityCode,
                districtCode,
                villageCode,
                enableDetailedMode: enableDetailedMode,
            });

            // If we have a province code, load cities for that province
            if (provinceCode) {
                console.log('🏢 CompactAddressForm: Fetching cities for province:', provinceCode);
                const citiesData = await fetchCities(provinceCode);

                console.log(
                    '📊 CompactAddressForm: Cities loaded, checking if target city exists:',
                    {
                        targetCityCode: cityCode,
                        citiesLoaded: citiesData.length,
                        cityExists: citiesData.some((city: IdnRegency) => city.code === cityCode),
                    },
                );

                // If we have a city code and detailed mode is enabled, load districts
                if (cityCode && enableDetailedMode) {
                    console.log('🏘️ CompactAddressForm: Fetching districts for city:', cityCode);
                    const districtsData = await fetchDistricts(cityCode);

                    console.log(
                        '📊 CompactAddressForm: Districts loaded, checking if target district exists:',
                        {
                            targetDistrictCode: districtCode,
                            districtsLoaded: districtsData.length,
                            districtExists: districtsData.some(
                                (district: IdnDistrict) => district.code === districtCode,
                            ),
                        },
                    );

                    // If we have a district code, load villages
                    if (districtCode) {
                        console.log(
                            '🏡 CompactAddressForm: Fetching villages for district:',
                            districtCode,
                        );
                        const villagesData = await fetchVillages(districtCode);

                        console.log(
                            '📊 CompactAddressForm: Villages loaded, checking if target village exists:',
                            {
                                targetVillageCode: villageCode,
                                villagesLoaded: villagesData.length,
                                villageExists: villagesData.some(
                                    (village: IdnVillage) => village.code === villageCode,
                                ),
                            },
                        );
                    }
                }
            }

            // Mark as initialized to prevent re-runs
            setIsInitialized(true);
            console.log('✅ CompactAddressForm: Initialization completed');
        };

        if (provinces.length > 0 && initialAddress && !isInitialized) {
            loadInitialData();
        }
        // Intentionally excluded fetchCities, fetchDistricts, fetchVillages to prevent infinite re-rendering
        // These functions are stable (memoized with useCallback) and including them causes infinite loops
        // when users type in street address or postal code fields
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAddress, provinces.length, enableDetailedMode, isInitialized]);

    // Handle province selection
    const handleProvinceChange = (provinceCode: string) => {
        const selectedProvince = provinces.find((p) => p.code === provinceCode);

        const newData = {
            ...formData,
            province: selectedProvince
                ? { code: selectedProvince.code, name: selectedProvince.name }
                : undefined,
            city: undefined, // Reset city when province changes
            district: undefined, // Reset district when province changes
            village: undefined, // Reset village when province changes
        };

        setFormData(newData);
        onChange(newData);

        // Update location string and fetch cities
        if (provinceCode && selectedProvince) {
            if (onLocationStringChange) {
                onLocationStringChange(selectedProvince.name);
            }
            fetchCities(provinceCode);
        } else {
            setCities([]);
            setDistricts([]);
            setVillages([]);
            if (onLocationStringChange) {
                onLocationStringChange('');
            }
        }
    };

    // Handle city selection
    const handleCityChange = (regencyCode: string) => {
        const selectedCity = cities.find((c) => c.code === regencyCode);

        const newData = {
            ...formData,
            city: selectedCity ? { code: selectedCity.code, name: selectedCity.name } : undefined,
            district: undefined, // Reset district when city changes
            village: undefined, // Reset village when city changes
        };

        setFormData(newData);
        onChange(newData);

        // Update location string with city and province
        if (regencyCode && selectedCity) {
            if (formData.province && onLocationStringChange) {
                onLocationStringChange(`${selectedCity.name}, ${formData.province.name}`);
            }

            if (enableDetailedMode) {
                fetchDistricts(regencyCode);
            }
        } else {
            setDistricts([]);
            setVillages([]);
        }
    };

    // Handle district selection
    const handleDistrictChange = (districtCode: string) => {
        const selectedDistrict = districts.find((d) => d.code === districtCode);

        const newData = {
            ...formData,
            district: selectedDistrict
                ? { code: selectedDistrict.code, name: selectedDistrict.name }
                : undefined,
            village: undefined, // Reset village when district changes
        };

        setFormData(newData);
        onChange(newData);

        // Update location string with district, city and province
        if (districtCode && selectedDistrict) {
            if (formData.city && formData.province && onLocationStringChange) {
                onLocationStringChange(
                    `${selectedDistrict.name}, ${formData.city.name}, ${formData.province.name}`,
                );
            }

            fetchVillages(districtCode);
        } else {
            setVillages([]);
        }
    };

    // Handle village selection
    const handleVillageChange = (villageCode: string) => {
        const selectedVillage = villages.find((v) => v.code === villageCode);

        const newData = {
            ...formData,
            village: selectedVillage
                ? { code: selectedVillage.code, name: selectedVillage.name }
                : undefined,
        };

        setFormData(newData);
        onChange(newData);

        // Update location string with village, district, city and province
        if (villageCode && selectedVillage) {
            if (formData.district && formData.city && formData.province && onLocationStringChange) {
                onLocationStringChange(
                    `${selectedVillage.name}, ${formData.district.name}, ${formData.city.name}, ${formData.province.name}`,
                );
            }
        }
    };

    // Handlers for text inputs
    const handleStreetAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFormData = {
            ...formData,
            street_address: e.target.value,
        };

        setFormData(newFormData);
        onChange(newFormData);
    };

    const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFormData = {
            ...formData,
            postal_code: e.target.value,
        };

        setFormData(newFormData);
        onChange(newFormData);
    };

    return (
        <div className={className}>
            {/* Province Selection - first position */}
            <div className="lg:order-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>

                <Select
                    value={formData.province?.code || ''}
                    onValueChange={handleProvinceChange}
                    disabled={disabled || loading}
                >
                    <SelectTrigger
                        className={`w-full border-2 focus:ring-2 focus:ring-black focus:border-transparent transition-colors ${
                            disabled || loading
                                ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed'
                                : 'bg-white text-black border-gray-400 hover:border-gray-500'
                        }`}
                    >
                        <SelectValue
                            placeholder={loading ? 'Loading provinces...' : 'Select province'}
                        />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {sortedProvinces.map((province) => (
                            <SelectItem key={`province-${province.code}`} value={province.code}>
                                <div className="flex items-center">
                                    {province.name}
                                    <span className="ml-2 text-xs text-gray-500">
                                        ({province.code})
                                    </span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* City Selection */}
            <div className="lg:order-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">City/Regency</label>

                <Select
                    value={formData.city?.code || ''}
                    onValueChange={handleCityChange}
                    disabled={disabled || citiesLoading || !formData.province?.code}
                >
                    <SelectTrigger
                        disabled={disabled || citiesLoading || !formData.province?.code}
                        className={`w-full border-2 focus:ring-2 focus:ring-black focus:border-transparent transition-colors ${
                            disabled || citiesLoading || !formData.province?.code
                                ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed'
                                : 'bg-white text-black border-gray-400 hover:border-gray-500'
                        }`}
                    >
                        <SelectValue
                            placeholder={
                                !formData.province?.code
                                    ? 'Select province first'
                                    : citiesLoading
                                      ? 'Loading cities...'
                                      : 'Select city/regency'
                            }
                        />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {sortedCities.map((city) => (
                            <SelectItem key={`city-${city.code}`} value={city.code}>
                                <div className="flex items-center justify-between w-full">
                                    <span>{city.name}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                        ({city.code})
                                    </span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {cities.length === 0 && formData.province?.code && !citiesLoading && (
                    <p className="text-xs text-gray-500 mt-1">
                        No cities available for this province
                    </p>
                )}
            </div>

            {/* District Selection - always shown in detailed mode */}
            {enableDetailedMode && (
                <div className="lg:order-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        District (Kecamatan)
                    </label>

                    <Select
                        value={formData.district?.code || ''}
                        onValueChange={handleDistrictChange}
                        disabled={disabled || districtsLoading || !formData.city?.code}
                    >
                        <SelectTrigger
                            disabled={disabled || districtsLoading || !formData.city?.code}
                            className={`w-full border-2 focus:ring-2 focus:ring-black focus:border-transparent transition-colors ${
                                disabled || districtsLoading || !formData.city?.code
                                    ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed'
                                    : 'bg-white text-black border-gray-400 hover:border-gray-500'
                            }`}
                        >
                            <SelectValue
                                placeholder={
                                    !formData.city?.code
                                        ? 'Select city first'
                                        : districtsLoading
                                          ? 'Loading districts...'
                                          : 'Select district (optional)'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {districts.map((district) => (
                                <SelectItem key={`district-${district.code}`} value={district.code}>
                                    <div className="flex items-center justify-between w-full">
                                        <span>{district.name}</span>
                                        <span className="text-xs text-gray-500 ml-2">
                                            ({district.code})
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {districts.length === 0 && formData.city?.code && !districtsLoading && (
                        <p className="text-xs text-gray-500 mt-1">
                            No districts available for this city
                        </p>
                    )}
                </div>
            )}

            {/* Village Selection - always shown in detailed mode */}
            {enableDetailedMode && (
                <div className="lg:order-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Village (Desa/Kelurahan)
                    </label>
                    <Select
                        value={formData.village?.code || ''}
                        onValueChange={handleVillageChange}
                        disabled={disabled || villagesLoading || !formData.district?.code}
                    >
                        <SelectTrigger
                            disabled={disabled || villagesLoading || !formData.district?.code}
                            className={`w-full border-2 focus:ring-2 focus:ring-black focus:border-transparent transition-colors ${
                                disabled || villagesLoading || !formData.district?.code
                                    ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed'
                                    : 'bg-white text-black border-gray-400 hover:border-gray-500'
                            }`}
                        >
                            <SelectValue
                                placeholder={
                                    !formData.district?.code
                                        ? 'Select district first'
                                        : villagesLoading
                                          ? 'Loading villages...'
                                          : 'Select village (optional)'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {villages.map((village) => (
                                <SelectItem key={`village-${village.code}`} value={village.code}>
                                    <div className="flex items-center justify-between w-full">
                                        <span>{village.name}</span>
                                        <span className="text-xs text-gray-500 ml-2">
                                            ({village.code})
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {villages.length === 0 && formData.district?.code && !villagesLoading && (
                        <p className="text-xs text-gray-500 mt-1">
                            No villages available for this district
                        </p>
                    )}
                </div>
            )}

            {/* Street Address */}
            <div className="lg:order-5">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    Street Address
                </label>
                <Input
                    value={formData.street_address}
                    onChange={handleStreetAddressChange}
                    placeholder="Enter your street address"
                    disabled={disabled}
                    className="w-full border-2 focus:ring-2 focus:ring-black focus:border-transparent transition-colors bg-white text-black border-gray-400 hover:border-gray-500"
                />
            </div>

            {/* Postal Code */}
            <div className="lg:order-6">
                <label className="block text-xs font-medium text-gray-600 mb-1">Postal Code</label>
                <Input
                    value={formData.postal_code || ''}
                    onChange={handlePostalCodeChange}
                    placeholder="Enter postal code"
                    disabled={disabled}
                    className="w-full border-2 focus:ring-2 focus:ring-black focus:border-transparent transition-colors bg-white text-black border-gray-400 hover:border-gray-500"
                />
            </div>
        </div>
    );
}
