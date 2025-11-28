'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { CreateReviewRequest, ReviewFormProps } from '@/types/reviews.types';

import { StarRating } from '../ui/StarRating';
import { Button } from '../ui/button';

export function ReviewForm({
    bookingId,
    reviewerId,
    reviewedId,
    carId,
    onSuccess,
    onCancel,
    className,
}: ReviewFormProps) {
    const [rating, setRating] = useState<number>(0);
    const [comment, setComment] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (rating === 0) {
            setError('Please select a rating');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const reviewData: CreateReviewRequest = {
                booking_id: bookingId,
                reviewer_id: reviewerId,
                reviewed_id: reviewedId,
                car_id: carId,
                rating,
                comment: comment.trim() || undefined,
                is_public: isPublic,
            };

            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewData),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to create review');
            }

            if (onSuccess && result.data) {
                onSuccess(result.data);
            }

            // Reset form
            setRating(0);
            setComment('');
            setIsPublic(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFormValid = rating > 0;

    return (
        <motion.form
            className={cn('bg-white border border-gray-200 rounded-lg p-6 space-y-6', className)}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
        >
            {/* Form title */}
            <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">Leave a Review</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Share your experience to help other users
                </p>
            </div>

            {/* Rating selection */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    Rating <span className="text-red-500">*</span>
                </label>
                <div className="flex justify-center">
                    <StarRating
                        rating={rating}
                        interactive
                        size="xl"
                        onChange={setRating}
                        disabled={isSubmitting}
                    />
                </div>
                {rating > 0 && (
                    <p className="text-center text-sm text-gray-600">
                        {rating === 1 && 'Poor'}
                        {rating === 2 && 'Fair'}
                        {rating === 3 && 'Good'}
                        {rating === 4 && 'Very Good'}
                        {rating === 5 && 'Excellent'}
                    </p>
                )}
            </div>

            {/* Comment */}
            <div className="space-y-2">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                    Comment (Optional)
                </label>
                <textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share details about your experience..."
                    disabled={isSubmitting}
                    className={cn(
                        'w-full px-3 py-2 border border-gray-300 rounded-md',
                        'focus:ring-2 focus:ring-black focus:border-transparent',
                        'disabled:bg-gray-50 disabled:text-gray-500',
                        'resize-none transition-all duration-200',
                    )}
                    rows={4}
                    maxLength={1000}
                />
                <div className="flex justify-between text-xs text-gray-500">
                    <span>Help others by sharing your experience</span>
                    <span>{comment.length}/1000</span>
                </div>
            </div>

            {/* Privacy setting */}
            <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        disabled={isSubmitting}
                        className="sr-only peer"
                    />
                    <div
                        className={cn(
                            'w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-black',
                            'rounded-full peer transition-all duration-200',
                            'peer-checked:after:translate-x-full peer-checked:after:border-white',
                            'after:content-[""] after:absolute after:top-[2px] after:left-[2px]',
                            'after:bg-white after:border-gray-300 after:border after:rounded-full',
                            'after:h-5 after:w-5 after:transition-all peer-checked:bg-black',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                    />
                </label>
                <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 cursor-pointer">
                        Make review public
                    </label>
                    <p className="text-xs text-gray-500">
                        Public reviews help other users make informed decisions
                    </p>
                </div>
            </div>

            {/* Error message */}
            {error && (
                <motion.div
                    className="p-3 bg-red-50 border border-red-200 rounded-md"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                >
                    <p className="text-sm text-red-600">{error}</p>
                </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
                {onCancel && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    loading={isSubmitting}
                    className="flex-1"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </Button>
            </div>
        </motion.form>
    );
}

// Simplified version for modal or inline use
export function ReviewFormInline({
    bookingId,
    reviewerId,
    reviewedId,
    carId,
    onSuccess,
    className,
}: Omit<ReviewFormProps, 'onCancel'> & { className?: string }) {
    const [rating, setRating] = useState<number>(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) return;

        setIsSubmitting(true);

        try {
            const reviewData: CreateReviewRequest = {
                booking_id: bookingId,
                reviewer_id: reviewerId,
                reviewed_id: reviewedId,
                car_id: carId,
                rating,
                comment: comment.trim() || undefined,
                is_public: true,
            };

            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewData),
            });

            const result = await response.json();

            if (result.success) {
                setIsSubmitted(true);
                if (onSuccess && result.data) {
                    onSuccess(result.data);
                }
            }
        } catch (error) {
            console.error('Error submitting review:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className={cn('text-center p-4 text-green-600', className)}>
                <p className="text-sm">Thank you for your review!</p>
            </div>
        );
    }

    return (
        <div className={cn('space-y-3', className)}>
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Rate your experience:</span>
                <StarRating
                    rating={rating}
                    interactive
                    size="md"
                    onChange={setRating}
                    disabled={isSubmitting}
                />
            </div>

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-none"
                rows={2}
                maxLength={200}
                disabled={isSubmitting}
            />

            <Button
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                loading={isSubmitting}
                size="sm"
                className="w-full"
            >
                Submit Review
            </Button>
        </div>
    );
}
