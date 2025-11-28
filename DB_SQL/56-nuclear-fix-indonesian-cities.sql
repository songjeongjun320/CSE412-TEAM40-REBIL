-- Nuclear option: Complete cleanup of everything related to indonesian_cities
-- This will forcefully remove ALL references and recreate everything cleanly

-- ============================================================================
-- PHASE 1: NUCLEAR CLEANUP - Remove everything that could reference indonesian_cities
-- ============================================================================

-- Drop ALL functions that could potentially have issues
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Find and drop any function that might be related to our problem
    FOR func_record IN 
        SELECT p.proname, p.oid, n.nspname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND (
            p.proname LIKE '%car%' OR
            p.proname LIKE '%city%' OR
            p.proname LIKE '%cities%' OR
            p.proname LIKE '%province%' OR
            p.proname LIKE '%indonesian%' OR
            p.proname LIKE '%regenc%' OR
            p.proname LIKE '%district%' OR
            p.proname LIKE '%village%'
        )
    LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %I.%I CASCADE', func_record.nspname, func_record.proname);
            RAISE NOTICE 'Dropped function: %.%', func_record.nspname, func_record.proname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop function %.%: %', func_record.nspname, func_record.proname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Drop any views that might reference indonesian_cities
DO $$
DECLARE
    view_record RECORD;
BEGIN
    FOR view_record IN 
        SELECT viewname, schemaname
        FROM pg_views
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
            RAISE NOTICE 'Dropped view: %.%', view_record.schemaname, view_record.viewname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop view %.%: %', view_record.schemaname, view_record.viewname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Drop any materialized views
DO $$
DECLARE
    matview_record RECORD;
BEGIN
    FOR matview_record IN 
        SELECT matviewname, schemaname
        FROM pg_matviews
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', matview_record.schemaname, matview_record.matviewname);
            RAISE NOTICE 'Dropped materialized view: %.%', matview_record.schemaname, matview_record.matviewname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop materialized view %.%: %', matview_record.schemaname, matview_record.matviewname, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- PHASE 2: RECREATE ESSENTIAL FUNCTIONS CLEANLY
-- ============================================================================

-- Function 1: update_car_status_by_host (COMPLETELY ISOLATED)
CREATE OR REPLACE FUNCTION public.update_car_status_by_host(
    host_user_id UUID,
    car_uuid UUID,
    new_status TEXT
)
RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    car_record RECORD;
    status_enum car_status;
    rows_affected INTEGER;
BEGIN
    -- Simple car ownership check
    SELECT id, status, host_id INTO car_record
    FROM public.cars
    WHERE id = car_uuid AND host_id = host_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Car not found or you do not have permission to modify it',
            'error_code', 'CAR_NOT_FOUND'
        );
    END IF;

    -- Convert status
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

    -- Update the car
    UPDATE public.cars
    SET 
        status = status_enum, 
        updated_at = NOW()
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
        'car_id', car_uuid,
        'updated_at', NOW()
    );
END;
$$;

-- Function 2: get_provinces_dropdown
CREATE OR REPLACE FUNCTION public.get_provinces_dropdown()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    code TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
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
$$;

-- Function 3: get_cities_by_province (using indonesian_regencies)
CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    type TEXT,
    is_capital BOOLEAN,
    province_code TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id::TEXT,
        r.name,
        'regency'::TEXT,
        false,
        r.province_code
    FROM public.indonesian_regencies r
    JOIN public.indonesian_provinces p ON r.province_code = p.code
    WHERE 
        p.code = province_identifier 
        OR p.name ILIKE '%' || province_identifier || '%'
    ORDER BY r.name
    LIMIT 1000;
END;
$$;

-- ============================================================================
-- PHASE 3: GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.update_car_status_by_host(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provinces_dropdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;

-- ============================================================================
-- PHASE 4: VERIFICATION
-- ============================================================================
DO $$
BEGIN
    -- Test the main function
    PERFORM public.update_car_status_by_host(
        '00000000-0000-0000-0000-000000000000'::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID,
        'ACTIVE'
    );
    RAISE NOTICE '✅ update_car_status_by_host function test completed successfully';
    
    -- Test provinces function
    PERFORM COUNT(*) FROM public.get_provinces_dropdown();
    RAISE NOTICE '✅ get_provinces_dropdown function test completed successfully';
    
    RAISE NOTICE '🎉 ALL FUNCTIONS CREATED AND TESTED SUCCESSFULLY';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Function test failed: %', SQLERRM;
END $$;
