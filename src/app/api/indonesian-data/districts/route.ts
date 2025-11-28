import { NextResponse } from 'next/server';

import { createApiClient } from '@/lib/supabase/supabaseApi';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const regencyCode = searchParams.get('regencyCode');

        const supabase = createApiClient();
        let districts, error;

        if (regencyCode) {
            // Use regency_code to find districts directly (according to schema)
            const { data, error: districtError } = await supabase
                .from('indonesian_districts')
                .select(
                    `
                    id, 
                    code,
                    name, 
                    regency_code
                `,
                )
                .eq('regency_code', regencyCode)
                .order('name');

            if (districtError) {
                console.error('Supabase error:', districtError);
                throw new Error(`Supabase error: ${districtError.message}`);
            }

            if (!data || data.length === 0) {
                // Return 404 for not found instead of 500
                return NextResponse.json(
                    {
                        success: false,
                        error: `No districts found for regency code: ${regencyCode}`,
                        data: [],
                        count: 0,
                        regencyCode,
                    },
                    { status: 404 },
                );
            }

            districts = data;
            error = districtError;
        } else {
            // Get all districts - using only columns that exist in schema
            const { data, error: queryError } = await supabase
                .from('indonesian_districts')
                .select(
                    `
                    id, 
                    code,
                    name, 
                    regency_code
                `,
                )
                .order('name');
            districts = data;
            error = queryError;
        }

        if (error) {
            console.error('Supabase error:', error);
            throw new Error(`Supabase error: ${error.message}`);
        }

        // Transform data to match expected API format
        const transformedData =
            districts?.map((district: any) => ({
                id: district.id,
                name: district.name,
                code: district.code,
                regency_code: district.regency_code,
            })) || [];

        return NextResponse.json({
            success: true,
            data: transformedData,
            count: transformedData.length,
            regencyCode,
        });
    } catch (error) {
        console.error('Error fetching districts:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch districts',
            },
            { status: 500 },
        );
    }
}
