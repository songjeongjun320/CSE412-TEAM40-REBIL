'use client';

import { Calendar, Car, Eye, Phone, Plus, Search, User, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getCurrentUserRoles } from '@/lib/auth/userRoles';
import { createClient } from '@/lib/supabase/supabaseClient';
import { Enums, Tables } from '@/types/base/database.types';

type Booking = Tables<'bookings'>;
type Vehicle = Tables<'cars'>;
type BookingStatus = Enums<'booking_status'>;

interface OfflineBooking extends Booking {
    car?: Vehicle;
    customer_info?: {
        fullName: string;
        email?: string;
        phone: string;
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

export default function OfflineBookingsPage() {
    const router = useRouter();
    const [bookings, setBookings] = useState<OfflineBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [selectedBooking, setSelectedBooking] = useState<OfflineBooking | null>(null);
    const [showModal, setShowModal] = useState(false);

    const supabase = createClient();

    const checkHostPermissionAndFetchBookings = useCallback(async () => {
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

            // Fetch offline bookings with vehicle information
            // Note: Filtering for offline bookings using special_instructions pattern
            const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .select(
                    `
          *,
          cars (*)
        `,
                )
                .eq('host_id', user.id)
                .order('created_at', { ascending: false });

            if (bookingError) {
                setError('Failed to load offline bookings.');
                console.error('Error fetching bookings:', bookingError);
                return;
            }

            // Parse special_instructions to extract customer info and filter for offline bookings
            const processedBookings = (bookingData || [])
                .map((booking) => {
                    let customerInfo = null;
                    let bookingDetails = null;
                    let isOfflineBooking = false;

                    try {
                        if (booking.special_instructions) {
                            const instructions = JSON.parse(booking.special_instructions);
                            customerInfo = instructions.customer_info;
                            bookingDetails = instructions.booking_details;
                            // Check if this is an offline booking (has customer_info structure or explicit flag)
                            isOfflineBooking =
                                !!(customerInfo && customerInfo.fullName) ||
                                instructions.is_offline_booking === true;
                        }
                    } catch {
                        console.warn(
                            'Failed to parse special_instructions for booking',
                            booking.id,
                        );
                    }

                    return {
                        ...booking,
                        car: booking.cars,
                        customer_info: customerInfo,
                        booking_details: bookingDetails,
                        is_offline_booking: isOfflineBooking,
                    } as OfflineBooking & { is_offline_booking: boolean };
                })
                .filter((booking) => booking.is_offline_booking); // Only include offline bookings

            setBookings(processedBookings);
        } catch (error) {
            console.error('Error loading bookings:', error);
            setError('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    }, [router, supabase]);

    useEffect(() => {
        checkHostPermissionAndFetchBookings();
    }, [checkHostPermissionAndFetchBookings]);

    const getFilteredBookings = () => {
        return bookings.filter((booking) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const searchableText = `
          ${booking.customer_info?.fullName || ''}
          ${booking.customer_info?.phone || ''}
          ${booking.customer_info?.email || ''}
          ${booking.car?.make || ''} ${booking.car?.model || ''}
          ${booking.car?.license_plate || ''}
        `.toLowerCase();

                if (!searchableText.includes(query)) return false;
            }

            // Status filter
            if (statusFilter !== 'all' && booking.status !== statusFilter) return false;

            // Date filter
            if (dateFilter !== 'all') {
                const now = new Date();
                const bookingStart = new Date(booking.start_date);
                const bookingEnd = new Date(booking.end_date);

                switch (dateFilter) {
                    case 'upcoming':
                        if (bookingStart <= now) return false;
                        break;
                    case 'active':
                        if (bookingStart > now || bookingEnd < now) return false;
                        break;
                    case 'past':
                        if (bookingEnd >= now) return false;
                        break;
                }
            }

            return true;
        });
    };

    const getStatusColor = (status: BookingStatus) => {
        switch (status) {
            case 'CONFIRMED':
            case 'AUTO_APPROVED':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'IN_PROGRESS':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'COMPLETED':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'CANCELLED':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getBookingTypeIcon = (booking: OfflineBooking) => {
        const now = new Date();
        const start = new Date(booking.start_date);
        const end = new Date(booking.end_date);

        if (start > now) return { icon: Calendar, color: 'text-blue-600', label: 'Upcoming' };
        if (start <= now && end >= now)
            return { icon: Car, color: 'text-green-600', label: 'Active' };
        return { icon: Calendar, color: 'text-gray-600', label: 'Past' };
    };

    const formatCurrency = (amount: number) => {
        return `Rp ${amount.toLocaleString()}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleUpdateStatus = async (bookingId: string, newStatus: BookingStatus) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', bookingId);

            if (error) throw error;

            setBookings((prev) =>
                prev.map((booking) =>
                    booking.id === bookingId ? { ...booking, status: newStatus } : booking,
                ),
            );
        } catch (error) {
            console.error('Error updating booking status:', error);
            alert('Failed to update booking status');
        }
    };

    const handleDeleteBooking = async (bookingId: string) => {
        if (
            !confirm('Are you sure you want to delete this booking? This action cannot be undone.')
        ) {
            return;
        }

        try {
            const { error } = await supabase.from('bookings').delete().eq('id', bookingId);

            if (error) throw error;

            setBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
            setShowModal(false);
        } catch (error) {
            console.error('Error deleting booking:', error);
            alert('Failed to delete booking');
        }
    };

    const renderBookingModal = () => {
        if (!selectedBooking) return null;

        const typeInfo = getBookingTypeIcon(selectedBooking);

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-black">Booking Details</h2>
                        <button
                            onClick={() => setShowModal(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Status and Type */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <typeInfo.icon className={`h-8 w-8 ${typeInfo.color}`} />
                                <div>
                                    <h3 className="text-lg font-semibold text-black">
                                        {typeInfo.label} Booking
                                    </h3>
                                    <span
                                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedBooking.status)}`}
                                    >
                                        {selectedBooking.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Vehicle Information */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                                <Car className="h-5 w-5 mr-2" />
                                Vehicle Information
                            </h4>
                            {selectedBooking.car && (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Vehicle:</span>
                                        <p className="font-medium text-black">
                                            {selectedBooking.car.make} {selectedBooking.car.model} (
                                            {selectedBooking.car.year})
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">License Plate:</span>
                                        <p className="font-medium font-mono text-black">
                                            {selectedBooking.car.license_plate}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Daily Rate:</span>
                                        <p className="font-medium text-black">
                                            {formatCurrency(selectedBooking.car.daily_rate)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Total Amount:</span>
                                        <p className="font-medium text-black">
                                            {formatCurrency(selectedBooking.total_amount)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Customer Information */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                                <User className="h-5 w-5 mr-2" />
                                Customer Information
                            </h4>
                            {selectedBooking.customer_info && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Name:</span>
                                        <p className="font-medium text-black">
                                            {selectedBooking.customer_info.fullName}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Phone:</span>
                                        <p className="font-medium text-black">
                                            {selectedBooking.customer_info.phone}
                                        </p>
                                    </div>
                                    {selectedBooking.customer_info.email && (
                                        <div>
                                            <span className="text-gray-600">Email:</span>
                                            <p className="font-medium text-black">
                                                {selectedBooking.customer_info.email}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-gray-600">Driver License:</span>
                                        <p className="font-medium text-black">
                                            {selectedBooking.customer_info.driverLicense}
                                        </p>
                                    </div>
                                    {selectedBooking.customer_info.emergencyContact && (
                                        <>
                                            <div>
                                                <span className="text-gray-600">
                                                    Emergency Contact:
                                                </span>
                                                <p className="font-medium text-black">
                                                    {selectedBooking.customer_info.emergencyContact}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">
                                                    Emergency Phone:
                                                </span>
                                                <p className="font-medium text-black">
                                                    {selectedBooking.customer_info.emergencyPhone}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Booking Period */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                                <Calendar className="h-5 w-5 mr-2" />
                                Rental Period
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-600">Start Date:</span>
                                    <p className="font-medium text-black">
                                        {formatDate(selectedBooking.start_date)}
                                    </p>
                                    {selectedBooking.booking_details?.pickup_time && (
                                        <p className="text-xs text-gray-500">
                                            Pickup: {selectedBooking.booking_details.pickup_time}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <span className="text-gray-600">End Date:</span>
                                    <p className="font-medium text-black">
                                        {formatDate(selectedBooking.end_date)}
                                    </p>
                                    {selectedBooking.booking_details?.return_time && (
                                        <p className="text-xs text-gray-500">
                                            Return: {selectedBooking.booking_details.return_time}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {(selectedBooking.customer_info?.notes ||
                            selectedBooking.booking_details?.notes) && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-900 mb-3">Notes</h4>
                                {selectedBooking.customer_info?.notes && (
                                    <div className="mb-2">
                                        <span className="text-gray-600 text-sm">
                                            Customer Notes:
                                        </span>
                                        <p className="text-sm text-black">
                                            {selectedBooking.customer_info.notes}
                                        </p>
                                    </div>
                                )}
                                {selectedBooking.booking_details?.notes && (
                                    <div>
                                        <span className="text-gray-600 text-sm">
                                            Booking Notes:
                                        </span>
                                        <p className="text-sm text-black">
                                            {selectedBooking.booking_details.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between p-6 border-t border-gray-200">
                        <div className="flex space-x-2">
                            {selectedBooking.status === 'CONFIRMED' && (
                                <button
                                    onClick={() =>
                                        handleUpdateStatus(selectedBooking.id, 'IN_PROGRESS')
                                    }
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                >
                                    Mark Active
                                </button>
                            )}
                            {selectedBooking.status === 'IN_PROGRESS' && (
                                <button
                                    onClick={() =>
                                        handleUpdateStatus(selectedBooking.id, 'COMPLETED')
                                    }
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                    Mark Completed
                                </button>
                            )}
                            <button
                                onClick={() => handleUpdateStatus(selectedBooking.id, 'CANCELLED')}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                disabled={
                                    selectedBooking.status === 'COMPLETED' ||
                                    selectedBooking.status === 'CANCELLED'
                                }
                            >
                                Cancel Booking
                            </button>
                        </div>

                        <div className="flex space-x-2">
                            <button
                                onClick={() => handleDeleteBooking(selectedBooking.id)}
                                className="px-4 py-2 border-2 border-red-300 text-red-600 rounded-lg hover:border-red-400 transition-colors text-sm"
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading offline bookings...</p>
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

    const filteredBookings = getFilteredBookings();

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
                            <span className="text-gray-600">Offline Bookings</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/host/offline-bookings/create"
                                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors flex items-center space-x-2"
                            >
                                <Plus className="h-4 w-4" />
                                <span>New Booking</span>
                            </Link>
                            <Link
                                href="/home/host"
                                className="bg-gray-200 text-black px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Back To Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-black mb-2">Offline Bookings</h1>
                    <p className="text-gray-600">Manage manual bookings for walk-in customers</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-6 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                        {/* Search */}
                        <div className="relative flex-1 lg:max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by customer name, phone, vehicle..."
                                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap items-center space-x-4">
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value as BookingStatus | 'all')
                                }
                                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                            >
                                <option value="all" className="text-black">
                                    All Status
                                </option>
                                <option value="PENDING" className="text-black">
                                    Pending
                                </option>
                                <option value="AUTO_APPROVED" className="text-black">
                                    Auto Approved
                                </option>
                                <option value="CONFIRMED" className="text-black">
                                    Confirmed
                                </option>
                                <option value="IN_PROGRESS" className="text-black">
                                    In Progress
                                </option>
                                <option value="COMPLETED" className="text-black">
                                    Completed
                                </option>
                                <option value="CANCELLED" className="text-black">
                                    Cancelled
                                </option>
                                <option value="DISPUTED" className="text-black">
                                    Disputed
                                </option>
                            </select>

                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                            >
                                <option value="all" className="text-black">
                                    All Dates
                                </option>
                                <option value="upcoming" className="text-black">
                                    Upcoming
                                </option>
                                <option value="active" className="text-black">
                                    Active
                                </option>
                                <option value="past" className="text-black">
                                    Past
                                </option>
                            </select>
                        </div>
                    </div>

                    {/* Results Summary */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            Found <strong>{filteredBookings.length}</strong> offline booking
                            {filteredBookings.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Bookings List */}
                {filteredBookings.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-12 text-center">
                        <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            No offline bookings found
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {searchQuery || statusFilter !== 'all' || dateFilter !== 'all'
                                ? 'Try adjusting your search or filters.'
                                : "You haven't created any offline bookings yet."}
                        </p>
                        <Link
                            href="/host/offline-bookings/create"
                            className="inline-block bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                        >
                            Create First Booking
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 overflow-hidden">
                        <div className="divide-y divide-gray-200">
                            {filteredBookings.map((booking) => {
                                const typeInfo = getBookingTypeIcon(booking);

                                return (
                                    <div
                                        key={booking.id}
                                        className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => {
                                            setSelectedBooking(booking);
                                            setShowModal(true);
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4 flex-1">
                                                {/* Type Icon */}
                                                <div className="flex-shrink-0">
                                                    <typeInfo.icon
                                                        className={`h-8 w-8 ${typeInfo.color}`}
                                                    />
                                                </div>

                                                {/* Booking Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-3 mb-1">
                                                        <h3 className="text-lg font-semibold text-black truncate">
                                                            {booking.customer_info?.fullName ||
                                                                'Unknown Customer'}
                                                        </h3>
                                                        <span
                                                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}
                                                        >
                                                            {booking.status}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                                                        {booking.car && (
                                                            <span className="flex items-center space-x-1">
                                                                <Car className="h-4 w-4" />
                                                                <span>
                                                                    {booking.car.make}{' '}
                                                                    {booking.car.model} -{' '}
                                                                    {booking.car.license_plate}
                                                                </span>
                                                            </span>
                                                        )}
                                                        {booking.customer_info?.phone && (
                                                            <span className="flex items-center space-x-1">
                                                                <Phone className="h-4 w-4" />
                                                                <span>
                                                                    {booking.customer_info.phone}
                                                                </span>
                                                            </span>
                                                        )}
                                                        <span className="flex items-center space-x-1">
                                                            <Calendar className="h-4 w-4" />
                                                            <span>
                                                                {formatDate(booking.start_date)} -{' '}
                                                                {formatDate(booking.end_date)}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-lg font-semibold text-black">
                                                        {formatCurrency(booking.total_amount)}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        {typeInfo.label}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center space-x-2 ml-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedBooking(booking);
                                                        setShowModal(true);
                                                    }}
                                                    className="p-2 text-gray-600 hover:text-black transition-colors"
                                                >
                                                    <Eye className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && renderBookingModal()}
        </div>
    );
}
