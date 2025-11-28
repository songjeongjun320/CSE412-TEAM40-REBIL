'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';

interface AvailabilityData {
    totalCars: number;
    availableNow: number;
    availableSoon: number; // Available within next 3 days
    bookedToday: number;
    newThisWeek: number;
    topTypes: Array<{
        type: string;
        count: number;
        percentage: number;
    }>;
}

interface AvailabilityStatusProps {
    canRent: boolean;
    onViewAll: () => void;
}

export function AvailabilityStatus({ canRent, onViewAll }: AvailabilityStatusProps) {
    const [availability, setAvailability] = useState<AvailabilityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    useEffect(() => {
        if (canRent) {
            fetchAvailabilityData();

            // Refresh data every 5 minutes
            const interval = setInterval(fetchAvailabilityData, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [canRent]);

    const fetchAvailabilityData = async () => {
        try {
            setLoading(true);
            const supabase = createClient();
            const now = new Date();
            const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Get all active cars
            const { data: allCars } = await supabase
                .from('cars')
                .select('id, make, model, created_at')
                .eq('status', 'ACTIVE');

            // Get cars that are currently booked
            const { data: currentBookings } = await supabase
                .from('bookings')
                .select('car_id')
                .lte('start_date', now.toISOString())
                .gte('end_date', now.toISOString())
                .in('status', ['CONFIRMED', 'IN_PROGRESS']);

            // Get cars that will be available soon (bookings ending within 3 days)
            const { data: upcomingAvailable } = await supabase
                .from('bookings')
                .select('car_id')
                .lte('end_date', threeDaysFromNow.toISOString())
                .gte('end_date', now.toISOString())
                .in('status', ['CONFIRMED', 'IN_PROGRESS']);

            // Get today's bookings
            const { data: todayBookings } = await supabase
                .from('bookings')
                .select('id')
                .gte('created_at', today.toISOString())
                .in('status', ['CONFIRMED', 'PENDING']);

            if (allCars) {
                const currentlyBookedIds = new Set(currentBookings?.map((b) => b.car_id) || []);
                const upcomingAvailableIds = new Set(upcomingAvailable?.map((b) => b.car_id) || []);

                const availableNow = allCars.filter(
                    (car) => !currentlyBookedIds.has(car.id),
                ).length;
                const availableSoon = Array.from(upcomingAvailableIds).filter((carId) =>
                    currentlyBookedIds.has(carId),
                ).length;

                const newThisWeek = allCars.filter(
                    (car) => new Date(car.created_at) >= oneWeekAgo,
                ).length;

                // Calculate car make distribution
                const makeCount = new Map<string, number>();
                allCars.forEach((car) => {
                    const make = car.make || 'Unknown';
                    makeCount.set(make, (makeCount.get(make) || 0) + 1);
                });

                const totalCars = allCars.length;
                const topTypes = Array.from(makeCount.entries())
                    .map(([make, count]) => ({
                        type: make,
                        count,
                        percentage: Math.round((count / totalCars) * 100),
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 4);

                setAvailability({
                    totalCars,
                    availableNow,
                    availableSoon,
                    bookedToday: todayBookings?.length || 0,
                    newThisWeek,
                    topTypes,
                });

                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error('Error fetching availability data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getAvailabilityColor = (available: number, total: number) => {
        const percentage = (available / total) * 100;
        if (percentage >= 70) return 'text-black bg-gray-100';
        if (percentage >= 40) return 'text-gray-700 bg-gray-100';
        return 'text-red-600 bg-red-100';
    };

    const getTypeIcon = (type: string) => {
        const icons: { [key: string]: string } = {
            Sedan: '🚗',
            SUV: '🚙',
            Compact: '🚙',
            Luxury: '🏎️',
            Electric: '⚡',
            Hybrid: '🌱',
            Unknown: '🚗',
        };
        return icons[type] || '🚗';
    };

    if (!canRent || loading) {
        return (
            <section className="py-6 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
                        <div className="h-6 bg-gray-200 rounded mb-4 w-48"></div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="text-center">
                                    <div className="h-8 bg-gray-200 rounded mb-2"></div>
                                    <div className="h-4 bg-gray-200 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (!availability) return null;

    return (
        <section className="py-6 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-black to-gray-800 text-white p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold mb-1">Real-time Availability</h3>
                                <p className="text-gray-300 text-sm">
                                    Last updated: {lastUpdated.toLocaleTimeString()}
                                </p>
                            </div>
                            <button
                                onClick={fetchAvailabilityData}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                                title="Refresh data"
                            >
                                <motion.div
                                    whileHover={{ rotate: 180 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    🔄
                                </motion.div>
                            </button>
                        </div>
                    </div>

                    {/* Main Stats */}
                    <div className="p-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                            {/* Available Now */}
                            <div className="text-center">
                                <div
                                    className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${getAvailabilityColor(availability.availableNow, availability.totalCars)}`}
                                >
                                    <span className="text-xl">🚗</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {availability.availableNow}
                                </div>
                                <div className="text-sm text-gray-600">Available Now</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {Math.round(
                                        (availability.availableNow / availability.totalCars) * 100,
                                    )}
                                    % of fleet
                                </div>
                            </div>

                            {/* Available Soon */}
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-2">
                                    <span className="text-xl">⏰</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {availability.availableSoon}
                                </div>
                                <div className="text-sm text-gray-600">Available Soon</div>
                                <div className="text-xs text-gray-500 mt-1">Next 3 days</div>
                            </div>

                            {/* Booked Today */}
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
                                    <span className="text-xl">📅</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {availability.bookedToday}
                                </div>
                                <div className="text-sm text-gray-600">Booked Today</div>
                                <div className="text-xs text-gray-500 mt-1">Active bookings</div>
                            </div>

                            {/* New This Week */}
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-2">
                                    <span className="text-xl">✨</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {availability.newThisWeek}
                                </div>
                                <div className="text-sm text-gray-600">New This Week</div>
                                <div className="text-xs text-gray-500 mt-1">Fresh additions</div>
                            </div>
                        </div>

                        {/* Car Types Distribution */}
                        <div className="border-t border-gray-200 pt-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">
                                Available Car Types
                            </h4>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {availability.topTypes.map((type, index) => (
                                    <motion.div
                                        key={type.type}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-gray-50 rounded-lg p-4 text-center hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="text-2xl mb-2">
                                            {getTypeIcon(type.type)}
                                        </div>
                                        <div className="font-semibold text-gray-900">
                                            {type.count}
                                        </div>
                                        <div className="text-sm text-gray-600">{type.type}</div>
                                        <div className="text-xs text-gray-500">
                                            {type.percentage}% of fleet
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="border-t border-gray-200 pt-6 mt-6">
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button
                                    onClick={onViewAll}
                                    className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-black to-gray-800 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                                >
                                    View All Available Cars
                                </button>

                                <button
                                    onClick={() =>
                                        (window.location.href =
                                            '/search?startDate=' +
                                            new Date().toISOString().split('T')[0])
                                    }
                                    className="flex-1 sm:flex-none px-6 py-3 bg-white border-2 border-black text-black font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Search with Dates
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
