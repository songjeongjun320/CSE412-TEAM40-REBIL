-- ============================================================================
-- ULTIMATE SIMPLE FIX FOR INDONESIAN ADDRESS MIGRATION
-- ============================================================================
-- This script provides the simplest possible fix for the address migration issues
-- No complex functions, just direct data migration and constraint application

-- ============================================================================
-- STEP 1: Get Jakarta as default city
-- ============================================================================

-- First, let's get Jakarta's city_id and province_id for default addresses
DO $$
DECLARE
    jakarta_city_id UUID;
    jakarta_province_id UUID;
BEGIN
    -- Get Jakarta IDs
    SELECT c.id, c.province_id INTO jakarta_city_id, jakarta_province_id
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id  
    WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta'
    LIMIT 1;
    
    -- If Jakarta not found, get any city
    IF jakarta_city_id IS NULL THEN
        SELECT c.id, c.province_id INTO jakarta_city_id, jakarta_province_id
        FROM public.indonesian_regencies c
        JOIN public.indonesian_provinces p ON c.province_id = p.id
        LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Using default city_id: %, province_id: %', jakarta_city_id, jakarta_province_id;
    
    -- Store these IDs in a temporary table for use in subsequent operations
    CREATE TEMP TABLE IF NOT EXISTS default_city_info (
        city_id UUID,
        province_id UUID
    );
    
    DELETE FROM default_city_info;
    INSERT INTO default_city_info VALUES (jakarta_city_id, jakarta_province_id);
END $$;

-- ============================================================================
-- STEP 2: Fix user_profiles addresses (optional, can be NULL)
-- ============================================================================

-- Convert legacy user addresses to Indonesian format
UPDATE public.user_profiles 
SET address = jsonb_build_object(
    'street_address', COALESCE(
        address->>'street',
        address->>'address', 
        address->>'street_address',
        'Address not specified'
    ),
    'village', COALESCE(address->>'village', ''),
    'district', COALESCE(address->>'district', ''),
    'city_id', (SELECT city_id FROM default_city_info),
    'province_id', (SELECT province_id FROM default_city_info),
    'postal_code', COALESCE(
        address->>'postal_code',
        address->>'zip',
        address->>'postcode',
        ''
    ),
    'additional_info', CONCAT(
        'Migrated - Original: ',
        COALESCE(address->>'city', ''), ', ',
        COALESCE(address->>'state', ''), ', ',
        COALESCE(address->>'country', ''),
        ' - Please update with correct Indonesian address'
    ),
    'latitude', address->>'latitude',
    'longitude', address->>'longitude'
)
WHERE address IS NOT NULL 
AND NOT (address ? 'city_id' AND address ? 'province_id');

-- Set invalid user addresses to NULL (address is optional for users)
UPDATE public.user_profiles 
SET address = NULL
WHERE address IS NOT NULL 
AND (
    address->>'city_id' IS NULL OR
    address->>'province_id' IS NULL OR
    address->>'street_address' IS NULL OR
    address->>'street_address' = ''
);

-- ============================================================================
-- STEP 3: Fix cars locations (REQUIRED, cannot be NULL)
-- ============================================================================

-- First, update NULL car locations with default address
UPDATE public.cars 
SET location = jsonb_build_object(
    'street_address', 'Location to be updated',
    'village', '',
    'district', '',
    'city_id', (SELECT city_id FROM default_city_info),
    'province_id', (SELECT province_id FROM default_city_info),
    'postal_code', '',
    'additional_info', 'Default location - please update'
)
WHERE location IS NULL;

-- Convert legacy car locations to Indonesian format
UPDATE public.cars 
SET location = jsonb_build_object(
    'street_address', COALESCE(
        location->>'street',
        location->>'address',
        location->>'street_address',
        'Location not specified'
    ),
    'village', COALESCE(location->>'village', ''),
    'district', COALESCE(location->>'district', ''),
    'city_id', (SELECT city_id FROM default_city_info),
    'province_id', (SELECT province_id FROM default_city_info),
    'postal_code', COALESCE(
        location->>'postal_code',
        location->>'zip',
        location->>'postcode',
        ''
    ),
    'additional_info', CONCAT(
        'Migrated - Original: ',
        COALESCE(location->>'city', ''), ', ',
        COALESCE(location->>'state', ''), ', ',
        COALESCE(location->>'country', ''),
        ' - Please update with correct Indonesian address'
    ),
    'latitude', location->>'latitude',
    'longitude', location->>'longitude'
)
WHERE location IS NOT NULL 
AND NOT (location ? 'city_id' AND location ? 'province_id');

-- Fix any invalid car locations with default address (cars must have location)
UPDATE public.cars 
SET location = jsonb_build_object(
    'street_address', 'Location to be updated',
    'village', '',
    'district', '',
    'city_id', (SELECT city_id FROM default_city_info),
    'province_id', (SELECT province_id FROM default_city_info),
    'postal_code', '',
    'additional_info', 'Fixed invalid location - please update'
)
WHERE location IS NOT NULL 
AND (
    location->>'city_id' IS NULL OR
    location->>'province_id' IS NULL OR
    location->>'street_address' IS NULL OR
    location->>'street_address' = ''
);

-- ============================================================================
-- STEP 4: Fix bookings locations (optional, can be NULL)
-- ============================================================================

