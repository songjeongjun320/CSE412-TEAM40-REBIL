-- ============================================================================
-- GET JAKARTA UUIDs FOR FRONTEND FALLBACK
-- ============================================================================
-- This script retrieves the actual UUIDs for Jakarta and other major cities
-- to be used in the frontend fallback addresses.

-- ============================================================================
-- STEP 1: GET JAKARTA UUIDs
-- ============================================================================

-- Get Jakarta city and province UUIDs
SELECT 
    'Jakarta UUIDs' as info_type,
    c.id as city_id,
    c.name as city_name,
    p.id as province_id,
    p.name as province_name,
    CONCAT(
        'export const JAKARTA_CITY_ID = ''', c.id, ''';', CHR(10),
        'export const JAKARTA_PROVINCE_ID = ''', p.id, ''';'
    ) as typescript_constants
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
LIMIT 1;

-- ============================================================================
-- STEP 2: GET MAJOR CITIES UUIDs AS FALLBACKS
-- ============================================================================

-- Get other major cities for fallback options
SELECT 
    'Major Cities UUIDs' as info_type,
    c.id as city_id,
    c.name as city_name,
    p.id as province_id,
    p.name as province_name,
    c.population,
    CONCAT(
        'export const ', UPPER(REPLACE(c.name, ' ', '_')), '_CITY_ID = ''', c.id, ''';', CHR(10),
        'export const ', UPPER(REPLACE(p.name, ' ', '_')), '_PROVINCE_ID = ''', p.id, ''';'
    ) as typescript_constants
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
WHERE c.is_major_city = true
ORDER BY c.population DESC NULLS LAST
LIMIT 5;

-- ============================================================================
-- STEP 3: GENERATE COMPLETE TYPESCRIPT CONSTANTS
-- ============================================================================

-- Generate a complete TypeScript file content for easy copy-paste
WITH jakarta_data AS (
    SELECT c.id as city_id, p.id as province_id
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id
    WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
    LIMIT 1
),
major_cities AS (
    SELECT 
        c.id as city_id, 
        c.name as city_name,
        p.id as province_id,
        p.name as province_name,
        ROW_NUMBER() OVER (ORDER BY c.population DESC NULLS LAST) as rank
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id
    WHERE c.is_major_city = true
    LIMIT 3
)
SELECT 
    'TypeScript Constants File Content' as info_type,
    CONCAT(
        '// Auto-generated Indonesian City and Province UUIDs', CHR(10),
        '// Generated from database on ', CURRENT_TIMESTAMP, CHR(10), CHR(10),
        
        '// Jakarta (Primary Default)', CHR(10),
        'export const JAKARTA_CITY_ID = ''', jakarta_data.city_id, ''';', CHR(10),
        'export const JAKARTA_PROVINCE_ID = ''', jakarta_data.province_id, ''';', CHR(10), CHR(10),
        
        '// Major Cities Fallbacks', CHR(10),
        STRING_AGG(
            CONCAT(
                'export const ', UPPER(REPLACE(major_cities.city_name, ' ', '_')), '_CITY_ID = ''', major_cities.city_id, ''';', CHR(10),
                'export const ', UPPER(REPLACE(major_cities.province_name, ' ', '_')), '_PROVINCE_ID = ''', major_cities.province_id, ''';'
            ), 
            CHR(10) ORDER BY major_cities.rank
        )
    ) as typescript_file_content
FROM jakarta_data
CROSS JOIN major_cities
GROUP BY jakarta_data.city_id, jakarta_data.province_id;

-- ============================================================================
-- STEP 4: GENERATE UPDATED FALLBACK ADDRESSES
-- ============================================================================

-- Generate the complete fallback addresses object for the helper file
WITH jakarta_data AS (
    SELECT c.id as city_id, p.id as province_id
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id
    WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
    LIMIT 1
)
SELECT 
    'Updated JAKARTA_DEFAULT_ADDRESS' as info_type,
    CONCAT(
        'export const JAKARTA_DEFAULT_ADDRESS: IndonesianAddress = {', CHR(10),
        '  street_address: ''Default address - please update with correct information'',', CHR(10),
        '  village: '''',', CHR(10),
        '  district: '''',', CHR(10),
        '  city_id: ''', jakarta_data.city_id, ''', // Jakarta city UUID', CHR(10),
        '  province_id: ''', jakarta_data.province_id, ''', // DKI Jakarta province UUID', CHR(10),
        '  postal_code: ''10110'',', CHR(10),
        '  additional_info: ''Default Jakarta address for system initialization'',', CHR(10),
        '  latitude: -6.2088,', CHR(10),
        '  longitude: 106.8456', CHR(10),
        '};'
    ) as updated_address_object
FROM jakarta_data;

-- ============================================================================
-- STEP 5: VALIDATION CHECK
-- ============================================================================

-- Verify the default addresses would pass validation
DO $$
DECLARE
    jakarta_city_id UUID;
    jakarta_province_id UUID;
    test_address JSONB;
    is_valid BOOLEAN;
BEGIN
    -- Get Jakarta IDs
    SELECT c.id, p.id INTO jakarta_city_id, jakarta_province_id
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id
    WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
    LIMIT 1;
    
    IF jakarta_city_id IS NULL THEN
        RAISE EXCEPTION 'Jakarta not found in database! Please run the Indonesian address system setup first.';
    END IF;
    
    -- Create test address
    test_address := jsonb_build_object(
        'street_address', 'Test Address',
        'city_id', jakarta_city_id,
        'province_id', jakarta_province_id
    );
    
    -- Test validation
    SELECT public.validate_indonesian_address(test_address) INTO is_valid;
    
    IF is_valid THEN
        RAISE NOTICE 'SUCCESS: Jakarta address passes validation with city_id: % and province_id: %', jakarta_city_id, jakarta_province_id;
    ELSE
        RAISE EXCEPTION 'FAILED: Jakarta address does not pass validation!';
    END IF;
END $$;

-- Final summary
SELECT 
    'Summary' as info_type,
    (SELECT COUNT(*) FROM public.indonesian_provinces) as total_provinces,
    (SELECT COUNT(*) FROM public.indonesian_regencies) as total_cities,
    (SELECT COUNT(*) FROM public.indonesian_regencies WHERE is_major_city = true) as major_cities,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.indonesian_regencies c
            JOIN public.indonesian_provinces p ON c.province_id = p.id
            WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
        ) THEN 'Jakarta Found ✓'
        ELSE 'Jakarta Missing ✗'
    END as jakarta_status;