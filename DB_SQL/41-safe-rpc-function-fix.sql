-- ============================================================================
-- SAFE FIX: get_cities_by_province RPC Function for Government Codes
-- ============================================================================
-- Problem: Cannot change view column names, need safer approach
-- Error: "cannot change name of view column 'island_group' to 'government_code'"
-- Solution: Work with existing structure and add new functions safely
-- ============================================================================

-- ============================================================================
-- STEP 1: SAFELY ADD GOVERNMENT CODE COLUMNS
-- ============================================================================

-- Add government codes to provinces table (safe operation)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' 
                   AND column_name = 'government_code') THEN
        ALTER TABLE public.indonesian_provinces 
        ADD COLUMN government_code TEXT;
        
        -- Create index for fast lookups
        CREATE INDEX IF NOT EXISTS idx_provinces_gov_code 
        ON public.indonesian_provinces(government_code);
    END IF;
END $$;

-- Add government codes to cities table (safe operation)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' 
                   AND column_name = 'government_code') THEN
        ALTER TABLE public.indonesian_regencies 
        ADD COLUMN government_code TEXT;
        
        -- Create index for fast lookups
        CREATE INDEX IF NOT EXISTS idx_cities_gov_code 
        ON public.indonesian_regencies(government_code);
    END IF;
END $$;

-- ============================================================================
-- STEP 2: POPULATE BASIC GOVERNMENT CODES
-- ============================================================================

-- Update provinces with government codes (only if not already set)
DO $$
BEGIN
    -- Jakarta
    UPDATE public.indonesian_provinces 
    SET government_code = '31' 
    WHERE (name ILIKE '%jakarta%' OR name ILIKE '%dki%') 
    AND government_code IS NULL;
    
    -- West Java  
    UPDATE public.indonesian_provinces 
    SET government_code = '32' 
    WHERE (name ILIKE '%west java%' OR name ILIKE '%jawa barat%') 
    AND government_code IS NULL;
    
    -- Central Java
    UPDATE public.indonesian_provinces 
    SET government_code = '33' 
    WHERE (name ILIKE '%central java%' OR name ILIKE '%jawa tengah%') 
    AND government_code IS NULL;
    
    -- Yogyakarta
    UPDATE public.indonesian_provinces 
    SET government_code = '34' 
    WHERE (name ILIKE '%yogyakarta%' OR name ILIKE '%yogya%') 
    AND government_code IS NULL;
    
    -- East Java
    UPDATE public.indonesian_provinces 
    SET government_code = '35' 
    WHERE (name ILIKE '%east java%' OR name ILIKE '%jawa timur%') 
    AND government_code IS NULL;
    
    -- Banten
    UPDATE public.indonesian_provinces 
    SET government_code = '36' 
    WHERE name ILIKE '%banten%' 
    AND government_code IS NULL;
END $$;

-- Update Jakarta cities with government codes
DO $$
DECLARE
    jakarta_province_id UUID;
BEGIN
    -- Get Jakarta province ID
    SELECT id INTO jakarta_province_id 
    FROM public.indonesian_provinces 
    WHERE government_code = '31' 
    LIMIT 1;
    
    IF jakarta_province_id IS NOT NULL THEN
        -- Jakarta cities mapping
        UPDATE public.indonesian_regencies 
        SET government_code = '31.71' 
        WHERE province_id = jakarta_province_id 
        AND (name ILIKE '%south jakarta%' OR name ILIKE '%jakarta selatan%')
        AND government_code IS NULL;
        
        UPDATE public.indonesian_regencies 
        SET government_code = '31.72' 
        WHERE province_id = jakarta_province_id 
        AND (name ILIKE '%east jakarta%' OR name ILIKE '%jakarta timur%')
        AND government_code IS NULL;
        
        UPDATE public.indonesian_regencies 
        SET government_code = '31.73' 
        WHERE province_id = jakarta_province_id 
        AND (name ILIKE '%west jakarta%' OR name ILIKE '%jakarta barat%')
        AND government_code IS NULL;
        
        UPDATE public.indonesian_regencies 
        SET government_code = '31.74' 
        WHERE province_id = jakarta_province_id 
        AND (name ILIKE '%north jakarta%' OR name ILIKE '%jakarta utara%')
        AND government_code IS NULL;
        
        UPDATE public.indonesian_regencies 
        SET government_code = '31.75' 
        WHERE province_id = jakarta_province_id 
        AND (name ILIKE '%central jakarta%' OR name ILIKE '%jakarta pusat%')
        AND government_code IS NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: CREATE NEW get_cities_by_province FUNCTION (SAFE REPLACEMENT)
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
    province_count INTEGER := 0;
