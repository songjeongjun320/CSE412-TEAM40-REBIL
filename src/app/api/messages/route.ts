import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';
import type {
    GetMessagesResponse,
    SendMessageRequest,
    SendMessageResponse,
} from '@/types/message.types';

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
        const booking_id = searchParams.get('booking_id');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        if (!booking_id) {
            return NextResponse.json(
                { success: false, error: 'booking_id is required' },
                { status: 400 },
            );
        }

        // Call RPC function to get messages
        const { data: messages, error } = await supabase.rpc('get_booking_messages', {
            p_booking_id: booking_id,
            p_user_id: user.id,
            p_limit: limit,
            p_offset: offset,
        });

        if (error) {
            console.error('Error fetching messages:', error);

            // Handle specific error cases
            if (error.message.includes('not authorized')) {
                return NextResponse.json(
                    { success: false, error: 'You are not authorized to view this conversation' },
                    { status: 403 },
                );
            }

            if (error.message.includes('offline booking')) {
                return NextResponse.json(
                    { success: false, error: 'Messaging is not available for offline bookings' },
                    { status: 400 },
                );
            }

            return NextResponse.json(
                { success: false, error: 'Failed to fetch messages' },
                { status: 500 },
            );
        }

        const response: GetMessagesResponse = {
            success: true,
            messages: messages || [],
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Messages GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
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
        const body: SendMessageRequest = await request.json();
        const { booking_id, receiver_id, message } = body;

        // Validate input
        if (!booking_id || !receiver_id || !message) {
            return NextResponse.json(
                { success: false, error: 'booking_id, receiver_id, and message are required' },
                { status: 400 },
            );
        }

        if (message.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: 'Message cannot be empty' },
                { status: 400 },
            );
        }

        if (message.length > 2000) {
            return NextResponse.json(
                { success: false, error: 'Message too long (max 2000 characters)' },
                { status: 400 },
            );
        }

        // Call RPC function to send message
        const { data: message_id, error } = await supabase.rpc('send_booking_message', {
            p_booking_id: booking_id,
            p_sender_id: user.id,
            p_receiver_id: receiver_id,
            p_message: message.trim(),
        });

        if (error) {
            console.error('Error sending message:', error);

            // Handle specific error cases
            if (error.message.includes('not authorized')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'You are not authorized to send messages for this booking',
                    },
                    { status: 403 },
                );
            }

            if (error.message.includes('offline booking')) {
                return NextResponse.json(
                    { success: false, error: 'Messaging is not available for offline bookings' },
                    { status: 400 },
                );
            }

            if (error.message.includes('Booking not found')) {
                return NextResponse.json(
                    { success: false, error: 'Booking not found' },
                    { status: 404 },
                );
            }

            if (error.message.includes('empty')) {
                return NextResponse.json(
                    { success: false, error: 'Message cannot be empty' },
                    { status: 400 },
                );
            }

            if (error.message.includes('too long')) {
                return NextResponse.json(
                    { success: false, error: 'Message too long (max 2000 characters)' },
                    { status: 400 },
                );
            }

            return NextResponse.json(
                { success: false, error: 'Failed to send message' },
                { status: 500 },
            );
        }

        const response: SendMessageResponse = {
            success: true,
            message_id: message_id,
        };

        return NextResponse.json(response, { status: 201 });
    } catch (error) {
        console.error('Messages POST error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
