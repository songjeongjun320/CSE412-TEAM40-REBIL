'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { FlexibleLocationSearch } from '@/components/renter/FlexibleLocationSearch';
import { DEFAULT_CENTER } from '@/lib/utils/cityCoordinates';
import { FlexibleLocationResult } from '@/lib/utils/indonesianAddressService';
import { convertFlexibleResultToLocationInfo } from '@/lib/utils/locationConversion';

interface SearchFilters {
    priceRange: string;
    carType: string;
    transmission: string;
    fuelType: string;
}

interface LocationInfo {
    lat: number;
    lng: number;
    address: string;
    provinceId?: string;
    cityId?: string;
    districtId?: string;
    villageId?: string;
    cityName?: string;
    provinceName?: string;
}

interface VehicleMapSearchProps {
    onLocationChange: (location: LocationInfo | null) => void;
    onDateRangeChange: (startDate: string, endDate: string) => void;
    onFiltersChange: (filters: SearchFilters) => void;
    onSearch: () => void;
    canRent: boolean;
    initialLocation?: LocationInfo | null;
    initialStartDate?: string;
    initialEndDate?: string;
    initialFilters?: SearchFilters;
}

const defaultFilters: SearchFilters = {
    priceRange: '',
    carType: '',
    transmission: '',
    fuelType: '',
};

export function VehicleMapSearch({
    onLocationChange,
    onDateRangeChange,
    onFiltersChange,
    onSearch,
    canRent,
    initialLocation = null,
    initialStartDate = '',
    initialEndDate = '',
    initialFilters = defaultFilters,
}: VehicleMapSearchProps) {
    const [selectedLocation, setSelectedLocation] = useState<LocationInfo | null>(initialLocation);
    const [locationQuery, setLocationQuery] = useState('');
    const [selectedFlexibleLocation, setSelectedFlexibleLocation] =
        useState<FlexibleLocationResult | null>(null);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [filters, setFilters] = useState<SearchFilters>(initialFilters);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Sync internal state when initial props change (e.g., URL-driven changes)
    useEffect(() => {
        setSelectedLocation(initialLocation ?? null);
        if (initialLocation?.address) {
            setLocationQuery(initialLocation.address);
        }
    }, [initialLocation]);

    // Notify parent component when state changes
    useEffect(() => {
        onLocationChange(selectedLocation);
    }, [selectedLocation, onLocationChange]);

    useEffect(() => {
        onDateRangeChange(startDate, endDate);
    }, [startDate, endDate, onDateRangeChange]);

    useEffect(() => {
        onFiltersChange(filters);
    }, [filters, onFiltersChange]);

    const handleFilterChange = (filterType: keyof SearchFilters, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [filterType]: value,
        }));
    };

    const getMinDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const getMinEndDate = () => {
        if (!startDate) return getMinDate();
        const start = new Date(startDate);
        start.setDate(start.getDate() + 1);
        return start.toISOString().split('T')[0];
    };

    const carTypes = ['sedan', 'suv', 'motorcycle', 'ev']; // Updated to include 'ev'
    const transmissionTypes = ['Automatic', 'Manual'];
    const fuelTypes = ['Gasoline', 'Diesel', 'Electric', 'Hybrid'];

    return (
        <div
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${!canRent ? 'opacity-50 pointer-events-none' : ''}`}
        >
            {/* Main search form */}
            <div className="space-y-4 mb-4">
                {/* Location Search Row */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        📍 Where do you want to rent?
                    </label>
                    <div className="w-full max-w-2xl">
                        <FlexibleLocationSearch
                            value={locationQuery}
                            selectedLocation={selectedFlexibleLocation}
                            onChange={(value) => setLocationQuery(value)}
                            onLocationSelect={async (location) => {
                                setSelectedFlexibleLocation(location);
                                if (location) {
                                    try {
                                        const locationInfo =
                                            await convertFlexibleResultToLocationInfo(location);
                                        setSelectedLocation(locationInfo);
                                    } catch (error) {
                                        console.error('Error converting location:', error);
                                        // Fallback to basic location info
                                        setSelectedLocation({
                                            lat: DEFAULT_CENTER.lat,
                                            lng: DEFAULT_CENTER.lng,
                                            address: location.displayText,
                                            cityName: location.name,
                                        });
                                    }
                                } else {
                                    setSelectedLocation(null);
                                }
                            }}
                            disabled={!canRent}
                            placeholder="Where do you want to rent? (e.g., Jakarta, Bandung, Surabaya...)"
                            className="w-full"
                        />
                    </div>
                </div>

                {/* Date Selection Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            📅 Pick-up Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            min={getMinDate()}
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={!canRent}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* End date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            📅 Return Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            min={getMinEndDate()}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={!canRent}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>
            </div>

            {/* Advanced filters toggle */}
            <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <span>🔧 Advanced Filters</span>
                        <motion.span
                            animate={{ rotate: showAdvancedFilters ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            ▼
                        </motion.span>
                    </button>
                    <button
                        onClick={onSearch}
                        disabled={!canRent || !selectedFlexibleLocation}
                        className={`py-2 px-5 rounded-lg font-semibold transition-colors ${
                            canRent && selectedLocation
                                ? 'bg-black text-white hover:bg-gray-800'
                                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        }`}
                    >
                        <Search className="w-4 h-4 inline mr-2" />
                        Search
                    </button>
                </div>

                <AnimatePresence>
                    {showAdvancedFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 space-y-4"
                        >
                            {/* Filter dropdowns */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Car type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        🚗 Car Type
                                    </label>
                                    <select
                                        value={filters.carType}
                                        onChange={(e) =>
                                            handleFilterChange('carType', e.target.value)
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                                        ⚙️ Transmission
                                    </label>
                                    <select
                                        value={filters.transmission}
                                        onChange={(e) =>
                                            handleFilterChange('transmission', e.target.value)
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    >
                                        <option value="">Any Transmission</option>
                                        {transmissionTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Fuel type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        ⛽ Fuel Type
                                    </label>
                                    <select
                                        value={filters.fuelType}
                                        onChange={(e) =>
                                            handleFilterChange('fuelType', e.target.value)
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                                    ⚡ Quick Filters
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
                                                handleFilterChange(
                                                    tag.filter as keyof SearchFilters,
                                                    filters[tag.filter as keyof SearchFilters] ===
                                                        tag.value
                                                        ? ''
                                                        : tag.value,
                                                )
                                            }
                                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                                filters[tag.filter as keyof SearchFilters] ===
                                                tag.value
                                                    ? 'bg-black text-white border border-black'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
        </div>
    );
}
