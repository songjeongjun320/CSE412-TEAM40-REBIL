-- =============================================
-- Migration 34: Enhanced Location Format (Simple)
-- Add support for new code-based location format without breaking existing data
-- =============================================

-- Analysis of current location format
DO $$
DECLARE
    total_cars INTEGER;
    cars_with_uuid INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_cars FROM cars WHERE location IS NOT NULL;
    SELECT COUNT(*) INTO cars_with_uuid FROM cars WHERE location ? 'province_id';
    
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Location Format Analysis';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Total cars with location: %', total_cars;
    RAISE NOTICE 'Cars with UUID format: %', cars_with_uuid;
    RAISE NOTICE 'Ready to support new API-based location format';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Create indexes for new location format
-- =============================================

-- Indexes for nested object format (for future API-based entries)
-- Use BTREE for extracted text values instead of GIN
CREATE INDEX IF NOT EXISTS idx_cars_location_province_code 
ON cars USING BTREE ((location->'province'->>'code'));

CREATE INDEX IF NOT EXISTS idx_cars_location_city_code 
ON cars USING BTREE ((location->'city'->>'code'));

CREATE INDEX IF NOT EXISTS idx_cars_location_district_code 
ON cars USING BTREE ((location->'district'->>'code'));

CREATE INDEX IF NOT EXISTS idx_cars_location_village_code 
ON cars USING BTREE ((location->'village'->>'code'));

-- Indexes for flat format (for backward compatibility)
CREATE INDEX IF NOT EXISTS idx_cars_location_province_code_flat 
ON cars USING BTREE ((location->>'province_code'));

CREATE INDEX IF NOT EXISTS idx_cars_location_city_code_flat 
ON cars USING BTREE ((location->>'city_code'));

CREATE INDEX IF NOT EXISTS idx_cars_location_district_code_flat 
ON cars USING BTREE ((location->>'district_code'));

CREATE INDEX IF NOT EXISTS idx_cars_location_village_code_flat 
ON cars USING BTREE ((location->>'village_code'));

-- GIN index for general JSONB searches (keeping existing one)
CREATE INDEX IF NOT EXISTS idx_cars_location_gin 
ON cars USING GIN (location);

-- =============================================
-- Enhanced search function supporting both formats
-- =============================================

