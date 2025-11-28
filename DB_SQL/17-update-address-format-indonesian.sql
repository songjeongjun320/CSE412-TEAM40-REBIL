-- ============================================================================
-- UPDATE ADDRESS FORMAT TO INDONESIAN STANDARD
-- ============================================================================
-- Updates existing JSONB address fields to use standardized Indonesian format
-- This ensures consistent address structure across the platform

-- ============================================================================
-- CREATE NEW ADDRESS FORMAT TYPE
-- ============================================================================

-- Create custom type for Indonesian address structure
CREATE TYPE indonesian_address_type AS (
  street_address TEXT,           -- Detailed street address (Jalan, Gang, etc.)
  village TEXT,                 -- Desa/Kelurahan
  district TEXT,                -- Kecamatan  
  city_id UUID,                 -- Reference to indonesian_regencies table
  province_id UUID,             -- Reference to indonesian_provinces table
  postal_code TEXT,             -- Kode pos
  additional_info TEXT,         -- RT/RW, building info, etc.
  latitude DECIMAL(10, 8),      -- GPS coordinates
  longitude DECIMAL(11, 8)      -- GPS coordinates
);

-- ============================================================================
-- CREATE HELPER FUNCTIONS FOR ADDRESS CONVERSION
-- ============================================================================

