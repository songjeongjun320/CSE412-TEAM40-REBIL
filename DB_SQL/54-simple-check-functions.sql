-- Simple check for current functions without complex queries

-- Check if the main functions exist
SELECT 
    'update_car_status_by_host' as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' 
            AND p.proname = 'update_car_status_by_host'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status

UNION ALL

SELECT 
    'get_cities_by_province' as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' 
            AND p.proname = 'get_cities_by_province'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status

UNION ALL

SELECT 
    'get_provinces_dropdown' as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' 
            AND p.proname = 'get_provinces_dropdown'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

-- Check Indonesian tables
SELECT 
    tablename as table_name,
    '📍 Available' as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%indonesian%'
ORDER BY tablename;

-- Test the main function (this should work after running the fix)
-- Uncomment the line below to test after applying the fix:
-- SELECT public.update_car_status_by_host('00000000-0000-0000-0000-000000000000'::UUID, '00000000-0000-0000-0000-000000000000'::UUID, 'ACTIVE');
