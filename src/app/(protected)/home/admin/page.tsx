'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency } from '@/lib/utils';

type AdminStats = {
    total_users: number;
    total_cars: number;
    active_cars: number;
    total_bookings: number;
    completed_bookings: number;
    total_revenue: number;
    monthly_revenue: number;
    total_hosts: number;
    total_renters: number;
    pending_verifications: number;
    disputed_bookings: number;
    calculated_at: string;
};

interface RecentTransaction {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    renter_name: string;
    host_name: string;
    car_name: string;
    start_date: string;
    end_date: string;
}

interface PendingItem {
    id: string;
    type: 'car_approval' | 'verification' | 'dispute';
    title: string;
    description: string;
    created_at: string;
    priority: 'high' | 'medium' | 'low';
}

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAdminStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAdminStats = async () => {
        try {
            const supabase = createClient();

            console.log('Starting admin stats fetch...');

            // First check if user is authenticated and has ADMIN role
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();
            if (userError || !user) {
                console.error('User not authenticated:', userError);
                setError('User not authenticated');
                return;
            }

            console.log('User authenticated:', user.id);

            // Check user's role
            const { data: userRoles, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .eq('is_active', true);

            if (roleError) {
                console.error('Error checking user roles:', roleError);
                setError('Failed to verify admin permissions');
                return;
            }

            console.log('User roles:', userRoles);

            const isAdmin = userRoles?.some((r) => r.role === 'ADMIN');
            if (!isAdmin) {
                console.error('User is not an admin');
                setError('Access denied: Admin role required');
                return;
            }

            console.log('Admin role verified, fetching statistics...');

            // First, try to get recent admin_stats data (less than 1 hour old)
            const { data: adminStats, error: adminStatsError } = await supabase
                .from('admin_stats')
                .select('*')
                .order('calculated_at', { ascending: false })
                .limit(1)
                .single();

            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const isAdminStatsRecent =
                adminStats && new Date(adminStats.calculated_at) > oneHourAgo;

            if (isAdminStatsRecent && !adminStatsError) {
                console.log('Using recent admin_stats data:', adminStats.calculated_at);
                setStats(adminStats);
                return;
            }

            console.log('Admin stats stale or missing, calculating real-time statistics...');

            const results = await Promise.allSettled([
                // Total users
                supabase.from('user_profiles').select('*', { count: 'exact', head: true }),

                // Total cars
                supabase.from('cars').select('*', { count: 'exact', head: true }),

                // Active cars
                supabase
                    .from('cars')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'ACTIVE'),

                // Total bookings
                supabase.from('bookings').select('*', { count: 'exact', head: true }),

                // Completed bookings
                supabase
                    .from('bookings')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'COMPLETED'),

                // Total hosts
                supabase
                    .from('user_roles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'HOST')
                    .eq('is_active', true),

                // Total renters
                supabase
                    .from('user_roles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'RENTER')
                    .eq('is_active', true),

                // Pending verifications
                supabase
                    .from('user_verifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'PENDING'),

                // Disputed bookings
                supabase
                    .from('bookings')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'DISPUTED'),

                // Total revenue from completed payments
                supabase.from('payments').select('amount').eq('status', 'COMPLETED'),

                // Monthly revenue from completed payments (current month)
                supabase
                    .from('payments')
                    .select('amount')
                    .eq('status', 'COMPLETED')
                    .gte(
                        'created_at',
                        new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
                    ),
            ]);

            // Process results and handle failures gracefully
            const [
                totalUsersResult,
                totalCarsResult,
                activeCarsResult,
                totalBookingsResult,
                completedBookingsResult,
                totalHostsResult,
                totalRentersResult,
                pendingVerificationsResult,
                disputedBookingsResult,
                totalRevenueResult,
                monthlyRevenueResult,
            ] = results;

            console.log('Query results:', results);

            // Extract counts with fallback to 0 for failed queries
            const totalUsers =
                totalUsersResult.status === 'fulfilled' ? totalUsersResult.value.count || 0 : 0;
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
            const totalHosts =
                totalHostsResult.status === 'fulfilled' ? totalHostsResult.value.count || 0 : 0;
            const totalRenters =
                totalRentersResult.status === 'fulfilled' ? totalRentersResult.value.count || 0 : 0;
            const pendingVerifications =
                pendingVerificationsResult.status === 'fulfilled'
                    ? pendingVerificationsResult.value.count || 0
                    : 0;
            const disputedBookings =
                disputedBookingsResult.status === 'fulfilled'
                    ? disputedBookingsResult.value.count || 0
                    : 0;

            // Calculate revenue from payments data
            const totalRevenueData =
                totalRevenueResult.status === 'fulfilled'
                    ? totalRevenueResult.value.data || []
                    : [];
            const totalRevenue = totalRevenueData.reduce(
                (sum: number, payment: any) => sum + (payment.amount || 0),
                0,
            );

            const monthlyRevenueData =
                monthlyRevenueResult.status === 'fulfilled'
                    ? monthlyRevenueResult.value.data || []
                    : [];
            const monthlyRevenue = monthlyRevenueData.reduce(
                (sum: number, payment: any) => sum + (payment.amount || 0),
                0,
            );

            // Log any failed queries and revenue calculations
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.warn(`Query ${index} failed:`, result.reason);
                }
            });

            console.log('Revenue calculations:', {
                totalRevenueData: totalRevenueData.length,
                totalRevenue,
                monthlyRevenueData: monthlyRevenueData.length,
                monthlyRevenue,
            });

            const statsData: AdminStats = {
                total_users: totalUsers,
                total_cars: totalCars,
                active_cars: activeCars,
                total_bookings: totalBookings,
                completed_bookings: completedBookings,
                total_revenue: totalRevenue,
                monthly_revenue: monthlyRevenue,
                total_hosts: totalHosts,
                total_renters: totalRenters,
                pending_verifications: pendingVerifications,
                disputed_bookings: disputedBookings,
                calculated_at: new Date().toISOString(),
            };

            console.log('Final stats data:', statsData);
            setStats(statsData);

            // Fetch additional admin data
            await fetchAdminDetails(supabase);
        } catch (error) {
            console.error('Error fetching admin stats:', error);
            setError('Failed to load statistics data.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAdminDetails = async (supabase: any) => {
        try {
            // Fetch recent transactions
            const { data: transactions, error: transactionError } = await supabase
                .from('bookings')
                .select(
                    `
                    id,
                    total_amount,
                    status,
                    created_at,
                    start_date,
                    end_date,
                    renter:user_profiles!bookings_renter_id_fkey(full_name),
                    host:user_profiles!bookings_host_id_fkey(full_name),
                    car:cars!bookings_car_id_fkey(make, model)
                `,
                )
                .order('created_at', { ascending: false })
                .limit(10);

            if (!transactionError && transactions) {
                const processedTransactions = transactions.map((booking: any) => ({
                    id: booking.id,
                    total_amount: booking.total_amount,
                    status: booking.status,
                    created_at: booking.created_at,
                    start_date: booking.start_date,
                    end_date: booking.end_date,
                    renter_name: booking.renter?.full_name || 'Unknown Renter',
                    host_name: booking.host?.full_name || 'Unknown Host',
                    car_name: booking.car
                        ? `${booking.car.make} ${booking.car.model}`
                        : 'Unknown Car',
                }));
                setRecentTransactions(processedTransactions);
            }

            // Fetch pending items
            const pendingPromises = await Promise.allSettled([
                // Pending car approvals
                supabase
                    .from('cars')
                    .select(
                        `
                        id,
                        make,
                        model,
                        created_at,
                        host:user_profiles!cars_host_id_fkey(full_name)
                    `,
                    )
                    .eq('status', 'PENDING_APPROVAL')
                    .order('created_at', { ascending: true })
                    .limit(5),

                // Pending verifications
                supabase
                    .from('user_verifications')
                    .select(
                        `
                        id,
                        verification_type,
                        created_at,
                        user:user_profiles!user_verifications_user_id_fkey(full_name)
                    `,
                    )
                    .eq('status', 'PENDING')
                    .order('created_at', { ascending: true })
                    .limit(5),

                // Disputed bookings
                supabase
                    .from('bookings')
                    .select(
                        `
                        id,
                        created_at,
                        renter:user_profiles!bookings_renter_id_fkey(full_name),
                        host:user_profiles!bookings_host_id_fkey(full_name),
                        car:cars!bookings_car_id_fkey(make, model)
                    `,
                    )
                    .eq('status', 'DISPUTED')
                    .order('created_at', { ascending: true })
                    .limit(5),
            ]);

            const allPendingItems: PendingItem[] = [];

            // Process car approvals
            if (pendingPromises[0].status === 'fulfilled' && pendingPromises[0].value.data) {
                pendingPromises[0].value.data.forEach((car: any) => {
                    allPendingItems.push({
                        id: car.id,
                        type: 'car_approval',
                        title: `Car Approval: ${car.make} ${car.model}`,
                        description: `Host: ${car.host?.full_name || 'Unknown'}`,
                        created_at: car.created_at,
                        priority: 'medium',
                    });
                });
            }

            // Process verifications
            if (pendingPromises[1].status === 'fulfilled' && pendingPromises[1].value.data) {
                pendingPromises[1].value.data.forEach((verification: any) => {
                    allPendingItems.push({
                        id: verification.id,
                        type: 'verification',
                        title: `${verification.verification_type} Verification`,
                        description: `User: ${verification.user?.full_name || 'Unknown'}`,
                        created_at: verification.created_at,
                        priority: 'high',
                    });
                });
            }

            // Process disputes
            if (pendingPromises[2].status === 'fulfilled' && pendingPromises[2].value.data) {
                pendingPromises[2].value.data.forEach((booking: any) => {
                    allPendingItems.push({
                        id: booking.id,
                        type: 'dispute',
                        title: `Booking Dispute`,
                        description: `${booking.renter?.full_name || 'Unknown'} vs ${booking.host?.full_name || 'Unknown'}`,
                        created_at: booking.created_at,
                        priority: 'high',
                    });
                });
            }

            // Sort by priority and date
            allPendingItems.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            setPendingItems(allPendingItems.slice(0, 10));
        } catch (error) {
            console.error('Error fetching admin details:', error);
        }
    };

    const handleLogout = async () => {
        try {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading statistics data...</p>
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
                        onClick={fetchAdminStats}
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <h1 className="text-2xl font-bold text-black">REBIL - Admin</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/profile"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Profile
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Dashboard Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-black mb-2">
                                Management Dashboard
                            </h2>
                            <p className="text-gray-600">
                                View the entire platform status at a glance
                            </p>
                        </div>
                        {stats?.calculated_at && (
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Last Updated</p>
                                <p className="text-sm font-medium text-gray-700">
                                    {new Date(stats.calculated_at).toLocaleString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Users */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Users</p>
                                <p className="text-3xl font-bold text-black">
                                    {stats?.total_users || 0}
                                </p>
                            </div>
                            <div className="text-4xl">👥</div>
                        </div>
                    </div>

                    {/* Total Cars */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">
                                    Registered Vehicles
                                </p>
                                <p className="text-3xl font-bold text-black">
                                    {stats?.total_cars || 0}
                                </p>
                                <p className="text-sm text-green-600">
                                    Active: {stats?.active_cars || 0}
                                </p>
                            </div>
                            <div className="text-4xl">🚗</div>
                        </div>
                    </div>

                    {/* Total Bookings */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                                <p className="text-3xl font-bold text-black">
                                    {stats?.total_bookings || 0}
                                </p>
                                <p className="text-sm text-green-600">
                                    Completed: {stats?.completed_bookings || 0}
                                </p>
                            </div>
                            <div className="text-4xl">📅</div>
                        </div>
                    </div>

                    {/* Total Revenue */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                                <p className="text-3xl font-bold text-black">
                                    {formatCurrency(stats?.total_revenue || 0)}
                                </p>
                                <p className="text-sm text-green-600">
                                    Monthly: {formatCurrency(stats?.monthly_revenue || 0)}
                                </p>
                            </div>
                            <div className="text-4xl">💰</div>
                        </div>
                    </div>
                </div>

                {/* Transaction Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-bold text-black mb-4">Payment Status</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Completed Payments</span>
                                <span className="font-semibold text-green-600">
                                    {stats
                                        ? Math.round(
                                              (stats.completed_bookings /
                                                  Math.max(stats.total_bookings, 1)) *
                                                  100,
                                          )
                                        : 0}
                                    %
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Active Vehicles</span>
                                <span className="font-semibold text-blue-600">
                                    {stats
                                        ? Math.round(
                                              (stats.active_cars / Math.max(stats.total_cars, 1)) *
                                                  100,
                                          )
                                        : 0}
                                    %
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Avg Revenue/Booking</span>
                                <span className="font-semibold text-purple-600">
                                    {stats && stats.completed_bookings > 0
                                        ? formatCurrency(
                                              Math.round(
                                                  stats.total_revenue / stats.completed_bookings,
                                              ),
                                          )
                                        : formatCurrency(0)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-bold text-black mb-4">Growth Indicators</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">
                                    Monthly Revenue Growth
                                </span>
                                <span className="font-semibold text-green-600">
                                    {stats && stats.total_revenue > 0
                                        ? `${Math.round((stats.monthly_revenue / Math.max(stats.total_revenue, 1)) * 100)}%`
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Host Engagement</span>
                                <span className="font-semibold text-blue-600">
                                    {stats && stats.total_hosts > 0
                                        ? `${Math.round((stats.active_cars / Math.max(stats.total_hosts, 1)) * 10) / 10} cars/host`
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Platform Utilization</span>
                                <span className="font-semibold text-purple-600">
                                    {stats && stats.total_cars > 0
                                        ? `${Math.round((stats.total_bookings / Math.max(stats.total_cars, 1)) * 10) / 10} bookings/car`
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-bold text-black mb-4">Platform Health</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Completion Rate</span>
                                <div className="flex items-center">
                                    <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                                        <div
                                            className="bg-green-600 h-2 rounded-full"
                                            style={{
                                                width: `${stats ? Math.round((stats.completed_bookings / Math.max(stats.total_bookings, 1)) * 100) : 0}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <span className="text-sm font-semibold text-green-600">
                                        {stats
                                            ? Math.round(
                                                  (stats.completed_bookings /
                                                      Math.max(stats.total_bookings, 1)) *
                                                      100,
                                              )
                                            : 0}
                                        %
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Dispute Rate</span>
                                <div className="flex items-center">
                                    <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                                        <div
                                            className="bg-red-600 h-2 rounded-full"
                                            style={{
                                                width: `${stats ? Math.min((stats.disputed_bookings / Math.max(stats.total_bookings, 1)) * 100, 100) : 0}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <span className="text-sm font-semibold text-red-600">
                                        {stats
                                            ? Math.round(
                                                  (stats.disputed_bookings /
                                                      Math.max(stats.total_bookings, 1)) *
                                                      100 *
                                                      10,
                                              ) / 10
                                            : 0}
                                        %
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Verification Pending</span>
                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        (stats?.pending_verifications || 0) > 10
                                            ? 'bg-red-100 text-red-800'
                                            : (stats?.pending_verifications || 0) > 5
                                              ? 'bg-yellow-100 text-yellow-800'
                                              : 'bg-green-100 text-green-800'
                                    }`}
                                >
                                    {stats?.pending_verifications || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Role Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-black mb-4">
                            User Role Distribution
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Hosts</span>
                                <div className="flex items-center">
                                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-4">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full"
                                            style={{
                                                width: `${((stats?.total_hosts || 0) / (stats?.total_users || 1)) * 100}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <span className="font-semibold">{stats?.total_hosts || 0}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Renters</span>
                                <div className="flex items-center">
                                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-4">
                                        <div
                                            className="bg-green-600 h-2 rounded-full"
                                            style={{
                                                width: `${((stats?.total_renters || 0) / (stats?.total_users || 1)) * 100}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <span className="font-semibold">
                                        {stats?.total_renters || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-black mb-4">Management Status</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Pending Verifications</span>
                                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                                    {stats?.pending_verifications || 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Disputed Bookings</span>
                                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                                    {stats?.disputed_bookings || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Transactions and Pending Items */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Recent Transactions */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-black mb-4">Recent Transactions</h3>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {recentTransactions.length > 0 ? (
                                recentTransactions.map((transaction) => {
                                    const getStatusColor = (status: string) => {
                                        switch (status) {
                                            case 'COMPLETED':
                                                return 'bg-green-100 text-green-800';
                                            case 'CONFIRMED':
                                            case 'AUTO_APPROVED':
                                                return 'bg-blue-100 text-blue-800';
                                            case 'IN_PROGRESS':
                                                return 'bg-yellow-100 text-yellow-800';
                                            case 'CANCELLED':
                                            case 'DISPUTED':
                                                return 'bg-red-100 text-red-800';
                                            default:
                                                return 'bg-gray-100 text-gray-800';
                                        }
                                    };

                                    return (
                                        <div
                                            key={transaction.id}
                                            className="bg-gray-50 rounded-lg p-4 border"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <p className="font-medium text-black text-sm">
                                                        🚗 {transaction.car_name}
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        👤 {transaction.renter_name} →{' '}
                                                        {transaction.host_name}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(transaction.status)}`}
                                                >
                                                    {transaction.status}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-1">
                                                <div>
                                                    📅{' '}
                                                    {new Date(
                                                        transaction.start_date,
                                                    ).toLocaleDateString('ko-KR')}
                                                </div>
                                                <div>
                                                    📅{' '}
                                                    {new Date(
                                                        transaction.end_date,
                                                    ).toLocaleDateString('ko-KR')}
                                                </div>
                                                <div>
                                                    💰 {formatCurrency(transaction.total_amount)}
                                                </div>
                                                <div>
                                                    ⏰{' '}
                                                    {new Date(
                                                        transaction.created_at,
                                                    ).toLocaleDateString('ko-KR')}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">📊</div>
                                    <p className="text-gray-600">No recent transactions</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pending Management Items */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-xl font-bold text-black mb-4">Pending Management</h3>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {pendingItems.length > 0 ? (
                                pendingItems.map((item) => {
                                    const getPriorityColor = (priority: string) => {
                                        switch (priority) {
                                            case 'high':
                                                return 'bg-red-100 text-red-800 border-red-200';
                                            case 'medium':
                                                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                            case 'low':
                                                return 'bg-green-100 text-green-800 border-green-200';
                                            default:
                                                return 'bg-gray-100 text-gray-800 border-gray-200';
                                        }
                                    };

                                    const getTypeIcon = (type: string) => {
                                        switch (type) {
                                            case 'car_approval':
                                                return '🚗';
                                            case 'verification':
                                                return '📋';
                                            case 'dispute':
                                                return '⚖️';
                                            default:
                                                return '📄';
                                        }
                                    };

                                    const daysSince = Math.floor(
                                        (new Date().getTime() -
                                            new Date(item.created_at).getTime()) /
                                            (1000 * 60 * 60 * 24),
                                    );

                                    return (
                                        <div
                                            key={`${item.type}-${item.id}`}
                                            className={`rounded-lg p-4 border ${getPriorityColor(item.priority)}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">
                                                        {getTypeIcon(item.type)} {item.title}
                                                    </p>
                                                    <p className="text-xs opacity-80">
                                                        {item.description}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-semibold uppercase">
                                                    {item.priority}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center text-xs">
                                                <span className="opacity-70">
                                                    {daysSince === 0
                                                        ? 'Today'
                                                        : daysSince === 1
                                                          ? '1 day ago'
                                                          : `${daysSince} days ago`}
                                                </span>
                                                <button className="text-blue-600 hover:text-blue-800 font-medium">
                                                    {item.type === 'car_approval'
                                                        ? 'Review'
                                                        : item.type === 'verification'
                                                          ? 'Verify'
                                                          : 'Resolve'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">✅</div>
                                    <p className="text-gray-600">No pending items</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        All management tasks are up to date
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-black mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <button className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors text-center">
                            <div className="text-2xl mb-2">📋</div>
                            <span className="text-sm font-medium">User Management</span>
                        </button>
                        <Link
                            href="/admin/vehicle-approvals"
                            className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors text-center block"
                        >
                            <div className="text-2xl mb-2">🚙</div>
                            <span className="text-sm font-medium">Vehicle Approval</span>
                        </Link>
                        <button className="bg-yellow-600 text-white p-4 rounded-lg hover:bg-yellow-700 transition-colors text-center">
                            <div className="text-2xl mb-2">⚖️</div>
                            <span className="text-sm font-medium">Dispute Resolution</span>
                        </button>
                        <button className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition-colors text-center">
                            <div className="text-2xl mb-2">📊</div>
                            <span className="text-sm font-medium">Detailed Reports</span>
                        </button>
                    </div>
                </div>

                {/* Last Updated */}
                {stats?.calculated_at && (
                    <div className="mt-6 text-center text-gray-500 text-sm">
                        Last updated: {new Date(stats.calculated_at).toLocaleString('ko-KR')}
                    </div>
                )}
            </div>
        </div>
    );
}
