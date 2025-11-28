-- ============================================================================
-- FIX MISSING RPC FUNCTIONS
-- ============================================================================
-- This script creates the missing get_default_indonesian_address RPC function
-- that is being called from the frontend but returning 404 errors.

-- ============================================================================
-- STEP 1: VALIDATE REQUIREMENTS
-- ============================================================================

-- Check if Indonesian system tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indonesian_provinces') THEN
        RAISE EXCEPTION 'indonesian_provinces table does not exist. Please run 16-indonesian-address-system.sql first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indonesian_regencies') THEN
        RAISE EXCEPTION 'indonesian_regencies table does not exist. Please run 16-indonesian-address-system.sql first.';
    END IF;
    
    RAISE NOTICE 'Indonesian system tables found, proceeding with function creation...';
END $$;

-- ============================================================================
-- STEP 2: CREATE MISSING VALIDATION FUNCTION
-- ============================================================================

-- Create Indonesian address validation function (if not exists)
CREATE OR REPLACE FUNCTION public.validate_indonesian_address(address_data JSONB)
RETURNS BOOLEAN AS $$
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
  
  -- Validate city and province IDs exist and are valid UUIDs
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.indonesian_regencies 
      WHERE id = (address_data->>'city_id')::UUID
    ) THEN
      RETURN FALSE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM public.indonesian_provinces 
      WHERE id = (address_data->>'province_id')::UUID
    ) THEN
      RETURN FALSE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Invalid UUID format
    RETURN FALSE;
  END;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: CREATE THE MISSING get_default_indonesian_address FUNCTION
-- ============================================================================

-- Function to get default Indonesian address for fallback
CREATE OR REPLACE FUNCTION public.get_default_indonesian_address()
RETURNS JSONB AS $$
DECLARE
    default_city_id UUID;
    default_province_id UUID;
BEGIN
    -- Try to get Jakarta as default
    SELECT c.id, c.province_id INTO default_city_id, default_province_id
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id  
    WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
    LIMIT 1;
    
    -- If Jakarta not found, get any major city
    IF default_city_id IS NULL THEN
        SELECT c.id, c.province_id INTO default_city_id, default_province_id
        FROM public.indonesian_regencies c
        JOIN public.indonesian_provinces p ON c.province_id = p.id
        WHERE c.is_major_city = true
        ORDER BY c.population DESC NULLS LAST
        LIMIT 1;
    END IF;
    
    -- If still not found, get any city
    IF default_city_id IS NULL THEN
        SELECT c.id, c.province_id INTO default_city_id, default_province_id
        FROM public.indonesian_regencies c
        JOIN public.indonesian_provinces p ON c.province_id = p.id
        LIMIT 1;
    END IF;
    
    -- If no cities exist, return error
    IF default_city_id IS NULL THEN
        RAISE EXCEPTION 'No Indonesian cities found in database. Please run the data seeding scripts.';
    END IF;
    
    RETURN jsonb_build_object(
        'street_address', 'Default address - please update with correct information',
        'village', '',
        'district', '',
        'city_id', default_city_id,
        'province_id', default_province_id,
        'postal_code', '',
        'additional_info', 'This is a default address for system initialization',
        'latitude', null,
        'longitude', null
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_default_indonesian_address() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_indonesian_address(JSONB) TO authenticated;

-- ============================================================================
-- STEP 5: TEST THE FUNCTION
-- ============================================================================

-- Test the function works
DO $$
DECLARE
    test_address JSONB;
    is_valid BOOLEAN;
BEGIN
    RAISE NOTICE '=== TESTING get_default_indonesian_address FUNCTION ===';
    
    -- Test getting default address
    SELECT public.get_default_indonesian_address() INTO test_address;
    RAISE NOTICE 'Default address created: %', jsonb_pretty(test_address);
    
    -- Test validation
    SELECT public.validate_indonesian_address(test_address) INTO is_valid;
    
    IF is_valid THEN
        RAISE NOTICE 'SUCCESS: Default address passes validation!';
    ELSE
        RAISE EXCEPTION 'FAILED: Default address does not pass validation!';
    END IF;
    
    RAISE NOTICE 'Function test completed successfully!';
END $$;

-- ============================================================================
-- STEP 6: VERIFICATION QUERY
-- ============================================================================

-- Show available data for verification
SELECT 
    'System Status' as type,
    (SELECT COUNT(*) FROM public.indonesian_provinces) as provinces_count,
    (SELECT COUNT(*) FROM public.indonesian_regencies) as cities_count,
    (SELECT COUNT(*) FROM public.indonesian_regencies WHERE is_major_city = true) as major_cities_count;

-- Show Jakarta data if it exists
SELECT 
    'Jakarta Data' as type,
    c.id as city_id,
    c.name as city_name,
    p.id as province_id,
    p.name as province_name
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
LIMIT 1;

-- Show fallback major city if Jakarta doesn't exist  
SELECT 
    'Fallback Major City' as type,
    c.id as city_id,
    c.name as city_name,
    p.id as province_id,
    p.name as province_name,
    c.population
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
WHERE c.is_major_city = true
ORDER BY c.population DESC NULLS LAST
LIMIT 1;

-- Final verification that the function works
SELECT 'Function Test' as type, public.get_default_indonesian_address() as default_address;

COMMENT ON FUNCTION public.get_default_indonesian_address() IS 
'Returns a default Indonesian address (Jakarta preferred, fallback to major city) for system initialization and fallback purposes. Used by frontend when users need a default location.';

COMMENT ON FUNCTION public.validate_indonesian_address(JSONB) IS 
'Validates that a JSONB address object conforms to Indonesian address standards with valid city_id and province_id references. Returns TRUE for NULL addresses.';

-- Completion message
DO $$
BEGIN
    RAISE NOTICE '=== RPC FUNCTION CREATION COMPLETED ===';
    RAISE NOTICE 'The get_default_indonesian_address() function is now available for RPC calls.';
    RAISE NOTICE 'Frontend 404 errors should be resolved after running this script.';
END $$;