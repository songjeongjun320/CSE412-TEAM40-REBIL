'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getCurrentUserRoles } from '@/lib/auth/userRoles';
import { createClient } from '@/lib/supabase/supabaseClient';
import { formatDailyRate } from '@/lib/utils';
import { Json } from '@/types/base/database.types';

interface PendingCar {
    id: string;
    host_id: string;
    host_name: string;
    host_email: string;
    make: string;
    model: string;
    year: number;
    license_plate: string;
    color: string;
    transmission: string;
    fuel_type: string;
    seats: number;
    description: string;
    daily_rate: number;
    location: Json;
    created_at: string;
    updated_at: string;
    image_count: number;
    primary_image_url: string;
}

export default function VehicleApprovalsPage() {
    const router = useRouter();
    const routerRef = useRef(router);
    routerRef.current = router;

    const [pendingCars, setPendingCars] = useState<PendingCar[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchPendingCars = useCallback(async () => {
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('User not authenticated');
            }

            const { data, error } = await supabase.rpc('get_pending_approval_cars', {
                admin_user_id: user.id,
            });

            if (error) {
                console.error('Error fetching pending cars:', error);
                throw error;
            }

            setPendingCars(data || []);
        } catch (error) {
            console.error('Error fetching pending cars:', error);
            setError('Failed to load pending approval cars');
        }
    }, []);

    const checkAdminAndFetchPendingCars = useCallback(async () => {
        try {
            const roles = await getCurrentUserRoles();
            if (!roles?.isAdmin) {
                routerRef.current.push('/home');
                return;
            }

            await fetchPendingCars();
        } catch (error) {
            console.error('Error checking admin status:', error);
            setError('Failed to verify admin access');
        } finally {
            setLoading(false);
        }
    }, [fetchPendingCars]); // Include fetchPendingCars as dependency

    useEffect(() => {
        checkAdminAndFetchPendingCars();
    }, [checkAdminAndFetchPendingCars]);

    const handleApproval = async (carId: string, approve: boolean) => {
        setProcessingId(carId);
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('User not authenticated');
            }

            const functionName = approve ? 'approve_car' : 'reject_car';
            const { data, error } = await supabase.rpc(functionName, {
                admin_user_id: user.id,
                car_uuid: carId,
                ...(approve ? {} : { rejection_reason: 'Car rejected by admin review' }),
            });

            if (error) {
                console.error(`Error ${approve ? 'approving' : 'rejecting'} car:`, error);
                throw error;
            }

            if (data) {
                // Remove the car from the pending list
                setPendingCars((prev) => prev.filter((car) => car.id !== carId));
                setError(null);
            } else {
                throw new Error(`Failed to ${approve ? 'approve' : 'reject'} car`);
            }
        } catch (error) {
            console.error(`Error ${approve ? 'approving' : 'rejecting'} car:`, error);
            setError(
                error instanceof Error
                    ? error.message
                    : `Failed to ${approve ? 'approve' : 'reject'} car`,
            );
        } finally {
            setProcessingId(null);
        }
    };

    const formatLocation = useCallback((location: Json) => {
        if (!location || typeof location !== 'object') return 'Not specified';
        if (Array.isArray(location)) return location.filter(Boolean).join(', ');

        const locationObj = location as any;
        const parts: string[] = [];

        try {
            // Method 1: Check for nested format (province.name, city.name, etc.)
            if (locationObj.province?.name) {
                if (locationObj.village?.name) parts.push(locationObj.village.name);
                if (locationObj.district?.name) parts.push(locationObj.district.name);
                if (locationObj.city?.name) parts.push(locationObj.city.name);
                if (locationObj.province?.name) parts.push(locationObj.province.name);
                if (locationObj.postal_code) parts.push(locationObj.postal_code);
                if (locationObj.street_address) parts.push(locationObj.street_address);

                return parts.filter(Boolean).join(', ') || 'Not specified';
            }

            // Method 2: Check for flat format (_name properties)
            if (locationObj.province_name || locationObj.city_name) {
                if (locationObj.village_name) parts.push(locationObj.village_name);
                if (locationObj.district_name) parts.push(locationObj.district_name);
                if (locationObj.city_name) parts.push(locationObj.city_name);
                if (locationObj.province_name) parts.push(locationObj.province_name);
                if (locationObj.postal_code) parts.push(locationObj.postal_code);
                if (locationObj.street_address) parts.push(locationObj.street_address);

                return parts.filter(Boolean).join(', ') || 'Not specified';
            }

            // Method 3: Extract meaningful string values only (ignore objects and codes)
            const meaningfulKeys = ['street_address', 'postal_code'];
            const extractedParts: string[] = [];

            for (const [key, value] of Object.entries(locationObj)) {
                if (
                    typeof value === 'string' &&
                    value.trim() &&
                    !key.includes('_id') &&
                    !key.includes('_code')
                ) {
                    // Skip government codes like "31", "31.73" that aren't meaningful for display
                    if (!/^[\d.]+$/.test(value)) {
                        extractedParts.push(value);
                    }
                } else if (meaningfulKeys.includes(key) && typeof value === 'string') {
                    extractedParts.push(value);
                }
            }

            return extractedParts.filter(Boolean).join(', ') || 'Not specified';
        } catch (error) {
            console.warn('Error formatting location:', error, location);
            return 'Location format error';
        }
    }, []);

    const getImageSrc = useCallback((imageUrl: string | null) => {
        if (!imageUrl) {
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNGM0Y0RjYiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMDAsIDc1KSI+CiAgICA8IS0tIENhciBib2R5IC0tPgogICAgPHJlY3QgeD0iMjAiIHk9IjgwIiB3aWR0aD0iMTYwIiBoZWlnaHQ9IjYwIiByeD0iMTAiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gQ2FyIHRvcCAtLT4KICAgIDxyZWN0IHg9IjQwIiB5PSI2MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gV2luZG93cyAtLT4KICAgIDxyZWN0IHg9IjUwIiB5PSI2NSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIzMCIgcng9IjUiIGZpbGw9IiNFNUU3RUIiLz4KICAgIDwhLS0gV2hlZWxzIC0tPgogICAgPGNpcmNsZSBjeD0iNTAiIGN5PSIxNDAiIHI9IjIwIiBmaWxsPSIjMzc0MTUxIi8+CiAgICA8Y2lyY2xlIGN4PSIxNTAiIGN5PSIxNDAiIHI9IjIwIiBmaWxsPSIjMzc0MTUxIi8+CiAgICA8IS0tIFdoZWVsIGRldGFpbHMgLS0+CiAgICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjE0MCIgcj0iMTIiIGZpbGw9IiM2QjcyODAiLz4KICAgIDxjaXJjbGUgY3g9IjE1MCIgY3k9IjE0MCIgcj0iMTIiIGZpbGw9IiM2QjcyODAiLz4KICAgIDwhLS0gSGVhZGxpZ2h0cyAtLT4KICAgIDxyZWN0IHg9IjI1IiB5PSI4NSIgd2lkdGg9IjgiIGhlaWdodD0iMTUiIHJ4PSI0IiBmaWxsPSIjRkNEMzNEIi8+CiAgICA8cmVjdCB4PSIxNjciIHk9Ijg1IiB3aWR0aD0iOCIgaGVpZ2h0PSIxNSIgcng9IjQiIGZpbGw9IiNGQ0QzM0QiLz4KICAgIDwhLS0gRG9vciAtLT4KICAgIDxyZWN0IHg9IjgwIiB5PSI4NSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjUwIiByeD0iMyIgZmlsbD0iIzRCNTU2MyIvPgogIDwvZz4KICA8dGV4dCB4PSIyMDAiIHk9IjI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZCNzI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2Ij5DYXIgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';
        }
        return imageUrl;
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading pending approvals...</p>
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
                        <div className="flex items-center space-x-4">
                            <Link href="/home" className="text-2xl font-bold text-black">
                                REBIL
                            </Link>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-600">Vehicle Approvals</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/home/admin"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Admin Dashboard
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
            <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-black mb-2">Vehicle Approvals</h1>
                    <p className="text-gray-600">
                        Review and approve vehicle listings submitted by hosts
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {pendingCars.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h2 className="text-2xl font-bold text-black mb-2">All caught up!</h2>
                        <p className="text-gray-600">
                            There are no vehicles pending approval at the moment.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {pendingCars.map((car) => (
                            <div
                                key={car.id}
                                className="bg-white rounded-2xl shadow-xl overflow-hidden"
                            >
                                {/* Car Image */}
                                <div className="h-48 bg-gray-200 relative">
                                    <img
                                        src={getImageSrc(car.primary_image_url)}
                                        alt={`${car.make} ${car.model}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = getImageSrc(null);
                                        }}
                                    />
                                    <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium">
                                        Pending Approval
                                    </div>
                                    <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                                        {car.image_count} image
                                        {car.image_count !== 1 ? 's' : ''}
                                    </div>
                                </div>

                                {/* Car Details */}
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-black mb-1">
                                                {car.make} {car.model} ({car.year})
                                            </h3>
                                            <p className="text-gray-600 text-sm">
                                                Host: {car.host_name} ({car.host_email})
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-green-600">
                                                {formatDailyRate(car.daily_rate)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Car Info Grid */}
                                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Color:</span>
                                            <span className="ml-1 text-black">{car.color}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Seats:</span>
                                            <span className="ml-1 text-black">{car.seats}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Transmission:</span>
                                            <span className="ml-1 text-black">
                                                {car.transmission}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Fuel:</span>
                                            <span className="ml-1 text-black">{car.fuel_type}</span>
                                        </div>
                                    </div>

                                    {/* License Plate */}
                                    {car.license_plate && (
                                        <div className="mb-3">
                                            <span className="text-gray-500 text-sm">
                                                License Plate:
                                            </span>
                                            <span className="ml-1 text-black text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                                {car.license_plate}
                                            </span>
                                        </div>
                                    )}

                                    {/* Description */}
                                    {car.description && (
                                        <div className="mb-4">
                                            <p className="text-gray-700 text-sm">
                                                {car.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Location */}
                                    <div className="mb-4">
                                        <span className="text-gray-500 text-sm">Location:</span>
                                        <span className="ml-1 text-black text-sm">
                                            {formatLocation(car.location)}
                                        </span>
                                    </div>

                                    {/* Submission Date */}
                                    <div className="mb-6">
                                        <span className="text-gray-500 text-sm">Submitted:</span>
                                        <span className="ml-1 text-black text-sm">
                                            {new Date(car.updated_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => handleApproval(car.id, true)}
                                            disabled={processingId === car.id}
                                            className="flex-1 bg-green-800 text-white px-4 py-2 rounded-lg hover:bg-green-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {processingId === car.id ? 'Processing...' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => handleApproval(car.id, false)}
                                            disabled={processingId === car.id}
                                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {processingId === car.id ? 'Processing...' : 'Reject'}
                                        </button>
                                        <Link
                                            href={`/admin/vehicle-approvals/${car.id}`}
                                            className="bg-gray-200 text-black px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-center"
                                        >
                                            Details
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
