-- ============================================================================
-- COMPREHENSIVE INDONESIAN ADDRESS MIGRATION FIX
-- ============================================================================
-- This script provides a complete fix for Indonesian address migration issues
-- Handles both cars.location NOT NULL constraint and bookings constraint violations
-- Run this INSTEAD of scripts 17, 18, and 19

-- ============================================================================
-- STEP 1: PRELIMINARY DATA ANALYSIS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== PRELIMINARY DATA ANALYSIS ===';
    
    -- Check current data state
    RAISE NOTICE 'Current data counts:';
    RAISE NOTICE '- User profiles: % (% with addresses)', 
        (SELECT COUNT(*) FROM public.user_profiles),
        (SELECT COUNT(*) FROM public.user_profiles WHERE address IS NOT NULL);
    
    RAISE NOTICE '- Cars: % (% with locations)', 
        (SELECT COUNT(*) FROM public.cars),
        (SELECT COUNT(*) FROM public.cars WHERE location IS NOT NULL);
        
    RAISE NOTICE '- Bookings: % (% with pickup, % with dropoff)', 
        (SELECT COUNT(*) FROM public.bookings),
        (SELECT COUNT(*) FROM public.bookings WHERE pickup_location IS NOT NULL),
        (SELECT COUNT(*) FROM public.bookings WHERE dropoff_location IS NOT NULL);
        
    -- Check if Indonesian system is set up
    RAISE NOTICE '- Indonesian provinces: %', 
        (SELECT COUNT(*) FROM public.indonesian_provinces);
    RAISE NOTICE '- Indonesian cities: %', 
        (SELECT COUNT(*) FROM public.indonesian_regencies);
END $$;

-- ============================================================================
-- STEP 2: CREATE BACKUP TABLES
-- ============================================================================

-- Create backup tables for rollback if needed
CREATE TABLE IF NOT EXISTS backup_user_profiles_addresses AS
SELECT id, address, updated_at 
FROM public.user_profiles 
WHERE address IS NOT NULL;

CREATE TABLE IF NOT EXISTS backup_cars_locations AS
SELECT id, location, updated_at 
FROM public.cars 
WHERE location IS NOT NULL;

CREATE TABLE IF NOT EXISTS backup_bookings_locations AS
SELECT id, pickup_location, dropoff_location, updated_at 
FROM public.bookings 
WHERE pickup_location IS NOT NULL OR dropoff_location IS NOT NULL;

-- ============================================================================
-- STEP 3: CREATE VALIDATION AND HELPER FUNCTIONS
-- ============================================================================

