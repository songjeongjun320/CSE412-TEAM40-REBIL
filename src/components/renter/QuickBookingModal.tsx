'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency, formatDailyRate } from '@/lib/utils';
import { Tables } from '@/types/base/database.types';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

type FeaturedCar = Car & {
    car_images: CarImage[];
};

interface QuickBookingModalProps {
    car: FeaturedCar | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (carId: string, dates: { startDate: string; endDate: string }) => void;
    prefilledDates?: {
        startDate: string;
        endDate: string;
    };
}

export function QuickBookingModal({
    car,
    isOpen,
    onClose,
    onConfirm,
    prefilledDates,
}: QuickBookingModalProps) {
    console.log('🎯 QuickBookingModal: Initializing with props:', {
        carId: car?.id,
        carMake: car?.make,
        carModel: car?.model,
        isOpen: isOpen,
        prefilledDates: prefilledDates,
    });

    const [startDate, setStartDate] = useState(prefilledDates?.startDate || '');
    const [endDate, setEndDate] = useState(prefilledDates?.endDate || '');
    const [totalCost, setTotalCost] = useState(0);
    const [hostInfo, setHostInfo] = useState<{
        name: string;
        rating: number;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilityError, setAvailabilityError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            console.log('🎯 QuickBookingModal: Modal closing, resetting form');
            // Reset form when modal closes
            setStartDate(prefilledDates?.startDate || '');
            setEndDate(prefilledDates?.endDate || '');
            setTotalCost(0);
            setHostInfo(null);
        }
    }, [isOpen, prefilledDates]);

    const fetchHostInfo = useCallback(async () => {
        if (!car) {
            console.log('🎯 QuickBookingModal: No car data, skipping host info fetch');
            return;
        }

        console.log('👤 QuickBookingModal: Fetching host info for car:', car.id);
        try {
            const supabase = createClient();
            const { data } = await supabase
                .from('user_profiles')
                .select('full_name')
                .eq('id', car.host_id)
                .single();

            console.log('👤 Host info fetch result:', {
                hasData: !!data,
                hostName: data?.full_name,
                hostId: car.host_id,
            });

            if (data) {
                setHostInfo({
                    name: data.full_name || 'Unknown Host',
                    rating: 4.8, // Placeholder - would come from reviews table
                });
                console.log('✅ Host info set successfully');
            }
        } catch (error) {
            console.error('❌ Error fetching host info:', error);
        }
    }, [car]);

    const calculateTotalCost = useCallback(() => {
        console.log('💰 QuickBookingModal: Calculating total cost');
        console.log('📅 Cost calculation inputs:', {
            startDate: startDate,
            endDate: endDate,
            carDailyRate: car?.daily_rate,
        });

        if (!car || !startDate || !endDate) {
            console.log('❌ Cost calculation failed: Missing required data');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        console.log('📅 Date calculation:', {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            calculatedDays: days,
        });

        if (days > 0) {
            const subtotal = days * car.daily_rate;
            const serviceFee = subtotal * 0.1; // 10% service fee
            const total = subtotal + serviceFee;

            console.log('💰 Cost breakdown:', {
                days: days,
                dailyRate: car.daily_rate,
                subtotal: subtotal,
                serviceFee: serviceFee,
                total: total,
            });

            setTotalCost(total);
        } else {
            console.log('❌ Invalid date range: days <= 0');
            setTotalCost(0);
        }
    }, [car, startDate, endDate]);

    useEffect(() => {
        if (car && isOpen) {
            console.log('🎯 QuickBookingModal: Modal opened with car, fetching host info');
            fetchHostInfo();
        }
    }, [car, isOpen, fetchHostInfo]);

    useEffect(() => {
        if (car && startDate && endDate) {
            console.log('🎯 QuickBookingModal: Dates changed, recalculating cost');
            calculateTotalCost();
        }
    }, [car, startDate, endDate, calculateTotalCost]);

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

    const getDays = () => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
    };

    const checkAvailability = async () => {
        console.log('🔍 QuickBookingModal: Starting availability check');
        console.log('📅 Availability check inputs:', {
            carId: car?.id,
            startDate: startDate,
            endDate: endDate,
        });

        if (!car || !startDate || !endDate) {
            console.log('❌ Availability check failed: Missing required data');
            return false;
        }

        setAvailabilityLoading(true);
        setAvailabilityError(null);

        try {
            const supabase = createClient();
            const startDateTime = new Date(`${startDate}T00:00:00`);
            const endDateTime = new Date(`${endDate}T23:59:59`);

            console.log('⏰ Calculated date times for availability check:', {
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                startDateTimeLocal: startDateTime.toString(),
                endDateTimeLocal: endDateTime.toString(),
            });

            // Use the database function to check availability
            console.log('🔍 Calling check_vehicle_availability RPC function...');
            const { data: availabilityResult, error } = await supabase.rpc(
                'check_vehicle_availability',
                {
                    p_car_id: car.id,
                    p_start_date: startDateTime.toISOString(),
                    p_end_date: endDateTime.toISOString(),
                },
            );

            console.log('📊 Availability check result:', {
                hasData: !!availabilityResult,
                hasError: !!error,
                errorCode: error?.code,
                errorMessage: error?.message,
                availabilityResult: availabilityResult,
            });

            if (error) {
                console.error('❌ Availability check error:', error);
                setAvailabilityError('Unable to check availability. Please try again.');
                return false;
            }

            if (!availabilityResult || !availabilityResult[0]?.is_available) {
                const conflictType = availabilityResult?.[0]?.conflict_type || 'unknown';
                console.log('❌ Vehicle not available:', {
                    conflictType: conflictType,
                    availabilityResult: availabilityResult,
                });

                let errorMessage = 'Vehicle not available for selected dates.';

                if (conflictType === 'booking_conflict') {
                    errorMessage = 'Vehicle is already booked for the selected dates.';
                } else if (conflictType === 'manual_block') {
                    errorMessage =
                        'Vehicle is not available for the selected dates (blocked by host).';
                } else if (conflictType === 'invalid_dates') {
                    errorMessage =
                        'Please select valid dates (start date must be before end date).';
                }

                setAvailabilityError(errorMessage);
                return false;
            }

            console.log('✅ Availability check passed - vehicle is available');
            return true;
        } catch (error) {
            console.error('❌ Error checking availability:', error);
            setAvailabilityError('Unable to check availability. Please try again.');
            return false;
        } finally {
            setAvailabilityLoading(false);
            console.log('✅ Availability check process completed');
        }
    };

    const handleConfirm = async () => {
        console.log('🚀 QuickBookingModal: Starting booking confirmation');
        console.log('📋 Confirmation inputs:', {
            carId: car?.id,
            startDate: startDate,
            endDate: endDate,
            totalCost: totalCost,
        });

        if (!car || !startDate || !endDate) {
            console.log('❌ Confirmation failed: Missing required data');
            return;
        }

        // First check availability
        console.log('🔍 Performing availability check before confirmation...');
        const isAvailable = await checkAvailability();
        if (!isAvailable) {
            console.log('❌ Confirmation cancelled: Vehicle not available');
            return;
        }

        setLoading(true);
        console.log('⏳ Setting loading state for confirmation');

        try {
            console.log('📞 Calling onConfirm callback...');
            await onConfirm(car.id, { startDate, endDate });
            console.log('✅ onConfirm callback completed successfully');
        } catch (error) {
            console.error('❌ Error in onConfirm callback:', error);
        } finally {
            setLoading(false);
            console.log('✅ Confirmation process completed');
        }
    };

    const getPrimaryImage = () => {
        if (!car) return '';
        const primaryImage = car.car_images?.find((img) => img.is_primary);
        const imageUrl =
            primaryImage?.image_url ||
            car.car_images?.[0]?.image_url ||
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNGM0Y0RjYiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMDAsIDc1KSI+CiAgICA8IS0tIENhciBib2R5IC0tPgogICAgPHJlY3QgeD0iMjAiIHk9IjgwIiB3aWR0aD0iMTYwIiBoZWlnaHQ9IjYwIiByeD0iMTAiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gQ2FyIHRvcCAtLT4KICAgIDxyZWN0IHg9IjQwIiB5PSI2MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gV2luZG93cyAtLT4KICAgIDxyZWN0IHg9IjUwIiB5PSI2NSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIzMCIgcng9IjUiIGZpbGw9IiNFNUU3RUIiLz4KICAgIDwhLS0gV2hlZWxzIC0tPgogICAgPGNpcmNsZSBjeD0iNTAiIGN5PSIxNDAiIHI9IjIwIiBmaWxsPSIjMzc0MTUxIi8+CiAgICA8Y2lyY2xlIGN4PSIxNTAiIGN5PSIxNDAiIHI9IjIwIiBmaWxsPSIjMzc0MTUxIi8+CiAgICA8IS0tIFdoZWVsIGRldGFpbHMgLS0+CiAgICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjE0MCIgcj0iMTIiIGZpbGw9IiM2QjcyODAiLz4KICAgIDxjaXJjbGUgY3g9IjE1MCIgY3k9IjE0MCIgcj0iMTIiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gSGVhZGxpZ2h0cyAtLT4KICAgIDxyZWN0IHg9IjI1IiB5PSI4NSIgd2lkdGg9IjgiIGhlaWdodD0iMTUiIHJ4PSI0IiBmaWxsPSIjRkNEMzNEIi8+CiAgICA8cmVjdCB4PSIxNjciIHk9Ijg1IiB3aWR0aD0iOCIgaGVpZ2h0PSIxNSIgcng9IjQiIGZpbGw9IiNGQ0QzM0QiLz4KICAgIDwhLS0gRG9vciAtLT4KICAgIDxyZWN0IHg9IjgwIiB5PSI4NSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjUwIiByeD0iMyIgZmlsbD0iIzRCNTU2MyIvPgogIDwvZz4KICA8dGV4dCB4PSIyMDAiIHk9IjI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZCNzI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2Ij5DYXIgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';

        console.log('🖼️ QuickBookingModal: Getting primary image:', {
            hasCar: !!car,
            imageCount: car?.car_images?.length || 0,
            primaryImageUrl: primaryImage?.image_url,
            fallbackImageUrl: car?.car_images?.[0]?.image_url,
            finalImageUrl: imageUrl.substring(0, 100) + '...',
        });

        return imageUrl;
    };

    if (!car) {
        console.log('🎯 QuickBookingModal: No car data, returning null');
        return null;
    }

    console.log('🎯 QuickBookingModal: Rendering modal with state:', {
        isOpen: isOpen,
        startDate: startDate,
        endDate: endDate,
        totalCost: totalCost,
        loading: loading,
        availabilityLoading: availabilityLoading,
        availabilityError: availabilityError,
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative">
                            <img
                                src={getPrimaryImage()}
                                alt={`${car.make} ${car.model}`}
                                className="w-full h-48 object-cover rounded-t-2xl"
                            />
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-8 h-8 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-colors cursor-pointer"
                            >
                                ×
                            </button>
                            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-lg">
                                <h3 className="font-semibold">
                                    {car.make} {car.model} ({car.year})
                                </h3>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Car Details */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            Quick Booking
                                        </h2>
                                        {hostInfo && (
                                            <p className="text-sm text-gray-600">
                                                Host: {hostInfo.name} ⭐ {hostInfo.rating}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatDailyRate(car.daily_rate)}
                                        </div>
                                    </div>
                                </div>

                                {/* Car specs */}
                                <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                                    <span className="flex items-center">⚙️ {car.transmission}</span>
                                    <span className="flex items-center">⛽ {car.fuel_type}</span>
                                    <span className="flex items-center">👥 {car.seats} seats</span>
                                </div>
                            </div>

                            {/* Date Selection */}
                            <div className="mb-6">
                                <h4 className="font-semibold text-gray-900 mb-3">Select Dates</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Pick-up Date
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            min={getMinDate()}
                                            onChange={(e) => {
                                                setStartDate(e.target.value);
                                                setAvailabilityError(null); // Clear errors when dates change
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Return Date
                                        </label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            min={getMinEndDate()}
                                            onChange={(e) => {
                                                setEndDate(e.target.value);
                                                setAvailabilityError(null); // Clear errors when dates change
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                        />
                                    </div>
                                </div>

                                {/* Show availability error */}
                                {availabilityError && (
                                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                                        <p className="text-red-800 text-sm font-medium">
                                            {availabilityError}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Cost Breakdown */}
                            {startDate && endDate && getDays() > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-6 bg-blue-50 rounded-lg p-4"
                                >
                                    <h4 className="font-semibold text-gray-900 mb-3">
                                        Cost Breakdown
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">
                                                {formatDailyRate(car.daily_rate)} × {getDays()} days
                                            </span>
                                            <span className="font-medium">
                                                {formatCurrency(car.daily_rate * getDays())}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Service fee (10%)</span>
                                            <span className="font-medium">
                                                {formatCurrency(
                                                    Math.round(car.daily_rate * getDays() * 0.1),
                                                )}
                                            </span>
                                        </div>
                                        <div className="border-t border-blue-200 pt-2 flex justify-between font-bold text-lg">
                                            <span>Total</span>
                                            <span className="text-blue-600">
                                                Rp {totalCost.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Actions */}
                            <div className="flex space-x-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={
                                        !startDate ||
                                        !endDate ||
                                        getDays() <= 0 ||
                                        loading ||
                                        availabilityLoading
                                    }
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Processing...
                                        </div>
                                    ) : availabilityLoading ? (
                                        <div className="flex items-center justify-center">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Checking...
                                        </div>
                                    ) : (
                                        `Book Now - Rp ${totalCost.toLocaleString()}`
                                    )}
                                </button>
                            </div>

                            {/* Disclaimer */}
                            <p className="text-xs text-gray-500 mt-4 text-center">
                                You will be redirected to complete your booking with full details
                                and payment.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
