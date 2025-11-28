'use client';

import { AlertTriangle, MessageCircle, Star } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { MessageThread } from '@/components/messages';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { ReviewModal } from '@/components/reviews/ReviewModal';
import { Button } from '@/components/ui';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useReviews } from '@/hooks/useReviews';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency, formatDailyRate } from '@/lib/utils';
import { Tables } from '@/types/base/database.types';
import type { CreateReviewRequest, ReviewWithDetails } from '@/types/reviews.types';

type Booking = Tables<'bookings'>;
type Car = Tables<'cars'>;
type UserProfile = Tables<'user_profiles'>;
type CarImage = Tables<'car_images'>;

interface BookingWithDetails extends Booking {
    car: Car & { car_images: CarImage[] };
    host: UserProfile;
    renter: UserProfile;
}

export default function BookingDetailPage() {
    const router = useRouter();
    const params = useParams();
    const bookingId = params.id as string;

    const [booking, setBooking] = useState<BookingWithDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [cancellationInfo, setCancellationInfo] = useState<{
        can_cancel: boolean;
        cancellation_deadline: string | null;
        days_until_deadline: number;
        cancellation_message: string;
        potential_refund: number;
    } | null>(null);
    const [cancellationLoading, setCancellationLoading] = useState(false);

    // Review-related state
    const [reviewModal, setReviewModal] = useState(false);
    const [myReviews, setMyReviews] = useState<ReviewWithDetails[]>([]);
    const [otherPartyReviews, setOtherPartyReviews] = useState<ReviewWithDetails[]>([]);
    const [canReview, setCanReview] = useState(false);
    const [reviewCheckReason, setReviewCheckReason] = useState<string | null>(null);
    const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
    const [hasExistingReview, setHasExistingReview] = useState(false);

    // Messaging-related state
    const [showMessageThread, setShowMessageThread] = useState(false);
    const [isOfflineBooking, setIsOfflineBooking] = useState(false);

    const {
        createReview,
        getReviews,
        checkCanReview,
        loading: reviewLoading,
        error: reviewError,
    } = useReviews();

    const fetchBookingDetails = useCallback(async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            setCurrentUser(user.id);

            // Fetch booking with car and user details
            const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .select(
                    `
          *,
          car:cars (
            *,
            car_images (
              id,
              image_url,
              image_type,
              is_primary,
              display_order
            )
          ),
          host:user_profiles!bookings_host_id_fkey (
            id,
            full_name,
            email,
            phone,
            profile_image_url
          ),
          renter:user_profiles!bookings_renter_id_fkey (
            id,
            full_name,
            email,
            phone,
            profile_image_url
          )
        `,
                )
                .eq('id', bookingId)
                .single();

            if (bookingError) {
                if (bookingError.code === 'PGRST116') {
                    setError('Booking not found.');
                } else {
                    setError('Failed to load booking details.');
                }
                return;
            }

            // Check if user has permission to view this booking
            if (bookingData.renter_id !== user.id && bookingData.host_id !== user.id) {
                setError("You don't have permission to view this booking.");
                return;
            }

            // Sort car images
            if (bookingData.car.car_images) {
                bookingData.car.car_images.sort((a: CarImage, b: CarImage) => {
                    if (a.is_primary && !b.is_primary) return -1;
                    if (!a.is_primary && b.is_primary) return 1;
                    return a.display_order - b.display_order;
                });
            }

            setBooking(bookingData as BookingWithDetails);

            // Check if this is an offline booking
            try {
                const specialInstructions = JSON.parse(bookingData.special_instructions || '{}');
                setIsOfflineBooking(specialInstructions.is_offline_booking === true);
            } catch {
                setIsOfflineBooking(false);
            }
        } catch (error) {
            console.error('Error loading booking:', error);
            setError('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    }, [bookingId, router]);

    const fetchCancellationInfo = useCallback(async () => {
        if (!booking || !currentUser || currentUser !== booking.renter_id) return;

        try {
            setCancellationLoading(true);
            const supabase = createClient();

            const { data, error } = await (supabase as any).rpc('get_booking_cancellation_info', {
                p_booking_id: bookingId,
                p_renter_id: currentUser,
            });

            if (error) {
                console.error('Error fetching cancellation info:', error);
                return;
            }

            if (data && data.length > 0) {
                setCancellationInfo(data[0]);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setCancellationLoading(false);
        }
    }, [booking, currentUser, bookingId]);

    useEffect(() => {
        if (bookingId) {
            fetchBookingDetails();
        }
    }, [bookingId, fetchBookingDetails]);

    const checkReviewEligibility = useCallback(async () => {
        if (!booking || !currentUser || booking.status !== 'COMPLETED') return;

        try {
            // Check if user can review (booking completed, hasn't reviewed yet)
            const canReviewResult = await checkCanReview({
                booking_id: booking.id,
                reviewer_id: currentUser,
                booking_status: booking.status,
            });

            setCanReview(canReviewResult.canReview);
            setReviewCheckReason(canReviewResult.reason);

            // Fetch reviews I've written for this booking
            const myExistingReviews = await getReviews({
                booking_id: booking.id,
                reviewer_id: currentUser,
            });

            // Fetch reviews the other party has written about me for this booking
            const otherPartyExistingReviews = await getReviews({
                booking_id: booking.id,
                reviewed_id: currentUser,
            });

            setHasExistingReview(myExistingReviews.length > 0);
            setMyReviews(myExistingReviews);
            setOtherPartyReviews(otherPartyExistingReviews);
        } catch (error) {
            console.error('Error checking review eligibility:', error);
        }
    }, [booking, currentUser, checkCanReview, getReviews]);

    useEffect(() => {
        if (booking && currentUser) {
            fetchCancellationInfo();
            checkReviewEligibility();
        }
    }, [booking, currentUser, fetchCancellationInfo, checkReviewEligibility]);

    const updateBookingStatus = async (status: 'CONFIRMED' | 'CANCELLED' | 'DISPUTED') => {
        if (!booking || !currentUser) return;

        setUpdating(true);
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('bookings')
                .update({ status })
                .eq('id', bookingId);

            if (error) {
                console.error('Error updating booking status:', error);
                alert('Failed to update booking status. Please try again.');
                return;
            }

            setBooking({ ...booking, status });
        } catch (error) {
            console.error('Error updating booking:', error);
            alert('An unexpected error occurred. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    const handleSubmitReview = async (reviewData: CreateReviewRequest) => {
        try {
            const result = await createReview(reviewData);
            if (result.success) {
                setReviewSuccess(
                    'Thank you for your review! Your feedback helps improve our community.',
                );
                setReviewModal(false);
                // Refresh review status
                await checkReviewEligibility();
            }
        } catch (error) {
            console.error('Error submitting review:', error);
            // Error is handled by the useReviews hook
        }
    };

    const cancelBookingByRenter = async () => {
        if (!booking || !currentUser || currentUser !== booking.renter_id) return;

        const reason = prompt(
            `Cancel your booking for ${booking.car.make} ${booking.car.model}?\n\nPlease provide a reason for cancellation:`,
        );
        if (!reason) return;

        try {
            setUpdating(true);
            const supabase = createClient();

            const { data, error } = await (supabase as any).rpc('cancel_booking_by_renter', {
                p_booking_id: bookingId,
                p_renter_id: currentUser,
                p_cancellation_reason: reason,
            });

            if (error) {
                alert(`Error cancelling booking: ${error.message}`);
                return;
            }

            const result = data[0];
            if (result.success) {
                alert(`Booking cancelled successfully!\n\n${result.message}`);
                // Refresh booking details
                await fetchBookingDetails();
                await fetchCancellationInfo();
            } else {
                alert(`Cannot cancel booking: ${result.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error cancelling booking: ${errorMessage}`);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'CONFIRMED':
                return 'bg-black text-white';
            case 'AUTO_APPROVED':
                return 'bg-black text-white';
            case 'PENDING':
                return 'bg-gray-600 text-white';
            case 'REJECTED':
                return 'bg-red-600 text-white';
            case 'IN_PROGRESS':
                return 'bg-gray-700 text-white';
            case 'COMPLETED':
                return 'bg-black text-white';
            case 'CANCELLED':
                return 'bg-red-600 text-white';
            case 'DISPUTED':
                return 'bg-red-600 text-white';
            default:
                return 'bg-gray-400 text-white';
        }
    };

    const getStatusActions = () => {
        if (!booking || !currentUser || updating) return null;

        const isHost = currentUser === booking.host_id;
        const isRenter = currentUser === booking.renter_id;

        switch (booking.status) {
            case 'PENDING':
            case 'AUTO_APPROVED':
                if (isHost) {
                    return (
                        <div className="flex space-x-3">
                            <Button
                                onClick={() => updateBookingStatus('CONFIRMED')}
                                disabled={updating}
                                className="bg-green-800 hover:bg-green-900 text-white font-semibold"
                            >
                                Accept Booking
                            </Button>
                            <Button
                                onClick={() => updateBookingStatus('CANCELLED')}
                                disabled={updating}
                                className="bg-red-800 hover:bg-red-900 text-white font-semibold"
                            >
                                Decline Booking
                            </Button>
                        </div>
                    );
                }
                if (isRenter) {
                    return (
                        <div className="space-y-3">
                            {cancellationInfo && cancellationInfo.can_cancel ? (
                                <div>
                                    <Button
                                        onClick={cancelBookingByRenter}
                                        disabled={updating || cancellationLoading}
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        {updating ? 'Cancelling...' : 'Cancel Booking'}
                                    </Button>
                                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <p className="text-sm text-yellow-800">
                                            <strong>Cancellation Info:</strong>
                                            <br />
                                            Deadline:{' '}
                                            {cancellationInfo.cancellation_deadline
                                                ? new Date(
                                                      cancellationInfo.cancellation_deadline,
                                                  ).toLocaleString()
                                                : 'N/A'}
                                            <br />
                                            Days remaining: {cancellationInfo.days_until_deadline}
                                            <br />
                                            Potential refund:{' '}
                                            {formatCurrency(cancellationInfo.potential_refund || 0)}
                                        </p>
                                    </div>
                                </div>
                            ) : cancellationInfo ? (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-800">
                                        <strong>Cannot cancel:</strong>{' '}
                                        {cancellationInfo.cancellation_message}
                                    </p>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => updateBookingStatus('CANCELLED')}
                                    disabled={updating}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Cancel Booking
                                </Button>
                            )}
                        </div>
                    );
                }
                break;
            case 'CONFIRMED':
                if (isOfflineBooking) {
                    return (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                <p className="text-sm text-yellow-800">
                                    오프라인 예약은 메시지 기능을 사용할 수 없습니다.
                                </p>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="flex space-x-3">
                        <Button
                            onClick={() => setShowMessageThread(!showMessageThread)}
                            className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>
                                {showMessageThread
                                    ? '메시지 숨기기'
                                    : `${isHost ? '렌터' : '호스트'}와 메시지`}
                            </span>
                        </Button>
                        {isRenter && (
                            <div className="flex flex-col space-y-2">
                                {cancellationInfo && cancellationInfo.can_cancel ? (
                                    <div>
                                        <Button
                                            onClick={cancelBookingByRenter}
                                            disabled={updating || cancellationLoading}
                                            variant="outline"
                                            className="border-red-500 text-red-500 hover:bg-red-50"
                                        >
                                            {updating ? 'Cancelling...' : 'Cancel Booking'}
                                        </Button>
                                        <div className="mt-2 text-xs text-yellow-600">
                                            Deadline:{' '}
                                            {cancellationInfo.cancellation_deadline
                                                ? new Date(
                                                      cancellationInfo.cancellation_deadline,
                                                  ).toLocaleDateString()
                                                : 'N/A'}
                                            ({cancellationInfo.days_until_deadline} days left)
                                        </div>
                                    </div>
                                ) : cancellationInfo ? (
                                    <div className="text-xs text-red-600">
                                        Cannot cancel: {cancellationInfo.cancellation_message}
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => updateBookingStatus('CANCELLED')}
                                        disabled={updating}
                                        variant="outline"
                                        className="border-red-500 text-red-500 hover:bg-red-50"
                                    >
                                        Cancel Booking
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    const getPrimaryImage = () => {
        if (!booking?.car.car_images || booking.car.car_images.length === 0) {
            return null;
        }
        const primary = booking.car.car_images.find((img) => img.is_primary);
        return primary?.image_url || booking.car.car_images[0].image_url;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading booking details...</p>
                </div>
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || 'Booking not found'}</p>
                    <Link
                        href="/home"
                        className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                        Return to Home
                    </Link>
                </div>
            </div>
        );
    }

    const isHost = currentUser === booking.host_id;
    const isRenter = currentUser === booking.renter_id;

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
                            <span className="text-gray-600">Booking Details</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/home"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Home
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

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Booking Header */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-black mb-2">
                                {booking.status === 'PENDING' && 'Booking Request'}
                                {booking.status === 'CONFIRMED' && 'Confirmed Booking'}
                                {booking.status === 'CANCELLED' && 'Cancelled Booking'}
                                {booking.status === 'COMPLETED' && 'Completed Trip'}
                                {booking.status === 'IN_PROGRESS' && 'Trip in Progress'}
                                {booking.status === 'DISPUTED' && 'Disputed Booking'}
                            </h1>
                            <p className="text-gray-600">
                                Booking ID: {booking.id.substring(0, 8)}
                            </p>
                        </div>
                        <div className="flex items-center space-x-4 mt-4 md:mt-0">
                            <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}
                            >
                                {booking.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>

                    {/* Status Message */}
                    {booking.status === 'PENDING' && (
                        <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                            <p className="text-yellow-800">
                                {isHost &&
                                    'You have a new booking request. Please review and respond.'}
                                {isRenter &&
                                    "Your booking request is pending host approval. You'll be notified once the host responds."}
                            </p>
                        </div>
                    )}

                    {booking.status === 'CONFIRMED' && (
                        <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg">
                            <p className="text-green-800">
                                🎉 Booking confirmed! Please coordinate with{' '}
                                {isHost ? 'the renter' : 'your host'} for pickup details.
                            </p>
                        </div>
                    )}

                    {booking.status === 'CANCELLED' && (
                        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
                            <p className="text-red-800">
                                This booking has been cancelled. If you have any questions, please
                                contact support.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mb-6">{getStatusActions()}</div>

                    {/* Message Thread */}
                    {showMessageThread && !isOfflineBooking && booking.status === 'CONFIRMED' && (
                        <div className="bg-gray-50 rounded-xl p-6 mb-6">
                            <div className="h-96 bg-white rounded-lg shadow-sm">
                                <MessageThread
                                    booking_id={booking.id}
                                    current_user_id={currentUser || ''}
                                    other_user_id={
                                        isHost ? booking.renter_id || '' : booking.host_id || ''
                                    }
                                    other_user_name={
                                        isHost
                                            ? booking.renter.full_name || 'Renter'
                                            : booking.host.full_name || 'Host'
                                    }
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Vehicle and Trip Details */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Vehicle Info */}
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h2 className="text-xl font-bold text-black mb-4">Vehicle</h2>
                            <div className="flex space-x-4">
                                <div className="w-24 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                    {getPrimaryImage() ? (
                                        <img
                                            src={getPrimaryImage()!}
                                            alt={`${booking.car.make} ${booking.car.model}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl">
                                            🚗
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-black">
                                        {booking.car.make} {booking.car.model} ({booking.car.year})
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {booking.car.color} • {booking.car.transmission} •{' '}
                                        {booking.car.seats} seats
                                    </p>
                                    <Link
                                        href={`/vehicles/${booking.car.id}`}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        View Vehicle Details →
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Trip Details */}
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h2 className="text-xl font-bold text-black mb-4">Trip Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Pickup</p>
                                    <p className="text-black">
                                        {new Date(booking.start_date).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {new Date(booking.start_date).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Return</p>
                                    <p className="text-black">
                                        {new Date(booking.end_date).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {new Date(booking.end_date).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Duration</p>
                                    <p className="text-black">
                                        {booking.total_days} day
                                        {booking.total_days > 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Insurance</p>
                                    <p className="text-black">
                                        {booking.insurance_type} Protection
                                    </p>
                                </div>
                            </div>

                            {/* Pickup/Dropoff Locations */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">
                                            Pickup Location
                                        </p>
                                        <p className="text-black">
                                            {booking.pickup_location &&
                                            typeof booking.pickup_location === 'object' &&
                                            !Array.isArray(booking.pickup_location)
                                                ? String(
                                                      (
                                                          booking.pickup_location as Record<
                                                              string,
                                                              unknown
                                                          >
                                                      ).address || 'Location to be confirmed',
                                                  )
                                                : 'Location to be confirmed'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">
                                            Dropoff Location
                                        </p>
                                        <p className="text-black">
                                            {booking.dropoff_location &&
                                            typeof booking.dropoff_location === 'object' &&
                                            !Array.isArray(booking.dropoff_location)
                                                ? String(
                                                      (
                                                          booking.dropoff_location as Record<
                                                              string,
                                                              unknown
                                                          >
                                                      ).address || 'Same as pickup',
                                                  )
                                                : 'Same as pickup'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Special Instructions */}
                            {booking.special_instructions && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-sm font-medium text-gray-500 mb-2">
                                        Special Instructions
                                    </p>
                                    <p className="text-black">{booking.special_instructions}</p>
                                </div>
                            )}
                        </div>

                        {/* Review Section for Completed Bookings */}
                        {booking.status === 'COMPLETED' && (
                            <div className="space-y-6">
                                {/* My Review Section */}
                                <div className="bg-white rounded-2xl shadow-xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-black flex items-center gap-2">
                                            <Star className="w-5 h-5 text-yellow-500" />
                                            Your Review
                                        </h2>
                                    </div>

                                    {reviewSuccess && (
                                        <Alert className="mb-4 border-green-200 bg-green-50">
                                            <AlertDescription className="text-green-800">
                                                {reviewSuccess}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {reviewError && (
                                        <Alert className="mb-4 border-red-200 bg-red-50">
                                            <AlertDescription className="text-red-800">
                                                {reviewError}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {hasExistingReview && myReviews.length > 0 ? (
                                        <div className="space-y-4">
                                            <p className="text-green-800 font-medium">
                                                ✅ You&apos;ve reviewed this trip
                                            </p>
                                            {myReviews.map((review) => (
                                                <ReviewCard
                                                    key={review.id}
                                                    review={review}
                                                    showCar={false}
                                                    showReviewer={false}
                                                    showReviewee={true}
                                                    className="border-green-200"
                                                />
                                            ))}
                                        </div>
                                    ) : canReview ? (
                                        <div className="space-y-4">
                                            <p className="text-gray-600">
                                                Share your experience with{' '}
                                                {isHost ? 'your renter' : 'your host'} to help other
                                                users make informed decisions.
                                            </p>
                                            <Button
                                                onClick={() => setReviewModal(true)}
                                                className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-semibold shadow-lg hover:shadow-xl border-0 transition-all duration-300 hover:scale-105 group disabled:hover:scale-100 disabled:opacity-50 flex items-center gap-2 px-6 py-3"
                                                disabled={reviewLoading}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                <Star className="w-5 h-5 relative z-10 text-white group-hover:animate-pulse" />
                                                <span className="relative z-10 text-base">
                                                    {reviewLoading
                                                        ? 'Loading...'
                                                        : 'Leave a Review'}
                                                </span>
                                                {!reviewLoading && (
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shimmer transition-opacity duration-300" />
                                                )}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-gray-600 text-sm">
                                                {reviewCheckReason ||
                                                    'Reviews are not available for this booking.'}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Other Party's Review Section */}
                                <div className="bg-white rounded-2xl shadow-xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-black flex items-center gap-2">
                                            <Star className="w-5 h-5 text-blue-500" />
                                            {isHost ? 'Renter' : 'Host'}&apos;s Review About You
                                        </h2>
                                    </div>

                                    {otherPartyReviews.length > 0 ? (
                                        <div className="space-y-4">
                                            <p className="text-blue-800 font-medium">
                                                ✨ {isHost ? 'Your renter' : 'Your host'} has
                                                reviewed you
                                            </p>
                                            {otherPartyReviews.map((review) => (
                                                <ReviewCard
                                                    key={review.id}
                                                    review={review}
                                                    showCar={false}
                                                    showReviewer={true}
                                                    showReviewee={false}
                                                    className="border-blue-200"
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-gray-600 text-sm">
                                                {isHost ? 'Your renter' : 'Your host'} hasn&apos;t
                                                reviewed you yet.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Contact Information */}
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h2 className="text-xl font-bold text-black mb-4">
                                Contact {isHost ? 'Renter' : 'Host'}
                            </h2>
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                                    {(
                                        isHost
                                            ? booking.renter.profile_image_url
                                            : booking.host.profile_image_url
                                    ) ? (
                                        <img
                                            src={
                                                isHost
                                                    ? booking.renter.profile_image_url!
                                                    : booking.host.profile_image_url!
                                            }
                                            alt={
                                                isHost
                                                    ? booking.renter.full_name || 'Renter'
                                                    : booking.host.full_name || 'Host'
                                            }
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xl">👤</span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-black">
                                        {isHost
                                            ? booking.renter.full_name || 'Renter'
                                            : booking.host.full_name || 'Host'}
                                    </p>
                                    {booking.status === 'CONFIRMED' && (
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p>
                                                📧{' '}
                                                {isHost ? booking.renter.email : booking.host.email}
                                            </p>
                                            {(isHost
                                                ? booking.renter.phone
                                                : booking.host.phone) && (
                                                <p>
                                                    📱{' '}
                                                    {isHost
                                                        ? booking.renter.phone
                                                        : booking.host.phone}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {booking.status === 'CONFIRMED' && !isOfflineBooking && (
                                    <Button
                                        onClick={() => setShowMessageThread(!showMessageThread)}
                                        variant="outline"
                                        className="flex items-center space-x-2"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        <span>
                                            {showMessageThread ? '메시지 숨기기' : '메시지'}
                                        </span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-8">
                            <h2 className="text-xl font-bold text-black mb-4">Cost Breakdown</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-800">
                                        {formatDailyRate(booking.daily_rate)} × {booking.total_days}{' '}
                                        days
                                    </span>
                                    <span className="text-black">
                                        {formatCurrency(booking.subtotal)}
                                    </span>
                                </div>

                                {booking.insurance_fee > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Insurance</span>
                                        <span className="text-black">
                                            {formatCurrency(booking.insurance_fee)}
                                        </span>
                                    </div>
                                )}

                                {booking.service_fee > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Service fee</span>
                                        <span className="text-black">
                                            {formatCurrency(booking.service_fee)}
                                        </span>
                                    </div>
                                )}

                                {booking.delivery_fee > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Delivery fee</span>
                                        <span className="text-black">
                                            {formatCurrency(booking.delivery_fee)}
                                        </span>
                                    </div>
                                )}

                                <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                                    <span className="text-black">Total</span>
                                    <span className="text-black">
                                        {formatCurrency(booking.total_amount)}
                                    </span>
                                </div>
                            </div>

                            {/* Booking Info */}
                            <div className="mt-6 pt-6 border-t border-gray-200 text-sm text-gray-600 space-y-2">
                                <p>Booked on {new Date(booking.created_at).toLocaleDateString()}</p>
                                <p>
                                    Last updated {new Date(booking.updated_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Review Modal */}
            {reviewModal && (
                <ReviewModal
                    isOpen={reviewModal}
                    onClose={() => {
                        setReviewModal(false);
                        setReviewSuccess(null);
                    }}
                    onSubmit={handleSubmitReview}
                    booking={{
                        id: booking.id,
                        car: {
                            id: booking.car.id,
                            make: booking.car.make,
                            model: booking.car.model,
                            year: booking.car.year,
                        },
                        host: {
                            id: booking.host.id,
                            full_name: booking.host.full_name || 'Host',
                        },
                        renter: {
                            id: booking.renter.id,
                            full_name: booking.renter.full_name || 'Renter',
                        },
                        start_date: booking.start_date,
                        end_date: booking.end_date,
                        total_amount: booking.total_amount,
                    }}
                    currentUserId={currentUser || ''}
                    loading={reviewLoading}
                />
            )}
        </div>
    );
}
