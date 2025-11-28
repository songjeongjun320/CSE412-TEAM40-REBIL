'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CompactAddressForm } from '@/components/address';
import type { IndonesianAddress } from '@/components/address';
import { Button, Input } from '@/components/ui';
import { getCurrentUserRoles } from '@/lib/auth/userRoles';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatCurrency, formatDailyRate } from '@/lib/utils';

interface VehicleFormData {
    make: string;
    model: string;
    year: number;
    vin: string;
    license_plate: string;
    color: string;
    car_type: 'sedan' | 'suv' | 'motorcycle' | 'ev';
    transmission: 'MANUAL' | 'AUTOMATIC' | 'CVT';
    fuel_type: 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
    seats: number;
    doors: number;
    description: string;
    features: string[];
    daily_rate: number;
    weekly_daily_rate: number;
    monthly_daily_rate: number;
    // Legacy fields for backward compatibility
    weekly_rate: number;
    monthly_rate: number;
    // Indonesian address system
    location: IndonesianAddress;
    delivery_available: boolean;
    delivery_fee: number;
    delivery_radius: number;
    minimum_trip_duration: number;
    // Availability management
    availability_blocks: Array<{
        start_date: string;
        end_date: string;
        is_available: boolean;
        reason: string;
    }>;
    auto_approval_enabled: boolean;
    auto_approval_limit: number;
    advance_booking_hours: number;
}

const INITIAL_FORM_DATA: VehicleFormData = {
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    license_plate: '',
    color: '',
    car_type: 'sedan',
    transmission: 'AUTOMATIC',
    fuel_type: 'GASOLINE',
    seats: 5,
    doors: 4,
    description: '',
    features: [],
    daily_rate: 0,
    weekly_daily_rate: 0,
    monthly_daily_rate: 0,
    // Legacy fields for backward compatibility
    weekly_rate: 0,
    monthly_rate: 0,
    // Indonesian address system - will be set by address form
    location: {
        street_address: '',
        province: undefined,
        city: undefined,
        district: undefined,
        village: undefined,
        // Legacy fields for backward compatibility
        village_id: '',
        district_id: '',
        city_id: '',
        province_id: '',
        postal_code: '',
        additional_info: '',
    },
    delivery_available: false,
    delivery_fee: 0,
    delivery_radius: 0,
    minimum_trip_duration: 1,
    // Availability management
    availability_blocks: [],
    auto_approval_enabled: false,
    auto_approval_limit: 500,
    advance_booking_hours: 24,
};

const AVAILABLE_FEATURES = [
    'Air Conditioning',
    'GPS Navigation',
    'Bluetooth',
    'USB Charging',
    'WiFi Hotspot',
    'Heated Seats',
    'Sunroof',
    'Backup Camera',
    'Parking Sensors',
    'Keyless Entry',
    'Premium Audio',
    'All-Wheel Drive',
    'Cruise Control',
    'Lane Departure Warning',
    'Automatic Emergency Braking',
];

