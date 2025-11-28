import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';
import type { FindBookingRequest, FindBookingResponse } from '@/types/message.types';

/**
 * POST /api/messages/find-booking
 *
 * Finds the most recent booking between the current authenticated user and a target user.
 * This endpoint enables messaging between users who have a shared booking history,
 * regardless of who was the host or renter in the relationship.
 *
 * @param target_user_id - UUID of the user to find shared booking with
 *
 * @returns {FindBookingResponse} - Booking details including vehicle info and relationship type
 *
 * @example
 * POST /api/messages/find-booking
 * {
 *   "target_user_id": "16bffea8-08eb-4aa7-8872-7cd74b04a396"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "booking": {
 *     "booking_id": "abc123...",
 *     "booking_status": "COMPLETED",
 *     "vehicle_info": { "make": "Toyota", "model": "Camry", "year": 2020 },
 *     "relationship": "host_to_renter",
 *     "created_at": "2024-01-15T10:30:00Z"
 *   }
 * }
 */

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
        const { target_user_id }: FindBookingRequest = await request.json();
        console.log('[FindBooking] Current user ID:', user.id);
        console.log('[FindBooking] Target user ID:', target_user_id);

        if (!target_user_id) {
            console.error('[FindBooking] Error: target_user_id is required');
            return NextResponse.json(
                { success: false, error: 'target_user_id is required' },
                { status: 400 },
            );
        }

        // Validate target user exists
        console.log('[FindBooking] Validating target user exists...');
        const { data: targetUser, error: userError } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', target_user_id)
            .single();

        if (userError || !targetUser) {
            console.error('[FindBooking] Target user not found:', userError);
            return NextResponse.json(
                { success: false, error: 'Target user not found' },
                { status: 404 },
            );
        }

        console.log('[FindBooking] Target user validated successfully');

        // Find the most recent booking between the two users
        // Check both directions: current user as host/renter, target user as renter/host
        console.log('[FindBooking] Searching for bookings between users...');
        const orCondition = `and(host_id.eq.${user.id},renter_id.eq.${target_user_id}),and(host_id.eq.${target_user_id},renter_id.eq.${user.id})`;
        console.log('[FindBooking] OR condition:', orCondition);

        const { data: bookings, error: bookingError } = await supabase
            .from('bookings')
            .select(
                `
                id,
                status,
                host_id,
                renter_id,
                created_at,
                total_amount,
                start_date,
                end_date,
                cars!bookings_car_id_fkey (
                    make,
                    model,
                    year
                )
            `,
            )
            .or(orCondition)
            .not('status', 'eq', 'CANCELLED') // CRITICAL FIX: Match customers API logic - exclude cancelled bookings
            .order('created_at', { ascending: false })
            .limit(10); // Get more results for better debugging

        if (bookingError) {
            console.error('[FindBooking] Error finding booking:', bookingError);
            return NextResponse.json(
                { success: false, error: 'Failed to search bookings' },
                { status: 500 },
            );
        }

        console.log('[FindBooking] Booking search results:', {
            count: bookings?.length || 0,
            bookings:
                bookings?.map((b) => ({
                    id: b.id,
                    status: b.status,
                    host_id: b.host_id,
                    renter_id: b.renter_id,
                    created_at: b.created_at,
                    total_amount: b.total_amount,
                })) || [],
        });

        // If no booking found between users, try including cancelled bookings as fallback
        if (!bookings || bookings.length === 0) {
            console.log(
                '[FindBooking] No non-cancelled bookings found, checking for any bookings including cancelled...',
            );

            // Fallback: Search for ANY booking (including cancelled) to provide more info
            const { data: allBookings, error: allBookingsError } = await supabase
                .from('bookings')
                .select(
                    `
                    id,
                    status,
                    host_id,
                    renter_id,
                    created_at,
                    total_amount
                `,
                )
                .or(orCondition)
                .order('created_at', { ascending: false })
                .limit(5);

            if (!allBookingsError && allBookings && allBookings.length > 0) {
                console.log('[FindBooking] Found cancelled/other bookings:', {
                    count: allBookings.length,
                    statuses: allBookings.map((b) => b.status),
                });

                return NextResponse.json(
                    {
                        success: false,
                        error: 'No existing bookings found',
                        details: `Found ${allBookings.length} booking(s) but all are cancelled or unavailable for messaging`,
                        booking_statuses: allBookings.map((b) => b.status),
                    },
                    { status: 404 },
                );
            }

            console.log('[FindBooking] No bookings found at all between users');
            return NextResponse.json(
                { success: false, error: 'No existing bookings found' },
                { status: 404 },
            );
        }

        const booking = bookings[0];
        console.log('[FindBooking] Found booking:', booking);

        // Determine relationship
        const relationship = booking.host_id === user.id ? 'host_to_renter' : 'renter_to_host';
        console.log('[FindBooking] Relationship:', relationship);

        const response: FindBookingResponse = {
            success: true,
            booking: {
                booking_id: booking.id,
                booking_status: booking.status,
                vehicle_info: {
                    make: (booking.cars as any)?.make || 'Unknown',
                    model: (booking.cars as any)?.model || 'Unknown',
                    year: (booking.cars as any)?.year || 0,
                },
                relationship,
                created_at: booking.created_at,
            },
        };

        console.log('[FindBooking] Sending response:', response);
        return NextResponse.json(response);
    } catch (error) {
        console.error('Find booking error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
