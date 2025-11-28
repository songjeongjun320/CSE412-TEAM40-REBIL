-- Location Data Migration Script
-- Converts legacy location format to Indonesian format where possible
-- and standardizes location data structure

-- First, let's analyze current location data formats
DO $$
DECLARE
    legacy_count INTEGER;
    indonesian_count INTEGER;
    mixed_count INTEGER;
    null_count INTEGER;
    total_count INTEGER;
BEGIN
    -- Count different location format types
    SELECT COUNT(*) INTO total_count FROM cars;
    
    SELECT COUNT(*) INTO legacy_count 
    FROM cars 
    WHERE location ? 'city' AND location ? 'state' AND NOT (location ? 'city_id');
    
    SELECT COUNT(*) INTO indonesian_count 
    FROM cars 
    WHERE location ? 'city_id' AND location ? 'province_id';
    
    SELECT COUNT(*) INTO mixed_count 
    FROM cars 
    WHERE (location ? 'city' OR location ? 'state') AND (location ? 'city_id' OR location ? 'province_id');
    
    SELECT COUNT(*) INTO null_count 
    FROM cars 
    WHERE location IS NULL OR location = '{}'::jsonb;
    
    RAISE NOTICE 'Location Data Analysis:';
    RAISE NOTICE 'Total vehicles: %', total_count;
    RAISE NOTICE 'Legacy format (city/state): %', legacy_count;
    RAISE NOTICE 'Indonesian format (city_id/province_id): %', indonesian_count;
    RAISE NOTICE 'Mixed format: %', mixed_count;
    RAISE NOTICE 'Null/empty location: %', null_count;
END $$;

-- Create a backup table for location data before migration
CREATE TABLE IF NOT EXISTS cars_location_backup AS 
SELECT id, make, model, location, created_at 
FROM cars 
WHERE location IS NOT NULL;

-- Function to attempt city name to city_id conversion
CREATE OR REPLACE FUNCTION get_city_id_by_name(city_name TEXT)
RETURNS TEXT AS $$
DECLARE
    city_id TEXT;
BEGIN
    IF city_name IS NULL OR city_name = '' THEN
        RETURN NULL;
    END IF;
    
    -- Try exact match first
    SELECT id INTO city_id 
    FROM indonesian_regencies 
    WHERE LOWER(name) = LOWER(city_name)
    LIMIT 1;
    
    -- Try partial match if exact match fails
    IF city_id IS NULL THEN
        SELECT id INTO city_id 
        FROM indonesian_regencies 
        WHERE LOWER(name) LIKE '%' || LOWER(city_name) || '%'
        LIMIT 1;
    END IF;
    
    RETURN city_id;
END;
$$ LANGUAGE plpgsql;

-- Function to attempt province name to province_id conversion
CREATE OR REPLACE FUNCTION get_province_id_by_name(province_name TEXT)
RETURNS TEXT AS $$
DECLARE
    province_id TEXT;
BEGIN
    IF province_name IS NULL OR province_name = '' THEN
        RETURN NULL;
    END IF;
    
    -- Try exact match first
    SELECT id INTO province_id 
    FROM indonesian_provinces 
    WHERE LOWER(name) = LOWER(province_name)
    LIMIT 1;
    
    -- Try partial match if exact match fails
    IF province_id IS NULL THEN
        SELECT id INTO province_id 
        FROM indonesian_provinces 
        WHERE LOWER(name) LIKE '%' || LOWER(province_name) || '%'
        LIMIT 1;
    END IF;
    
    RETURN province_id;
END;
$$ LANGUAGE plpgsql;