export default function AddVehiclePage() {
    const router = useRouter();
    const [formData, setFormData] = useState<VehicleFormData>(INITIAL_FORM_DATA);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isHost, setIsHost] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const checkHostPermission = useCallback(async () => {
        try {
            const roles = await getCurrentUserRoles();
            if (!roles?.isHost) {
                router.push('/home');
                return;
            }
            setIsHost(true);
        } catch (error) {
            console.error('Error checking user roles:', error);
            router.push('/home');
        } finally {
            setCheckingAuth(false);
        }
    }, [router]);

    useEffect(() => {
        checkHostPermission();
    }, [checkHostPermission]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
        const { name, value, type } = e.target;

        // Handle availability blocks (nested fields)
        if (name.includes('availability_blocks.')) {
            const parts = name.split('.');
            const blockIndex = parseInt(parts[1]);
            const fieldName = parts[2];

            setFormData((prev) => {
                const newBlocks = [...prev.availability_blocks];
                if (!newBlocks[blockIndex]) {
                    newBlocks[blockIndex] = {
                        start_date: '',
                        end_date: '',
                        is_available: true,
                        reason: '',
                    };
                }

                if (fieldName === 'is_available') {
                    newBlocks[blockIndex][fieldName] = value === 'true';
                } else {
                    (newBlocks[blockIndex] as any)[fieldName] = value;
                }

                return {
                    ...prev,
                    availability_blocks: newBlocks,
                };
            });
            return;
        }

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) => ({
                ...prev,
                [name]: checked,
            }));
        } else if (type === 'number') {
            setFormData((prev) => ({
                ...prev,
                [name]: parseFloat(value) || 0,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }

        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: '',
            }));
        }
    };

    const handleFeatureChange = (feature: string, checked: boolean) => {
        setFormData((prev) => ({
            ...prev,
            features: checked
                ? [...prev.features, feature]
                : prev.features.filter((f) => f !== feature),
        }));
    };

    const handleAddressChange = (address: IndonesianAddress) => {
        setFormData((prev) => ({
            ...prev,
            location: address,
        }));

        // Clear address-related errors when address changes
        if (errors.location) {
            setErrors((prev) => ({
                ...prev,
                location: '',
            }));
        }
    };

    const addAvailabilityBlock = () => {
        setFormData((prev) => ({
            ...prev,
            availability_blocks: [
                ...prev.availability_blocks,
                {
                    start_date: '',
                    end_date: '',
                    is_available: true,
                    reason: '',
                },
            ],
        }));
    };

    const removeAvailabilityBlock = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            availability_blocks: prev.availability_blocks.filter((_, i) => i !== index),
        }));
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        // Required fields
        if (!formData.make.trim()) newErrors.make = 'Make is required';
        if (!formData.model.trim()) newErrors.model = 'Model is required';
        if (formData.year < 1990 || formData.year > new Date().getFullYear() + 1) {
            newErrors.year = 'Please enter a valid year';
        }
        if (!formData.color.trim()) newErrors.color = 'Color is required';
        if (!formData.car_type) {
            newErrors.car_type = 'Car type is required';
        }
        if (formData.seats < 1 || formData.seats > 12) {
            newErrors.seats = 'Seats must be between 1 and 12';
        }
        if (formData.doors < 2 || formData.doors > 6) {
            newErrors.doors = 'Doors must be between 2 and 6';
        }
        if (!formData.description.trim()) {
            newErrors.description = 'Description is required';
        }
        if (formData.daily_rate <= 0) {
            newErrors.daily_rate = 'Daily rate must be greater than 0';
        }

        // Tiered pricing validation
        if (formData.weekly_daily_rate > 0 && formData.weekly_daily_rate > formData.daily_rate) {
            newErrors.weekly_daily_rate =
                'Weekly daily rate should be equal to or less than daily rate';
        }
        if (
            formData.monthly_daily_rate > 0 &&
            formData.monthly_daily_rate > formData.weekly_daily_rate
        ) {
            newErrors.monthly_daily_rate =
                'Monthly daily rate should be equal to or less than weekly daily rate';
        }
        if (formData.monthly_daily_rate > 0 && formData.monthly_daily_rate > formData.daily_rate) {
            newErrors.monthly_daily_rate =
                'Monthly daily rate should be equal to or less than daily rate';
        }

        // Indonesian address validation
        if (!formData.location.street_address.trim()) {
            newErrors.location = 'Street address is required';
        } else if (!formData.location.city?.code && !formData.location.city_id) {
            newErrors.location = 'City selection is required';
        } else if (!formData.location.province?.code && !formData.location.province_id) {
            newErrors.location = 'Province selection is required';
        }

        // VIN validation (basic)
        if (formData.vin && formData.vin.length !== 17) {
            newErrors.vin = 'VIN must be 17 characters long';
        }

        // Delivery validation
        if (formData.delivery_available) {
            if (formData.delivery_fee < 0) {
                newErrors.delivery_fee = 'Delivery fee cannot be negative';
            }
            if (formData.delivery_radius <= 0) {
                newErrors.delivery_radius = 'Delivery radius must be greater than 0';
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

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            // Use Indonesian address format with names and codes
            const locationData = {
                ...formData.location,
                // Ensure we have both old and new format for compatibility
                ...(formData.location.province?.code && {
                    province_code: formData.location.province.code,
                    province_name: formData.location.province.name,
                }),
                ...(formData.location.city?.code && {
                    city_code: formData.location.city.code,
                    city_name: formData.location.city.name,
                }),
                ...(formData.location.district?.code && {
                    district_code: formData.location.district.code,
                    district_name: formData.location.district.name,
                }),
                ...(formData.location.village?.code && {
                    village_code: formData.location.village.code,
                    village_name: formData.location.village.name,
                }),
            };

            const vehicleData = {
                host_id: user.id,
                make: formData.make.trim(),
                model: formData.model.trim(),
                year: formData.year,
                vin: formData.vin.trim() || null,
                license_plate: formData.license_plate.trim() || null,
                color: formData.color.trim(),
                car_type: formData.car_type,
                transmission: formData.transmission,
                fuel_type: formData.fuel_type,
                seats: formData.seats,
                doors: formData.doors,
                description: formData.description.trim(),
                features: formData.features,
                daily_rate: formData.daily_rate,
                weekly_daily_rate: formData.weekly_daily_rate || null,
                monthly_daily_rate: formData.monthly_daily_rate || null,
                // Calculate legacy rates for backward compatibility
                weekly_rate: formData.weekly_daily_rate ? formData.weekly_daily_rate * 7 : null,
                monthly_rate: formData.monthly_daily_rate ? formData.monthly_daily_rate * 30 : null,
                location: locationData,
                delivery_available: formData.delivery_available,
                delivery_fee: formData.delivery_available ? formData.delivery_fee : 0,
                delivery_radius: formData.delivery_available ? formData.delivery_radius : 0,
                minimum_trip_duration: formData.minimum_trip_duration,
                status: 'DRAFT' as const,
            };

            const { data: vehicle, error: vehicleError } = await supabase
                .from('cars')
                .insert(vehicleData)
                .select()
                .single();

            if (vehicleError) {
                console.error('Error adding vehicle:', vehicleError);
                setErrors({ general: 'Failed to add vehicle. Please try again.' });
                return;
            }

            // Create host preferences for auto-approval settings
            if (formData.auto_approval_enabled) {
                const { error: preferencesError } = await supabase.from('host_preferences').upsert({
                    host_id: user.id,
                    auto_approval_enabled: formData.auto_approval_enabled,
                    auto_approval_limit: formData.auto_approval_limit,
                    advance_booking_hours: formData.advance_booking_hours,
                });

                if (preferencesError) {
                    console.error('Error creating host preferences:', preferencesError);
                    // Don't fail the entire operation, just log the error
                }
            }

            // Create availability blocks if specified
            if (formData.availability_blocks.length > 0) {
                const availabilityData = formData.availability_blocks
                    .filter((block) => block.start_date && block.end_date)
                    .map((block) => ({
                        car_id: vehicle.id,
                        start_date: block.start_date,
                        end_date: block.end_date,
                        is_available: block.is_available,
                        reason: block.reason || null,
                        availability_type: block.is_available ? 'manual' : 'personal',
                        created_by: user.id,
                    }));

                if (availabilityData.length > 0) {
                    const { error: availabilityError } = await supabase
                        .from('car_availability')
                        .insert(availabilityData);

                    if (availabilityError) {
                        console.error('Error creating availability blocks:', availabilityError);
                        // Don't fail the entire operation, just log the error
                    }
                }
            }

            alert('✅ Vehicle added successfully! Please upload images and submit for approval.');
            router.push(`/host/vehicles/${vehicle.id}`);
        } catch (error) {
            console.error('Error adding vehicle:', error);
            setErrors({ general: 'An unexpected error occurred. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Checking permissions...</p>
                </div>
            </div>
        );
    }

    if (!isHost) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <Link href="/home/host" className="text-2xl font-bold text-black">
                                REBIL
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/home/host"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/profile"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Profile
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-black mb-2">Add New Vehicle</h1>
                        <p className="text-gray-600">
                            Register your vehicle to start earning money by renting it out.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {errors.general && (
                            <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
                                {errors.general}
                            </div>
                        )}

                        {/* Vehicle Information */}
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-4">
                                Vehicle Information
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Make *
                                    </label>
                                    <Input
                                        type="text"
                                        name="make"
                                        value={formData.make}
                                        onChange={handleInputChange}
                                        error={errors.make}
                                        placeholder="Toyota, Honda, BMW..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Model *
                                    </label>
                                    <Input
                                        type="text"
                                        name="model"
                                        value={formData.model}
                                        onChange={handleInputChange}
                                        error={errors.model}
                                        placeholder="Camry, Civic, X3..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Year *
                                    </label>
                                    <Input
                                        type="number"
                                        name="year"
                                        value={formData.year}
                                        onChange={handleInputChange}
                                        error={errors.year}
                                        min="1990"
                                        max={new Date().getFullYear() + 1}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Color *
                                    </label>
                                    <Input
                                        type="text"
                                        name="color"
                                        value={formData.color}
                                        onChange={handleInputChange}
                                        error={errors.color}
                                        placeholder="Black, White, Silver..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Car Type *
                                    </label>
                                    <select
                                        name="car_type"
                                        value={formData.car_type}
                                        onChange={handleInputChange}
                                        className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800 ${errors.car_type ? 'border-red-500' : ''}`}
                                        required
                                    >
                                        <option value="sedan">Sedan</option>
                                        <option value="suv">SUV</option>
                                        <option value="motorcycle">Motorcycle</option>
                                        <option value="ev">Electric Vehicle (EV)</option>
                                    </select>
                                    {errors.car_type && (
                                        <div className="text-red-500 text-xs mt-1">
                                            {errors.car_type}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        VIN (Optional)
                                    </label>
                                    <Input
                                        type="text"
                                        name="vin"
                                        value={formData.vin}
                                        onChange={handleInputChange}
                                        error={errors.vin}
                                        placeholder="17-character VIN"
                                        maxLength={17}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        License Plate (Optional)
                                    </label>
                                    <Input
                                        type="text"
                                        name="license_plate"
                                        value={formData.license_plate}
                                        onChange={handleInputChange}
                                        placeholder="ABC-1234"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Vehicle Specifications */}
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-4">
                                Specifications
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Transmission
                                    </label>
                                    <select
                                        name="transmission"
                                        value={formData.transmission}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                    >
                                        <option value="AUTOMATIC">Automatic</option>
                                        <option value="MANUAL">Manual</option>
                                        <option value="CVT">CVT</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Fuel Type
                                    </label>
                                    <select
                                        name="fuel_type"
                                        value={formData.fuel_type}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                    >
                                        <option value="GASOLINE">Gasoline</option>
                                        <option value="DIESEL">Diesel</option>
                                        <option value="ELECTRIC">Electric</option>
                                        <option value="HYBRID">Hybrid</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Seats *
                                    </label>
                                    <Input
                                        type="number"
                                        name="seats"
                                        value={formData.seats}
                                        onChange={handleInputChange}
                                        error={errors.seats}
                                        min="1"
                                        max="12"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Doors *
                                    </label>
                                    <Input
                                        type="number"
                                        name="doors"
                                        value={formData.doors}
                                        onChange={handleInputChange}
                                        error={errors.doors}
                                        min="2"
                                        max="6"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description *
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows={4}
                                placeholder="Describe your vehicle, its condition, and any special features..."
                                className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800 placeholder-gray-500 resize-none ${errors.description ? 'border-red-500' : ''}`}
                                required
                            />
                            {errors.description && (
                                <div className="text-red-500 text-xs mt-1">
                                    {errors.description}
                                </div>
                            )}
                        </div>

                        {/* Features */}
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-4">Features</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {AVAILABLE_FEATURES.map((feature) => (
                                    <label
                                        key={feature}
                                        className="flex items-center space-x-2 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.features.includes(feature)}
                                            onChange={(e) =>
                                                handleFeatureChange(feature, e.target.checked)
                                            }
                                            className="rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">{feature}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Pricing */}
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-4">
                                Pricing - Tiered Daily Rates
                            </h2>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0">
                                        <svg
                                            className="w-5 h-5 text-blue-600 mt-0.5"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-blue-800 mb-1">
                                            How Tiered Pricing Works
                                        </h3>
                                        <p className="text-sm text-blue-700 mb-2">
                                            Set daily rates for different rental lengths. Longer
                                            rentals should offer better daily rates to attract
                                            customers.
                                        </p>
                                        <ul className="text-xs text-blue-600 space-y-1">
                                            <li>
                                                • <strong>Daily Rate:</strong> Your standard rate
                                                per day
                                            </li>
                                            <li>
                                                • <strong>Weekly Rate:</strong> Daily rate for 7+
                                                day rentals (should be ≤ daily rate)
                                            </li>
                                            <li>
                                                • <strong>Monthly Rate:</strong> Daily rate for 30+
                                                day rentals (should be ≤ weekly rate)
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Daily Rate (IDR) *
                                        <span className="block text-xs text-gray-500 mt-1">
                                            Standard rate per day
                                        </span>
                                    </label>
                                    <Input
                                        type="number"
                                        name="daily_rate"
                                        value={formData.daily_rate}
                                        onChange={handleInputChange}
                                        error={errors.daily_rate}
                                        min="0"
                                        step="0.01"
                                        placeholder="e.g. 750000"
                                        required
                                    />
                                    {formData.daily_rate > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            7 days: {formatCurrency(formData.daily_rate * 7)}
                                        </div>
                                    )}
                                </div>

                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Weekly Daily Rate (IDR)
                                        <span className="block text-xs text-gray-500 mt-1">
                                            Daily rate for 7+ day rentals
                                        </span>
                                    </label>
                                    <Input
                                        type="number"
                                        name="weekly_daily_rate"
                                        value={formData.weekly_daily_rate || ''}
                                        onChange={handleInputChange}
                                        error={errors.weekly_daily_rate}
                                        min="0"
                                        step="0.01"
                                        placeholder={
                                            formData.daily_rate > 0
                                                ? `≤ ${formatCurrency(formData.daily_rate)}`
                                                : 'e.g. 675000'
                                        }
                                    />
                                    {formData.weekly_daily_rate > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            7 days: {formatCurrency(formData.weekly_daily_rate * 7)}
                                            {formData.daily_rate > 0 && (
                                                <span className="text-green-600">
                                                    (Save{' '}
                                                    {formatCurrency(
                                                        (formData.daily_rate -
                                                            formData.weekly_daily_rate) *
                                                            7,
                                                    )}
                                                    )
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Monthly Daily Rate (IDR)
                                        <span className="block text-xs text-gray-500 mt-1">
                                            Daily rate for 30+ day rentals
                                        </span>
                                    </label>
                                    <Input
                                        type="number"
                                        name="monthly_daily_rate"
                                        value={formData.monthly_daily_rate || ''}
                                        onChange={handleInputChange}
                                        error={errors.monthly_daily_rate}
                                        min="0"
                                        step="0.01"
                                        placeholder={
                                            formData.weekly_daily_rate > 0
                                                ? `≤ ${formatCurrency(formData.weekly_daily_rate)}`
                                                : 'e.g. 600000'
                                        }
                                    />
                                    {formData.monthly_daily_rate > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            30 days:{' '}
                                            {formatCurrency(formData.monthly_daily_rate * 30)}
                                            {formData.daily_rate > 0 && (
                                                <span className="text-green-600">
                                                    (Save{' '}
                                                    {formatCurrency(
                                                        (formData.daily_rate -
                                                            formData.monthly_daily_rate) *
                                                            30,
                                                    )}
                                                    )
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pricing Examples */}
                            {formData.daily_rate > 0 && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                                        Pricing Examples
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div className="bg-white p-3 rounded border">
                                            <div className="font-medium text-gray-700">
                                                3-day rental
                                            </div>
                                            <div className="text-gray-600">
                                                {formatDailyRate(formData.daily_rate)} × 3 ={' '}
                                                <strong>
                                                    {formatCurrency(formData.daily_rate * 3)}
                                                </strong>
                                            </div>
                                        </div>
                                        {formData.weekly_daily_rate > 0 && (
                                            <div className="bg-white p-3 rounded border">
                                                <div className="font-medium text-gray-700">
                                                    10-day rental
                                                </div>
                                                <div className="text-gray-600">
                                                    {formatDailyRate(formData.weekly_daily_rate)} ×
                                                    10 ={' '}
                                                    <strong>
                                                        {formatCurrency(
                                                            formData.weekly_daily_rate * 10,
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>
                                        )}
                                        {formData.monthly_daily_rate > 0 && (
                                            <div className="bg-white p-3 rounded border">
                                                <div className="font-medium text-gray-700">
                                                    45-day rental
                                                </div>
                                                <div className="text-gray-600">
                                                    {formatDailyRate(formData.monthly_daily_rate)} ×
                                                    45 ={' '}
                                                    <strong>
                                                        {formatCurrency(
                                                            formData.monthly_daily_rate * 45,
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 pt-4 border-t border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Minimum Trip Duration (days)
                                </label>
                                <Input
                                    type="number"
                                    name="minimum_trip_duration"
                                    value={formData.minimum_trip_duration}
                                    onChange={handleInputChange}
                                    min="1"
                                    max="30"
                                    className="max-w-xs"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Minimum number of days customers must rent your vehicle
                                </p>
                            </div>
                        </div>

                        {/* Location - Indonesian Address System */}
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-4">
                                Vehicle Location
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Specify where your vehicle is located. This will be used for pickup
                                and delivery services.
                            </p>

                            <CompactAddressForm
                                initialAddress={formData.location}
                                onChange={handleAddressChange}
                                onLocationStringChange={(locationString) => {
                                    // Optional: Handle location string for display
                                    console.log('Location string:', locationString);
                                }}
                                required={true}
                                disabled={loading}
                                enableDetailedMode={true}
                            />

                            {errors.location && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {errors.location}
                                </div>
                            )}
                        </div>

                        {/* Delivery Options */}
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-4">
                                Delivery Options
                            </h2>
                            <div className="space-y-4">
                                <label className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        name="delivery_available"
                                        checked={formData.delivery_available}
                                        onChange={handleInputChange}
                                        className="rounded border-gray-300 text-black focus:ring-black"
                                    />
                                    <span className="text-gray-700">I offer delivery service</span>
                                </label>

                                {formData.delivery_available && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Delivery Fee ($)
                                            </label>
                                            <Input
                                                type="number"
                                                name="delivery_fee"
                                                value={formData.delivery_fee}
                                                onChange={handleInputChange}
                                                error={errors.delivery_fee}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Delivery Radius (km)
                                            </label>
                                            <Input
                                                type="number"
                                                name="delivery_radius"
                                                value={formData.delivery_radius}
                                                onChange={handleInputChange}
                                                error={errors.delivery_radius}
                                                min="1"
                                                placeholder="How far will you deliver?"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Availability Management */}
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-4">
                                Availability Management
                            </h2>
                            <div className="space-y-4">
                                <label className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        name="auto_approval_enabled"
                                        checked={formData.auto_approval_enabled}
                                        onChange={handleInputChange}
                                        className="rounded border-gray-300 text-black focus:ring-black"
                                    />
                                    <span className="text-gray-700">
                                        Enable auto-approval for bookings within the limit
                                    </span>
                                </label>

                                {formData.auto_approval_enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Auto-approval Limit (days)
                                            </label>
                                            <Input
                                                type="number"
                                                name="auto_approval_limit"
                                                value={formData.auto_approval_limit}
                                                onChange={handleInputChange}
                                                min="0"
                                                placeholder="0 for no limit"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Advance Booking Hours
                                            </label>
                                            <Input
                                                type="number"
                                                name="advance_booking_hours"
                                                value={formData.advance_booking_hours}
                                                onChange={handleInputChange}
                                                min="0"
                                                placeholder="How many hours in advance can customers book?"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Manage Availability Blocks
                                    </label>

                                    {formData.availability_blocks.length === 0 && (
                                        <div className="text-gray-500 text-sm mb-4 pl-6">
                                            No availability blocks set. Vehicle will be available by
                                            default.
                                        </div>
                                    )}

                                    {formData.availability_blocks.map((block, index) => (
                                        <div
                                            key={index}
                                            className="border border-gray-200 rounded-lg p-4 mb-4 pl-6"
                                        >
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-medium text-gray-700">
                                                    Block {index + 1}
                                                </h4>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAvailabilityBlock(index)}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Start Date
                                                    </label>
                                                    <Input
                                                        type="date"
                                                        name={`availability_blocks.${index}.start_date`}
                                                        value={block.start_date}
                                                        onChange={handleInputChange}
                                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        End Date
                                                    </label>
                                                    <Input
                                                        type="date"
                                                        name={`availability_blocks.${index}.end_date`}
                                                        value={block.end_date}
                                                        onChange={handleInputChange}
                                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Availability
                                                    </label>
                                                    <select
                                                        name={`availability_blocks.${index}.is_available`}
                                                        value={
                                                            block.is_available ? 'true' : 'false'
                                                        }
                                                        onChange={handleInputChange}
                                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-black focus:ring-2 focus:ring-black/20 transition-colors duration-200 outline-none text-gray-800"
                                                    >
                                                        <option value="true">Available</option>
                                                        <option value="false">Unavailable</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Reason (if unavailable)
                                                    </label>
                                                    <Input
                                                        type="text"
                                                        name={`availability_blocks.${index}.reason`}
                                                        value={block.reason}
                                                        onChange={handleInputChange}
                                                        placeholder="Reason for unavailability"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={addAvailabilityBlock}
                                        className="text-black border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 pl-6"
                                    >
                                        + Add Availability Block
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-gray-200">
                            <Button type="submit" disabled={loading} className="flex-1">
                                {loading ? 'Adding Vehicle...' : 'Add Vehicle'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                                disabled={loading}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
