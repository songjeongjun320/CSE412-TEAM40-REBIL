'use client';

import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    DollarSign,
    MessageCircle,
    Star,
    TrendingUp,
    User,
} from 'lucide-react';
import { useState } from 'react';

import { LoadingSpinner } from '@/components/ui';
import { useHostCustomers, type HostCustomer } from '@/hooks/useHostCustomers';

interface CustomerListProps {
    onStartConversation?: (customerEmail: string, customerName: string, customerId: string) => void;
}

export function CustomerList({ onStartConversation }: CustomerListProps) {
    const { customers, isLoading, error, refetch } = useHostCustomers();
    const [sortBy, setSortBy] = useState<keyof HostCustomer>('last_booking_date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const sortedCustomers = [...customers].sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortOrder === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const getStatusIcon = (customer: HostCustomer) => {
        if (customer.renter_score >= 80) {
            return <CheckCircle className="w-4 h-4 text-green-600" />;
        }
        if (customer.cancellation_rate > 0.2) {
            return <AlertTriangle className="w-4 h-4 text-red-600" />;
        }
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
                <span className="ml-3 text-gray-600">Loading customers...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Error Loading Customers
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

    if (customers.length === 0) {
        return (
            <div className="text-center py-12">
                <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Customers Yet</h3>
                <p className="text-gray-600">
                    Customers will appear here once you start receiving bookings.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            {/* Header with Sort Options */}
            <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Your Customers ({customers.length})
                    </h3>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Sort by:</span>
                        <select
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                                const [field, order] = e.target.value.split('-');
                                setSortBy(field as keyof HostCustomer);
                                setSortOrder(order as 'asc' | 'desc');
                            }}
                            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white"
                        >
                            <option value="last_booking_date-desc">Latest Booking</option>
                            <option value="total_spent-desc">Highest Spender</option>
                            <option value="total_bookings-desc">Most Bookings</option>
                            <option value="renter_score-desc">Highest Score</option>
                            <option value="renter_name-asc">Name (A-Z)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Customer List */}
            <div className="divide-y divide-gray-200">
                {sortedCustomers.map((customer) => (
                    <div
                        key={customer.renter_email}
                        className="p-6 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 flex-1">
                                {/* Avatar & Basic Info */}
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-blue-600" />
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center space-x-3">
                                        <h4 className="text-lg font-medium text-gray-900 truncate">
                                            {customer.renter_name}
                                        </h4>
                                        {getStatusIcon(customer)}
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(customer.renter_score)}`}
                                        >
                                            Score: {customer.renter_score}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate">
                                        {customer.renter_email}
                                    </p>
                                </div>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={() => {
                                    // Validate customer data before attempting conversation
                                    if (!customer.renter_id) {
                                        console.error(
                                            '[CustomerList] Missing renter_id for customer:',
                                            customer,
                                        );
                                        alert(
                                            'Unable to start conversation: Missing customer ID. Please refresh and try again.',
                                        );
                                        return;
                                    }

                                    if (!customer.renter_email) {
                                        console.error(
                                            '[CustomerList] Missing renter_email for customer:',
                                            customer,
                                        );
                                        alert(
                                            'Unable to start conversation: Missing customer email. Please refresh and try again.',
                                        );
                                        return;
                                    }

                                    onStartConversation?.(
                                        customer.renter_email,
                                        customer.renter_name || 'Unknown User',
                                        customer.renter_id,
                                    );
                                }}
                                disabled={!customer.renter_id || !customer.renter_email}
                                className={`ml-4 inline-flex items-center px-4 py-2 border rounded-lg transition-colors ${
                                    !customer.renter_id || !customer.renter_email
                                        ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                                        : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
                                }`}
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Message
                            </button>
                        </div>

                        {/* Customer Stats */}
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {customer.bookings_with_this_host}
                                    </p>
                                    <p className="text-xs text-gray-600">Bookings</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <DollarSign className="w-4 h-4 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        ${customer.total_spent.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-600">Total Spent</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Star className="w-4 h-4 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {customer.completed_bookings}/{customer.total_bookings}
                                    </p>
                                    <p className="text-xs text-gray-600">Completed</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {formatDate(customer.last_booking_date)}
                                    </p>
                                    <p className="text-xs text-gray-600">Last Booking</p>
                                </div>
                            </div>
                        </div>

                        {/* Reliability Indicators */}
                        {(customer.cancellation_rate > 0 || customer.renter_score < 70) && (
                            <div className="mt-3 flex items-center space-x-4 text-sm">
                                {customer.cancellation_rate > 0 && (
                                    <span className="text-amber-600">
                                        ⚠️ {Math.round(customer.cancellation_rate * 100)}%
                                        cancellation rate
                                    </span>
                                )}
                                {customer.renter_score < 70 && (
                                    <span className="text-red-600">📉 Low renter score</span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
