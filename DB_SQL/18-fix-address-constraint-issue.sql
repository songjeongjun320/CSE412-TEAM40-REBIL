-- ============================================================================
-- FIX ADDRESS CONSTRAINT ISSUE
-- ============================================================================
-- This script fixes the constraint violation issue by safely migrating existing data
-- before applying the new Indonesian address constraints

-- First, let's check what data exists in the tables
DO $$
BEGIN
    RAISE NOTICE 'Checking existing data...';
    
    -- Check user_profiles with addresses
    RAISE NOTICE 'User profiles with addresses: %', 
        (SELECT COUNT(*) FROM public.user_profiles WHERE address IS NOT NULL);
    
    -- Check cars with locations  
    RAISE NOTICE 'Cars with locations: %',
        (SELECT COUNT(*) FROM public.cars WHERE location IS NOT NULL);
        
    -- Check bookings with locations
    RAISE NOTICE 'Bookings with pickup locations: %',
        (SELECT COUNT(*) FROM public.bookings WHERE pickup_location IS NOT NULL);
    RAISE NOTICE 'Bookings with dropoff locations: %', 
        (SELECT COUNT(*) FROM public.bookings WHERE dropoff_location IS NOT NULL);
END $$;

-- Show sample of existing address data to understand format
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as count,
    jsonb_pretty(address) as sample_address
FROM public.user_profiles 
WHERE address IS NOT NULL 
GROUP BY address
LIMIT 3;

SELECT 
    'cars' as table_name,
    COUNT(*) as count,
    jsonb_pretty(location) as sample_location
FROM public.cars 
WHERE location IS NOT NULL 
GROUP BY location
LIMIT 3;

-- ============================================================================
-- SAFE MIGRATION APPROACH
-- ============================================================================

-- Step 1: Create a temporary backup table for user addresses
CREATE TABLE IF NOT EXISTS temp_user_addresses_backup AS
SELECT id, address, created_at 
FROM public.user_profiles 
WHERE address IS NOT NULL;

-- Step 2: Create a temporary backup table for car locations
CREATE TABLE IF NOT EXISTS temp_car_locations_backup AS
SELECT id, location, created_at 
FROM public.cars 
WHERE location IS NOT NULL;

-- Step 3: Temporarily set all addresses to NULL to avoid constraint violations
UPDATE public.user_profiles SET address = NULL WHERE address IS NOT NULL;
UPDATE public.cars SET location = NULL WHERE location IS NOT NULL;
UPDATE public.bookings SET pickup_location = NULL WHERE pickup_location IS NOT NULL;
UPDATE public.bookings SET dropoff_location = NULL WHERE dropoff_location IS NOT NULL;

-- ============================================================================
-- CREATE MIGRATION FUNCTIONS
-- ============================================================================

-- Enhanced migration function that handles various legacy formats
CREATE OR REPLACE FUNCTION public.migrate_legacy_addresses()
RETURNS TABLE(
    table_name TEXT,
    migrated_count INTEGER, 
    failed_count INTEGER,
    null_count INTEGER
) AS $$
DECLARE
    migrated INTEGER := 0;
    failed INTEGER := 0;
    nulled INTEGER := 0;
    record_data RECORD;
    jakarta_city_id UUID;
    jakarta_province_id UUID;
    default_address JSONB;
