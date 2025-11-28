-- ============================================================================
-- SAFE ADDRESS MIGRATION FOR INDONESIAN SYSTEM
-- ============================================================================
-- This script safely migrates existing address data before applying constraints
-- Execute this INSTEAD of 17-update-address-format-indonesian.sql

-- ============================================================================
-- CREATE ADDRESS VALIDATION FUNCTION
-- ============================================================================

-- Function to validate Indonesian address structure
CREATE OR REPLACE FUNCTION public.validate_indonesian_address(address_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Allow NULL addresses
  IF address_data IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check required fields exist
  IF NOT (
    address_data ? 'street_address' AND
    address_data ? 'city_id' AND  
    address_data ? 'province_id'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Validate city and province IDs exist
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
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to format Indonesian address for display
CREATE OR REPLACE FUNCTION public.format_indonesian_address(address_data JSONB)
RETURNS TEXT AS $$
DECLARE
  formatted_address TEXT := '';
  city_name TEXT;
  province_name TEXT;
BEGIN
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
  
  formatted_address := formatted_address || ', ' || city_name || ', ' || province_name;
  
  IF address_data ? 'postal_code' AND address_data->>'postal_code' != '' THEN
    formatted_address := formatted_address || ' ' || (address_data->>'postal_code');
  END IF;
  
  RETURN TRIM(formatted_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAFE DATA MIGRATION
-- ============================================================================

-- Migration function that handles legacy data gracefully
DO $$
DECLARE
    record_data RECORD;
    jakarta_city_id UUID;
    jakarta_province_id UUID;
    migrated_count INTEGER := 0;
    failed_count INTEGER := 0;
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
    
    RAISE NOTICE 'Using fallback city_id: %, province_id: %', jakarta_city_id, jakarta_province_id;
    
    -- Migrate user_profiles addresses
    FOR record_data IN 
        SELECT id, address FROM public.user_profiles 
        WHERE address IS NOT NULL
    LOOP
        BEGIN
            -- Check if address is already in Indonesian format
            IF record_data.address ? 'city_id' AND record_data.address ? 'province_id' THEN
                -- Already in new format, validate
                IF validate_indonesian_address(record_data.address) THEN
                    migrated_count := migrated_count + 1;
                    CONTINUE;
                ELSE
                    -- Invalid Indonesian format, convert to valid format
                    UPDATE public.user_profiles SET
                        address = jsonb_build_object(
                            'street_address', COALESCE(record_data.address->>'street_address', 'Address to be updated'),
                            'village', COALESCE(record_data.address->>'village', ''),
                            'district', COALESCE(record_data.address->>'district', ''),
                            'city_id', jakarta_city_id,
                            'province_id', jakarta_province_id,
                            'postal_code', COALESCE(record_data.address->>'postal_code', ''),
                            'additional_info', 'Migrated from invalid format - please update'
                        )
                    WHERE id = record_data.id;
                    migrated_count := migrated_count + 1;
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
                
                migrated_count := migrated_count + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            RAISE NOTICE 'Failed to migrate user address for %: %', record_data.id, SQLERRM;
            -- Set to NULL to avoid constraint violation
            UPDATE public.user_profiles SET address = NULL WHERE id = record_data.id;
        END;
    END LOOP;
    
    RAISE NOTICE 'Migration completed - Migrated: %, Failed: %', migrated_count, failed_count;
    
    -- Migrate cars locations (if any)
    migrated_count := 0;
    failed_count := 0;
    
    FOR record_data IN 
        SELECT id, location FROM public.cars 
        WHERE location IS NOT NULL
    LOOP
        BEGIN
            -- Check if location is already in Indonesian format
            IF record_data.location ? 'city_id' AND record_data.location ? 'province_id' THEN
                -- Already in new format, validate
                IF validate_indonesian_address(record_data.location) THEN
                    migrated_count := migrated_count + 1;
                    CONTINUE;
                END IF;
            END IF;
            
            -- Convert to Indonesian format
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
            
            migrated_count := migrated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            RAISE NOTICE 'Failed to migrate car location for %: %', record_data.id, SQLERRM;
            -- Set location as required for cars, so use default
            UPDATE public.cars SET
                location = jsonb_build_object(
                    'street_address', 'Location to be updated',
                    'village', '',
                    'district', '',
                    'city_id', jakarta_city_id,
                    'province_id', jakarta_province_id,
                    'postal_code', '',
                    'additional_info', 'Failed migration - please update'
                )
            WHERE id = record_data.id;
        END;
    END LOOP;
    
    RAISE NOTICE 'Car location migration completed - Migrated: %, Failed: %', migrated_count, failed_count;
END $$;

-- ============================================================================
-- APPLY CONSTRAINTS AFTER SUCCESSFUL MIGRATION
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
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for efficient city/province filtering in addresses
CREATE INDEX IF NOT EXISTS idx_user_profiles_address_city ON public.user_profiles 
USING GIN ((address->'city_id'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_address_province ON public.user_profiles 
USING GIN ((address->'province_id'));

CREATE INDEX IF NOT EXISTS idx_cars_location_city ON public.cars 
USING GIN ((location->'city_id'));

CREATE INDEX IF NOT EXISTS idx_cars_location_province ON public.cars 
USING GIN ((location->'province_id'));

CREATE INDEX IF NOT EXISTS idx_bookings_pickup_city ON public.bookings 
USING GIN ((pickup_location->'city_id'));

CREATE INDEX IF NOT EXISTS idx_bookings_dropoff_city ON public.bookings 
USING GIN ((dropoff_location->'city_id'));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

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

COMMENT ON FUNCTION public.validate_indonesian_address(JSONB) IS 
'Validates that a JSONB address object conforms to Indonesian address standards';

COMMENT ON FUNCTION public.format_indonesian_address(JSONB) IS 
'Formats a valid Indonesian address JSONB object into a readable string';