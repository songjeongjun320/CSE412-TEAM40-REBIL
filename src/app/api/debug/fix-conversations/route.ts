import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';

export async function POST(req: NextRequest) {
    try {
        const supabase = createApiClientWithAuth(req);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        console.log('🔧 Starting conversations fix...');

        // First, check for any bookings with invalid JSON in special_instructions
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, special_instructions')
            .not('special_instructions', 'is', null)
            .neq('special_instructions', '');

        if (bookingsError) {
            console.error('Error fetching bookings:', bookingsError);
            return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
        }

        console.log(`Found ${bookings?.length || 0} bookings with special_instructions`);

        const fixedBookings = [];
        const alreadyValid = [];

        for (const booking of bookings || []) {
            try {
                // Try to parse as JSON
                JSON.parse(booking.special_instructions);
                alreadyValid.push(booking.id);
                console.log(`✅ Booking ${booking.id} has valid JSON`);
            } catch {
                console.log(
                    `❌ Booking ${booking.id} has invalid JSON: ${booking.special_instructions}`,
                );

                // Fix by setting to empty JSON object
                const { error: updateError } = await supabase
                    .from('bookings')
                    .update({ special_instructions: '{}' })
                    .eq('id', booking.id);

                if (updateError) {
                    console.error(`Failed to fix booking ${booking.id}:`, updateError);
                } else {
                    fixedBookings.push(booking.id);
                    console.log(`🔧 Fixed booking ${booking.id}`);
                }
            }
        }

        // Now try to fetch conversations to see if the error is resolved
        const { data: conversations, error: conversationsError } = await supabase.rpc(
            'get_user_conversations',
            {
                p_user_id: user.id,
                p_limit: 50,
                p_offset: 0,
            },
        );

        const result = {
            success: true,
            summary: {
                totalBookingsChecked: bookings?.length || 0,
                alreadyValid: alreadyValid.length,
                fixedBookings: fixedBookings.length,
                conversationsWorking: !conversationsError,
            },
            details: {
                fixedBookingIds: fixedBookings,
                validBookingIds: alreadyValid,
                conversationsError: conversationsError?.message || null,
                conversationsCount: conversations?.length || 0,
            },
        };

        console.log('🎉 Fix complete:', result);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error('Error in fix-conversations:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
