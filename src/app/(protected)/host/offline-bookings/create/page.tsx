'use client';

import { AlertTriangle, ArrowLeft, Car, CheckCircle, Clock, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';

import AvailabilityCalendar from '@/components/base/AvailabilityCalendar';
import { getCurrentUserRoles } from '@/lib/auth/userRoles';
import { createClient } from '@/lib/supabase/supabaseClient';
import { Tables } from '@/types/base/database.types';

type Vehicle = Tables<'cars'>;

interface CustomerInfo {
    fullName: string;
    email: string;
    phone: string;
    driverLicense: string;
    emergencyContact: string;
    emergencyPhone: string;
    notes: string;
}

interface BookingDetails {
    vehicleId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    dailyRate: number;
    totalAmount: number;
    deposit: number;
    pickupTime: string;
    returnTime: string;
    notes: string;
}

const initialCustomerInfo: CustomerInfo = {
    fullName: '',
    email: '',
    phone: '',
    driverLicense: '',
    emergencyContact: '',
    emergencyPhone: '',
    notes: '',
};

const initialBookingDetails: BookingDetails = {
    vehicleId: '',
    startDate: '',
    endDate: '',
    totalDays: 0,
    dailyRate: 0,
    totalAmount: 0,
    deposit: 0,
    pickupTime: '09:00',
    returnTime: '18:00',
    notes: '',
};

export default function CreateOfflineBookingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(initialCustomerInfo);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails>(initialBookingDetails);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(false);
    const [vehiclesLoading, setVehiclesLoading] = useState(true);
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [checkingConflicts, setCheckingConflicts] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isHost, setIsHost] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    // Check host permissions and load vehicles
    useEffect(() => {
        const checkHostPermissionAndFetchVehicles = async () => {
            try {
                const roles = await getCurrentUserRoles();
                if (!roles?.isHost) {
                    router.push('/home');
                    return;
                }
                setIsHost(true);

                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    router.push('/login');
                    return;
                }

                // Fetch active vehicles for the host
                const { data: vehicleData, error: vehicleError } = await supabase
                    .from('cars')
                    .select('*')
                    .eq('host_id', user.id)
                    .eq('status', 'ACTIVE')
                    .order('make', { ascending: true });

                if (vehicleError) {
                    console.error('Error fetching vehicles:', vehicleError);
                    setError('Failed to load vehicles.');
                    return;
                }

                setVehicles(vehicleData || []);
            } catch (error) {
                console.error('Error loading data:', error);
                setError('An unexpected error occurred.');
            } finally {
                setVehiclesLoading(false);
            }
        };

        checkHostPermissionAndFetchVehicles();
    }, [router, supabase]);

    // Calculate total days and amount when dates change
    useEffect(() => {
        if (bookingDetails.startDate && bookingDetails.endDate) {
            const start = new Date(bookingDetails.startDate);
            const end = new Date(bookingDetails.endDate);
            const timeDiff = end.getTime() - start.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            if (daysDiff > 0) {
                const totalAmount = daysDiff * bookingDetails.dailyRate;
                const deposit = Math.round(totalAmount * 0.3); // 30% deposit

                setBookingDetails((prev) => ({
                    ...prev,
                    totalDays: daysDiff,
                    totalAmount,
                    deposit,
                }));
            }
        }
    }, [bookingDetails.startDate, bookingDetails.endDate, bookingDetails.dailyRate]);

    // Update daily rate when vehicle changes
    useEffect(() => {
        if (bookingDetails.vehicleId) {
            const selectedVehicle = vehicles.find((v) => v.id === bookingDetails.vehicleId);
            if (selectedVehicle) {
                setBookingDetails((prev) => ({
                    ...prev,
                    dailyRate: selectedVehicle.daily_rate,
                }));
            }
        }
    }, [bookingDetails.vehicleId, vehicles]);

    // Check for booking conflicts
    const checkBookingConflicts = useCallback(async () => {
        if (!bookingDetails.vehicleId || !bookingDetails.startDate || !bookingDetails.endDate) {
            return;
        }

        setCheckingConflicts(true);
        try {
            const { data: existingBookings, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('car_id', bookingDetails.vehicleId)
                .in('status', ['CONFIRMED', 'AUTO_APPROVED', 'IN_PROGRESS'])
                .lte('start_date', bookingDetails.endDate)
                .gte('end_date', bookingDetails.startDate);

            if (error) throw error;

            setConflicts(existingBookings || []);
        } catch (error) {
            console.error('Error checking conflicts:', error);
        } finally {
            setCheckingConflicts(false);
        }
    }, [bookingDetails.vehicleId, bookingDetails.startDate, bookingDetails.endDate, supabase]);

    useEffect(() => {
        if (bookingDetails.vehicleId && bookingDetails.startDate && bookingDetails.endDate) {
            checkBookingConflicts();
        } else {
            setConflicts([]);
        }
    }, [
        checkBookingConflicts,
        bookingDetails.endDate,
        bookingDetails.startDate,
        bookingDetails.vehicleId,
    ]);

    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {};

        if (step === 1) {
            if (!bookingDetails.vehicleId) errors.vehicleId = 'Please select a vehicle';
            if (!bookingDetails.startDate) errors.startDate = 'Please select start date';
            if (!bookingDetails.endDate) errors.endDate = 'Please select end date';
            if (bookingDetails.startDate && bookingDetails.endDate) {
                const start = new Date(bookingDetails.startDate);
                const end = new Date(bookingDetails.endDate);
                if (start >= end) errors.endDate = 'End date must be after start date';
                if (start < new Date()) errors.startDate = 'Start date cannot be in the past';
            }
            if (conflicts.length > 0)
                errors.conflicts = 'This vehicle is not available for the selected dates';
        }

        if (step === 2) {
            if (!customerInfo.fullName.trim()) errors.fullName = 'Full name is required';
            if (!customerInfo.phone.trim()) errors.phone = 'Phone number is required';
            if (!customerInfo.driverLicense.trim())
                errors.driverLicense = 'Driver license is required';
            if (customerInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
                errors.email = 'Please enter a valid email address';
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handlePrevious = () => {
        setCurrentStep((prev) => prev - 1);
        setValidationErrors({});
    };

    const handleBookingSubmit = async () => {
        if (!validateStep(2)) return;

        setLoading(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const bookingPayload = {
                car_id: bookingDetails.vehicleId,
                renter_id: user.id,
                host_id: user.id,
                start_date: bookingDetails.startDate + 'T' + bookingDetails.pickupTime + ':00',
                end_date: bookingDetails.endDate + 'T' + bookingDetails.returnTime + ':00',
                pickup_location: null,
                dropoff_location: null,
                insurance_type: 'BASIC',
                daily_rate: bookingDetails.dailyRate,
                total_days: bookingDetails.totalDays,
                subtotal: bookingDetails.totalAmount,
                insurance_fee: 0,
                service_fee: 0,
                delivery_fee: 0,
                total_amount: bookingDetails.totalAmount,
                security_deposit: bookingDetails.deposit,
                booking_type: 'OFFLINE',
                special_instructions: JSON.stringify({
                    customer_info: customerInfo,
                    booking_details: {
                        pickup_time: bookingDetails.pickupTime,
                        return_time: bookingDetails.returnTime,
                        deposit: bookingDetails.deposit,
                        notes: bookingDetails.notes,
                    },
                    created_manually: true,
                    is_offline_booking: true,
                    created_at: new Date().toISOString(),
                }),
            };

            console.log('🚀 Creating manual booking with business rules...');
            const { data: bookingResult, error: bookingError } = await supabase.rpc(
                'create_booking_with_business_rules',
                {
                    p_booking_data: bookingPayload,
                },
            );

            if (bookingError) {
                console.error('❌ Error creating manual booking:', bookingError);
                throw bookingError;
            }

            if (!bookingResult || !Array.isArray(bookingResult) || bookingResult.length === 0) {
                console.error('❌ Invalid manual booking result structure:', bookingResult);
                throw new Error('Invalid response from server. Please try again.');
            }

            const firstResult = bookingResult[0];
            if (!firstResult?.success) {
                const errorMessage = firstResult?.message || 'Failed to create manual booking.';
                console.error('❌ Manual booking failed:', errorMessage);
                throw new Error(errorMessage);
            }

            console.log('✅ Manual booking created successfully:', firstResult.booking_id);

            // Success - move to step 4
            setCurrentStep(4);
        } catch (error) {
            console.error('Error creating booking:', error);
            setValidationErrors({ submit: 'Failed to create booking. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const getSelectedVehicle = () => {
        return vehicles.find((v) => v.id === bookingDetails.vehicleId);
    };

    const formatCurrency = (amount: number) => {
        return `Rp ${amount.toLocaleString()}`;
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                    <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                            currentStep >= step
                                ? 'bg-black text-white'
                                : 'bg-gray-300 text-gray-600'
                        }`}
                    >
                        {step}
                    </div>
                    {step < 3 && (
                        <div
                            className={`w-12 h-1 ${
                                currentStep > step ? 'bg-black' : 'bg-gray-300'
                            }`}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <Car className="h-12 w-12 text-black mx-auto mb-3" />
                <h3 className="text-xl font-semibold text-black">Vehicle & Dates</h3>
                <p className="text-gray-600">Select vehicle and rental period</p>
            </div>

            {/* Vehicle Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Vehicle *
                </label>
                <select
                    value={bookingDetails.vehicleId}
                    onChange={(e) =>
                        setBookingDetails((prev) => ({ ...prev, vehicleId: e.target.value }))
                    }
                    className={`w-full px-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black ${
                        validationErrors.vehicleId ? 'border-red-300' : 'border-gray-300'
                    }`}
                >
                    <option value="">Choose a vehicle...</option>
                    {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.make} {vehicle.model} ({vehicle.year}) -{' '}
                            {vehicle.license_plate} - {formatCurrency(vehicle.daily_rate)}/day
                        </option>
                    ))}
                </select>
                {validationErrors.vehicleId && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.vehicleId}</p>
                )}
            </div>

            {/* Date Selection using AvailabilityCalendar */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                    Select Rental Period *
                </label>
                {bookingDetails.vehicleId ? (
                    <AvailabilityCalendar
                        carId={bookingDetails.vehicleId}
                        startDate={bookingDetails.startDate}
                        endDate={bookingDetails.endDate}
                        onChange={(range) => {
                            if (range) {
                                setBookingDetails((prev) => ({
                                    ...prev,
                                    startDate: range.startDate,
                                    endDate: range.endDate,
                                }));
                            } else {
                                setBookingDetails((prev) => ({
                                    ...prev,
                                    startDate: '',
                                    endDate: '',
                                }));
                            }
                        }}
                        monthsToShow={2}
                        className="mb-4"
                    />
                ) : (
                    <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 text-center">
                        <p className="text-gray-600">
                            Please select a vehicle first to see availability
                        </p>
                    </div>
                )}

                {/* Display selected dates */}
                {bookingDetails.startDate && bookingDetails.endDate && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-green-800">
                            <strong>Selected Period:</strong>{' '}
                            {new Date(bookingDetails.startDate + 'T00:00:00').toLocaleDateString()}{' '}
                            - {new Date(bookingDetails.endDate + 'T00:00:00').toLocaleDateString()}
                        </p>
                    </div>
                )}

                {/* Validation errors */}
                {(validationErrors.startDate ||
                    validationErrors.endDate ||
                    validationErrors.conflicts) && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        {validationErrors.startDate && (
                            <p className="text-red-600 text-sm">{validationErrors.startDate}</p>
                        )}
                        {validationErrors.endDate && (
                            <p className="text-red-600 text-sm">{validationErrors.endDate}</p>
                        )}
                        {validationErrors.conflicts && (
                            <p className="text-red-600 text-sm">{validationErrors.conflicts}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pickup Time
                    </label>
                    <input
                        type="time"
                        value={bookingDetails.pickupTime}
                        onChange={(e) =>
                            setBookingDetails((prev) => ({ ...prev, pickupTime: e.target.value }))
                        }
                        className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Return Time
                    </label>
                    <input
                        type="time"
                        value={bookingDetails.returnTime}
                        onChange={(e) =>
                            setBookingDetails((prev) => ({ ...prev, returnTime: e.target.value }))
                        }
                        className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                    />
                </div>
            </div>

            {/* Conflicts Warning */}
            {checkingConflicts && (
                <div className="flex items-center space-x-2 text-blue-600">
                    <Clock className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Checking availability...</span>
                </div>
            )}

            {conflicts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-red-800 mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">Booking Conflict Detected</span>
                    </div>
                    <p className="text-red-700 text-sm mb-2">
                        This vehicle has {conflicts.length} existing booking(s) during the selected
                        period:
                    </p>
                    <ul className="text-red-700 text-sm space-y-1">
                        {conflicts.map((conflict, index) => (
                            <li key={index}>
                                • {new Date(conflict.start_date + 'T00:00:00').toLocaleDateString()}{' '}
                                - {new Date(conflict.end_date + 'T00:00:00').toLocaleDateString()}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Price Summary */}
            {bookingDetails.totalDays > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-3">Price Summary</h4>
                    <div className="space-y-2 text-sm text-black">
                        <div className="flex justify-between">
                            <span>Daily Rate:</span>
                            <span>{formatCurrency(bookingDetails.dailyRate)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Days:</span>
                            <span>
                                {bookingDetails.totalDays} day
                                {bookingDetails.totalDays !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="flex justify-between font-medium">
                            <span>Total Amount:</span>
                            <span>{formatCurrency(bookingDetails.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-gray-800">
                            <span>Suggested Deposit (30%):</span>
                            <span>{formatCurrency(bookingDetails.deposit)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <User className="h-12 w-12 text-black mx-auto mb-3" />
                <h3 className="text-xl font-semibold text-black">Customer Information</h3>
                <p className="text-gray-600">Enter customer details</p>
            </div>

            {/* Customer Info Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                    </label>
                    <input
                        type="text"
                        value={customerInfo.fullName}
                        onChange={(e) =>
                            setCustomerInfo((prev) => ({ ...prev, fullName: e.target.value }))
                        }
                        className={`w-full px-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black ${
                            validationErrors.fullName ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter customer's full name"
                    />
                    {validationErrors.fullName && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.fullName}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                    </label>
                    <input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) =>
                            setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className={`w-full px-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black ${
                            validationErrors.phone ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="+62 812 3456 7890"
                    />
                    {validationErrors.phone && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.phone}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) =>
                            setCustomerInfo((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className={`w-full px-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black ${
                            validationErrors.email ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="customer@example.com"
                    />
                    {validationErrors.email && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.email}</p>
                    )}
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Driver License Number *
                    </label>
                    <input
                        type="text"
                        value={customerInfo.driverLicense}
                        onChange={(e) =>
                            setCustomerInfo((prev) => ({ ...prev, driverLicense: e.target.value }))
                        }
                        className={`w-full px-3 py-3 border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black ${
                            validationErrors.driverLicense ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter driver license number"
                    />
                    {validationErrors.driverLicense && (
                        <p className="text-red-600 text-sm mt-1">
                            {validationErrors.driverLicense}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Emergency Contact Name
                    </label>
                    <input
                        type="text"
                        value={customerInfo.emergencyContact}
                        onChange={(e) =>
                            setCustomerInfo((prev) => ({
                                ...prev,
                                emergencyContact: e.target.value,
                            }))
                        }
                        className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                        placeholder="Emergency contact name"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Emergency Contact Phone
                    </label>
                    <input
                        type="tel"
                        value={customerInfo.emergencyPhone}
                        onChange={(e) =>
                            setCustomerInfo((prev) => ({ ...prev, emergencyPhone: e.target.value }))
                        }
                        className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                        placeholder="+62 812 3456 7890"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes
                    </label>
                    <textarea
                        value={customerInfo.notes}
                        onChange={(e) =>
                            setCustomerInfo((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        rows={3}
                        className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                        placeholder="Any special requirements or notes..."
                    />
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => {
        const selectedVehicle = getSelectedVehicle();

        return (
            <div className="space-y-6">
                <div className="text-center mb-6">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-xl font-semibold text-black">Review & Confirm</h3>
                    <p className="text-gray-600">Please review the booking details</p>
                </div>

                {/* Booking Summary */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                    <h4 className="font-semibold text-gray-900">Booking Summary</h4>

                    {/* Vehicle Details */}
                    <div className="border-b border-gray-200 pb-4">
                        <h5 className="font-medium text-gray-800 mb-2">Vehicle</h5>
                        {selectedVehicle && (
                            <div className="text-sm text-gray-600">
                                <p>
                                    {selectedVehicle.make} {selectedVehicle.model} (
                                    {selectedVehicle.year})
                                </p>
                                <p>License Plate: {selectedVehicle.license_plate}</p>
                                <p>Daily Rate: {formatCurrency(selectedVehicle.daily_rate)}</p>
                            </div>
                        )}
                    </div>

                    {/* Rental Period */}
                    <div className="border-b border-gray-200 pb-4">
                        <h5 className="font-medium text-gray-800 mb-2">Rental Period</h5>
                        <div className="text-sm text-gray-600">
                            <p>
                                Start:{' '}
                                {new Date(
                                    bookingDetails.startDate + 'T00:00:00',
                                ).toLocaleDateString()}{' '}
                                at {bookingDetails.pickupTime}
                            </p>
                            <p>
                                End:{' '}
                                {new Date(
                                    bookingDetails.endDate + 'T00:00:00',
                                ).toLocaleDateString()}{' '}
                                at {bookingDetails.returnTime}
                            </p>
                            <p>
                                Duration: {bookingDetails.totalDays} day
                                {bookingDetails.totalDays !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    {/* Customer Details */}
                    <div className="border-b border-gray-200 pb-4">
                        <h5 className="font-medium text-gray-800 mb-2">Customer</h5>
                        <div className="text-sm text-gray-600">
                            <p>Name: {customerInfo.fullName}</p>
                            <p>Phone: {customerInfo.phone}</p>
                            {customerInfo.email && <p>Email: {customerInfo.email}</p>}
                            <p>License: {customerInfo.driverLicense}</p>
                            {customerInfo.emergencyContact && (
                                <p>
                                    Emergency: {customerInfo.emergencyContact} (
                                    {customerInfo.emergencyPhone})
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Price Details */}
                    <div>
                        <h5 className="font-medium text-gray-800 mb-2">Payment</h5>
                        <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex justify-between">
                                <span>Daily Rate:</span>
                                <span>{formatCurrency(bookingDetails.dailyRate)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Days:</span>
                                <span>{bookingDetails.totalDays}</span>
                            </div>
                            <div className="flex justify-between font-medium text-gray-900">
                                <span>Total Amount:</span>
                                <span>{formatCurrency(bookingDetails.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-orange-600">
                                <span>Suggested Deposit:</span>
                                <span>{formatCurrency(bookingDetails.deposit)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Notes */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Booking Notes
                    </label>
                    <textarea
                        value={bookingDetails.notes}
                        onChange={(e) =>
                            setBookingDetails((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        rows={3}
                        className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-black"
                        placeholder="Any special notes for this booking..."
                    />
                </div>

                {/* Error Display */}
                {validationErrors.submit && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-red-800">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="text-sm">{validationErrors.submit}</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderStep4 = () => (
        <div className="text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <div>
                <h3 className="text-2xl font-semibold text-black mb-2">
                    Booking Created Successfully!
                </h3>
                <p className="text-gray-600">
                    The offline booking has been created and the vehicle availability has been
                    updated.
                </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">
                    Customer: <strong>{customerInfo.fullName}</strong>
                    <br />
                    Vehicle:{' '}
                    <strong>
                        {getSelectedVehicle()?.make} {getSelectedVehicle()?.model}
                    </strong>
                    <br />
                    Period:{' '}
                    <strong>
                        {new Date(bookingDetails.startDate + 'T00:00:00').toLocaleDateString()} -{' '}
                        {new Date(bookingDetails.endDate + 'T00:00:00').toLocaleDateString()}
                    </strong>
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                    href="/host/offline-bookings"
                    className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium text-center"
                >
                    View All Bookings
                </Link>
                <button
                    onClick={() => {
                        setCurrentStep(1);
                        setCustomerInfo(initialCustomerInfo);
                        setBookingDetails(initialBookingDetails);
                        setConflicts([]);
                        setValidationErrors({});
                    }}
                    className="bg-gray-200 text-black px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                    Create Another Booking
                </button>
            </div>
        </div>
    );

    if (vehiclesLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (error || !isHost) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || 'Access denied'}</p>
                    <Link
                        href="/home/host"
                        className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (vehicles.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
                <nav className="bg-white shadow-sm border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center space-x-4">
                                <Link href="/home/host" className="text-2xl font-bold text-black">
                                    REBIL
                                </Link>
                                <span className="text-gray-400">/</span>
                                <Link href="/host/offline-bookings" className="text-gray-600">
                                    Offline Bookings
                                </Link>
                                <span className="text-gray-400">/</span>
                                <span className="text-gray-600">Create</span>
                            </div>
                            <Link
                                href="/host/offline-bookings"
                                className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back</span>
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-12 text-center">
                        <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            No Active Vehicles Found
                        </h3>
                        <p className="text-gray-600 mb-6">
                            You need to have at least one active vehicle to create offline bookings.
                        </p>
                        <Link
                            href="/host/add-vehicle"
                            className="inline-block bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                        >
                            Add Your First Vehicle
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link href="/home/host" className="text-2xl font-bold text-black">
                                REBIL
                            </Link>
                            <span className="text-gray-400">/</span>
                            <Link href="/host/offline-bookings" className="text-gray-600">
                                Offline Bookings
                            </Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600">Create New Booking</span>
                        </div>
                        <Link
                            href="/host/offline-bookings"
                            className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Back</span>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-black">
                            Create New Offline Booking
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Create a manual booking for walk-in customers
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {currentStep <= 3 && renderStepIndicator()}

                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                        {currentStep === 3 && renderStep3()}
                        {currentStep === 4 && renderStep4()}
                    </div>

                    {/* Footer */}
                    {currentStep <= 3 && (
                        <div className="flex items-center justify-between p-6 border-t border-gray-200">
                            <Link
                                href={currentStep === 1 ? '/host/offline-bookings' : '#'}
                                onClick={
                                    currentStep > 1
                                        ? (e) => {
                                              e.preventDefault();
                                              handlePrevious();
                                          }
                                        : undefined
                                }
                                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
                            >
                                {currentStep === 1 ? 'Cancel' : 'Previous'}
                            </Link>

                            <div className="text-sm text-gray-500">Step {currentStep} of 3</div>

                            {currentStep < 3 ? (
                                <button
                                    onClick={handleNext}
                                    disabled={
                                        loading || (currentStep === 1 && conflicts.length > 0)
                                    }
                                    className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    onClick={handleBookingSubmit}
                                    disabled={loading}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                    {loading && (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    )}
                                    <span>{loading ? 'Creating...' : 'Create Booking'}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
