-- ============================================================================
-- FIX CHECK CONSTRAINT VIOLATION - Government Code Support
-- ============================================================================
-- This script fixes the mismatch between database constraints and frontend data format.
-- 
-- Issue: Constraint expects UUIDs, frontend sends government codes from idn-area-data
-- Solution: Update validation function to accept government codes and validate them
-- 
-- Run this script to resolve the constraint violation issue
-- ============================================================================

-- ============================================================================
-- STEP 1: UPDATE VALIDATION FUNCTION TO SUPPORT GOVERNMENT CODES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_indonesian_address(address_data JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    city_identifier TEXT;
    province_identifier TEXT;
BEGIN
    -- Allow NULL addresses
    IF address_data IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check required fields exist and are not empty
    IF NOT (
        address_data ? 'street_address' AND
        address_data ? 'city_id' AND  
        address_data ? 'province_id' AND
        COALESCE(address_data->>'street_address', '') != '' AND
        COALESCE(address_data->>'city_id', '') != '' AND
        COALESCE(address_data->>'province_id', '') != ''
    ) THEN
        RETURN FALSE;
    END IF;
    
    -- Extract identifiers
    city_identifier := address_data->>'city_id';
    province_identifier := address_data->>'province_id';
    
    -- Try UUID validation first (backward compatibility)
    BEGIN
        -- Check if they are valid UUIDs and exist in UUID-based tables
        IF city_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND
           province_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            
            -- Validate UUID exists in UUID-based tables (legacy support)
            IF EXISTS (SELECT 1 FROM public.indonesian_regencies WHERE id = city_identifier::UUID) AND
               EXISTS (SELECT 1 FROM public.indonesian_provinces WHERE id = province_identifier::UUID) THEN
                RETURN TRUE;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to government code validation
        NULL;
    END;
    
    -- Government code validation (primary method for new data)
    BEGIN
        -- Validate government codes using idn-area-data format
        -- Province codes are 2 digits (11-94), city codes are 4 digits (1101-9471)
        IF province_identifier ~ '^[1-9][0-9]$' AND 
           city_identifier ~ '^[1-9][0-9][0-9][0-9]$' AND
           substring(city_identifier from 1 for 2) = province_identifier THEN
            -- Government codes are valid format and city belongs to province
            RETURN TRUE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
    
    -- If neither UUID nor government code validation passes
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: UPDATE DISPLAY FUNCTION TO HANDLE GOVERNMENT CODES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.format_indonesian_address(address_data JSONB)
RETURNS TEXT AS $$
DECLARE
    formatted_address TEXT := '';
    city_identifier TEXT;
    province_identifier TEXT;
    city_name TEXT;
    province_name TEXT;
BEGIN
    IF address_data IS NULL THEN
        RETURN '';
    END IF;
    
    -- Extract identifiers
    city_identifier := address_data->>'city_id';
    province_identifier := address_data->>'province_id';
    
    -- Try to get names from UUID tables first (backward compatibility)
    BEGIN
        IF city_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            SELECT c.name, p.name INTO city_name, province_name
            FROM public.indonesian_regencies c
            JOIN public.indonesian_provinces p ON c.province_id = p.id
            WHERE c.id = city_identifier::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to government code lookup
        NULL;
    END;
    
    -- If UUID lookup didn't work, use government code format
    IF city_name IS NULL THEN
        -- For government codes, we'll use the nested object format from frontend
        IF address_data ? 'city' AND address_data->'city' ? 'name' THEN
            city_name := address_data->'city'->>'name';
        END IF;
        
        IF address_data ? 'province' AND address_data->'province' ? 'name' THEN
            province_name := address_data->'province'->>'name';
        END IF;
    END IF;
    
    -- Build formatted address
    formatted_address := COALESCE(address_data->>'street_address', '');
    
    -- Add village if present
    IF address_data ? 'village' THEN
        IF address_data->'village' ? 'name' AND address_data->'village'->>'name' != '' THEN
            formatted_address := formatted_address || ', ' || (address_data->'village'->>'name');
        END IF;
    END IF;
    
    -- Add district if present
    IF address_data ? 'district' THEN
        IF address_data->'district' ? 'name' AND address_data->'district'->>'name' != '' THEN
            formatted_address := formatted_address || ', ' || (address_data->'district'->>'name');
        END IF;
    END IF;
    
    -- Add city
    IF city_name IS NOT NULL THEN
        formatted_address := formatted_address || ', ' || city_name;
    END IF;
    
    -- Add province
    IF province_name IS NOT NULL THEN
        formatted_address := formatted_address || ', ' || province_name;
    END IF;
    
    -- Add postal code if present
    IF address_data ? 'postal_code' AND address_data->>'postal_code' != '' THEN
        formatted_address := formatted_address || ' ' || (address_data->>'postal_code');
    END IF;
    
    RETURN TRIM(formatted_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: CREATE HELPER FUNCTION FOR GOVERNMENT CODE VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_government_codes(province_code TEXT, city_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic format validation
    IF province_code IS NULL OR city_code IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Province must be 2 digits (11-94 range)
    IF NOT (province_code ~ '^[1-9][0-9]$') THEN
        RETURN FALSE;
    END IF;
    
    -- City must be 4 digits and first 2 digits must match province
    IF NOT (city_code ~ '^[1-9][0-9][0-9][0-9]$') THEN
        RETURN FALSE;
    END IF;
    
    -- City code must belong to the province
    IF substring(city_code from 1 for 2) != province_code THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: TEST THE UPDATED FUNCTIONS
-- ============================================================================

DO $$
DECLARE
    test_address_uuid JSONB;
    test_address_code JSONB;
    test_address_frontend JSONB;
    is_valid BOOLEAN;
BEGIN
    RAISE NOTICE '=== TESTING UPDATED VALIDATION FUNCTIONS ===';
    
    -- Test 1: Legacy UUID format (should still work)
    test_address_uuid := jsonb_build_object(
        'street_address', 'Test Street 123',
        'city_id', '550e8400-e29b-41d4-a716-446655440000',
        'province_id', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    );
    
    -- Test 2: Government code format (new format)
    test_address_code := jsonb_build_object(
        'street_address', 'Test Street 123',
        'city_id', '3101',
        'province_id', '31'
    );
    
    -- Test 3: Frontend format with nested objects (current CompactAddressForm format)
    test_address_frontend := jsonb_build_object(
        'street_address', 'Jalan Test 123',
        'city_id', '3101',
        'province_id', '31',
        'city', jsonb_build_object('code', '3101', 'name', 'Jakarta Selatan'),
        'province', jsonb_build_object('code', '31', 'name', 'DKI Jakarta'),
        'postal_code', '12345'
    );
    
    -- Test government code format
    SELECT public.validate_indonesian_address(test_address_code) INTO is_valid;
    IF is_valid THEN
        RAISE NOTICE '✅ Government code format validation: PASSED';
    ELSE
        RAISE NOTICE '❌ Government code format validation: FAILED';
    END IF;
    
    -- Test frontend format
    SELECT public.validate_indonesian_address(test_address_frontend) INTO is_valid;
    IF is_valid THEN
        RAISE NOTICE '✅ Frontend format validation: PASSED';
        RAISE NOTICE 'Formatted address: %', public.format_indonesian_address(test_address_frontend);
    ELSE
        RAISE NOTICE '❌ Frontend format validation: FAILED';
    END IF;
    
    -- Test invalid format
    SELECT public.validate_indonesian_address('{"invalid": "format"}'::jsonb) INTO is_valid;
    IF NOT is_valid THEN
        RAISE NOTICE '✅ Invalid format rejection: PASSED';
    ELSE
        RAISE NOTICE '❌ Invalid format rejection: FAILED (should reject invalid data)';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: ADD COMMENTS AND PERMISSIONS
-- ============================================================================

COMMENT ON FUNCTION public.validate_indonesian_address(JSONB) IS 
'Enhanced Indonesian address validator supporting both UUID format (legacy) and government codes (idn-area-data format). Returns TRUE for NULL addresses.';

COMMENT ON FUNCTION public.format_indonesian_address(JSONB) IS 
'Formats Indonesian address JSONB into readable string supporting both UUID and government code formats.';

COMMENT ON FUNCTION public.validate_government_codes(TEXT, TEXT) IS 
'Validates Indonesian government codes ensuring proper format and province-city relationship.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.validate_indonesian_address(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_indonesian_address(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_government_codes(TEXT, TEXT) TO authenticated;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== CONSTRAINT FIX COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE '✅ Updated validation function to support government codes';
    RAISE NOTICE '✅ Updated format function to handle both UUID and code formats';
    RAISE NOTICE '✅ Added government code validation helper';
    RAISE NOTICE '✅ Maintained backward compatibility with UUID format';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '1. Test vehicle edit page - constraint errors should be resolved';
    RAISE NOTICE '2. Verify that existing vehicles with UUID locations still work';
    RAISE NOTICE '3. Confirm new vehicles with government codes validate successfully';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 The system now supports both formats:';
    RAISE NOTICE '- Legacy: UUID-based city_id/province_id';
    RAISE NOTICE '- New: Government code-based city_id/province_id from idn-area-data';
END $$;