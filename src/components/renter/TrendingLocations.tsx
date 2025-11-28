'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';

interface LocationData {
    city: string;
    availableCars: number;
    averagePrice: number;
    popularType: string;
    bookingCount: number;
}

interface TrendingLocationsProps {
    onLocationSelect: (location: string) => void;
    canRent: boolean;
}

const locationImages = {
    Jakarta: '🏙️',
    Surabaya: '🏢',
    Bandung: '🏔️',
    Medan: '🌴',
    Semarang: '⛵',
    Makassar: '🏖️',
    Palembang: '🌉',
    Tangerang: '🏘️',
    Depok: '🌳',
    Bogor: '🌿',
};

export function TrendingLocations({ onLocationSelect, canRent }: TrendingLocationsProps) {
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (canRent) {
            fetchTrendingLocations();
        }
    }, [canRent]);

    const fetchTrendingLocations = async () => {
        try {
            setLoading(true);
            const supabase = createClient();

            // Get car data grouped by location
            const { data: cars } = await supabase
                .from('cars')
                .select('location, daily_rate, make, model')
                .eq('status', 'ACTIVE');

            // Get booking data for popularity
            const { data: bookings } = await supabase
                .from('bookings')
                .select('pickup_location')
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

            if (cars) {
                // Process data by city
                const locationMap = new Map<
                    string,
                    {
                        cars: typeof cars;
                        bookings: number;
                        totalRate: number;
                        typeCount: Map<string, number>;
                    }
                >();

                // Initialize with popular cities
                Object.keys(locationImages).forEach((city) => {
                    locationMap.set(city, {
                        cars: [],
                        bookings: 0,
                        totalRate: 0,
                        typeCount: new Map(),
                    });
                });

                // Process cars data
                cars.forEach((car) => {
                    const location = car.location;
                    const city =
                        typeof location === 'object' && location !== null
                            ? String(
                                  (location as Record<string, unknown>).city ||
                                      (location as Record<string, unknown>).city_name ||
                                      '',
                              )
                            : '';
                    if (city && locationImages[city as keyof typeof locationImages]) {
                        const locationData = locationMap.get(city);
                        if (locationData) {
                            locationData.cars.push(car);
                            locationData.totalRate += car.daily_rate || 0;

                            const currentCount =
                                locationData.typeCount.get(car.make || 'Unknown') || 0;
                            locationData.typeCount.set(car.make || 'Unknown', currentCount + 1);
                        }
                    }
                });

                // Process bookings data
                bookings?.forEach((booking) => {
                    const pickupLocation = booking.pickup_location;
                    const city =
                        typeof pickupLocation === 'object' && pickupLocation !== null
                            ? String(
                                  (pickupLocation as Record<string, unknown>).city ||
                                      (pickupLocation as Record<string, unknown>).city_name ||
                                      '',
                              )
                            : '';
                    if (city && locationImages[city as keyof typeof locationImages]) {
                        const locationData = locationMap.get(city);
                        if (locationData) {
                            locationData.bookings++;
                        }
                    }
                });

                // Convert to LocationData array
                const processedLocations: LocationData[] = Array.from(locationMap.entries())
                    .map(([city, data]) => {
                        const mostPopularType =
                            Array.from(data.typeCount.entries()).sort(
                                (a, b) => b[1] - a[1],
                            )[0]?.[0] || 'Sedan';

                        return {
                            city,
                            availableCars: data.cars.length,
                            averagePrice:
                                data.cars.length > 0
                                    ? Math.round(data.totalRate / data.cars.length)
                                    : 0,
                            popularType: mostPopularType,
                            bookingCount: data.bookings,
                        };
                    })
                    .filter((location) => location.availableCars > 0) // Only show cities with cars
                    .sort(
                        (a, b) =>
                            b.bookingCount - a.bookingCount || b.availableCars - a.availableCars,
                    ); // Sort by popularity

                setLocations(processedLocations.slice(0, 6)); // Show top 6
            }
        } catch (error) {
            console.error('Error fetching trending locations:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!canRent || loading) {
        return (
            <section className="py-4 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Popular Destinations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="bg-white rounded-xl shadow-md p-6 animate-pulse"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                                    <div className="flex-1">
                                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (locations.length === 0) return null;

    return (
        <section className="py-4 px-4 sm:px-6 lg:px-8 bg-white">
            <div className="mx-auto">
                <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Popular Destinations</h3>
                    <p className="text-gray-600">
                        Explore trending locations with available vehicles
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {locations.map((location, index) => (
                        <motion.button
                            key={location.city}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ y: -5, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onLocationSelect(location.city)}
                            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 text-left group border border-gray-100 hover:border-blue-200 cursor-pointer"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="text-3xl">
                                        {
                                            locationImages[
                                                location.city as keyof typeof locationImages
                                            ]
                                        }
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {location.city}
                                        </h4>
                                        <p className="text-sm text-gray-500">
                                            {location.availableCars} cars available
                                        </p>
                                    </div>
                                </div>

                                {/* Trending indicator */}
                                {location.bookingCount > 5 && (
                                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                        Hot 🔥
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Average Price:</span>
                                    <span className="font-semibold text-gray-900">
                                        Rp {location.averagePrice.toLocaleString()}/day
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Popular Type:</span>
                                    <span className="font-medium text-blue-600">
                                        {location.popularType}
                                    </span>
                                </div>

                                {location.bookingCount > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Recent Bookings:</span>
                                        <span className="font-medium text-green-600">
                                            {location.bookingCount} this month
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Action indicator */}
                            <div className="mt-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="text-blue-600 text-sm font-medium flex items-center space-x-1">
                                    <span>Explore cars in {location.city}</span>
                                    <span>→</span>
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>

                {/* View All Locations */}
                <div className="text-center mt-8">
                    <button
                        onClick={() => {
                            // Navigate to search page
                            window.location.href = '/search';
                        }}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200 cursor-pointer"
                    >
                        <span>Browse All Locations</span>
                        <span className="ml-2">🗺️</span>
                    </button>
                </div>
            </div>
        </section>
    );
}
