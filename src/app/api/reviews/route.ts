import { NextRequest, NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/supabaseApi';
import type {
    CreateReviewRequest,
    CreateReviewResponse,
    GetReviewsQuery,
    GetReviewsResponse,
    ReviewWithDetails,
} from '@/types/reviews.types';

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiClient();
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const query: GetReviewsQuery = {
            reviewed_id: searchParams.get('reviewed_id') || undefined,
            car_id: searchParams.get('car_id') || undefined,
            reviewer_id: searchParams.get('reviewer_id') || undefined,
            booking_id: searchParams.get('booking_id') || undefined,
            is_public: searchParams.get('is_public') === 'true' ? true : undefined,
            limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
            offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
            order_by: (searchParams.get('order_by') as 'created_at' | 'rating') || 'created_at',
            order_direction: (searchParams.get('order_direction') as 'asc' | 'desc') || 'desc',
        };

        // Build the query
        let reviewsQuery = supabase.from('reviews').select(`
        *,
        reviewer:reviewer_id (
          id,
          full_name,
          profile_image_url
        ),
        reviewed_user:reviewed_id (
          id,
          full_name,
          profile_image_url
        ),
        car:car_id (
          id,
          make,
          model,
          year
        ),
        booking:booking_id (
          id,
          start_date,
          end_date
        )
      `);

        // Apply filters
        if (query.reviewed_id) {
            reviewsQuery = reviewsQuery.eq('reviewed_id', query.reviewed_id);
        }
        if (query.car_id) {
            reviewsQuery = reviewsQuery.eq('car_id', query.car_id);
        }
        if (query.reviewer_id) {
            reviewsQuery = reviewsQuery.eq('reviewer_id', query.reviewer_id);
        }
        if (query.booking_id) {
            reviewsQuery = reviewsQuery.eq('booking_id', query.booking_id);
        }
        if (query.is_public !== undefined) {
            reviewsQuery = reviewsQuery.eq('is_public', query.is_public);
        }

        // Apply ordering
        reviewsQuery = reviewsQuery.order(query.order_by || 'created_at', {
            ascending: query.order_direction === 'asc',
        });

        // Apply pagination
        const from = query.offset || 0;
        const to = from + (query.limit || 20) - 1;
        reviewsQuery = reviewsQuery.range(from, to);

        const { data: reviews, error, count } = await reviewsQuery;

        if (error) {
            console.error('Supabase error while fetching reviews:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }

        const response: GetReviewsResponse = {
            success: true,
            data: reviews as ReviewWithDetails[],
            total: count || 0,
            limit: query.limit || 20,
            offset: query.offset || 0,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('API error fetching reviews:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch reviews',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createApiClient();
        const body: CreateReviewRequest = await request.json();

        // Validate required fields
        const requiredFields = ['booking_id', 'reviewer_id', 'reviewed_id', 'car_id', 'rating'];
        const missingFields = requiredFields.filter((field) => !body[field as keyof typeof body]);

        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`,
                },
                { status: 400 },
            );
        }

        // Validate rating
        if (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Rating must be an integer between 1 and 5',
                },
                { status: 400 },
            );
        }

        // Use the database function for validation and creation
        const { data, error } = await supabase.rpc('create_review_with_validation', {
            p_booking_id: body.booking_id,
            p_reviewer_id: body.reviewer_id,
            p_reviewed_id: body.reviewed_id,
            p_car_id: body.car_id,
            p_rating: body.rating,
            p_comment: body.comment || null,
            p_is_public: body.is_public !== undefined ? body.is_public : true,
        });

        if (error) {
            console.error('Supabase error while creating review:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }

        const result = data[0];
        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: result.message,
                },
                { status: 400 },
            );
        }

        // Fetch the created review with details
        const { data: reviewData, error: fetchError } = await supabase
            .from('reviews')
            .select(
                `
        *,
        reviewer:reviewer_id (
          id,
          full_name,
          profile_image_url
        ),
        reviewed_user:reviewed_id (
          id,
          full_name,
          profile_image_url
        ),
        car:car_id (
          id,
          make,
          model,
          year
        ),
        booking:booking_id (
          id,
          start_date,
          end_date
        )
      `,
            )
            .eq('id', result.review_id)
            .single();

        if (fetchError) {
            console.warn('Could not fetch created review details:', fetchError);
        }

        const response: CreateReviewResponse = {
            success: true,
            review_id: result.review_id,
            message: result.message,
            data: reviewData || undefined,
        };

        return NextResponse.json(response, { status: 201 });
    } catch (error) {
        console.error('API error creating review:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to create review',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
