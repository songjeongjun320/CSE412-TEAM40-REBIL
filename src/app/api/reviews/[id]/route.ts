import { NextRequest, NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/supabaseApi';
import type { ReviewWithDetails, UpdateReviewRequest } from '@/types/reviews.types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = createApiClient();
        const { id } = await params;

        const { data: review, error } = await supabase
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
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Review not found',
                    },
                    { status: 404 },
                );
            }

            console.error('Supabase error while fetching review:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            data: review as ReviewWithDetails,
        });
    } catch (error) {
        console.error('API error fetching review:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch review',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = createApiClient();
        const { id } = await params;
        const body: UpdateReviewRequest = await request.json();

        // Validate rating if provided
        if (body.rating !== undefined) {
            if (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'Rating must be an integer between 1 and 5',
                    },
                    { status: 400 },
                );
            }
        }

        // First, check if the review exists and get current data
        const { data: existingReview, error: fetchError } = await supabase
            .from('reviews')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'Review not found',
                    },
                    { status: 404 },
                );
            }

            console.error('Supabase error while fetching review:', fetchError);
            throw new Error(`Supabase error: ${fetchError.message}`);
        }

        // Check if review can still be edited (within 24 hours)
        const createdAt = new Date(existingReview.created_at);
        const now = new Date();
        const timeDifference = now.getTime() - createdAt.getTime();
        const hoursDifference = timeDifference / (1000 * 3600);

        if (hoursDifference > 24) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Reviews can only be edited within 24 hours of creation',
                },
                { status: 403 },
            );
        }

        // Build update object
        const updateData: Record<string, unknown> = {};
        if (body.rating !== undefined) updateData.rating = body.rating;
        if (body.comment !== undefined) updateData.comment = body.comment;
        if (body.is_public !== undefined) updateData.is_public = body.is_public;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'No valid fields provided for update',
                },
                { status: 400 },
            );
        }

        // Update the review
        const { data: updatedReview, error: updateError } = await supabase
            .from('reviews')
            .update(updateData)
            .eq('id', id)
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
            .single();

        if (updateError) {
            console.error('Supabase error while updating review:', updateError);
            throw new Error(`Supabase error: ${updateError.message}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Review updated successfully',
            data: updatedReview as ReviewWithDetails,
        });
    } catch (error) {
        console.error('API error updating review:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to update review',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const supabase = createApiClient();
        const { id } = await params;

        // First, check if the review exists
        const { data: existingReview, error: fetchError } = await supabase
            .from('reviews')
            .select('created_at')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'Review not found',
                    },
                    { status: 404 },
                );
            }

            console.error('Supabase error while fetching review:', fetchError);
            throw new Error(`Supabase error: ${fetchError.message}`);
        }

        // Check if review can still be deleted (within 24 hours)
        const createdAt = new Date(existingReview.created_at);
        const now = new Date();
        const timeDifference = now.getTime() - createdAt.getTime();
        const hoursDifference = timeDifference / (1000 * 3600);

        if (hoursDifference > 24) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Reviews can only be deleted within 24 hours of creation',
                },
                { status: 403 },
            );
        }

        // Delete the review
        const { error: deleteError } = await supabase.from('reviews').delete().eq('id', id);

        if (deleteError) {
            console.error('Supabase error while deleting review:', deleteError);
            throw new Error(`Supabase error: ${deleteError.message}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Review deleted successfully',
        });
    } catch (error) {
        console.error('API error deleting review:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to delete review',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
