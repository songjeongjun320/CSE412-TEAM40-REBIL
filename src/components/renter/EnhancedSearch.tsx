'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

import { CompactAddressForm, IndonesianAddress } from '@/components/address';
import { FlexibleLocationSearch } from '@/components/renter/FlexibleLocationSearch';
import { FlexibleLocationResult } from '@/lib/utils/indonesianAddressService';

interface SearchFilters {
    priceRange: string;
    carType: string;
    transmission: string;
    fuelType: string;
}

interface EnhancedSearchProps {
    searchLocation: string;
    startDate: string;
    endDate: string;
    selectedFilters: SearchFilters;
    onLocationChange: (location: string) => void;
    onAddressChange?: (address: IndonesianAddress) => void;
    onFlexibleLocationSelect?: (location: FlexibleLocationResult | null) => void;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onFilterChange: (filterType: string, value: string) => void;
    onSearch: () => void;
    canRent: boolean;
    popularCities: string[];
    useDetailedAddress?: boolean; // New prop to enable Indonesian address form
    useFlexibleSearch?: boolean; // New prop to enable flexible location search
}

// Future feature: Location suggestions
// const suggestions = [
//     'Jakarta City Center',
//     'Jakarta Airport Area',
//     'Surabaya Downtown',
//     'Bandung Hills',
//     'Medan Central',
//     'Bali Denpasar',
//     'Yogyakarta Heritage',
//     'Semarang Port Area',
// ];

