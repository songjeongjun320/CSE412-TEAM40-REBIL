'use client';

import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { motion } from 'framer-motion';
import React from 'react';

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

interface VehicleMarkerProps {
    vehicle: VehicleWithLocation;
    position: { lat: number; lng: number };
    isSelected?: boolean;
    isHovered?: boolean;
    onClick?: () => void;
    onHover?: () => void;
    onHoverOut?: () => void;
}

export function VehicleMarker({
    vehicle,
    position,
    isSelected = false,
    isHovered = false,
    onClick,
    onHover,
    onHoverOut,
}: VehicleMarkerProps) {
    // Select icon based on vehicle type
    const getVehicleIcon = (make: string, fuelType: string) => {
        const cleanMake = make?.toLowerCase() || '';
        const cleanFuelType = fuelType?.toLowerCase() || '';

        if (cleanFuelType.includes('electric')) {
            return '⚡';
        }
        if (cleanMake.includes('suv') || cleanMake.includes('jeep')) {
            return '🚙';
        }
        if (cleanMake.includes('truck') || cleanMake.includes('pickup')) {
            return '🚚';
        }
        if (
            cleanMake.includes('luxury') ||
            cleanMake.includes('mercedes') ||
            cleanMake.includes('bmw')
        ) {
            return '🏎️';
        }
        return '🚗';
    };

    // Color based on status
    const getStatusColor = () => {
        if (vehicle.status === 'ACTIVE') {
            return isSelected ? '#000000' : isHovered ? '#333333' : '#000000';
        }
        if (vehicle.status === 'INACTIVE' || vehicle.status === 'SUSPENDED') {
            return '#dc2626';
        }
        return '#666666'; // maintenance or other
    };

    // Marker size
    const markerScale = isSelected ? 1.3 : isHovered ? 1.15 : 1;

    return (
        <AdvancedMarker position={position} onClick={onClick}>
            <motion.div
                className="relative cursor-pointer"
                onMouseEnter={onHover}
                onMouseLeave={onHoverOut}
                animate={{
                    scale: markerScale,
                }}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                }}
            >
                {/* Vehicle icon container */}
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shadow-lg border-2 border-white"
                    style={{
                        backgroundColor: getStatusColor(),
                        boxShadow:
                            isSelected || isHovered
                                ? `0 0 20px ${getStatusColor()}40`
                                : '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                >
                    {getVehicleIcon(vehicle.make, vehicle.fuel_type)}
                </div>

                {/* Price display */}
                <motion.div
                    className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 
                             bg-white border-2 rounded-lg px-2 py-1 
                             text-xs font-bold shadow-lg whitespace-nowrap"
                    style={{
                        borderColor: getStatusColor(),
                        color: getStatusColor(),
                    }}
                    animate={{
                        opacity: isHovered || isSelected ? 1 : 0.9,
                        y: isHovered || isSelected ? -2 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                >
                    Rp {vehicle.daily_rate.toLocaleString()}
                </motion.div>

                {/* Selection state indicator */}
                {isSelected && (
                    <motion.div
                        className="absolute -inset-2 rounded-full border-2 border-black"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.6 }}
                        style={{
                            boxShadow: '0 0 15px rgba(0, 0, 0, 0.3)',
                        }}
                    />
                )}

                {/* Hover state indicator */}
                {isHovered && !isSelected && (
                    <motion.div
                        className="absolute -inset-1 rounded-full bg-white/20"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.15 }}
                    />
                )}

                {/* Vehicle info tooltip (displayed on hover) */}
                {(isHovered || isSelected) && (
                    <motion.div
                        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                                 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg
                                 whitespace-nowrap z-10"
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="font-semibold">
                            {vehicle.make} {vehicle.model}
                        </div>
                        <div className="text-gray-300">
                            {vehicle.year} • {vehicle.seats} seats
                        </div>

                        {/* Tooltip arrow */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                            <div
                                className="w-0 h-0 border-l-4 border-r-4 border-t-4 
                                          border-l-transparent border-r-transparent border-t-gray-900"
                            ></div>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AdvancedMarker>
    );
}
