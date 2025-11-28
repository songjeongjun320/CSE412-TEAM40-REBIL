-- Detailed diagnosis for indonesian_cities issue
-- This will help identify exactly where the problem is coming from

-- ============================================================================
-- STEP 1: Check all functions that exist in the database
-- ============================================================================
SELECT 
    'EXISTING FUNCTIONS' as section,
    p.proname as function_name,
    n.nspname as schema_name,
    p.oid::text as function_oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (
    p.proname LIKE '%update_car%' OR
    p.proname LIKE '%cities%' OR
    p.proname LIKE '%province%' OR
    p.proname LIKE '%indonesian%'
)
ORDER BY p.proname;

-- ============================================================================
-- STEP 2: Check function definitions for indonesian_cities references
-- ============================================================================
SELECT 
    'FUNCTION CONTENT CHECK' as section,
    p.proname as function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) ILIKE '%indonesian_cities%' THEN 
            '❌ CONTAINS indonesian_cities REFERENCE'
        ELSE 
            '✅ Clean - no indonesian_cities reference'
    END as status,
    LENGTH(pg_get_functiondef(p.oid)) as definition_length
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'update_car_status_by_host',
    'get_cities_by_province',
    'get_provinces_dropdown'
)
ORDER BY p.proname;

-- ============================================================================
-- STEP 3: Show actual function definition for update_car_status_by_host
-- ============================================================================
SELECT 
    'FUNCTION DEFINITION' as section,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'update_car_status_by_host';

-- ============================================================================
-- STEP 4: Check for any views that might reference indonesian_cities
-- ============================================================================
SELECT 
    'VIEWS CHECK' as section,
    viewname as view_name,
    CASE 
        WHEN definition ILIKE '%indonesian_cities%' THEN 
            '❌ CONTAINS indonesian_cities REFERENCE'
        ELSE 
            '✅ Clean'
    END as status
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- ============================================================================
-- STEP 5: Check for triggers that might reference indonesian_cities
-- ============================================================================
SELECT 
    'TRIGGERS CHECK' as section,
    t.tgname as trigger_name,
    c.relname as table_name,
    CASE 
        WHEN pg_get_triggerdef(t.oid) ILIKE '%indonesian_cities%' THEN 
            '❌ CONTAINS indonesian_cities REFERENCE'
        ELSE 
            '✅ Clean'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND NOT t.tgisinternal
ORDER BY t.tgname;

-- ============================================================================
-- STEP 6: Check for any materialized views
-- ============================================================================
SELECT 
    'MATERIALIZED VIEWS' as section,
    matviewname as view_name,
    CASE 
        WHEN definition ILIKE '%indonesian_cities%' THEN 
            '❌ CONTAINS indonesian_cities REFERENCE'
        ELSE 
            '✅ Clean'
    END as status
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

-- ============================================================================
-- STEP 7: Check for any dependencies
-- ============================================================================
SELECT 
    'DEPENDENCIES CHECK' as section,
    d.classid::regclass as dependent_type,
    d.objid as dependent_oid,
    d.refobjid as referenced_oid,
    CASE d.deptype
        WHEN 'n' THEN 'Normal'
        WHEN 'a' THEN 'Auto'
        WHEN 'i' THEN 'Internal'
        WHEN 'e' THEN 'Extension'
        WHEN 'p' THEN 'Pin'
        WHEN 'x' THEN 'Extension membership'
    END as dependency_type
FROM pg_depend d
WHERE EXISTS (
    SELECT 1 FROM pg_proc p 
    WHERE p.oid = d.objid 
    AND p.proname = 'update_car_status_by_host'
)
OR EXISTS (
    SELECT 1 FROM pg_proc p 
    WHERE p.oid = d.refobjid 
    AND p.proname = 'update_car_status_by_host'
);

-- ============================================================================
-- STEP 8: Test the function directly
-- ============================================================================
SELECT 
    'FUNCTION TEST' as section,
    'Testing update_car_status_by_host with dummy data' as test_description,
    public.update_car_status_by_host(
        '00000000-0000-0000-0000-000000000000'::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID,
        'ACTIVE'
    ) as result;
