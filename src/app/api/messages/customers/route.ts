import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';

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

        // Fetch customers (renters who have booked with this host)
        // Using direct table query instead of host_booking_management view
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select(
                `
                id,
                renter_id,
                total_amount,
                created_at,
                status,
                cars!inner(
                    host_id
                ),
                renter:user_profiles!renter_id(
                    id,
                    full_name,
                    email
                )
            `,
            )
            .eq('cars.host_id', user.id)
            .not('status', 'eq', 'CANCELLED')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching host customers:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch customers' },
                { status: 500 },
            );
        }

        // Group by renter and aggregate data
        const customerMap = new Map<string, any>();

        bookings?.forEach((booking) => {
            // Handle the case where renter might be an array or object
            const renter = Array.isArray(booking.renter) ? booking.renter[0] : booking.renter;
            const renterKey = renter?.email;

            if (!renterKey || !renter) {
                console.warn(
                    '[Customers API] Skipping booking with incomplete renter data:',
                    booking,
                );
                return;
            }

            // Validate required fields
            if (!renter.id) {
                console.error('[Customers API] Renter missing ID:', renter);
                return;
            }

            if (!customerMap.has(renterKey)) {
                customerMap.set(renterKey, {
                    renter_id: renter.id,
                    renter_email: renter.email,
                    renter_name: renter.full_name || 'Unknown User', // Fallback for missing name
                    total_bookings: 0, // Will be calculated
                    completed_bookings: 0, // Will be calculated
                    total_spent: 0,
                    average_rating: 0,
                    last_booking_date: booking.created_at,
                    renter_score: 75, // Default score instead of 0
                    cancellation_rate: 0, // Placeholder - would need calculation
                    bookings_with_this_host: 0,
                });
            }

            const customer = customerMap.get(renterKey);
            customer.total_spent += parseFloat(booking.total_amount || '0');
            customer.bookings_with_this_host += 1;
            customer.total_bookings += 1;

            // Count completed bookings (using uppercase COMPLETED to match database enum)
            if (booking.status === 'COMPLETED') {
                customer.completed_bookings += 1;
            }

            // Update last booking date if this one is more recent
            if (new Date(booking.created_at) > new Date(customer.last_booking_date)) {
                customer.last_booking_date = booking.created_at;
            }
        });

        const aggregatedCustomers = Array.from(customerMap.values()).map((customer) => ({
            ...customer,
            total_spent: Math.round(customer.total_spent * 100) / 100, // Round to 2 decimal places
        }));

        return NextResponse.json({
            success: true,
            customers: aggregatedCustomers,
            total_count: aggregatedCustomers.length,
        });
    } catch (error) {
        console.error('Host customers GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
