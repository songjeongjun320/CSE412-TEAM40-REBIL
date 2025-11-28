'use client';

import { useCallback, useState } from 'react';

import type {
    CreateReviewRequest,
    CreateReviewResponse,
    GetReviewStatsResponse,
    GetReviewsQuery,
    GetReviewsResponse,
    ReviewWithDetails,
    UpdateReviewRequest,
} from '@/types/reviews.types';

interface CanReviewResult {
    canReview: boolean;
    reason: string;
}

export function useReviews() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createReview = useCallback(
        async (reviewData: CreateReviewRequest): Promise<CreateReviewResponse> => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/reviews', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(reviewData),
                });

                if (!response.ok) {
                    // Try to get error message from JSON response if possible
                    let errorMessage = `Failed to create review: ${response.status} ${response.statusText}`;
                    try {
                        const errorResult = await response.json();
                        errorMessage = errorResult.error || errorResult.message || errorMessage;
                    } catch {
                        // If response is not JSON, use generic message
                    }
                    throw new Error(errorMessage);
                }

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Non-JSON response received:', text);
                    throw new Error('Server returned invalid response format');
                }

                const result = await response.json();

                return result;
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to create review';
                setError(errorMessage);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    const getReviews = useCallback(
        async (query: GetReviewsQuery = {}): Promise<ReviewWithDetails[]> => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams();
                Object.entries(query).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        params.append(key, String(value));
                    }
                });

                const response = await fetch(`/api/reviews?${params.toString()}`);

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch reviews: ${response.status} ${response.statusText}`,
                    );
                }

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Non-JSON response received:', text);
                    throw new Error('Server returned invalid response format');
                }

                const result: GetReviewsResponse = await response.json();

                return result.data || [];
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch reviews';
                setError(errorMessage);
                return [];
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    const updateReview = useCallback(async (reviewId: string, updateData: UpdateReviewRequest) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/reviews/${reviewId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to update review');
            }

            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update review';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteReview = useCallback(async (reviewId: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/reviews/${reviewId}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to delete review');
            }

            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete review';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const getReviewStats = useCallback(async (query: { user_id?: string; car_id?: string }) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });

            const response = await fetch(`/api/reviews/stats?${params.toString()}`);

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch review stats: ${response.status} ${response.statusText}`,
                );
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response received:', text);
                throw new Error('Server returned invalid response format');
            }

            const result: GetReviewStatsResponse = await response.json();

            return result.data;
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Failed to fetch review stats';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const checkCanReview = useCallback(
        async ({
            booking_id,
            reviewer_id,
            booking_status,
        }: {
            booking_id: string;
            reviewer_id: string;
            booking_status?: string;
        }): Promise<CanReviewResult> => {
            setLoading(true);
            setError(null);

            try {
                // Check if booking is completed (if status provided)
                if (booking_status && booking_status !== 'COMPLETED') {
                    return {
                        canReview: false,
                        reason: 'You can only review completed bookings.',
                    };
                }

                // Check if a review already exists for this booking and reviewer
                const existingReviews = await getReviews({
                    booking_id,
                    reviewer_id,
                    limit: 1,
                });

                if (existingReviews.length > 0) {
                    return {
                        canReview: false,
                        reason: 'You have already reviewed this booking.',
                    };
                }

                return {
                    canReview: true,
                    reason: 'You can leave a review for this completed trip.',
                };
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : 'Failed to check review eligibility';
                setError(errorMessage);
                return {
                    canReview: false,
                    reason: 'Unable to check review eligibility.',
                };
            } finally {
                setLoading(false);
            }
        },
        [getReviews],
    );

    return {
        loading,
        error,
        createReview,
        getReviews,
        updateReview,
        deleteReview,
        getReviewStats,
        checkCanReview,
    };
}
