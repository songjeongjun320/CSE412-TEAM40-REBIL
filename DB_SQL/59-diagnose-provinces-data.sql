-- Comprehensive diagnosis of provinces data issue

-- 1. Check if table exists and has data
SELECT 
    'TABLE EXISTENCE CHECK' as section,
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename LIKE '%province%';

-- 2. Check table structure
SELECT 
    'TABLE STRUCTURE' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'indonesian_provinces'
ORDER BY ordinal_position;

-- 3. Count total records
SELECT 
    'RECORD COUNT' as section,
    COUNT(*) as total_provinces,
    COUNT(CASE WHEN code IS NOT NULL THEN 1 END) as provinces_with_code,
    COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as provinces_with_name,
    COUNT(CASE WHEN id IS NOT NULL THEN 1 END) as provinces_with_id
FROM public.indonesian_provinces;

-- 4. Show sample data
SELECT 
    'SAMPLE DATA' as section,
    id, 
    code, 
    name,
    CASE 
        WHEN id IS NULL THEN 'MISSING_ID'
        WHEN code IS NULL THEN 'MISSING_CODE' 
        WHEN name IS NULL THEN 'MISSING_NAME'
        ELSE 'OK'
    END as status
FROM public.indonesian_provinces 
ORDER BY name 
LIMIT 10;

-- 5. Check for data integrity issues
SELECT 
    'DATA INTEGRITY' as section,
    'Duplicates by code' as check_type,
    code,
    COUNT(*) as count
FROM public.indonesian_provinces 
WHERE code IS NOT NULL
GROUP BY code
HAVING COUNT(*) > 1;

-- 6. Test the exact query from the API
SELECT 
    'API QUERY TEST' as section,
    id, 
    name, 
    code
FROM public.indonesian_provinces
ORDER BY name;

