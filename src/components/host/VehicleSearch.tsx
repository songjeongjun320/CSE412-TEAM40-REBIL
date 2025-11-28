'use client';

import { Calendar, DollarSign, Filter, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface VehicleFilters {
    searchQuery: string;
    vehicleType: string;
    status: string;
    priceRange: [number, number];
    fuelType: string;
    transmission: string;
    seatsRange: [number, number];
    yearRange: [number, number];
    availabilityDate?: Date;
}

interface VehicleSearchProps {
    onFiltersChange: (filters: VehicleFilters) => void;
    onSearchChange: (query: string) => void;
    vehicleCount: number;
    loading?: boolean;
}

const defaultFilters: VehicleFilters = {
    searchQuery: '',
    vehicleType: '',
    status: '',
    priceRange: [0, 2000000],
    fuelType: '',
    transmission: '',
    seatsRange: [2, 8],
    yearRange: [2010, new Date().getFullYear()],
};

export default function VehicleSearch({
    onFiltersChange,
    onSearchChange,
    vehicleCount,
    loading = false,
}: VehicleSearchProps) {
    const [filters, setFilters] = useState<VehicleFilters>(defaultFilters);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced search
    const debouncedSearch = useCallback(
        (query: string) => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }

            searchTimeoutRef.current = setTimeout(() => {
                onSearchChange(query);
            }, 300);
        },
        [onSearchChange],
    );

    useEffect(() => {
        debouncedSearch(filters.searchQuery);
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [filters.searchQuery, debouncedSearch]);

    useEffect(() => {
        onFiltersChange(filters);
    }, [filters, onFiltersChange]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters((prev) => ({ ...prev, searchQuery: e.target.value }));
    };

    const handleFilterChange = (key: keyof VehicleFilters, value: any) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const clearAllFilters = () => {
        setFilters(defaultFilters);
        setShowAdvancedFilters(false);
    };

    const getActiveFilterCount = () => {
        const activeFilters = Object.entries(filters).filter(([key, value]) => {
            if (key === 'searchQuery') return value.trim() !== '';
            if (key === 'priceRange') return value[0] !== 0 || value[1] !== 2000000;
            if (key === 'seatsRange') return value[0] !== 2 || value[1] !== 8;
            if (key === 'yearRange')
                return value[0] !== 2010 || value[1] !== new Date().getFullYear();
            return value !== '' && value !== undefined;
        });
        return activeFilters.length;
    };

    const formatCurrency = (value: number) => {
        return `Rp ${value.toLocaleString()}`;
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-6 mb-6">
            {/* Search Bar */}
            <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    value={filters.searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search by license plate, make, model, or year..."
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg leading-5 bg-white text-black placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-black focus:border-black"
                />
                {loading && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    </div>
                )}
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                >
                    <option value="" className="text-black">
                        All Status
                    </option>
                    <option value="ACTIVE" className="text-black">
                        Active
                    </option>
                    <option value="INACTIVE" className="text-black">
                        Inactive
                    </option>
                    <option value="PENDING_APPROVAL" className="text-black">
                        Pending Approval
                    </option>
                    <option value="DRAFT" className="text-black">
                        Draft
                    </option>
                    <option value="SUSPENDED" className="text-black">
                        Suspended
                    </option>
                </select>

                <select
                    value={filters.vehicleType}
                    onChange={(e) => handleFilterChange('vehicleType', e.target.value)}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                >
                    <option value="" className="text-black">
                        All Types
                    </option>
                    <option value="Sedan" className="text-black">
                        Sedan
                    </option>
                    <option value="SUV" className="text-black">
                        SUV
                    </option>
                    <option value="Hatchback" className="text-black">
                        Hatchback
                    </option>
                    <option value="MPV" className="text-black">
                        MPV
                    </option>
                    <option value="Convertible" className="text-black">
                        Convertible
                    </option>
                    <option value="Pickup" className="text-black">
                        Pickup
                    </option>
                    <option value="Van" className="text-black">
                        Van
                    </option>
                    <option value="Luxury" className="text-black">
                        Luxury
                    </option>
                </select>

                <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="flex items-center space-x-2 px-4 py-2 border-2 border-gray-300 rounded-lg text-sm text-black hover:border-gray-400 transition-colors"
                >
                    <Filter className="h-4 w-4 text-black" />
                    <span>More Filters</span>
                    {getActiveFilterCount() > 0 && (
                        <span className="bg-black text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {getActiveFilterCount()}
                        </span>
                    )}
                </button>

                {getActiveFilterCount() > 0 && (
                    <button
                        onClick={clearAllFilters}
                        className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-800 text-sm"
                    >
                        <X className="h-4 w-4" />
                        <span>Clear All</span>
                    </button>
                )}
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
                <div className="border-t-2 border-gray-200 pt-6 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Price Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <DollarSign className="inline h-4 w-4 mr-1" />
                                Daily Rate Range
                            </label>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        value={filters.priceRange[0]}
                                        onChange={(e) =>
                                            handleFilterChange('priceRange', [
                                                parseInt(e.target.value) || 0,
                                                filters.priceRange[1],
                                            ])
                                        }
                                        placeholder="Min"
                                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input
                                        type="number"
                                        value={filters.priceRange[1]}
                                        onChange={(e) =>
                                            handleFilterChange('priceRange', [
                                                filters.priceRange[0],
                                                parseInt(e.target.value) || 2000000,
                                            ])
                                        }
                                        placeholder="Max"
                                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                    />
                                </div>
                                <div className="text-xs text-gray-500">
                                    {formatCurrency(filters.priceRange[0])} -{' '}
                                    {formatCurrency(filters.priceRange[1])}
                                </div>
                            </div>
                        </div>

                        {/* Fuel Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fuel Type
                            </label>
                            <select
                                value={filters.fuelType}
                                onChange={(e) => handleFilterChange('fuelType', e.target.value)}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                            >
                                <option value="" className="text-black">
                                    All Fuel Types
                                </option>
                                <option value="Gasoline" className="text-black">
                                    Gasoline
                                </option>
                                <option value="Diesel" className="text-black">
                                    Diesel
                                </option>
                                <option value="Electric" className="text-black">
                                    Electric
                                </option>
                                <option value="Hybrid" className="text-black">
                                    Hybrid
                                </option>
                            </select>
                        </div>

                        {/* Transmission */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Transmission
                            </label>
                            <select
                                value={filters.transmission}
                                onChange={(e) => handleFilterChange('transmission', e.target.value)}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                            >
                                <option value="" className="text-black">
                                    All Transmissions
                                </option>
                                <option value="Manual" className="text-black">
                                    Manual
                                </option>
                                <option value="Automatic" className="text-black">
                                    Automatic
                                </option>
                                <option value="CVT" className="text-black">
                                    CVT
                                </option>
                            </select>
                        </div>

                        {/* Seats Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Number of Seats
                            </label>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="number"
                                    min="2"
                                    max="8"
                                    value={filters.seatsRange[0]}
                                    onChange={(e) =>
                                        handleFilterChange('seatsRange', [
                                            parseInt(e.target.value) || 2,
                                            filters.seatsRange[1],
                                        ])
                                    }
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="number"
                                    min="2"
                                    max="8"
                                    value={filters.seatsRange[1]}
                                    onChange={(e) =>
                                        handleFilterChange('seatsRange', [
                                            filters.seatsRange[0],
                                            parseInt(e.target.value) || 8,
                                        ])
                                    }
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                />
                            </div>
                        </div>

                        {/* Year Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Year Range
                            </label>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="number"
                                    min="2000"
                                    max={new Date().getFullYear()}
                                    value={filters.yearRange[0]}
                                    onChange={(e) =>
                                        handleFilterChange('yearRange', [
                                            parseInt(e.target.value) || 2010,
                                            filters.yearRange[1],
                                        ])
                                    }
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="number"
                                    min="2000"
                                    max={new Date().getFullYear()}
                                    value={filters.yearRange[1]}
                                    onChange={(e) =>
                                        handleFilterChange('yearRange', [
                                            filters.yearRange[0],
                                            parseInt(e.target.value) || new Date().getFullYear(),
                                        ])
                                    }
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                />
                            </div>
                        </div>

                        {/* Availability Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="inline h-4 w-4 mr-1" />
                                Check Availability
                            </label>
                            <input
                                type="date"
                                value={
                                    filters.availabilityDate
                                        ? filters.availabilityDate.toISOString().split('T')[0]
                                        : ''
                                }
                                onChange={(e) =>
                                    handleFilterChange(
                                        'availabilityDate',
                                        e.target.value ? new Date(e.target.value) : undefined,
                                    )
                                }
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Results Summary */}
            <div className="mt-4 pt-4 border-t-2 border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        {loading ? (
                            <span className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                <span>Searching vehicles...</span>
                            </span>
                        ) : (
                            <span>
                                Found <strong>{vehicleCount}</strong> vehicle
                                {vehicleCount !== 1 ? 's' : ''}
                                {filters.searchQuery && (
                                    <span>
                                        {' '}
                                        matching &quot;<strong>{filters.searchQuery}</strong>&quot;
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    {getActiveFilterCount() > 0 && (
                        <div className="text-sm text-gray-500">
                            {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''}{' '}
                            active
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
