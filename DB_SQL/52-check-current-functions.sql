-- Check current functions in the database
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) ILIKE '%indonesian_cities%' THEN '❌ CONTAINS indonesian_cities'
        ELSE '✅ Clean'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'get_provinces_dropdown',
    'get_cities_by_province', 
    'update_car_status_by_host',
    'get_districts_by_regency',
    'get_villages_by_district'
)
ORDER BY p.proname;

-- Check for any functions that reference indonesian_cities
SELECT 
    p.proname as function_name,
    'References indonesian_cities' as issue
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) ILIKE '%indonesian_cities%';

-- Check current tables
SELECT 
    tablename,
    CASE 
        WHEN tablename LIKE '%indonesian%' THEN '📍 Indonesian Address Table'
        ELSE 'Other'
    END as category
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%indonesian%'
ORDER BY tablename;
