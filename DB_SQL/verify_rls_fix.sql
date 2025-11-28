-- Verification Script for Indonesian Location Tables RLS Fix
-- Run this after applying the RLS fix to verify everything is working

-- ==============================================================================
-- 1. CHECK RLS POLICIES
-- ==============================================================================
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

-- ==============================================================================
-- 2. TEST DATA ACCESS
-- ==============================================================================
-- These should all return counts without errors
SELECT COUNT(*) as province_count FROM indonesian_provinces;
SELECT COUNT(*) as regency_count FROM indonesian_regencies;
SELECT COUNT(*) as district_count FROM indonesian_districts;
SELECT COUNT(*) as village_count FROM indonesian_villages;

-- ==============================================================================
-- 3. TEST COMPLEX HIERARCHY QUERIES
-- ==============================================================================
-- Test regency with province join (this was failing before)
SELECT r.id, r.name, p.name as province_name
FROM indonesian_regencies r
JOIN indonesian_provinces p ON r.province_id = p.id
LIMIT 5;

-- Test district with regency and province join (this was failing before)
SELECT d.id, d.name, r.name as regency_name, p.name as province_name
FROM indonesian_districts d
JOIN indonesian_regencies r ON d.regency_id = r.id
JOIN indonesian_provinces p ON r.province_id = p.id
LIMIT 5;

-- Test village with full hierarchy (this was failing before)
SELECT v.id, v.name, d.name as district_name, r.name as regency_name, p.name as province_name
FROM indonesian_villages v
JOIN indonesian_districts d ON v.district_id = d.id
JOIN indonesian_regencies r ON d.regency_id = r.id
JOIN indonesian_provinces p ON r.province_id = p.id
LIMIT 5;

-- ==============================================================================
-- 4. TEST FOREIGN KEY RELATIONSHIPS
-- ==============================================================================
-- Check if foreign keys exist and are properly linked
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name as foreign_table,
    ccu.column_name as foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('indonesian_regencies', 'indonesian_districts', 'indonesian_villages')
ORDER BY tc.table_name;

-- ==============================================================================
-- 5. EXPECTED RESULTS AFTER FIX:
-- ==============================================================================
-- ✅ All 4 tables should have "publicly viewable" RLS policies
-- ✅ All SELECT queries should return data without errors
-- ✅ All JOIN queries should execute successfully
-- ✅ Foreign key relationships should be visible and properly configured
-- ✅ API endpoints should start returning location data
-- ✅ IndonesianAddressService methods should work without 400 errors
-- ==============================================================================