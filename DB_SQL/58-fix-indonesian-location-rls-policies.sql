-- Fix Indonesian Location Tables RLS Policies
-- Date: 2025-01-13
-- Purpose: Add missing RLS policies for provinces and regencies tables to allow API access

-- ==============================================================================
-- PROBLEM ANALYSIS:
-- - All Indonesian location tables have RLS enabled
-- - Only districts and villages have RLS policies allowing authenticated users
-- - provinces and regencies tables have NO policies, blocking all access
-- - This causes API endpoints to return empty results
-- ==============================================================================

BEGIN;

-- Add RLS policy for provinces table to allow public read access
CREATE POLICY "Indonesian provinces are publicly viewable" 
ON indonesian_provinces FOR SELECT 
TO public 
USING (true);

-- Add RLS policy for regencies table to allow public read access  
CREATE POLICY "Indonesian regencies are publicly viewable"
ON indonesian_regencies FOR SELECT 
TO public 
USING (true);

-- Update existing policies for districts and villages to allow public access too
-- (Currently they only allow authenticated users)
DROP POLICY IF EXISTS "Districts are viewable by authenticated users" ON indonesian_districts;
CREATE POLICY "Indonesian districts are publicly viewable"
ON indonesian_districts FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Villages are viewable by authenticated users" ON indonesian_villages;
CREATE POLICY "Indonesian villages are publicly viewable"
ON indonesian_villages FOR SELECT 
TO public 
USING (true);

-- Grant usage on sequences if they exist
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Grant select permissions on the tables
GRANT SELECT ON indonesian_provinces TO anon, authenticated;
GRANT SELECT ON indonesian_regencies TO anon, authenticated;
GRANT SELECT ON indonesian_districts TO anon, authenticated;
GRANT SELECT ON indonesian_villages TO anon, authenticated;

COMMIT;

-- ==============================================================================
-- VERIFICATION QUERIES (run these after applying the migration):
-- ==============================================================================

-- Check RLS policies
/*
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename IN ('indonesian_provinces', 'indonesian_regencies', 'indonesian_districts', 'indonesian_villages')
ORDER BY tablename, policyname;
*/

-- Test data access
/*
SELECT COUNT(*) as province_count FROM indonesian_provinces;
SELECT COUNT(*) as regency_count FROM indonesian_regencies;
SELECT COUNT(*) as district_count FROM indonesian_districts;
SELECT COUNT(*) as village_count FROM indonesian_villages;
*/

-- ==============================================================================
-- EXPECTED RESULTS:
-- - All 4 tables should have "publicly viewable" RLS policies
-- - API endpoints should start returning location data
-- - CompactAddressForm should populate province/city dropdowns
-- ==============================================================================