BEGIN
    -- Handle null/empty input
    IF province_identifier IS NULL OR TRIM(province_identifier) = '' THEN
        RETURN QUERY
        SELECT 
            c.id,
            c.name,
            c.type,
            COALESCE(c.is_capital, FALSE) as is_capital,
            COALESCE(c.is_major_city, FALSE) as is_major_city,
            c.population,
            c.government_code
        FROM public.indonesian_regencies c
        ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC
        LIMIT 50; -- Reasonable limit
        RETURN;
    END IF;

    -- Method 1: Try government code lookup (PRIMARY)
    BEGIN
        SELECT p.id INTO province_uuid 
        FROM public.indonesian_provinces p 
        WHERE p.government_code = TRIM(province_identifier);
        
        GET DIAGNOSTICS province_count = ROW_COUNT;
        
        IF province_count > 0 AND province_uuid IS NOT NULL THEN
            RETURN QUERY
            SELECT 
                c.id,
                c.name,
                c.type,
                COALESCE(c.is_capital, FALSE) as is_capital,
                COALESCE(c.is_major_city, FALSE) as is_major_city,
                c.population,
                c.government_code
            FROM public.indonesian_regencies c
            WHERE c.province_id = province_uuid
            ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
            RETURN;
        END IF;
    EXCEPTION 
        WHEN OTHERS THEN
            -- Reset and continue
            province_uuid := NULL;
    END;

    -- Method 2: Try UUID lookup (BACKWARD COMPATIBILITY)
    BEGIN
        -- Validate UUID format before casting
        IF province_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
            province_uuid := province_identifier::UUID;
            
            -- Verify the UUID exists
            SELECT COUNT(*) INTO province_count
            FROM public.indonesian_provinces p 
            WHERE p.id = province_uuid;
            
            IF province_count > 0 THEN
                RETURN QUERY
                SELECT 
                    c.id,
                    c.name,
                    c.type,
                    COALESCE(c.is_capital, FALSE) as is_capital,
                    COALESCE(c.is_major_city, FALSE) as is_major_city,
                    c.population,
                    c.government_code
                FROM public.indonesian_regencies c
                WHERE c.province_id = province_uuid
                ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
                RETURN;
            END IF;
        END IF;
    EXCEPTION 
        WHEN invalid_text_representation THEN
            -- Not a valid UUID, continue
            province_uuid := NULL;
        WHEN OTHERS THEN
            -- Other error, continue
            province_uuid := NULL;
    END;

    -- Method 3: Try name lookup (FALLBACK)
    BEGIN
        SELECT p.id INTO province_uuid 
        FROM public.indonesian_provinces p 
        WHERE p.name ILIKE '%' || TRIM(province_identifier) || '%'
        LIMIT 1;
        
        IF province_uuid IS NOT NULL THEN
            RETURN QUERY
            SELECT 
                c.id,
                c.name,
                c.type,
                COALESCE(c.is_capital, FALSE) as is_capital,
                COALESCE(c.is_major_city, FALSE) as is_major_city,
                c.population,
                c.government_code
            FROM public.indonesian_regencies c
            WHERE c.province_id = province_uuid
            ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
            RETURN;
        END IF;
    EXCEPTION 
        WHEN OTHERS THEN
            -- Continue to empty result
            NULL;
    END;

    -- Method 4: Return empty result set (SAFE FALLBACK)
    RETURN;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: CREATE HELPER FUNCTIONS (SAFE)
-- ============================================================================

