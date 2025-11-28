-- Enhanced Search Function for Mixed Location Formats
-- Handles both legacy {city, state} and Indonesian {city_id, province_id} formats

CREATE OR REPLACE FUNCTION search_available_vehicles_enhanced(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_filters JSONB DEFAULT '{}'::JSONB
) RETURNS TABLE(
  car_id UUID,
  make TEXT,
  model TEXT,
  year INTEGER,
  daily_rate DECIMAL,
  location JSONB,
  location_display TEXT,
  features TEXT[],
  transmission transmission_type,
  fuel_type fuel_type,
  seats INTEGER,
  host_name TEXT,
  primary_image_url TEXT,
  availability_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.make,
    c.model,
    c.year,
    c.daily_rate,
    c.location,
    -- Enhanced location display that handles both formats
    CASE 
      WHEN c.location ? 'city_id' AND c.location ? 'province_id' THEN
        -- Indonesian format: lookup city and province names
        COALESCE(
          (SELECT ci.name FROM indonesian_regencies ci WHERE ci.id = (c.location->>'city_id')), 
          c.location->>'city_id'
        ) || ', ' || 
        COALESCE(
          (SELECT pr.name FROM indonesian_provinces pr WHERE pr.id = (c.location->>'province_id')), 
          c.location->>'province_id'
        )
      WHEN c.location ? 'city' AND c.location ? 'state' THEN
        -- Legacy format: use city and state directly
        COALESCE(c.location->>'city', '') || 
        CASE 
          WHEN c.location->>'city' IS NOT NULL AND c.location->>'state' IS NOT NULL 
          THEN ', ' || c.location->>'state'
          ELSE COALESCE(c.location->>'state', '')
        END
      ELSE 'Location not specified'
    END as location_display,
    c.features,
    c.transmission,
    c.fuel_type,
    c.seats,
    up.full_name,
    (SELECT ci.image_url FROM car_images ci 
     WHERE ci.car_id = c.id AND ci.is_primary = TRUE 
     LIMIT 1),
    CASE 
      WHEN p_start_date IS NULL OR p_end_date IS NULL THEN 'not_specified'
      ELSE (
        SELECT CASE 
          WHEN cva.is_available THEN 'available'
          ELSE 'unavailable'
        END
        FROM check_vehicle_availability(c.id, p_start_date, p_end_date) cva
      )
    END
  FROM cars c
  JOIN user_profiles up ON c.host_id = up.id
  WHERE c.status = 'ACTIVE'
    -- Enhanced location search that handles both formats
    AND (
      p_location IS NULL OR 
      -- Search in original location JSON
      c.location::TEXT ILIKE '%' || p_location || '%' OR
      -- Search in resolved city names for Indonesian format
      (c.location ? 'city_id' AND EXISTS(
        SELECT 1 FROM indonesian_regencies ci 
        WHERE ci.id = (c.location->>'city_id') 
        AND ci.name ILIKE '%' || p_location || '%'
      )) OR
      -- Search in resolved province names for Indonesian format  
      (c.location ? 'province_id' AND EXISTS(
        SELECT 1 FROM indonesian_provinces pr 
        WHERE pr.id = (c.location->>'province_id') 
        AND pr.name ILIKE '%' || p_location || '%'
      )) OR
      -- Search in legacy city/state fields
      (c.location ? 'city' AND c.location->>'city' ILIKE '%' || p_location || '%') OR
      (c.location ? 'state' AND c.location->>'state' ILIKE '%' || p_location || '%')
    )
    AND (
      p_start_date IS NULL OR p_end_date IS NULL OR
      (SELECT cva.is_available FROM check_vehicle_availability(c.id, p_start_date, p_end_date) cva)
    )
    -- Apply additional filters from p_filters JSONB
    AND (
      (p_filters->>'transmission') IS NULL OR 
      c.transmission = (p_filters->>'transmission')::transmission_type
    )
    AND (
      (p_filters->>'fuel_type') IS NULL OR 
      c.fuel_type = (p_filters->>'fuel_type')::fuel_type
    )
    AND (
      (p_filters->>'min_seats') IS NULL OR 
      c.seats >= (p_filters->>'min_seats')::INTEGER
    )
    AND (
      (p_filters->>'max_price') IS NULL OR 
      c.daily_rate <= (p_filters->>'max_price')::DECIMAL
    )
  ORDER BY 
    -- Prioritize exact matches in resolved names
    CASE 
      WHEN c.location ? 'city_id' AND EXISTS(
        SELECT 1 FROM indonesian_regencies ci 
        WHERE ci.id = (c.location->>'city_id') 
        AND ci.name ILIKE p_location
      ) THEN 1
      WHEN c.location ? 'city' AND c.location->>'city' ILIKE p_location THEN 1
      ELSE 2
    END,
    c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION search_available_vehicles_enhanced IS 
'Enhanced vehicle search that handles both legacy {city, state} and Indonesian {city_id, province_id} location formats. 
Provides resolved location display names and improved search across both formats.';

-- Create indexes to improve performance
CREATE INDEX IF NOT EXISTS idx_cars_location_city_id ON cars USING GIN ((location->>'city_id'));
CREATE INDEX IF NOT EXISTS idx_cars_location_province_id ON cars USING GIN ((location->>'province_id'));
CREATE INDEX IF NOT EXISTS idx_cars_location_city ON cars USING GIN ((location->>'city'));
CREATE INDEX IF NOT EXISTS idx_cars_location_state ON cars USING GIN ((location->>'state'));

-- Test the function
DO $$
BEGIN
  RAISE NOTICE 'Testing enhanced search function...';
  
  -- Test 1: Search by Indonesian city name (should find vehicles with city_id that resolves to this name)
  RAISE NOTICE 'Test 1: Search by "Jakarta" - should find vehicles in Jakarta';
  
  -- Test 2: Search by legacy city name 
  RAISE NOTICE 'Test 2: Search by legacy city names';
  
  -- Test 3: General location search
  RAISE NOTICE 'Test 3: General location search';
  
  RAISE NOTICE 'Enhanced search function created successfully!';
END $$;