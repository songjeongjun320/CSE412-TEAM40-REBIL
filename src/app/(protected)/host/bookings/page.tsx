'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import EmergencyCancelModal from '@/components/host/EmergencyCancelModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentUserRoles } from '@/lib/auth/userRoles';
import { createClient } from '@/lib/supabase/supabaseClient';
import { EMERGENCY_REASON_LABELS, calculateEmergencyCancellationFee } from '@/lib/utils';
import { Tables } from '@/types/base/database.types';
import { EmergencyCancellationReason } from '@/types/booking.types';

// Types
type Booking = Tables<'bookings'>;
type BookingStatus = Tables<'bookings'>['status'];

interface ExtendedBooking extends Booking {
    renter?: {
        full_name: string | null;
        email: string;
        phone: string | null;
    };
    car?: {
        make: string;
        model: string;
        year: number;
        license_plate: string | null;
        color: string | null;
        images?: Array<{
            image_url: string;
            is_primary: boolean;
        }>;
    };
}

interface FilterState {
    status: BookingStatus | 'ALL';
    dateRange: {
        start: string;
        end: string;
    };
    carId: string;
    searchTerm: string;
}

// Status configuration
const STATUS_CONFIG = {
    ALL: { label: 'All', color: 'bg-gray-400 text-white', count: 0 },
    PENDING: {
        label: 'Pending',
        color: 'bg-gray-600 text-white',
        count: 0,
    },
    CONFIRMED: {
        label: 'Confirmed',
        color: 'bg-black text-white',
        count: 0,
    },
    AUTO_APPROVED: {
        label: 'Auto Approved',
        color: 'bg-gray-800 text-white',
        count: 0,
    },
    IN_PROGRESS: {
        label: 'Active',
        color: 'bg-gray-700 text-white',
        count: 0,
    },
    COMPLETED: {
        label: 'Completed',
        color: 'bg-black text-white',
        count: 0,
    },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-600 text-white', count: 0 },
    DISPUTED: { label: 'Disputed', color: 'bg-red-600 text-white', count: 0 },
} as const;

