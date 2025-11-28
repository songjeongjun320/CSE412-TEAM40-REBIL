'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// import { useTranslation } from 'react-i18next';

import { ReviewCard } from '@/components/reviews/ReviewCard';
import { StarRating } from '@/components/ui/StarRating';
import { createClient } from '@/lib/supabase/supabaseClient';
// import { formatCurrency } from '@/lib/utils';
import type { ReviewWithDetails } from '@/types/reviews.types';

interface ReviewStats {
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
}

export default function HostReviewsPage() {
    // const { t } = useTranslation();
    const router = useRouter();
    const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
    const [stats, setStats] = useState<ReviewStats>({
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

    const fetchHostReviews = useCallback(async () => {
        try {
            const supabase = createClient();

            // Get current user
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();
            if (userError || !user) {
                router.push('/login');
                return;
            }

            // Fetch reviews for this host with detailed information
            const { data: reviewsData, error: reviewsError } = await supabase
                .from('reviews')
                .select(
                    `
                    *,
                    reviewer:user_profiles!reviews_reviewer_id_fkey(
                        id,
                        full_name,
                        profile_image_url
                    ),
                    reviewed_user:user_profiles!reviews_reviewed_id_fkey(
                        id,
                        full_name,
                        profile_image_url
                    ),
                    car:cars!reviews_car_id_fkey(
                        id,
                        year,
                        make,
                        model
                    ),
                    booking:bookings!reviews_booking_id_fkey(
                        id,
                        start_date,
                        end_date,
                        total_amount
                    )
                `,
                )
                .eq('reviewed_id', user.id)
                .order('created_at', { ascending: false });

            if (reviewsError) {
                console.error('Error fetching reviews:', reviewsError);
                setError('Failed to load reviews');
                return;
            }

            // Transform the data to match the ReviewWithDetails type
            const formattedReviews: ReviewWithDetails[] = (reviewsData || []).map(
                (review: any) => ({
                    ...review,
                    reviewer: {
                        id: review.reviewer?.id || '',
                        full_name: review.reviewer?.full_name || null,
                        profile_image_url: review.reviewer?.profile_image_url || null,
                    },
                    reviewed_user: {
                        id: review.reviewed_user?.id || '',
                        full_name: review.reviewed_user?.full_name || null,
                        profile_image_url: review.reviewed_user?.profile_image_url || null,
                    },
                    car: {
                        id: review.car?.id || '',
                        make: review.car?.make || '',
                        model: review.car?.model || '',
                        year: review.car?.year || new Date().getFullYear(),
                    },
                    booking: {
                        id: review.booking?.id || '',
                        start_date: review.booking?.start_date || '',
                        end_date: review.booking?.end_date || '',
                    },
                }),
            );

            setReviews(formattedReviews);

            // Calculate stats
            const totalReviews = formattedReviews.length;
            const averageRating =
                totalReviews > 0
                    ? formattedReviews.reduce((sum, review) => sum + review.rating, 0) /
                      totalReviews
                    : 0;

            const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            formattedReviews.forEach((review) => {
                const rating = review.rating as keyof typeof ratingDistribution;
                if (rating >= 1 && rating <= 5) {
                    ratingDistribution[rating]++;
                }
            });

            setStats({
                totalReviews,
                averageRating,
                ratingDistribution,
            });
        } catch (error) {
            console.error('Error:', error);
            setError('An error occurred while loading reviews');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchHostReviews();
    }, [fetchHostReviews]);

    const getFilteredAndSortedReviews = () => {
        let filtered = reviews;

        // Apply filter
        if (filter === 'public') {
            filtered = filtered.filter((review) => review.is_public);
        } else if (filter === 'private') {
            filtered = filtered.filter((review) => !review.is_public);
        }

        // Apply sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'oldest':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'highest':
                    return b.rating - a.rating;
                case 'lowest':
                    return a.rating - b.rating;
                default:
                    return 0;
            }
        });

        return filtered;
    };

    const getRatingBarWidth = (rating: number) => {
        const count =
            stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution] || 0;
        return stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading reviews...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={fetchHostReviews}
                        className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const filteredReviews = getFilteredAndSortedReviews();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-6">
                            <Link
                                href="/home"
                                className="text-2xl font-bold text-black hover:text-gray-700 transition-colors"
                            >
                                REBIL - Host Reviews
                            </Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/home"
                                className="text-gray-700 hover:text-black transition-colors"
                            >
                                Back to Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                {/* Review Statistics */}
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-400 mb-8">
                    <h2 className="text-2xl font-bold text-black mb-6">Review Statistics</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Overall Rating */}
                        <div className="text-center">
                            <div className="text-5xl font-bold text-black mb-2">
                                {stats.averageRating.toFixed(1)}
                            </div>
                            <StarRating rating={stats.averageRating} size="lg" />
                            <div className="text-gray-600 mt-2">
                                Based on {stats.totalReviews} review
                                {stats.totalReviews !== 1 ? 's' : ''}
                            </div>
                        </div>

                        {/* Rating Distribution */}
                        <div>
                            <h3 className="text-lg font-semibold text-black mb-4">
                                Rating Distribution
                            </h3>
                            {[5, 4, 3, 2, 1].map((rating) => (
                                <div key={rating} className="flex items-center mb-2">
                                    <span className="w-12 text-sm text-gray-600">
                                        {rating} star{rating !== 1 ? 's' : ''}
                                    </span>
                                    <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${getRatingBarWidth(rating)}%` }}
                                        />
                                    </div>
                                    <span className="w-8 text-sm text-gray-600 text-right">
                                        {stats.ratingDistribution[
                                            rating as keyof typeof stats.ratingDistribution
                                        ] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Filters and Sorting */}
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-400 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-sm font-medium text-gray-700 mr-2">Filter:</span>
                            {[
                                { key: 'all', label: 'All Reviews' },
                                { key: 'public', label: 'Public' },
                                { key: 'private', label: 'Private' },
                            ].map((f) => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key as any)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors border ${
                                        filter === f.key
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Sort:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="highest">Highest Rating</option>
                                <option value="lowest">Lowest Rating</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Reviews List */}
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-400">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-black">
                            Your Reviews ({filteredReviews.length})
                        </h3>
                    </div>

                    {filteredReviews.length > 0 ? (
                        <div className="space-y-6">
                            {filteredReviews.map((review) => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    showCar={true}
                                    showReviewer={true}
                                    showReviewee={false}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">⭐</div>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">
                                {filter === 'all' ? 'No reviews yet' : `No ${filter} reviews`}
                            </h3>
                            <p className="text-gray-600 mb-4">
                                {filter === 'all'
                                    ? 'Reviews from your guests will appear here after completed bookings.'
                                    : `You don't have any ${filter} reviews at the moment.`}
                            </p>
                            {filter !== 'all' && (
                                <button
                                    onClick={() => setFilter('all')}
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    View all reviews
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
