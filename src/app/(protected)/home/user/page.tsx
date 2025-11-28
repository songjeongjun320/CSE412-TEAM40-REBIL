'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';
import { formatDailyRate } from '@/lib/utils';

export default function UserHomePage() {
    const router = useRouter();
    const [searchLocation, setSearchLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedFilters, setSelectedFilters] = useState({
        priceRange: '',
        carType: '',
        transmission: '',
        fuelType: '',
    });

    const popularCities = [
        'Seoul',
        'Busan',
        'Incheon',
        'Daegu',
        'Daejeon',
        'Gwangju',
        'Suwon',
        'Ulsan',
        'Seongnam',
        'Bucheon',
    ];

    const carTypes = ['Sedan', 'SUV', 'Compact', 'Luxury', 'Electric', 'Hybrid'];
    const transmissionTypes = ['Automatic', 'Manual'];
    const fuelTypes = ['Gasoline', 'Diesel', 'Electric', 'Hybrid'];

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <h1 className="text-2xl font-bold text-black">REBIL</h1>
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

            {/* Hero Section with Search */}
            <section className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-8">
                        <h2 className="text-4xl font-bold text-black mb-4">
                            Find Your Perfect Car
                        </h2>
                        <p className="text-xl text-gray-600">
                            Rent cars from locals or earn money by sharing your vehicle
                        </p>
                    </div>

                    {/* Search Form */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Where are you going?
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter city or location"
                                    value={searchLocation}
                                    onChange={(e) => setSearchLocation(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black bg-white"
                                />
                            </div>

                            {/* Start Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pick-up Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black bg-white"
                                />
                            </div>

                            {/* End Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Return Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black bg-white"
                                />
                            </div>

                            {/* Search Button */}
                            <div className="flex items-end">
                                <button className="w-full bg-black text-white py-2 px-6 rounded-lg font-semibold hover:bg-gray-900 transition-colors">
                                    Search Cars
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Popular Cities */}
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-black mb-4">Popular Cities</h3>
                        <div className="flex flex-wrap gap-2">
                            {popularCities.map((city) => (
                                <button
                                    key={city}
                                    onClick={() => setSearchLocation(city)}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                >
                                    {city}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Filters Section */}
            <section className="bg-white py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <h3 className="text-lg font-semibold text-black mb-6">Filter Cars</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Price Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Price Range
                            </label>
                            <select
                                value={selectedFilters.priceRange}
                                onChange={(e) => handleFilterChange('priceRange', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black bg-white"
                            >
                                <option value="">Any Price</option>
                                <option value="0-50">Rp 0 - Rp 775,000/day</option>
                                <option value="50-100">Rp 775,000 - Rp 1,550,000/day</option>
                                <option value="100-200">Rp 1,550,000 - Rp 3,100,000/day</option>
                                <option value="200+">Rp 3,100,000+/day</option>
                            </select>
                        </div>

                        {/* Car Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Car Type
                            </label>
                            <select
                                value={selectedFilters.carType}
                                onChange={(e) => handleFilterChange('carType', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black bg-white"
                            >
                                <option value="">Any Type</option>
                                {carTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Transmission */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Transmission
                            </label>
                            <select
                                value={selectedFilters.transmission}
                                onChange={(e) => handleFilterChange('transmission', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black bg-white"
                            >
                                <option value="">Any Transmission</option>
                                {transmissionTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Fuel Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fuel Type
                            </label>
                            <select
                                value={selectedFilters.fuelType}
                                onChange={(e) => handleFilterChange('fuelType', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black bg-white"
                            >
                                <option value="">Any Fuel Type</option>
                                {fuelTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* Host Your Car Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-gradient-to-r from-black to-gray-800 rounded-2xl p-8 text-white">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                            <div>
                                <h3 className="text-3xl font-bold mb-4">
                                    Earn Money with Your Car
                                </h3>
                                <p className="text-xl mb-6">
                                    Turn your unused vehicle into a source of income. Join thousands
                                    of hosts earning extra money.
                                </p>
                                <button className="bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                                    Become a Host
                                </button>
                            </div>
                            <div className="text-center">
                                <div className="text-6xl mb-4">💰</div>
                                <p className="text-lg">Average earnings: Rp 7,750,000/month</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Cars Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <h3 className="text-2xl font-bold text-black mb-8">Featured Cars</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Sample Car Cards */}
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                            >
                                <div className="h-48 bg-gray-200 flex items-center justify-center">
                                    <span className="text-4xl">🚗</span>
                                </div>
                                <div className="p-6">
                                    <h4 className="text-lg font-semibold text-black mb-2">
                                        {i === 1
                                            ? 'Toyota Camry'
                                            : i === 2
                                              ? 'Honda CR-V'
                                              : 'Tesla Model 3'}
                                    </h4>
                                    <p className="text-gray-600 mb-4">
                                        {i === 1
                                            ? 'Comfortable sedan for city driving'
                                            : i === 2
                                              ? 'Spacious SUV for family trips'
                                              : 'Electric car for eco-friendly travel'}
                                    </p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-2xl font-bold text-black">
                                            {formatDailyRate(
                                                i === 1 ? 675000 : i === 2 ? 975000 : 1275000,
                                            )}
                                        </span>
                                        <button className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors">
                                            Book Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
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
        </div>
    );
}
