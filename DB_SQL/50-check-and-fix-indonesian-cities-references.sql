-- Check and fix indonesian_cities references
-- This script will identify and fix any remaining references to the non-existent indonesian_cities table

DO $$
BEGIN
    RAISE NOTICE '=== Checking for indonesian_cities references ===';
    
    -- Step 1: Check for functions that might reference indonesian_cities
    RAISE NOTICE '--- Checking functions that might reference indonesian_cities...';
    
    -- List all functions in the public schema
    SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND pg_get_functiondef(p.oid) ILIKE '%indonesian_cities%';
    
    -- Step 2: Check for views that might reference indonesian_cities
    RAISE NOTICE '--- Checking views that might reference indonesian_cities...';
    
    SELECT 
        viewname,
        definition
    FROM pg_views
    WHERE schemaname = 'public'
    AND definition ILIKE '%indonesian_cities%';
    
    -- Step 3: Check for triggers that might reference indonesian_cities
    RAISE NOTICE '--- Checking triggers that might reference indonesian_cities...';
    
    SELECT 
        t.tgname as trigger_name,
        c.relname as table_name,
        pg_get_triggerdef(t.oid) as trigger_definition
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND pg_get_triggerdef(t.oid) ILIKE '%indonesian_cities%';
    
    -- Step 4: Recreate update_car_status_by_host function to ensure it's clean
    RAISE NOTICE '--- Recreating update_car_status_by_host function...';
    
    DROP FUNCTION IF EXISTS public.update_car_status_by_host(UUID, UUID, TEXT);
    
    CREATE OR REPLACE FUNCTION public.update_car_status_by_host(
        host_user_id UUID,
        car_uuid UUID,
        new_status TEXT
    )
    RETURNS JSON AS $function$
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
    $function$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Grant permissions
    GRANT EXECUTE ON FUNCTION public.update_car_status_by_host(UUID, UUID, TEXT) TO authenticated;
    
    RAISE NOTICE '--- ✅ update_car_status_by_host function recreated successfully';
    
    -- Step 5: Ensure indonesian address functions use correct table names
    RAISE NOTICE '--- Checking Indonesian address functions...';
    
    -- Recreate get_cities_by_province to use indonesian_regencies
    DROP FUNCTION IF EXISTS public.get_cities_by_province(TEXT);
    
    CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_identifier TEXT)
    RETURNS TABLE(
        id UUID,
        name TEXT,
        code TEXT,
        province_code TEXT
    ) AS $function$
    BEGIN
        RETURN QUERY
        SELECT 
            r.id,
            r.name,
            r.code,
            r.province_code
        FROM public.indonesian_regencies r
        JOIN public.indonesian_provinces p ON r.province_code = p.code
        WHERE 
            (p.code = province_identifier OR p.name ILIKE '%' || province_identifier || '%')
        ORDER BY r.name
        LIMIT 1000;
    END;
    $function$ LANGUAGE plpgsql SECURITY DEFINER;
    
    GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;
    
    RAISE NOTICE '--- ✅ get_cities_by_province function updated to use indonesian_regencies';
    
    RAISE NOTICE '=== Fix complete ===';
    
END $$;
