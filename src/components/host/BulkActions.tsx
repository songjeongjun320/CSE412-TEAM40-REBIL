'use client';

import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    Clock,
    Download,
    Edit,
    Trash2,
    X,
} from 'lucide-react';
import React, { useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';
import { Tables } from '@/types/base/database.types';

type Vehicle = Tables<'cars'>;

interface BulkActionsProps {
    selectedVehicles: Set<string>;
    vehicles: Vehicle[];
    onClearSelection: () => void;
    onActionComplete: (action: string, count: number) => void;
    onShowManualBooking?: (vehicleId: string) => void;
}

interface BulkActionModalProps {
    isOpen: boolean;
    action: string;
    vehicleCount: number;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}

function BulkActionModal({
    isOpen,
    action,
    vehicleCount,
    onConfirm,
    onCancel,
    loading,
}: BulkActionModalProps) {
    if (!isOpen) return null;

    const getActionDetails = () => {
        switch (action) {
            case 'activate':
                return {
                    title: 'Activate Vehicles',
                    description: `Are you sure you want to activate ${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}? They will become available for booking.`,
                    icon: CheckCircle,
                    color: 'text-green-600',
                    confirmText: 'Activate',
                    confirmColor: 'bg-green-600 hover:bg-green-700',
                };
            case 'deactivate':
                return {
                    title: 'Deactivate Vehicles',
                    description: `Are you sure you want to deactivate ${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}? They will no longer be available for booking.`,
                    icon: Clock,
                    color: 'text-orange-600',
                    confirmText: 'Deactivate',
                    confirmColor: 'bg-orange-600 hover:bg-orange-700',
                };
            case 'delete':
                return {
                    title: 'Delete Vehicles',
                    description: `Are you sure you want to delete ${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}? This action cannot be undone.`,
                    icon: AlertTriangle,
                    color: 'text-red-600',
                    confirmText: 'Delete',
                    confirmColor: 'bg-red-600 hover:bg-red-700',
                };
            case 'draft':
                return {
                    title: 'Move to Draft',
                    description: `Are you sure you want to move ${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''} to draft status?`,
                    icon: Edit,
                    color: 'text-gray-600',
                    confirmText: 'Move to Draft',
                    confirmColor: 'bg-gray-600 hover:bg-gray-700',
                };
            default:
                return {
                    title: 'Confirm Action',
                    description: `Confirm action on ${vehicleCount} vehicle${vehicleCount !== 1 ? 's' : ''}`,
                    icon: AlertTriangle,
                    color: 'text-gray-600',
                    confirmText: 'Confirm',
                    confirmColor: 'bg-gray-600 hover:bg-gray-700',
                };
        }
    };

    const details = getActionDetails();
    const Icon = details.icon;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                <div className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <Icon className={`h-8 w-8 ${details.color}`} />
                        <h3 className="text-xl font-semibold text-black">{details.title}</h3>
                    </div>

                    <p className="text-gray-600 mb-6">{details.description}</p>

                    <div className="flex space-x-3">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 ${details.confirmColor}`}
                        >
                            {loading && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            )}
                            <span>{loading ? 'Processing...' : details.confirmText}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BulkActions({
    selectedVehicles,
    vehicles,
    onClearSelection,
    onActionComplete,
    onShowManualBooking,
}: BulkActionsProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentAction, setCurrentAction] = useState('');
    const [loading, setLoading] = useState(false);

    const supabase = createClient();
    const selectedCount = selectedVehicles.size;

    if (selectedCount === 0) return null;

    const getSelectedVehicleDetails = () => {
        return vehicles.filter((v) => selectedVehicles.has(v.id));
    };

    const handleBulkStatusUpdate = async (newStatus: string) => {
        setLoading(true);
        try {
            const vehicleIds = Array.from(selectedVehicles);

            const { error } = await supabase
                .from('cars')
                .update({ status: newStatus })
                .in('id', vehicleIds);

            if (error) throw error;

            onActionComplete(newStatus.toLowerCase(), selectedCount);
            onClearSelection();
        } catch (error) {
            console.error(`Error updating vehicle status to ${newStatus}:`, error);
            alert(`Failed to update vehicle status. Please try again.`);
        } finally {
            setLoading(false);
            setShowModal(false);
        }
    };

    const handleBulkDelete = async () => {
        setLoading(true);
        try {
            const vehicleIds = Array.from(selectedVehicles);

            // Check for active bookings first
            const { data: activeBookings, error: bookingError } = await supabase
                .from('bookings')
                .select('car_id')
                .in('car_id', vehicleIds)
                .in('status', ['CONFIRMED', 'AUTO_APPROVED', 'IN_PROGRESS']);

            if (bookingError) throw bookingError;

            if (activeBookings && activeBookings.length > 0) {
                alert(
                    'Cannot delete vehicles with active bookings. Please complete or cancel existing bookings first.',
                );
                return;
            }

            const { error } = await supabase.from('cars').delete().in('id', vehicleIds);

            if (error) throw error;

            onActionComplete('delete', selectedCount);
            onClearSelection();
        } catch (error) {
            console.error('Error deleting vehicles:', error);
            alert('Failed to delete vehicles. Please try again.');
        } finally {
            setLoading(false);
            setShowModal(false);
        }
    };

    const handleExportData = () => {
        const selectedVehicleData = getSelectedVehicleDetails();
        const csvData = selectedVehicleData.map((vehicle) => ({
            Make: vehicle.make,
            Model: vehicle.model,
            Year: vehicle.year,
            'License Plate': vehicle.license_plate || '',
            'Vehicle Type': vehicle.car_type,
            'Daily Rate': vehicle.daily_rate,
            Status: vehicle.status,
            'Fuel Type': vehicle.fuel_type,
            Transmission: vehicle.transmission,
            Seats: vehicle.seats,
            Location: vehicle.location || '',
            'Created At': new Date(vehicle.created_at).toLocaleDateString(),
        }));

        const csvHeaders = Object.keys(csvData[0]);
        const csvContent = [
            csvHeaders.join(','),
            ...csvData.map((row) =>
                csvHeaders.map((header) => `"${row[header as keyof typeof row]}"`).join(','),
            ),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
            'download',
            `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`,
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        onActionComplete('export', selectedCount);
    };

    const handleActionClick = (action: string) => {
        setCurrentAction(action);
        setIsDropdownOpen(false);

        if (action === 'export') {
            handleExportData();
            return;
        }

        setShowModal(true);
    };

    const handleConfirmAction = () => {
        switch (currentAction) {
            case 'activate':
                handleBulkStatusUpdate('ACTIVE');
                break;
            case 'deactivate':
                handleBulkStatusUpdate('INACTIVE');
                break;
            case 'draft':
                handleBulkStatusUpdate('DRAFT');
                break;
            case 'delete':
                handleBulkDelete();
                break;
        }
    };

    const selectedVehicleDetails = getSelectedVehicleDetails();
    const canActivate = selectedVehicleDetails.some((v) => v.status !== 'ACTIVE');
    const canDeactivate = selectedVehicleDetails.some((v) => v.status === 'ACTIVE');
    const canDelete = selectedVehicleDetails.every((v) => v.status !== 'ACTIVE');

    return (
        <>
            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-400 p-4 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-black">
                                {selectedCount} vehicle{selectedCount !== 1 ? 's' : ''} selected
                            </span>
                        </div>

                        {/* Quick Status Indicators */}
                        <div className="hidden md:flex items-center space-x-4 text-sm text-gray-600">
                            {Object.entries(
                                selectedVehicleDetails.reduce(
                                    (acc, vehicle) => {
                                        acc[vehicle.status] = (acc[vehicle.status] || 0) + 1;
                                        return acc;
                                    },
                                    {} as Record<string, number>,
                                ),
                            ).map(([status, count]) => (
                                <span key={status} className="flex items-center space-x-1">
                                    <div
                                        className={`w-2 h-2 rounded-full ${
                                            status === 'ACTIVE'
                                                ? 'bg-green-500'
                                                : status === 'INACTIVE'
                                                  ? 'bg-red-500'
                                                  : status === 'PENDING_APPROVAL'
                                                    ? 'bg-yellow-500'
                                                    : 'bg-gray-500'
                                        }`}
                                    />
                                    <span>
                                        {status}: {count}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {/* Quick Actions */}
                        {selectedCount === 1 && onShowManualBooking && (
                            <button
                                onClick={() => onShowManualBooking(Array.from(selectedVehicles)[0])}
                                className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm flex items-center space-x-1"
                            >
                                <Calendar className="h-4 w-4" />
                                <span>Book Offline</span>
                            </button>
                        )}

                        {canActivate && (
                            <button
                                onClick={() => handleActionClick('activate')}
                                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center space-x-1"
                            >
                                <CheckCircle className="h-4 w-4" />
                                <span>Activate</span>
                            </button>
                        )}

                        {canDeactivate && (
                            <button
                                onClick={() => handleActionClick('deactivate')}
                                className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm flex items-center space-x-1"
                            >
                                <Clock className="h-4 w-4" />
                                <span>Deactivate</span>
                            </button>
                        )}

                        {/* More Actions Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors text-sm flex items-center space-x-1"
                            >
                                <span>More Actions</span>
                                <svg
                                    className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-1 z-10">
                                    <button
                                        onClick={() => handleActionClick('export')}
                                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span>Export to CSV</span>
                                    </button>

                                    <button
                                        onClick={() => handleActionClick('draft')}
                                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                    >
                                        <Edit className="h-4 w-4" />
                                        <span>Move to Draft</span>
                                    </button>

                                    <div className="border-t border-gray-200 my-1" />

                                    {canDelete && (
                                        <button
                                            onClick={() => handleActionClick('delete')}
                                            className="flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span>Delete Vehicles</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Clear Selection */}
                        <button
                            onClick={onClearSelection}
                            className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm flex items-center space-x-1"
                        >
                            <X className="h-4 w-4" />
                            <span>Clear</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Action Confirmation Modal */}
            <BulkActionModal
                isOpen={showModal}
                action={currentAction}
                vehicleCount={selectedCount}
                onConfirm={handleConfirmAction}
                onCancel={() => setShowModal(false)}
                loading={loading}
            />

            {/* Click outside to close dropdown */}
            {isDropdownOpen && (
                <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)} />
            )}
        </>
    );
}
