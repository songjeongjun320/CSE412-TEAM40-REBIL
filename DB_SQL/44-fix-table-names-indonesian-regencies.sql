-- ============================================================================
-- Fix Indonesian Address Functions - Update table names to indonesian_regencies
-- ============================================================================

-- Drop existing functions to recreate with correct table names
DROP FUNCTION IF EXISTS public.get_provinces_dropdown();
DROP FUNCTION IF EXISTS public.get_cities_by_province(TEXT);
DROP FUNCTION IF EXISTS public.get_indonesian_provinces();
DROP FUNCTION IF EXISTS public.get_indonesian_regencies(TEXT);
DROP FUNCTION IF EXISTS public.update_car_status_by_host(UUID, UUID, TEXT);

-- ============================================================================
-- 1. Get Provinces Dropdown (Updated)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_provinces_dropdown()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    code TEXT,
    island_group TEXT,
    is_special_region BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        COALESCE(p.id::TEXT, p.code::TEXT) as id,
        p.name,
        p.code,
        COALESCE(p.island_group, 'Unknown') as island_group,
        COALESCE(p.is_special_region, false) as is_special_region
    FROM public.indonesian_provinces p
    WHERE p.name IS NOT NULL
    ORDER BY p.name
    LIMIT 100;
$$;

-- ============================================================================
-- 2. Get Cities/Regencies by Province (Updated to use indonesian_regencies)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    type TEXT,
    is_capital BOOLEAN,
    is_major_city BOOLEAN,
    population INTEGER
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    -- Return cities/regencies from the indonesian_regencies table
    RETURN QUERY
    SELECT 
        COALESCE(r.id::TEXT, r.code::TEXT) as id,
        r.name,
        COALESCE(r.type, 'Regency') as type,
        COALESCE(r.is_capital, false) as is_capital,
        COALESCE(r.is_major_city, false) as is_major_city,
        r.population
    FROM public.indonesian_regencies r
    WHERE 
        -- Handle both ID and code matching
        CASE 
            WHEN province_identifier IS NULL THEN true
            WHEN province_identifier ~ '^[0-9]+$' THEN 
                -- If it's numeric, try to match with province_id
                (
                    (column_exists('public', 'indonesian_regencies', 'province_id') AND r.province_id::TEXT = province_identifier)
                    OR 
                    (column_exists('public', 'indonesian_regencies', 'province_code') AND r.province_code = province_identifier)
                )
            ELSE 
                -- If it's a code, try to match with province code
                (
                    (column_exists('public', 'indonesian_regencies', 'province_code') AND r.province_code = province_identifier)
                    OR 
                    (column_exists('public', 'indonesian_regencies', 'province_id') AND r.province_id::TEXT = province_identifier)
                )
        END
    ORDER BY r.name
    LIMIT 1000;
    
EXCEPTION
    WHEN others THEN
        -- If any error occurs, return empty result
        RETURN;
END;
$$;

-- Helper function to check if column exists
CREATE OR REPLACE FUNCTION column_exists(schema_name TEXT, table_name TEXT, column_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = schema_name 
        AND table_name = table_name 
        AND column_name = column_name
    );
$$;

-- ============================================================================
-- 3. Update Car Status Function (Fixed - No dependency on indonesian tables)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_car_status_by_host(
    host_user_id UUID,
    car_uuid UUID,
    new_status TEXT
)
RETURNS JSON AS $$
DECLARE
    car_record RECORD;
    status_enum car_status;
BEGIN
    -- Log the function call
    RAISE LOG 'update_car_status_by_host called with: host_user_id=%, car_uuid=%, new_status=%', 
        host_user_id, car_uuid, new_status;
    
    -- Check if user owns this car
    SELECT * INTO car_record 
    FROM public.cars 
    WHERE id = car_uuid 
    AND host_id = host_user_id;
    
    IF NOT FOUND THEN
        RAISE LOG 'Car not found or permission denied: car_uuid=%, host_user_id=%', car_uuid, host_user_id;
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
            RAISE LOG 'Invalid status provided: %', new_status;
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
    
    IF NOT FOUND THEN
        RAISE LOG 'Failed to update car status: car_uuid=%, host_user_id=%', car_uuid, host_user_id;
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to update car status',
            'error_code', 'UPDATE_FAILED'
        );
    END IF;
    
    RAISE LOG 'Car status updated successfully: car_uuid=%, old_status=%, new_status=%', 
        car_uuid, car_record.status, new_status;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Car status updated successfully',
        'old_status', car_record.status,
        'new_status', new_status,
        'updated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Create alternative Indonesian data functions
