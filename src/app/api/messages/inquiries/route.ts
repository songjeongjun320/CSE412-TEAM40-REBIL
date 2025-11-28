import { NextRequest, NextResponse } from 'next/server';

import { createApiClientWithAuth } from '@/lib/supabase/supabaseApi';

interface SendInquiryRequest {
    host_id: string;
    vehicle_id: string;
    message: string;
    inquiry_type: 'general' | 'booking' | 'availability' | 'pricing';
    preferred_start_date?: string;
    preferred_end_date?: string;
}

interface SendInquiryResponse {
    success: boolean;
    inquiry_id?: string;
    error?: string;
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
        const body: SendInquiryRequest = await request.json();
        const {
            host_id,
            vehicle_id,
            message,
            inquiry_type,
            preferred_start_date,
            preferred_end_date,
        } = body;

        // Validate input
        if (!host_id || !vehicle_id || !message) {
            return NextResponse.json(
                { success: false, error: 'host_id, vehicle_id, and message are required' },
                { status: 400 },
            );
        }

        if (message.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: 'Message cannot be empty' },
                { status: 400 },
            );
        }

        if (message.length > 500) {
            return NextResponse.json(
                { success: false, error: 'Message too long (max 500 characters)' },
                { status: 400 },
            );
        }

        // Check if user is trying to contact themselves
        if (host_id === user.id) {
            return NextResponse.json(
                { success: false, error: 'Cannot send inquiry to yourself' },
                { status: 400 },
            );
        }

        // Verify the vehicle exists and belongs to the host
        const { data: vehicle, error: vehicleError } = await supabase
            .from('cars')
            .select('id, host_id, make, model, status')
            .eq('id', vehicle_id)
            .eq('host_id', host_id)
            .single();

        if (vehicleError || !vehicle) {
            return NextResponse.json(
                { success: false, error: 'Vehicle not found or does not belong to this host' },
                { status: 404 },
            );
        }

        // Check if vehicle is active
        if (vehicle.status !== 'ACTIVE') {
            return NextResponse.json(
                { success: false, error: 'This vehicle is not available for inquiries' },
                { status: 400 },
            );
        }

        // Prepare inquiry data
        const inquiryData: any = {
            renter_id: user.id,
            host_id: host_id,
            vehicle_id: vehicle_id,
            message: message.trim(),
            inquiry_type: inquiry_type || 'general',
            status: 'pending',
        };

        // Add dates if provided
        if (preferred_start_date) inquiryData.preferred_start_date = preferred_start_date;
        if (preferred_end_date) inquiryData.preferred_end_date = preferred_end_date;

        // Create inquiry record in database
        const { data: createdInquiry, error: inquiryError } = await supabase
            .from('host_inquiries')
            .insert(inquiryData)
            .select('id')
            .single();

        if (inquiryError) {
            console.error('Error creating inquiry:', inquiryError);
            return NextResponse.json(
                { success: false, error: 'Failed to create inquiry' },
                { status: 500 },
            );
        }

        // TODO: Send notification to host (email, push notification, etc.)
        // This could be implemented with a background job or webhook

        const response: SendInquiryResponse = {
            success: true,
            inquiry_id: createdInquiry.id,
        };

        return NextResponse.json(response, { status: 201 });
    } catch (error) {
        console.error('Inquiry POST error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}

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
        const role = searchParams.get('role'); // 'host' or 'renter'
        const status = searchParams.get('status') || 'pending';
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query = supabase
            .from('host_inquiries')
            .select(
                `
                *,
                renter:renter_id(id, full_name, email),
                host:host_id(id, full_name, email),
                vehicle:vehicle_id(id, make, model, year, price_per_day)
            `,
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Filter based on user role
        if (role === 'host') {
            query = query.eq('host_id', user.id);
        } else {
            // Default to renter view
            query = query.eq('renter_id', user.id);
        }

        // Filter by status if specified
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: inquiries, error } = await query;

        if (error) {
            console.error('Error fetching inquiries:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch inquiries' },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            inquiries: inquiries || [],
        });
    } catch (error) {
        console.error('Inquiry GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
