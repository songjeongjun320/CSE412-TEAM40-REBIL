-- ============================================================================
-- FIX: get_cities_by_province RPC Function to Support Government Codes
-- ============================================================================
-- Problem: Frontend sends government codes like "31" but function expects UUIDs
-- Error: "invalid input syntax for type uuid: '31'"
-- Solution: Create new function that accepts both government codes and UUIDs
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE MAPPING TABLES FOR GOVERNMENT CODES
-- ============================================================================

-- Add government codes to existing province table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' 
                   AND column_name = 'government_code') THEN
        ALTER TABLE public.indonesian_provinces 
        ADD COLUMN government_code TEXT;
        
        -- Create unique constraint
        ALTER TABLE public.indonesian_provinces 
        ADD CONSTRAINT unique_province_gov_code UNIQUE (government_code);
        
        -- Create index for fast lookups
        CREATE INDEX IF NOT EXISTS idx_provinces_gov_code 
        ON public.indonesian_provinces(government_code);
    END IF;
END $$;

-- Add government codes to existing cities table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' 
                   AND column_name = 'government_code') THEN
        ALTER TABLE public.indonesian_regencies 
        ADD COLUMN government_code TEXT;
        
        -- Create unique constraint
        ALTER TABLE public.indonesian_regencies 
        ADD CONSTRAINT unique_city_gov_code UNIQUE (government_code);
        
        -- Create index for fast lookups
        CREATE INDEX IF NOT EXISTS idx_cities_gov_code 
        ON public.indonesian_regencies(government_code);
    END IF;
END $$;

-- ============================================================================
-- STEP 2: POPULATE GOVERNMENT CODES (Basic mapping for common provinces/cities)
-- ============================================================================

-- Update provinces with basic government codes if not populated
UPDATE public.indonesian_provinces SET government_code = '31' WHERE name = 'DKI Jakarta' AND government_code IS NULL;
UPDATE public.indonesian_provinces SET government_code = '32' WHERE name = 'West Java' AND government_code IS NULL;
UPDATE public.indonesian_provinces SET government_code = '33' WHERE name = 'Central Java' AND government_code IS NULL;
UPDATE public.indonesian_provinces SET government_code = '34' WHERE name = 'DI Yogyakarta' AND government_code IS NULL;
UPDATE public.indonesian_provinces SET government_code = '35' WHERE name = 'East Java' AND government_code IS NULL;
UPDATE public.indonesian_provinces SET government_code = '36' WHERE name = 'Banten' AND government_code IS NULL;

-- Update cities with government codes for Jakarta (example)
UPDATE public.indonesian_regencies SET government_code = '31.71' 
WHERE name = 'South Jakarta' AND government_code IS NULL
AND province_id = (SELECT id FROM public.indonesian_provinces WHERE government_code = '31');

UPDATE public.indonesian_regencies SET government_code = '31.72' 
WHERE name = 'East Jakarta' AND government_code IS NULL
AND province_id = (SELECT id FROM public.indonesian_provinces WHERE government_code = '31');

UPDATE public.indonesian_regencies SET government_code = '31.73' 
WHERE name = 'Central Jakarta' AND government_code IS NULL
AND province_id = (SELECT id FROM public.indonesian_provinces WHERE government_code = '31');

UPDATE public.indonesian_regencies SET government_code = '31.74' 
WHERE name = 'West Jakarta' AND government_code IS NULL
AND province_id = (SELECT id FROM public.indonesian_provinces WHERE government_code = '31');

UPDATE public.indonesian_regencies SET government_code = '31.75' 
WHERE name = 'North Jakarta' AND government_code IS NULL
AND province_id = (SELECT id FROM public.indonesian_provinces WHERE government_code = '31');

-- ============================================================================
-- STEP 3: CREATE ENHANCED get_cities_by_province FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_identifier TEXT)
RETURNS TABLE(
    id UUID,
    name TEXT,
    type TEXT,
    is_capital BOOLEAN,
    is_major_city BOOLEAN,
    population INTEGER,
    government_code TEXT
) AS $$
DECLARE
    province_uuid UUID := NULL;
