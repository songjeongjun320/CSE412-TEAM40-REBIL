'use client';

import { Calendar, ToggleLeft, ToggleRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    renter_id?: string;
    car_id?: string;
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

interface UnifiedVehicleCardProps {
    car: CarWithImages;
    viewMode?: 'grid' | 'list';
    refreshTrigger?: number;
    onApproveBooking?: (bookingId: string) => Promise<void>;
    onRejectBooking?: (bookingId: string, renterName: string) => Promise<void>;
    onUpdateBookingStatus?: (bookingId: string, newStatus: string) => Promise<void>;
    onLeaveReview?: (booking: VehicleBooking) => void;
    bookingLoading?: boolean;
    reviewLoading?: boolean;
    onVehicleSelect?: (vehicleId: string, selected: boolean) => void;
    isSelected?: boolean;
    onQuickAction?: (vehicleId: string, action: string) => void;
    onShowManualBooking?: (vehicleId: string) => void;
    bookingReviewStatus?: Record<string, boolean>;
}

export default function UnifiedVehicleCard({
    car,
    viewMode = 'grid',
    refreshTrigger,
    onApproveBooking,
    onRejectBooking,
    onUpdateBookingStatus,
    onLeaveReview,
    bookingLoading = false,
    reviewLoading = false,
    onVehicleSelect,
    isSelected = false,
    onQuickAction,
    onShowManualBooking,
    bookingReviewStatus = {},
}: UnifiedVehicleCardProps) {
    const router = useRouter();

    // Helper function to check if booking is manual
    const isManualBooking = (booking: VehicleBooking): boolean => {
        try {
            if (!booking.customer_info) return false;
            // Manual bookings have customer_info populated
            return true;
        } catch {
            return false;
        }
    };
    const [bookings, setBookings] = useState<VehicleBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState<{
        startDate: string;
        endDate: string;
    } | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);

    useEffect(() => {
        fetchVehicleBookings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [car.id, refreshTrigger]);

    // Set up real-time subscription for booking changes
    useEffect(() => {
        const supabase = createClient();

        const subscription = supabase
            .channel(`unified-booking-changes-${car.id}`)
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
                .limit(5);

            if (error) {
                console.error('Error fetching vehicle bookings:', error);
                return;
            }

            const processedBookings = (data || []).map((booking) => {
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
                    isOfflineBooking || booking.booking_type === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';

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
                    renter_id: booking.renter_id,
                    car_id: booking.car_id,
                    created_at: booking.created_at,
                    booking_type: bookingType,
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

    const primaryImage = car.car_images?.find((img) => img.is_primary) || car.car_images?.[0];

    const handleCardClick = (e: React.MouseEvent) => {
        // Don't navigate if user clicked on interactive elements
        if (
            (e.target as HTMLElement).closest('input') ||
            (e.target as HTMLElement).closest('button') ||
            (e.target as HTMLElement).closest('a')
        ) {
            return;
        }
        router.push(`/host/vehicles/${car.id}`);
    };

    return (
        <div
            className="bg-white rounded-xl shadow-lg border-2 border-gray-400 overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
            onClick={handleCardClick}
        >
            {/* Vehicle Header with Image (Grid View Only) */}
            {viewMode === 'grid' && (
                <div className="relative">
                    {primaryImage ? (
                        <div className="h-32 bg-gray-200 overflow-hidden">
                            <img
                                src={primaryImage.image_url}
                                alt={`${car.make} ${car.model}`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="h-32 bg-gray-200 flex items-center justify-center">
                            <div className="text-center text-gray-500">
                                <div className="text-2xl mb-1">🚗</div>
                                <p className="text-xs">No image</p>
                            </div>
                        </div>
                    )}

                    {/* Selection Checkbox */}
                    {onVehicleSelect && (
                        <div className="absolute top-3 left-3">
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => onVehicleSelect(car.id, e.target.checked)}
                                className="w-5 h-5 text-black focus:ring-black border-gray-300 rounded"
                            />
                        </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                        <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(car.status)}`}
                        >
                            {car.status}
                        </span>
                    </div>
                </div>
            )}

            {/* Vehicle Info */}
            <div className="p-3">
                {/* List View Header with Checkbox and Status */}
                {viewMode === 'list' && (
                    <div className="flex items-center justify-between mb-3">
                        {/* Selection Checkbox */}
                        {onVehicleSelect && (
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => onVehicleSelect(car.id, e.target.checked)}
                                className="w-5 h-5 text-black focus:ring-black border-gray-300 rounded"
                            />
                        )}

                        {/* Status Badge */}
                        <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(car.status)}`}
                        >
                            {car.status}
                        </span>
                    </div>
                )}

                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-sm font-bold text-black">
                            {car.make} {car.model} ({car.year})
                        </h3>
                        <p className="text-xs text-gray-600">
                            {formatDailyRate(car.daily_rate)} • {car.fuel_type}
                        </p>
                        <p className="text-xs text-gray-500">
                            {car.seats} seats • {car.license_plate}
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-1 mb-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuickAction?.(car.id, 'toggle-status');
                        }}
                        className="flex items-center space-x-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-200 transition-colors"
                    >
                        {car.status === 'ACTIVE' ? (
                            <ToggleRight className="h-3 w-3" />
                        ) : (
                            <ToggleLeft className="h-3 w-3" />
                        )}
                        <span>Toggle</span>
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowCalendar(!showCalendar);
                        }}
                        className="flex items-center space-x-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200 transition-colors"
                    >
                        <Calendar className="h-3 w-3" />
                        <span>{showCalendar ? 'Hide' : 'Calendar'}</span>
                    </button>

                    {onShowManualBooking && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowManualBooking(car.id);
                            }}
                            className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs hover:bg-orange-200 transition-colors"
                        >
                            Manual Book
                        </button>
                    )}
                </div>

                {/* Recent Bookings Summary */}
                <div className="mb-2">
                    <h4 className="text-xs font-semibold text-black mb-2 pb-1 border-b border-gray-300">
                        Recent Bookings ({bookings.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black mx-auto"></div>
                            </div>
                        ) : bookings.length > 0 ? (
                            bookings.map((booking) => (
                                <div
                                    key={booking.id}
                                    className={`p-2 rounded-lg text-xs shadow-sm border transition-all hover:shadow-md ${
                                        booking.booking_type === 'OFFLINE'
                                            ? 'bg-orange-100 border-orange-300 hover:bg-orange-200'
                                            : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                                    }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium text-black">
                                            👤 {booking.renter_name || 'Guest'}
                                        </span>
                                        <span
                                            className={`px-1 py-0.5 rounded text-xs font-semibold ${getBookingStatusColor(booking.status, booking.booking_type)}`}
                                        >
                                            {booking.status}
                                        </span>
                                    </div>
                                    <div className="text-gray-600">
                                        📅{' '}
                                        {new Date(booking.start_date).toLocaleDateString('ko-KR')} -{' '}
                                        {new Date(booking.end_date).toLocaleDateString('ko-KR')}
                                    </div>
                                    <div className="text-gray-600">
                                        💰 {formatCurrency(booking.total_amount)}
                                    </div>

                                    {/* Action Buttons for All Status Types */}
                                    {(booking.status === 'PENDING' ||
                                        booking.status === 'CONFIRMED' ||
                                        booking.status === 'IN_PROGRESS' ||
                                        booking.status === 'COMPLETED') &&
                                        (onApproveBooking ||
                                            onRejectBooking ||
                                            onUpdateBookingStatus ||
                                            onLeaveReview) && (
                                            <div className="mt-2 flex justify-end space-x-1 flex-wrap gap-1">
                                                {/* PENDING Status Buttons */}
                                                {booking.status === 'PENDING' && (
                                                    <>
                                                        {onRejectBooking && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onRejectBooking(
                                                                        booking.id,
                                                                        booking.renter_name ||
                                                                            'Unknown',
                                                                    );
                                                                }}
                                                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                                                disabled={bookingLoading}
                                                            >
                                                                {bookingLoading ? '...' : 'Reject'}
                                                            </button>
                                                        )}
                                                        {onApproveBooking && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onApproveBooking(booking.id);
                                                                }}
                                                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                                                disabled={bookingLoading}
                                                            >
                                                                {bookingLoading ? '...' : 'Accept'}
                                                            </button>
                                                        )}
                                                    </>
                                                )}

                                                {/* CONFIRMED Status Button */}
                                                {booking.status === 'CONFIRMED' &&
                                                    onUpdateBookingStatus && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onUpdateBookingStatus(
                                                                    booking.id,
                                                                    'IN_PROGRESS',
                                                                );
                                                            }}
                                                            className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                                            disabled={bookingLoading}
                                                        >
                                                            {bookingLoading ? '...' : '▶️ Active'}
                                                        </button>
                                                    )}

                                                {/* IN_PROGRESS Status Button */}
                                                {booking.status === 'IN_PROGRESS' &&
                                                    onUpdateBookingStatus && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onUpdateBookingStatus(
                                                                    booking.id,
                                                                    'COMPLETED',
                                                                );
                                                            }}
                                                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                                            disabled={bookingLoading}
                                                        >
                                                            {bookingLoading ? '...' : '✅ Complete'}
                                                        </button>
                                                    )}

                                                {/* COMPLETED Status Button - Leave Review */}
                                                {booking.status === 'COMPLETED' &&
                                                    onLeaveReview &&
                                                    !isManualBooking(booking) && (
                                                        <>
                                                            {bookingReviewStatus[booking.id] ? (
                                                                <button
                                                                    className="px-2 py-1 bg-gray-400 text-white text-xs rounded cursor-not-allowed flex items-center gap-1"
                                                                    disabled
                                                                >
                                                                    ✓ Reviewed
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onLeaveReview(booking);
                                                                    }}
                                                                    className="px-2 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 transition-colors flex items-center gap-1"
                                                                    disabled={reviewLoading}
                                                                >
                                                                    {reviewLoading
                                                                        ? '...'
                                                                        : '⭐ Review'}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                            </div>
                                        )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 px-3 bg-gray-100 border border-gray-300 rounded-lg shadow-sm">
                                <div className="text-lg mb-1 opacity-50">📅</div>
                                <p className="text-xs font-medium text-gray-600 mb-1">
                                    No bookings yet
                                </p>
                                <p className="text-xs text-gray-500">Bookings will appear here</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Calendar Section (Expandable) */}
                {showCalendar && (
                    <div className="border-t border-gray-200 pt-3 mt-2">
                        <h4 className="text-xs font-semibold text-black mb-2">
                            Availability Calendar
                        </h4>
                        <AvailabilityCalendar
                            carId={car.id}
                            startDate={selectedRange?.startDate}
                            endDate={selectedRange?.endDate}
                            onChange={setSelectedRange}
                            monthsToShow={1}
                            className="mb-2"
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
                )}
            </div>
        </div>
    );
}
