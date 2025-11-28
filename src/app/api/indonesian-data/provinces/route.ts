import { NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/supabaseApi';

export async function GET() {
    try {
        const supabase = createApiClient();

        // Directly query the indonesian_provinces table instead of using RPC
        const { data, error } = await supabase
            .from('indonesian_provinces')
            .select('id, name, code')
            .order('name');

        if (error) {
            console.error('Supabase error while fetching provinces:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }

        // Transform data to match expected format
        const formattedData =
            data?.map((province) => ({
                id: province.id?.toString() || province.code,
                name: province.name,
                code: province.code,
            })) || [];

        return NextResponse.json({
            success: true,
            data: formattedData,
            count: formattedData.length,
        });
    } catch (error) {
        console.error('API error fetching provinces:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch provinces',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
