'use client';

import {
    AlertCircle,
    Calendar,
    Car,
    CheckCircle,
    Clock,
    Search,
    Star,
    Timer,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ReviewModal } from '@/components/reviews/ReviewModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReviews } from '@/hooks/useReviews';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency } from '@/lib/utils';
import type { CreateReviewRequest } from '@/types/reviews.types';

interface BookingWithCancellation {
    booking_id: string;
    car_id: string;
    car_make: string;
    car_model: string;
    car_year: number;
    start_date: string;
    end_date: string;
    total_amount: number;
    status: string;
    can_cancel: boolean;
    cancellation_deadline: string | null;
    days_until_cancellation: number;
    potential_refund: number;
    created_at: string;
    host_id?: string;
    renter_id?: string;
    host_name?: string;
    renter_name?: string;
}

interface CancellationResult {
    success: boolean;
    message: string;
    booking_id: string;
    refund_amount: number;
}

export default function BookingsPage() {
    const [bookings, setBookings] = useState<BookingWithCancellation[]>([]);
    const [filteredBookings, setFilteredBookings] = useState<BookingWithCancellation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [cancelResult, setCancelResult] = useState<CancellationResult | null>(null);
    const [reviewModal, setReviewModal] = useState<string | null>(null);
    const [reviewSuccessBooking, setReviewSuccessBooking] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const { createReview, loading: reviewLoading, error: reviewError } = useReviews();

    const supabase = createClient();
    const router = useRouter();

    // Fetch bookings with cancellation info
    const fetchBookings = useCallback(async () => {
        try {
            setLoading(true);
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            setCurrentUserId(user.id);

            // Try to call the enhanced PostgreSQL function first
            let bookingsData = null;
            let useEnhancedFunction = false;

            try {
                const { data, error } = await (supabase as any).rpc(
                    'get_renter_bookings_with_cancellation',
                    {
                        p_renter_id: user.id,
                        p_status_filter: 'all',
                        p_limit: 100,
                        p_offset: 0,
                    },
                );

                if (!error && data) {
                    bookingsData = data;
                    useEnhancedFunction = true;
                }
            } catch (functionError) {
                console.log('Enhanced function not available, using fallback:', functionError);
            }

            // Fallback to regular bookings query if enhanced function fails
            if (!useEnhancedFunction) {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('bookings')
                    .select(
                        `
            id,
            car_id,
            host_id,
            renter_id,
            start_date,
            end_date,
            total_amount,
            status,
            created_at,
            cars (
              make,
              model,
              year
            ),
            host:user_profiles!bookings_host_id_fkey (
              full_name
            ),
            renter:user_profiles!bookings_renter_id_fkey (
              full_name
            )
          `,
                    )
                    .eq('renter_id', user.id)
                    .order('created_at', { ascending: false });

                if (fallbackError) {
                    console.error('Fallback query failed:', fallbackError);
                    throw fallbackError;
                }

                // Transform fallback data to match expected format
                bookingsData =
                    fallbackData?.map((booking) => ({
                        booking_id: booking.id,
                        car_id: booking.car_id,
                        car_make: (booking.cars as any)?.make || 'Unknown',
                        car_model: (booking.cars as any)?.model || 'Unknown',
                        car_year: (booking.cars as any)?.year || 0,
                        start_date: booking.start_date,
                        end_date: booking.end_date,
                        total_amount: booking.total_amount,
                        status: booking.status,
                        can_cancel: false, // Will be determined by individual checks if needed
                        cancellation_deadline: null,
                        days_until_cancellation: 0,
                        potential_refund: 0,
                        created_at: booking.created_at,
                        host_id: booking.host_id,
                        renter_id: booking.renter_id,
                        host_name: (booking.host as any)?.full_name || 'Host',
                        renter_name: (booking.renter as any)?.full_name || 'Renter',
                    })) || [];
            }

            setBookings(bookingsData || []);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            // Only redirect to login for authentication errors
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const isAuthError =
                errorMessage.toLowerCase().includes('auth') ||
                errorMessage.toLowerCase().includes('unauthorized') ||
                errorMessage.toLowerCase().includes('jwt');

            if (isAuthError) {
                router.push('/login');
            } else {
                // For other errors, just show empty state but don't logout
                setBookings([]);
            }
        } finally {
            setLoading(false);
        }
    }, [router, supabase]);

    // Filter bookings based on search and status
    useEffect(() => {
        let filtered = bookings;

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (booking) =>
                    booking.car_make.toLowerCase().includes(search) ||
                    booking.car_model.toLowerCase().includes(search) ||
                    booking.booking_id.toLowerCase().includes(search),
            );
        }

        if (activeTab !== 'all') {
            filtered = filtered.filter((booking) => {
                switch (activeTab) {
                    case 'active':
                        return ['PENDING', 'AUTO_APPROVED', 'CONFIRMED', 'IN_PROGRESS'].includes(
                            booking.status,
                        );
                    case 'completed':
                        return booking.status === 'COMPLETED';
                    case 'cancelled':
                        return booking.status === 'CANCELLED';
                    case 'cancellable':
                        return booking.can_cancel;
                    default:
                        return true;
                }
            });
        }

        setFilteredBookings(filtered);
    }, [bookings, searchTerm, activeTab]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    // Handle booking cancellation
    const handleCancelBooking = async (bookingId: string, carInfo: string) => {
        const reason = prompt(
            `Cancel booking for ${carInfo}?\n\nPlease provide a reason for cancellation:`,
        );
        if (!reason) return;

        try {
            setCancelling(bookingId);
            setCancelResult(null);

            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await (supabase as any).rpc('cancel_booking_by_renter', {
                p_booking_id: bookingId,
                p_renter_id: user.id,
                p_cancellation_reason: reason,
            });

            if (error) throw error;

            const result = data[0] as CancellationResult;
            setCancelResult(result);

            if (result.success) {
                // Refresh bookings list
                await fetchBookings();
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setCancelResult({
                success: false,
                message: `Failed to cancel booking: ${errorMessage}`,
                booking_id: bookingId,
                refund_amount: 0,
            });
        } finally {
            setCancelling(null);
        }
    };

    // Get status color and icon
    const getStatusDisplay = (status: string) => {
        const statusConfig = {
            PENDING: {
                color: 'bg-gray-600 text-white',
                icon: Clock,
                label: 'Pending',
            },
            AUTO_APPROVED: {
                color: 'bg-black text-white',
                icon: CheckCircle,
                label: 'Auto Approved',
            },
            CONFIRMED: {
                color: 'bg-black text-white',
                icon: CheckCircle,
                label: 'Confirmed',
            },
            REJECTED: {
                color: 'bg-red-600 text-white',
                icon: X,
                label: 'Rejected',
            },
            CANCELLED: {
                color: 'bg-gray-400 text-white',
                icon: X,
                label: 'Cancelled',
            },
            IN_PROGRESS: {
                color: 'bg-gray-700 text-white',
                icon: Car,
                label: 'In Progress',
            },
            COMPLETED: {
                color: 'bg-black text-white',
                icon: CheckCircle,
                label: 'Completed',
            },
            DISPUTED: {
                color: 'bg-red-600 text-white',
                icon: AlertCircle,
                label: 'Disputed',
            },
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['PENDING'];
        const Icon = config.icon;

        return (
            <Badge className={config.color}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    // Format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Get tab counts
    const getTabCounts = () => {
        return {
            all: bookings.length,
            active: bookings.filter((b) =>
                ['PENDING', 'AUTO_APPROVED', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status),
            ).length,
            completed: bookings.filter((b) => b.status === 'COMPLETED').length,
            cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
            cancellable: bookings.filter((b) => b.can_cancel).length,
        };
    };

    const handleSubmitReview = async (reviewData: CreateReviewRequest) => {
        try {
            const result = await createReview(reviewData);
            if (result.success) {
                setReviewSuccessBooking(reviewData.booking_id);
                setReviewModal(null);
                // You might want to refresh bookings here if needed
            }
        } catch (error) {
            console.error('Error submitting review:', error);
            // Error is handled by the useReviews hook
        }
    };

    const tabCounts = getTabCounts();

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center justify-center min-h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h1>
                    <p className="text-gray-600">View and manage your bookings</p>
                </div>

                {/* Search and Filters */}
                <div className="mb-6 flex flex-wrap gap-4">
                    <div className="flex-1 min-w-64">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Search by vehicle or booking ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </div>

                {/* Cancellation Result Alert */}
                {cancelResult && (
                    <Alert
                        className={`mb-6 ${cancelResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
                    >
                        <AlertCircle
                            className={`h-4 w-4 ${cancelResult.success ? 'text-green-600' : 'text-red-600'}`}
                        />
                        <AlertDescription
                            className={cancelResult.success ? 'text-green-800' : 'text-red-800'}
                        >
                            {cancelResult.message}
                            {cancelResult.success && cancelResult.refund_amount > 0 && (
                                <div className="mt-2 font-semibold">
                                    Refund Amount: {formatCurrency(cancelResult.refund_amount)}
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Review Success Alert */}
                {reviewSuccessBooking && (
                    <Alert className="mb-6 border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                            Thank you for your review! Your feedback helps improve our community.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Review Error Alert */}
                {reviewError && (
                    <Alert className="mb-6 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">{reviewError}</AlertDescription>
                    </Alert>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
                        <TabsTrigger value="active">Active ({tabCounts.active})</TabsTrigger>
                        <TabsTrigger value="completed">
                            Completed ({tabCounts.completed})
                        </TabsTrigger>
                        <TabsTrigger value="cancelled">
                            Cancelled ({tabCounts.cancelled})
                        </TabsTrigger>
                        <TabsTrigger value="cancellable">
                            Cancellable ({tabCounts.cancellable})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab} className="mt-6">
                        {filteredBookings.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <Car className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        No bookings found
                                    </h3>
                                    <p className="text-gray-500 mb-4">
                                        {activeTab === 'all'
                                            ? "You haven't booked any vehicles yet"
                                            : `No ${activeTab} bookings found`}
                                    </p>
                                    <Link href="/home/renter">
                                        <Button className="transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer">
                                            Browse Vehicles
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {filteredBookings.map((booking) => (
                                    <Link
                                        key={booking.booking_id}
                                        href={`/bookings/${booking.booking_id}`}
                                        className="block"
                                    >
                                        <Card className="card-interactive">
                                            <CardContent className="p-6">
                                                <div className="flex flex-wrap items-start justify-between gap-4">
                                                    {/* Car Info */}
                                                    <div className="flex-1 min-w-64">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <Car className="w-5 h-5 text-blue-600" />
                                                            <h3 className="text-lg font-semibold text-gray-900">
                                                                {booking.car_year}{' '}
                                                                {booking.car_make}{' '}
                                                                {booking.car_model}
                                                            </h3>
                                                            {getStatusDisplay(booking.status)}
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-4 h-4" />
                                                                <span>
                                                                    {formatDate(booking.start_date)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-4 h-4" />
                                                                <span>
                                                                    {formatDate(booking.end_date)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">
                                                                    Rp
                                                                </span>
                                                                <span>
                                                                    {booking.total_amount.toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-700 font-medium">
                                                                    Booking ID:{' '}
                                                                    {booking.booking_id.slice(0, 8)}
                                                                    ...
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Cancellation Info */}
                                                        {booking.can_cancel &&
                                                            booking.cancellation_deadline && (
                                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                                                    <div className="flex items-center gap-2 text-yellow-800 text-sm">
                                                                        <Timer className="w-4 h-4" />
                                                                        <span className="font-medium">
                                                                            Cancellable
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-yellow-700 text-sm mt-1">
                                                                        {booking.days_until_cancellation >
                                                                        0 ? (
                                                                            <>
                                                                                Cancellation
                                                                                deadline:{' '}
                                                                                {formatDate(
                                                                                    booking.cancellation_deadline,
                                                                                )}{' '}
                                                                                (
                                                                                {
                                                                                    booking.days_until_cancellation
                                                                                }{' '}
                                                                                days left)
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                Cancellation
                                                                                deadline has passed
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    {booking.potential_refund >
                                                                        0 && (
                                                                        <div className="text-yellow-700 text-sm">
                                                                            Expected refund: Rp
                                                                            {booking.potential_refund.toLocaleString()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex flex-col gap-2 min-w-32">
                                                        {/* Review Button for Completed Bookings */}
                                                        {booking.status === 'COMPLETED' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setReviewModal(
                                                                        booking.booking_id,
                                                                    );
                                                                }}
                                                                disabled={reviewLoading}
                                                                className="w-full relative overflow-hidden bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-semibold shadow-lg hover:shadow-xl border-0 transition-all duration-300 hover:scale-105 group disabled:hover:scale-100 disabled:opacity-50"
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                                <Star className="w-4 h-4 mr-2 relative z-10 text-white group-hover:animate-pulse" />
                                                                <span className="relative z-10">
                                                                    {reviewLoading
                                                                        ? 'Loading...'
                                                                        : 'Leave Review'}
                                                                </span>
                                                                {!reviewLoading && (
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shimmer transition-opacity duration-300" />
                                                                )}
                                                            </Button>
                                                        )}

                                                        {/* Cancellation Action */}
                                                        {booking.can_cancel &&
                                                            booking.days_until_cancellation > 0 && (
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleCancelBooking(
                                                                            booking.booking_id,
                                                                            `${booking.car_year} ${booking.car_make} ${booking.car_model}`,
                                                                        );
                                                                    }}
                                                                    disabled={
                                                                        cancelling ===
                                                                        booking.booking_id
                                                                    }
                                                                    className="w-full btn-interactive disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                                                                >
                                                                    {cancelling ===
                                                                    booking.booking_id ? (
                                                                        <div className="flex items-center">
                                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                                            Cancelling...
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <X className="w-4 h-4 mr-2" />
                                                                            Cancel Booking
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Review Modal */}
            {reviewModal && currentUserId && (
                <ReviewModal
                    isOpen={!!reviewModal}
                    onClose={() => {
                        setReviewModal(null);
                        setReviewSuccessBooking(null);
                    }}
                    onSubmit={handleSubmitReview}
                    booking={
                        (() => {
                            const booking = bookings.find((b) => b.booking_id === reviewModal);
                            if (!booking) return null;

                            return {
                                id: booking.booking_id,
                                car: {
                                    id: booking.car_id,
                                    make: booking.car_make,
                                    model: booking.car_model,
                                    year: booking.car_year,
                                },
                                host: {
                                    id: booking.host_id || '',
                                    full_name: booking.host_name || 'Host',
                                },
                                renter: {
                                    id: booking.renter_id || '',
                                    full_name: booking.renter_name || 'Renter',
                                },
                                start_date: booking.start_date,
                                end_date: booking.end_date,
                                total_amount: booking.total_amount,
                            };
                        })()!
                    }
                    currentUserId={currentUserId}
                    loading={reviewLoading}
                />
            )}
        </div>
    );
}