BEGIN
    -- Handle null input
    IF province_identifier IS NULL THEN
        RETURN QUERY
        SELECT 
            c.id,
            c.name,
            c.type,
            c.is_capital,
            c.is_major_city,
            c.population,
            c.government_code
        FROM public.indonesian_regencies c
        ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
        RETURN;
    END IF;

    -- Method 1: Try to find province by government code first (primary method)
    BEGIN
        SELECT p.id INTO province_uuid 
        FROM public.indonesian_provinces p 
        WHERE p.government_code = province_identifier;
        
        IF province_uuid IS NOT NULL THEN
            RETURN QUERY
            SELECT 
                c.id,
                c.name,
                c.type,
                c.is_capital,
                c.is_major_city,
                c.population,
                c.government_code
            FROM public.indonesian_regencies c
            WHERE c.province_id = province_uuid
            ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
            RETURN;
        END IF;
    EXCEPTION 
        WHEN OTHERS THEN
            -- Continue to next method
            NULL;
    END;

    -- Method 2: Try to parse as UUID (backward compatibility)
    BEGIN
        -- Check if input is a valid UUID format
        IF province_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            province_uuid := province_identifier::UUID;
            
            RETURN QUERY
            SELECT 
                c.id,
                c.name,
                c.type,
                c.is_capital,
                c.is_major_city,
                c.population,
                c.government_code
            FROM public.indonesian_regencies c
            WHERE c.province_id = province_uuid
            ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
            RETURN;
        END IF;
    EXCEPTION 
        WHEN OTHERS THEN
            -- Continue to next method
            NULL;
    END;

    -- Method 3: Try to find by province name (fallback)
    BEGIN
        SELECT p.id INTO province_uuid 
        FROM public.indonesian_provinces p 
        WHERE p.name ILIKE province_identifier;
        
        IF province_uuid IS NOT NULL THEN
            RETURN QUERY
            SELECT 
                c.id,
                c.name,
                c.type,
                c.is_capital,
                c.is_major_city,
                c.population,
                c.government_code
            FROM public.indonesian_regencies c
            WHERE c.province_id = province_uuid
            ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
            RETURN;
        END IF;
    EXCEPTION 
        WHEN OTHERS THEN
            -- Continue to final fallback
            NULL;
    END;

    -- Method 4: Final fallback - return empty result with proper structure
    RETURN QUERY
    SELECT 
        NULL::UUID as id,
        ''::TEXT as name,
        ''::TEXT as type,
        FALSE::BOOLEAN as is_capital,
        FALSE::BOOLEAN as is_major_city,
        NULL::INTEGER as population,
        ''::TEXT as government_code
    WHERE FALSE; -- Return empty set with correct structure

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: CREATE HELPER FUNCTION FOR PROVINCE LOOKUP BY GOVERNMENT CODE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_province_by_government_code(gov_code TEXT)
RETURNS TABLE(
    id UUID,
    name TEXT,
    code TEXT,
    government_code TEXT,
    island_group TEXT,
    is_special_region BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.code,
        p.government_code,
        p.island_group,
        p.is_special_region
    FROM public.indonesian_provinces p
    WHERE p.government_code = gov_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: CREATE HELPER FUNCTION FOR CITY LOOKUP BY GOVERNMENT CODE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_city_by_government_code(gov_code TEXT)
RETURNS TABLE(
    id UUID,
    name TEXT,
    type TEXT,
    government_code TEXT,
    province_id UUID,
    province_name TEXT,
    is_capital BOOLEAN,
    is_major_city BOOLEAN,
    population INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.type,
        c.government_code,
        c.province_id,
        p.name as province_name,
        c.is_capital,
        c.is_major_city,
        c.population
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id
    WHERE c.government_code = gov_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: UPDATE get_provinces_dropdown TO INCLUDE GOVERNMENT CODES
-- ============================================================================

CREATE OR REPLACE VIEW public.provinces_dropdown AS
SELECT 
    id,
    name,
    code,
    government_code,
    island_group,
    is_special_region
FROM public.indonesian_provinces
ORDER BY name ASC;

-- Recreate the function to match the view
CREATE OR REPLACE FUNCTION public.get_provinces_dropdown()
RETURNS TABLE(
    id UUID,
    name TEXT,
    code TEXT,
    government_code TEXT,
    island_group TEXT,
    is_special_region BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.provinces_dropdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_province_by_government_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_city_by_government_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provinces_dropdown() TO authenticated;

-- Grant select permissions on the updated tables
GRANT SELECT ON public.indonesian_provinces TO authenticated;
GRANT SELECT ON public.indonesian_regencies TO authenticated;

-- ============================================================================
-- STEP 8: TEST THE FUNCTIONS
-- ============================================================================

-- Test with government code (should work now)
SELECT 'Testing with government code 31 (Jakarta):' as test_case;
SELECT * FROM public.get_cities_by_province('31') LIMIT 3;

-- Test province lookup by government code
SELECT 'Testing province lookup by government code:' as test_case;
SELECT * FROM public.get_province_by_government_code('31');

-- Test city lookup by government code
SELECT 'Testing city lookup by government code:' as test_case;
SELECT * FROM public.get_city_by_government_code('31.73');

-- Test updated provinces dropdown
SELECT 'Testing updated provinces dropdown:' as test_case;
SELECT * FROM public.get_provinces_dropdown() WHERE government_code IS NOT NULL LIMIT 3;

-- ============================================================================
-- STEP 9: COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.get_cities_by_province(TEXT) IS 
'Returns cities for a given province identifier. Supports both government codes (e.g., "31") and UUIDs for backward compatibility.';

COMMENT ON FUNCTION public.get_province_by_government_code(TEXT) IS 
'Returns province data by government code (e.g., "31" for Jakarta).';

COMMENT ON FUNCTION public.get_city_by_government_code(TEXT) IS 
'Returns city data by government code (e.g., "31.73" for Central Jakarta).';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if government codes are populated
SELECT 
    'Provinces with government codes:' as info,
    COUNT(*) as count 
FROM public.indonesian_provinces 
WHERE government_code IS NOT NULL;

SELECT 
    'Cities with government codes:' as info,
    COUNT(*) as count 
FROM public.indonesian_regencies 
WHERE government_code IS NOT NULL;

-- Show sample data
SELECT 'Sample provinces with government codes:' as info;
SELECT name, government_code FROM public.indonesian_provinces 
WHERE government_code IS NOT NULL 
ORDER BY government_code 
LIMIT 5;

SELECT 'Sample cities with government codes:' as info;
SELECT c.name, c.government_code, p.name as province_name 
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
WHERE c.government_code IS NOT NULL 
ORDER BY c.government_code 
LIMIT 5;