export function EnhancedSearch({
    searchLocation,
    startDate,
    endDate,
    selectedFilters,
    onLocationChange,
    onAddressChange,
    onFlexibleLocationSelect,
    onStartDateChange,
    onEndDateChange,
    onFilterChange,
    onSearch,
    canRent,
    popularCities,
    useDetailedAddress = false,
    useFlexibleSearch = false,
}: EnhancedSearchProps) {
    // Note: These variables are currently unused but may be needed for future features
    // const [showSuggestions, setShowSuggestions] = useState(false);
    // const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [priceRange, setPriceRange] = useState([0, 500]);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedFlexibleLocation, setSelectedFlexibleLocation] =
        useState<FlexibleLocationResult | null>(null);

    const carTypes = ['sedan', 'suv', 'motorcycle', 'ev']; // Updated to include 'ev'
    const transmissionTypes = ['AUTOMATIC', 'MANUAL', 'CVT']; // Updated to match database enum
    const fuelTypes = ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID']; // Updated to match database enum

    // Future feature: Auto-suggestions for location search
    // useEffect(() => {
    //     if (searchLocation.length > 0) {
    //         const filtered = suggestions.filter((suggestion) =>
    //             suggestion.toLowerCase().includes(searchLocation.toLowerCase()),
    //         );
    //         setFilteredSuggestions(filtered);
    //         setShowSuggestions(filtered.length > 0);
    //     } else {
    //         setShowSuggestions(false);
    //     }
    // }, [searchLocation]);

    // useEffect(() => {
    //     const handleClickOutside = (event: MouseEvent) => {
    //         if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
    //             setShowSuggestions(false);
    //         }
    //     };

    //     document.addEventListener('mousedown', handleClickOutside);
    //     return () => document.removeEventListener('mousedown', handleClickOutside);
    // }, []);

    const handleLocationSelect = (location: string) => {
        onLocationChange(location);
        // setShowSuggestions(false); // Commented out until suggestions feature is implemented
    };

    const handleFlexibleLocationSelect = (location: FlexibleLocationResult | null) => {
        setSelectedFlexibleLocation(location);
        if (onFlexibleLocationSelect) {
            onFlexibleLocationSelect(location);
        }
    };

    const handleAddressChange = (address: IndonesianAddress) => {
        // For compact form, we need to fetch city and province names from database
        // For now, we'll just indicate that an address was selected
        const locationString = address.city_id && address.province_id ? 'Address selected' : '';
        onLocationChange(locationString);

        // Call the new address change handler if provided
        if (onAddressChange) {
            onAddressChange(address);
        }
    };

    const handlePriceRangeChange = (index: number, value: number) => {
        const newRange = [...priceRange];
        newRange[index] = value;
        setPriceRange(newRange);

        // Update filter with range string
        const rangeString = `${newRange[0]}-${newRange[1]}`;
        onFilterChange('priceRange', rangeString);
    };

    const getMinDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const getMinEndDate = () => {
        if (!startDate) return getMinDate();
        const start = new Date(startDate);
        start.setDate(start.getDate() + 1); // End date must be at least 1 day after start
        return start.toISOString().split('T')[0];
    };

    return (
        <div
            className={`bg-white rounded-2xl shadow-xl p-4 mb-1 border border-gray-300 ${!canRent ? 'opacity-50 pointer-events-none' : ''}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-end sm:gap-2">
                {/* Location Search */}
                <div className="flex-1 mb-4 sm:mb-0" style={{ minWidth: '250px' }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {useFlexibleSearch
                            ? '📍 Where are you traveling?'
                            : '📍 Where are you going?'}
                    </label>
                    {useFlexibleSearch ? (
                        <FlexibleLocationSearch
                            value={searchLocation}
                            selectedLocation={selectedFlexibleLocation}
                            onChange={onLocationChange}
                            onLocationSelect={handleFlexibleLocationSelect}
                            disabled={!canRent}
                            placeholder="e.g., Jakarta, Bandung, Surabaya..."
                            className="w-full h-[38px]"
                        />
                    ) : (
                        <CompactAddressForm
                            onChange={handleAddressChange}
                            onLocationStringChange={onLocationChange}
                            disabled={!canRent}
                            enableDetailedMode={useDetailedAddress}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
                        />
                    )}
                </div>

                {/* Start Date */}
                <div className="flex-shrink-0 mb-4 sm:mb-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        📅 Pick-up Date
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        min={getMinDate()}
                        onChange={(e) => {
                            e.stopPropagation();
                            onStartDateChange(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!canRent}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm text-black disabled:bg-gray-100 disabled:cursor-not-allowed h-[38px]"
                    />
                </div>

                {/* End Date */}
                <div className="flex-shrink-0 mb-4 sm:mb-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        📅 Return Date
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        min={getMinEndDate()}
                        onChange={(e) => {
                            e.stopPropagation();
                            onEndDateChange(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!canRent}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm text-black disabled:bg-gray-100 disabled:cursor-not-allowed h-[38px]"
                    />
                </div>

                {/* Search Button */}
                <div className="flex-shrink-0">
                    <button
                        onClick={onSearch}
                        disabled={!canRent}
                        className={`w-full sm:w-auto py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center h-[38px] text-sm ${
                            canRent
                                ? 'bg-black text-white hover:bg-gray-800'
                                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        }`}
                    >
                        <span className="mr-1.5">🔍</span>
                        {canRent ? 'Search' : 'Restricted'}
                    </button>
                </div>
            </div>

            {/* Advanced filters toggle */}
            <div className="border-t border-gray-200 pt-3 mt-4">
                <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                >
                    <span>Advanced Filters</span>
                    <motion.span
                        animate={{ rotate: showAdvancedFilters ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        ▼
                    </motion.span>
                </button>

                <AnimatePresence>
                    {showAdvancedFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 space-y-4"
                        >
                            {/* Price Range Slider */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Price Range: Rp {priceRange[0].toLocaleString()} - Rp{' '}
                                    {priceRange[1].toLocaleString()} per day
                                </label>
                                <div className="px-2">
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min="0"
                                            max="500"
                                            value={priceRange[0]}
                                            onChange={(e) =>
                                                handlePriceRangeChange(0, parseInt(e.target.value))
                                            }
                                            className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <input
                                            type="range"
                                            min="0"
                                            max="500"
                                            value={priceRange[1]}
                                            onChange={(e) =>
                                                handlePriceRangeChange(1, parseInt(e.target.value))
                                            }
                                            className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Filter dropdowns */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Car Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Car Type
                                    </label>
                                    <select
                                        value={selectedFilters.carType}
                                        onChange={(e) => onFilterChange('carType', e.target.value)}
                                        className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-gray-900 hover:border-gray-500"
                                    >
                                        <option value="">Any Type</option>
                                        {carTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Transmission */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Transmission
                                    </label>
                                    <select
                                        value={selectedFilters.transmission}
                                        onChange={(e) =>
                                            onFilterChange('transmission', e.target.value)
                                        }
                                        className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-gray-900 hover:border-gray-500"
                                    >
                                        <option value="">Any Transmission</option>
                                        {transmissionTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
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
                                        value={selectedFilters.fuelType}
                                        onChange={(e) => onFilterChange('fuelType', e.target.value)}
                                        className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-gray-900 hover:border-gray-500"
                                    >
                                        <option value="">Any Fuel Type</option>
                                        {fuelTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Quick filter tags */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Quick Filters
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        {
                                            label: '⚡ Electric Only',
                                            filter: 'fuelType',
                                            value: 'Electric',
                                        },
                                        {
                                            label: '🌱 Eco-Friendly',
                                            filter: 'fuelType',
                                            value: 'Hybrid',
                                        },
                                        {
                                            label: '👑 Luxury',
                                            filter: 'carType',
                                            value: 'Luxury',
                                        },
                                        {
                                            label: '🤏 Compact',
                                            filter: 'carType',
                                            value: 'Compact',
                                        },
                                        {
                                            label: '⚙️ Automatic',
                                            filter: 'transmission',
                                            value: 'Automatic',
                                        },
                                    ].map((tag) => (
                                        <button
                                            key={tag.label}
                                            onClick={() =>
                                                onFilterChange(
                                                    tag.filter,
                                                    selectedFilters[
                                                        tag.filter as keyof SearchFilters
                                                    ] === tag.value
                                                        ? ''
                                                        : tag.value,
                                                )
                                            }
                                            className={`px-3 py-1 rounded-full text-sm transition-colors border-2 ${
                                                selectedFilters[
                                                    tag.filter as keyof SearchFilters
                                                ] === tag.value
                                                    ? 'bg-black text-white border-black'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-400 hover:border-gray-500'
                                            }`}
                                        >
                                            {tag.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Popular cities quick access - only show for non-flexible search */}
            {!useFlexibleSearch && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Popular Destinations</h4>
                    <div className="flex flex-wrap gap-2">
                        {popularCities.slice(0, 6).map((city) => (
                            <button
                                key={city}
                                onClick={() => handleLocationSelect(city)}
                                disabled={!canRent}
                                className="px-3 py-1 bg-white border-2 border-gray-400 hover:bg-gray-50 hover:border-gray-500 text-gray-700 rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-400"
                            >
                                📍 {city}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
