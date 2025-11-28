'use client';

import { ArrowLeft, Edit, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import AvailabilityCalendar from '@/components/base/AvailabilityCalendar';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency, formatDailyRate } from '@/lib/utils';
import { Tables } from '@/types/base/database.types';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

type CarWithImages = Car & {
    car_images: CarImage[];
};

interface VehicleBooking {
    id: string;
    start_date: string;
    end_date: string;
    status: string;
    total_amount: number;
    renter_name: string | null;
    renter_email: string | null;
    created_at: string;
    booking_type?: string;
    customer_info?: {
        fullName: string;
        phone: string;
        email?: string;
        driverLicense: string;
        emergencyContact?: string;
        emergencyPhone?: string;
        notes?: string;
    };
    booking_details?: {
        pickup_time: string;
        return_time: string;
        deposit: number;
        notes?: string;
    };
}

export default function VehicleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const vehicleId = params.id as string;

    const [vehicle, setVehicle] = useState<CarWithImages | null>(null);
    const [bookings, setBookings] = useState<VehicleBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRange, setSelectedRange] = useState<{
        startDate: string;
        endDate: string;
    } | null>(null);
    const [bookingLoading, setBookingLoading] = useState(false);

    const fetchVehicleData = useCallback(async () => {
        try {
            const supabase = createClient();

            // Get current user
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            // Fetch vehicle data
            const { data: vehicleData, error: vehicleError } = await supabase
                .from('cars')
                .select(
                    `
                    *,
                    car_images(*)
                `,
                )
                .eq('id', vehicleId)
                .eq('host_id', user.id) // Ensure user can only see their own vehicles
                .single();

            if (vehicleError) {
                console.error('Error fetching vehicle:', vehicleError);
                setError('Vehicle not found or access denied');
                return;
            }

            setVehicle(vehicleData);

            // Fetch bookings for this vehicle
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(
                    `
                    *,
                    renter:user_profiles!bookings_renter_id_fkey(full_name, email)
                `,
                )
                .eq('car_id', vehicleId)
                .order('start_date', { ascending: true });

            if (!bookingsError && bookingsData) {
                const processedBookings = bookingsData.map((booking) => {
                    let customerInfo = null;
                    let bookingDetails = null;
                    let isOfflineBooking = false;

                    if (booking.special_instructions) {
                        try {
                            const instructions = JSON.parse(booking.special_instructions);
                            customerInfo = instructions.customer_info;
                            bookingDetails = instructions.booking_details;
                            isOfflineBooking =
                                instructions.created_manually === true ||
                                instructions.is_offline_booking === true;
                        } catch {
                            console.warn(
                                'Failed to parse special_instructions for booking',
                                booking.id,
                            );
                        }
                    }

                    const bookingType =
                        isOfflineBooking || booking.booking_type === 'OFFLINE'
                            ? 'OFFLINE'
                            : 'ONLINE';

                    return {
                        id: booking.id,
                        start_date: booking.start_date,
                        end_date: booking.end_date,
                        status: booking.status,
                        total_amount: booking.total_amount,
                        renter_name:
                            bookingType === 'OFFLINE'
                                ? customerInfo?.fullName || 'Guest Customer'
                                : booking.renter?.full_name || null,
                        renter_email:
                            bookingType === 'OFFLINE'
                                ? customerInfo?.email || null
                                : booking.renter?.email || null,
                        created_at: booking.created_at,
                        booking_type: bookingType,
                        customer_info: customerInfo,
                        booking_details: bookingDetails,
                    };
                });

                setBookings(processedBookings);
            }
        } catch (error) {
            console.error('Error fetching vehicle data:', error);
            setError('Failed to load vehicle data');
        } finally {
            setLoading(false);
        }
    }, [vehicleId, router]);

    useEffect(() => {
        fetchVehicleData();
    }, [fetchVehicleData]);

    const handleStatusToggle = async () => {
        if (!vehicle) return;

        try {
            const supabase = createClient();
            const newStatus = vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

            const { error } = await supabase
                .from('cars')
                .update({ status: newStatus })
                .eq('id', vehicle.id);

            if (error) throw error;

            setVehicle((prev) => (prev ? { ...prev, status: newStatus } : null));
        } catch (error) {
            console.error('Error updating vehicle status:', error);
            alert('Failed to update vehicle status');
        }
    };

    const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
        const statusActions = {
            IN_PROGRESS: 'mark as active',
            COMPLETED: 'mark as completed',
        };

        const action = statusActions[newStatus as keyof typeof statusActions];
        if (!confirm(`Are you sure you want to ${action}?`)) return;

        setBookingLoading(true);
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('bookings')
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', bookingId);

            if (error) {
                console.error('Error updating booking status:', error);
                alert('Failed to update booking status. Please try again.');
                return;
            }

            // Update local bookings state
            setBookings((prev) =>
                prev.map((booking) =>
                    booking.id === bookingId ? { ...booking, status: newStatus } : booking,
                ),
            );

            alert(`✅ Booking ${action} successfully!`);
        } catch (error) {
            console.error('Error updating booking:', error);
            alert('An unexpected error occurred.');
        } finally {
            setBookingLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-600 text-white';
            case 'INACTIVE':
                return 'bg-red-600 text-white';
            case 'PENDING_APPROVAL':
                return 'bg-yellow-600 text-white';
            case 'DRAFT':
                return 'bg-gray-600 text-white';
            default:
                return 'bg-gray-400 text-white';
        }
    };

    const getBookingStatusColor = (status: string, bookingType?: string) => {
        if (bookingType === 'OFFLINE') {
            switch (status) {
                case 'PENDING':
                    return 'bg-orange-600 text-white';
                case 'CONFIRMED':
                    return 'bg-orange-700 text-white';
                case 'AUTO_APPROVED':
                    return 'bg-orange-800 text-white';
                case 'IN_PROGRESS':
                    return 'bg-orange-900 text-white';
                case 'COMPLETED':
                    return 'bg-orange-400 text-white';
                default:
                    return 'bg-orange-400 text-white';
            }
        }

        switch (status) {
            case 'PENDING':
                return 'bg-gray-600 text-white';
            case 'CONFIRMED':
                return 'bg-black text-white';
            case 'AUTO_APPROVED':
                return 'bg-gray-800 text-white';
            case 'IN_PROGRESS':
                return 'bg-gray-700 text-white';
            case 'COMPLETED':
                return 'bg-gray-400 text-white';
            default:
                return 'bg-gray-400 text-white';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading vehicle...</p>
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
                        href="/home/host"
                        className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const primaryImage =
        vehicle.car_images?.find((img) => img.is_primary) || vehicle.car_images?.[0];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link href="/home/host" className="text-2xl font-bold text-black">
                                REBIL
                            </Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600">Vehicle Details</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/home/host"
                                className="flex items-center space-x-2 bg-gray-200 text-black px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to Dashboard</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
                {/* Vehicle Header */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 mb-8">
                    <div className="relative">
                        {primaryImage ? (
                            <div className="h-64 bg-gray-200 overflow-hidden rounded-t-xl">
                                <img
                                    src={primaryImage.image_url}
                                    alt={`${vehicle.make} ${vehicle.model}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="h-64 bg-gray-200 flex items-center justify-center rounded-t-xl">
                                <div className="text-center text-gray-500">
                                    <div className="text-6xl mb-4">🚗</div>
                                    <p className="text-lg">No image available</p>
                                </div>
                            </div>
                        )}

                        {/* Status Badge */}
                        <div className="absolute top-4 right-4">
                            <span
                                className={`px-3 py-2 rounded-full text-sm font-semibold ${getStatusColor(vehicle.status)}`}
                            >
                                {vehicle.status}
                            </span>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-black mb-2">
                                    {vehicle.make} {vehicle.model} ({vehicle.year})
                                </h1>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                    <div>💰 {formatDailyRate(vehicle.daily_rate)}</div>
                                    <div>⛽ {vehicle.fuel_type}</div>
                                    <div>🔧 {vehicle.transmission}</div>
                                    <div>👥 {vehicle.seats} seats</div>
                                    <div>📋 {vehicle.license_plate}</div>
                                    <div>
                                        📅 Added{' '}
                                        {new Date(vehicle.created_at).toLocaleDateString('ko-KR')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href={`/host/vehicles/${vehicle.id}/edit`}
                                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Edit className="h-4 w-4" />
                                <span>Edit Vehicle</span>
                            </Link>

                            <button
                                onClick={handleStatusToggle}
                                className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                {vehicle.status === 'ACTIVE' ? (
                                    <ToggleRight className="h-4 w-4" />
                                ) : (
                                    <ToggleLeft className="h-4 w-4" />
                                )}
                                <span>
                                    {vehicle.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Calendar and Bookings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Calendar Section */}
                    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-6">
                        <h2 className="text-xl font-bold text-black mb-4">Availability Calendar</h2>
                        <AvailabilityCalendar
                            carId={vehicle.id}
                            startDate={selectedRange?.startDate}
                            endDate={selectedRange?.endDate}
                            onChange={setSelectedRange}
                            monthsToShow={1}
                            className="mb-4"
                        />
                        {selectedRange?.startDate && selectedRange?.endDate && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800">
                                    <strong>Selected:</strong> {selectedRange.startDate} to{' '}
                                    {selectedRange.endDate}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Bookings Section */}
                    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-6">
                        <h2 className="text-xl font-bold text-black mb-4">
                            All Bookings ({bookings.length})
                        </h2>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {bookings.length > 0 ? (
                                bookings.map((booking) => {
                                    const startDate = new Date(booking.start_date);
                                    const endDate = new Date(booking.end_date);
                                    const duration = Math.ceil(
                                        (endDate.getTime() - startDate.getTime()) /
                                            (1000 * 60 * 60 * 24),
                                    );

                                    return (
                                        <div
                                            key={booking.id}
                                            className={`p-4 rounded-lg border ${
                                                booking.booking_type === 'OFFLINE'
                                                    ? 'border-orange-200 bg-orange-50'
                                                    : 'border-gray-300 bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <p className="font-medium text-black">
                                                            👤 {booking.renter_name || 'Guest User'}
                                                        </p>
                                                        {booking.booking_type === 'OFFLINE' && (
                                                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                                                                OFFLINE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        📧 {booking.renter_email || 'No email'}
                                                        {booking.booking_type === 'OFFLINE' &&
                                                            booking.customer_info?.phone && (
                                                                <span className="ml-2">
                                                                    📞 {booking.customer_info.phone}
                                                                </span>
                                                            )}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-semibold ${getBookingStatusColor(booking.status, booking.booking_type)}`}
                                                >
                                                    {booking.status}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                                                <div>
                                                    📅 Start:{' '}
                                                    {startDate.toLocaleDateString('ko-KR')}
                                                </div>
                                                <div>
                                                    📅 End: {endDate.toLocaleDateString('ko-KR')}
                                                </div>
                                                <div>⏰ Duration: {duration} days</div>
                                                <div>
                                                    💰 Total: {formatCurrency(booking.total_amount)}
                                                </div>
                                            </div>

                                            <div className="text-xs text-gray-500 mb-3">
                                                Created:{' '}
                                                {new Date(booking.created_at).toLocaleDateString(
                                                    'ko-KR',
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            {(booking.status === 'CONFIRMED' ||
                                                booking.status === 'IN_PROGRESS') && (
                                                <div className="flex justify-end space-x-2 mb-3">
                                                    {/* CONFIRMED Status Button */}
                                                    {booking.status === 'CONFIRMED' && (
                                                        <button
                                                            onClick={() =>
                                                                handleUpdateBookingStatus(
                                                                    booking.id,
                                                                    'IN_PROGRESS',
                                                                )
                                                            }
                                                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                                            disabled={bookingLoading}
                                                        >
                                                            {bookingLoading
                                                                ? 'Processing...'
                                                                : '▶️ Mark Active'}
                                                        </button>
                                                    )}

                                                    {/* IN_PROGRESS Status Button */}
                                                    {booking.status === 'IN_PROGRESS' && (
                                                        <button
                                                            onClick={() =>
                                                                handleUpdateBookingStatus(
                                                                    booking.id,
                                                                    'COMPLETED',
                                                                )
                                                            }
                                                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                                            disabled={bookingLoading}
                                                        >
                                                            {bookingLoading
                                                                ? 'Processing...'
                                                                : '✅ Mark Completed'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Additional info for offline bookings */}
                                            {booking.booking_type === 'OFFLINE' &&
                                                booking.customer_info && (
                                                    <div className="bg-orange-100 border border-orange-200 rounded p-2 mt-2">
                                                        <div className="text-xs text-orange-800">
                                                            <div>
                                                                License:{' '}
                                                                {
                                                                    booking.customer_info
                                                                        .driverLicense
                                                                }
                                                            </div>
                                                            {booking.booking_details?.deposit && (
                                                                <div>
                                                                    Deposit:{' '}
                                                                    {formatCurrency(
                                                                        booking.booking_details
                                                                            .deposit,
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">📅</div>
                                    <p className="text-gray-600">No bookings yet</p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Bookings will appear here when guests make reservations
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