-- Function to validate Indonesian address structure
CREATE OR REPLACE FUNCTION public.validate_indonesian_address(address_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
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

-- Function to extract province and city names from address
CREATE OR REPLACE FUNCTION public.get_address_location_info(address_data JSONB)
RETURNS TABLE(
  city_name TEXT,
  province_name TEXT,
  is_major_city BOOLEAN,
  coordinates POINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as city_name,
    p.name as province_name,
    c.is_major_city,
    CASE 
      WHEN address_data ? 'latitude' AND address_data ? 'longitude' THEN
        POINT(
          (address_data->>'longitude')::DECIMAL,
          (address_data->>'latitude')::DECIMAL
        )
      ELSE NULL
    END as coordinates
  FROM public.indonesian_regencies c
  JOIN public.indonesian_provinces p ON c.province_id = p.id
  WHERE c.id = (address_data->>'city_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE ADDRESS VALIDATION CONSTRAINTS
-- ============================================================================

-- Add check constraint for user_profiles address format
ALTER TABLE public.user_profiles 
ADD CONSTRAINT check_user_address_format 
CHECK (
  address IS NULL OR 
  validate_indonesian_address(address)
);

-- Add check constraint for cars location format  
ALTER TABLE public.cars 
ADD CONSTRAINT check_car_location_format 
CHECK (
  validate_indonesian_address(location)
);

-- Add check constraint for bookings pickup/dropoff locations
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
-- CREATE INDEXES FOR ADDRESS QUERIES
-- ============================================================================

-- Indexes for efficient city/province filtering in addresses
CREATE INDEX idx_user_profiles_address_city ON public.user_profiles 
USING GIN ((address->'city_id'));

CREATE INDEX idx_user_profiles_address_province ON public.user_profiles 
USING GIN ((address->'province_id'));

CREATE INDEX idx_cars_location_city ON public.cars 
USING GIN ((location->'city_id'));

CREATE INDEX idx_cars_location_province ON public.cars 
USING GIN ((location->'province_id'));

CREATE INDEX idx_bookings_pickup_city ON public.bookings 
USING GIN ((pickup_location->'city_id'));

CREATE INDEX idx_bookings_dropoff_city ON public.bookings 
USING GIN ((dropoff_location->'city_id'));

-- ============================================================================
-- CREATE SAMPLE ADDRESS MIGRATION SCRIPT
-- ============================================================================

-- Sample function to migrate existing addresses (if any exist)
-- This would need to be customized based on existing data format

CREATE OR REPLACE FUNCTION public.migrate_existing_addresses()
RETURNS TABLE(migrated_count INTEGER, failed_count INTEGER) AS $$
DECLARE
  migrated INTEGER := 0;
  failed INTEGER := 0;
  record_data RECORD;
  jakarta_city_id UUID;
  jakarta_province_id UUID;
BEGIN
  -- Get Jakarta IDs as default fallback
  SELECT c.id, c.province_id INTO jakarta_city_id, jakarta_province_id
  FROM public.indonesian_regencies c
  JOIN public.indonesian_provinces p ON c.province_id = p.id  
  WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta';
  
  -- Migrate user_profiles addresses
  FOR record_data IN 
    SELECT id, address FROM public.user_profiles 
    WHERE address IS NOT NULL AND NOT validate_indonesian_address(address)
  LOOP
    BEGIN
      -- Try to preserve existing data and add required fields
      UPDATE public.user_profiles SET
        address = jsonb_build_object(
          'street_address', COALESCE(address->>'street', address->>'address', 'Address not specified'),
          'village', COALESCE(address->>'village', ''),
          'district', COALESCE(address->>'district', ''),
          'city_id', COALESCE(
            (address->>'city_id')::UUID, 
            jakarta_city_id
          ),
          'province_id', COALESCE(
            (address->>'province_id')::UUID,
            jakarta_province_id
          ),
          'postal_code', COALESCE(address->>'postal_code', address->>'zip', ''),
          'additional_info', COALESCE(address->>'additional_info', ''),
          'latitude', address->>'latitude',
          'longitude', address->>'longitude'
        )
      WHERE id = record_data.id;
      
      migrated := migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      -- Log the error (you might want to insert into an error log table)
      RAISE NOTICE 'Failed to migrate address for user %: %', record_data.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT migrated, failed;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE VIEWS FOR COMMON ADDRESS QUERIES
-- ============================================================================

-- View for addresses with location information
CREATE OR REPLACE VIEW public.addresses_with_location AS
SELECT 
  'user_profile' as source_type,
  up.id as source_id,
  up.address,
  c.name as city_name,
  p.name as province_name,
  p.island_group,
  c.is_major_city,
  format_indonesian_address(up.address) as formatted_address
FROM public.user_profiles up
JOIN public.indonesian_regencies c ON c.id = (up.address->>'city_id')::UUID
JOIN public.indonesian_provinces p ON p.id = c.province_id
WHERE up.address IS NOT NULL

UNION ALL

SELECT 
  'car' as source_type,
  cars.id as source_id,
  cars.location as address,
  c.name as city_name,
  p.name as province_name,
  p.island_group,
  c.is_major_city,
  format_indonesian_address(cars.location) as formatted_address
FROM public.cars cars
JOIN public.indonesian_regencies c ON c.id = (cars.location->>'city_id')::UUID
JOIN public.indonesian_provinces p ON p.id = c.province_id;

-- View for cars by location (useful for search and filtering)
CREATE OR REPLACE VIEW public.cars_by_location AS
SELECT 
  cars.*,
  c.name as city_name,
  p.name as province_name,
  p.island_group,
  c.is_major_city,
  format_indonesian_address(cars.location) as formatted_address,
  CASE 
    WHEN cars.location ? 'latitude' AND cars.location ? 'longitude' THEN
      POINT(
        (cars.location->>'longitude')::DECIMAL,
        (cars.location->>'latitude')::DECIMAL
      )
    ELSE NULL
  END as coordinates
FROM public.cars cars
JOIN public.indonesian_regencies c ON c.id = (cars.location->>'city_id')::UUID
JOIN public.indonesian_provinces p ON p.id = c.province_id
WHERE cars.status = 'ACTIVE';

-- ============================================================================
-- CREATE API FUNCTIONS FOR FRONTEND ADDRESS HANDLING
-- ============================================================================

-- Function to validate and save address
CREATE OR REPLACE FUNCTION public.save_indonesian_address(
  address_json JSONB,
  table_name TEXT,
  record_id UUID,
  column_name TEXT DEFAULT 'address'
) RETURNS BOOLEAN AS $$
DECLARE
  is_valid BOOLEAN;
  sql_query TEXT;
BEGIN
  -- Validate the address
  is_valid := validate_indonesian_address(address_json);
  
  IF NOT is_valid THEN
    RAISE EXCEPTION 'Invalid Indonesian address format';
  END IF;
  
  -- Build dynamic SQL (be careful with SQL injection - validate table/column names)
  IF table_name = 'user_profiles' AND column_name = 'address' THEN
    UPDATE public.user_profiles SET address = address_json WHERE id = record_id;
  ELSIF table_name = 'cars' AND column_name = 'location' THEN
    UPDATE public.cars SET location = address_json WHERE id = record_id;
  ELSIF table_name = 'bookings' AND column_name IN ('pickup_location', 'dropoff_location') THEN
    IF column_name = 'pickup_location' THEN
      UPDATE public.bookings SET pickup_location = address_json WHERE id = record_id;
    ELSE
      UPDATE public.bookings SET dropoff_location = address_json WHERE id = record_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid table or column name for address update';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get nearby locations (for car search)
CREATE OR REPLACE FUNCTION public.get_cars_near_location(
  target_city_id UUID,
  include_province BOOLEAN DEFAULT true,
  max_results INTEGER DEFAULT 50
) RETURNS TABLE(
  car_id UUID,
  distance_category TEXT,
  city_name TEXT,
  province_name TEXT,
  formatted_address TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH target_info AS (
    SELECT c.province_id, c.name as target_city, p.name as target_province
    FROM public.indonesian_regencies c
    JOIN public.indonesian_provinces p ON c.province_id = p.id
    WHERE c.id = target_city_id
  )
  SELECT 
    cars.id as car_id,
    CASE 
      WHEN cars.location->>'city_id' = target_city_id::TEXT THEN 'same_city'
      WHEN include_province AND c.province_id = (SELECT province_id FROM target_info) THEN 'same_province'
      ELSE 'other_province'
    END as distance_category,
    c.name as city_name,
    p.name as province_name,
    format_indonesian_address(cars.location) as formatted_address
  FROM public.cars cars
  JOIN public.indonesian_regencies c ON c.id = (cars.location->>'city_id')::UUID
  JOIN public.indonesian_provinces p ON p.id = c.province_id
  WHERE cars.status = 'ACTIVE'
  ORDER BY 
    CASE 
      WHEN cars.location->>'city_id' = target_city_id::TEXT THEN 1
      WHEN include_province AND c.province_id = (SELECT province_id FROM target_info) THEN 2
      ELSE 3
    END,
    c.is_major_city DESC,
    cars.daily_rate ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS FOR ADDRESS VALIDATION
-- ============================================================================

-- Trigger function for address validation on insert/update
CREATE OR REPLACE FUNCTION public.validate_address_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation if address is NULL
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Check which column is being updated
    IF TG_TABLE_NAME = 'user_profiles' AND NEW.address IS NOT NULL THEN
      IF NOT validate_indonesian_address(NEW.address) THEN
        RAISE EXCEPTION 'Invalid Indonesian address format for user profile';
      END IF;
    ELSIF TG_TABLE_NAME = 'cars' AND NEW.location IS NOT NULL THEN
      IF NOT validate_indonesian_address(NEW.location) THEN
        RAISE EXCEPTION 'Invalid Indonesian address format for car location';
      END IF;
    ELSIF TG_TABLE_NAME = 'bookings' THEN
      IF NEW.pickup_location IS NOT NULL AND NOT validate_indonesian_address(NEW.pickup_location) THEN
        RAISE EXCEPTION 'Invalid Indonesian address format for pickup location';
      END IF;
      IF NEW.dropoff_location IS NOT NULL AND NOT validate_indonesian_address(NEW.dropoff_location) THEN
        RAISE EXCEPTION 'Invalid Indonesian address format for dropoff location';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
CREATE TRIGGER validate_user_address_trigger
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION validate_address_trigger();

CREATE TRIGGER validate_car_location_trigger
  BEFORE INSERT OR UPDATE ON public.cars
  FOR EACH ROW EXECUTE FUNCTION validate_address_trigger();

CREATE TRIGGER validate_booking_location_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION validate_address_trigger();

-- ============================================================================
-- SAMPLE INDONESIAN ADDRESS EXAMPLES
-- ============================================================================

-- Create a function to generate sample addresses for testing
CREATE OR REPLACE FUNCTION public.create_sample_indonesian_addresses()
RETURNS TABLE(sample_type TEXT, address_json JSONB) AS $$
DECLARE
  jakarta_city_id UUID;
  jakarta_province_id UUID;
  bali_city_id UUID;
  bali_province_id UUID;
  surabaya_city_id UUID;
  east_java_province_id UUID;
BEGIN
  -- Get city IDs for samples
  SELECT c.id, c.province_id INTO jakarta_city_id, jakarta_province_id
  FROM public.indonesian_regencies c
  JOIN public.indonesian_provinces p ON c.province_id = p.id
  WHERE c.name = 'Jakarta' AND p.name = 'DKI Jakarta';
  
  SELECT c.id, c.province_id INTO bali_city_id, bali_province_id
  FROM public.indonesian_regencies c
  JOIN public.indonesian_provinces p ON c.province_id = p.id
  WHERE c.name = 'Denpasar' AND p.name = 'Bali';
  
  SELECT c.id, c.province_id INTO surabaya_city_id, east_java_province_id
  FROM public.indonesian_regencies c
  JOIN public.indonesian_provinces p ON c.province_id = p.id
  WHERE c.name = 'Surabaya' AND p.name = 'East Java';
  
  -- Return sample addresses
  RETURN QUERY VALUES 
    ('Jakarta Central Business District', jsonb_build_object(
      'street_address', 'Jalan MH Thamrin No. 28-30',
      'village', 'Menteng',
      'district', 'Menteng',
      'city_id', jakarta_city_id,
      'province_id', jakarta_province_id,
      'postal_code', '10350',
      'additional_info', 'Near Grand Indonesia Mall',
      'latitude', -6.1944,
      'longitude', 106.8229
    )),
    ('Bali Ubud Tourist Area', jsonb_build_object(
      'street_address', 'Jalan Monkey Forest Road No. 15',
      'village', 'Ubud',
      'district', 'Ubud',
      'city_id', bali_city_id,
      'province_id', bali_province_id,
      'postal_code', '80571',
      'additional_info', 'Near Sacred Monkey Forest Sanctuary',
      'latitude', -8.5069,
      'longitude', 115.2624
    )),
    ('Surabaya Industrial Area', jsonb_build_object(
      'street_address', 'Jalan Raya Gubeng No. 100',
      'village', 'Gubeng',
      'district', 'Gubeng',
      'city_id', surabaya_city_id,
      'province_id', east_java_province_id,
      'postal_code', '60281',
      'additional_info', 'Near Gubeng Station',
      'latitude', -7.2648,
      'longitude', 112.7512
    ));
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION AND TESTING
-- ============================================================================

-- Test address validation
SELECT 
  'Indonesian Address System Updated!' as status,
  (SELECT COUNT(*) FROM public.indonesian_provinces) as provinces_available,
  (SELECT COUNT(*) FROM public.indonesian_regencies) as cities_available;

-- Test sample address creation and validation
SELECT 
  sample_type,
  validate_indonesian_address(address_json) as is_valid,
  format_indonesian_address(address_json) as formatted
FROM public.create_sample_indonesian_addresses();

-- Test location search function
SELECT * FROM public.get_cars_near_location(
  (SELECT id FROM public.indonesian_regencies WHERE name = 'Jakarta' LIMIT 1),
  true,
  10
);

COMMENT ON FUNCTION public.validate_indonesian_address(JSONB) IS 
'Validates that a JSONB address object conforms to Indonesian address standards';

COMMENT ON FUNCTION public.format_indonesian_address(JSONB) IS 
'Formats a valid Indonesian address JSONB object into a readable string';

COMMENT ON FUNCTION public.get_cars_near_location(UUID, BOOLEAN, INTEGER) IS 
'Returns cars near a specified city, optionally including same province results';

COMMENT ON VIEW public.cars_by_location IS 
'View combining car data with formatted Indonesian address information';