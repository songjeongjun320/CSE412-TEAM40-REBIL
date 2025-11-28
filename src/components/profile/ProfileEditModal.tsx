'use client';

import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useState } from 'react';

import { CompactAddressForm } from '@/components/address';
import type { IndonesianAddress } from '@/components/address';
import { Button } from '@/components/ui';
import { createClient } from '@/lib/supabase/supabaseClient';
import { Json } from '@/types/base/database.types';

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

// Indonesian address interface matches the new system
interface LegacyAddress {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
}

interface ProfileEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: Profile;
    onProfileUpdate: (updatedProfile: Profile) => void;
}

export default function ProfileEditModal({
    isOpen,
    onClose,
    profile,
    onProfileUpdate,
}: ProfileEditModalProps) {
    const [formData, setFormData] = useState({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        date_of_birth: profile.date_of_birth || '',
    });

    const [address, setAddress] = useState<IndonesianAddress>({
        street_address: '',
        village: undefined,
        district: undefined,
        city: undefined,
        province: undefined,
        postal_code: '',
        additional_info: '',
    });

    // Store initial address separately to prevent infinite re-initialization
    const [initialAddressForForm, setInitialAddressForForm] = useState<IndonesianAddress | null>(
        null,
    );

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (profile) {
            const profileAddress = profile.address as IndonesianAddress | LegacyAddress | null;

            setFormData({
                full_name: profile.full_name || '',
                phone: profile.phone || '',
                date_of_birth: profile.date_of_birth || '',
            });

            // Handle both new Indonesian format and legacy format
            if (profileAddress) {
                console.log('ProfileEditModal: Loading existing address data:', profileAddress);

                // Check if it has the expected nested structure (even if values are undefined)
                const hasNestedStructure =
                    typeof (profileAddress as any).province === 'object' ||
                    typeof (profileAddress as any).city === 'object';

                if (hasNestedStructure) {
                    // New Indonesian format with nested structure
                    console.log('ProfileEditModal: Using nested address structure');
                    const addressData = profileAddress as IndonesianAddress;
                    setAddress(addressData);
                    setInitialAddressForForm(addressData); // Set initial address only once
                } else if ('city_id' in profileAddress && profileAddress.city_id) {
                    // Old Indonesian format with flat structure - will need manual reselection
                    console.log('ProfileEditModal: Converting from flat ID structure');
                    const addressData = {
                        street_address: (profileAddress as any).street_address || '',
                        village: undefined,
                        district: undefined,
                        city: undefined,
                        province: undefined,
                        postal_code: (profileAddress as any).postal_code || '',
                        additional_info: 'Please reselect your city and province',
                    };
                    setAddress(addressData);
                    setInitialAddressForForm(null); // Force manual selection
                } else {
                    // Legacy format - convert to Indonesian format structure
                    console.log('ProfileEditModal: Converting from legacy address format');
                    const legacyAddr = profileAddress as LegacyAddress;
                    const addressData = {
                        street_address: legacyAddr.street || '',
                        village: undefined,
                        district: undefined,
                        city: undefined,
                        province: undefined,
                        postal_code: legacyAddr.postal_code || '',
                        additional_info: `Legacy: ${legacyAddr.city || ''}, ${legacyAddr.state || ''}, ${legacyAddr.country || ''}`,
                    };
                    setAddress(addressData);
                    setInitialAddressForForm(null); // Force manual selection
                }
            } else {
                // Reset address if no profile address
                const emptyAddress = {
                    street_address: '',
                    village: undefined,
                    district: undefined,
                    city: undefined,
                    province: undefined,
                    postal_code: '',
                    additional_info: '',
                };
                setAddress(emptyAddress);
                setInitialAddressForForm(null);
            }
        }
    }, [profile]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        // Clear field-specific errors
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: '',
            }));
        }
    };

    const handleAddressChange = useCallback(
        (newAddress: IndonesianAddress) => {
            console.log('ProfileEditModal: Address state updated:', newAddress);
            setAddress(newAddress);

            // Clear address-related errors
            if (errors.address) {
                setErrors((prev) => ({
                    ...prev,
                    address: '',
                }));
            }
        },
        [errors.address],
    );

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.full_name.trim()) {
            newErrors.full_name = 'Full name is required';
        }

        if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
            newErrors.phone = 'Please enter a valid phone number';
        }

        if (formData.date_of_birth) {
            const birthDate = new Date(formData.date_of_birth);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            if (age < 18 || age > 100) {
                newErrors.date_of_birth = 'You must be between 18 and 100 years old';
            }
        }

        // Validate Indonesian address if provided
        if (address.street_address || address.city?.code || address.province?.code) {
            if (!address.street_address.trim()) {
                newErrors.address = 'Street address is required when providing address information';
            } else if (!address.city?.code) {
                newErrors.address = 'City selection is required';
            } else if (!address.province?.code) {
                newErrors.address = 'Province selection is required';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const supabase = createClient();

            // Prepare address data - only include if we have complete address info
            let addressData = null;
            if (address.street_address && address.city?.code && address.province?.code) {
                addressData = address;
            }

            const updateData = {
                full_name: formData.full_name.trim(),
                phone: formData.phone.trim() || null,
                date_of_birth: formData.date_of_birth || null,
                address: addressData,
            };

            const { data, error } = await supabase
                .from('user_profiles')
                .update(updateData)
                .eq('id', profile.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating profile:', error);
                setErrors({ general: 'Failed to update profile. Please try again.' });
                return;
            }

            onProfileUpdate(data);
            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            setErrors({ general: 'An unexpected error occurred. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setErrors({});
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
                                <button
                                    onClick={handleClose}
                                    className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                >
                                    <svg
                                        className="w-6 h-6"
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

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Personal Information */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            Personal Information
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Update your personal information. All fields are
                                            optional except for your full name.
                                        </p>
                                    </div>

                                    {/* Full Name */}
                                    <div>
                                        <label
                                            htmlFor="full_name"
                                            className="block text-sm font-medium text-gray-700 mb-2"
                                        >
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="full_name"
                                            name="full_name"
                                            type="text"
                                            value={formData.full_name}
                                            onChange={handleInputChange}
                                            placeholder="Enter your full name"
                                            disabled={loading}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                        {errors.full_name && (
                                            <p className="text-red-500 text-sm mt-1">
                                                {errors.full_name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Phone Number */}
                                    <div>
                                        <label
                                            htmlFor="phone"
                                            className="block text-sm font-medium text-gray-700 mb-2"
                                        >
                                            Phone Number
                                        </label>
                                        <input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            placeholder="Enter your phone number"
                                            disabled={loading}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                        {errors.phone && (
                                            <p className="text-red-500 text-sm mt-1">
                                                {errors.phone}
                                            </p>
                                        )}
                                    </div>

                                    {/* Date of Birth */}
                                    <div>
                                        <label
                                            htmlFor="date_of_birth"
                                            className="block text-sm font-medium text-gray-700 mb-2"
                                        >
                                            Date of Birth
                                        </label>
                                        <input
                                            id="date_of_birth"
                                            name="date_of_birth"
                                            type="date"
                                            value={formData.date_of_birth}
                                            onChange={handleInputChange}
                                            disabled={loading}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                        />
                                        {errors.date_of_birth && (
                                            <p className="text-red-500 text-sm mt-1">
                                                {errors.date_of_birth}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Indonesian Address */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            Address Information
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Provide your address in Indonesia. This information is
                                            optional but helps with location-based services.
                                        </p>
                                    </div>

                                    <CompactAddressForm
                                        initialAddress={initialAddressForForm}
                                        onChange={handleAddressChange}
                                        onLocationStringChange={(locationString) => {
                                            // Optional: Handle location string for display
                                            console.log('Profile location string:', locationString);
                                        }}
                                        required={false}
                                        disabled={loading}
                                        enableDetailedMode={true}
                                    />

                                    {errors.address && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                            {errors.address}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClose}
                                        disabled={loading}
                                        className="px-6"
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={loading} className="px-6">
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>

                                {errors.general && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                        {errors.general}
                                    </div>
                                )}
                            </form>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
