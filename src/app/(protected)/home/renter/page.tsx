'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { IndonesianAddress } from '@/components/address';
import { MessageNotification } from '@/components/messages/MessageNotification';
import { EnhancedSearch } from '@/components/renter/EnhancedSearch';
import { NewCarBanner } from '@/components/renter/NewCarBanner';
import { SmartRecommendations } from '@/components/renter/SmartRecommendations';
import { TrendingLocations } from '@/components/renter/TrendingLocations';
import { VehicleCard } from '@/components/renter/VehicleCard';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { ToastContainer } from '@/components/ui/Toast';
import { useAutoFetchHostsInfo } from '@/hooks/useHostsInfo';
import { useRenterNotifications } from '@/hooks/useRenterNotifications';
import { useToast } from '@/hooks/useToast';
import { canUserRent, getCurrentUserRoles } from '@/lib/auth/userRoles';
import { createClient } from '@/lib/supabase/supabaseClient';
import { FlexibleLocationResult } from '@/lib/utils/indonesianAddressService';
import { Tables } from '@/types/base/database.types';

type Car = Tables<'cars'>;
type CarImage = Tables<'car_images'>;
type UserRoles = {
    isAdmin: boolean;
    isHost: boolean;
    isRenter: boolean;
    roles: string[];
};

type FeaturedCar = Car & {
    car_images: CarImage[];
};

