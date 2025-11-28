import { NextRequest, NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/supabaseApi';
import type { GetReviewStatsResponse } from '@/types/reviews.types';

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiClient();
        const { searchParams } = new URL(request.url);

        const userId = searchParams.get('user_id');
        const carId = searchParams.get('car_id');

        if (!userId && !carId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Either user_id or car_id parameter is required',
                },
                { status: 400 },
            );
        }

        if (userId && carId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Cannot specify both user_id and car_id parameters',
                },
                { status: 400 },
            );
        }

        let result;

        if (userId) {
            // Get user review statistics
            const { data, error } = await supabase.rpc('get_user_review_stats', {
                user_uuid: userId,
            });

            if (error) {
                console.error('Supabase error while fetching user review stats:', error);
                throw new Error(`Supabase error: ${error.message}`);
            }

            result = data[0];
        } else if (carId) {
            try {
                // Add timeout wrapper for RPC function
                const rpcPromise = supabase.rpc('get_car_review_stats', {
                    car_uuid: carId,
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('RPC function timeout')), 3000),
                );

                const rpcResult = await Promise.race([rpcPromise, timeoutPromise]);
                const { data, error } = rpcResult as any;

                if (error) {
                    console.warn('RPC function failed, falling back to direct query:', error);
                    throw new Error('RPC failed, using fallback');
                } else {
                    result = data[0];
                }
            } catch {
                console.warn('RPC function failed or timed out, using direct query fallback');

                try {
                    // Optimized direct query with timeout
                    const directQueryPromise = supabase
                        .from('reviews')
                        .select('rating')
                        .eq('car_id', carId)
                        .eq('is_public', true);

                    const directTimeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Direct query timeout')), 2000),
                    );

                    const directResult = await Promise.race([
                        directQueryPromise,
                        directTimeoutPromise,
                    ]);
                    const { data: reviewData, error: reviewError } = directResult as any;

                    if (reviewError) {
                        console.error('Direct query also failed:', reviewError);
                        result = null;
                    } else {
                        // Calculate stats manually with optimized algorithm
                        const ratings = reviewData || [];
                        const totalReviews = ratings.length;

                        if (totalReviews === 0) {
                            result = {
                                total_reviews: 0,
                                average_rating: 0,
                                rating_1_count: 0,
                                rating_2_count: 0,
                                rating_3_count: 0,
                                rating_4_count: 0,
                                rating_5_count: 0,
                            };
                        } else {
                            const ratingCounts = [0, 0, 0, 0, 0];
                            let totalSum = 0;

                            for (const review of ratings) {
                                totalSum += review.rating;
                                ratingCounts[review.rating - 1]++;
                            }

                            const averageRating = totalSum / totalReviews;

                            result = {
                                total_reviews: totalReviews,
                                average_rating: Math.round(averageRating * 10) / 10,
                                rating_1_count: ratingCounts[0],
                                rating_2_count: ratingCounts[1],
                                rating_3_count: ratingCounts[2],
                                rating_4_count: ratingCounts[3],
                                rating_5_count: ratingCounts[4],
                            };
                        }
                    }
                } catch (directError) {
                    console.error('Direct query also failed:', directError);
                    result = null;
                }
            }
        }

        // Handle null result gracefully
        if (!result) {
            const response: GetReviewStatsResponse = {
                success: true,
                data: {
                    total_reviews: 0,
                    average_rating: 0,
                    rating_1_count: 0,
                    rating_2_count: 0,
                    rating_3_count: 0,
                    rating_4_count: 0,
                    rating_5_count: 0,
                },
            };
            return NextResponse.json(response);
        }

        // Format the response
        const response: GetReviewStatsResponse = {
            success: true,
            data: {
                total_reviews: result?.total_reviews || 0,
                average_rating: result?.average_rating || 0,
                rating_1_count: result?.rating_1_count || 0,
                rating_2_count: result?.rating_2_count || 0,
                rating_3_count: result?.rating_3_count || 0,
                rating_4_count: result?.rating_4_count || 0,
                rating_5_count: result?.rating_5_count || 0,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('API error fetching review statistics:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch review statistics',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
