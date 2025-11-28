-- Migration 36: Fix validation function bugs in Indonesian address validation
-- Addresses critical issues found after migration 35
-- Date: 2025-01-12

-- Fix the validate_indonesian_address function with proper government code validation
-- Use existing parameter name 'address_data' to avoid conflicts
CREATE OR REPLACE FUNCTION validate_indonesian_address(address_data JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    city_id_val TEXT;
    province_id_val TEXT;
    city_num INTEGER;
    province_num INTEGER;
BEGIN
    -- Handle null or empty input
    IF address_data IS NULL OR address_data = '{}'::jsonb THEN
        RETURN false;
    END IF;
    
    -- Extract city_id and province_id (support both nested and flat structure)
    city_id_val := COALESCE(
        address_data->>'city_id',
        address_data->'city'->>'id',
        address_data->'city'->>'code'
    );
    
    province_id_val := COALESCE(
        address_data->>'province_id', 
        address_data->'province'->>'id',
        address_data->'province'->>'code'
    );
    
    -- Both city_id and province_id must be present
    IF city_id_val IS NULL OR province_id_val IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if they are UUIDs (legacy format) - if valid UUIDs, assume they're correct
    BEGIN
        -- Try to cast to UUID, if successful, validate against reference tables
        IF city_id_val::uuid IS NOT NULL AND province_id_val::uuid IS NOT NULL THEN
            -- UUID format validation - check if they exist in reference tables
            RETURN EXISTS(SELECT 1 FROM indonesian_regencies WHERE id = city_id_val::uuid) 
                   AND EXISTS(SELECT 1 FROM indonesian_provinces WHERE id = province_id_val::uuid);
        END IF;
    EXCEPTION WHEN invalid_text_representation THEN
        -- Not UUIDs, continue with government code validation
        NULL;
    END;
    
    -- Government code validation
    BEGIN
        city_num := city_id_val::INTEGER;
        province_num := province_id_val::INTEGER;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN false;
    END;
    
    -- Province code validation (11-94 based on Indonesian BPS codes)
    IF province_num < 11 OR province_num > 94 THEN
        RETURN false;
    END IF;
    
    -- City code validation (must be 4 digits, 1101-9471)
    IF city_num < 1101 OR city_num > 9471 THEN
        RETURN false;
    END IF;
    
    -- Relationship validation: city code prefix must match province code
    -- City code format: PPCC where PP is province code, CC is city code within province
    IF (city_num / 100) != province_num THEN
        RETURN false;
    END IF;
    
    -- Additional validation: check common invalid ranges
    -- Some province codes are reserved/unused
    IF province_num IN (17, 20, 25, 29, 30, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 93) THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Update the format_indonesian_address function to handle the corrected validation
CREATE OR REPLACE FUNCTION format_indonesian_address(address_data JSONB)
RETURNS TEXT AS $$
DECLARE
    city_id_val TEXT;
    province_id_val TEXT;
    city_name TEXT;
    province_name TEXT;
    formatted_address TEXT := '';
BEGIN
    -- Handle null input
    IF address_data IS NULL OR address_data = '{}'::jsonb THEN
        RETURN 'Invalid address data';
    END IF;
    
    -- Extract IDs with support for both nested and flat structure
    city_id_val := COALESCE(
        address_data->>'city_id',
        address_data->'city'->>'id',
        address_data->'city'->>'code'
    );
    
    province_id_val := COALESCE(
        address_data->>'province_id',
        address_data->'province'->>'id', 
        address_data->'province'->>'code'
    );
    
    -- Try to get names from nested structure first
    city_name := COALESCE(
        address_data->'city'->>'name',
        address_data->>'city_name'
    );
    
    province_name := COALESCE(
        address_data->'province'->>'name',
        address_data->>'province_name'
    );
    
    -- If no names in data, try to fetch from reference tables
    IF city_name IS NULL OR province_name IS NULL THEN
        BEGIN
            -- Try UUID lookup first
            IF city_id_val IS NOT NULL THEN
                SELECT name INTO city_name FROM indonesian_regencies WHERE id = city_id_val::uuid;
            END IF;
            
            IF province_id_val IS NOT NULL THEN
                SELECT name INTO province_name FROM indonesian_provinces WHERE id = province_id_val::uuid;
            END IF;
        EXCEPTION WHEN invalid_text_representation THEN
            -- Not UUIDs, try government code lookup (if reference tables support it)
            -- For now, use the codes as fallback
            city_name := COALESCE(city_name, 'City ' || city_id_val);
            province_name := COALESCE(province_name, 'Province ' || province_id_val);
        END;
    END IF;
    
    -- Build formatted address
    IF city_name IS NOT NULL AND province_name IS NOT NULL THEN
        formatted_address := city_name || ', ' || province_name;
    ELSIF city_name IS NOT NULL THEN
        formatted_address := city_name;
    ELSIF province_name IS NOT NULL THEN
        formatted_address := province_name;
    ELSE
        formatted_address := 'Unknown location';
    END IF;
    
    RETURN formatted_address;
END;
$$ LANGUAGE plpgsql;

-- Test the updated validation function with known good and bad values
DO $$
DECLARE
    test_result BOOLEAN;
BEGIN
    -- Test valid government codes
    SELECT validate_indonesian_address('{"city_id": "3101", "province_id": "31"}'::jsonb) INTO test_result;
    RAISE NOTICE 'Valid Jakarta codes test: %', test_result;
    
    -- Test invalid government codes (should fail)
    SELECT validate_indonesian_address('{"city_id": "9999", "province_id": "99"}'::jsonb) INTO test_result;
    RAISE NOTICE 'Invalid codes test (should be false): %', test_result;
    
    -- Test mismatched codes (should fail)
    SELECT validate_indonesian_address('{"city_id": "3201", "province_id": "31"}'::jsonb) INTO test_result;
    RAISE NOTICE 'Mismatched codes test (should be false): %', test_result;
    
    -- Test nested structure
    SELECT validate_indonesian_address('{"city": {"id": "3101"}, "province": {"id": "31"}}'::jsonb) INTO test_result;
    RAISE NOTICE 'Nested structure test: %', test_result;
END $$;