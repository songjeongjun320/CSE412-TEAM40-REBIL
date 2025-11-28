'use client';

import { motion } from 'framer-motion';
import { Calendar, Car, User } from 'lucide-react';
import { memo } from 'react';

import { StarRating } from '@/components/ui/StarRating';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReviewCardProps } from '@/types/reviews.types';

const ReviewCardComponent = ({
    review,
    showCar = true,
    showReviewer = true,
    showReviewee = true,
    className,
}: ReviewCardProps) => {
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDateRelative = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
        if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
        return `${Math.floor(diffInDays / 365)} years ago`;
    };

    const getProfileImageUrl = (imageUrl: string | null, name: string | null) => {
        if (imageUrl) return imageUrl;

        // Generate a simple avatar based on initials
        const initials =
            name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || '??';

        return `data:image/svg+xml;base64,${btoa(`
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="#6B7280"/>
        <text x="20" y="26" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">
          ${initials}
        </text>
      </svg>
    `)}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('w-full', className)}
        >
            <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
                <CardContent className="p-6">
                    {/* Header with rating and date */}
                    <div className="flex items-start justify-between mb-4">
                        <StarRating rating={review.rating} size="md" />
                        <span className="text-sm text-gray-500">
                            {formatDateRelative(review.created_at)}
                        </span>
                    </div>

                    {/* Comment */}
                    {review.comment && (
                        <p className="text-gray-800 mb-4 leading-relaxed">
                            &ldquo;{review.comment}&rdquo;
                        </p>
                    )}

                    {/* Reviewer Info */}
                    {showReviewer && (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                                <img
                                    src={getProfileImageUrl(
                                        review.reviewer.profile_image_url,
                                        review.reviewer.full_name,
                                    )}
                                    alt={review.reviewer.full_name || 'Reviewer'}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">
                                    {review.reviewer.full_name || 'Anonymous'}
                                </p>
                                <p className="text-xs text-gray-500">Reviewer</p>
                            </div>
                        </div>
                    )}

                    {/* Reviewee Info */}
                    {showReviewee && (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                                <img
                                    src={getProfileImageUrl(
                                        review.reviewed_user.profile_image_url,
                                        review.reviewed_user.full_name,
                                    )}
                                    alt={review.reviewed_user.full_name || 'Reviewed user'}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">
                                    {review.reviewed_user.full_name || 'Anonymous'}
                                </p>
                                <p className="text-xs text-gray-500">Reviewed</p>
                            </div>
                        </div>
                    )}

                    {/* Trip Details */}
                    <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
                        {showCar && (
                            <div className="flex items-center gap-1">
                                <Car className="w-3 h-3" />
                                <span>
                                    {review.car.year} {review.car.make} {review.car.model}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                                {formatDate(review.booking.start_date)} -{' '}
                                {formatDate(review.booking.end_date)}
                            </span>
                        </div>
                    </div>

                    {/* Public indicator */}
                    {!review.is_public && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                <User className="w-3 h-3 mr-1" />
                                Private Review
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

// Memoize to prevent unnecessary re-renders
export const ReviewCard = memo(ReviewCardComponent, (prevProps, nextProps) => {
    return (
        prevProps.review.id === nextProps.review.id &&
        prevProps.review.created_at === nextProps.review.created_at &&
        prevProps.showCar === nextProps.showCar &&
        prevProps.showReviewer === nextProps.showReviewer &&
        prevProps.showReviewee === nextProps.showReviewee &&
        prevProps.className === nextProps.className
    );
});
