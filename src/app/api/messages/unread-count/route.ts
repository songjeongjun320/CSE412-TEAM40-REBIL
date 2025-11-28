import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';
import type { UnreadCountResponse } from '@/types/message.types';

export async function GET(request: NextRequest) {
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

        // Call RPC function to get unread count
        const { data: count, error } = await supabase.rpc('get_unread_message_count', {
            p_user_id: user.id,
        });

        if (error) {
            console.error('Error fetching unread count:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch unread message count' },
                { status: 500 },
            );
        }

        const response: UnreadCountResponse = {
            success: true,
            count: count || 0,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Unread count GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
