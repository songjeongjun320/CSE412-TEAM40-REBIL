import { Database } from './base/database.types';

// Database types for reviews
export type Review = Database['public']['Tables']['reviews']['Row'];
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert'];
export type ReviewUpdate = Database['public']['Tables']['reviews']['Update'];

// Extended types for API responses
export interface ReviewWithDetails extends Review {
    reviewer: {
        id: string;
        full_name: string | null;
        profile_image_url: string | null;
    };
    reviewed_user: {
        id: string;
        full_name: string | null;
        profile_image_url: string | null;
    };
    car: {
        id: string;
        make: string;
        model: string;
        year: number;
    };
    booking: {
        id: string;
        start_date: string;
        end_date: string;
    };
}

// Review statistics types
export interface ReviewStats {
    total_reviews: number;
    average_rating: number;
    rating_1_count: number;
    rating_2_count: number;
    rating_3_count: number;
    rating_4_count: number;
    rating_5_count: number;
}

// API request/response types
export interface CreateReviewRequest {
    booking_id: string;
    reviewer_id: string;
    reviewed_id: string;
    car_id: string;
    rating: number;
    comment?: string;
    is_public?: boolean;
}

export interface CreateReviewResponse {
    success: boolean;
    review_id?: string;
    message: string;
    data?: Review;
}

export interface UpdateReviewRequest {
    rating?: number;
    comment?: string;
    is_public?: boolean;
}

export interface GetReviewsQuery {
    reviewed_id?: string;
    car_id?: string;
    reviewer_id?: string;
    booking_id?: string;
    is_public?: boolean;
    limit?: number;
    offset?: number;
    order_by?: 'created_at' | 'rating';
    order_direction?: 'asc' | 'desc';
}

export interface GetReviewsResponse {
    success: boolean;
    data: ReviewWithDetails[];
    total: number;
    limit: number;
    offset: number;
}

export interface GetReviewStatsResponse {
    success: boolean;
    data: ReviewStats;
}

// Component prop types
export interface StarRatingProps {
    rating: number;
    maxRating?: number;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    interactive?: boolean;
    onChange?: (rating: number) => void;
    showCount?: boolean;
    totalReviews?: number;
    className?: string;
    disabled?: boolean;
}

export interface ReviewCardProps {
    review: ReviewWithDetails;
    showCar?: boolean;
    showReviewer?: boolean;
    showReviewee?: boolean;
    className?: string;
}

export interface ReviewFormProps {
    bookingId: string;
    reviewerId: string;
    reviewedId: string;
    carId: string;
    onSuccess?: (review: Review) => void;
    onCancel?: () => void;
    className?: string;
}

// Utility types for rating values
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface RatingBreakdown {
    [key: number]: number;
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
}

// Error types
export interface ReviewError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

export interface ReviewValidationError extends ReviewError {
    field: string;
}

// Constants for reviews
export const REVIEW_CONSTANTS = {
    MIN_RATING: 1,
    MAX_RATING: 5,
    MAX_COMMENT_LENGTH: 1000,
    EDIT_TIME_LIMIT_HOURS: 24,
} as const;

// Helper type guards
export const isValidRating = (rating: number): rating is Rating => {
    return Number.isInteger(rating) && rating >= 1 && rating <= 5;
};

export const isReviewOwner = (review: Review, userId: string): boolean => {
    return review.reviewer_id === userId;
};

export const canEditReview = (review: Review): boolean => {
    const createdAt = new Date(review.created_at);
    const now = new Date();
    const timeDifference = now.getTime() - createdAt.getTime();
    const hoursDifference = timeDifference / (1000 * 3600);

    return hoursDifference <= REVIEW_CONSTANTS.EDIT_TIME_LIMIT_HOURS;
};
