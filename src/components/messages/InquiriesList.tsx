'use client';

import { AlertTriangle, Car, CheckCircle, Clock, Mail, MessageCircle, User, X } from 'lucide-react';
import { useState } from 'react';

import { LoadingSpinner } from '@/components/ui';
import { useHostInquiries, type HostInquiry } from '@/hooks/useHostInquiries';

interface InquiriesListProps {
    onReplyToInquiry?: (inquiry: HostInquiry) => void;
}

export function InquiriesList({ onReplyToInquiry }: InquiriesListProps) {
    const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
    const [approving, setApproving] = useState<string | null>(null);
    const { inquiries, isLoading, error, refetch } = useHostInquiries(
        statusFilter === 'all' ? 'all' : 'pending',
    );

    const handleApproveBooking = async (inquiry: HostInquiry) => {
        if (!inquiry.preferred_dates) {
            alert('This inquiry does not have preferred dates specified.');
            return;
        }

        setApproving(inquiry.id);

        try {
            // Calculate total amount (simple calculation - in real app this would be more complex)
            const startDate = new Date(inquiry.preferred_dates.start);
            const endDate = new Date(inquiry.preferred_dates.end);
            const days = Math.ceil(
                (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            const dailyRate = inquiry.vehicle.price_per_day || 50; // fallback price
            const totalAmount = days * dailyRate;

            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    vehicleId: inquiry.vehicle_id,
                    hostId: inquiry.host_id,
                    startDate: inquiry.preferred_dates.start,
                    endDate: inquiry.preferred_dates.end,
                    totalAmount: totalAmount,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create booking');
            }

            // Refresh inquiries to update status
            await refetch();
            alert('Booking approved successfully! A message conversation has been created.');
        } catch (error) {
            console.error('Error approving booking:', error);
            alert('Failed to approve booking. Please try again.');
        } finally {
            setApproving(null);
        }
    };

    const getInquiryTypeLabel = (type: string) => {
        const labels = {
            general: 'General Question',
            booking: 'Booking Inquiry',
            availability: 'Availability Check',
            pricing: 'Pricing Question',
        };
        return labels[type as keyof typeof labels] || 'General';
    };

    const getInquiryTypeColor = (type: string) => {
        const colors = {
            general: 'bg-blue-100 text-blue-800',
            booking: 'bg-green-100 text-green-800',
            availability: 'bg-yellow-100 text-yellow-800',
            pricing: 'bg-purple-100 text-purple-800',
        };
        return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="w-4 h-4 text-yellow-600" />;
            case 'responded':
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'closed':
                return <X className="w-4 h-4 text-gray-600" />;
            default:
                return <MessageCircle className="w-4 h-4 text-blue-600" />;
        }
    };

    const formatDate = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInHours * 60);
            return `${diffInMinutes} minutes ago`;
        }
        if (diffInHours < 24) {
            return `${Math.floor(diffInHours)} hours ago`;
        }
        if (diffInHours < 168) {
            // 7 days
            const diffInDays = Math.floor(diffInHours / 24);
            return `${diffInDays} days ago`;
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
                <span className="ml-3 text-gray-600">Loading inquiries...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Error Loading Inquiries
                </h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                    onClick={refetch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            {/* Header with Filter */}
            <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Customer Inquiries ({inquiries.length})
                    </h3>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Show:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'pending' | 'all')}
                            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white"
                        >
                            <option value="pending">Pending Only</option>
                            <option value="all">All Inquiries</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Inquiries List */}
            {inquiries.length === 0 ? (
                <div className="text-center py-12">
                    <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {statusFilter === 'pending' ? 'No Pending Inquiries' : 'No Inquiries Yet'}
                    </h3>
                    <p className="text-gray-600">
                        {statusFilter === 'pending'
                            ? 'All caught up! No pending customer inquiries at the moment.'
                            : 'Customer inquiries will appear here when renters contact you about your vehicles.'}
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200">
                    {inquiries.map((inquiry) => (
                        <div
                            key={inquiry.id}
                            className={`p-6 hover:bg-gray-50 transition-colors ${
                                inquiry.status === 'pending'
                                    ? 'bg-yellow-50 border-l-4 border-yellow-400'
                                    : ''
                            }`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-blue-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-medium text-gray-900">
                                            {inquiry.renter.full_name}
                                        </h4>
                                        <p className="text-sm text-gray-600 flex items-center">
                                            <Mail className="w-3 h-3 mr-1" />
                                            {inquiry.renter.email}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getInquiryTypeColor(inquiry.inquiry_type)}`}
                                    >
                                        {getInquiryTypeLabel(inquiry.inquiry_type)}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                        {getStatusIcon(inquiry.status)}
                                        <span className="text-sm text-gray-600 capitalize">
                                            {inquiry.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Vehicle Info */}
                            <div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
                                <Car className="w-4 h-4" />
                                <span>
                                    About: {inquiry.vehicle.year} {inquiry.vehicle.make}{' '}
                                    {inquiry.vehicle.model}
                                </span>
                            </div>

                            {/* Preferred Dates (for booking inquiries) */}
                            {inquiry.inquiry_type === 'booking' && inquiry.preferred_dates && (
                                <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                                    <div className="flex items-center space-x-2 text-sm text-blue-800">
                                        <Clock className="w-4 h-4" />
                                        <span className="font-medium">Preferred Dates:</span>
                                        <span>
                                            {new Date(
                                                inquiry.preferred_dates.start,
                                            ).toLocaleDateString()}{' '}
                                            -{' '}
                                            {new Date(
                                                inquiry.preferred_dates.end,
                                            ).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Message */}
                            <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                                <p className="text-gray-800 whitespace-pre-wrap">
                                    {inquiry.message}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                    <Clock className="w-4 h-4" />
                                    <span>{formatDate(inquiry.created_at)}</span>
                                </div>

                                {inquiry.status === 'pending' && (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleApproveBooking(inquiry)}
                                            disabled={approving === inquiry.id}
                                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {approving === inquiry.id ? (
                                                <>
                                                    <LoadingSpinner />
                                                    <span className="ml-2">Approving...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Approve Booking
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => onReplyToInquiry?.(inquiry)}
                                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <MessageCircle className="w-4 h-4 mr-2" />
                                            Reply
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
