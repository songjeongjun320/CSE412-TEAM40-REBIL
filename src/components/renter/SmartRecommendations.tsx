'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { useAutoFetchHostsInfo } from '@/hooks/useHostsInfo';
import { createClient } from '@/lib/supabase/supabaseClient';
import { Tables } from '@/types/base/database.types';

import { VehicleCard } from './VehicleCard';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;

type FeaturedCar = Car & {
    car_images: CarImage[];
};

interface SmartRecommendationsProps {
    canRent: boolean;
}

const recommendationTypes = [
    {
        id: 'trending',
        title: 'Trending This Week',
        icon: '📈',
        description: 'Popular choices among renters',
        color: 'from-black to-gray-800',
    },
    {
        id: 'best-value',
        title: 'Best Value Deals',
        icon: '💰',
        description: 'Great cars at affordable prices',
        color: 'from-gray-700 to-gray-900',
    },
    {
        id: 'premium',
        title: 'Premium Selection',
        icon: '👑',
        description: 'Luxury vehicles for special occasions',
        color: 'from-gray-800 to-black',
    },
    {
        id: 'eco-friendly',
        title: 'Eco-Friendly',
        icon: '🌱',
        description: 'Electric and hybrid vehicles',
        color: 'from-gray-600 to-gray-800',
    },
];

