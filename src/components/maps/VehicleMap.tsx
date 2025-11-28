'use client';

import { Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useState } from 'react';

import {
    applyCoordinateJitter,
    batchProcessVehicleLocations,
} from '@/lib/utils/vehicleLocationUtils';
import { Tables } from '@/types/base/database.types';

import { VehicleMarker } from './VehicleMarker';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

interface VehicleWithLocation extends Car {
    car_images: CarImage[];
    coordinates?: {
        lat: number;
        lng: number;
    };
    processingStatus?: 'pending' | 'processed' | 'failed';
}

interface VehicleMapProps {
    vehicles: VehicleWithLocation[];
    center?: { lat: number; lng: number };
    zoom?: number;
    selectedVehicle?: string | null;
    hoveredVehicle?: string | null;
    onMarkerClick?: (vehicleId: string) => void;
    onMarkerHover?: (vehicleId: string | null) => void;
    onBoundsChanged?: (center: { lat: number; lng: number }, zoom: number) => void; // Callback when map bounds change
    className?: string;
    mapKey?: number; // Key to force re-render and reset initial center
    allowMarkerPan?: boolean; // Whether clicking markers should pan the map
}

export function VehicleMap({
    vehicles,
    center = { lat: -6.2088, lng: 106.8456 }, // Jakarta default
    zoom = 12,
    selectedVehicle,
    hoveredVehicle,
    onMarkerClick,
    onMarkerHover,
    onBoundsChanged,
    className = '',
    mapKey = 0,
    allowMarkerPan = true,
}: VehicleMapProps) {
    const map = useMap();
    const [currentCenter, setCurrentCenter] = useState(center);
    const [userHasPanned, setUserHasPanned] = useState(false);
    const [processedVehicles, setProcessedVehicles] = useState<VehicleWithLocation[]>([]);
    const [isProcessingLocations, setIsProcessingLocations] = useState(false);
    const [processingError, setProcessingError] = useState<string | null>(null);

    // Update center only when mapKey changes (new search) and user hasn't panned - allow free panning otherwise
    useEffect(() => {
        if (center && !userHasPanned) {
            setCurrentCenter(center);
            if (map) {
                map.setCenter(center as any);
            }
        }
    }, [mapKey, center, map, userHasPanned]); // Respect user panning

    // Reset user interaction tracking when mapKey changes (new search)
    useEffect(() => {
        setUserHasPanned(false);
    }, [mapKey]);

    // Track when user manually interacts with the map and notify parent on drag end
    useEffect(() => {
        if (map) {
            const handleDragStart = () => {
                setUserHasPanned(true);
            };

            const handleDragEnd = () => {
                if (onBoundsChanged) {
                    const newCenter = map.getCenter();
                    const newZoom = map.getZoom();
                    if (newCenter && newZoom) {
                        onBoundsChanged({ lat: newCenter.lat(), lng: newCenter.lng() }, newZoom);
                    }
                }
            };

            const handleZoomChanged = () => {
                if (onBoundsChanged && userHasPanned) {
                    const newCenter = map.getCenter();
                    const newZoom = map.getZoom();
                    if (newCenter && newZoom) {
                        onBoundsChanged({ lat: newCenter.lat(), lng: newCenter.lng() }, newZoom);
                    }
                }
            };

            map.addListener('dragstart', handleDragStart);
            map.addListener('dragend', handleDragEnd);
            map.addListener('zoom_changed', handleZoomChanged);

            return () => {
                google.maps.event.clearListeners(map, 'dragstart');
                google.maps.event.clearListeners(map, 'dragend');
                google.maps.event.clearListeners(map, 'zoom_changed');
            };
        }
    }, [map, onBoundsChanged, userHasPanned]);

    // Handle marker click with optional pan
    const handleMarkerClick = (vehicleId: string) => {
        onMarkerClick?.(vehicleId);

        if (allowMarkerPan) {
            const vehicle = vehicles.find((v) => v.id === vehicleId);
            if (vehicle?.coordinates && map) {
                map.panTo(vehicle.coordinates as any);
                setUserHasPanned(true);
            }
        }
    };

    // Process vehicle locations asynchronously using existing utilities
    useEffect(() => {
        const processVehicleLocations = async () => {
            if (vehicles.length === 0) {
                setProcessedVehicles([]);
                return;
            }

            setIsProcessingLocations(true);
            setProcessingError(null);

            try {
                // Use existing batch processing utility
                const locationMap = await batchProcessVehicleLocations(vehicles, center);

                const vehiclesWithCoords = vehicles.map((vehicle) => {
                    // Check if vehicle already has coordinates
                    if (vehicle.coordinates) {
                        return {
                            ...vehicle,
                            processingStatus: 'processed' as const,
                        };
                    }

                    // Try to extract direct coordinates first
                    if (vehicle.location && typeof vehicle.location === 'object') {
                        const location = vehicle.location as any;
                        if (location.lat && location.lng) {
                            const lat = parseFloat(location.lat);
                            const lng = parseFloat(location.lng);
                            if (!isNaN(lat) && !isNaN(lng)) {
                                return {
                                    ...vehicle,
                                    coordinates: applyCoordinateJitter({ lat, lng }, vehicle.id),
                                    processingStatus: 'processed' as const,
                                };
                            }
                        }
                    }

                    // Use processed location from batch processing
                    const processedLocation = locationMap.get(vehicle.id);
                    if (processedLocation) {
                        return {
                            ...vehicle,
                            coordinates: applyCoordinateJitter(
                                processedLocation.coordinates,
                                vehicle.id,
                            ),
                            processingStatus: 'processed' as const,
                        };
                    }

                    // Mark as failed if no coordinates could be determined
                    return {
                        ...vehicle,
                        processingStatus: 'failed' as const,
                    };
                });

                setProcessedVehicles(vehiclesWithCoords);
            } catch (error) {
                console.error('Error processing vehicle locations:', error);
                setProcessingError('Failed to process vehicle locations');
                // Fallback to vehicles without coordinates
                setProcessedVehicles(
                    vehicles.map((v) => ({ ...v, processingStatus: 'failed' as const })),
                );
            } finally {
                setIsProcessingLocations(false);
            }
        };

        processVehicleLocations();
    }, [vehicles, center]); // Re-process when vehicles or center changes

    // Filter vehicles that have valid coordinates
    const vehiclesWithCoordinates = processedVehicles.filter(
        (vehicle) =>
            vehicle.coordinates &&
            typeof vehicle.coordinates.lat === 'number' &&
            typeof vehicle.coordinates.lng === 'number' &&
            !isNaN(vehicle.coordinates.lat) &&
            !isNaN(vehicle.coordinates.lng),
    );

    return (
        <div className={`relative ${className} w-full h-full bg-white rounded-2xl overflow-hidden`}>
            <Map
                style={{ width: '100%', height: '100%' }}
                defaultCenter={currentCenter}
                defaultZoom={zoom}
                gestureHandling="greedy"
                disableDefaultUI={false}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                mapId="vehicle-rental-map"
                clickableIcons={true}
                restriction={undefined}
                onCameraChanged={() => {
                    // Optional: handle camera changes if needed for features
                }}
                onDrag={() => {
                    setUserHasPanned(true);
                }}
                onDragend={() => {
                    // Optional: handle drag end if needed
                }}
            >
                {!isProcessingLocations &&
                    vehiclesWithCoordinates.map((vehicle) => (
                        <VehicleMarker
                            key={vehicle.id}
                            vehicle={vehicle}
                            position={vehicle.coordinates!}
                            isSelected={selectedVehicle === vehicle.id}
                            isHovered={hoveredVehicle === vehicle.id}
                            onClick={() => handleMarkerClick(vehicle.id)}
                            onHover={() => onMarkerHover?.(vehicle.id)}
                            onHoverOut={() => onMarkerHover?.(null)}
                        />
                    ))}
            </Map>

            {/* Vehicle count display with processing status */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md">
                <div className="flex items-center space-x-2">
                    {isProcessingLocations ? (
                        <>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-gray-700">
                                Processing locations...
                            </span>
                        </>
                    ) : processingError ? (
                        <>
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-sm font-medium text-red-700">
                                Error loading locations
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-700">
                                {vehiclesWithCoordinates.length} of {vehicles.length} vehicles shown
                            </span>
                            {vehicles.length > vehiclesWithCoordinates.length && (
                                <span className="text-xs text-gray-500">
                                    ({vehicles.length - vehiclesWithCoordinates.length} pending)
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
                <button
                    onClick={() => map?.setZoom((map?.getZoom() || 12) + 1)}
                    className="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg flex items-center justify-center shadow-md transition-colors text-gray-800 font-semibold text-lg"
                >
                    +
                </button>
                <button
                    onClick={() => map?.setZoom((map?.getZoom() || 12) - 1)}
                    className="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg flex items-center justify-center shadow-md transition-colors text-gray-800 font-semibold text-lg"
                >
                    −
                </button>
            </div>
        </div>
    );
}
