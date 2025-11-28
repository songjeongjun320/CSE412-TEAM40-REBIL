'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { StarRatingProps } from '@/types/reviews.types';

const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
};

const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
};

export function StarRating({
    rating,
    maxRating = 5,
    size = 'md',
    interactive = false,
    onChange,
    showCount = false,
    totalReviews,
    className,
    disabled = false,
}: StarRatingProps) {
    const [hoverRating, setHoverRating] = useState(0);

    // Defensive error handling for invalid rating values
    const safeRating =
        typeof rating === 'number' && !isNaN(rating) && isFinite(rating)
            ? Math.max(0, Math.min(rating, maxRating))
            : 0;

    const safeTotalReviews =
        typeof totalReviews === 'number' && !isNaN(totalReviews) && totalReviews >= 0
            ? totalReviews
            : undefined;

    const handleMouseEnter = (starIndex: number) => {
        if (interactive && !disabled) {
            setHoverRating(starIndex + 1);
        }
    };

    const handleMouseLeave = () => {
        if (interactive && !disabled) {
            setHoverRating(0);
        }
    };

    const handleClick = (starIndex: number) => {
        if (interactive && !disabled && onChange) {
            const newRating = starIndex + 1;
            onChange(newRating);
        }
    };

    const displayRating = interactive ? hoverRating || safeRating : safeRating;
    const isClickable = interactive && !disabled;

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                className={cn(
                    'flex items-center gap-0.5',
                    isClickable && 'cursor-pointer',
                    disabled && 'opacity-50 cursor-not-allowed',
                )}
                onMouseLeave={handleMouseLeave}
            >
                {Array.from({ length: maxRating }, (_, i) => {
                    const starIndex = i;
                    const isFilled = displayRating > starIndex;
                    const isPartiallyFilled =
                        displayRating > starIndex && displayRating < starIndex + 1;
                    const fillPercentage = isPartiallyFilled
                        ? (displayRating - starIndex) * 100
                        : 100;

                    return (
                        <motion.div
                            key={starIndex}
                            className="relative"
                            whileHover={isClickable ? { scale: 1.1 } : {}}
                            whileTap={isClickable ? { scale: 0.95 } : {}}
                            transition={{ duration: 0.1 }}
                            onMouseEnter={() => handleMouseEnter(starIndex)}
                            onClick={() => handleClick(starIndex)}
                        >
                            <Star
                                className={cn(
                                    sizeClasses[size],
                                    'transition-colors duration-200',
                                    isFilled
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : isClickable && hoverRating > starIndex
                                          ? 'text-yellow-300 fill-yellow-300'
                                          : 'text-gray-300 fill-none',
                                    isClickable && 'hover:text-yellow-300',
                                )}
                                strokeWidth={1.5}
                            />

                            {/* Partial fill overlay */}
                            {isPartiallyFilled && (
                                <div className="absolute inset-0 overflow-hidden">
                                    <Star
                                        className={cn(
                                            sizeClasses[size],
                                            'text-yellow-400 fill-yellow-400 transition-colors duration-200',
                                        )}
                                        strokeWidth={1.5}
                                        style={{
                                            clipPath: `inset(0 ${100 - fillPercentage}% 0 0)`,
                                        }}
                                    />
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Rating text and count */}
            <div className={cn('flex items-center gap-1', textSizeClasses[size])}>
                {safeRating > 0 && (
                    <span className="font-medium text-gray-900">
                        {safeRating % 1 === 0 ? safeRating.toFixed(0) : safeRating.toFixed(1)}
                    </span>
                )}

                {showCount && safeTotalReviews !== undefined && (
                    <span className="text-gray-500">
                        ({safeTotalReviews} {safeTotalReviews === 1 ? 'review' : 'reviews'})
                    </span>
                )}
            </div>
        </div>
    );
}

// Compact version for tight spaces
export function StarRatingCompact({
    rating,
    totalReviews,
    size = 'sm',
    className,
}: {
    rating: number;
    totalReviews?: number;
    size?: 'sm' | 'md';
    className?: string;
}) {
    // Defensive error handling for invalid rating values
    const safeRating =
        typeof rating === 'number' && !isNaN(rating) && isFinite(rating)
            ? Math.max(0, Math.min(rating, 5))
            : 0;

    const safeTotalReviews =
        typeof totalReviews === 'number' && !isNaN(totalReviews) && totalReviews >= 0
            ? totalReviews
            : undefined;

    return (
        <div className={cn('flex items-center gap-1', className)}>
            <Star
                className={cn(
                    sizeClasses[size],
                    safeRating > 0 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
                    'flex-shrink-0',
                )}
                strokeWidth={1.5}
            />
            <span className={cn(textSizeClasses[size], 'font-medium text-gray-900')}>
                {safeRating > 0
                    ? safeRating % 1 === 0
                        ? safeRating.toFixed(0)
                        : safeRating.toFixed(1)
                    : '—'}
            </span>
            {safeTotalReviews !== undefined && safeTotalReviews > 0 && (
                <span className={cn(textSizeClasses[size], 'text-gray-500')}>
                    ({safeTotalReviews})
                </span>
            )}
        </div>
    );
}

// Rating breakdown component for showing distribution
export function RatingBreakdown({
    stats,
    className,
}: {
    stats:
        | {
              total_reviews: number;
              average_rating: number;
              rating_1_count: number;
              rating_2_count: number;
              rating_3_count: number;
              rating_4_count: number;
              rating_5_count: number;
          }
        | null
        | undefined;
    className?: string;
}) {
    // Defensive error handling for invalid stats
    if (!stats) {
        return (
            <div className={cn('text-center text-gray-500', className)}>
                <p className="text-sm">Unable to load review statistics</p>
            </div>
        );
    }

    const safeStats = {
        total_reviews:
            typeof stats.total_reviews === 'number' &&
            !isNaN(stats.total_reviews) &&
            stats.total_reviews >= 0
                ? stats.total_reviews
                : 0,
        average_rating:
            typeof stats.average_rating === 'number' &&
            !isNaN(stats.average_rating) &&
            isFinite(stats.average_rating)
                ? Math.max(0, Math.min(stats.average_rating, 5))
                : 0,
        rating_1_count:
            typeof stats.rating_1_count === 'number' &&
            !isNaN(stats.rating_1_count) &&
            stats.rating_1_count >= 0
                ? stats.rating_1_count
                : 0,
        rating_2_count:
            typeof stats.rating_2_count === 'number' &&
            !isNaN(stats.rating_2_count) &&
            stats.rating_2_count >= 0
                ? stats.rating_2_count
                : 0,
        rating_3_count:
            typeof stats.rating_3_count === 'number' &&
            !isNaN(stats.rating_3_count) &&
            stats.rating_3_count >= 0
                ? stats.rating_3_count
                : 0,
        rating_4_count:
            typeof stats.rating_4_count === 'number' &&
            !isNaN(stats.rating_4_count) &&
            stats.rating_4_count >= 0
                ? stats.rating_4_count
                : 0,
        rating_5_count:
            typeof stats.rating_5_count === 'number' &&
            !isNaN(stats.rating_5_count) &&
            stats.rating_5_count >= 0
                ? stats.rating_5_count
                : 0,
    };

    const totalReviews = safeStats.total_reviews;

    if (totalReviews === 0) {
        return (
            <div className={cn('text-center text-gray-500', className)}>
                <p className="text-sm">No reviews yet</p>
            </div>
        );
    }

    return (
        <div className={cn('space-y-2', className)}>
            {/* Overall rating */}
            <div className="flex items-center justify-between">
                <StarRating
                    rating={safeStats.average_rating}
                    showCount
                    totalReviews={totalReviews}
                />
            </div>

            {/* Rating distribution */}
            <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((rating) => {
                    const count = safeStats[
                        `rating_${rating}_count` as keyof typeof safeStats
                    ] as number;
                    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                    const safePercentage = isFinite(percentage) ? percentage : 0;

                    return (
                        <div key={rating} className="flex items-center gap-2 text-sm">
                            <span className="flex items-center gap-1 w-8">
                                <span>{rating}</span>
                                <Star
                                    className="w-3 h-3 text-yellow-400 fill-yellow-400"
                                    strokeWidth={1.5}
                                />
                            </span>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-yellow-400 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${safePercentage}%` }}
                                    transition={{ duration: 0.5, delay: (5 - rating) * 0.1 }}
                                />
                            </div>
                            <span className="text-gray-500 w-8 text-right">{count}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
