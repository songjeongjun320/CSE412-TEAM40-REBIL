-- Simple fix for indonesian_cities references
-- This script will fix the issues without complex loops

-- First, let's drop all potentially problematic functions
DROP FUNCTION IF EXISTS public.get_provinces_dropdown() CASCADE;
DROP FUNCTION IF EXISTS public.get_cities_by_province(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_cities_by_province(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.search_cities(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_province_id(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_car_status_by_host(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_indonesian_provinces() CASCADE;
DROP FUNCTION IF EXISTS public.get_indonesian_regencies(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_districts_by_regency(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_villages_by_district(TEXT) CASCADE;

-- Create clean update_car_status_by_host function
CREATE OR REPLACE FUNCTION public.update_car_status_by_host(
    host_user_id UUID,
    car_uuid UUID,
    new_status TEXT
)
RETURNS JSON AS $$
DECLARE
    car_record RECORD;
    status_enum car_status;
    rows_affected INTEGER;
BEGIN
    -- Check if user owns this car
    SELECT * INTO car_record
    FROM public.cars
    WHERE id = car_uuid AND host_id = host_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Car not found or you do not have permission to modify it',
            'error_code', 'CAR_NOT_FOUND'
        );
    END IF;

    -- Validate and convert status
    BEGIN
        status_enum := new_status::car_status;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Invalid status: ' || new_status,
                'error_code', 'INVALID_STATUS'
            );
    END;

    -- Update car status
    UPDATE public.cars
    SET status = status_enum, updated_at = NOW()
    WHERE id = car_uuid AND host_id = host_user_id;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    IF rows_affected = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to update car status',
            'error_code', 'UPDATE_FAILED'
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Car status updated successfully',
        'old_status', car_record.status,
        'new_status', new_status,
        'updated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create get_provinces_dropdown function
CREATE OR REPLACE FUNCTION public.get_provinces_dropdown()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id::TEXT,
        p.name,
        p.code
    FROM public.indonesian_provinces p
    ORDER BY p.name
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create get_cities_by_province function using indonesian_regencies
CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    type TEXT,
    is_capital BOOLEAN,
    province_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id::TEXT,
        r.name,
        'regency'::TEXT as type,
        false as is_capital,
        r.province_code
    FROM public.indonesian_regencies r
    JOIN public.indonesian_provinces p ON r.province_code = p.code
    WHERE 
        (p.code = province_identifier OR p.name ILIKE '%' || province_identifier || '%')
    ORDER BY r.name
    LIMIT 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create get_districts_by_regency function
CREATE OR REPLACE FUNCTION public.get_districts_by_regency(regency_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    code TEXT,
    regency_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id::TEXT,
        d.name,
        d.code,
        d.regency_code
    FROM public.indonesian_districts d
    JOIN public.indonesian_regencies r ON d.regency_code = r.code
    WHERE 
        (r.code = regency_identifier OR r.name ILIKE '%' || regency_identifier || '%')
    ORDER BY d.name
    LIMIT 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create get_villages_by_district function
CREATE OR REPLACE FUNCTION public.get_villages_by_district(district_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    code TEXT,
    district_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id::TEXT,
        v.name,
        v.code,
        v.district_code
    FROM public.indonesian_villages v
    JOIN public.indonesian_districts d ON v.district_code = d.code
    WHERE 
        (d.code = district_identifier OR d.name ILIKE '%' || district_identifier || '%')
    ORDER BY v.name
    LIMIT 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_provinces_dropdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_districts_by_regency(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_villages_by_district(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_car_status_by_host(UUID, UUID, TEXT) TO authenticated;