CREATE OR REPLACE FUNCTION public.search_cars_by_location(
    province_code TEXT DEFAULT NULL,
    city_code TEXT DEFAULT NULL,
    district_code TEXT DEFAULT NULL,
    village_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    car_id UUID,
    make TEXT,
    model TEXT,
    daily_rate DECIMAL,
    location JSONB,
    formatted_location TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.make,
        c.model,
        c.daily_rate,
        c.location,
        CASE 
            -- Try new format first
            WHEN c.location ? 'province' THEN
                CONCAT_WS(', ',
                    c.location->'village'->>'name',
                    c.location->'district'->>'name',
                    c.location->'city'->>'name',
                    c.location->'province'->>'name'
                )
            -- Fall back to flat format
            WHEN c.location ? 'province_name' THEN
                CONCAT_WS(', ',
                    c.location->>'village_name',
                    c.location->>'district_name',
                    c.location->>'city_name',
                    c.location->>'province_name'
                )
            -- Legacy format with UUIDs (lookup names from database)
            WHEN c.location ? 'province_id' THEN
                (SELECT CONCAT_WS(', ',
                    CASE WHEN c.location ? 'village_id' AND c.location->>'village_id' != '' 
                         THEN (SELECT name FROM indonesian_villages WHERE id = (c.location->>'village_id')::UUID)
                         ELSE NULL END,
                    CASE WHEN c.location ? 'district_id' AND c.location->>'district_id' != '' 
                         THEN (SELECT name FROM indonesian_districts WHERE id = (c.location->>'district_id')::UUID)
                         ELSE NULL END,
                    CASE WHEN c.location ? 'city_id' AND c.location->>'city_id' != '' 
                         THEN (SELECT name FROM indonesian_regencies WHERE id = (c.location->>'city_id')::UUID)
                         ELSE NULL END,
                    CASE WHEN c.location ? 'province_id' AND c.location->>'province_id' != '' 
                         THEN (SELECT name FROM indonesian_provinces WHERE id = (c.location->>'province_id')::UUID)
                         ELSE NULL END
                ))
            ELSE 'Unknown Location'
        END as formatted_location
    FROM cars c
    WHERE c.status IN ('AVAILABLE', 'DRAFT')
    AND (
        province_code IS NULL OR 
        -- New nested format
        c.location->'province'->>'code' = province_code OR
        -- Flat format
        c.location->>'province_code' = province_code OR
        -- Legacy UUID format (lookup by province code)
        (c.location ? 'province_id' AND 
         EXISTS (SELECT 1 FROM indonesian_provinces p 
                WHERE p.id = (c.location->>'province_id')::UUID 
                AND p.code = province_code))
    )
    AND (
        city_code IS NULL OR 
        -- New nested format
        c.location->'city'->>'code' = city_code OR
        -- Flat format
        c.location->>'city_code' = city_code
        -- Note: Skip legacy city lookup since cities don't have codes
    )
    AND (
        district_code IS NULL OR 
        -- New nested format
        c.location->'district'->>'code' = district_code OR
        -- Flat format
        c.location->>'district_code' = district_code OR
        -- Legacy UUID format
        (c.location ? 'district_id' AND 
         EXISTS (SELECT 1 FROM indonesian_districts d 
                WHERE d.id = (c.location->>'district_id')::UUID 
                AND d.government_code = district_code))
    )
    AND (
        village_code IS NULL OR 
        -- New nested format
        c.location->'village'->>'code' = village_code OR
        -- Flat format
        c.location->>'village_code' = village_code OR
        -- Legacy UUID format
        (c.location ? 'village_id' AND 
         EXISTS (SELECT 1 FROM indonesian_villages v 
                WHERE v.id = (c.location->>'village_id')::UUID 
                AND v.government_code = village_code))
    )
    ORDER BY c.created_at DESC;
END;
$$;

-- =============================================
-- Helper function to format location display
-- =============================================

CREATE OR REPLACE FUNCTION public.format_car_location(location_json JSONB)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- Try new nested format first
    IF location_json ? 'province' THEN
        RETURN CONCAT_WS(', ',
            NULLIF(location_json->'village'->>'name', ''),
            NULLIF(location_json->'district'->>'name', ''),
            NULLIF(location_json->'city'->>'name', ''),
            NULLIF(location_json->'province'->>'name', '')
        );
    END IF;
    
    -- Try flat format
    IF location_json ? 'province_name' THEN
        RETURN CONCAT_WS(', ',
            NULLIF(location_json->>'village_name', ''),
            NULLIF(location_json->>'district_name', ''),
            NULLIF(location_json->>'city_name', ''),
            NULLIF(location_json->>'province_name', '')
        );
    END IF;
    
    -- Fall back to legacy UUID format
    IF location_json ? 'province_id' THEN
        RETURN CONCAT_WS(', ',
            CASE WHEN location_json ? 'village_id' AND location_json->>'village_id' != '' 
                 THEN (SELECT name FROM indonesian_villages WHERE id = (location_json->>'village_id')::UUID)
                 ELSE NULL END,
            CASE WHEN location_json ? 'district_id' AND location_json->>'district_id' != '' 
                 THEN (SELECT name FROM indonesian_districts WHERE id = (location_json->>'district_id')::UUID)
                 ELSE NULL END,
            CASE WHEN location_json ? 'city_id' AND location_json->>'city_id' != '' 
                 THEN (SELECT name FROM indonesian_regencies WHERE id = (location_json->>'city_id')::UUID)
                 ELSE NULL END,
            CASE WHEN location_json ? 'province_id' AND location_json->>'province_id' != '' 
                 THEN (SELECT name FROM indonesian_provinces WHERE id = (location_json->>'province_id')::UUID)
                 ELSE NULL END
        );
    END IF;
    
    RETURN 'Unknown Location';
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.search_cars_by_location(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_car_location(JSONB) TO authenticated;

-- =============================================
-- Final validation
-- =============================================

DO $$
DECLARE
    total_cars INTEGER;
    sample_location JSONB;
    formatted_location TEXT;
BEGIN
    SELECT COUNT(*) INTO total_cars FROM cars WHERE location IS NOT NULL;
    
    -- Test the formatting function with a sample
    IF total_cars > 0 THEN
        SELECT location INTO sample_location FROM cars WHERE location IS NOT NULL LIMIT 1;
        SELECT format_car_location(sample_location) INTO formatted_location;
        
        RAISE NOTICE 'Sample location formatting test: %', formatted_location;
    END IF;
    
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Enhanced Location Format Setup Complete';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Total cars with location: %', total_cars;
    RAISE NOTICE 'New API-based location format ready to use';
    RAISE NOTICE 'Legacy UUID format still supported';
    RAISE NOTICE 'Setup completed successfully!';
END;
$$ LANGUAGE plpgsql;

-- Sample usage (commented out)
-- SELECT * FROM search_cars_by_location('31'); -- Jakarta cars
-- SELECT car_id, make, model, format_car_location(location) FROM cars WHERE location IS NOT NULL;
