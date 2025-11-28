'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

import { GoogleMapProvider } from '@/components/maps/GoogleMapProvider';
import { VehicleMap } from '@/components/maps/VehicleMap';
import { VehicleCard } from '@/components/renter/VehicleCard';
import { useAutoFetchHostsInfo } from '@/hooks/useHostsInfo';
import { Tables } from '@/types/base/database.types';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

interface VehicleWithLocation extends Car {
    car_images: CarImage[];
    coordinates?: {
        lat: number;
        lng: number;
    };
}

interface SearchFilters {
    location: {
        lat: number;
        lng: number;
        address: string;
    } | null;
    dateRange: {
        startDate: string;
        endDate: string;
    } | null;
}

// Layout constants for consistent positioning
const LAYOUT_CONSTANTS = {
    MAP_TOP_OFFSET: 73, // Offset from navbar for map positioning
    RIGHT_PADDING: 24, // Right padding equivalent to px-6
    MAP_BOTTOM_OFFSET: 105, // Bottom offset for map height calculation
    MIN_NAVBAR_HEIGHT: 140, // Minimum safe navbar height
    NAVBAR_SAFE_MARGIN: 20, // Additional margin for navbar height calculation
    FALLBACK_NAVBAR_HEIGHT: 180, // Fallback height when navbar not found
} as const;

interface VehicleListMapViewProps {
    vehicles: VehicleWithLocation[];
    canRent: boolean;
    searchFilters?: SearchFilters;
    onVehicleSelect?: (vehicleId: string) => void;
    onMapBoundsChanged?: (center: { lat: number; lng: number }, zoom: number) => void;
}

