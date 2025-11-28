import { NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/supabaseApi';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const districtCode = searchParams.get('districtCode');

        const supabase = createApiClient();
        let villages, error;

        if (districtCode) {
            // Direct approach: Find villages where district_code matches
            console.log(`🚀 API: Finding villages by district_code: ${districtCode}`);

            const { data, error: queryError } = await supabase
                .from('indonesian_villages')
                .select(
                    `
                    id, 
                    code,
                    name, 
                    district_code
                `,
                )
                .eq('district_code', districtCode)
                .order('name');

            console.log(
                `📡 API: Found ${data?.length || 0} villages for district_code: ${districtCode}`,
            );
            villages = data;
            error = queryError;
        } else {
            // Get all villages - using only columns that exist in schema
            const { data, error: queryError } = await supabase
                .from('indonesian_villages')
                .select(
                    `
                    id, 
                    code,
                    name, 
                    district_code
                `,
                )
                .order('name');
            villages = data;
            error = queryError;
        }

        if (error) {
            console.error('Supabase error:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }

        // Transform data to match expected API format
        const transformedData =
            villages?.map((village: any) => ({
                id: village.id,
                name: village.name,
                code: village.code,
                district_code: village.district_code, // Direct from schema
            })) || [];

        return NextResponse.json({
            success: true,
            data: transformedData,
            count: transformedData.length,
            districtCode,
        });
    } catch (error) {
        console.error('Error fetching villages:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch villages',
            },
            { status: 500 },
        );
    }
}
