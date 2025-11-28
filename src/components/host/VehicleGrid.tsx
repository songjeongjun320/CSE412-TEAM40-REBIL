'use client';

import { Calendar, Car, Edit, Eye, Fuel, MoreVertical, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useMemo, useState } from 'react';

import { Tables } from '@/types/base/database.types';

import { VehicleFilters } from './VehicleSearch';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

type CarWithImages = Car & {
    car_images: CarImage[];
};

interface VehicleGridProps {
    vehicles: CarWithImages[];
    viewMode: 'grid' | 'list';
    filters: VehicleFilters;
    loading?: boolean;
    onVehicleSelect?: (vehicleId: string, selected: boolean) => void;
    selectedVehicles?: Set<string>;
    onQuickAction?: (vehicleId: string, action: string) => void;
}

const VEHICLES_PER_PAGE = 20;

export default function VehicleGrid({
    vehicles,
    viewMode,
    filters,
    loading = false,
    onVehicleSelect,
    selectedVehicles = new Set(),
    onQuickAction,
}: VehicleGridProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

    // Filter vehicles based on search and filters
    const filteredVehicles = useMemo(() => {
        return vehicles.filter((vehicle) => {
            // Search query filter
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const searchableText =
                    `${vehicle.make} ${vehicle.model} ${vehicle.year} ${vehicle.license_plate || ''}`.toLowerCase();
                if (!searchableText.includes(query)) return false;
            }

            // Status filter
            if (filters.status && vehicle.status !== filters.status) return false;

            // Vehicle type filter
            if (filters.vehicleType && vehicle.car_type !== filters.vehicleType) return false;

            // Price range filter
            if (
                vehicle.daily_rate < filters.priceRange[0] ||
                vehicle.daily_rate > filters.priceRange[1]
            )
                return false;

            // Fuel type filter
            if (filters.fuelType && vehicle.fuel_type !== filters.fuelType) return false;

            // Transmission filter
            if (filters.transmission && vehicle.transmission !== filters.transmission) return false;

            // Seats range filter
            if (vehicle.seats < filters.seatsRange[0] || vehicle.seats > filters.seatsRange[1])
                return false;

            // Year range filter
            if (vehicle.year < filters.yearRange[0] || vehicle.year > filters.yearRange[1])
                return false;

            return true;
        });
    }, [vehicles, filters]);

    // Pagination
    const totalPages = Math.ceil(filteredVehicles.length / VEHICLES_PER_PAGE);
    const startIndex = (currentPage - 1) * VEHICLES_PER_PAGE;
    const paginatedVehicles = filteredVehicles.slice(startIndex, startIndex + VEHICLES_PER_PAGE);

    // Reset to first page when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'PENDING_APPROVAL':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'DRAFT':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'INACTIVE':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'SUSPENDED':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatCurrency = (amount: number) => {
        return `Rp ${amount.toLocaleString()}`;
    };

    const handleVehicleSelect = useCallback(
        (vehicleId: string) => {
            if (onVehicleSelect) {
                const isSelected = selectedVehicles.has(vehicleId);
                onVehicleSelect(vehicleId, !isSelected);
            }
        },
        [onVehicleSelect, selectedVehicles],
    );

    const handleQuickAction = useCallback(
        (vehicleId: string, action: string) => {
            if (onQuickAction) {
                onQuickAction(vehicleId, action);
            }
            setOpenDropdown(null);
        },
        [onQuickAction],
    );

    const handleImageError = useCallback((vehicleId: string, imageUrl: string) => {
        console.log('Image failed to load:', imageUrl, 'for vehicle:', vehicleId);
        setImageErrors((prev) => new Set([...prev, vehicleId]));
    }, []);

    const getPrimaryImage = (vehicle: CarWithImages) => {
        const primaryImage = vehicle.car_images?.find((img) => img.is_primary);
        return primaryImage?.image_url || vehicle.car_images?.[0]?.image_url || null;
    };

    const renderVehicleCard = (vehicle: CarWithImages) => (
        <Link
            key={vehicle.id}
            href={`/host/vehicles/${vehicle.id}`}
            className="block bg-white rounded-xl shadow-lg border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 group cursor-pointer"
        >
            {/* Vehicle Image */}
            <div className="relative">
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-xl flex items-center justify-center">
                    {getPrimaryImage(vehicle) && !imageErrors.has(vehicle.id) ? (
                        <img
                            src={getPrimaryImage(vehicle)!}
                            alt={`${vehicle.make} ${vehicle.model}`}
                            className="w-full h-full object-cover rounded-t-xl"
                            loading="lazy"
                            onError={() => handleImageError(vehicle.id, getPrimaryImage(vehicle)!)}
                        />
                    ) : (
                        <Car className="h-10 w-10 text-gray-400" />
                    )}
                </div>

                {/* Selection Checkbox */}
                {onVehicleSelect && (
                    <div className="absolute top-2 left-2">
                        <input
                            type="checkbox"
                            checked={selectedVehicles.has(vehicle.id)}
                            onChange={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleVehicleSelect(vehicle.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                        />
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                    <span
                        className={`px-1 py-0.5 rounded text-xs font-semibold border ${getStatusColor(vehicle.status)}`}
                    >
                        {vehicle.status.replace('_', ' ')}
                    </span>
                </div>

                {/* Quick Actions Dropdown */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenDropdown(openDropdown === vehicle.id ? null : vehicle.id);
                            }}
                            className="bg-white rounded-full p-1 shadow-lg hover:shadow-xl transition-shadow"
                        >
                            <MoreVertical className="h-3 w-3 text-gray-600" />
                        </button>

                        {openDropdown === vehicle.id && (
                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-1 z-10">
                                <Link
                                    href={`/host/vehicles/${vehicle.id}`}
                                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <Eye className="h-4 w-4" />
                                    <span>View Details</span>
                                </Link>
                                <Link
                                    href={`/host/vehicles/${vehicle.id}/edit`}
                                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <Edit className="h-4 w-4" />
                                    <span>Edit Vehicle</span>
                                </Link>
                                <button
                                    onClick={() => handleQuickAction(vehicle.id, 'calendar')}
                                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                    <Calendar className="h-4 w-4" />
                                    <span>View Calendar</span>
                                </button>
                                <button
                                    onClick={() => handleQuickAction(vehicle.id, 'toggle-status')}
                                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>Toggle Status</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Vehicle Info */}
            <div className="p-3">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-black group-hover:text-gray-800 transition-colors leading-tight">
                        {vehicle.make} {vehicle.model}
                    </h3>
                    <span className="text-xs text-gray-500">{vehicle.year}</span>
                </div>

                {/* License Plate */}
                {vehicle.license_plate && (
                    <div className="mb-2">
                        <span className="inline-block bg-gray-100 text-gray-800 text-xs font-mono px-2 py-1 rounded border border-gray-300">
                            {vehicle.license_plate}
                        </span>
                    </div>
                )}

                {/* Price */}
                <div className="mb-2">
                    <span className="text-sm font-bold text-black">
                        {formatCurrency(vehicle.daily_rate)}
                    </span>
                    <span className="text-gray-600 text-xs">/day</span>
                </div>

                {/* Vehicle Features */}
                <div className="grid grid-cols-1 gap-1 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{vehicle.seats}석</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <Fuel className="h-3 w-3" />
                            <span>{vehicle.fuel_type}</span>
                        </div>
                    </div>
                    <div className="text-center">{vehicle.transmission}</div>
                </div>
            </div>
        </Link>
    );

    const renderVehicleRow = (vehicle: CarWithImages) => (
        <Link
            key={vehicle.id}
            href={`/host/vehicles/${vehicle.id}`}
            className="block bg-white rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 p-4 cursor-pointer"
        >
            <div className="flex items-center space-x-4">
                {/* Selection Checkbox */}
                {onVehicleSelect && (
                    <input
                        type="checkbox"
                        checked={selectedVehicles.has(vehicle.id)}
                        onChange={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleVehicleSelect(vehicle.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 text-black focus:ring-black border-gray-300 rounded"
                    />
                )}

                {/* Vehicle Image */}
                <div className="w-20 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getPrimaryImage(vehicle) && !imageErrors.has(vehicle.id) ? (
                        <img
                            src={getPrimaryImage(vehicle)!}
                            alt={`${vehicle.make} ${vehicle.model}`}
                            className="w-full h-full object-cover rounded-lg"
                            loading="lazy"
                            onError={() => handleImageError(vehicle.id, getPrimaryImage(vehicle)!)}
                        />
                    ) : (
                        <Car className="h-8 w-8 text-gray-400" />
                    )}
                </div>

                {/* Vehicle Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-1">
                        <h3 className="text-lg font-semibold text-black truncate">
                            {vehicle.make} {vehicle.model} ({vehicle.year})
                        </h3>
                        <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(vehicle.status)}`}
                        >
                            {vehicle.status.replace('_', ' ')}
                        </span>
                    </div>

                    {vehicle.license_plate && (
                        <div className="mb-2">
                            <span className="inline-block bg-gray-100 text-gray-800 text-sm font-mono px-2 py-1 rounded border-2 border-gray-300">
                                {vehicle.license_plate}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <span className="font-semibold text-black">
                            {formatCurrency(vehicle.daily_rate)}/day
                        </span>
                        <span className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{vehicle.seats} seats</span>
                        </span>
                        <span className="flex items-center space-x-1">
                            <Fuel className="h-4 w-4" />
                            <span>{vehicle.fuel_type}</span>
                        </span>
                        <span>{vehicle.transmission}</span>
                    </div>
                </div>
            </div>
        </Link>
    );

    if (loading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="bg-white rounded-xl shadow-lg border-2 border-gray-300 p-4"
                    >
                        <div className="animate-pulse">
                            <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (filteredVehicles.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 p-12 text-center">
                <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No vehicles found</h3>
                <p className="text-gray-600 mb-6">
                    {filters.searchQuery ||
                    Object.values(filters).some((v) => v !== '' && v !== undefined)
                        ? 'Try adjusting your search or filters to find more vehicles.'
                        : "You haven't added any vehicles yet."}
                </p>
                {!filters.searchQuery && (
                    <Link
                        href="/host/add-vehicle"
                        className="inline-block bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                    >
                        Add Your First Vehicle
                    </Link>
                )}
            </div>
        );
    }

    return (
        <div>
            {/* Vehicle Grid/List */}
            <div
                className={
                    viewMode === 'grid'
                        ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8'
                        : 'space-y-4 mb-8'
                }
            >
                {paginatedVehicles.map((vehicle) =>
                    viewMode === 'grid' ? renderVehicleCard(vehicle) : renderVehicleRow(vehicle),
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 p-6">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Showing {startIndex + 1}-
                            {Math.min(startIndex + VEHICLES_PER_PAGE, filteredVehicles.length)} of{' '}
                            {filteredVehicles.length} vehicles
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400 transition-colors"
                            >
                                Previous
                            </button>

                            <div className="flex items-center space-x-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                                    const pageNumber =
                                        currentPage <= 3 ? index + 1 : currentPage - 2 + index;
                                    if (pageNumber > totalPages) return null;

                                    return (
                                        <button
                                            key={pageNumber}
                                            onClick={() => setCurrentPage(pageNumber)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                currentPage === pageNumber
                                                    ? 'bg-black text-white'
                                                    : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-gray-400'
                                            }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() =>
                                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                                }
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close dropdown */}
            {openDropdown && (
                <div className="fixed inset-0 z-0" onClick={() => setOpenDropdown(null)} />
            )}
        </div>
    );
}