export default function HostBookingsPage() {
    const router = useRouter();
    const [bookings, setBookings] = useState<ExtendedBooking[]>([]);
    const [filteredBookings, setFilteredBookings] = useState<ExtendedBooking[]>([]);
    const [userCars, setUserCars] = useState<Tables<'cars'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [selectedBooking, setSelectedBooking] = useState<ExtendedBooking | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [showEmergencyCancelModal, setShowEmergencyCancelModal] = useState(false);

    // Filter state
    const [filters, setFilters] = useState<FilterState>({
        status: 'ALL',
        dateRange: { start: '', end: '' },
        carId: '',
        searchTerm: '',
    });

    // Status counts
    const [statusCounts, setStatusCounts] = useState(STATUS_CONFIG);

    const checkHostPermission = useCallback(async () => {
        try {
            const roles = await getCurrentUserRoles();
            if (!roles?.isHost) {
                router.push('/home');
                return;
            }
            setIsHost(true);
        } catch (error) {
            console.error('Error checking user roles:', error);
            router.push('/home');
        } finally {
            setCheckingAuth(false);
        }
    }, [router]);

    useEffect(() => {
        checkHostPermission();
    }, [checkHostPermission]);

    const fetchBookingsData = useCallback(async () => {
        if (!isHost) return;

        try {
            setLoading(true);
            const supabase = createClient();

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                setError('Unable to load user information.');
                return;
            }

            // Fetch host's cars
            const { data: cars, error: carsError } = await supabase
                .from('cars')
                .select('*')
                .eq('host_id', user.id)
                .order('created_at', { ascending: false });

            if (carsError) {
                console.error('Failed to fetch cars:', carsError);
            } else {
                setUserCars(cars || []);
            }

            // Fetch bookings with enhanced data
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(
                    `
          *,
          renter:user_profiles!bookings_renter_id_fkey(full_name, email, phone),
          car:cars!bookings_car_id_fkey(
            make, 
            model, 
            year, 
            license_plate, 
            color,
            car_images:car_images(image_url, is_primary)
          )
        `,
                )
                .eq('host_id', user.id)
                .order('created_at', { ascending: false });

            if (bookingsError) {
                console.error('Failed to fetch bookings:', bookingsError);
                setError('Failed to load bookings.');
                return;
            }

            const enhancedBookings = (bookingsData || []).map((booking) => ({
                ...booking,
                car: booking.car
                    ? {
                          ...booking.car,
                          images: booking.car.car_images || [],
                      }
                    : null,
            })) as ExtendedBooking[];

            setBookings(enhancedBookings);

            // Calculate status counts
            const counts = Object.fromEntries(
                Object.entries(STATUS_CONFIG).map(([key, config]) => [
                    key,
                    { ...config, count: key === 'ALL' ? enhancedBookings.length : 0 },
                ]),
            );

            enhancedBookings.forEach((booking) => {
                if (counts[booking.status]) {
                    counts[booking.status] = {
                        ...counts[booking.status],
                        count: counts[booking.status].count + 1,
                    };
                }
            });

            setStatusCounts(counts as typeof STATUS_CONFIG);
        } catch (error) {
            console.error('Error fetching bookings data:', error);
            setError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, [isHost]);

    useEffect(() => {
        if (isHost) {
            fetchBookingsData();
        }
    }, [isHost, fetchBookingsData]);

    // Filter bookings
    useEffect(() => {
        let filtered = [...bookings];

        // Status filter
        if (filters.status !== 'ALL') {
            filtered = filtered.filter((booking) => booking.status === filters.status);
        }

        // Date range filter
        if (filters.dateRange.start) {
            filtered = filtered.filter(
                (booking) => new Date(booking.start_date) >= new Date(filters.dateRange.start),
            );
        }
        if (filters.dateRange.end) {
            filtered = filtered.filter(
                (booking) => new Date(booking.end_date) <= new Date(filters.dateRange.end),
            );
        }

        // Car filter
        if (filters.carId) {
            filtered = filtered.filter((booking) => booking.car_id === filters.carId);
        }

        // Search filter
        if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(
                (booking) =>
                    booking.id.toLowerCase().includes(searchLower) ||
                    booking.renter?.full_name?.toLowerCase().includes(searchLower) ||
                    booking.renter?.email.toLowerCase().includes(searchLower) ||
                    `${booking.car?.make} ${booking.car?.model}`
                        .toLowerCase()
                        .includes(searchLower),
            );
        }

        setFilteredBookings(filtered);
    }, [bookings, filters]);

    const handleApproveBooking = async (bookingId: string) => {
        console.log('✅ handleApproveBooking: Starting booking approval process');
        console.log('📋 Approval inputs:', {
            bookingId: bookingId,
            actionLoading: actionLoading,
        });

        if (actionLoading) {
            console.log('❌ Approval cancelled: Action already in progress');
            return;
        }

        setActionLoading(bookingId);
        console.log('⏳ Setting action loading state for booking:', bookingId);

        try {
            const supabase = createClient();
            console.log('🔌 Supabase client created for booking approval');

            const {
                data: { user },
            } = await supabase.auth.getUser();

            console.log('👤 User authentication check for approval:', {
                hasUser: !!user,
                userId: user?.id,
                userEmail: user?.email,
            });

            if (!user) {
                console.log('❌ No authenticated user found for approval');
                setError('You must be logged in to approve bookings.');
                return;
            }

            console.log('📡 Updating booking status to CONFIRMED...');
            const { data, error } = await supabase
                .from('bookings')
                .update({
                    status: 'CONFIRMED',
                    approved_at: new Date().toISOString(),
                    approved_by: user.id,
                })
                .eq('id', bookingId)
                .eq('host_id', user.id)
                .select();

            console.log('📊 Booking approval result:', {
                hasData: !!data,
                hasError: !!error,
                errorCode: error?.code,
                errorMessage: error?.message,
                updatedRows: data?.length || 0,
                updatedBooking: data?.[0],
            });

            if (error) {
                console.error('❌ Error approving booking:', {
                    error: error,
                    errorCode: error.code,
                    errorMessage: error.message,
                    errorDetails: error.details,
                });
                setError('Failed to approve booking. Please try again.');
                return;
            }

            if (!data || data.length === 0) {
                console.log('❌ No booking found or updated for approval');
                setError('Booking not found or you do not have permission to approve it.');
                return;
            }

            console.log('✅ Booking approved successfully:', {
                bookingId: bookingId,
                approvedAt: data[0].approved_at,
                approvedBy: data[0].approved_by,
            });

            // Refresh bookings list
            console.log('🔄 Refreshing bookings list after approval...');
            await fetchBookingsData();
        } catch (error: any) {
            console.error('❌ Error in approval process:', {
                error: error,
                errorMessage: error?.message,
                errorStack: error?.stack,
            });
            setError('An unexpected error occurred while approving the booking.');
        } finally {
            setActionLoading(null);
            console.log('✅ Approval process completed');
        }
    };

    const handleRejectBooking = async (bookingId: string, reason: string) => {
        console.log('❌ handleRejectBooking: Starting booking rejection process');
        console.log('📋 Rejection inputs:', {
            bookingId: bookingId,
            reason: reason,
            actionLoading: actionLoading,
        });

        if (actionLoading) {
            console.log('❌ Rejection cancelled: Action already in progress');
            return;
        }

        setActionLoading(bookingId);
        console.log('⏳ Setting action loading state for rejection:', bookingId);

        try {
            const supabase = createClient();
            console.log('🔌 Supabase client created for booking rejection');

            const {
                data: { user },
            } = await supabase.auth.getUser();

            console.log('👤 User authentication check for rejection:', {
                hasUser: !!user,
                userId: user?.id,
                userEmail: user?.email,
            });

            if (!user) {
                console.log('❌ No authenticated user found for rejection');
                setError('You must be logged in to reject bookings.');
                return;
            }

            console.log('📡 Updating booking status to CANCELLED...');
            const { data, error } = await supabase
                .from('bookings')
                .update({
                    status: 'CANCELLED',
                    cancellation_reason: reason,
                    cancelled_at: new Date().toISOString(),
                    cancelled_by: user.id,
                })
                .eq('id', bookingId)
                .eq('host_id', user.id)
                .select();

            console.log('📊 Booking rejection result:', {
                hasData: !!data,
                hasError: !!error,
                errorCode: error?.code,
                errorMessage: error?.message,
                updatedRows: data?.length || 0,
                updatedBooking: data?.[0],
            });

            if (error) {
                console.error('❌ Error rejecting booking:', {
                    error: error,
                    errorCode: error.code,
                    errorMessage: error.message,
                    errorDetails: error.details,
                });
                setError('Failed to reject booking. Please try again.');
                return;
            }

            if (!data || data.length === 0) {
                console.log('❌ No booking found or updated for rejection');
                setError('Booking not found or you do not have permission to reject it.');
                return;
            }

            console.log('✅ Booking rejected successfully:', {
                bookingId: bookingId,
                reason: reason,
                cancelledAt: data[0].cancelled_at,
                cancelledBy: data[0].cancelled_by,
            });

            // Refresh bookings list
            console.log('🔄 Refreshing bookings list after rejection...');
            await fetchBookingsData();
        } catch (error: any) {
            console.error('❌ Error in rejection process:', {
                error: error,
                errorMessage: error?.message,
                errorStack: error?.stack,
            });
            setError('An unexpected error occurred while rejecting the booking.');
        } finally {
            setActionLoading(null);
            console.log('✅ Rejection process completed');
        }
    };

    const openRejectionModal = (booking: ExtendedBooking) => {
        console.log('📋 openRejectionModal: Opening rejection modal for booking:', {
            bookingId: booking.id,
            bookingStatus: booking.status,
            renterName: booking.renter?.full_name,
        });
        setSelectedBooking(booking);
        setShowRejectionModal(true);
    };

    const openDetailsModal = (booking: ExtendedBooking) => {
        console.log('📋 openDetailsModal: Opening details modal for booking:', {
            bookingId: booking.id,
            bookingStatus: booking.status,
            renterName: booking.renter?.full_name,
            carMake: booking.car?.make,
            carModel: booking.car?.model,
        });
        setSelectedBooking(booking);
        setShowDetailsModal(true);
    };

    const openEmergencyCancelModal = (booking: ExtendedBooking) => {
        console.log(
            '🚨 openEmergencyCancelModal: Opening emergency cancellation modal for booking:',
            {
                bookingId: booking.id,
                bookingStatus: booking.status,
                renterName: booking.renter?.full_name,
                carMake: booking.car?.make,
                carModel: booking.car?.model,
                startDate: booking.start_date,
                endDate: booking.end_date,
            },
        );
        setSelectedBooking(booking);
        setShowEmergencyCancelModal(true);
    };

    const handleEmergencyCancel = async (reason: EmergencyCancellationReason, details: string) => {
        console.log('🚨 handleEmergencyCancel: Starting emergency cancellation process');
        console.log('📋 Emergency cancellation inputs:', {
            bookingId: selectedBooking?.id,
            reason: reason,
            details: details,
            selectedBooking: selectedBooking,
        });

        if (!selectedBooking) {
            console.log('❌ Emergency cancellation failed: No selected booking');
            return;
        }

        setActionLoading(selectedBooking.id);
        console.log(
            '⏳ Setting action loading state for emergency cancellation:',
            selectedBooking.id,
        );

        try {
            const supabase = createClient();
            console.log('🔌 Supabase client created for emergency cancellation');

            const {
                data: { user },
            } = await supabase.auth.getUser();

            console.log('👤 User authentication check for emergency cancellation:', {
                hasUser: !!user,
                userId: user?.id,
                userEmail: user?.email,
            });

            if (!user) {
                console.log('❌ No authenticated user found for emergency cancellation');
                alert('Please log in to cancel bookings');
                return;
            }

            // Calculate cancellation fee
            console.log('💰 Calculating emergency cancellation fee...');
            const cancellationResult = calculateEmergencyCancellationFee(selectedBooking, reason);

            console.log('💰 Cancellation fee calculation result:', {
                fee: cancellationResult.fee,
                refund: cancellationResult.refund,
                reason: reason,
                details: details,
            });

            // Update booking with emergency cancellation
            console.log('📡 Updating booking with emergency cancellation...');
            const { data, error } = await supabase
                .from('bookings')
                .update({
                    status: 'CANCELLED',
                    cancelled_at: new Date().toISOString(),
                    cancellation_reason: `[HOST_EMERGENCY-${reason.toUpperCase()}] ${EMERGENCY_REASON_LABELS[reason]}: ${details} (Fee: $${cancellationResult.fee.toFixed(2)}, Refund: $${cancellationResult.refund.toFixed(2)})`,
                    cancelled_by_type: 'host',
                    updated_at: new Date().toISOString(),
                    special_instructions: `EMERGENCY CANCELLATION: ${EMERGENCY_REASON_LABELS[reason]} - ${details}`,
                })
                .eq('id', selectedBooking.id)
                .eq('host_id', user.id)
                .select();

            console.log('📊 Emergency cancellation result:', {
                hasData: !!data,
                hasError: !!error,
                errorCode: error?.code,
                errorMessage: error?.message,
                updatedRows: data?.length || 0,
                updatedBooking: data?.[0],
            });

            if (error) {
                console.error('❌ Error cancelling booking:', {
                    error: error,
                    errorCode: error.code,
                    errorMessage: error.message,
                    errorDetails: error.details,
                });
                alert('Failed to cancel booking. Please try again.');
                return;
            }

            if (!data || data.length === 0) {
                console.log('❌ No booking found or updated for emergency cancellation');
                alert('Booking not found or you do not have permission to cancel it.');
                return;
            }

            console.log('✅ Emergency cancellation processed successfully:', {
                bookingId: selectedBooking.id,
                reason: reason,
                details: details,
                fee: cancellationResult.fee,
                refund: cancellationResult.refund,
                cancelledAt: data[0].cancelled_at,
            });

            alert(
                `✅ Emergency cancellation processed successfully!\nRefund amount: ${formatCurrency(cancellationResult.refund)}`,
            );

            // Close modals
            console.log('🔄 Closing modals after emergency cancellation...');
            setShowEmergencyCancelModal(false);
            if (showDetailsModal) {
                setShowDetailsModal(false);
            }
            setSelectedBooking(null);

            // Refresh data
            console.log('🔄 Refreshing bookings data after emergency cancellation...');
            fetchBookingsData();
        } catch (error: any) {
            console.error('❌ Error processing emergency cancellation:', {
                error: error,
                errorMessage: error?.message,
                errorStack: error?.stack,
            });
            alert('An unexpected error occurred.');
        } finally {
            setActionLoading(null);
            console.log('✅ Emergency cancellation process completed');
        }
    };

    const getStatusColor = (status: BookingStatus) => {
        return STATUS_CONFIG[status]?.color || 'bg-gray-100 text-gray-800';
    };

    const getDaysUntilStart = (startDate: string) => {
        return Math.ceil(
            (new Date(startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        );
    };

    const canManageBooking = (booking: ExtendedBooking) => {
        const daysUntilStart = getDaysUntilStart(booking.start_date);
        return (
            (booking.status === 'PENDING' || booking.status === 'AUTO_APPROVED') &&
            daysUntilStart >= 1
        );
    };

    const canEmergencyCancel = (booking: ExtendedBooking) => {
        // Emergency cancel is available for confirmed/in-progress bookings
        return ['CONFIRMED', 'AUTO_APPROVED', 'IN_PROGRESS'].includes(booking.status);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Checking permissions...</p>
                </div>
            </div>
        );
    }

    if (!isHost) return null;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading bookings...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <Button onClick={fetchBookingsData} variant="outline">
                        Retry
                    </Button>
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
                        <div className="flex items-center">
                            <Link href="/home/host" className="text-2xl font-bold text-black">
                                REBIL
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/home/host"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/host/add-vehicle"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Add Vehicle
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

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-black mb-2">Booking Management</h1>
                    <p className="text-gray-600">
                        Manage your vehicle bookings, approve requests, and track reservations
                    </p>
                </div>

                {/* Filters and Search */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-gray-900">Filters & Search</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Search */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Search
                                </label>
                                <Input
                                    placeholder="Booking ID, renter name, vehicle..."
                                    value={filters.searchTerm}
                                    onChange={(e) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            searchTerm: e.target.value,
                                        }))
                                    }
                                    className="bg-white text-gray-900 border-gray-300"
                                />
                            </div>

                            {/* Car Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Vehicle
                                </label>
                                <select
                                    value={filters.carId}
                                    onChange={(e) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            carId: e.target.value,
                                        }))
                                    }
                                    className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="">All Vehicles</option>
                                    {userCars.map((car) => (
                                        <option key={car.id} value={car.id}>
                                            {car.make} {car.model} ({car.year})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Range */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date
                                </label>
                                <Input
                                    type="date"
                                    value={filters.dateRange.start}
                                    onChange={(e) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            dateRange: {
                                                ...prev.dateRange,
                                                start: e.target.value,
                                            },
                                        }))
                                    }
                                    className="bg-white text-gray-900 border-gray-300"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date
                                </label>
                                <Input
                                    type="date"
                                    value={filters.dateRange.end}
                                    onChange={(e) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            dateRange: {
                                                ...prev.dateRange,
                                                end: e.target.value,
                                            },
                                        }))
                                    }
                                    className="bg-white text-gray-900 border-gray-300"
                                />
                            </div>
                        </div>

                        {/* Clear Filters */}
                        <div className="mt-4 flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                                Showing {filteredBookings.length} of {bookings.length} bookings
                            </div>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setFilters({
                                        status: 'ALL',
                                        dateRange: { start: '', end: '' },
                                        carId: '',
                                        searchTerm: '',
                                    })
                                }
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Status Tabs */}
                <Tabs
                    value={filters.status}
                    onValueChange={(value) =>
                        setFilters((prev) => ({
                            ...prev,
                            status: value as BookingStatus | 'ALL',
                        }))
                    }
                    className="mb-6"
                >
                    <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 bg-gray-100 p-1 rounded-lg">
                        {Object.entries(statusCounts).map(([status, config]) => (
                            <TabsTrigger
                                key={status}
                                value={status}
                                className="text-xs font-medium text-gray-800 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm hover:text-black transition-colors duration-200"
                            >
                                {config.label}
                                <span className="ml-1 text-xs bg-gray-300 data-[state=active]:bg-gray-200 rounded-full px-1.5 py-0.5 font-semibold">
                                    {config.count}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value={filters.status} className="mt-6">
                        {/* Bookings List */}
                        {filteredBookings.length === 0 ? (
                            <Card>
                                <CardContent className="text-center py-12">
                                    <div className="text-6xl mb-4">📅</div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        No bookings found
                                    </h3>
                                    <p className="text-gray-600 mb-6">
                                        {filters.status === 'ALL'
                                            ? "You don't have any bookings yet."
                                            : `No ${STATUS_CONFIG[filters.status]?.label.toLowerCase()} bookings found.`}
                                    </p>
                                    <Button
                                        onClick={() => router.push('/host/add-vehicle')}
                                        variant="outline"
                                    >
                                        Add a Vehicle
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                <AnimatePresence>
                                    {filteredBookings.map((booking) => (
                                        <motion.div
                                            key={booking.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <BookingCard
                                                booking={booking}
                                                onApprove={handleApproveBooking}
                                                onReject={openRejectionModal}
                                                onViewDetails={openDetailsModal}
                                                onEmergencyCancel={openEmergencyCancelModal}
                                                actionLoading={actionLoading}
                                                canManage={canManageBooking(booking)}
                                                canEmergencyCancel={canEmergencyCancel(booking)}
                                                getStatusColor={getStatusColor}
                                                getDaysUntilStart={getDaysUntilStart}
                                                formatCurrency={formatCurrency}
                                                formatDate={formatDate}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Booking Details Modal */}
            {showDetailsModal && selectedBooking && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    onClose={() => setShowDetailsModal(false)}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getStatusColor={getStatusColor}
                    onApprove={handleApproveBooking}
                    onReject={openRejectionModal}
                    onEmergencyCancel={openEmergencyCancelModal}
                    actionLoading={actionLoading}
                    canManage={canManageBooking(selectedBooking)}
                    canEmergencyCancel={canEmergencyCancel(selectedBooking)}
                    getDaysUntilStart={getDaysUntilStart}
                />
            )}

            {/* Rejection Modal */}
            {showRejectionModal && selectedBooking && (
                <RejectionModal
                    booking={selectedBooking}
                    onClose={() => setShowRejectionModal(false)}
                    onConfirm={(reason) => handleRejectBooking(selectedBooking.id, reason)}
                    loading={actionLoading === selectedBooking.id}
                />
            )}

            {/* Emergency Cancel Modal */}
            {showEmergencyCancelModal && selectedBooking && (
                <EmergencyCancelModal
                    booking={selectedBooking}
                    onClose={() => setShowEmergencyCancelModal(false)}
                    onConfirm={handleEmergencyCancel}
                    loading={actionLoading === selectedBooking.id}
                />
            )}
        </div>
    );
}

// Booking Card Component
interface BookingCardProps {
    booking: ExtendedBooking;
    onApprove: (id: string) => void;
    onReject: (booking: ExtendedBooking) => void;
    onViewDetails: (booking: ExtendedBooking) => void;
    onEmergencyCancel: (booking: ExtendedBooking) => void;
    actionLoading: string | null;
    canManage: boolean;
    canEmergencyCancel: boolean;
    getStatusColor: (status: BookingStatus) => string;
    getDaysUntilStart: (date: string) => number;
    formatCurrency: (amount: number) => string;
    formatDate: (date: string) => string;
}

function BookingCard({
    booking,
    onApprove,
    onReject,
    onViewDetails,
    onEmergencyCancel,
    actionLoading,
    canManage,
    canEmergencyCancel,
    getStatusColor,
    getDaysUntilStart,
    formatCurrency,
    formatDate,
}: BookingCardProps) {
    const daysUntilStart = getDaysUntilStart(booking.start_date);
    const primaryImage = booking.car?.images?.find((img) => img.is_primary)?.image_url;

    return (
        <Card
            className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.02]"
            onClick={() => onViewDetails(booking)}
        >
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">
                            Booking #{booking.id.substring(0, 8)}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                            <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}
                            >
                                {booking.status.replace('_', ' ')}
                            </span>
                            {daysUntilStart > 0 && (
                                <span className="text-xs text-gray-600">
                                    {daysUntilStart} days until start
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Click for details</span>
                        <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* Vehicle Info */}
                <div className="flex items-center gap-3 mb-4">
                    {primaryImage && (
                        <img
                            src={primaryImage}
                            alt="Vehicle"
                            className="w-16 h-12 object-cover rounded-lg"
                        />
                    )}
                    <div>
                        <p className="font-medium text-gray-900">
                            {booking.car?.make} {booking.car?.model} ({booking.car?.year})
                        </p>
                        <p className="text-sm text-gray-600">
                            {booking.car?.color} • {booking.car?.license_plate || 'No plate'}
                        </p>
                    </div>
                </div>

                {/* Renter Info */}
                <div className="mb-4">
                    <p className="font-medium text-gray-900">
                        {booking.renter?.full_name || 'Guest User'}
                    </p>
                    <p className="text-sm text-gray-600">{booking.renter?.email}</p>
                    {booking.renter?.phone && (
                        <p className="text-sm text-gray-600">{booking.renter.phone}</p>
                    )}
                </div>

                {/* Booking Details */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                        <p className="text-gray-600">Start Date</p>
                        <p className="font-medium text-gray-900">
                            {formatDate(booking.start_date)}
                        </p>
                    </div>
                    <div>
                        <p className="text-gray-600">End Date</p>
                        <p className="font-medium text-gray-900">{formatDate(booking.end_date)}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Duration</p>
                        <p className="font-medium text-gray-900">{booking.total_days} days</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Total Amount</p>
                        <p className="font-medium text-gray-900">
                            {formatCurrency(booking.total_amount)}
                        </p>
                    </div>
                </div>

                {/* Special Instructions */}
                {booking.special_instructions && (
                    <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-1">Special Instructions:</p>
                        <p className="text-sm bg-gray-50 p-2 rounded">
                            {booking.special_instructions}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                {(canManage || canEmergencyCancel) && (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        {/* Emergency Cancel Button - For confirmed/in-progress bookings */}
                        {canEmergencyCancel && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEmergencyCancel(booking);
                                }}
                                disabled={actionLoading === booking.id}
                                className="w-full bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400"
                            >
                                <div className="flex items-center gap-1">
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    {actionLoading === booking.id
                                        ? 'Processing...'
                                        : 'Emergency Cancel'}
                                </div>
                            </Button>
                        )}

                        {/* Regular Management Buttons - For pending bookings */}
                        {canManage && (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReject(booking);
                                    }}
                                    disabled={actionLoading === booking.id}
                                    className="flex-1"
                                >
                                    {actionLoading === booking.id ? 'Processing...' : 'Reject'}
                                </Button>
                                {(booking.status === 'PENDING' ||
                                    booking.status === 'AUTO_APPROVED') && (
                                    <Button
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onApprove(booking.id);
                                        }}
                                        disabled={actionLoading === booking.id}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                                    >
                                        {actionLoading === booking.id
                                            ? 'Processing...'
                                            : booking.status === 'AUTO_APPROVED'
                                              ? 'Confirm'
                                              : 'Approve'}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!canManage && ['PENDING', 'AUTO_APPROVED'].includes(booking.status) && (
                    <div className="text-xs text-gray-500 mt-2 p-2 bg-yellow-50 rounded">
                        ⏰ Deadline passed (must manage 1+ days before start)
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Helper function to parse location information
const parseLocationInfo = (location: any): string => {
    if (!location) return 'Not specified';
    if (typeof location === 'string') return location;
    if (typeof location === 'object') {
        // Handle JSON object with address field
        if (location.address) return location.address;
        // Handle other object structures
        if (location.street || location.city || location.state) {
            const parts = [
                location.street,
                location.city,
                location.state,
                location.zipCode || location.zip,
                location.country,
            ].filter(Boolean);
            return parts.join(', ');
        }
        // Fallback to formatted JSON
        return Object.values(location).filter(Boolean).join(', ');
    }
    return 'Not specified';
};

// Booking Details Modal Component
interface BookingDetailsModalProps {
    booking: ExtendedBooking;
    onClose: () => void;
    formatCurrency: (amount: number) => string;
    formatDate: (date: string) => string;
    getStatusColor: (status: BookingStatus) => string;
    onApprove?: (id: string) => void;
    onReject?: (booking: ExtendedBooking) => void;
    onEmergencyCancel?: (booking: ExtendedBooking) => void;
    actionLoading?: string | null;
    canManage?: boolean;
    canEmergencyCancel?: boolean;
    getDaysUntilStart?: (date: string) => number;
}

function BookingDetailsModal({
    booking,
    onClose,
    formatCurrency,
    formatDate,
    getStatusColor,
    onApprove,
    onReject,
    onEmergencyCancel,
    actionLoading,
    canManage,
    canEmergencyCancel,
    getDaysUntilStart,
}: BookingDetailsModalProps) {
    const primaryImage = booking.car?.images?.find((img) => img.is_primary)?.image_url;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
                            <p className="text-sm text-gray-800 mt-1 font-medium">
                                Booking #{booking.id.substring(0, 8)} •{' '}
                                {formatDate(booking.created_at)}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                            aria-label="Close modal"
                        >
                            <svg
                                className="w-6 h-6 text-gray-500"
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

                <div className="p-6 space-y-8">
                    {/* Status and Key Info Banner */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <span
                                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}
                                >
                                    {booking.status.replace('_', ' ')}
                                </span>
                                {getDaysUntilStart && getDaysUntilStart(booking.start_date) > 0 && (
                                    <div className="flex items-center gap-1 text-sm text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        {getDaysUntilStart(booking.start_date)} days until start
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(booking.total_amount)}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {booking.total_days} days total
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Vehicle Information with Image */}
                    <div className="bg-gray-50 rounded-lg p-5">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg
                                className="w-5 h-5 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            Vehicle Details
                        </h3>
                        <div className="flex gap-4">
                            {primaryImage && (
                                <div className="flex-shrink-0">
                                    <img
                                        src={primaryImage}
                                        alt="Vehicle"
                                        className="w-24 h-18 object-cover rounded-lg border border-gray-200"
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Vehicle</p>
                                    <p className="text-gray-900 font-semibold">
                                        {booking.car?.make} {booking.car?.model} (
                                        {booking.car?.year})
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Color</p>
                                    <p className="text-gray-900">
                                        {booking.car?.color || 'Not specified'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">
                                        License Plate
                                    </p>
                                    <p className="text-gray-900 font-mono">
                                        {booking.car?.license_plate || 'Not specified'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Renter Information */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg
                                className="w-5 h-5 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                            </svg>
                            Renter Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-gray-200 rounded-lg p-4">
                            <div>
                                <p className="text-sm font-medium text-gray-800">Full Name</p>
                                <p className="text-gray-900 font-semibold">
                                    {booking.renter?.full_name || 'Guest User'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Email Address</p>
                                <p className="text-gray-900">{booking.renter?.email}</p>
                            </div>
                            {booking.renter?.phone && (
                                <div>
                                    <p className="text-sm font-medium text-gray-800">
                                        Phone Number
                                    </p>
                                    <p className="text-gray-900">{booking.renter.phone}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rental Period */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg
                                className="w-5 h-5 text-purple-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            Rental Period
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-gray-200 rounded-lg p-4">
                            <div>
                                <p className="text-sm font-medium text-gray-800">Start Date</p>
                                <p className="text-gray-900 font-semibold">
                                    {formatDate(booking.start_date)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">End Date</p>
                                <p className="text-gray-900 font-semibold">
                                    {formatDate(booking.end_date)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Duration</p>
                                <p className="text-gray-900 font-semibold">
                                    {booking.total_days} days
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pricing Breakdown */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg
                                className="w-5 h-5 text-yellow-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                                />
                            </svg>
                            Pricing Breakdown
                        </h3>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="space-y-3">
                                <div className="flex justify-between text-gray-700">
                                    <span>Daily Rate × {booking.total_days} days</span>
                                    <span className="font-semibold">
                                        {formatCurrency(booking.subtotal)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-gray-700">
                                    <span>Insurance Fee</span>
                                    <span className="font-semibold">
                                        {formatCurrency(booking.insurance_fee)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-gray-700">
                                    <span>Service Fee</span>
                                    <span className="font-semibold">
                                        {formatCurrency(booking.service_fee)}
                                    </span>
                                </div>
                                {booking.delivery_fee > 0 && (
                                    <div className="flex justify-between text-gray-700">
                                        <span>Delivery Fee</span>
                                        <span className="font-semibold">
                                            {formatCurrency(booking.delivery_fee)}
                                        </span>
                                    </div>
                                )}
                                <div className="border-t border-gray-200 pt-3 flex justify-between text-lg font-bold text-gray-900">
                                    <span>Total Amount</span>
                                    <span>{formatCurrency(booking.total_amount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location Information - Improved */}
                    {(booking.pickup_location || booking.dropoff_location) && (
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <svg
                                    className="w-5 h-5 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                Location Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {booking.pickup_location && (
                                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                                        <p className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                                            <svg
                                                className="w-4 h-4 text-green-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                                                />
                                            </svg>
                                            Pickup Location
                                        </p>
                                        <p className="text-gray-900 font-medium">
                                            {parseLocationInfo(booking.pickup_location)}
                                        </p>
                                    </div>
                                )}
                                {booking.dropoff_location && (
                                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                                        <p className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                                            <svg
                                                className="w-4 h-4 text-red-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                                />
                                            </svg>
                                            Dropoff Location
                                        </p>
                                        <p className="text-gray-900 font-medium">
                                            {parseLocationInfo(booking.dropoff_location)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Special Instructions */}
                    {booking.special_instructions && (
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <svg
                                    className="w-5 h-5 text-orange-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                                    />
                                </svg>
                                Special Instructions
                            </h3>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-gray-800 leading-relaxed">
                                    {booking.special_instructions}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Booking Timeline */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg
                                className="w-5 h-5 text-indigo-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            Booking Timeline
                        </h3>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Created</p>
                                    <p className="text-gray-900">
                                        {formatDate(booking.created_at)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">
                                        Last Updated
                                    </p>
                                    <p className="text-gray-900">
                                        {formatDate(booking.updated_at)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Enhanced */}
                    {((canManage && onApprove && onReject) ||
                        (canEmergencyCancel && onEmergencyCancel)) &&
                        getDaysUntilStart && (
                            <div className="space-y-4">
                                {/* Emergency Cancel Button - Priority for confirmed bookings */}
                                {canEmergencyCancel && onEmergencyCancel && (
                                    <div className="bg-orange-50 rounded-lg p-6 border-t-4 border-orange-500">
                                        <h3 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
                                            <svg
                                                className="w-5 h-5 text-orange-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            Emergency Cancellation Available
                                        </h3>
                                        <p className="text-sm text-orange-800 mb-4">
                                            For urgent situations that require immediate booking
                                            cancellation with special fee considerations.
                                        </p>
                                        <button
                                            onClick={() => onEmergencyCancel(booking)}
                                            disabled={actionLoading === booking.id}
                                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                                        >
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            {actionLoading === booking.id
                                                ? 'Processing...'
                                                : 'Emergency Cancel Booking'}
                                        </button>
                                    </div>
                                )}

                                {/* Regular Management Actions */}
                                {canManage && onApprove && onReject && (
                                    <div className="bg-gray-50 rounded-lg p-6 border-t-4 border-blue-500">
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <svg
                                                className="w-5 h-5 text-blue-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                                />
                                            </svg>
                                            Actions Required
                                        </h3>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => onReject(booking)}
                                                disabled={actionLoading === booking.id}
                                                className="flex-1 bg-white hover:bg-red-50 text-red-700 border-2 border-red-200 hover:border-red-300 font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <svg
                                                    className="w-5 h-5"
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
                                                {actionLoading === booking.id
                                                    ? 'Processing...'
                                                    : 'Reject Booking'}
                                            </button>
                                            {(booking.status === 'PENDING' ||
                                                booking.status === 'AUTO_APPROVED') && (
                                                <button
                                                    onClick={() => onApprove(booking.id)}
                                                    disabled={actionLoading === booking.id}
                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                                                >
                                                    <svg
                                                        className="w-5 h-5"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                    {actionLoading === booking.id
                                                        ? 'Processing...'
                                                        : booking.status === 'AUTO_APPROVED'
                                                          ? 'Confirm Booking'
                                                          : 'Approve Booking'}
                                                </button>
                                            )}
                                        </div>
                                        {getDaysUntilStart(booking.start_date) < 1 && (
                                            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center gap-2">
                                                <svg
                                                    className="w-5 h-5 text-yellow-600 flex-shrink-0"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                    />
                                                </svg>
                                                <p className="text-sm text-yellow-800">
                                                    <strong>Management deadline passed:</strong>{' '}
                                                    Bookings must be managed at least 1 day before
                                                    the start date.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                </div>
            </motion.div>
        </div>
    );
}

// Rejection Modal Component
interface RejectionModalProps {
    booking: ExtendedBooking;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    loading: boolean;
}

function RejectionModal({ booking, onClose, onConfirm, loading }: RejectionModalProps) {
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (reason.trim()) {
            onConfirm(reason.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-lg max-w-md w-full"
            >
                <form onSubmit={handleSubmit} className="p-6">
                    <h2 className="text-xl font-bold mb-4">Reject Booking</h2>

                    <div className="mb-4">
                        <p className="text-gray-600 mb-2">
                            You are about to reject booking #{booking.id.substring(0, 8)} from{' '}
                            {booking.renter?.full_name || 'Guest User'}.
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                            Please provide a reason for the rejection:
                        </p>

                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            rows={4}
                            required
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={loading || !reason.trim()}
                            className="flex-1"
                        >
                            {loading ? 'Processing...' : 'Reject Booking'}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
