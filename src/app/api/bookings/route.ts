import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const supabase = createServerComponentClient({ cookies });
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { vehicleId, hostId, startDate, endDate, totalAmount } = await req.json();

        // Validate required fields
        if (!vehicleId || !hostId || !startDate || !endDate || !totalAmount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create booking using existing RPC function
        const { data: booking, error: bookingError } = await supabase.rpc(
            'create_booking_with_validation',
            {
                p_vehicle_id: vehicleId,
                p_renter_id: user.id,
                p_host_id: hostId,
                p_start_date: startDate,
                p_end_date: endDate,
                p_total_amount: totalAmount,
            },
        );

        if (bookingError) {
            return NextResponse.json({ error: bookingError.message }, { status: 400 });
        }

        // Send initial booking message using existing RPC function
        const { error: messageError } = await supabase.rpc('send_booking_message', {
            p_booking_id: booking.id,
            p_sender_id: user.id,
            p_receiver_id: hostId,
            p_content: `예약이 확정되었습니다. 대여 기간: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`,
        });

        if (messageError) {
            console.error('Failed to create initial message:', messageError);
            // Don't fail the booking if message creation fails
        }

        return NextResponse.json({ booking }, { status: 201 });
    } catch (error) {
        console.error('Error creating booking:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