-- Migration script: Convert legacy locations to Indonesian format
DO $$
DECLARE
    car_record RECORD;
    new_location JSONB;
    city_id TEXT;
    province_id TEXT;
    converted_count INTEGER := 0;
    failed_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting location data migration...';
    
    -- Process cars with legacy location format
    FOR car_record IN 
        SELECT id, location 
        FROM cars 
        WHERE location ? 'city' 
        AND location ? 'state' 
        AND NOT (location ? 'city_id')
        AND location IS NOT NULL
    LOOP
        -- Attempt to convert city name to city_id
        city_id := get_city_id_by_name(car_record.location->>'city');
        
        -- Attempt to convert state name to province_id
        province_id := get_province_id_by_name(car_record.location->>'state');
        
        -- Build new location object
        new_location := jsonb_build_object(
            'street_address', COALESCE(car_record.location->>'street', ''),
            'village', '',
            'district', '',
            'city_id', COALESCE(city_id, ''),
            'province_id', COALESCE(province_id, ''),
            'postal_code', COALESCE(car_record.location->>'postal_code', ''),
            'additional_info', 
                'Migrated from legacy format: ' || 
                COALESCE(car_record.location->>'city', 'Unknown') || ', ' || 
                COALESCE(car_record.location->>'state', 'Unknown'),
            -- Keep original data for reference
            'legacy_city', car_record.location->>'city',
            'legacy_state', car_record.location->>'state',
            'legacy_country', COALESCE(car_record.location->>'country', 'Indonesia')
        );
        
        -- Update the car record
        UPDATE cars 
        SET location = new_location,
            updated_at = NOW()
        WHERE id = car_record.id;
        
        IF city_id IS NOT NULL AND province_id IS NOT NULL THEN
            converted_count := converted_count + 1;
        ELSE
            failed_count := failed_count + 1;
            RAISE NOTICE 'Partial conversion for car %: city_id=%, province_id=%', 
                car_record.id, city_id, province_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE 'Successfully converted: % vehicles', converted_count;
    RAISE NOTICE 'Partially converted: % vehicles (manual review needed)', failed_count;
END $$;

-- Clean up vehicles with completely empty locations
UPDATE cars 
SET location = jsonb_build_object(
    'street_address', '',
    'village', '',
    'district', '',
    'city_id', '',
    'province_id', '',
    'postal_code', '',
    'additional_info', 'Location needs to be set by host'
)
WHERE location IS NULL OR location = '{}'::jsonb;

-- Final analysis after migration
DO $$
DECLARE
    legacy_count INTEGER;
    indonesian_count INTEGER;
    mixed_count INTEGER;
    null_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM cars;
    
    SELECT COUNT(*) INTO legacy_count 
    FROM cars 
    WHERE location ? 'city' AND location ? 'state' AND NOT (location ? 'city_id');
    
    SELECT COUNT(*) INTO indonesian_count 
    FROM cars 
    WHERE location ? 'city_id' AND location ? 'province_id';
    
    SELECT COUNT(*) INTO mixed_count 
    FROM cars 
    WHERE (location ? 'legacy_city' OR location ? 'legacy_state') 
    AND (location ? 'city_id' OR location ? 'province_id');
    
    SELECT COUNT(*) INTO null_count 
    FROM cars 
    WHERE location IS NULL OR location = '{}'::jsonb;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Post-Migration Analysis:';
    RAISE NOTICE 'Total vehicles: %', total_count;
    RAISE NOTICE 'Remaining legacy format: %', legacy_count;
    RAISE NOTICE 'Indonesian format: %', indonesian_count;
    RAISE NOTICE 'Migrated (with legacy backup): %', mixed_count;
    RAISE NOTICE 'Null/empty location: %', null_count;
END $$;

-- Create validation queries
RAISE NOTICE '';
RAISE NOTICE 'Validation Queries:';
RAISE NOTICE '1. Check vehicles needing manual city_id assignment:';
RAISE NOTICE 'SELECT id, make, model, location FROM cars WHERE location->>''city_id'' = '''' AND location ? ''legacy_city'';';
RAISE NOTICE '';
RAISE NOTICE '2. Check vehicles needing manual province_id assignment:';
RAISE NOTICE 'SELECT id, make, model, location FROM cars WHERE location->>''province_id'' = '''' AND location ? ''legacy_state'';';

-- Drop helper functions
DROP FUNCTION IF EXISTS get_city_id_by_name(TEXT);
DROP FUNCTION IF EXISTS get_province_id_by_name(TEXT);