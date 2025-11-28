-- ============================================================================
-- Clean up old Indonesian Address System objects before applying the new schema
-- ============================================================================

-- Temporarily disable all triggers to avoid conflicts
SET session_replication_role = replica;

DO $$
BEGIN
    -- ============================================================================
    -- 1. Drop existing RPC functions that might conflict
    -- ============================================================================

    RAISE NOTICE 'Dropping old RPC functions...';

    DROP FUNCTION IF EXISTS public.get_provinces_dropdown();
    DROP FUNCTION IF EXISTS public.get_cities_by_province(TEXT);
    DROP FUNCTION IF EXISTS public.get_cities_by_province(UUID);
    DROP FUNCTION IF EXISTS public.search_cities(TEXT);
    DROP FUNCTION IF EXISTS get_province_id(TEXT);

    RAISE NOTICE '✅ Dropped old RPC functions.';

    -- ============================================================================
    -- 2. Drop existing views that might conflict
    -- ============================================================================

    RAISE NOTICE 'Dropping old views...';

    DROP VIEW IF EXISTS public.provinces_dropdown;
    DROP VIEW IF EXISTS public.cities_by_province;
    DROP VIEW IF EXISTS public.major_cities_dropdown;

    RAISE NOTICE '✅ Dropped old views.';

    -- ============================================================================
    -- 3. Drop old policies that are no longer needed
    -- ============================================================================

    RAISE NOTICE 'Dropping old RLS policies...';

    DROP POLICY IF EXISTS "Provinces viewable by authenticated users" ON public.indonesian_provinces;
    DROP POLICY IF EXISTS "Cities viewable by authenticated users" ON public.indonesian_regencies;

    RAISE NOTICE '✅ Dropped old RLS policies.';

    -- ============================================================================
    -- 4. Drop old triggers that might conflict
    -- ============================================================================

    RAISE NOTICE 'Dropping old triggers...';

    DROP TRIGGER IF EXISTS validate_user_address_trigger ON public.user_profiles;
    DROP TRIGGER IF EXISTS validate_car_location_trigger ON public.cars;
    DROP TRIGGER IF EXISTS validate_booking_location_trigger ON public.bookings;

    RAISE NOTICE '✅ Dropped old triggers.';

END $$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

DO $$
BEGIN
    RAISE NOTICE '=== Cleanup Complete ===';
    RAISE NOTICE 'Now, please run the "47-safe-schema-fix-no-triggers.sql" script to apply the latest schema.';
END $$;