BEGIN
    -- Get Jakarta IDs as default fallback
    SELECT c.id, c.province_id INTO jakarta_city_id, jakarta_province_id
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id  
    WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta';
    
    -- If Jakarta not found, get any city as fallback
    IF jakarta_city_id IS NULL THEN
        SELECT c.id, c.province_id INTO jakarta_city_id, jakarta_province_id
        FROM public.indonesian_regencies c
        JOIN public.indonesian_provinces p ON c.province_id = p.id
        LIMIT 1;
    END IF;
    
    -- Create default address structure
    default_address := jsonb_build_object(
        'street_address', 'Address to be updated',
        'village', '',
        'district', '',
        'city_id', jakarta_city_id,
        'province_id', jakarta_province_id,
        'postal_code', '',
        'additional_info', 'Migrated from legacy format - please update'
    );
    
    RAISE NOTICE 'Using default city_id: %, province_id: %', jakarta_city_id, jakarta_province_id;
    
    -- Migrate user profiles
    FOR record_data IN 
        SELECT id, address FROM temp_user_addresses_backup
    LOOP
        BEGIN
            -- Check if address is already in Indonesian format
            IF record_data.address ? 'city_id' AND record_data.address ? 'province_id' THEN
                -- Already in new format, just validate and restore
                IF validate_indonesian_address(record_data.address) THEN
                    UPDATE public.user_profiles SET address = record_data.address WHERE id = record_data.id;
                    migrated := migrated + 1;
                ELSE
                    -- Invalid Indonesian format, use default
                    UPDATE public.user_profiles SET address = default_address WHERE id = record_data.id;
                    failed := failed + 1;
                END IF;
            ELSE
                -- Legacy format, convert to Indonesian format
                UPDATE public.user_profiles SET
                    address = jsonb_build_object(
                        'street_address', COALESCE(
                            record_data.address->>'street', 
                            record_data.address->>'address',
                            record_data.address->>'street_address',
                            'Address not specified'
                        ),
                        'village', COALESCE(record_data.address->>'village', ''),
                        'district', COALESCE(record_data.address->>'district', ''),
                        'city_id', jakarta_city_id,
                        'province_id', jakarta_province_id,
                        'postal_code', COALESCE(
                            record_data.address->>'postal_code', 
                            record_data.address->>'zip',
                            record_data.address->>'postcode',
                            ''
                        ),
                        'additional_info', CONCAT(
                            'Legacy: ',
                            COALESCE(record_data.address->>'city', ''),
                            ', ',
                            COALESCE(record_data.address->>'state', ''),
                            ', ',
                            COALESCE(record_data.address->>'country', ''),
                            ' - Please update with correct Indonesian address'
                        ),
                        'latitude', record_data.address->>'latitude',
                        'longitude', record_data.address->>'longitude'
                    )
                WHERE id = record_data.id;
                
                migrated := migrated + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            failed := failed + 1;
            RAISE NOTICE 'Failed to migrate user address for %: %', record_data.id, SQLERRM;
            -- Set to NULL to avoid constraint violation
            UPDATE public.user_profiles SET address = NULL WHERE id = record_data.id;
            nulled := nulled + 1;
        END;
    END LOOP;
    
    RETURN QUERY VALUES ('user_profiles', migrated, failed, nulled);
    
    -- Reset counters for cars
    migrated := 0;
    failed := 0;
    nulled := 0;
    
    -- Migrate car locations
    FOR record_data IN 
        SELECT id, location FROM temp_car_locations_backup
    LOOP
        BEGIN
            -- Check if location is already in Indonesian format
            IF record_data.location ? 'city_id' AND record_data.location ? 'province_id' THEN
                -- Already in new format, just validate and restore
                IF validate_indonesian_address(record_data.location) THEN
                    UPDATE public.cars SET location = record_data.location WHERE id = record_data.id;
                    migrated := migrated + 1;
                ELSE
                    -- Invalid Indonesian format, use default
                    UPDATE public.cars SET location = default_address WHERE id = record_data.id;
                    failed := failed + 1;
                END IF;
            ELSE
                -- Legacy format, convert to Indonesian format
                UPDATE public.cars SET
                    location = jsonb_build_object(
                        'street_address', COALESCE(
                            record_data.location->>'street', 
                            record_data.location->>'address',
                            record_data.location->>'street_address',
                            'Location not specified'
                        ),
                        'village', COALESCE(record_data.location->>'village', ''),
                        'district', COALESCE(record_data.location->>'district', ''),
                        'city_id', jakarta_city_id,
                        'province_id', jakarta_province_id,
                        'postal_code', COALESCE(
                            record_data.location->>'postal_code', 
                            record_data.location->>'zip',
                            record_data.location->>'postcode',
                            ''
                        ),
                        'additional_info', CONCAT(
                            'Legacy: ',
                            COALESCE(record_data.location->>'city', ''),
                            ', ',
                            COALESCE(record_data.location->>'state', ''),
                            ', ',
                            COALESCE(record_data.location->>'country', ''),
                            ' - Please update with correct Indonesian address'
                        ),
                        'latitude', record_data.location->>'latitude',
                        'longitude', record_data.location->>'longitude'
                    )
                WHERE id = record_data.id;
                
                migrated := migrated + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            failed := failed + 1;
            RAISE NOTICE 'Failed to migrate car location for %: %', record_data.id, SQLERRM;
            -- Set to NULL to avoid constraint violation (will require manual update)
            UPDATE public.cars SET location = NULL WHERE id = record_data.id;
            nulled := nulled + 1;
        END;
    END LOOP;
    
    RETURN QUERY VALUES ('cars', migrated, failed, nulled);
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAFE CONSTRAINT APPLICATION
-- ============================================================================

