'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import BulkActions from '@/components/host/BulkActions';
import ManualBookingModal from '@/components/host/ManualBookingModal';
import UnifiedVehicleCard from '@/components/host/UnifiedVehicleCard';
import VehicleSearch, { VehicleFilters } from '@/components/host/VehicleSearch';
import { MessageNotification } from '@/components/messages/MessageNotification';
import { ReviewModal } from '@/components/reviews/ReviewModal';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useReviews } from '@/hooks/useReviews';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency } from '@/lib/utils';
import { Tables } from '@/types/base/database.types';
import type { CreateReviewRequest } from '@/types/reviews.types';

type HostStats = Tables<'host_stats'>;
type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

type CarWithImages = Car & {
    car_images: CarImage[];
};

interface VehicleStats {
    total: number;
    active: number;
    inactive: number;
    pending: number;
    draft: number;
}

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'active' | 'inactive' | 'pending' | 'draft';

interface RecentBooking {
    id: string;
    created_at: string;
    start_date: string;
    end_date: string;
    status: string;
    total_amount: number;
    renter_name?: string | null;
    renter_email?: string | null;
    vehicle_name?: string;
    special_instructions?: string | null;
    renter_id?: string;
    car_id?: string;
}

export default function HostDashboard() {
    const router = useRouter();
    const { t } = useTranslation();
    const [stats, setStats] = useState<
        (HostStats & { online_bookings?: number; offline_bookings?: number }) | null
    >(null);
    const [cars, setCars] = useState<CarWithImages[]>([]);
    const [vehicleStats, setVehicleStats] = useState<VehicleStats>({
        total: 0,
        active: 0,
        inactive: 0,
        pending: 0,
        draft: 0,
    });
    const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // For triggering vehicle calendar refresh

    // Review-related states
    const [reviewModal, setReviewModal] = useState(false);
    const [selectedBookingForReview, setSelectedBookingForReview] = useState<RecentBooking | null>(
        null,
    );
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [bookingReviewStatus, setBookingReviewStatus] = useState<Record<string, boolean>>({});

    // Vehicle management specific states
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [filters, setFilters] = useState<VehicleFilters>({
        searchQuery: '',
        vehicleType: '',
        status: '',
        priceRange: [0, 2000000],
        fuelType: '',
        transmission: '',
        seatsRange: [2, 8],
        yearRange: [2010, new Date().getFullYear()],
    });
    const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
    const [showManualBookingModal, setShowManualBookingModal] = useState(false);
    const [selectedVehicleForBooking, setSelectedVehicleForBooking] = useState<string | null>(null);

    // Initialize useReviews hook
    const { createReview, checkCanReview, loading: reviewLoading } = useReviews();

    // Message-related states
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    // Helper function to check if booking is manual
    const isManualBooking = (booking: RecentBooking): boolean => {
        try {
            if (!booking.special_instructions) return false;
            const parsed = JSON.parse(booking.special_instructions);
            return parsed.created_manually === true || parsed.is_offline_booking === true;
        } catch {
            return false;
        }
    };

    // Function to check review status for bookings
    const checkReviewStatusForBookings = useCallback(
        async (bookings: RecentBooking[], userId: string) => {
            const reviewStatusMap: Record<string, boolean> = {};

            for (const booking of bookings) {
                if (
                    booking.status === 'COMPLETED' &&
                    booking.renter_id &&
                    !isManualBooking(booking)
                ) {
                    try {
                        const reviewResult = await checkCanReview({
                            booking_id: booking.id,
                            reviewer_id: userId,
                            booking_status: booking.status,
                        });
                        // If canReview is false and reason mentions already reviewed, then review exists
                        reviewStatusMap[booking.id] =
                            !reviewResult.canReview &&
                            reviewResult.reason.includes('already reviewed');
                    } catch (error) {
                        console.error(
                            `Error checking review status for booking ${booking.id}:`,
                            error,
                        );
                        reviewStatusMap[booking.id] = false;
                    }
                } else {
                    reviewStatusMap[booking.id] = false;
                }
            }

            setBookingReviewStatus(reviewStatusMap);
        },
        [checkCanReview],
    );

    // Function to fetch unread message count
    const fetchUnreadMessageCount = useCallback(async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) return;

            const response = await fetch('/api/messages/unread-count');
            if (response.ok) {
                const data = await response.json();
                setUnreadMessageCount(data.count);
            }
        } catch (error) {
            console.error('Error fetching unread message count:', error);
        }
    }, []);

    const fetchHostData = useCallback(async () => {
        try {
            const supabase = createClient();

            // Get current user information
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                setError('Unable to load user information.');
                return;
            }

            console.log('Fetching host data for user:', user.id);
            setCurrentUserId(user.id);

            // Check if host_stats data exists and is recent (less than 1 hour old)
            const { data: hostStats, error: statsError } = await supabase
                .from('host_stats')
                .select('*')
                .eq('host_id', user.id)
                .maybeSingle();

            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const isStatsRecent =
                hostStats && new Date(hostStats.calculated_at || hostStats.updated_at) > oneHourAgo;

            if (isStatsRecent && !statsError) {
                console.log('Using recent host_stats data:', hostStats.calculated_at);
                setStats(hostStats);
            } else {
                console.log('Host stats stale or missing, calculating real-time statistics...');

                // Calculate real-time statistics
                const results = await Promise.allSettled([
                    // Total cars
                    supabase
                        .from('cars')
                        .select('*', { count: 'exact', head: true })
                        .eq('host_id', user.id),

                    // Active cars
                    supabase
                        .from('cars')
                        .select('*', { count: 'exact', head: true })
                        .eq('host_id', user.id)
                        .eq('status', 'ACTIVE'),

                    // Total bookings
                    supabase
                        .from('bookings')
                        .select('*', { count: 'exact', head: true })
                        .eq('host_id', user.id),

                    // Completed bookings
                    supabase
                        .from('bookings')
                        .select('*', { count: 'exact', head: true })
                        .eq('host_id', user.id)
                        .eq('status', 'COMPLETED'),

                    // Total earnings calculation using joins
                    supabase
                        .from('payments')
                        .select(
                            `
                            amount,
                            booking_id,
                            bookings!inner(host_id)
                        `,
                        )
                        .eq('status', 'COMPLETED')
                        .eq('bookings.host_id', user.id),

                    // Monthly earnings calculation using joins
                    supabase
                        .from('payments')
                        .select(
                            `
                            amount,
                            booking_id,
                            bookings!inner(host_id)
                        `,
                        )
                        .eq('status', 'COMPLETED')
                        .eq('bookings.host_id', user.id)
                        .gte(
                            'created_at',
                            new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
                        ),

                    // Average rating
                    supabase.from('reviews').select('rating').eq('reviewed_id', user.id),

                    // Online bookings count
                    supabase
                        .from('bookings')
                        .select('*', { count: 'exact', head: true })
                        .eq('host_id', user.id)
                        .or('booking_type.is.null,booking_type.eq.ONLINE'),

                    // Offline bookings count - get all bookings with special_instructions and filter manually
                    supabase
                        .from('bookings')
                        .select('special_instructions')
                        .eq('host_id', user.id)
                        .not('special_instructions', 'is', null),
                ]);

                const [
                    totalCarsResult,
                    activeCarsResult,
                    totalBookingsResult,
                    completedBookingsResult,
                    totalEarningsResult,
                    monthlyEarningsResult,
                    reviewsResult,
                    onlineBookingsResult,
                    offlineBookingsDataResult,
                ] = results;

                // Extract counts and calculations with fallback
                const totalCars =
                    totalCarsResult.status === 'fulfilled' ? totalCarsResult.value.count || 0 : 0;
                const activeCars =
                    activeCarsResult.status === 'fulfilled' ? activeCarsResult.value.count || 0 : 0;
                const totalBookings =
                    totalBookingsResult.status === 'fulfilled'
                        ? totalBookingsResult.value.count || 0
                        : 0;
                const completedBookings =
                    completedBookingsResult.status === 'fulfilled'
                        ? completedBookingsResult.value.count || 0
                        : 0;

                // Calculate online bookings count
                const onlineBookings =
                    onlineBookingsResult.status === 'fulfilled'
                        ? onlineBookingsResult.value.count || 0
                        : 0;

                // Calculate offline bookings count by filtering special_instructions
                const offlineBookingsData =
                    offlineBookingsDataResult.status === 'fulfilled'
                        ? offlineBookingsDataResult.value.data || []
                        : [];

                const offlineBookings = offlineBookingsData.filter((booking) => {
                    try {
                        const instructions = JSON.parse(booking.special_instructions || '{}');
                        return (
                            instructions.created_manually === true ||
                            instructions.is_offline_booking === true
                        );
                    } catch {
                        return false;
                    }
                }).length;

                // Calculate earnings
                const totalEarningsData =
                    totalEarningsResult.status === 'fulfilled'
                        ? totalEarningsResult.value.data || []
                        : [];
                const totalEarnings = totalEarningsData.reduce(
                    (sum: number, payment: any) => sum + (payment.amount || 0),
                    0,
                );

                const monthlyEarningsData =
                    monthlyEarningsResult.status === 'fulfilled'
                        ? monthlyEarningsResult.value.data || []
                        : [];
                const monthlyEarnings = monthlyEarningsData.reduce(
                    (sum: number, payment: any) => sum + (payment.amount || 0),
                    0,
                );

                // Calculate average rating
                const reviewsData =
                    reviewsResult.status === 'fulfilled' ? reviewsResult.value.data || [] : [];
                const averageRating =
                    reviewsData.length > 0
                        ? reviewsData.reduce(
                              (sum: number, review: any) => sum + (review.rating || 0),
                              0,
                          ) / reviewsData.length
                        : 0;

                console.log('Real-time calculations:', {
                    totalCars,
                    activeCars,
                    totalBookings,
                    completedBookings,
                    onlineBookings,
                    offlineBookings,
                    totalEarnings,
                    monthlyEarnings,
                    averageRating,
                    reviewCount: reviewsData.length,
                });

                const calculatedStats: HostStats & {
                    online_bookings: number;
                    offline_bookings: number;
                } = {
                    id: `calc_${user.id}`,
                    host_id: user.id,
                    total_cars: totalCars,
                    active_cars: activeCars,
                    total_bookings: totalBookings,
                    completed_bookings: completedBookings,
                    online_bookings: onlineBookings,
                    offline_bookings: offlineBookings,
                    total_earnings: totalEarnings,
                    monthly_earnings: monthlyEarnings,
                    average_rating: averageRating,
                    total_reviews: reviewsData.length,
                    calculated_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                setStats(calculatedStats);
            }

            // Query host's vehicle list with images
            const { data: hostCars, error: carsError } = await supabase
                .from('cars')
                .select(
                    `
                    *,
                    car_images(*)
                `,
                )
                .eq('host_id', user.id)
                .order('created_at', { ascending: false });

            if (carsError) {
                console.error('Failed to fetch cars:', carsError);
            } else {
                const allVehicles = hostCars || [];
                setCars(allVehicles);

                // Calculate vehicle stats
                const calculatedVehicleStats: VehicleStats = {
                    total: allVehicles.length,
                    active: allVehicles.filter((v) => v.status === 'ACTIVE').length,
                    inactive: allVehicles.filter((v) => v.status === 'INACTIVE').length,
                    pending: allVehicles.filter((v) => v.status === 'PENDING_APPROVAL').length,
                    draft: allVehicles.filter((v) => v.status === 'DRAFT').length,
                };
                setVehicleStats(calculatedVehicleStats);
            }

            // Query recent bookings with enhanced data
            const { data: bookings, error: bookingsError } = await supabase
                .from('bookings')
                .select(
                    `
          *,
          renter:user_profiles!bookings_renter_id_fkey(full_name, email),
          car:cars!bookings_car_id_fkey(make, model)
        `,
                )
                .eq('host_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (bookingsError) {
                console.error('Failed to fetch bookings:', bookingsError);
            } else {
                const enhancedBookings = (bookings || []).map((booking) => ({
                    id: booking.id,
                    created_at: booking.created_at,
                    start_date: booking.start_date,
                    end_date: booking.end_date,
                    status: booking.status,
                    total_amount: booking.total_amount,
                    renter_name: booking.renter?.full_name,
                    renter_email: booking.renter?.email,
                    renter_id: booking.renter_id,
                    car_id: booking.car_id,
                    vehicle_name: booking.car
                        ? `${booking.car.make} ${booking.car.model}`
                        : 'Unknown Vehicle',
                    special_instructions: booking.special_instructions,
                }));
                setRecentBookings(enhancedBookings);

                // Check review status for completed bookings
                if (user.id) {
                    checkReviewStatusForBookings(enhancedBookings, user.id);
                }
            }
        } catch (error) {
            console.error('Error fetching host data:', error);
            setError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, [checkReviewStatusForBookings]);

    useEffect(() => {
        fetchHostData();
        fetchUnreadMessageCount();
    }, [fetchHostData, fetchUnreadMessageCount]);

    // Load view mode preference from localStorage
    useEffect(() => {
        const savedViewMode = localStorage.getItem('vehicleManagementViewMode') as ViewMode;
        if (savedViewMode && ['grid', 'list'].includes(savedViewMode)) {
            setViewMode(savedViewMode);
        }
    }, []);

    // Save view mode preference to localStorage
    const handleViewModeChange = (newMode: ViewMode) => {
        setViewMode(newMode);
        localStorage.setItem('vehicleManagementViewMode', newMode);
    };

    // Set up real-time subscription for booking changes
    useEffect(() => {
        const setupSubscription = async () => {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const subscription = supabase
                .channel('host-booking-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'bookings',
                        filter: `host_id=eq.${user.id}`,
                    },
                    (payload) => {
                        console.log('Host dashboard: Real-time booking change detected:', payload);
                        // Refresh host data when any booking change occurs
                        fetchHostData();
                        // Also trigger vehicle calendar refresh
                        setRefreshTrigger((prev) => prev + 1);
                    },
                )
                .subscribe();

            return () => {
                supabase.removeChannel(subscription);
            };
        };

        const cleanup = setupSubscription();
        return () => {
            cleanup.then((fn) => fn?.());
        };
    }, [fetchHostData]);

    const handleLogout = async () => {
        try {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    // Handle booking rejection
    const handleRejectBooking = async (bookingId: string, renterName: string) => {
        if (!window.confirm(`Are you sure you want to reject the booking from ${renterName}?`)) {
            return;
        }

        setBookingLoading(true);
        try {
            const supabase = createClient();

            // Get current user
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                setError('Unable to get user information.');
                return;
            }

            // Update booking status to CANCELLED
            const { error } = await supabase
                .from('bookings')
                .update({
                    status: 'CANCELLED',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', bookingId)
                .eq('host_id', user.id);

            if (error) {
                console.error('Failed to reject booking:', error);
                setError('Failed to reject booking. Please try again.');
                return;
            }

            // Refresh the bookings list
            fetchHostData();

            // Trigger vehicle calendar refresh
            setRefreshTrigger((prev) => prev + 1);

            // Show success message
            alert(`Booking from ${renterName} has been rejected successfully.`);
        } catch (error) {
            console.error('Error rejecting booking:', error);
            setError('An error occurred while rejecting the booking.');
        } finally {
            setBookingLoading(false);
        }
    };

    // Handle booking approval (for manual pending bookings)
    const handleApproveBooking = async (bookingId: string) => {
        if (!confirm('Are you sure you want to approve this booking?')) return;

        setBookingLoading(true);
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                alert('Please log in to approve bookings');
                return;
            }

            const { error } = await supabase
                .from('bookings')
                .update({
                    status: 'CONFIRMED',
                    approved_at: new Date().toISOString(),
                    approved_by: user.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', bookingId)
                .eq('host_id', user.id); // Ensure host can only approve their own bookings

            if (error) {
                console.error('Error approving booking:', error);
                alert('Failed to approve booking. Please try again.');
                return;
            }

            alert('✅ Booking approved successfully!');
            fetchHostData(); // Refresh data

            // Trigger vehicle calendar refresh
            setRefreshTrigger((prev) => prev + 1);
        } catch (error) {
            console.error('Error approving booking:', error);
            alert('An unexpected error occurred.');
        } finally {
            setBookingLoading(false);
        }
    };

    // Handle booking status updates (CONFIRMED -> IN_PROGRESS -> COMPLETED)
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

            alert(`✅ Booking ${action} successfully!`);
            fetchHostData(); // Refresh data
            setRefreshTrigger((prev) => prev + 1); // Trigger vehicle calendar refresh
        } catch (error) {
            console.error('Error updating booking:', error);
            alert('An unexpected error occurred.');
        } finally {
            setBookingLoading(false);
        }
    };

    // Vehicle management handlers
    const handleFiltersChange = (newFilters: VehicleFilters) => {
        setFilters(newFilters);
    };

    const handleSearchChange = (query: string) => {
        setFilters((prev) => ({ ...prev, searchQuery: query }));
    };

    // Vehicle selection handlers
    const handleVehicleSelect = (vehicleId: string, selected: boolean) => {
        setSelectedVehicles((prev) => {
            const newSet = new Set(prev);
            if (selected) {
                newSet.add(vehicleId);
            } else {
                newSet.delete(vehicleId);
            }
            return newSet;
        });
    };

    const handleClearSelection = () => {
        setSelectedVehicles(new Set());
    };

    const handleBulkActionComplete = (action: string, count: number) => {
        // Refresh vehicle data after bulk actions
        fetchHostData();
        // Show success message
        alert(`Successfully ${action}d ${count} vehicle${count !== 1 ? 's' : ''}`);
    };

    const handleQuickAction = (vehicleId: string, action: string) => {
        switch (action) {
            case 'calendar':
                // Navigate to vehicle calendar or open calendar modal
                window.open(`/host/vehicles/${vehicleId}`, '_blank');
                break;
            case 'toggle-status':
                // Toggle vehicle status
                const vehicle = cars.find((v) => v.id === vehicleId);
                if (vehicle) {
                    const newStatus = vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                    // Update single vehicle status
                    updateVehicleStatus(vehicleId, newStatus);
                }
                break;
        }
    };

    const updateVehicleStatus = async (vehicleId: string, newStatus: string) => {
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('cars')
                .update({ status: newStatus })
                .eq('id', vehicleId);

            if (error) throw error;

            // Refresh data
            fetchHostData();
        } catch (error) {
            console.error('Error updating vehicle status:', error);
            alert('Failed to update vehicle status');
        }
    };

    const handleShowManualBooking = (vehicleId: string) => {
        setSelectedVehicleForBooking(vehicleId);
        setShowManualBookingModal(true);
    };

    const handleManualBookingCreated = () => {
        // Refresh vehicle data and show success message
        fetchHostData();
        alert('Manual booking created successfully!');
        setShowManualBookingModal(false);
        setSelectedVehicleForBooking(null);
    };

    // Review-related functions
    const handleLeaveReview = (booking: RecentBooking) => {
        setSelectedBookingForReview(booking);
        setReviewModal(true);
    };

    // Review function for VehicleCards (converts VehicleBooking to RecentBooking)
    const handleVehicleReview = (vehicleBooking: any) => {
        const recentBooking: RecentBooking = {
            id: vehicleBooking.id,
            created_at: vehicleBooking.created_at,
            start_date: vehicleBooking.start_date,
            end_date: vehicleBooking.end_date,
            status: vehicleBooking.status,
            total_amount: vehicleBooking.total_amount,
            renter_name: vehicleBooking.renter_name,
            renter_email: vehicleBooking.renter_email,
            renter_id: vehicleBooking.renter_id,
            car_id: vehicleBooking.car_id,
            vehicle_name: 'Vehicle', // We'll get this from car data if needed
            special_instructions: null,
        };
        handleLeaveReview(recentBooking);
    };

    const handleSubmitReview = async (reviewData: CreateReviewRequest) => {
        try {
            console.log('=== REVIEW SUBMISSION DEBUG ===');
            console.log('Submitting review data:', reviewData);
            console.log('Selected booking for review:', selectedBookingForReview);
            console.log('Current user ID:', currentUserId);
            console.log('Review data validation:', {
                booking_id: reviewData.booking_id,
                reviewer_id: reviewData.reviewer_id,
                reviewed_id: reviewData.reviewed_id,
                car_id: reviewData.car_id,
                rating: reviewData.rating,
                comment: reviewData.comment,
                is_public: reviewData.is_public,
            });
            await createReview(reviewData);
            alert('Review submitted successfully!');
            setReviewModal(false);
            setSelectedBookingForReview(null);

            // Update the review status for this booking
            setBookingReviewStatus((prev) => ({
                ...prev,
                [reviewData.booking_id]: true,
            }));

            // Optionally refresh data to update review status
            fetchHostData();
        } catch (error) {
            console.error('Error submitting review:', error);
            console.error('Review data that failed:', reviewData);
            alert(
                `Failed to submit review: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    };

    const getFilteredVehicles = () => {
        let filteredCars = cars;

        // Status Filter
        if (statusFilter !== 'all') {
            const statusMap = {
                active: 'ACTIVE',
                inactive: 'INACTIVE',
                pending: 'PENDING_APPROVAL',
                draft: 'DRAFT',
            };
            filteredCars = filteredCars.filter(
                (vehicle) => vehicle.status === statusMap[statusFilter],
            );
        }

        // Search Query Filter
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            filteredCars = filteredCars.filter(
                (car) =>
                    car.make?.toLowerCase().includes(query) ||
                    car.model?.toLowerCase().includes(query) ||
                    car.year?.toString().includes(query) ||
                    car.license_plate?.toLowerCase().includes(query),
            );
        }

        return filteredCars;
    };

    const getBookingStatusColor = (status: string) => {
        switch (status) {
            case 'CONFIRMED':
                return 'bg-black text-white';
            case 'AUTO_APPROVED':
                return 'bg-gray-800 text-white';
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={fetchHostData}
                        className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-8">
                            <h1 className="text-2xl font-bold text-black">{t('host.title')}</h1>

                            {/* Statistics in Navigation */}
                            <div className="flex items-center space-x-5">
                                <div className="flex items-center space-x-2">
                                    <div className="text-lg">🚗</div>
                                    <div>
                                        <div className="text-sm font-bold text-black">
                                            {stats?.total_cars || 0}
                                        </div>
                                        <div className="text-xs text-green-600">
                                            Active: {stats?.active_cars || 0}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="text-lg">📅</div>
                                    <div>
                                        <div className="text-sm font-bold text-black">
                                            {stats?.total_bookings || 0}
                                        </div>
                                        <div className="flex space-x-2 text-xs">
                                            <span className="text-blue-600">
                                                Online: {stats?.online_bookings || 0}
                                            </span>
                                            <span className="text-orange-600">
                                                Offline: {stats?.offline_bookings || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="text-lg">💰</div>
                                    <div>
                                        <div className="text-sm font-bold text-black">
                                            {formatCurrency(stats?.total_earnings || 0)}
                                        </div>
                                        <div className="text-xs text-green-600">
                                            Month: {formatCurrency(stats?.monthly_earnings || 0)}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    href="/host/reviews"
                                    className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg p-2 transition-colors"
                                >
                                    <div className="text-lg">⭐</div>
                                    <div>
                                        <div className="text-sm font-bold text-black">
                                            {stats?.average_rating?.toFixed(1) || '0.0'}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            {stats?.total_reviews || 0} reviews
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6">
                            {/* Quick Actions in Navigation - moved more to the right */}
                            <div className="flex items-center space-x-3">
                                <Link
                                    href="/host/add-vehicle"
                                    className="bg-black text-white px-3 py-2 rounded-md hover:bg-gray-800 transition-colors text-xs font-medium"
                                >
                                    ➕ {t('host.addVehicle')}
                                </Link>
                                <Link
                                    href="/host/offline-bookings"
                                    className="bg-orange-600 text-white px-3 py-2 rounded-md hover:bg-orange-700 transition-colors text-xs font-medium"
                                >
                                    📅 {t('host.offlineBookings')}
                                </Link>
                                <Link
                                    href="/host/reviews"
                                    className="bg-yellow-600 text-white px-3 py-2 rounded-md hover:bg-yellow-700 transition-colors text-xs font-medium"
                                >
                                    ⭐ {t('host.reviewsButton')}
                                </Link>
                                <MessageNotification
                                    unreadCount={unreadMessageCount}
                                    onClick={() => router.push('/messages')}
                                />
                            </div>

                            <div className="flex items-center space-x-4">
                                <LanguageSwitcher variant="compact" />
                                <Link
                                    href="/profile"
                                    className="text-gray-700 hover:text-black transition-colors"
                                >
                                    {t('navigation.profile')}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="text-gray-700 hover:text-black transition-colors cursor-pointer"
                                >
                                    {t('common.signOut')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Dashboard Content */}
            <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                {/* Vehicle Cards Section */}
                {cars.length > 0 && (
                    <div className="mb-8">
                        {/* Vehicle Search */}
                        <VehicleSearch
                            onFiltersChange={handleFiltersChange}
                            onSearchChange={handleSearchChange}
                            vehicleCount={getFilteredVehicles().length}
                            loading={loading}
                        />

                        {/* Bulk Actions */}
                        <BulkActions
                            selectedVehicles={selectedVehicles}
                            vehicles={cars}
                            onClearSelection={handleClearSelection}
                            onActionComplete={handleBulkActionComplete}
                            onShowManualBooking={handleShowManualBooking}
                        />

                        {/* Status Filter Tabs */}
                        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-6 mb-6">
                            <div className="flex flex-wrap items-center justify-between mb-4">
                                <div className="flex flex-wrap gap-2 mb-4 md:mb-0">
                                    {[
                                        {
                                            key: 'all',
                                            label: 'All Vehicles',
                                            count: vehicleStats.total,
                                        },
                                        {
                                            key: 'active',
                                            label: 'Active',
                                            count: vehicleStats.active,
                                        },
                                        {
                                            key: 'inactive',
                                            label: 'Inactive',
                                            count: vehicleStats.inactive,
                                        },
                                        {
                                            key: 'pending',
                                            label: 'Pending Approval',
                                            count: vehicleStats.pending,
                                        },
                                        { key: 'draft', label: 'Draft', count: vehicleStats.draft },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setStatusFilter(tab.key as StatusFilter)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border-2 ${
                                                statusFilter === tab.key
                                                    ? 'bg-black text-white border-black'
                                                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-black'
                                            }`}
                                        >
                                            {tab.label} ({tab.count})
                                        </button>
                                    ))}
                                </div>

                                {/* Grid/List Toggle in Vehicle Section */}
                                <div className="flex items-center bg-gray-100 rounded-lg border-2 border-gray-300 p-1">
                                    <button
                                        onClick={() => handleViewModeChange('grid')}
                                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                            viewMode === 'grid'
                                                ? 'bg-black text-white'
                                                : 'text-gray-600 hover:text-black'
                                        }`}
                                    >
                                        Grid
                                    </button>
                                    <button
                                        onClick={() => handleViewModeChange('list')}
                                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                            viewMode === 'list'
                                                ? 'bg-black text-white'
                                                : 'text-gray-600 hover:text-black'
                                        }`}
                                    >
                                        List
                                    </button>
                                </div>
                            </div>

                            {/* Unified Vehicle Cards */}
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {getFilteredVehicles().map((car) => (
                                        <UnifiedVehicleCard
                                            key={car.id}
                                            car={car}
                                            viewMode="grid"
                                            refreshTrigger={refreshTrigger}
                                            onApproveBooking={handleApproveBooking}
                                            onRejectBooking={handleRejectBooking}
                                            onUpdateBookingStatus={handleUpdateBookingStatus}
                                            onLeaveReview={handleVehicleReview}
                                            bookingLoading={bookingLoading}
                                            reviewLoading={reviewLoading}
                                            onVehicleSelect={handleVehicleSelect}
                                            isSelected={selectedVehicles.has(car.id)}
                                            onQuickAction={handleQuickAction}
                                            onShowManualBooking={handleShowManualBooking}
                                            bookingReviewStatus={bookingReviewStatus}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {getFilteredVehicles().map((car) => (
                                        <UnifiedVehicleCard
                                            key={car.id}
                                            car={car}
                                            viewMode="list"
                                            refreshTrigger={refreshTrigger}
                                            onApproveBooking={handleApproveBooking}
                                            onRejectBooking={handleRejectBooking}
                                            onUpdateBookingStatus={handleUpdateBookingStatus}
                                            onLeaveReview={handleVehicleReview}
                                            bookingLoading={bookingLoading}
                                            reviewLoading={reviewLoading}
                                            onVehicleSelect={handleVehicleSelect}
                                            isSelected={selectedVehicles.has(car.id)}
                                            onQuickAction={handleQuickAction}
                                            onShowManualBooking={handleShowManualBooking}
                                            bookingReviewStatus={bookingReviewStatus}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Summary Section - Only show when no vehicles */}
                {cars.length === 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-400 mb-8">
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">🚗</div>
                            <p className="text-gray-600 mb-4">No registered vehicles</p>
                            <Link
                                href="/host/add-vehicle"
                                className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                            >
                                Register First Vehicle
                            </Link>
                        </div>
                    </div>
                )}

                {/* Recent Bookings Summary - Only show if vehicles exist */}
                {cars.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-400 mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-black">
                                Recent Bookings Across All Vehicles
                            </h3>
                            <button
                                onClick={() => router.push('/host/bookings')}
                                className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                            >
                                View All
                            </button>
                        </div>
                        <div className="space-y-4">
                            {recentBookings.length > 0 ? (
                                recentBookings.map((booking) => {
                                    const canReject =
                                        booking.status === 'PENDING' ||
                                        booking.status === 'AUTO_APPROVED';
                                    const daysUntilStart = Math.ceil(
                                        (new Date(booking.start_date).getTime() -
                                            new Date().getTime()) /
                                            (1000 * 60 * 60 * 24),
                                    );
                                    const rejectionAllowed = canReject && daysUntilStart >= 1;

                                    return (
                                        <div
                                            key={booking.id}
                                            className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="font-medium text-black text-sm">
                                                            Booking #{booking.id.substring(0, 8)}
                                                        </p>
                                                        <span
                                                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getBookingStatusColor(booking.status)}`}
                                                        >
                                                            {booking.status}
                                                        </span>
                                                    </div>

                                                    {/* Renter Information */}
                                                    <div className="mb-2">
                                                        {(() => {
                                                            try {
                                                                // Try to parse as JSON for manual bookings
                                                                const parsed = JSON.parse(
                                                                    booking.special_instructions ||
                                                                        '{}',
                                                                );
                                                                if (
                                                                    parsed.created_manually &&
                                                                    parsed.customer_info
                                                                ) {
                                                                    return (
                                                                        <>
                                                                            <p className="text-sm text-gray-800 font-medium">
                                                                                👤{' '}
                                                                                {
                                                                                    parsed
                                                                                        .customer_info
                                                                                        .fullName
                                                                                }
                                                                            </p>
                                                                            <p className="text-xs text-gray-600">
                                                                                📧{' '}
                                                                                {parsed
                                                                                    .customer_info
                                                                                    .email ||
                                                                                    'No email available'}
                                                                            </p>
                                                                        </>
                                                                    );
                                                                } else {
                                                                    // Regular booking
                                                                    return (
                                                                        <>
                                                                            <p className="text-sm text-gray-800 font-medium">
                                                                                👤{' '}
                                                                                {booking.renter_name ||
                                                                                    'Guest User'}
                                                                            </p>
                                                                            <p className="text-xs text-gray-600">
                                                                                📧{' '}
                                                                                {booking.renter_email ||
                                                                                    'No email available'}
                                                                            </p>
                                                                        </>
                                                                    );
                                                                }
                                                            } catch {
                                                                // Not JSON, display regular renter info
                                                                return (
                                                                    <>
                                                                        <p className="text-sm text-gray-800 font-medium">
                                                                            👤{' '}
                                                                            {booking.renter_name ||
                                                                                'Guest User'}
                                                                        </p>
                                                                        <p className="text-xs text-gray-600">
                                                                            📧{' '}
                                                                            {booking.renter_email ||
                                                                                'No email available'}
                                                                        </p>
                                                                    </>
                                                                );
                                                            }
                                                        })()}
                                                    </div>

                                                    {/* Vehicle Information */}
                                                    <div className="mb-2">
                                                        <p className="text-sm text-gray-800">
                                                            🚗 {booking.vehicle_name || 'Vehicle'}
                                                        </p>
                                                    </div>

                                                    {/* Booking Details */}
                                                    <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-gray-600">
                                                        <div>
                                                            📅{' '}
                                                            {new Date(
                                                                booking.start_date,
                                                            ).toLocaleDateString('ko-KR')}
                                                        </div>
                                                        <div>
                                                            📅{' '}
                                                            {new Date(
                                                                booking.end_date,
                                                            ).toLocaleDateString('ko-KR')}
                                                        </div>
                                                        <div>
                                                            💰{' '}
                                                            {formatCurrency(booking.total_amount)}
                                                        </div>
                                                        <div>
                                                            ⏰{' '}
                                                            {daysUntilStart > 0
                                                                ? `${daysUntilStart} days left`
                                                                : 'Started'}
                                                        </div>
                                                    </div>

                                                    {/* Special Instructions */}
                                                    {booking.special_instructions && (
                                                        <div className="mb-2">
                                                            {(() => {
                                                                try {
                                                                    // Try to parse as JSON for manual bookings
                                                                    const parsed = JSON.parse(
                                                                        booking.special_instructions,
                                                                    );
                                                                    if (
                                                                        parsed.created_manually &&
                                                                        parsed.customer_info
                                                                    ) {
                                                                        return (
                                                                            <div className="text-xs text-gray-600 space-y-1">
                                                                                <p>
                                                                                    👤 Manual
                                                                                    Booking:{' '}
                                                                                    {
                                                                                        parsed
                                                                                            .customer_info
                                                                                            .fullName
                                                                                    }
                                                                                </p>
                                                                                {parsed
                                                                                    .customer_info
                                                                                    .email && (
                                                                                    <p>
                                                                                        📧{' '}
                                                                                        {
                                                                                            parsed
                                                                                                .customer_info
                                                                                                .email
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                                {parsed
                                                                                    .customer_info
                                                                                    .phone && (
                                                                                    <p>
                                                                                        📞{' '}
                                                                                        {
                                                                                            parsed
                                                                                                .customer_info
                                                                                                .phone
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                                {parsed
                                                                                    .booking_details
                                                                                    ?.notes && (
                                                                                    <p>
                                                                                        📝{' '}
                                                                                        {
                                                                                            parsed
                                                                                                .booking_details
                                                                                                .notes
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        // Regular special instructions
                                                                        return (
                                                                            <p className="text-xs text-gray-600">
                                                                                📝{' '}
                                                                                {
                                                                                    booking.special_instructions
                                                                                }
                                                                            </p>
                                                                        );
                                                                    }
                                                                } catch {
                                                                    // Not JSON, display as regular text
                                                                    return (
                                                                        <p className="text-xs text-gray-600">
                                                                            📝{' '}
                                                                            {
                                                                                booking.special_instructions
                                                                            }
                                                                        </p>
                                                                    );
                                                                }
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            {(rejectionAllowed ||
                                                booking.status === 'CONFIRMED' ||
                                                booking.status === 'IN_PROGRESS' ||
                                                booking.status === 'COMPLETED') && (
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <div className="flex justify-end space-x-2 flex-wrap gap-2">
                                                        {/* PENDING Status Buttons */}
                                                        {rejectionAllowed && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        // Get customer name for manual bookings
                                                                        let customerName =
                                                                            booking.renter_name ||
                                                                            'Unknown Renter';
                                                                        try {
                                                                            const parsed =
                                                                                JSON.parse(
                                                                                    booking.special_instructions ||
                                                                                        '{}',
                                                                                );
                                                                            if (
                                                                                parsed.created_manually &&
                                                                                parsed.customer_info
                                                                            ) {
                                                                                customerName =
                                                                                    parsed
                                                                                        .customer_info
                                                                                        .fullName;
                                                                            }
                                                                        } catch {}
                                                                        handleRejectBooking(
                                                                            booking.id,
                                                                            customerName,
                                                                        );
                                                                    }}
                                                                    className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                                                    disabled={bookingLoading}
                                                                >
                                                                    {bookingLoading
                                                                        ? 'Processing...'
                                                                        : 'Reject'}
                                                                </button>
                                                                {booking.status === 'PENDING' && (
                                                                    <button
                                                                        onClick={() =>
                                                                            handleApproveBooking(
                                                                                booking.id,
                                                                            )
                                                                        }
                                                                        className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                                                        disabled={bookingLoading}
                                                                    >
                                                                        {bookingLoading
                                                                            ? 'Processing...'
                                                                            : 'Approve'}
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* CONFIRMED Status Buttons */}
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

                                                        {/* IN_PROGRESS Status Buttons */}
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

                                                        {/* COMPLETED Status Buttons */}
                                                        {booking.status === 'COMPLETED' &&
                                                            !isManualBooking(booking) && (
                                                                <>
                                                                    {bookingReviewStatus[
                                                                        booking.id
                                                                    ] ? (
                                                                        <button
                                                                            className="px-3 py-1 bg-gray-400 text-white text-xs rounded cursor-not-allowed flex items-center gap-1"
                                                                            disabled
                                                                        >
                                                                            ✓ Review Completed
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleLeaveReview(
                                                                                    booking,
                                                                                )
                                                                            }
                                                                            className="px-3 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 transition-colors flex items-center gap-1"
                                                                            disabled={reviewLoading}
                                                                        >
                                                                            {reviewLoading ? (
                                                                                'Loading...'
                                                                            ) : (
                                                                                <>⭐ Leave Review</>
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                    </div>
                                                </div>
                                            )}

                                            {!rejectionAllowed && canReject && (
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <p className="text-xs text-gray-500">
                                                        ⏰ Rejection deadline passed (must reject 1+
                                                        days before start)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-6xl mb-4">📅</div>
                                    <p className="text-gray-600">No recent bookings</p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Bookings will appear here when guests make reservations
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Last Updated */}
                {stats?.calculated_at && (
                    <div className="mt-6 text-center text-gray-500 text-sm">
                        Last updated: {new Date(stats.calculated_at).toLocaleString('ko-KR')}
                    </div>
                )}
            </div>

            {/* Manual Booking Modal */}
            <ManualBookingModal
                isOpen={showManualBookingModal}
                onClose={() => {
                    setShowManualBookingModal(false);
                    setSelectedVehicleForBooking(null);
                }}
                vehicles={cars.filter((v) => v.status === 'ACTIVE')}
                onBookingCreated={handleManualBookingCreated}
                preSelectedVehicleId={selectedVehicleForBooking || undefined}
            />

            {/* Review Modal */}
            {reviewModal && selectedBookingForReview && currentUserId && (
                <ReviewModal
                    isOpen={reviewModal}
                    onClose={() => {
                        setReviewModal(false);
                        setSelectedBookingForReview(null);
                    }}
                    onSubmit={handleSubmitReview}
                    booking={{
                        id: selectedBookingForReview.id,
                        car: {
                            id: selectedBookingForReview.car_id || 'unknown-car-id',
                            make: selectedBookingForReview.vehicle_name?.split(' ')[0] || 'Unknown',
                            model:
                                selectedBookingForReview.vehicle_name
                                    ?.split(' ')
                                    .slice(1)
                                    .join(' ') || 'Vehicle',
                            year: new Date().getFullYear(),
                        },
                        host: {
                            id: currentUserId,
                            full_name: 'Host', // We could fetch this from user profile if needed
                        },
                        renter: {
                            id: selectedBookingForReview.renter_id || 'unknown',
                            full_name: selectedBookingForReview.renter_name || 'Unknown Renter',
                        },
                        start_date: selectedBookingForReview.start_date,
                        end_date: selectedBookingForReview.end_date,
                        total_amount: selectedBookingForReview.total_amount,
                    }}
                    currentUserId={currentUserId}
                    loading={reviewLoading}
                />
            )}
        </div>
    );
}
