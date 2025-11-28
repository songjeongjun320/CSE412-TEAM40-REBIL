-- Migration 38: Final fix for Indonesian address validation
-- Fix the case where flat fields have empty strings but nested fields have valid data
-- Date: 2025-01-12

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
    
    -- Extract city_id with fallback logic: if flat field is empty, use nested
    city_id_val := COALESCE(
        NULLIF(address_data->>'city_id', ''),    -- Use flat field if not empty string
        address_data->'city'->>'code',           -- Fallback to nested code
        address_data->'city'->>'id'              -- Fallback to nested id
    );
    
    -- Extract province_id with fallback logic: if flat field is empty, use nested  
    province_id_val := COALESCE(
        NULLIF(address_data->>'province_id', ''), -- Use flat field if not empty string
        address_data->'province'->>'code',        -- Fallback to nested code
        address_data->'province'->>'id'           -- Fallback to nested id
    );
    
    -- Both city_id and province_id must be present and non-null
    IF city_id_val IS NULL OR province_id_val IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if they are UUIDs (legacy format) - if valid UUIDs, validate against reference tables
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
        -- If not numeric, it's invalid
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

-- Test the final validation function
DO $$
DECLARE
    test_result BOOLEAN;
    test_data JSONB;
BEGIN
    RAISE NOTICE 'Testing FINAL validation function fix:';
    RAISE NOTICE '======================================';
    
    -- Test the problematic case: empty flat fields but valid nested fields
    test_data := '{
        "street_address": "Jl. Sudirman No. 123",
        "province": {"code": "31", "name": "DKI Jakarta"},
        "city": {"code": "3101", "name": "Jakarta Pusat"},
        "province_id": "",
        "city_id": "",
        "district_id": "",
        "village_id": "",
        "postal_code": "10110",
        "additional_info": ""
    }'::jsonb;
    
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'Empty flat fields + valid nested: % (SHOULD BE TRUE)', test_result;
    
    -- Test normal case: valid flat fields
    test_data := '{
        "street_address": "Jl. Sudirman No. 123",
        "province": {"code": "31", "name": "DKI Jakarta"},
        "city": {"code": "3101", "name": "Jakarta Pusat"},
        "province_id": "31",
        "city_id": "3101",
        "district_id": "",
        "village_id": "",
        "postal_code": "10110",
        "additional_info": ""
    }'::jsonb;
    
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'Valid flat fields: % (should be true)', test_result;
    
    -- Test invalid case: both flat and nested are invalid
    test_data := '{
        "street_address": "Jl. Sudirman No. 123",
        "province": {"code": "", "name": ""},
        "city": {"code": "", "name": ""},
        "province_id": "",
        "city_id": "",
        "district_id": "",
        "village_id": "",
        "postal_code": "10110",
        "additional_info": ""
    }'::jsonb;
    
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'All fields empty: % (should be false)', test_result;
    
    RAISE NOTICE '======================================';
    RAISE NOTICE 'CRITICAL FIX: Empty string handling should now work!';
END $$;