export function VehicleListMapView({
    vehicles,
    canRent,
    searchFilters,
    onVehicleSelect,
    onMapBoundsChanged,
}: VehicleListMapViewProps) {
    const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
    const [hoveredVehicle, setHoveredVehicle] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split');
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
        lat: -6.2088,
        lng: 106.8456,
    }); // Jakarta default
    const [mapKey, setMapKey] = useState(0); // Key to force map re-render
    const [navbarHeight, setNavbarHeight] = useState(160); // Default fallback height

    // Measure navbar height dynamically
    useEffect(() => {
        const measureNavbarHeight = () => {
            // Find the sticky header element by its stable identifier
            const stickyHeader = document.querySelector(
                '[data-testid="app-header"]',
            ) as HTMLElement;
            if (stickyHeader) {
                const height = stickyHeader.offsetHeight;
                // Ensure minimum height for safety
                const safeHeight =
                    Math.max(height, LAYOUT_CONSTANTS.MIN_NAVBAR_HEIGHT) +
                    LAYOUT_CONSTANTS.NAVBAR_SAFE_MARGIN;
                setNavbarHeight(safeHeight);
            } else {
                setNavbarHeight(LAYOUT_CONSTANTS.FALLBACK_NAVBAR_HEIGHT);
            }
        };

        // Initial measurement with delay to ensure DOM is ready
        const timeoutId = setTimeout(measureNavbarHeight, 100);

        // Re-measure when window resizes or content changes
        const resizeObserver = new ResizeObserver(() => {
            // Debounce rapid resize events
            clearTimeout(timeoutId);
            setTimeout(measureNavbarHeight, 100);
        });

        const mutationObserver = new MutationObserver(() => {
            // Debounce rapid mutations
            setTimeout(measureNavbarHeight, 50);
        });

        const stickyHeader = document.querySelector('[data-testid="app-header"]');
        if (stickyHeader) {
            resizeObserver.observe(stickyHeader);
            mutationObserver.observe(stickyHeader, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style'],
            });
        }

        // Also measure on window resize
        window.addEventListener('resize', measureNavbarHeight);

        return () => {
            clearTimeout(timeoutId);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            window.removeEventListener('resize', measureNavbarHeight);
        };
    }, []);

    // Update map center point if search location exists
    useEffect(() => {
        if (searchFilters?.location) {
            setMapCenter({
                lat: searchFilters.location.lat,
                lng: searchFilters.location.lng,
            });
            // Force map re-render to reset the initial center state
            setMapKey((prev) => prev + 1);
        }
    }, [searchFilters?.location]);

    // Show all vehicles without radius filtering
    const filteredVehicles = useMemo(() => {
        return vehicles;
    }, [vehicles]);

    // Batch fetch host information for all vehicles to eliminate redundant API calls
    const { getHostInfo } = useAutoFetchHostsInfo(filteredVehicles);

    const handleVehicleSelect = (vehicleId: string) => {
        setSelectedVehicle(vehicleId);
        onVehicleSelect?.(vehicleId);

        // Note: Removed automatic map center update to allow free map panning
        // Users can click on markers directly to focus on specific vehicles
    };

    const handleVehicleHover = (vehicleId: string | null) => {
        setHoveredVehicle(vehicleId);
    };

    const getViewModeIcon = (mode: string) => {
        switch (mode) {
            case 'split':
                return '🔀';
            case 'list':
                return '📋';
            case 'map':
                return '🗺️';
            default:
                return '🔀';
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            {/* Top control bar */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold text-gray-900">Available Vehicles</h2>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>{filteredVehicles.length} vehicles found</span>
                        {searchFilters?.location && (
                            <>
                                <span>•</span>
                                <span>in {searchFilters.location.address}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* View mode toggle */}
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                    {(['split', 'list', 'map'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                viewMode === mode
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {getViewModeIcon(mode)} {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-start relative">
                {/* Vehicle list */}
                {(viewMode === 'split' || viewMode === 'list') && (
                    <motion.div
                        className={`${viewMode === 'split' ? 'w-3/5 pr-6' : 'w-full'} min-h-full overflow-y-auto bg-gray-50`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="p-3">
                            {filteredVehicles.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-4xl text-gray-400 mb-4">🚗</div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                        No vehicles found
                                    </h3>
                                    <p className="text-gray-600">
                                        Try adjusting your search filters or expanding the search
                                        radius.
                                    </p>
                                </div>
                            ) : (
                                <div
                                    className="grid grid-cols-3 gap-2"
                                    style={{ paddingTop: '18px' }}
                                >
                                    {filteredVehicles.map((vehicle) => (
                                        <motion.div
                                            key={vehicle.id}
                                            className={`transition-all duration-200 ${
                                                selectedVehicle === vehicle.id
                                                    ? 'ring-2 ring-blue-500 ring-offset-1'
                                                    : hoveredVehicle === vehicle.id
                                                      ? 'shadow-lg scale-[1.02]'
                                                      : ''
                                            }`}
                                            onMouseEnter={() => handleVehicleHover(vehicle.id)}
                                            onMouseLeave={() => handleVehicleHover(null)}
                                            onClick={() => handleVehicleSelect(vehicle.id)}
                                        >
                                            <VehicleCard
                                                car={vehicle}
                                                canRent={canRent}
                                                isNew={false}
                                                showWishlist={true}
                                                showRating={true}
                                                hostInfo={getHostInfo(vehicle.host_id)}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Map - Fixed positioning for frozen scroll behavior */}
                {(viewMode === 'split' || viewMode === 'map') && (
                    <motion.div
                        className={`${viewMode === 'split' ? 'w-2/5 pt-3' : 'w-full'} ${viewMode === 'split' ? '' : 'relative'}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {viewMode === 'split' ? (
                            <div
                                className="fixed bg-white rounded-2xl shadow-xl border border-gray-200 z-40"
                                style={{
                                    top: `${navbarHeight + LAYOUT_CONSTANTS.MAP_TOP_OFFSET}px`,
                                    right: `${LAYOUT_CONSTANTS.RIGHT_PADDING}px`,
                                    width: `calc(40% - ${LAYOUT_CONSTANTS.RIGHT_PADDING}px)`, // 2/5 width minus right padding
                                    height: `calc(100vh - ${navbarHeight + LAYOUT_CONSTANTS.MAP_BOTTOM_OFFSET}px)`,
                                }}
                            >
                                <GoogleMapProvider key={mapKey}>
                                    <VehicleMap
                                        vehicles={filteredVehicles}
                                        center={mapCenter}
                                        zoom={12}
                                        selectedVehicle={selectedVehicle}
                                        hoveredVehicle={hoveredVehicle}
                                        onMarkerClick={handleVehicleSelect}
                                        onMarkerHover={handleVehicleHover}
                                        onBoundsChanged={onMapBoundsChanged}
                                        className="w-full h-full"
                                        mapKey={mapKey}
                                        allowMarkerPan={true}
                                    />
                                </GoogleMapProvider>
                            </div>
                        ) : (
                            <div
                                className="w-full"
                                style={{ height: `calc(100vh - ${navbarHeight + 60}px)` }}
                            >
                                <GoogleMapProvider key={mapKey}>
                                    <VehicleMap
                                        vehicles={filteredVehicles}
                                        center={mapCenter}
                                        zoom={12}
                                        selectedVehicle={selectedVehicle}
                                        hoveredVehicle={hoveredVehicle}
                                        onMarkerClick={handleVehicleSelect}
                                        onMarkerHover={handleVehicleHover}
                                        onBoundsChanged={onMapBoundsChanged}
                                        className="w-full h-full"
                                        mapKey={mapKey}
                                        allowMarkerPan={true}
                                    />
                                </GoogleMapProvider>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
