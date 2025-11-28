-- Migration 37: Comprehensive fix for Indonesian address validation function
-- Fix validation to handle all CompactAddressForm data formats properly
-- Date: 2025-01-12

-- Replace the validation function with a more robust version
-- that handles both flat and nested structures correctly
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
    
    -- Extract city_id with priority: flat fields first, then nested
    city_id_val := COALESCE(
        address_data->>'city_id',
        address_data->'city'->>'code',
        address_data->'city'->>'id'
    );
    
    -- Extract province_id with priority: flat fields first, then nested  
    province_id_val := COALESCE(
        address_data->>'province_id',
        address_data->'province'->>'code', 
        address_data->'province'->>'id'
    );
    
    -- Both city_id and province_id must be present and non-empty
    IF city_id_val IS NULL OR city_id_val = '' OR province_id_val IS NULL OR province_id_val = '' THEN
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

-- Test the updated validation function with the exact CompactAddressForm format
DO $$
DECLARE
    test_result BOOLEAN;
    test_data JSONB;
BEGIN
    RAISE NOTICE 'Testing validation function with CompactAddressForm formats:';
    RAISE NOTICE '================================================================';
    
    -- Test CompactAddressForm format (most common case)
    test_data := '{
        "street_address": "Jl. Test Street 123",
        "province": {"code": "31", "name": "DKI Jakarta"},
        "city": {"code": "3101", "name": "Jakarta Pusat"},
        "district": null,
        "village": null,
        "province_id": "31",
        "city_id": "3101", 
        "district_id": "",
        "village_id": "",
        "postal_code": "10110",
        "additional_info": ""
    }'::jsonb;
    
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'CompactAddressForm format test: % (should be true)', test_result;
    
    -- Test with detailed mode (district/village included)
    test_data := '{
        "street_address": "Jl. Test Street 123", 
        "province": {"code": "31", "name": "DKI Jakarta"},
        "city": {"code": "3101", "name": "Jakarta Pusat"},
        "district": {"code": "3101010", "name": "Gambir"},
        "village": {"code": "3101010001", "name": "Kebon Kelapa"},
        "province_id": "31",
        "city_id": "3101",
        "district_id": "3101010",
        "village_id": "3101010001",
        "postal_code": "10110",
        "additional_info": ""
    }'::jsonb;
    
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'CompactAddressForm detailed format test: % (should be true)', test_result;
    
    -- Test minimal format
    test_data := '{"city_id": "3101", "province_id": "31"}'::jsonb;
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'Minimal format test: % (should be true)', test_result;
    
    -- Test nested only format
    test_data := '{"city": {"code": "3101"}, "province": {"code": "31"}}'::jsonb;
    SELECT validate_indonesian_address(test_data) INTO test_result; 
    RAISE NOTICE 'Nested only format test: % (should be true)', test_result;
    
    -- Test invalid format
    test_data := '{"city_id": "3201", "province_id": "31"}'::jsonb;
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'Invalid mismatch test: % (should be false)', test_result;
    
    -- Test empty string values (common issue)
    test_data := '{"city_id": "", "province_id": "31"}'::jsonb;
    SELECT validate_indonesian_address(test_data) INTO test_result;
    RAISE NOTICE 'Empty string test: % (should be false)', test_result;
    
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Validation function testing complete!';
END $$;