export default function RenterHomePage() {
    const router = useRouter();
    const [recentlyApprovedCars, setRecentlyApprovedCars] = useState<FeaturedCar[]>([]);
    const [searchLocation, setSearchLocation] = useState('');
    const [selectedAddress, setSelectedAddress] = useState<IndonesianAddress | null>(null);
    const [selectedFlexibleLocation, setSelectedFlexibleLocation] =
        useState<FlexibleLocationResult | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedFilters, setSelectedFilters] = useState({
        priceRange: '',
        carType: '',
        transmission: '',
        fuelType: '',
    });
    const [canRent, setCanRent] = useState(true);
    const [userRoles, setUserRoles] = useState<UserRoles | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Message-related states
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    // Popular cities for search suggestions
    const popularCities = [
        'Jakarta',
        'Surabaya',
        'Bandung',
        'Medan',
        'Semarang',
        'Yogyakarta',
        'Denpasar',
        'Makassar',
        'Palembang',
        'Manado',
    ];

    // Custom hooks
    const { toasts, addToast, dismissToast } = useToast();
    const { newlyAvailableCars, clearNewCarNotification, clearAllNewCars } =
        useRenterNotifications();

    // Batch fetch host information for all cars to eliminate redundant API calls
    const allCars = [...recentlyApprovedCars];
    const { getHostInfo } = useAutoFetchHostsInfo(allCars);

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

    // Fetch recently approved cars (must be declared before fetchRenterData)
    const fetchRecentlyApprovedCars = useCallback(async () => {
        try {
            const supabase = createClient();

            // Get cars approved in the last 48 hours
            const fortyEightHoursAgo = new Date();
            fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

            const { data: cars, error } = await supabase
                .from('cars')
                .select(
                    `
          *,
          car_images(*)
        `,
                )
                .eq('status', 'ACTIVE')
                .gte('updated_at', fortyEightHoursAgo.toISOString())
                .order('updated_at', { ascending: false })
                .limit(8);

            if (error) {
                console.error('Failed to fetch recently approved cars:', error);
            } else {
                setRecentlyApprovedCars(cars || []);
            }
        } catch (error) {
            console.error('Error fetching recently approved cars:', error);
        }
    }, []);

    const fetchRenterData = useCallback(async () => {
        try {
            const supabase = createClient();

            // Get current user information
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                console.error('Failed to get user:', userError);
                return;
            }

            // Check user roles
            const roles = await getCurrentUserRoles();
            setUserRoles(roles);

            if (roles) {
                setCanRent(canUserRent(roles));
            }

            // Fetch cars data
            await fetchRecentlyApprovedCars();
        } catch (error) {
            console.error('Error fetching renter data:', error);
            addToast({
                type: 'error',
                title: 'Error loading data',
                description: 'Failed to load renter dashboard. Please refresh the page.',
            });
        }
    }, [addToast, fetchRecentlyApprovedCars]);

    const refreshRecentlyApprovedCars = useCallback(async () => {
        setRefreshing(true);
        await fetchRecentlyApprovedCars();
        setRefreshing(false);
    }, [fetchRecentlyApprovedCars]);

    useEffect(() => {
        fetchRenterData();
        fetchUnreadMessageCount();
    }, [fetchRenterData, fetchUnreadMessageCount]);

    // Auto-refresh featured cars when new cars are available
    useEffect(() => {
        if (newlyAvailableCars.length > 0) {
            refreshRecentlyApprovedCars();
        }
    }, [newlyAvailableCars, refreshRecentlyApprovedCars]);

    const handleFilterChange = (filterType: string, value: string) => {
        setSelectedFilters((prev) => ({
            ...prev,
            [filterType]: value,
        }));
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

    const handleAddressChange = (address: IndonesianAddress) => {
        setSelectedAddress(address);
        // Also update searchLocation for backward compatibility
        const locationParts = [];
        if (address.village) locationParts.push(address.village);
        if (address.district) locationParts.push(address.district);
        setSearchLocation(locationParts.join(', '));
    };

    const handleSearch = () => {
        if (!canRent) return;

        const params = new URLSearchParams();

        // Priority: flexible location > detailed address > simple location
        if (selectedFlexibleLocation) {
            // Use city name for Google Maps integration instead of IDs
            params.append('cityName', selectedFlexibleLocation.name);
            if (selectedFlexibleLocation.hierarchy.regency?.code) {
                params.append('cityCode', selectedFlexibleLocation.hierarchy.regency.code);
            }
            if (selectedFlexibleLocation.hierarchy.province?.name) {
                params.append('provinceName', selectedFlexibleLocation.hierarchy.province.name);
            }
        } else if (selectedAddress) {
            // Fallback to legacy address structure - convert IDs to names if needed
            if (selectedAddress.city_id) params.append('cityId', selectedAddress.city_id);
            if (selectedAddress.province_id)
                params.append('provinceId', selectedAddress.province_id);
            if (selectedAddress.district_id)
                params.append('districtId', selectedAddress.district_id);
            if (selectedAddress.village_id) params.append('villageId', selectedAddress.village_id);
        } else if (searchLocation) {
            params.append('location', searchLocation);
        }

        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (selectedFilters.priceRange) params.append('priceRange', selectedFilters.priceRange);
        if (selectedFilters.carType) params.append('carType', selectedFilters.carType);
        if (selectedFilters.transmission)
            params.append('transmission', selectedFilters.transmission);
        if (selectedFilters.fuelType) params.append('fuelType', selectedFilters.fuelType);

        // Redirect to search-with-map if location is provided, otherwise to regular search
        const hasLocation = selectedFlexibleLocation || selectedAddress || searchLocation;
        const targetRoute = hasLocation ? '/search-with-map' : '/search';
        router.push(`${targetRoute}?${params.toString()}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <h1 className="text-2xl font-bold text-black">REBIL</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <LanguageSwitcher variant="compact" />
                            <Link
                                href="/bookings"
                                className="text-gray-700 hover:text-black transition-colors cursor-pointer"
                            >
                                My Bookings
                            </Link>
                            <Link
                                href="/renter/reviews"
                                className="text-gray-700 hover:text-black transition-colors cursor-pointer"
                            >
                                My Reviews
                            </Link>
                            <MessageNotification
                                unreadCount={unreadMessageCount}
                                onClick={() => router.push('/messages')}
                            />
                            <Link
                                href="/profile"
                                className="text-gray-700 hover:text-black transition-colors cursor-pointer"
                            >
                                Profile
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="text-gray-700 hover:text-black transition-colors cursor-pointer"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* New car availability banner */}
            <NewCarBanner
                newCars={newlyAvailableCars}
                onDismiss={clearNewCarNotification}
                onDismissAll={clearAllNewCars}
                canRent={canRent}
            />

            {/* HOST Restriction Notice */}
            {userRoles?.isHost && !canRent && (
                <section className="py-6 px-4 sm:px-6 lg:px-8 bg-yellow-50 border-b border-yellow-200">
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded-lg">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <span className="text-2xl">⚠️</span>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-lg font-medium text-yellow-800">
                                        Hosts cannot rent vehicles
                                    </h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <p>
                                            As a host providing vehicles, you cannot rent other
                                            hosts&apos; vehicles to maintain fairness and service
                                            quality. If you need a vehicle, please use your own
                                            registered vehicle.
                                        </p>
                                    </div>
                                    <div className="mt-4">
                                        <button
                                            onClick={() => router.push('/home/host')}
                                            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm cursor-pointer"
                                        >
                                            Go to Host Dashboard
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Hero Section with Search */}
            <section className="pt-4 pb-2 px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-bold text-black mb-4">Find Your Perfect Car</h2>
                    <p className="text-xl text-gray-600">
                        {canRent
                            ? 'Rent cars from locals in your area'
                            : 'Vehicle rental is only available for users with renter role'}
                    </p>
                </div>

                {/* Enhanced Search Form */}
                <div className="max-w-4xl mx-auto">
                    <EnhancedSearch
                        searchLocation={searchLocation}
                        startDate={startDate}
                        endDate={endDate}
                        selectedFilters={selectedFilters}
                        onLocationChange={setSearchLocation}
                        onAddressChange={handleAddressChange}
                        onFlexibleLocationSelect={setSelectedFlexibleLocation}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                        onFilterChange={handleFilterChange}
                        onSearch={handleSearch}
                        canRent={canRent}
                        popularCities={popularCities}
                        useDetailedAddress={false} // Disable Indonesian address form
                        useFlexibleSearch={true} // Enable flexible search
                    />
                </div>
            </section>

            {/* Recently Approved Cars Section */}
            {recentlyApprovedCars.length > 0 && (
                <section className="pt-2 pb-4 bg-gradient-to-r from-gray-50 to-gray-100">
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3
                                    id="recently-approved"
                                    className="text-2xl font-bold text-gray-900 mb-2"
                                >
                                    🆕 Recently Approved Cars
                                </h3>
                                <p className="text-gray-600">
                                    Fresh additions from the last 48 hours
                                </p>
                            </div>
                            <button
                                onClick={refreshRecentlyApprovedCars}
                                disabled={refreshing}
                                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <motion.div
                                    animate={{ rotate: refreshing ? 360 : 0 }}
                                    transition={{
                                        duration: 1,
                                        repeat: refreshing ? Infinity : 0,
                                        ease: 'linear',
                                    }}
                                >
                                    🔄
                                </motion.div>
                                <span className="text-sm font-medium text-gray-700">
                                    {refreshing ? 'Refreshing...' : 'Refresh'}
                                </span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {recentlyApprovedCars.map((car) => (
                                <VehicleCard
                                    key={car.id}
                                    car={car}
                                    canRent={canRent}
                                    isNew={true}
                                    showWishlist={true}
                                    showRating={true}
                                    hostInfo={getHostInfo(car.host_id)}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Smart Recommendations */}
            <section>
                <SmartRecommendations canRent={canRent} />
            </section>

            {/* Trending Locations */}
            <section>
                <TrendingLocations
                    canRent={canRent}
                    onLocationSelect={(location) => {
                        setSearchLocation(location);
                        // Clear any previously selected flexible location since user is using simple text
                        setSelectedFlexibleLocation(null);
                        handleSearch();
                    }}
                />
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
                <div className="w-full mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div>
                            <h4 className="text-xl font-bold mb-4">REBIL</h4>
                            <p className="text-gray-400">
                                Redefining car rental through peer-to-peer connections.
                            </p>
                        </div>
                        <div>
                            <h5 className="font-semibold mb-4">For Renters</h5>
                            <ul className="space-y-2 text-gray-400">
                                <li>Find Cars</li>
                                <li>How It Works</li>
                                <li>Insurance</li>
                                <li>Support</li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-semibold mb-4">For Hosts</h5>
                            <ul className="space-y-2 text-gray-400">
                                <li>List Your Car</li>
                                <li>Earnings Calculator</li>
                                <li>Host Protection</li>
                                <li>Resources</li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-semibold mb-4">Company</h5>
                            <ul className="space-y-2 text-gray-400">
                                <li>About Us</li>
                                <li>Safety</li>
                                <li>Contact</li>
                                <li>Terms</li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
                        <p>&copy; 2025 REBIL. All rights reserved.</p>
                    </div>
                </div>
            </footer>

            {/* Toast notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