export function SmartRecommendations({ canRent }: SmartRecommendationsProps) {
    const [recommendations, setRecommendations] = useState<{
        [key: string]: FeaturedCar[];
    }>({});
    const [activeType, setActiveType] = useState('trending');
    const [loading, setLoading] = useState(true);

    // Batch fetch host information for all recommendation cars
    const activeCars = recommendations[activeType] || [];
    const { getHostInfo } = useAutoFetchHostsInfo(activeCars);

    useEffect(() => {
        if (canRent) {
            fetchRecommendations();
        }
        // Recommendations are based on user preferences and general trends
        // This prevents unnecessary refetches on every search input change
    }, [canRent]);

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            const supabase = createClient();
            const newRecommendations: { [key: string]: FeaturedCar[] } = {};

            // Fetch trending cars (most recently booked/viewed)
            const { data: trendingCars } = await supabase
                .from('cars')
                .select(
                    `
          *,
          car_images(*),
          bookings!inner(count)
        `,
                )
                .eq('status', 'ACTIVE')
                .order('created_at', { ascending: false })
                .limit(8);

            if (trendingCars) {
                newRecommendations.trending = trendingCars;
            }

            // Fetch best value cars (low-medium price range)
            const { data: valueCars } = await supabase
                .from('cars')
                .select(
                    `
          *,
          car_images(*)
        `,
                )
                .eq('status', 'ACTIVE')
                .lte('daily_rate', 100)
                .gte('daily_rate', 25)
                .order('daily_rate', { ascending: true })
                .limit(8);

            if (valueCars) {
                newRecommendations['best-value'] = valueCars;
            }

            // Fetch premium cars (high price or luxury type)
            // Fetch premium cars (high price or luxury type) - using separate queries to avoid OR issues
            const [highPriceCars, luxuryCars] = await Promise.all([
                supabase
                    .from('cars')
                    .select('*, car_images(*)')
                    .eq('status', 'ACTIVE')
                    .gte('daily_rate', 150)
                    .order('daily_rate', { ascending: false })
                    .limit(8),
                supabase
                    .from('cars')
                    .select('*, car_images(*)')
                    .eq('status', 'ACTIVE')
                    .eq('car_type', 'suv')
                    .order('daily_rate', { ascending: false })
                    .limit(8),
            ]);

            // Combine and deduplicate results
            const premiumCars = [...(highPriceCars.data || []), ...(luxuryCars.data || [])];
            const uniquePremiumCars = premiumCars.filter(
                (car, index, self) => index === self.findIndex((c) => c.id === car.id),
            );

            if (uniquePremiumCars.length > 0) {
                newRecommendations.premium = uniquePremiumCars.slice(0, 8);
            }

            // Fetch eco-friendly cars (electric/hybrid fuel types OR ev car type)
            const [electricFuelCars, evTypeCars] = await Promise.all([
                supabase
                    .from('cars')
                    .select('*, car_images(*)')
                    .eq('status', 'ACTIVE')
                    .in('fuel_type', ['ELECTRIC', 'HYBRID'])
                    .order('created_at', { ascending: false })
                    .limit(8),
                supabase
                    .from('cars')
                    .select('*, car_images(*)')
                    .eq('status', 'ACTIVE')
                    .eq('car_type', 'ev')
                    .order('created_at', { ascending: false })
                    .limit(8),
            ]);

            // Combine and deduplicate eco-friendly results
            const ecoCars = [...(electricFuelCars.data || []), ...(evTypeCars.data || [])];
            const uniqueEcoCars = ecoCars.filter(
                (car, index, self) => index === self.findIndex((c) => c.id === car.id),
            );

            if (uniqueEcoCars.length > 0) {
                newRecommendations['eco-friendly'] = uniqueEcoCars.slice(0, 8);
            }

            setRecommendations(newRecommendations);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActiveRecommendation = () => {
        return recommendationTypes.find((type) => type.id === activeType) || recommendationTypes[0];
    };

    if (!canRent) return null;

    return (
        <section className="pt-2 pb-4 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="mx-auto">
                {/* Header */}
                <div className="text-center mb-8"></div>

                {/* Recommendation Type Selector */}
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {recommendationTypes.map((type) => {
                        const isActive = activeType === type.id;
                        const hasData = recommendations[type.id]?.length > 0;

                        return (
                            <button
                                key={type.id}
                                onClick={() => setActiveType(type.id)}
                                disabled={loading || !hasData}
                                className={`relative px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 cursor-pointer ${
                                    isActive
                                        ? `bg-gradient-to-r ${type.color} text-white shadow-lg transform scale-105`
                                        : hasData
                                          ? 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-300'
                                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                <div className="flex items-center space-x-2">
                                    <span className="text-lg">{type.icon}</span>
                                    <div className="text-left">
                                        <div className="font-semibold">{type.title}</div>
                                        <div
                                            className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500'}`}
                                        >
                                            {hasData
                                                ? `${recommendations[type.id]?.length || 0} cars`
                                                : 'No cars'}
                                        </div>
                                    </div>
                                </div>

                                {isActive && (
                                    <motion.div
                                        layoutId="activeIndicator"
                                        className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/10 rounded-xl"
                                        transition={{
                                            type: 'spring',
                                            stiffness: 300,
                                            damping: 30,
                                        }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Active Recommendation Details */}
                {/* <AnimatePresence mode="wait">
                    <motion.div
                        key={activeType}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div
                            className={`bg-gradient-to-r ${getActiveRecommendation().color} rounded-2xl p-6 text-white text-center`}
                        >
                            <div className="text-4xl mb-2">{getActiveRecommendation().icon}</div>
                            <h4 className="text-xl font-bold mb-2">
                                {getActiveRecommendation().title}
                            </h4>
                            <p className="text-white/90">{getActiveRecommendation().description}</p>
                        </div>
                    </motion.div>
                </AnimatePresence> */}

                {/* Cars Grid */}
                <div className="relative">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse"
                                >
                                    <div className="h-48 bg-gray-200"></div>
                                    <div className="p-6">
                                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded mb-4"></div>
                                        <div className="flex justify-between items-center">
                                            <div className="h-6 bg-gray-200 rounded w-20"></div>
                                            <div className="h-8 bg-gray-200 rounded w-24"></div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : activeCars.length > 0 ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeType}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                            >
                                {activeCars.map((car, index) => (
                                    <motion.div
                                        key={car.id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1, duration: 0.5 }}
                                    >
                                        <VehicleCard
                                            car={car}
                                            canRent={canRent}
                                            showWishlist={true}
                                            showRating={true}
                                            hostInfo={getHostInfo(car.host_id)}
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12"
                        >
                            <div className="text-6xl mb-4">🔍</div>
                            <p className="text-gray-600 text-lg mb-2">
                                No {getActiveRecommendation().title.toLowerCase()} available at the
                                moment.
                            </p>
                            <p className="text-gray-500">
                                Try a different recommendation type or check back later!
                            </p>
                        </motion.div>
                    )}
                </div>

                {/* View All Link */}
                {activeCars.length > 0 && (
                    <div className="text-center mt-8">
                        <button
                            onClick={() => {
                                // Navigate to search with filters based on recommendation type
                                const params = new URLSearchParams();
                                if (activeType === 'best-value') {
                                    params.append('priceRange', '0-100');
                                } else if (activeType === 'premium') {
                                    params.append('priceRange', '150-1000');
                                    params.append('carType', 'suv');
                                } else if (activeType === 'eco-friendly') {
                                    params.append('fuelType', 'ELECTRIC');
                                    params.append('carType', 'ev'); // Changed back to 'ev'
                                }
                                window.location.href = `/search?${params.toString()}`;
                            }}
                            className={`inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r ${getActiveRecommendation().color} hover:shadow-lg transform hover:scale-105 transition-all duration-200`}
                        >
                            <span>View All {getActiveRecommendation().title}</span>
                            <span className="ml-2">→</span>
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