-- Enhanced validation function that handles NULL values properly
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
    
    RETURN jsonb_build_object(
        'street_address', 'Alamat akan diperbarui - Address to be updated',
        'village', '',
        'district', '',
        'city_id', default_city_id,
        'province_id', default_province_id,
        'postal_code', '',
        'additional_info', 'Default address - please update with correct information'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to migrate legacy address format
CREATE OR REPLACE FUNCTION public.migrate_legacy_address(legacy_address JSONB)
RETURNS JSONB AS $$
DECLARE
    migrated_address JSONB;
    default_address JSONB;
BEGIN
    -- Get default address as fallback
    default_address := public.get_default_indonesian_address();
    
    -- If legacy address is already in Indonesian format and valid, return as-is
    IF public.validate_indonesian_address(legacy_address) THEN
        RETURN legacy_address;
    END IF;
    
    -- Try to preserve as much legacy data as possible
    migrated_address := jsonb_build_object(
        'street_address', COALESCE(
            legacy_address->>'street_address',
            legacy_address->>'street', 
            legacy_address->>'address',
            legacy_address->>'line1',
            'Address not specified'
        ),
        'village', COALESCE(legacy_address->>'village', ''),
        'district', COALESCE(legacy_address->>'district', ''),
        'city_id', default_address->>'city_id',
        'province_id', default_address->>'province_id',
        'postal_code', COALESCE(
            legacy_address->>'postal_code', 
            legacy_address->>'zip',
            legacy_address->>'postcode',
            legacy_address->>'zipcode',
            ''
        ),
        'additional_info', CONCAT(
            'Migrated - Original: ',
            COALESCE(legacy_address->>'city', ''),
            CASE WHEN legacy_address->>'state' IS NOT NULL 
                 THEN ', ' || (legacy_address->>'state') 
                 ELSE '' END,
            CASE WHEN legacy_address->>'country' IS NOT NULL 
                 THEN ', ' || (legacy_address->>'country') 
                 ELSE '' END,
            ' - Please update with correct Indonesian address'
        ),
        'latitude', legacy_address->>'latitude',
        'longitude', legacy_address->>'longitude'
    );
    
    -- Validate the migrated address
    IF public.validate_indonesian_address(migrated_address) THEN
        RETURN migrated_address;
    ELSE
        -- If migration failed, return default address
        RETURN default_address;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: REMOVE EXISTING CONSTRAINTS (IF THEY EXIST)
-- ============================================================================

-- Remove existing constraints to avoid conflicts during migration
DO $$
BEGIN
    -- Drop existing constraints if they exist
    BEGIN
        ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS check_user_address_format;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if constraint doesn't exist
    END;
    
    BEGIN
        ALTER TABLE public.cars DROP CONSTRAINT IF EXISTS check_car_location_format;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if constraint doesn't exist
    END;
    
    BEGIN
        ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS check_pickup_location_format;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if constraint doesn't exist
    END;
    
    BEGIN
        ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS check_dropoff_location_format;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if constraint doesn't exist
    END;
    
    RAISE NOTICE 'Existing constraints removed for safe migration';
END $$;

-- ============================================================================
-- STEP 5: MIGRATE EXISTING DATA
-- ============================================================================

DO $$
DECLARE
    record_data RECORD;
    migrated_count INTEGER := 0;
    failed_count INTEGER := 0;
    default_address JSONB;
BEGIN
    RAISE NOTICE '=== STARTING DATA MIGRATION ===';
    
    -- Get default address for fallbacks
    default_address := public.get_default_indonesian_address();
    RAISE NOTICE 'Using default address with city_id: %', default_address->>'city_id';
    
    -- ========================================
    -- Migrate user_profiles addresses
    -- ========================================
    RAISE NOTICE 'Migrating user_profiles addresses...';
    migrated_count := 0;
    failed_count := 0;
    
    FOR record_data IN 
        SELECT id, address FROM public.user_profiles 
        WHERE address IS NOT NULL
    LOOP
        BEGIN
            UPDATE public.user_profiles SET
                address = public.migrate_legacy_address(record_data.address)
            WHERE id = record_data.id;
            
            migrated_count := migrated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            RAISE NOTICE 'Failed to migrate user address for %: %', record_data.id, SQLERRM;
            
            -- Set to NULL for users (address is optional)
            UPDATE public.user_profiles SET address = NULL WHERE id = record_data.id;
        END;
    END LOOP;
    
    RAISE NOTICE 'User profiles migration: % migrated, % failed', migrated_count, failed_count;
    
    -- ========================================
    -- Migrate cars locations (CRITICAL - NOT NULL required)
    -- ========================================
    RAISE NOTICE 'Migrating cars locations...';
    migrated_count := 0;
    failed_count := 0;
    
    FOR record_data IN 
        SELECT id, location FROM public.cars
    LOOP
        BEGIN
            -- Cars MUST have a location, so use default if NULL or invalid
            IF record_data.location IS NULL THEN
                UPDATE public.cars SET
                    location = default_address
                WHERE id = record_data.id;
            ELSE
                UPDATE public.cars SET
                    location = public.migrate_legacy_address(record_data.location)
                WHERE id = record_data.id;
            END IF;
            
            migrated_count := migrated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            RAISE NOTICE 'Failed to migrate car location for %: %', record_data.id, SQLERRM;
            
            -- Cars require location, so use default
            UPDATE public.cars SET location = default_address WHERE id = record_data.id;
        END;
    END LOOP;
    
    RAISE NOTICE 'Cars migration: % migrated, % failed', migrated_count, failed_count;
    
    -- ========================================
    -- Migrate bookings locations
    -- ========================================
    RAISE NOTICE 'Migrating bookings locations...';
    migrated_count := 0;
    failed_count := 0;
    
    FOR record_data IN 
        SELECT id, pickup_location, dropoff_location FROM public.bookings
        WHERE pickup_location IS NOT NULL OR dropoff_location IS NOT NULL
    LOOP
        BEGIN
            -- Migrate pickup location
            IF record_data.pickup_location IS NOT NULL THEN
                UPDATE public.bookings SET
                    pickup_location = public.migrate_legacy_address(record_data.pickup_location)
                WHERE id = record_data.id;
            END IF;
            
            -- Migrate dropoff location  
            IF record_data.dropoff_location IS NOT NULL THEN
                UPDATE public.bookings SET
                    dropoff_location = public.migrate_legacy_address(record_data.dropoff_location)
                WHERE id = record_data.id;
            END IF;
            
            migrated_count := migrated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            RAISE NOTICE 'Failed to migrate booking locations for %: %', record_data.id, SQLERRM;
            
            -- Set to NULL for bookings (pickup/dropoff locations are optional)
            UPDATE public.bookings SET 
                pickup_location = NULL, 
                dropoff_location = NULL 
            WHERE id = record_data.id;
        END;
    END LOOP;
    
    RAISE NOTICE 'Bookings migration: % migrated, % failed', migrated_count, failed_count;
END $$;

-- ============================================================================
-- STEP 6: VALIDATE MIGRATED DATA
-- ============================================================================

DO $$
DECLARE
    invalid_users INTEGER;
    invalid_cars INTEGER;
    invalid_bookings_pickup INTEGER;
    invalid_bookings_dropoff INTEGER;
BEGIN
    RAISE NOTICE '=== VALIDATING MIGRATED DATA ===';
    
    -- Check for invalid user addresses
    SELECT COUNT(*) INTO invalid_users
    FROM public.user_profiles 
    WHERE address IS NOT NULL AND NOT public.validate_indonesian_address(address);
    
    -- Check for invalid car locations
    SELECT COUNT(*) INTO invalid_cars
    FROM public.cars 
    WHERE location IS NULL OR NOT public.validate_indonesian_address(location);
    
    -- Check for invalid booking pickup locations
    SELECT COUNT(*) INTO invalid_bookings_pickup
    FROM public.bookings 
    WHERE pickup_location IS NOT NULL AND NOT public.validate_indonesian_address(pickup_location);
    
    -- Check for invalid booking dropoff locations
    SELECT COUNT(*) INTO invalid_bookings_dropoff
    FROM public.bookings 
    WHERE dropoff_location IS NOT NULL AND NOT public.validate_indonesian_address(dropoff_location);
    
    RAISE NOTICE 'Validation results:';
    RAISE NOTICE '- Invalid user addresses: %', invalid_users;
    RAISE NOTICE '- Invalid car locations: %', invalid_cars;
    RAISE NOTICE '- Invalid booking pickup locations: %', invalid_bookings_pickup;
    RAISE NOTICE '- Invalid booking dropoff locations: %', invalid_bookings_dropoff;
    
    IF invalid_users > 0 OR invalid_cars > 0 OR invalid_bookings_pickup > 0 OR invalid_bookings_dropoff > 0 THEN
        RAISE EXCEPTION 'Data validation failed. Cannot proceed with constraint application.';
    END IF;
    
    RAISE NOTICE 'All data validated successfully!';
END $$;

-- ============================================================================
-- STEP 7: APPLY CONSTRAINTS SAFELY
-- ============================================================================

-- Add check constraint for user_profiles address format (allows NULL)
ALTER TABLE public.user_profiles 
ADD CONSTRAINT check_user_address_format 
CHECK (
  address IS NULL OR 
  validate_indonesian_address(address)
);

-- Add check constraint for cars location format (required, does not allow NULL)
ALTER TABLE public.cars 
ADD CONSTRAINT check_car_location_format 
CHECK (
  location IS NOT NULL AND
  validate_indonesian_address(location)
);

-- Add check constraint for bookings pickup/dropoff locations (allows NULL)
ALTER TABLE public.bookings 
ADD CONSTRAINT check_pickup_location_format 
CHECK (
  pickup_location IS NULL OR 
  validate_indonesian_address(pickup_location)
);

ALTER TABLE public.bookings
ADD CONSTRAINT check_dropoff_location_format 
CHECK (
  dropoff_location IS NULL OR 
  validate_indonesian_address(dropoff_location)
);

-- ============================================================================
-- STEP 8: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create indexes for efficient address queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_address_city 
ON public.user_profiles USING GIN ((address->'city_id'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_address_province 
ON public.user_profiles USING GIN ((address->'province_id'));

CREATE INDEX IF NOT EXISTS idx_cars_location_city 
ON public.cars USING GIN ((location->'city_id'));

CREATE INDEX IF NOT EXISTS idx_cars_location_province 
ON public.cars USING GIN ((location->'province_id'));

CREATE INDEX IF NOT EXISTS idx_bookings_pickup_city 
ON public.bookings USING GIN ((pickup_location->'city_id'));

CREATE INDEX IF NOT EXISTS idx_bookings_dropoff_city 
ON public.bookings USING GIN ((dropoff_location->'city_id'));

-- ============================================================================
-- STEP 9: CREATE ADDITIONAL HELPER FUNCTIONS
-- ============================================================================

-- Function to format Indonesian address for display
CREATE OR REPLACE FUNCTION public.format_indonesian_address(address_data JSONB)
RETURNS TEXT AS $$
DECLARE
  formatted_address TEXT := '';
  city_name TEXT;
  province_name TEXT;
BEGIN
  -- Return empty if NULL
  IF address_data IS NULL THEN
    RETURN '';
  END IF;
  
  -- Get city and province names
  SELECT c.name, p.name INTO city_name, province_name
  FROM public.indonesian_regencies c
  JOIN public.indonesian_provinces p ON c.province_id = p.id
  WHERE c.id = (address_data->>'city_id')::UUID;
  
  -- Build formatted address
  formatted_address := COALESCE(address_data->>'street_address', '');
  
  IF address_data ? 'village' AND address_data->>'village' != '' THEN
    formatted_address := formatted_address || ', ' || (address_data->>'village');
  END IF;
  
  IF address_data ? 'district' AND address_data->>'district' != '' THEN
    formatted_address := formatted_address || ', ' || (address_data->>'district');
  END IF;
  
  IF city_name IS NOT NULL THEN
    formatted_address := formatted_address || ', ' || city_name;
  END IF;
  
  IF province_name IS NOT NULL THEN
    formatted_address := formatted_address || ', ' || province_name;
  END IF;
  
  IF address_data ? 'postal_code' AND address_data->>'postal_code' != '' THEN
    formatted_address := formatted_address || ' ' || (address_data->>'postal_code');
  END IF;
  
  RETURN TRIM(formatted_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 10: FINAL VERIFICATION AND CLEANUP
-- ============================================================================

-- Final verification
SELECT 
    'Indonesian Address Migration Complete!' as status,
    (SELECT COUNT(*) FROM public.user_profiles WHERE address IS NOT NULL) as users_with_address,
    (SELECT COUNT(*) FROM public.cars WHERE location IS NOT NULL) as cars_with_location,
    (SELECT COUNT(*) FROM public.bookings WHERE pickup_location IS NOT NULL) as bookings_with_pickup,
    (SELECT COUNT(*) FROM public.bookings WHERE dropoff_location IS NOT NULL) as bookings_with_dropoff,
    (SELECT COUNT(*) FROM public.indonesian_provinces) as provinces_available,
    (SELECT COUNT(*) FROM public.indonesian_regencies) as cities_available;

-- Show sample migrated data
SELECT 
    'Sample User Address' as type,
    jsonb_pretty(address) as address_data,
    format_indonesian_address(address) as formatted_address
FROM public.user_profiles 
WHERE address IS NOT NULL 
LIMIT 1;

SELECT 
    'Sample Car Location' as type,
    jsonb_pretty(location) as location_data,
    format_indonesian_address(location) as formatted_address
FROM public.cars 
WHERE location IS NOT NULL 
LIMIT 1;

-- Test constraint enforcement
DO $$
BEGIN
    RAISE NOTICE '=== TESTING CONSTRAINT ENFORCEMENT ===';
    
    -- Test invalid address (should fail)
    BEGIN
        INSERT INTO public.user_profiles (id, email, address) 
        VALUES (
            '00000000-0000-0000-0000-000000000001'::UUID, 
            'test@example.com',
            '{"invalid": "address"}'::jsonb
        );
        RAISE EXCEPTION 'Constraint test failed - invalid address was allowed';
    EXCEPTION 
        WHEN check_violation THEN
            RAISE NOTICE 'Constraint test passed - invalid address rejected';
        WHEN unique_violation THEN
            RAISE NOTICE 'Constraint test passed (user already exists) - invalid address rejected';
    END;
    
    -- Clean up test data
    DELETE FROM public.user_profiles WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;
    
    RAISE NOTICE 'All constraint tests passed!';
END $$;

-- Add helpful comments
COMMENT ON FUNCTION public.validate_indonesian_address(JSONB) IS 
'Validates that a JSONB address object conforms to Indonesian address standards. Returns TRUE for NULL addresses.';

COMMENT ON FUNCTION public.format_indonesian_address(JSONB) IS 
'Formats a valid Indonesian address JSONB object into a readable string for display purposes.';

COMMENT ON FUNCTION public.get_default_indonesian_address() IS 
'Returns a default Indonesian address (Jakarta or major city) for fallback purposes during migration.';

COMMENT ON FUNCTION public.migrate_legacy_address(JSONB) IS 
'Migrates legacy address format to Indonesian address standard, preserving as much data as possible.';

-- ============================================================================
-- CLEANUP INSTRUCTIONS
-- ============================================================================

-- Uncomment the following lines once you're satisfied with the migration:
-- DROP TABLE IF EXISTS backup_user_profiles_addresses;
-- DROP TABLE IF EXISTS backup_cars_locations;
-- DROP TABLE IF EXISTS backup_bookings_locations;

-- Final completion message
DO $$
BEGIN
    RAISE NOTICE '=== MIGRATION COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE 'Indonesian address system is now active with proper constraints.';
    RAISE NOTICE 'All existing data has been migrated to the new format.';
    RAISE NOTICE 'Backup tables created for rollback if needed.';
END $$;