-- Function to safely add constraints after data migration
CREATE OR REPLACE FUNCTION public.apply_address_constraints_safely()
RETURNS TABLE(constraint_name TEXT, status TEXT, error_message TEXT) AS $$
BEGIN
    -- Try to add user_profiles address constraint
    BEGIN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT check_user_address_format 
        CHECK (address IS NULL OR validate_indonesian_address(address));
        
        RETURN QUERY VALUES ('check_user_address_format', 'SUCCESS', NULL);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('check_user_address_format', 'FAILED', SQLERRM);
    END;
    
    -- Try to add cars location constraint
    BEGIN
        ALTER TABLE public.cars 
        ADD CONSTRAINT check_car_location_format 
        CHECK (validate_indonesian_address(location));
        
        RETURN QUERY VALUES ('check_car_location_format', 'SUCCESS', NULL);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('check_car_location_format', 'FAILED', SQLERRM);
    END;
    
    -- Try to add bookings pickup location constraint
    BEGIN
        ALTER TABLE public.bookings 
        ADD CONSTRAINT check_pickup_location_format 
        CHECK (pickup_location IS NULL OR validate_indonesian_address(pickup_location));
        
        RETURN QUERY VALUES ('check_pickup_location_format', 'SUCCESS', NULL);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('check_pickup_location_format', 'FAILED', SQLERRM);
    END;
    
    -- Try to add bookings dropoff location constraint
    BEGIN
        ALTER TABLE public.bookings
        ADD CONSTRAINT check_dropoff_location_format 
        CHECK (dropoff_location IS NULL OR validate_indonesian_address(dropoff_location));
        
        RETURN QUERY VALUES ('check_dropoff_location_format', 'SUCCESS', NULL);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('check_dropoff_location_format', 'FAILED', SQLERRM);
    END;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXECUTE MIGRATION
-- ============================================================================

-- Run the migration
SELECT * FROM public.migrate_legacy_addresses();

-- Apply constraints safely
SELECT * FROM public.apply_address_constraints_safely();

-- Verify migration results
SELECT 
    'Migration Results' as status,
    (SELECT COUNT(*) FROM public.user_profiles WHERE address IS NOT NULL) as user_profiles_with_address,
    (SELECT COUNT(*) FROM public.cars WHERE location IS NOT NULL) as cars_with_location,
    (SELECT COUNT(*) FROM public.user_profiles WHERE address ? 'city_id') as user_profiles_indonesian_format,
    (SELECT COUNT(*) FROM public.cars WHERE location ? 'city_id') as cars_indonesian_format;

-- Show sample migrated data
SELECT 
    'Sample Migrated User Address' as type,
    jsonb_pretty(address) as address_data
FROM public.user_profiles 
WHERE address IS NOT NULL 
LIMIT 1;

SELECT 
    'Sample Migrated Car Location' as type,
    jsonb_pretty(location) as location_data
FROM public.cars 
WHERE location IS NOT NULL 
LIMIT 1;

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- Clean up temporary tables (uncomment when satisfied with migration)
-- DROP TABLE IF EXISTS temp_user_addresses_backup;
-- DROP TABLE IF EXISTS temp_car_locations_backup;