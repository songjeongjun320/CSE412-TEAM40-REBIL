-- Verify and fix renter_stats table access
-- This ensures RLS policies are working and table is accessible

-- Check if RLS is enabled on renter_stats table
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'renter_stats' AND schemaname = 'public';

-- Check RLS policies separately from pg_class
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'renter_stats' AND n.nspname = 'public';

-- Check existing policies on renter_stats
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'renter_stats' AND schemaname = 'public';

-- Ensure RLS is enabled
ALTER TABLE public.renter_stats ENABLE ROW LEVEL SECURITY;

-- Check if there's a unique constraint on renter_id (needed for proper stats)
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'renter_stats' 
  AND tc.constraint_type = 'UNIQUE'
  AND kcu.column_name = 'renter_id';

-- Add unique constraint on renter_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'renter_stats' 
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name = 'renter_id'
    ) THEN
        ALTER TABLE public.renter_stats 
        ADD CONSTRAINT renter_stats_renter_id_unique UNIQUE (renter_id);
    END IF;
END $$;

-- Check if the current user has proper access
SELECT 
    'Access test' as test_type,
    auth.uid() as current_user_id,
    EXISTS(
        SELECT 1 FROM public.renter_stats 
        WHERE renter_id = 'c1aa6a36-f420-4007-a6ef-caf56a49289d'
    ) as user_stats_exist,
    (
        SELECT COUNT(*) FROM public.renter_stats 
        WHERE renter_id = auth.uid()
    ) as current_user_accessible_records;

-- Test query that mimics the frontend call
SELECT 
    'Frontend query test' as test_type,
    COUNT(*) as accessible_records
FROM public.renter_stats 
WHERE renter_id = 'c1aa6a36-f420-4007-a6ef-caf56a49289d';

-- Final verification
SELECT 
    'Final verification' as status,
    COUNT(*) as total_renter_stats,
    COUNT(CASE WHEN total_reviews IS NOT NULL THEN 1 END) as with_reviews_column,
    COUNT(CASE WHEN calculated_at IS NOT NULL THEN 1 END) as with_calc_date_column,
    COUNT(CASE WHEN favorite_car_types IS NOT NULL THEN 1 END) as with_preferences
FROM public.renter_stats;