'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AvailabilityCalendar from '@/components/base/AvailabilityCalendar';
import { Button } from '@/components/ui';
import { canUserRent, getCurrentUserRoles } from '@/lib/auth/userRoles';
import { createClient } from '@/lib/supabase/supabaseClient';
import { calculateTieredRent, formatCurrency, formatDailyRate } from '@/lib/utils';
import { formatLocationDisplay, getFullAddressString } from '@/lib/utils/locationHelpers';
import { Tables } from '@/types/base/database.types';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;
type UserProfile = Tables<'user_profiles'>;

interface CarWithDetails extends Car {
    car_images: CarImage[];
    host: UserProfile;
}

interface BookingData {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    pickupLocation: string;
    dropoffLocation: string;
    insuranceType: 'BASIC' | 'STANDARD' | 'PREMIUM';
    specialInstructions: string;
}

const INSURANCE_OPTIONS = [
    {
        type: 'BASIC' as const,
        name: 'Basic Protection',
        price: 15,
        description: 'Basic coverage with higher deductible',
        features: ['Rp 15,500,000 deductible', 'Liability coverage', 'Basic damage protection'],
    },
    {
        type: 'STANDARD' as const,
        name: 'Standard Protection',
        price: 25,
        description: 'Comprehensive coverage with moderate deductible',
        features: [
            'Rp 7,750,000 deductible',
            'Full liability coverage',
            'Comprehensive damage protection',
            'Theft protection',
        ],
    },
    {
        type: 'PREMIUM' as const,
        name: 'Premium Protection',
        price: 40,
        description: 'Maximum coverage with minimal out-of-pocket costs',
        features: [
            'Rp 3,100,000 deductible',
            'Maximum liability coverage',
            'Full comprehensive protection',
            'Theft & vandalism',
            'Roadside assistance',
        ],
    },
];

// Helper function to get user-friendly booking status messages
const getBookingStatusMessage = (status: string, approvalType: string) => {
    switch (status) {
        case 'AUTO_APPROVED':
            return '🎉 Great news! Your booking has been automatically approved and confirmed. You can proceed with your trip!';
        case 'PENDING':
            if (approvalType === 'manual') {
                return '📋 Your booking request has been sent to the host for review. You will be notified once they respond.';
            }
            return '📋 Your booking is being processed. Please wait for confirmation.';
        case 'CONFIRMED':
            return '✅ Your booking has been confirmed! Check your email for trip details.';
        default:
            return '✅ Your booking has been submitted successfully!';
    }
};

// Helper function to determine the type of date overlap for debugging
const getOverlapType = (
    reqStart: Date,
    reqEnd: Date,
    existingStart: Date,
    existingEnd: Date,
): string => {
    // Check for exact overlap scenarios
    if (existingStart <= reqStart && existingEnd > reqStart) {
        return 'starts_before_ends_after_start';
    }
    if (existingStart < reqEnd && existingEnd >= reqEnd) {
        return 'starts_before_end_ends_after_end';
    }
    if (existingStart >= reqStart && existingEnd <= reqEnd) {
        return 'completely_within_requested';
    }
    if (reqStart >= existingStart && reqEnd <= existingEnd) {
        return 'requested_completely_within_existing';
    }
    return 'no_actual_overlap';
};

