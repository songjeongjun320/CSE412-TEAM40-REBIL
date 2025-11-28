'use client';

import { useEffect, useState } from 'react';

import AvailabilityCalendar from '@/components/base/AvailabilityCalendar';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency } from '@/lib/utils';
import { Tables } from '@/types/base/database.types';

type Car = Tables<'cars'>;

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

interface VehicleBookingCalendarProps {
    car: Car;
    refreshTrigger?: number; // When this changes, force refresh
    onApproveBooking?: (bookingId: string) => Promise<void>;
    onRejectBooking?: (bookingId: string, renterName: string) => Promise<void>;
    bookingLoading?: boolean;
}

export default function VehicleBookingCalendar({
    car,
    refreshTrigger,
    onApproveBooking,
    onRejectBooking,
    bookingLoading = false,
}: VehicleBookingCalendarProps) {
    const [bookings, setBookings] = useState<VehicleBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState<{
        startDate: string;
        endDate: string;
    } | null>(null);

    useEffect(() => {
        fetchVehicleBookings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [car.id, refreshTrigger]);

    // Set up real-time subscription for booking changes
    useEffect(() => {
        const supabase = createClient();

        const subscription = supabase
            .channel(`booking-changes-${car.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                    filter: `car_id=eq.${car.id}`,
                },
                (payload) => {
                    console.log('Real-time booking change detected:', payload);
                    // Refresh bookings when any change occurs
                    fetchVehicleBookings();
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [car.id]);

    const fetchVehicleBookings = async () => {
        try {
            const supabase = createClient();

            // Get bookings for this specific vehicle (both online and offline)
            const { data, error } = await supabase
                .from('bookings')
                .select(
                    `
                    *,
                    renter:user_profiles!bookings_renter_id_fkey(full_name, email)
                `,
                )
                .eq('car_id', car.id)
                .in('status', ['PENDING', 'CONFIRMED', 'AUTO_APPROVED', 'IN_PROGRESS', 'COMPLETED'])
                .order('start_date', { ascending: true })
                .limit(15);

            if (error) {
                console.error('Error fetching vehicle bookings:', error);
                return;
            }

            const processedBookings = (data || []).map((booking) => {
                let customerInfo = null;
                let bookingDetails = null;

                // Parse special_instructions for offline bookings
                if (booking.special_instructions) {
                    try {
                        const instructions = JSON.parse(booking.special_instructions);
                        customerInfo = instructions.customer_info;
                        bookingDetails = instructions.booking_details;
                    } catch {
                        console.warn(
                            'Failed to parse special_instructions for booking',
                            booking.id,
                        );
                    }
                }

                return {
                    id: booking.id,
                    start_date: booking.start_date,
                    end_date: booking.end_date,
                    status: booking.status,
                    total_amount: booking.total_amount,
                    renter_name: customerInfo
                        ? customerInfo.fullName || 'Guest Customer'
                        : booking.renter?.full_name || null,
                    renter_email: customerInfo
                        ? customerInfo.email || null
                        : booking.renter?.email || null,
                    created_at: booking.created_at,
                    booking_type: customerInfo ? 'OFFLINE' : 'ONLINE',
                    customer_info: customerInfo,
                    booking_details: bookingDetails,
                };
            });

            setBookings(processedBookings);
        } catch (error) {
            console.error('Error in fetchVehicleBookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string, bookingType?: string) => {
        // Different color scheme for offline bookings
        if (bookingType === 'OFFLINE') {
            switch (status) {
                case 'PENDING':
                    return 'bg-orange-600 text-white border-orange-200';
                case 'CONFIRMED':
                    return 'bg-orange-700 text-white border-orange-200';
                case 'AUTO_APPROVED':
                    return 'bg-orange-800 text-white border-orange-200';
                case 'IN_PROGRESS':
                    return 'bg-orange-900 text-white border-orange-200';
                case 'COMPLETED':
                    return 'bg-orange-400 text-white border-orange-200';
                default:
                    return 'bg-orange-400 text-white border-orange-200';
            }
        }

        // Original color scheme for online bookings
        switch (status) {
            case 'PENDING':
                return 'bg-gray-600 text-white border-gray-200';
            case 'CONFIRMED':
                return 'bg-black text-white border-gray-200';
            case 'AUTO_APPROVED':
                return 'bg-gray-800 text-white border-gray-200';
            case 'IN_PROGRESS':
                return 'bg-gray-700 text-white border-gray-200';
            case 'COMPLETED':
                return 'bg-gray-400 text-white border-gray-200';
            default:
                return 'bg-gray-400 text-white border-gray-200';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-4">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-black mb-1">
                    📅 {car.make} {car.model} ({car.year})
                </h3>
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <span>💰 {formatCurrency(car.daily_rate)}/day</span>
                    <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            car.status === 'ACTIVE'
                                ? 'bg-black text-white'
                                : car.status === 'INACTIVE'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-600 text-white'
                        }`}
                    >
                        {car.status}
                    </span>
                </div>
            </div>

            <div className="flex gap-4">
                {/* Calendar Section */}
                <div className="flex-1">
                    <h4 className="text-md font-semibold text-black mb-3">Availability Calendar</h4>
                    <AvailabilityCalendar
                        carId={car.id}
                        startDate={selectedRange?.startDate}
                        endDate={selectedRange?.endDate}
                        onChange={setSelectedRange}
                        monthsToShow={1}
                        className="mb-3"
                        key={`${car.id}-${refreshTrigger}`}
                    />
                    {selectedRange?.startDate && selectedRange?.endDate && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <p className="text-xs text-blue-800">
                                <strong>Selected:</strong> {selectedRange.startDate} to{' '}
                                {selectedRange.endDate}
                            </p>
                        </div>
                    )}
                </div>

                {/* Bookings List */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-black">
                            Recent Bookings ({bookings.length})
                        </h4>
                        <div className="flex items-center space-x-2 text-xs">
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-black rounded-full"></div>
                                <span className="text-gray-600">Online</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                                <span className="text-gray-600">Offline</span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                                <p className="text-gray-600 mt-2">Loading bookings...</p>
                            </div>
                        ) : bookings.length > 0 ? (
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
                                        className={`bg-gray-50 rounded-lg p-3 border ${
                                            booking.booking_type === 'OFFLINE'
                                                ? 'border-orange-200 bg-orange-50'
                                                : 'border-gray-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-1 mb-1">
                                                    <p className="font-medium text-black text-xs">
                                                        👤 {booking.renter_name || 'Guest User'}
                                                    </p>
                                                    {booking.booking_type === 'OFFLINE' && (
                                                        <span className="px-1 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                                                            OFF
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-600 truncate">
                                                    📧 {booking.renter_email || 'No email'}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-1 py-0.5 rounded text-xs font-semibold border ${getStatusColor(booking.status, booking.booking_type)}`}
                                            >
                                                {booking.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 mb-2">
                                            <div>📅 {startDate.toLocaleDateString('ko-KR')}</div>
                                            <div>📅 {endDate.toLocaleDateString('ko-KR')}</div>
                                            <div>⏰ {duration}일</div>
                                            <div>💰 {formatCurrency(booking.total_amount)}</div>
                                        </div>

                                        <div className="text-xs text-gray-500 mb-2">
                                            {new Date(booking.created_at).toLocaleDateString(
                                                'ko-KR',
                                            )}
                                        </div>

                                        {/* Additional info for offline bookings */}
                                        {booking.booking_type === 'OFFLINE' &&
                                            booking.customer_info && (
                                                <div className="bg-orange-100 border border-orange-200 rounded p-1 mb-2">
                                                    <div className="text-xs text-orange-800">
                                                        <div>
                                                            License:{' '}
                                                            {booking.customer_info.driverLicense}
                                                        </div>
                                                        {booking.booking_details?.deposit && (
                                                            <div>
                                                                Deposit:{' '}
                                                                {formatCurrency(
                                                                    booking.booking_details.deposit,
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                        {/* Action Buttons for PENDING bookings */}
                                        {booking.status === 'PENDING' &&
                                            (onApproveBooking || onRejectBooking) && (
                                                <div className="pt-2 border-t border-gray-200">
                                                    <div className="flex justify-end space-x-1">
                                                        {onRejectBooking && (
                                                            <button
                                                                onClick={() =>
                                                                    onRejectBooking(
                                                                        booking.id,
                                                                        booking.renter_name ||
                                                                            'Unknown Renter',
                                                                    )
                                                                }
                                                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                                                disabled={bookingLoading}
                                                            >
                                                                {bookingLoading ? '...' : 'Reject'}
                                                            </button>
                                                        )}
                                                        {onApproveBooking && (
                                                            <button
                                                                onClick={() =>
                                                                    onApproveBooking(booking.id)
                                                                }
                                                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                                                disabled={bookingLoading}
                                                            >
                                                                {bookingLoading ? '...' : 'Accept'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                        {/* Auto-approved bookings with rejection option */}
                                        {booking.status === 'AUTO_APPROVED' &&
                                            onRejectBooking &&
                                            (() => {
                                                const daysUntilStart = Math.ceil(
                                                    (new Date(booking.start_date).getTime() -
                                                        new Date().getTime()) /
                                                        (1000 * 60 * 60 * 24),
                                                );
                                                const rejectionAllowed = daysUntilStart >= 1;

                                                return rejectionAllowed ? (
                                                    <div className="pt-2 border-t border-gray-200">
                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={() =>
                                                                    onRejectBooking(
                                                                        booking.id,
                                                                        booking.renter_name ||
                                                                            'Unknown Renter',
                                                                    )
                                                                }
                                                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                                                disabled={bookingLoading}
                                                            >
                                                                {bookingLoading ? '...' : 'Reject'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="pt-2 border-t border-gray-200">
                                                        <p className="text-xs text-gray-500">
                                                            ⏰ Deadline passed
                                                        </p>
                                                    </div>
                                                );
                                            })()}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-4">
                                <div className="text-2xl mb-2">📅</div>
                                <p className="text-sm text-gray-600">No bookings yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
