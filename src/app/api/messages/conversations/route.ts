import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';
import type { GetConversationsResponse } from '@/types/message.types';

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

        // Get query parameters
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Try to call RPC function to get conversations
        // First try the safer version if available, fallback to original
        let conversations, error;

        try {
            const safeResult = await supabase.rpc('get_user_conversations_safe', {
                p_user_id: user.id,
                p_limit: limit,
                p_offset: offset,
            });
            conversations = safeResult.data;
            error = safeResult.error;
        } catch {
            // If safe function doesn't exist, try original
            const originalResult = await supabase.rpc('get_user_conversations', {
                p_user_id: user.id,
                p_limit: limit,
                p_offset: offset,
            });
            conversations = originalResult.data;
            error = originalResult.error;
        }

        if (error) {
            console.error('Error fetching conversations:', error);

            // If it's a JSON parsing error, try to fix it and fallback to direct query
            if (
                error.message &&
                (error.message.includes('invalid input syntax for type json') ||
                    error.message.includes('Token') ||
                    error.code === '22P02')
            ) {
                console.warn('JSON parsing error detected - trying direct query fallback');

                try {
                    // Direct query for messages to show conversations without RPC function
                    const { data: directMessages, error: directError } = await supabase
                        .from('messages')
                        .select(
                            `
                            booking_id,
                            booking:bookings(
                                id,
                                host_id,
                                renter_id,
                                status,
                                car:cars(make, model, year),
                                host:user_profiles!bookings_host_id_fkey(id, full_name),
                                renter:user_profiles!bookings_renter_id_fkey(id, full_name)
                            ),
                            message,
                            created_at
                        `,
                        )
                        .or(`booking.host_id.eq.${user.id},booking.renter_id.eq.${user.id}`)
                        .order('created_at', { ascending: false })
                        .limit(limit);

                    if (!directError && directMessages) {
                        // Group by booking_id and create conversation format
                        const conversationMap = new Map();

                        directMessages.forEach((msg: any) => {
                            if (!msg.booking || !conversationMap.has(msg.booking_id)) {
                                const booking = msg.booking;
                                const isHost = booking.host_id === user.id;

                                conversationMap.set(msg.booking_id, {
                                    booking_id: msg.booking_id,
                                    other_user_id: isHost ? booking.renter_id : booking.host_id,
                                    other_user_name: isHost
                                        ? booking.renter?.full_name
                                        : booking.host?.full_name,
                                    vehicle_name: `${booking.car?.year} ${booking.car?.make} ${booking.car?.model}`,
                                    last_message: msg.message,
                                    last_message_at: msg.created_at,
                                    unread_count: 0,
                                    booking_status: booking.status,
                                });
                            }
                        });

                        const response: GetConversationsResponse = {
                            success: true,
                            conversations: Array.from(conversationMap.values()),
                        };
                        return NextResponse.json(response);
                    }
                } catch (fallbackError) {
                    console.error('Fallback query also failed:', fallbackError);
                }

                // If all else fails, return empty conversations
                const response: GetConversationsResponse = {
                    success: true,
                    conversations: [],
                };
                return NextResponse.json(response);
            }

            return NextResponse.json(
                { success: false, error: 'Failed to fetch conversations' },
                { status: 500 },
            );
        }

        const response: GetConversationsResponse = {
            success: true,
            conversations: conversations || [],
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Conversations GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
