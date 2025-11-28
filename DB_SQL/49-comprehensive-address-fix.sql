-- ============================================================================
-- Comprehensive Address System Fix
-- ============================================================================
-- This script performs a full cleanup and rebuild of address-related functions,
-- views, and triggers to resolve persistent schema conflicts.
--
-- It will:
-- 1. Drop all potentially conflicting old objects (triggers, functions, views).
-- 2. Recreate the required RPC functions with their correct definitions.
-- ============================================================================

-- Temporarily disable all triggers to avoid conflicts
SET session_replication_role = replica;

-- Use a DO block to allow for procedural logic like RAISE NOTICE
DO $$
BEGIN
    -- ============================================================================
    -- Phase 1: Clean Up Old Database Objects
    -- ============================================================================

    RAISE NOTICE '[Phase 1] Cleaning up old database objects...';

    -- Step 1.1: Drop old triggers that are causing update errors
    RAISE NOTICE '--- Dropping old triggers...';
    DROP TRIGGER IF EXISTS validate_user_address_trigger ON public.user_profiles;
    DROP TRIGGER IF EXISTS validate_car_location_trigger ON public.cars;
    DROP TRIGGER IF EXISTS validate_booking_location_trigger ON public.bookings;
    RAISE NOTICE '--- ✅ Old triggers dropped.';

    -- Step 1.2: Drop old RPC functions to ensure a clean slate
    RAISE NOTICE '--- Dropping old RPC functions...';
    DROP FUNCTION IF EXISTS public.get_provinces_dropdown();
    DROP FUNCTION IF EXISTS public.get_cities_by_province(TEXT);
    DROP FUNCTION IF EXISTS public.get_cities_by_province(UUID);
    DROP FUNCTION IF EXISTS public.search_cities(TEXT);
    DROP FUNCTION IF EXISTS get_province_id(TEXT);
    DROP FUNCTION IF EXISTS public.update_car_status_by_host(UUID, UUID, TEXT);
    RAISE NOTICE '--- ✅ Old RPC functions dropped.';

    -- Step 1.3: Drop old views
    RAISE NOTICE '--- Dropping old views...';
    DROP VIEW IF EXISTS public.provinces_dropdown;
    DROP VIEW IF EXISTS public.cities_by_province;
    DROP VIEW IF EXISTS public.major_cities_dropdown;
    RAISE NOTICE '--- ✅ Old views dropped.';

    RAISE NOTICE '[Phase 1] Cleanup complete.';
END $$;


DO $$
BEGIN
    -- ============================================================================
    -- Phase 2: Recreate Required RPC Functions
    -- ============================================================================
    RAISE NOTICE '[Phase 2] Recreating essential RPC functions...';

    -- Function 2.1: Get provinces dropdown
    RAISE NOTICE '--- Creating get_provinces_dropdown()...';
    CREATE OR REPLACE FUNCTION public.get_provinces_dropdown()
    RETURNS TABLE (
        id TEXT,
        name TEXT,
        code TEXT,
        island_group TEXT,
        is_special_region BOOLEAN
    )
    LANGUAGE SQL STABLE
    AS $function$
        SELECT
            p.id::TEXT,
            p.name,
            p.code,
            COALESCE(p.island_group, 'Unknown') as island_group,
            COALESCE(p.is_special_region, false) as is_special_region
        FROM public.indonesian_provinces p
        WHERE p.name IS NOT NULL AND p.code IS NOT NULL
        ORDER BY p.name
        LIMIT 100;
    $function$;
    RAISE NOTICE '--- ✅ get_provinces_dropdown() created.';


    -- Function 2.2: Get regencies/cities by province
    RAISE NOTICE '--- Creating get_cities_by_province()...';
    CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_identifier TEXT)
    RETURNS TABLE (
        id TEXT,
        name TEXT,
        type TEXT,
        is_capital BOOLEAN,
        is_major_city BOOLEAN,
        population INTEGER
    )
    LANGUAGE SQL STABLE
    AS $function$
        SELECT
            r.id::TEXT,
            r.name,
            COALESCE(r.type, 'Regency') as type,
            COALESCE(r.is_capital, false) as is_capital,
            COALESCE(r.is_major_city, false) as is_major_city,
            r.population
        FROM public.indonesian_regencies r
        WHERE
            r.name IS NOT NULL
            AND r.code IS NOT NULL
            AND (
                province_identifier IS NULL
                OR r.province_code = province_identifier
                OR EXISTS (
                    SELECT 1 FROM public.indonesian_provinces p
                    WHERE p.id::TEXT = province_identifier AND r.province_id = p.id
                )
            )
        ORDER BY r.name
        LIMIT 1000;
    $function$;
    RAISE NOTICE '--- ✅ get_cities_by_province() created.';


    -- Function 2.3: Update car status by host
    RAISE NOTICE '--- Creating update_car_status_by_host()...';
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
    RAISE NOTICE '--- ✅ update_car_status_by_host() created.';


    -- ============================================================================
    -- Phase 3: Grant Permissions
    -- ============================================================================
    RAISE NOTICE '[Phase 3] Granting permissions for new functions...';
    GRANT EXECUTE ON FUNCTION public.get_provinces_dropdown() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.update_car_status_by_host(UUID, UUID, TEXT) TO authenticated;
    RAISE NOTICE '[Phase 3] ✅ Permissions granted.';


    RAISE NOTICE '=== Comprehensive Fix Complete ===';

END $$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;