export default function VehicleDetailPage() {
    const router = useRouter();
    const params = useParams();
    const vehicleId = params.id as string;

    console.log(
        '🚗 VehicleDetailPage: Initializing with vehicleId:',
        vehicleId,
        'at',
        new Date().toLocaleTimeString(),
    );

    const [vehicle, setVehicle] = useState<CarWithDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [canRent, setCanRent] = useState(true);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [locationDisplay, setLocationDisplay] = useState<string>('Loading location...');
    const [bookingData, setBookingData] = useState<BookingData>({
        startDate: '',
        endDate: '',
        startTime: '10:00',
        endTime: '10:00',
        pickupLocation: '',
        dropoffLocation: '',
        insuranceType: 'STANDARD',
        specialInstructions: '',
    });
    const [dateError, setDateError] = useState<string | null>(null);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilityError, setAvailabilityError] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);

    // Ref to track if we're already fetching data to prevent duplicate calls
    const isFetchingRef = useRef(false);
    const lastFetchedVehicleIdRef = useRef<string | null>(null);
    // AbortController to cancel ongoing requests when component unmounts or vehicleId changes
    const abortControllerRef = useRef<AbortController | null>(null);

    const checkRentPermissionAndFetchVehicle = useCallback(async () => {
        console.log(
            '🔍 checkRentPermissionAndFetchVehicle: Starting vehicle fetch for ID:',
            vehicleId,
        );

        // Prevent duplicate calls - check if we're already fetching this vehicle
        if (isFetchingRef.current && lastFetchedVehicleIdRef.current === vehicleId) {
            console.log('🚫 Skipping duplicate fetch request for vehicleId:', vehicleId);
            return;
        }

        // If we're already fetching a different vehicle, cancel it and start new request
        if (isFetchingRef.current && lastFetchedVehicleIdRef.current !== vehicleId) {
            console.log(
                '⚠️ Canceling previous fetch for:',
                lastFetchedVehicleIdRef.current,
                'to fetch:',
                vehicleId,
            );
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        }

        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();
        isFetchingRef.current = true;
        lastFetchedVehicleIdRef.current = vehicleId;

        try {
            const roles = await getCurrentUserRoles();
            console.log('👤 User roles retrieved:', roles);
            setCanRent(roles ? canUserRent(roles) : false);
            console.log('✅ Can user rent:', roles ? canUserRent(roles) : false);

            const supabase = createClient();
            console.log('🔌 Supabase client created successfully');

            // Fetch vehicle with images and host info
            console.log('📡 Fetching vehicle data from database...');
            const { data: vehicleData, error: vehicleError } = await supabase
                .from('cars')
                .select(
                    `
          *,
          car_images (
            id,
            image_url,
            image_type,
            is_primary,
            display_order
          ),
          host:user_profiles!cars_host_id_fkey (
            id,
            full_name,
            profile_image_url,
            created_at
          )
        `,
                )
                .eq('id', vehicleId)
                .eq('status', 'ACTIVE')
                .single();

            console.log('📊 Vehicle query result:', {
                hasData: !!vehicleData,
                hasError: !!vehicleError,
                errorCode: vehicleError?.code,
                errorMessage: vehicleError?.message,
                vehicleId: vehicleData?.id,
                vehicleMake: vehicleData?.make,
                vehicleModel: vehicleData?.model,
                imageCount: vehicleData?.car_images?.length || 0,
                hostId: vehicleData?.host_id,
                hostName: vehicleData?.host?.full_name,
            });

            if (vehicleError) {
                console.error('❌ Vehicle fetch error:', {
                    code: vehicleError.code,
                    message: vehicleError.message,
                    details: vehicleError.details,
                    hint: vehicleError.hint,
                });

                if (vehicleError.code === 'PGRST116') {
                    setError('Vehicle not found or not available for booking.');
                } else {
                    setError('Failed to load vehicle details.');
                }
                return;
            }

            // Sort images by display order, with primary first
            if (vehicleData.car_images) {
                console.log('🖼️ Processing vehicle images:', vehicleData.car_images.length);
                vehicleData.car_images.sort((a: CarImage, b: CarImage) => {
                    if (a.is_primary && !b.is_primary) return -1;
                    if (!a.is_primary && b.is_primary) return 1;
                    return a.display_order - b.display_order;
                });
                console.log(
                    '🖼️ Images sorted, primary image index:',
                    vehicleData.car_images.findIndex((img: CarImage) => img.is_primary),
                );
            }

            setVehicle(vehicleData as CarWithDetails);
            console.log('✅ Vehicle data set successfully:', {
                id: vehicleData.id,
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                dailyRate: vehicleData.daily_rate,
                weeklyRate: vehicleData.weekly_rate,
                monthlyRate: vehicleData.monthly_rate,
                minimumTripDuration: vehicleData.minimum_trip_duration,
                imageCount: vehicleData.car_images?.length || 0,
            });

            // Set location display and default pickup location
            if (vehicleData.location) {
                console.log('📍 Processing vehicle location:', vehicleData.location);
                try {
                    // Format location for display
                    const displayLocation = await formatLocationDisplay(vehicleData.location);
                    console.log('📍 Formatted display location:', displayLocation);
                    setLocationDisplay(displayLocation);

                    // Set default pickup location from vehicle location
                    const fullAddress = await getFullAddressString(vehicleData.location);
                    console.log('📍 Full address string:', fullAddress);
                    setBookingData((prev) => ({
                        ...prev,
                        pickupLocation: fullAddress,
                        dropoffLocation: fullAddress,
                    }));
                } catch (error) {
                    console.error('❌ Error formatting location:', error);
                    setLocationDisplay('Location not available');
                }
            } else {
                console.log('⚠️ No location data available for vehicle');
                setLocationDisplay('Location not specified');
            }
        } catch (error) {
            // Check if error was due to request being aborted
            if ((error as any)?.name === 'AbortError') {
                console.log('🚫 Request was cancelled for vehicleId:', vehicleId);
                return; // Don't set error state for cancelled requests
            }
            console.error('❌ Error loading vehicle:', error);
            setError('An unexpected error occurred.');
        } finally {
            setLoading(false);
            isFetchingRef.current = false; // Reset the fetching flag
            console.log('✅ Vehicle loading process completed');
        }
    }, [vehicleId]); // vehicleId is the only external dependency - state setters are stable in React

    useEffect(() => {
        if (vehicleId) {
            console.log(
                '🔄 useEffect: Vehicle ID changed, calling checkRentPermissionAndFetchVehicle',
            );
            checkRentPermissionAndFetchVehicle();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicleId]); // Only depend on vehicleId to prevent infinite loops

    // Cleanup: Cancel any ongoing requests when component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                console.log('🧹 Cancelled ongoing vehicle fetch request on component unmount');
            }
        };
    }, []);

    const checkAvailability = async () => {
        console.log('🔍 checkAvailability: Starting availability check');
        console.log('📅 Booking data for availability check:', {
            startDate: bookingData.startDate,
            endDate: bookingData.endDate,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            vehicleId: vehicle?.id,
        });

        if (!vehicle || !bookingData.startDate || !bookingData.endDate) {
            console.log('❌ Availability check failed: Missing required data');
            return false;
        }

        setAvailabilityLoading(true);
        setAvailabilityError(null);

        try {
            const supabase = createClient();
            const startDateTime = new Date(`${bookingData.startDate}T${bookingData.startTime}`);
            const endDateTime = new Date(`${bookingData.endDate}T${bookingData.endTime}`);

            console.log('⏰ Calculated date times:', {
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                startDateTimeLocal: startDateTime.toString(),
                endDateTimeLocal: endDateTime.toString(),
            });

            // Check for conflicting bookings - Fixed logic for proper overlap detection
            console.log('🔍 Checking for conflicting bookings...');
            console.log('🔍 Checking date range:', {
                requestedStart: startDateTime.toISOString(),
                requestedEnd: endDateTime.toISOString(),
            });

            const { data: conflictingBookings, error } = await supabase
                .from('bookings')
                .select('id, start_date, end_date, status, renter_id')
                .eq('car_id', vehicle.id)
                .neq('status', 'CANCELLED')
                .or(
                    // Case 1: Existing booking starts before or during requested period and ends after start
                    `and(start_date.lte.${startDateTime.toISOString()},end_date.gt.${startDateTime.toISOString()}),` +
                        // Case 2: Existing booking starts before end and ends after or during requested period
                        `and(start_date.lt.${endDateTime.toISOString()},end_date.gte.${endDateTime.toISOString()}),` +
                        // Case 3: Existing booking is completely within requested period
                        `and(start_date.gte.${startDateTime.toISOString()},end_date.lte.${endDateTime.toISOString()})`,
                );

            console.log('📊 Conflicting bookings query result:', {
                hasData: !!conflictingBookings,
                hasError: !!error,
                errorCode: error?.code,
                errorMessage: error?.message,
                conflictingCount: conflictingBookings?.length || 0,
                conflictingBookings: conflictingBookings,
            });

            // Debug: Log detailed conflict analysis if conflicts found
            if (conflictingBookings && conflictingBookings.length > 0) {
                console.log('🔍 DETAILED CONFLICT ANALYSIS:');
                conflictingBookings.forEach((booking, index) => {
                    const existingStart = new Date(booking.start_date);
                    const existingEnd = new Date(booking.end_date);
                    console.log(`📅 Conflict ${index + 1}:`, {
                        bookingId: booking.id,
                        status: booking.status,
                        existingStart: existingStart.toISOString(),
                        existingEnd: existingEnd.toISOString(),
                        existingStartLocal: existingStart.toString(),
                        existingEndLocal: existingEnd.toString(),
                        requestedStart: startDateTime.toISOString(),
                        requestedEnd: endDateTime.toISOString(),
                        overlapType: getOverlapType(
                            startDateTime,
                            endDateTime,
                            existingStart,
                            existingEnd,
                        ),
                    });
                });
            }

            if (error) {
                console.error('❌ Error checking availability:', error);
                setAvailabilityError('Unable to check availability. Please try again.');
                return false;
            }

            // Check if there are any conflicting bookings
            if (conflictingBookings && conflictingBookings.length > 0) {
                const activeConflicts = conflictingBookings.filter(
                    (booking) => booking.status !== 'CANCELLED',
                );

                console.log('⚠️ Found conflicting bookings:', {
                    totalConflicts: conflictingBookings.length,
                    activeConflicts: activeConflicts.length,
                    conflicts: activeConflicts,
                });

                if (activeConflicts.length > 0) {
                    // Create a more informative error message
                    const conflictDetails = activeConflicts
                        .map((booking) => {
                            const start = new Date(booking.start_date).toLocaleDateString();
                            const end = new Date(booking.end_date).toLocaleDateString();
                            return `${start} to ${end} (${booking.status})`;
                        })
                        .join(', ');

                    setAvailabilityError(
                        `Vehicle not available for selected dates. Conflicting bookings: ${conflictDetails}`,
                    );
                    return false;
                }
            }

            console.log('✅ Availability check passed - no conflicts found');
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

    // Pure calculation function without side effects
    const calculateBookingCostPure = useCallback(
        (
            vehicleData: CarWithDetails | null,
            startDateStr: string,
            endDateStr: string,
            insuranceType: 'BASIC' | 'STANDARD' | 'PREMIUM',
        ) => {
            console.log('💰 calculateBookingCostPure: Starting cost calculation');
            console.log('📅 Booking data for cost calculation:', {
                startDate: startDateStr,
                endDate: endDateStr,
                vehicleId: vehicleData?.id,
                vehicleDailyRate: vehicleData?.daily_rate,
                vehicleWeeklyRate: vehicleData?.weekly_rate,
                vehicleMonthlyRate: vehicleData?.monthly_rate,
            });

            const defaultResult = {
                days: 0,
                subtotal: 0,
                insuranceFee: 0,
                serviceFee: 0,
                total: 0,
                discountApplied: null,
                originalCost: 0,
                savings: 0,
                pricing: {
                    subtotal: 0,
                    effectiveRate: 0,
                    rateType: 'daily' as const,
                    discountApplied: null,
                    originalCost: 0,
                    savings: 0,
                },
                dateError: null as string | null,
            };

            if (!vehicleData || !startDateStr || !endDateStr) {
                console.log('❌ Cost calculation failed: Missing required data');
                return defaultResult;
            }

            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);

            // Enhanced validation with user-friendly messages
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                console.log('❌ Invalid date format');
                return { ...defaultResult, dateError: 'Please select valid dates' };
            }

            if (startDate >= endDate) {
                console.log('❌ Start date must be before end date');
                return {
                    ...defaultResult,
                    dateError: 'End date must be after start date',
                };
            }

            const days = Math.ceil(
                (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
            );

            console.log('📅 Date calculation:', {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                calculatedDays: days,
            });

            if (days <= 0) {
                console.log('❌ Invalid date range: days <= 0');
                return { ...defaultResult, dateError: 'Invalid date range selected' };
            }

            // Use the new tiered pricing calculation
            // Convert weekly_rate and monthly_rate (total prices) to daily rates
            const weeklyDailyRate = vehicleData.weekly_rate ? vehicleData.weekly_rate / 7 : null;
            const monthlyDailyRate = vehicleData.monthly_rate
                ? vehicleData.monthly_rate / 30
                : null;

            console.log('💰 Rate calculations:', {
                dailyRate: vehicleData.daily_rate,
                weeklyDailyRate: weeklyDailyRate,
                monthlyDailyRate: monthlyDailyRate,
                days: days,
            });

            const pricing = calculateTieredRent(
                vehicleData.daily_rate,
                weeklyDailyRate,
                monthlyDailyRate,
                days,
            );

            console.log('💰 Tiered pricing result:', pricing);

            const insuranceOption = INSURANCE_OPTIONS.find((opt) => opt.type === insuranceType);
            const insuranceFee = (insuranceOption?.price || 0) * days;
            const serviceFee = pricing.subtotal * 0.1; // 10% service fee
            const total = pricing.subtotal + insuranceFee + serviceFee;

            const result = {
                days,
                subtotal: pricing.subtotal,
                insuranceFee: Math.round(insuranceFee * 100) / 100,
                serviceFee: Math.round(serviceFee * 100) / 100,
                total: Math.round(total * 100) / 100,
                discountApplied: pricing.discountApplied,
                originalCost: pricing.originalCost,
                savings: pricing.savings,
                pricing,
                dateError: null as string | null,
            };

            console.log('💰 Final cost calculation result:', result);
            return result;
        },
        [],
    );

    // Memoized cost calculation that doesn't trigger re-renders
    const costCalculation = useMemo(() => {
        return calculateBookingCostPure(
            vehicle,
            bookingData.startDate,
            bookingData.endDate,
            bookingData.insuranceType,
        );
    }, [
        calculateBookingCostPure,
        vehicle,
        bookingData.startDate,
        bookingData.endDate,
        bookingData.insuranceType,
    ]);

    // Update dateError state when calculation changes (separate from render)
    useEffect(() => {
        if (costCalculation.dateError !== dateError) {
            setDateError(costCalculation.dateError);
        }
    }, [costCalculation.dateError, dateError]);

    // Legacy function for compatibility with existing handleBookingSubmit

    const handleBookingSubmit = async () => {
        console.log('🚀 handleBookingSubmit: Starting booking submission process');
        console.log('📋 Current booking state:', {
            vehicleId: vehicle?.id,
            canRent: canRent,
            bookingData: bookingData,
            showBookingModal: showBookingModal,
        });

        if (!vehicle || !canRent) {
            console.log('❌ Booking submission failed: Missing vehicle or user cannot rent');
            return;
        }

        const cost = costCalculation;
        console.log('💰 Cost calculation for booking:', cost);

        if (cost.days <= 0) {
            console.log('❌ Invalid booking: days <= 0');
            alert('Please select valid dates.');
            return;
        }

        if (cost.days < vehicle.minimum_trip_duration) {
            console.log('❌ Booking duration too short:', {
                requestedDays: cost.days,
                minimumRequired: vehicle.minimum_trip_duration,
            });
            alert(`Minimum trip duration is ${vehicle.minimum_trip_duration} day(s).`);
            return;
        }

        setBookingLoading(true);
        console.log('⏳ Setting booking loading state to true');

        try {
            const supabase = createClient();
            console.log('🔌 Supabase client created for booking submission');

            const {
                data: { user },
            } = await supabase.auth.getUser();

            console.log('👤 User authentication check:', {
                hasUser: !!user,
                userId: user?.id,
                userEmail: user?.email,
            });

            if (!user) {
                console.log('❌ No authenticated user found, redirecting to login');
                router.push('/login');
                return;
            }

            const startDateTime = new Date(`${bookingData.startDate}T${bookingData.startTime}`);
            const endDateTime = new Date(`${bookingData.endDate}T${bookingData.endTime}`);

            console.log('⏰ Final date times for booking:', {
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                startDateTimeLocal: startDateTime.toString(),
                endDateTimeLocal: endDateTime.toString(),
            });

            // First check availability using the database function
            console.log('🔍 Performing final availability check via database function...');
            const { data: availabilityResult, error: availabilityError } = await supabase.rpc(
                'check_vehicle_availability',
                {
                    p_car_id: vehicle.id,
                    p_start_date: startDateTime.toISOString(),
                    p_end_date: endDateTime.toISOString(),
                },
            );

            console.log('📊 Database availability check result:', {
                hasData: !!availabilityResult,
                hasError: !!availabilityError,
                errorCode: availabilityError?.code,
                errorMessage: availabilityError?.message,
                availabilityResult: availabilityResult,
            });

            if (availabilityError) {
                console.error('❌ Availability check error:', availabilityError);
                alert('Failed to check vehicle availability. Please try again.');
                return;
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

                alert(errorMessage);
                return;
            }

            console.log('✅ Availability check passed, proceeding with booking creation');

            // Use the enhanced booking function with business rules
            // Temporarily using NULL for locations to avoid validation issues
            const bookingPayload = {
                car_id: vehicle.id,
                renter_id: user.id,
                host_id: vehicle.host_id,
                start_date: startDateTime.toISOString(),
                end_date: endDateTime.toISOString(),
                pickup_location: null, // TODO: Implement proper Indonesian address format
                dropoff_location: null, // TODO: Implement proper Indonesian address format
                insurance_type: bookingData.insuranceType,
                daily_rate: cost.pricing.effectiveRate,
                total_days: cost.days,
                subtotal: cost.subtotal,
                insurance_fee: cost.insuranceFee,
                service_fee: cost.serviceFee,
                delivery_fee: 0, // TODO: Calculate delivery fee if applicable
                total_amount: cost.total,
                security_deposit: 0, // Security deposit removed
                special_instructions: bookingData.specialInstructions || null,
            };

            // Debug logging for booking payload
            console.log('📦 Booking payload being sent:', JSON.stringify(bookingPayload, null, 2));
            console.log('👤 User ID:', user?.id);
            console.log('🚗 Vehicle ID:', vehicle?.id);
            console.log('🔌 Supabase client status:', !!supabase);

            console.log('🚀 Calling create_booking_with_business_rules RPC function...');
            const { data: bookingResult, error } = await supabase.rpc(
                'create_booking_with_business_rules',
                {
                    p_booking_data: bookingPayload,
                },
            );

            // Debug logging for the response
            console.log('📊 Raw booking result:', bookingResult);
            console.log('❌ Supabase error object:', error);
            console.log('📊 Booking result type:', typeof bookingResult);
            console.log('📊 Booking result is array:', Array.isArray(bookingResult));
            console.log('📊 Booking result length:', bookingResult?.length);

            if (error) {
                console.error('❌ Error creating booking:', {
                    error: error,
                    errorCode: error.code,
                    errorMessage: error.message,
                    errorDetails: error.details,
                    errorHint: error.hint,
                });
                alert('Failed to create booking. Please try again.');
                return;
            }

            // Enhanced validation of booking result
            console.log('🔍 Booking result validation:');
            console.log('- bookingResult exists:', !!bookingResult);
            console.log('- bookingResult is array:', Array.isArray(bookingResult));
            console.log('- bookingResult length:', bookingResult?.length);
            console.log('- first result:', bookingResult?.[0]);
            console.log('- first result type:', typeof bookingResult?.[0]);
            console.log(
                '- first result keys:',
                bookingResult?.[0] ? Object.keys(bookingResult[0]) : 'N/A',
            );

            if (!bookingResult || !Array.isArray(bookingResult) || bookingResult.length === 0) {
                console.error('❌ Invalid booking result structure:', {
                    bookingResult: bookingResult,
                    isArray: Array.isArray(bookingResult),
                    length: bookingResult?.length,
                });
                alert('Invalid response from server. Please try again.');
                return;
            }

            const firstResult = bookingResult[0];
            console.log('📊 First booking result details:', {
                success: firstResult?.success,
                bookingId: firstResult?.booking_id,
                status: firstResult?.status,
                approvalType: firstResult?.approval_type,
                message: firstResult?.message,
                details: firstResult?.details,
            });

            if (!firstResult?.success) {
                const errorMessage =
                    firstResult?.message ||
                    'Failed to create booking. Please check your booking details and try again.';
                console.error('❌ Booking failed with message:', errorMessage);
                console.error('❌ Full booking result for failed booking:', bookingResult);
                alert(errorMessage);
                return;
            }

            console.log('✅ Booking created successfully:', {
                bookingId: firstResult.booking_id,
                status: firstResult.status,
                approvalType: firstResult.approval_type,
                message: firstResult.message,
            });

            // Show booking status message
            const statusMessage = getBookingStatusMessage(
                firstResult.status,
                firstResult.approval_type || '',
            );
            console.log('📢 Status message to show user:', statusMessage);
            alert(statusMessage);

            // Redirect to booking confirmation or payment page
            console.log(
                '🔄 Redirecting to booking confirmation page:',
                `/bookings/${firstResult.booking_id}`,
            );
            router.push(`/bookings/${firstResult.booking_id}`);
        } catch (error: any) {
            // Enhanced error logging for debugging
            console.error('❌ Error creating booking - Full error object:', error);
            console.error('❌ Error message:', error?.message || 'No error message');
            console.error('❌ Error stack:', error?.stack);
            console.error('❌ Error details:', error?.details);
            console.error('❌ Error hint:', error?.hint);
            console.error('❌ Error code:', error?.code);
            console.error('❌ Error name:', error?.name);

            // Try to stringify the error for better visibility
            try {
                console.error('❌ Error stringified:', JSON.stringify(error, null, 2));
            } catch (stringifyError) {
                console.error('❌ Could not stringify error:', stringifyError);
            }

            // Provide more specific error message to user
            const errorMessage =
                error?.message ||
                error?.details ||
                'An unexpected error occurred. Please try again.';
            console.error('❌ Final error message for user:', errorMessage);
            alert(`Booking failed: ${errorMessage}`);
        } finally {
            setBookingLoading(false);
            console.log('✅ Booking submission process completed');
        }
    };

    const nextImage = () => {
        if (vehicle?.car_images && vehicle.car_images.length > 1) {
            setCurrentImageIndex((prev) => (prev === vehicle.car_images.length - 1 ? 0 : prev + 1));
        }
    };

    const prevImage = () => {
        if (vehicle?.car_images && vehicle.car_images.length > 1) {
            setCurrentImageIndex((prev) => (prev === 0 ? vehicle.car_images.length - 1 : prev - 1));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading vehicle details...</p>
                </div>
            </div>
        );
    }

    if (error || !vehicle) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || 'Vehicle not found'}</p>
                    <Link
                        href="/search"
                        className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                        Back to Search
                    </Link>
                </div>
            </div>
        );
    }

    const cost = costCalculation;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link href="/home" className="text-2xl font-bold text-black">
                                REBIL
                            </Link>
                            <span className="text-gray-400">/</span>
                            <Link href="/search" className="text-gray-600 hover:text-black">
                                Search
                            </Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600">Vehicle Details</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/search"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Back to Search
                            </Link>
                            <Link
                                href="/profile"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Profile
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Vehicle Images and Details */}
                    <div className="lg:col-span-2">
                        {/* Image Gallery */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                            <div className="relative aspect-video bg-gray-200">
                                {vehicle.car_images && vehicle.car_images.length > 0 ? (
                                    <>
                                        <img
                                            src={vehicle.car_images[currentImageIndex].image_url}
                                            alt={`${vehicle.make} ${vehicle.model}`}
                                            className="w-full h-full object-cover"
                                        />

                                        {vehicle.car_images.length > 1 && (
                                            <>
                                                <button
                                                    onClick={prevImage}
                                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full p-3 transition-all shadow-lg"
                                                >
                                                    ←
                                                </button>
                                                <button
                                                    onClick={nextImage}
                                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full p-3 transition-all shadow-lg"
                                                >
                                                    →
                                                </button>
                                            </>
                                        )}

                                        {/* Image Counter */}
                                        {vehicle.car_images.length > 1 && (
                                            <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm">
                                                {currentImageIndex + 1} /{' '}
                                                {vehicle.car_images.length}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-6xl">
                                        🚗
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail Row */}
                            {vehicle.car_images && vehicle.car_images.length > 1 && (
                                <div className="p-4 flex space-x-2 overflow-x-auto">
                                    {vehicle.car_images.map((image, index) => (
                                        <button
                                            key={image.id}
                                            onClick={() => setCurrentImageIndex(index)}
                                            className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                                index === currentImageIndex
                                                    ? 'border-black'
                                                    : 'border-gray-300'
                                            }`}
                                        >
                                            <img
                                                src={image.image_url}
                                                alt={`Thumbnail ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Vehicle Information */}
                        <div className="bg-white rounded-2xl shadow-xl p-8">
                            <div className="mb-6">
                                <h1 className="text-3xl font-bold text-black mb-2">
                                    {vehicle.make} {vehicle.model} ({vehicle.year})
                                </h1>
                                <div className="flex items-center text-gray-600 space-x-4">
                                    <span>{vehicle.color}</span>
                                    <span>•</span>
                                    <span>{vehicle.transmission}</span>
                                    <span>•</span>
                                    <span>{vehicle.fuel_type}</span>
                                    <span>•</span>
                                    <span>{vehicle.seats} seats</span>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-black mb-3">
                                    Description
                                </h3>
                                <p className="text-gray-700 leading-relaxed">
                                    {vehicle.description}
                                </p>
                            </div>

                            {/* Features */}
                            {vehicle.features && vehicle.features.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-xl font-semibold text-black mb-3">
                                        Features
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {vehicle.features.map((feature, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center space-x-2"
                                            >
                                                <span className="text-green-500">✓</span>
                                                <span className="text-gray-700">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Host Information */}
                            <div className="border-t pt-6">
                                <h3 className="text-xl font-semibold text-black mb-3">Hosted by</h3>
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                                        {vehicle.host.profile_image_url ? (
                                            <img
                                                src={vehicle.host.profile_image_url}
                                                alt={vehicle.host.full_name || 'Host'}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-xl">👤</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-black">
                                            {vehicle.host.full_name || 'Host'}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Member since{' '}
                                            {new Date(vehicle.host.created_at).getFullYear()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booking Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
                            <div className="mb-6">
                                <div className="flex items-baseline space-x-2">
                                    <span className="text-3xl font-bold text-black">
                                        {formatDailyRate(vehicle.daily_rate)}
                                    </span>
                                    <span className="text-lg text-gray-600">/day</span>
                                </div>

                                {/* Pricing Tiers */}
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">Daily Rate (1-6 days)</span>
                                        <span className="font-semibold text-black">
                                            {formatDailyRate(vehicle.daily_rate)}
                                        </span>
                                    </div>

                                    {vehicle.weekly_rate && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-700">
                                                Weekly Rate (7-29 days)
                                            </span>
                                            <span className="font-semibold text-green-600">
                                                {formatDailyRate(vehicle.weekly_rate / 7)}
                                            </span>
                                        </div>
                                    )}

                                    {vehicle.monthly_rate && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-700">
                                                Monthly Rate (30+ days)
                                            </span>
                                            <span className="font-semibold text-green-600">
                                                {formatDailyRate(vehicle.monthly_rate / 30)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-sm text-gray-600">
                                        <span className="text-green-600 font-medium">💡 </span>
                                        Longer rentals get better rates automatically
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Minimum {vehicle.minimum_trip_duration} day(s)
                                    </p>
                                </div>
                            </div>

                            {!canRent ? (
                                <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                                    <p className="text-yellow-800 text-sm font-medium">
                                        Booking is restricted for your account type. Only renters
                                        can book vehicles.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Quick Date Selection */}
                                    <div className="space-y-4 mb-6">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Start Date
                                                </label>
                                                <input
                                                    type="text"
                                                    value={bookingData.startDate || ''}
                                                    readOnly
                                                    onFocus={() => setShowCalendar(true)}
                                                    onClick={() => setShowCalendar(true)}
                                                    placeholder="Select start date"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    End Date
                                                </label>
                                                <input
                                                    type="text"
                                                    value={bookingData.endDate || ''}
                                                    readOnly
                                                    onFocus={() => setShowCalendar(true)}
                                                    onClick={() => setShowCalendar(true)}
                                                    placeholder="Select end date"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Date Error Display */}
                                        {dateError && (
                                            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                                                <p className="text-red-800 text-sm font-medium">
                                                    {dateError}
                                                </p>
                                            </div>
                                        )}

                                        {/* Cost Breakdown */}
                                        {cost.days > 0 && !dateError && (
                                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                                <div className="flex justify-between text-sm text-gray-900">
                                                    <span>
                                                        {formatDailyRate(
                                                            cost.pricing.effectiveRate,
                                                        )}{' '}
                                                        × {cost.days} days
                                                        {cost.pricing.rateType !== 'daily' && (
                                                            <span className="text-green-600 text-xs ml-1">
                                                                (
                                                                {cost.pricing.rateType === 'weekly'
                                                                    ? 'weekly rate'
                                                                    : 'monthly rate'}
                                                                )
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span
                                                        className={
                                                            cost.originalCost > cost.subtotal
                                                                ? 'line-through text-gray-500'
                                                                : 'text-gray-900'
                                                        }
                                                    >
                                                        {formatCurrency(
                                                            cost.originalCost || cost.subtotal,
                                                        )}
                                                    </span>
                                                </div>
                                                {cost.discountApplied && cost.savings > 0 && (
                                                    <div className="flex justify-between text-sm text-green-600">
                                                        <span>{cost.discountApplied}</span>
                                                        <span>-{formatCurrency(cost.savings)}</span>
                                                    </div>
                                                )}
                                                {cost.discountApplied && (
                                                    <div className="flex justify-between text-sm font-medium text-gray-900">
                                                        <span>Subtotal after discount</span>
                                                        <span>{formatCurrency(cost.subtotal)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm text-gray-900">
                                                    <span>Service fee</span>
                                                    <span>{formatCurrency(cost.serviceFee)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm text-gray-900">
                                                    <span>Insurance (estimated)</span>
                                                    <span>{formatCurrency(cost.insuranceFee)}</span>
                                                </div>
                                                <div className="border-t pt-2 flex justify-between font-semibold text-gray-900">
                                                    <span>Total</span>
                                                    <span>{formatCurrency(cost.total)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        onClick={async () => {
                                            const isAvailable = await checkAvailability();
                                            if (isAvailable) {
                                                setShowBookingModal(true);
                                            }
                                        }}
                                        disabled={
                                            !bookingData.startDate ||
                                            !bookingData.endDate ||
                                            !!dateError ||
                                            cost.days < vehicle.minimum_trip_duration ||
                                            availabilityLoading
                                        }
                                        className="w-full mb-4"
                                    >
                                        {availabilityLoading
                                            ? 'Checking Availability...'
                                            : 'Book Now'}
                                    </Button>

                                    {/* Show availability error */}
                                    {availabilityError && (
                                        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                                            <p className="text-red-800 text-sm font-medium">
                                                {availabilityError}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Additional Info */}
                            <div className="text-sm text-gray-600 space-y-2">
                                {vehicle.delivery_available && (
                                    <p>
                                        🚚 Pengantaran tersedia dengan biaya{' '}
                                        {formatCurrency(vehicle.delivery_fee)}
                                        (within {vehicle.delivery_radius}km)
                                    </p>
                                )}
                                <p>📍 Located in {locationDisplay}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            {showBookingModal && canRent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-black">
                                    Complete Your Booking
                                </h2>
                                <button
                                    onClick={() => setShowBookingModal(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-6 space-y-6">
                            {/* Trip Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-black mb-4">
                                    Trip Details
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Pickup Time
                                        </label>
                                        <input
                                            type="time"
                                            value={bookingData.startTime}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    startTime: e.target.value,
                                                }))
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Return Time
                                        </label>
                                        <input
                                            type="time"
                                            value={bookingData.endTime}
                                            onChange={(e) =>
                                                setBookingData((prev) => ({
                                                    ...prev,
                                                    endTime: e.target.value,
                                                }))
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Insurance Selection */}
                            <div>
                                <h3 className="text-lg font-semibold text-black mb-4">
                                    Choose Protection Plan
                                </h3>
                                <div className="space-y-3">
                                    {INSURANCE_OPTIONS.map((option) => (
                                        <label
                                            key={option.type}
                                            className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                                                bookingData.insuranceType === option.type
                                                    ? 'border-black bg-gray-50'
                                                    : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start space-x-3">
                                                    <input
                                                        type="radio"
                                                        name="insurance"
                                                        value={option.type}
                                                        checked={
                                                            bookingData.insuranceType ===
                                                            option.type
                                                        }
                                                        onChange={(e) =>
                                                            setBookingData((prev) => ({
                                                                ...prev,
                                                                insuranceType: e.target
                                                                    .value as typeof option.type,
                                                            }))
                                                        }
                                                        className="mt-1"
                                                    />
                                                    <div>
                                                        <div className="font-semibold text-black">
                                                            {option.name}
                                                        </div>
                                                        <div className="text-sm text-gray-600 mb-2">
                                                            {option.description}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {option.features.map(
                                                                (feature, index) => (
                                                                    <div key={index}>
                                                                        • {feature}
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold text-black">
                                                        {formatCurrency(option.price)}
                                                        /day
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {formatCurrency(option.price * cost.days)}{' '}
                                                        total
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Special Instructions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Special Instructions (Optional)
                                </label>
                                <textarea
                                    value={bookingData.specialInstructions}
                                    onChange={(e) =>
                                        setBookingData((prev) => ({
                                            ...prev,
                                            specialInstructions: e.target.value,
                                        }))
                                    }
                                    rows={3}
                                    placeholder="Any special requests or instructions for the host..."
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800 placeholder-gray-500 resize-none"
                                />
                            </div>

                            {/* Final Cost Summary */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-semibold text-black mb-3">Booking Summary</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">
                                            Vehicle rental ({cost.days} days)
                                        </span>
                                        <span className="text-black">
                                            {formatCurrency(cost.subtotal)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Protection plan</span>
                                        <span className="text-black">
                                            {formatCurrency(cost.insuranceFee)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Service fee</span>
                                        <span className="text-black">
                                            {formatCurrency(cost.serviceFee)}
                                        </span>
                                    </div>

                                    <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                                        <span className="text-black">Total Amount</span>
                                        <span className="text-black">
                                            {formatCurrency(cost.total)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-gray-200">
                                <Button
                                    onClick={handleBookingSubmit}
                                    disabled={
                                        bookingLoading || cost.days < vehicle.minimum_trip_duration
                                    }
                                    className="flex-1"
                                >
                                    {bookingLoading ? 'Processing...' : 'Confirm Booking'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowBookingModal(false)}
                                    disabled={bookingLoading}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Availability Calendar Modal */}
            {showCalendar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-4">
                        <div className="flex items-center justify-between pb-2 border-b">
                            <h3 className="text-lg font-semibold text-black">Select Dates</h3>
                            <button
                                onClick={() => setShowCalendar(false)}
                                className="text-gray-500 hover:text-black"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="pt-4">
                            <AvailabilityCalendar
                                carId={vehicle.id}
                                startDate={bookingData.startDate}
                                endDate={bookingData.endDate}
                                onChange={(range) => {
                                    if (!range) return;
                                    const { startDate, endDate } = range;
                                    setDateError(null);
                                    setBookingData((prev) => ({
                                        ...prev,
                                        startDate,
                                        endDate,
                                    }));
                                    if (startDate && endDate) setShowCalendar(false);
                                }}
                                monthsToShow={2}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
