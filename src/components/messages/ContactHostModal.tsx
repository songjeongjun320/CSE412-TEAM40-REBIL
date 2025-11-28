'use client';

import { Car, Clock, MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/hooks/cached/useAuth';

interface ContactHostModalProps {
    isOpen: boolean;
    onClose: () => void;
    hostName: string;
    hostId: string;
    vehicleName: string;
    vehicleId: string;
    onMessageSent?: () => void;
}

export function ContactHostModal({
    isOpen,
    onClose,
    hostName,
    hostId,
    vehicleName,
    vehicleId,
    onMessageSent,
}: ContactHostModalProps) {
    const {} = useAuth();
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [inquiryType, setInquiryType] = useState<'general' | 'booking'>('general');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setMessage('');
            setError(null);
            setSuccess(false);
            setIsSubmitting(false);
            setInquiryType('general');
            setStartDate('');
            setEndDate('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Rely on cookies for authentication instead of Authorization header
            // The middleware will handle setting the proper auth cookies
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            const requestBody: any = {
                host_id: hostId,
                vehicle_id: vehicleId,
                message: message.trim(),
                inquiry_type: inquiryType,
            };

            // Add dates if this is a booking inquiry
            if (inquiryType === 'booking' && startDate && endDate) {
                requestBody.preferred_start_date = startDate;
                requestBody.preferred_end_date = endDate;
            }

            const response = await fetch('/api/messages/inquiries', {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            setSuccess(true);
            setMessage('');

            // Auto-close after success
            setTimeout(() => {
                onClose();
                onMessageSent?.();
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center space-x-3">
                        <MessageCircle className="w-6 h-6 text-blue-600" />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Contact Host</h3>
                            <p className="text-sm text-gray-600">Send a message to {hostName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Vehicle Info */}
                <div className="px-6 py-4 bg-gray-50 border-b">
                    <div className="flex items-center space-x-3">
                        <Car className="w-5 h-5 text-gray-500" />
                        <div>
                            <p className="font-medium text-gray-900">{vehicleName}</p>
                            <p className="text-sm text-gray-600">Inquiry about this vehicle</p>
                        </div>
                    </div>
                </div>

                {success ? (
                    /* Success State */
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">Message Sent!</h4>
                        <p className="text-gray-600 mb-4">
                            Your message has been sent to {hostName}. They&apos;ll typically respond
                            within a few hours.
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">
                                💡 You can view and continue this conversation in your Messages
                                section.
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Message Form */
                    <form onSubmit={handleSubmit} className="p-6">
                        {/* Inquiry Type Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type of Inquiry
                            </label>
                            <div className="flex space-x-4">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="general"
                                        checked={inquiryType === 'general'}
                                        onChange={(e) =>
                                            setInquiryType(e.target.value as 'general')
                                        }
                                        className="w-4 h-4 text-blue-600"
                                        disabled={isSubmitting}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">
                                        General Question
                                    </span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        value="booking"
                                        checked={inquiryType === 'booking'}
                                        onChange={(e) =>
                                            setInquiryType(e.target.value as 'booking')
                                        }
                                        className="w-4 h-4 text-blue-600"
                                        disabled={isSubmitting}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">
                                        Booking Request
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Date Selection (only for booking inquiries) */}
                        {inquiryType === 'booking' && (
                            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">
                                    Preferred Rental Dates
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label
                                            htmlFor="startDate"
                                            className="block text-xs text-gray-600 mb-1"
                                        >
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            id="startDate"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            disabled={isSubmitting}
                                            required={inquiryType === 'booking'}
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="endDate"
                                            className="block text-xs text-gray-600 mb-1"
                                        >
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            id="endDate"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            min={
                                                startDate || new Date().toISOString().split('T')[0]
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            disabled={isSubmitting}
                                            required={inquiryType === 'booking'}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-600 mt-2">
                                    These dates will help the host provide accurate pricing and
                                    availability.
                                </p>
                            </div>
                        )}

                        <div className="mb-4">
                            <label
                                htmlFor="message"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Your Message
                            </label>
                            <textarea
                                id="message"
                                value={message}
                                onChange={(e) => {
                                    setMessage(e.target.value);
                                    setError(null);
                                }}
                                placeholder="Hi! I'm interested in your vehicle. Could you tell me more about..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={4}
                                maxLength={500}
                                disabled={isSubmitting}
                                required
                            />
                            <div className="flex justify-between items-center mt-2">
                                <p className="text-xs text-gray-500">
                                    Be specific about your questions to get a helpful response
                                </p>
                                <span
                                    className={`text-xs ${message.length > 400 ? 'text-orange-500' : 'text-gray-400'}`}
                                >
                                    {message.length}/500
                                </span>
                            </div>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {/* Response Time Info */}
                        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-amber-600" />
                                <p className="text-sm text-amber-800">
                                    Most hosts respond within 2-4 hours
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!message.trim() || isSubmitting}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <LoadingSpinner />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Send Message</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
