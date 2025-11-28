'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import ProfileEditModal from '@/components/profile/ProfileEditModal';
import { createClient } from '@/lib/supabase/supabaseClient';
import { Json, Tables } from '@/types/base/database.types';

type RenterStats = Tables<'renter_stats'>;

interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    date_of_birth: string | null;
    profile_image_url: string | null;
    address: Json | null;
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

interface AddressDisplay {
    street_address?: string;
    village?: string;
    district?: string;
    city_id?: string;
    province_id?: string;
    postal_code?: string;
    additional_info?: string;
    city_name?: string;
    province_name?: string;
}

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [stats, setStats] = useState<RenterStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [addressDisplay, setAddressDisplay] = useState<AddressDisplay | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    router.push('/login');
                    return;
                }

                const { data: profileData, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('Error fetching profile:', error);
                } else {
                    setProfile(profileData);

                    // Process address for display
                    if (profileData.address && typeof profileData.address === 'object') {
                        const address = profileData.address as AddressDisplay;
                        if (address.city_id || address.province_id) {
                            // Fetch city and province names
                            fetchAddressDetails(address);
                        } else {
                            setAddressDisplay(address);
                        }
                    }
                }

                // Fetch renter statistics
                const { data: renterStats, error: statsError } = await supabase
                    .from('renter_stats')
                    .select('*')
                    .eq('renter_id', user.id)
                    .single();

                if (statsError && statsError.code !== 'PGRST116') {
                    console.error('Failed to fetch renter stats:', statsError);
                } else if (renterStats) {
                    setStats(renterStats);
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [router]);

    const fetchAddressDetails = async (address: AddressDisplay) => {
        try {
            const supabase = createClient();
            let cityName = '';
            let provinceName = '';

            if (address.city_id) {
                const { data: cityData } = await supabase
                    .from('indonesian_regencies')
                    .select('name, province_id')
                    .eq('id', address.city_id)
                    .single();

                if (cityData) {
                    cityName = cityData.name;

                    // Get province name
                    if (cityData.province_id) {
                        const { data: provinceData } = await supabase
                            .from('indonesian_provinces')
                            .select('name')
                            .eq('id', cityData.province_id)
                            .single();

                        if (provinceData) {
                            provinceName = provinceData.name;
                        }
                    }
                }
            }

            setAddressDisplay({
                ...address,
                city_name: cityName,
                province_name: provinceName,
            });
        } catch (error) {
            console.error('Error fetching address details:', error);
            setAddressDisplay(address);
        }
    };

    const formatAddress = (address: AddressDisplay | null): string => {
        if (!address) return 'Not set';

        const parts: string[] = [];

        if (address.street_address) parts.push(address.street_address);
        if (address.village) parts.push(address.village);
        if (address.district) parts.push(address.district);
        if (address.city_name) parts.push(address.city_name);
        if (address.province_name) parts.push(address.province_name);
        if (address.postal_code) parts.push(address.postal_code);
        if (address.additional_info) parts.push(address.additional_info);

        return parts.length > 0 ? parts.join(', ') : 'Not set';
    };

    const handleProfileUpdate = (updatedProfile: Profile) => {
        setProfile(updatedProfile);

        // Update address display
        if (updatedProfile.address && typeof updatedProfile.address === 'object') {
            const address = updatedProfile.address as AddressDisplay;
            if (address.city_id || address.province_id) {
                fetchAddressDetails(address);
            } else {
                setAddressDisplay(address);
            }
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
                    <p className="text-gray-600">Loading profile...</p>
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
                            <Link
                                href="/home"
                                className="text-2xl font-bold text-black cursor-pointer"
                            >
                                REBIL
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/bookings"
                                className="text-gray-700 hover:text-black transition-colors cursor-pointer"
                            >
                                My Bookings
                            </Link>
                            <Link
                                href="/home"
                                className="text-gray-700 hover:text-black transition-colors cursor-pointer"
                            >
                                Home
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

            {/* Profile Content */}
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h1 className="text-3xl font-bold text-black mb-8">Profile</h1>

                    {profile ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Name
                                    </label>
                                    <p className="text-lg text-black">
                                        {profile.full_name || 'Not set'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email
                                    </label>
                                    <p className="text-lg text-black">{profile.email}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone
                                    </label>
                                    <p className="text-lg text-black">
                                        {profile.phone || 'Not set'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date of Birth
                                    </label>
                                    <p className="text-lg text-black">
                                        {profile.date_of_birth ? profile.date_of_birth : 'Not set'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Address
                                    </label>
                                    <p className="text-lg text-black">
                                        {formatAddress(addressDisplay)}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Member Since
                                    </label>
                                    <p className="text-lg text-black">
                                        {new Date(profile.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Last Updated
                                    </label>
                                    <p className="text-lg text-black">
                                        {new Date(profile.updated_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* My Rental Status Section */}
                            {stats && (
                                <div className="border-t pt-6">
                                    <h2 className="text-xl font-semibold text-black mb-4">
                                        My Rental Status
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                                            <p className="text-2xl font-bold text-black">
                                                {stats.total_bookings}
                                            </p>
                                            <p className="text-sm text-gray-600">Total Bookings</p>
                                        </div>
                                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                                            <p className="text-2xl font-bold text-black">
                                                {stats.completed_bookings}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Completed Bookings
                                            </p>
                                        </div>
                                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                                            <p className="text-2xl font-bold text-black">
                                                ${stats.total_spent.toLocaleString()}
                                            </p>
                                            <p className="text-sm text-gray-600">Total Spent</p>
                                        </div>
                                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                                            <p className="text-2xl font-bold text-black">
                                                {stats.average_rating.toFixed(1)}⭐
                                            </p>
                                            <p className="text-sm text-gray-600">Average Rating</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="border-t pt-6">
                                <h2 className="text-xl font-semibold text-black mb-4">
                                    Account Actions
                                </h2>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setIsEditModalOpen(true)}
                                        className="w-full md:w-auto bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors cursor-pointer"
                                    >
                                        Edit Profile
                                    </button>
                                    <button className="w-full md:w-auto bg-gray-200 text-black px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors ml-0 md:ml-3 cursor-pointer">
                                        Change Password
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600">Profile not found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Edit Modal */}
            {profile && (
                <ProfileEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    profile={profile}
                    onProfileUpdate={handleProfileUpdate}
                />
            )}
        </div>
    );
}
