import { NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/supabaseApi';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const provinceCode = searchParams.get('provinceCode');

        // Fetching regencies from Supabase

        const supabase = createApiClient();
        let regencies;

        if (provinceCode) {
            // Direct approach: Find regencies where province_code matches
            console.log(`🚀 API: Finding regencies by province_code: ${provinceCode}`);

            const { data } = await supabase
                .from('indonesian_regencies')
                .select(
                    `
                    id, 
                    code,
                    name, 
                    province_code
                `,
                )
                .eq('province_code', provinceCode)
                .order('name');

            console.log(
                `📡 API: Found ${data?.length || 0} regencies for province_code: ${provinceCode}`,
            );
            regencies = data;
        } else {
            // Get all regencies - using only columns that exist in schema
            const { data } = await supabase
                .from('indonesian_regencies')
                .select(
                    `
                    id, 
                    code,
                    name, 
                    province_code
                `,
                )
                .order('name');
            regencies = data;
        }

        // Regencies loaded

        // Transform data to match expected API format
        const transformedData =
            regencies?.map((regency: any) => ({
                id: regency.id,
                name: regency.name,
                code: regency.code,
                province_code: regency.province_code, // Direct from schema
            })) || [];

        return NextResponse.json({
            success: true,
            data: transformedData,
            count: transformedData.length,
            provinceCode,
        });
    } catch {
        // Error fetching regencies
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch regencies',
            },
            { status: 500 },
        );
    }
}
