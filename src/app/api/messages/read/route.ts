import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';
import type { MarkReadResponse } from '@/types/message.types';

export async function PUT(request: NextRequest) {
    try {
        const supabase = createApiClientWithAuth(request);

        // Get current user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 },
            );
        }

        // Parse request body
        const body = await request.json();
        const { booking_id, message_ids } = body;

        // Validate input
        if (!booking_id) {
            return NextResponse.json(
                { success: false, error: 'booking_id is required' },
                { status: 400 },
            );
        }

        // Call RPC function to mark messages as read
        const { data: updated_count, error } = await supabase.rpc('mark_messages_read', {
            p_booking_id: booking_id,
            p_user_id: user.id,
            p_message_ids: message_ids || null,
        });

        if (error) {
            console.error('Error marking messages as read:', error);

            if (error.message.includes('not authorized')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'You are not authorized to update messages for this booking',
                    },
                    { status: 403 },
                );
            }

            return NextResponse.json(
                { success: false, error: 'Failed to mark messages as read' },
                { status: 500 },
            );
        }

        const response: MarkReadResponse = {
            success: true,
            updated_count: updated_count || 0,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Messages read PUT error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