-- Convert legacy booking pickup locations to Indonesian format
UPDATE public.bookings 
SET pickup_location = jsonb_build_object(
    'street_address', COALESCE(
        pickup_location->>'street',
        pickup_location->>'address',
        pickup_location->>'street_address',
        'Pickup location not specified'
    ),
    'village', COALESCE(pickup_location->>'village', ''),
    'district', COALESCE(pickup_location->>'district', ''),
    'city_id', (SELECT city_id FROM default_city_info),
    'province_id', (SELECT province_id FROM default_city_info),
    'postal_code', COALESCE(
        pickup_location->>'postal_code',
        pickup_location->>'zip',
        pickup_location->>'postcode',
        ''
    ),
    'additional_info', CONCAT(
        'Migrated pickup - Original: ',
        COALESCE(pickup_location->>'city', ''), ', ',
        COALESCE(pickup_location->>'state', ''), ', ',
        COALESCE(pickup_location->>'country', ''),
        ' - Please update with correct Indonesian address'
    ),
    'latitude', pickup_location->>'latitude',
    'longitude', pickup_location->>'longitude'
)
WHERE pickup_location IS NOT NULL 
AND NOT (pickup_location ? 'city_id' AND pickup_location ? 'province_id');

-- Convert legacy booking dropoff locations to Indonesian format
UPDATE public.bookings 
SET dropoff_location = jsonb_build_object(
    'street_address', COALESCE(
        dropoff_location->>'street',
        dropoff_location->>'address',
        dropoff_location->>'street_address',
        'Dropoff location not specified'
    ),
    'village', COALESCE(dropoff_location->>'village', ''),
    'district', COALESCE(dropoff_location->>'district', ''),
    'city_id', (SELECT city_id FROM default_city_info),
    'province_id', (SELECT province_id FROM default_city_info),
    'postal_code', COALESCE(
        dropoff_location->>'postal_code',
        dropoff_location->>'zip',
        dropoff_location->>'postcode',
        ''
    ),
    'additional_info', CONCAT(
        'Migrated dropoff - Original: ',
        COALESCE(dropoff_location->>'city', ''), ', ',
        COALESCE(dropoff_location->>'state', ''), ', ',
        COALESCE(dropoff_location->>'country', ''),
        ' - Please update with correct Indonesian address'
    ),
    'latitude', dropoff_location->>'latitude',
    'longitude', dropoff_location->>'longitude'
)
WHERE dropoff_location IS NOT NULL 
AND NOT (dropoff_location ? 'city_id' AND dropoff_location ? 'province_id');

-- Set invalid booking locations to NULL (pickup/dropoff locations are optional)
UPDATE public.bookings 
SET pickup_location = NULL
WHERE pickup_location IS NOT NULL 
AND (
    pickup_location->>'city_id' IS NULL OR
    pickup_location->>'province_id' IS NULL OR
    pickup_location->>'street_address' IS NULL OR
    pickup_location->>'street_address' = ''
);

UPDATE public.bookings 
SET dropoff_location = NULL
WHERE dropoff_location IS NOT NULL 
AND (
    dropoff_location->>'city_id' IS NULL OR
    dropoff_location->>'province_id' IS NULL OR
    dropoff_location->>'street_address' IS NULL OR
    dropoff_location->>'street_address' = ''
);

-- ============================================================================
-- STEP 5: Verification
-- ============================================================================

-- Check current state after migration
SELECT 
    'Migration Status' as status,
    (SELECT COUNT(*) FROM public.user_profiles WHERE address IS NOT NULL) as users_with_address,
    (SELECT COUNT(*) FROM public.cars WHERE location IS NOT NULL) as cars_with_location,
    (SELECT COUNT(*) FROM public.cars WHERE location IS NULL) as cars_without_location,
    (SELECT COUNT(*) FROM public.bookings WHERE pickup_location IS NOT NULL) as bookings_with_pickup,
    (SELECT COUNT(*) FROM public.bookings WHERE dropoff_location IS NOT NULL) as bookings_with_dropoff;

-- Show sample data
SELECT 
    'Sample User Address' as type,
    jsonb_pretty(address) as address_data
FROM public.user_profiles 
WHERE address IS NOT NULL 
LIMIT 1;

SELECT 
    'Sample Car Location' as type,
    jsonb_pretty(location) as location_data
FROM public.cars 
WHERE location IS NOT NULL 
LIMIT 1;

-- Show any remaining problematic data
SELECT 
    'Problematic Cars' as issue,
    COUNT(*) as count
FROM public.cars 
WHERE location IS NULL 
OR NOT (location ? 'city_id' AND location ? 'province_id' AND location ? 'street_address');

SELECT 
    'Problematic User Addresses' as issue,
    COUNT(*) as count
FROM public.user_profiles 
WHERE address IS NOT NULL 
AND NOT (address ? 'city_id' AND address ? 'province_id' AND address ? 'street_address');

SELECT 
    'Problematic Booking Locations' as issue,
    COUNT(*) as count
FROM public.bookings 
WHERE (pickup_location IS NOT NULL AND NOT (pickup_location ? 'city_id' AND pickup_location ? 'province_id'))
OR (dropoff_location IS NOT NULL AND NOT (dropoff_location ? 'city_id' AND dropoff_location ? 'province_id'));

-- Clean up temp table
DROP TABLE IF EXISTS default_city_info;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=== SIMPLE MIGRATION COMPLETED ===';
    RAISE NOTICE 'All address data has been converted to Indonesian format.';
    RAISE NOTICE 'Cars with NULL locations have been given default addresses.';
    RAISE NOTICE 'Invalid booking locations have been set to NULL.';
    RAISE NOTICE 'You can now apply constraints without violations.';
END $$;