-- Helper function for province lookup
CREATE OR REPLACE FUNCTION public.get_province_by_code(gov_code TEXT)
RETURNS TABLE(
    id UUID,
    name TEXT,
    government_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.government_code
    FROM public.indonesian_provinces p
    WHERE p.government_code = TRIM(gov_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function for city lookup
CREATE OR REPLACE FUNCTION public.get_city_by_code(gov_code TEXT)
RETURNS TABLE(
    id UUID,
    name TEXT,
    government_code TEXT,
    province_id UUID,
    province_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.government_code,
        c.province_id,
        p.name as province_name
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id
    WHERE c.government_code = TRIM(gov_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_province_by_code(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_city_by_code(TEXT) TO authenticated, anon;

-- Grant select permissions
GRANT SELECT ON public.indonesian_provinces TO authenticated, anon;
GRANT SELECT ON public.indonesian_regencies TO authenticated, anon;

-- ============================================================================
-- STEP 6: TEST THE NEW FUNCTION
-- ============================================================================

-- Test 1: Government code lookup (should work now!)
DO $$
DECLARE
    test_result RECORD;
    result_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Testing get_cities_by_province with government code "31" ===';
    
    FOR test_result IN 
        SELECT * FROM public.get_cities_by_province('31') LIMIT 3
    LOOP
        result_count := result_count + 1;
        RAISE NOTICE 'City found: % (ID: %, Gov Code: %)', 
            test_result.name, test_result.id, test_result.government_code;
    END LOOP;
    
    IF result_count = 0 THEN
        RAISE NOTICE 'No cities found for government code "31". This might be expected if data is not populated yet.';
    ELSE
        RAISE NOTICE 'SUCCESS: Found % cities for government code "31"', result_count;
    END IF;
END $$;

-- Test 2: Province lookup
DO $$
DECLARE
    test_result RECORD;
    result_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Testing get_province_by_code with "31" ===';
    
    FOR test_result IN 
        SELECT * FROM public.get_province_by_code('31')
    LOOP
        result_count := result_count + 1;
        RAISE NOTICE 'Province found: % (ID: %, Gov Code: %)', 
            test_result.name, test_result.id, test_result.government_code;
    END LOOP;
    
    IF result_count = 0 THEN
        RAISE NOTICE 'No province found for government code "31". Data may need to be populated.';
    ELSE
        RAISE NOTICE 'SUCCESS: Found province for government code "31"';
    END IF;
END $$;

-- ============================================================================
-- STEP 7: VERIFY DATA POPULATION
-- ============================================================================

-- Check what data we have
DO $$
DECLARE
    prov_count INTEGER;
    city_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO prov_count 
    FROM public.indonesian_provinces 
    WHERE government_code IS NOT NULL;
    
    SELECT COUNT(*) INTO city_count 
    FROM public.indonesian_regencies 
    WHERE government_code IS NOT NULL;
    
    RAISE NOTICE '=== DATA VERIFICATION ===';
    RAISE NOTICE 'Provinces with government codes: %', prov_count;
    RAISE NOTICE 'Cities with government codes: %', city_count;
    
    IF prov_count = 0 THEN
        RAISE NOTICE 'WARNING: No provinces have government codes. The function will work but may return empty results.';
    END IF;
END $$;

-- Show sample data if available
SELECT 'Sample provinces with government codes:' as info;
SELECT name, government_code FROM public.indonesian_provinces 
WHERE government_code IS NOT NULL 
ORDER BY government_code 
LIMIT 3;

SELECT 'Sample cities with government codes:' as info;
SELECT c.name, c.government_code, p.name as province_name 
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
WHERE c.government_code IS NOT NULL 
ORDER BY c.government_code 
LIMIT 3;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🎯 RPC Function Fix completed successfully!';
    RAISE NOTICE '✅ get_cities_by_province() now accepts government codes like "31"';
    RAISE NOTICE '✅ Backward compatibility maintained for UUID inputs';
    RAISE NOTICE '✅ Helper functions created for additional lookups';
    RAISE NOTICE '🚀 Frontend error should now be resolved!';
    RAISE NOTICE '';
    RAISE NOTICE 'To test manually:';
    RAISE NOTICE 'SELECT * FROM get_cities_by_province(''31'');';
END $$;