-- Fix Indonesian Location Tables RLS Policies
-- This script will be executed manually in Supabase SQL Editor
-- Date: 2025-01-13

BEGIN;

-- Drop existing policies first, then add new ones
DROP POLICY IF EXISTS "Indonesian provinces are publicly viewable" ON indonesian_provinces;
CREATE POLICY "Indonesian provinces are publicly viewable" 
ON indonesian_provinces FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Indonesian regencies are publicly viewable" ON indonesian_regencies;
CREATE POLICY "Indonesian regencies are publicly viewable"
ON indonesian_regencies FOR SELECT 
TO public 
USING (true);

-- Update existing policies for districts and villages to allow public access too
-- (Currently they only allow authenticated users)
DROP POLICY IF EXISTS "Districts are viewable by authenticated users" ON indonesian_districts;
DROP POLICY IF EXISTS "Indonesian districts are publicly viewable" ON indonesian_districts;
CREATE POLICY "Indonesian districts are publicly viewable"
ON indonesian_districts FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Villages are viewable by authenticated users" ON indonesian_villages;
DROP POLICY IF EXISTS "Indonesian villages are publicly viewable" ON indonesian_villages;
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