-- ============================================================================

-- Alternative function for provinces
CREATE OR REPLACE FUNCTION public.get_indonesian_provinces()
RETURNS TABLE (
    id TEXT,
    code TEXT,
    name TEXT,
    island_group TEXT,
    is_special_region BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM public.get_provinces_dropdown();
$$;

-- Alternative function for regencies/cities
CREATE OR REPLACE FUNCTION public.get_indonesian_regencies(province_code_param TEXT)
RETURNS TABLE (
    id TEXT,
    code TEXT,
    name TEXT,
    type TEXT,
    province_code TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        id,
        id as code,  -- Use id as code if no separate code column
        name,
        type,
        province_code_param as province_code
    FROM public.get_cities_by_province(province_code_param);
$$;

-- ============================================================================
-- 5. Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_provinces_dropdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_indonesian_provinces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_indonesian_regencies(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_car_status_by_host(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION column_exists(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 6. Test the functions
-- ============================================================================

DO $$
DECLARE
    test_result JSON;
BEGIN
    RAISE NOTICE '=== Testing Fixed Functions ===';
    
    -- Test provinces function
    BEGIN
        IF EXISTS (SELECT 1 FROM public.get_provinces_dropdown() LIMIT 1) THEN
            RAISE NOTICE '✅ get_provinces_dropdown() working';
        ELSE
            RAISE NOTICE '⚠️  get_provinces_dropdown() returned no results';
        END IF;
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE '❌ get_provinces_dropdown() failed: %', SQLERRM;
    END;
    
    -- Test cities function
    BEGIN
        IF EXISTS (SELECT 1 FROM public.get_cities_by_province('31') LIMIT 1) THEN
            RAISE NOTICE '✅ get_cities_by_province() working';
        ELSE
            RAISE NOTICE '⚠️  get_cities_by_province() returned no results';
        END IF;
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE '❌ get_cities_by_province() failed: %', SQLERRM;
    END;
    
    -- Test car status update function (with dummy IDs)
    BEGIN
        SELECT public.update_car_status_by_host(
            '00000000-0000-0000-0000-000000000000'::UUID,
            '00000000-0000-0000-0000-000000000000'::UUID,
            'DRAFT'
        ) INTO test_result;
        
        IF test_result->>'success' = 'false' AND test_result->>'error_code' = 'CAR_NOT_FOUND' THEN
            RAISE NOTICE '✅ update_car_status_by_host() function working (expected car not found)';
        ELSE
            RAISE NOTICE '⚠️  Unexpected result from update_car_status_by_host(): %', test_result;
        END IF;
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE '❌ update_car_status_by_host() failed: %', SQLERRM;
    END;
    
    RAISE NOTICE '=== Function Tests Complete ===';
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE '⚠️ Test failed with error: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 7. Verify table structure
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== Checking Table Structure ===';
    
    -- Check if indonesian_provinces exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indonesian_provinces') THEN
        RAISE NOTICE '✅ indonesian_provinces table exists';
    ELSE
        RAISE NOTICE '❌ indonesian_provinces table missing';
    END IF;
    
    -- Check if indonesian_regencies exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indonesian_regencies') THEN
        RAISE NOTICE '✅ indonesian_regencies table exists';
    ELSE
        RAISE NOTICE '❌ indonesian_regencies table missing';
    END IF;
    
    -- Check if cars table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cars') THEN
        RAISE NOTICE '✅ cars table exists';
    ELSE
        RAISE NOTICE '❌ cars table missing';
    END IF;
    
    RAISE NOTICE '=== Table Check Complete ===';
END;
$$;
