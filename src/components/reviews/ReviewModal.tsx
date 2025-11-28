'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { useState } from 'react';

import { StarRating } from '@/components/ui/StarRating';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { CreateReviewRequest, Rating } from '@/types/reviews.types';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reviewData: CreateReviewRequest) => Promise<void>;
    booking: {
        id: string;
        car: {
            id: string;
            make: string;
            model: string;
            year: number;
        };
        host?: {
            id: string;
            full_name: string;
        };
        renter?: {
            id: string;
            full_name: string;
        };
        start_date: string;
        end_date: string;
        total_amount: number;
    };
    currentUserId: string;
    loading?: boolean;
}

export function ReviewModal({
    isOpen,
    onClose,
    onSubmit,
    booking,
    currentUserId,
    loading = false,
}: ReviewModalProps) {
    const [rating, setRating] = useState<Rating | 0>(0);
    const [comment, setComment] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Determine if current user is the host or renter
    const isHost = booking.host?.id === currentUserId;

    // The person being reviewed
    const reviewedPerson = isHost ? booking.renter : booking.host;
    const reviewerRole = isHost ? 'Host' : 'Renter';
    const reviewedRole = isHost ? 'Renter' : 'Host';

    const handleSubmit = async () => {
        if (!rating || !reviewedPerson) return;

        setSubmitting(true);
        try {
            const reviewData: CreateReviewRequest = {
                booking_id: booking.id,
                reviewer_id: currentUserId,
                reviewed_id: reviewedPerson.id,
                car_id: booking.car.id,
                rating: rating as Rating,
                comment: comment.trim() || undefined,
                is_public: isPublic,
            };

            await onSubmit(reviewData);

            // Reset form
            setRating(0);
            setComment('');
            setIsPublic(true);
            onClose();
        } catch (error) {
            console.error('Error submitting review:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getRatingDescription = (rating: number) => {
        const descriptions = {
            1: 'Poor',
            2: 'Fair',
            3: 'Good',
            4: 'Very Good',
            5: 'Excellent',
        };
        return descriptions[rating as keyof typeof descriptions] || '';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
                <Card className="border-none shadow-none">
                    <CardContent className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <MessageCircle className="w-6 h-6 text-blue-600" />
                                    Leave a Review
                                </h2>
                                <p className="text-gray-600 text-sm mt-1">
                                    Share your experience as a {reviewerRole.toLowerCase()}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Booking Summary */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-6">
                            <h3 className="font-semibold text-gray-900 mb-2">Trip Details</h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Vehicle:</span>
                                    <span className="font-medium">
                                        {booking.car.year} {booking.car.make} {booking.car.model}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Dates:</span>
                                    <span className="font-medium">
                                        {formatDate(booking.start_date)} -{' '}
                                        {formatDate(booking.end_date)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">{reviewedRole}:</span>
                                    <span className="font-medium">
                                        {reviewedPerson?.full_name || 'Unknown'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Total:</span>
                                    <span className="font-bold text-lg">
                                        {formatCurrency(booking.total_amount)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Rating Section */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Rate your experience *
                            </label>
                            <div className="flex items-center gap-4 mb-2">
                                <StarRating
                                    rating={rating}
                                    interactive
                                    size="lg"
                                    onChange={(newRating) => setRating(newRating as Rating)}
                                    disabled={submitting || loading}
                                />
                                {rating > 0 && (
                                    <span className="text-lg font-medium text-gray-900">
                                        {getRatingDescription(rating)}
                                    </span>
                                )}
                            </div>
                            {rating === 0 && (
                                <p className="text-sm text-gray-500">
                                    Click on a star to rate your experience
                                </p>
                            )}
                        </div>

                        {/* Comment Section */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Share your experience (optional)
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={`Tell other ${reviewerRole.toLowerCase()}s about your experience...`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={4}
                                maxLength={1000}
                                disabled={submitting}
                            />
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-gray-500">
                                    Help others make informed decisions
                                </p>
                                <p className="text-xs text-gray-500">{comment.length}/1000</p>
                            </div>
                        </div>

                        {/* Privacy Toggle */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    disabled={submitting || loading}
                                />
                                <span className="text-sm text-gray-700">
                                    Make this review public to help other users
                                </span>
                            </label>
                            <p className="text-xs text-gray-500 ml-7 mt-1">
                                Public reviews are visible to all users on the platform
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="flex-1"
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={rating === 0 || submitting || loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {submitting || loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Submitting...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Send className="w-4 h-4" />
                                        Submit Review
                                    </div>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
