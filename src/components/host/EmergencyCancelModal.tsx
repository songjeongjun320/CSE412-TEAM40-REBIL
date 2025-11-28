'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    EMERGENCY_REASON_DESCRIPTIONS,
    EMERGENCY_REASON_LABELS,
    calculateEmergencyCancellationFee,
    formatFeeRate,
    getCancellationTimingText,
} from '@/lib/utils';
import {
    EmergencyCancelModalProps,
    EmergencyCancellationReason,
    EmergencyCancellationResult,
} from '@/types/booking.types';

export default function EmergencyCancelModal({
    booking,
    onClose,
    onConfirm,
    loading,
}: EmergencyCancelModalProps) {
    const [selectedReason, setSelectedReason] = useState<EmergencyCancellationReason | null>(null);
    const [details, setDetails] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [cancellationResult, setCancellationResult] =
        useState<EmergencyCancellationResult | null>(null);

    // Calculate and update fees
    useEffect(() => {
        if (selectedReason) {
            const result = calculateEmergencyCancellationFee(booking, selectedReason);
            setCancellationResult(result);
        } else {
            setCancellationResult(null);
        }
    }, [selectedReason, booking]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedReason && details.trim() && agreed && cancellationResult) {
            onConfirm(selectedReason, details.trim());
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
        }).format(amount);
    };

    const reasonOptions: EmergencyCancellationReason[] = [
        'vehicleBreakdown',
        'medicalEmergency',
        'naturalDisaster',
        'familyEmergency',
        'other',
    ];

    const getFeeColor = (feeRate: number) => {
        if (feeRate === 0) return 'text-black';
        if (feeRate <= 0.1) return 'text-gray-700';
        if (feeRate <= 0.2) return 'text-gray-600';
        return 'text-red-600';
    };

    const getDiscountText = (reason: EmergencyCancellationReason) => {
        const discounts = {
            vehicleBreakdown: '50% discount',
            medicalEmergency: '70% discount',
            naturalDisaster: '100% discount',
            familyEmergency: '60% discount',
            other: 'No discount',
        };
        return discounts[reason];
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
                <form onSubmit={handleSubmit}>
                    {/* Warning Header */}
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-4 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">
                                    Emergency Booking Cancellation
                                </h2>
                                <p className="text-red-100 text-sm">This action cannot be undone</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Booking Information */}
                        <Card className="bg-gray-50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <svg
                                        className="w-5 h-5 text-blue-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                    Booking Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="font-medium text-gray-800">Booking Number</p>
                                        <p className="text-gray-600">
                                            #{booking.id.substring(0, 8)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">Total Amount</p>
                                        <p className="text-gray-600 font-semibold">
                                            {formatCurrency(booking.total_amount)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">
                                            Cancellation Timing
                                        </p>
                                        <p className="text-gray-600">
                                            {getCancellationTimingText(booking)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">Rental Period</p>
                                        <p className="text-gray-600">{booking.total_days} days</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Cancellation Policy */}
                        <Card className="border-orange-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                                        />
                                    </svg>
                                    Emergency Cancellation Policy
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                                    <h4 className="font-semibold text-orange-800 mb-2">
                                        Base Cancellation Fee
                                    </h4>
                                    <div className="space-y-1 text-sm text-orange-700">
                                        <div className="flex justify-between">
                                            <span>Before rental start</span>
                                            <span className="font-medium">10%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>During rental</span>
                                            <span className="font-medium">30%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>After rental end</span>
                                            <span className="font-medium">50%</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600">
                                    Additional discounts are applied to the above fees for emergency
                                    reasons.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Cancellation Reason */}
                        <div>
                            <label className="block text-sm font-medium text-gray-800 mb-3">
                                Select Cancellation Reason <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-2">
                                {reasonOptions.map((reason) => (
                                    <div key={reason} className="relative">
                                        <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                            <input
                                                type="radio"
                                                name="cancellationReason"
                                                value={reason}
                                                checked={selectedReason === reason}
                                                onChange={(e) =>
                                                    setSelectedReason(
                                                        e.target
                                                            .value as EmergencyCancellationReason,
                                                    )
                                                }
                                                className="mt-1 text-orange-600 focus:ring-orange-500"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium text-gray-900">
                                                        {EMERGENCY_REASON_LABELS[reason]}
                                                    </p>
                                                    <span className="text-sm font-medium text-green-600">
                                                        {getDiscountText(reason)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {EMERGENCY_REASON_DESCRIPTIONS[reason]}
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detailed Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-800 mb-2">
                                Detailed Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder="Please provide a detailed explanation of the cancellation reason. If necessary, supporting documents can be submitted."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                                rows={4}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Accurate explanation of the reason is helpful for refund processing.
                            </p>
                        </div>

                        {/* Fee Calculator */}
                        {cancellationResult && (
                            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                            />
                                        </svg>
                                        Fee Calculation Result
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b border-blue-200">
                                            <span className="text-gray-700">
                                                Original Booking Amount
                                            </span>
                                            <span className="font-semibold">
                                                {formatCurrency(booking.total_amount)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-blue-200">
                                            <span className="text-gray-700">Applied Fee Rate</span>
                                            <span
                                                className={`font-semibold ${getFeeColor(cancellationResult.feeRate)}`}
                                            >
                                                {formatFeeRate(cancellationResult.feeRate)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-blue-200">
                                            <span className="text-gray-700">Cancellation Fee</span>
                                            <span className="font-semibold text-red-600">
                                                -{formatCurrency(cancellationResult.fee)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 bg-white rounded-lg px-3 border-2 border-green-200">
                                            <span className="font-semibold text-gray-900">
                                                Expected Refund Amount
                                            </span>
                                            <span className="text-xl font-bold text-green-600">
                                                {formatCurrency(cancellationResult.refund)}
                                            </span>
                                        </div>
                                    </div>

                                    {cancellationResult.feeRate === 0 && (
                                        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg flex items-center gap-2">
                                            <svg
                                                className="w-5 h-5 text-green-600 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            <p className="text-sm text-green-800">
                                                <strong>Full Refund:</strong> Due to the reason you
                                                selected, cancellation fees are waived.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Agreement Checkbox */}
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <input
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    className="mt-1 text-orange-600 focus:ring-orange-500"
                                />
                                <div className="text-sm text-yellow-800">
                                    <p className="font-medium mb-1">
                                        Emergency Cancellation Policy Agreement
                                    </p>
                                    <ul className="space-y-1 text-xs">
                                        <li>
                                            • I understand and agree to the emergency cancellation
                                            policy
                                        </li>
                                        <li>• I confirm that this action cannot be undone</li>
                                        <li>
                                            • Refunds will be processed within 3-5 business days
                                        </li>
                                        <li>
                                            • I will cooperate with the submission of supporting
                                            documents if needed
                                        </li>
                                    </ul>
                                </div>
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || !selectedReason || !details.trim() || !agreed}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Processing...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        Confirm Emergency Cancellation
                                    </div>
                                )}
                            </Button>
                        </div>

                        {/* Warning Footer */}
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <svg
                                    className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <div className="text-sm text-red-800">
                                    <p className="font-medium mb-1">Important Notes</p>
                                    <ul className="space-y-1 text-xs">
                                        <li>
                                            • After emergency cancellation, the booking cannot be
                                            restored.
                                        </li>
                                        <li>
                                            • Additional fees may be charged for incorrect
                                            information provided.
                                        </li>
                                        <li>
                                            • For inquiries, please contact the customer center
                                            (1588-0000).
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
