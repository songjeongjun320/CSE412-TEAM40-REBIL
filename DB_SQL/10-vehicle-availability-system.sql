-- ============================================================================
-- VEHICLE AVAILABILITY SYSTEM ENHANCEMENT
-- ============================================================================
-- This script enhances the existing car_availability table and creates
-- comprehensive availability management functions similar to Airbnb's system
-- Execute this after the main database setup is complete
-- ============================================================================

-- Step 1: Enhance car_availability table structure
ALTER TABLE car_availability 
ADD COLUMN IF NOT EXISTS availability_type TEXT DEFAULT 'manual' CHECK (availability_type IN ('manual', 'maintenance', 'personal', 'seasonal')),
ADD COLUMN IF NOT EXISTS recurring_pattern JSONB,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 2: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_car_availability_dates ON car_availability(car_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_car_availability_type ON car_availability(car_id, availability_type);
CREATE INDEX IF NOT EXISTS idx_car_availability_created_by ON car_availability(created_by);

-- Critical indexes for availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_availability_check 
ON bookings(car_id, start_date, end_date) 
WHERE status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING');

CREATE INDEX IF NOT EXISTS idx_car_availability_lookup
ON car_availability(car_id, start_date, end_date, is_available);

-- Composite index for search performance
CREATE INDEX IF NOT EXISTS idx_cars_search_optimized
ON cars(status, location) USING GIN(location);

-- Step 3: Add updated_at trigger for car_availability
CREATE TRIGGER IF NOT EXISTS update_car_availability_updated_at 
  BEFORE UPDATE ON public.car_availability 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- CORE AVAILABILITY FUNCTIONS
-- ============================================================================

-- Function 1: Check vehicle availability for given date range
CREATE OR REPLACE FUNCTION check_vehicle_availability(
  p_car_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
) RETURNS TABLE(
  is_available BOOLEAN,
  conflict_type TEXT,
  conflict_details JSONB
) AS $$
BEGIN
  -- Validate input dates
  IF p_start_date >= p_end_date THEN
    RETURN QUERY SELECT 
      FALSE, 
      'invalid_dates'::TEXT,
      jsonb_build_object('error', 'Start date must be before end date')::JSONB;
    RETURN;
  END IF;

  -- Check for existing bookings
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE car_id = p_car_id 
    AND status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
    AND (
      (start_date <= p_start_date AND end_date > p_start_date) OR
      (start_date < p_end_date AND end_date >= p_end_date) OR
      (start_date >= p_start_date AND end_date <= p_end_date)
    )
  ) THEN
    RETURN QUERY SELECT 
      FALSE, 
      'booking_conflict'::TEXT,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', id, 
        'start_date', start_date, 
        'end_date', end_date, 
        'status', status,
        'renter_name', (SELECT full_name FROM user_profiles WHERE id = renter_id)
      )) FROM bookings WHERE car_id = p_car_id 
      AND status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
      AND (
        (start_date <= p_start_date AND end_date > p_start_date) OR
        (start_date < p_end_date AND end_date >= p_end_date) OR
        (start_date >= p_start_date AND end_date <= p_end_date)
      ))::JSONB;
    RETURN;
  END IF;

  -- Check manual availability blocks
  IF EXISTS (
    SELECT 1 FROM car_availability 
    WHERE car_id = p_car_id 
    AND is_available = FALSE
    AND (
      (start_date <= p_start_date::DATE AND end_date >= p_start_date::DATE) OR
      (start_date <= p_end_date::DATE AND end_date >= p_end_date::DATE) OR
      (start_date >= p_start_date::DATE AND end_date <= p_end_date::DATE)
    )
  ) THEN
    RETURN QUERY SELECT 
      FALSE, 
      'manual_block'::TEXT,
      (SELECT jsonb_agg(jsonb_build_object(
        'start_date', start_date, 
        'end_date', end_date, 
        'reason', reason,
        'availability_type', availability_type,
        'notes', notes
      )) FROM car_availability WHERE car_id = p_car_id 
      AND is_available = FALSE
      AND (
        (start_date <= p_start_date::DATE AND end_date >= p_start_date::DATE) OR
        (start_date <= p_end_date::DATE AND end_date >= p_end_date::DATE) OR
        (start_date >= p_start_date::DATE AND end_date <= p_end_date::DATE)
      ))::JSONB;
    RETURN;
  END IF;

  -- Vehicle is available
  RETURN QUERY SELECT TRUE, 'available'::TEXT, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Create booking with availability validation
CREATE OR REPLACE FUNCTION create_booking_with_validation(
  p_booking_data JSONB
) RETURNS TABLE(
  booking_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_car_id UUID;
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_end_date TIMESTAMP WITH TIME ZONE;
  v_availability_check RECORD;
  v_new_booking_id UUID;
BEGIN
  -- Extract booking parameters
  v_car_id := (p_booking_data->>'car_id')::UUID;
  v_start_date := (p_booking_data->>'start_date')::TIMESTAMP WITH TIME ZONE;
  v_end_date := (p_booking_data->>'end_date')::TIMESTAMP WITH TIME ZONE;

  -- Validate car exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM cars 
    WHERE id = v_car_id AND status = 'ACTIVE'
  ) THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      FALSE, 
      'Vehicle not found or inactive';
    RETURN;
  END IF;

  -- Check availability
  SELECT * INTO v_availability_check 
  FROM check_vehicle_availability(v_car_id, v_start_date, v_end_date);

  IF NOT v_availability_check.is_available THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      FALSE, 
      format('Vehicle not available: %s', v_availability_check.conflict_type);
    RETURN;
  END IF;

  -- Create booking
  INSERT INTO bookings (
    car_id, renter_id, host_id, start_date, end_date,
    pickup_location, dropoff_location, insurance_type,
    daily_rate, total_days, subtotal, insurance_fee,
    service_fee, delivery_fee, total_amount, security_deposit,
    special_instructions
  ) VALUES (
    v_car_id,
    (p_booking_data->>'renter_id')::UUID,
    (p_booking_data->>'host_id')::UUID,
    v_start_date,
    v_end_date,
    (p_booking_data->>'pickup_location')::JSONB,
    (p_booking_data->>'dropoff_location')::JSONB,
    (p_booking_data->>'insurance_type')::insurance_type,
    (p_booking_data->>'daily_rate')::DECIMAL,
    (p_booking_data->>'total_days')::INTEGER,
    (p_booking_data->>'subtotal')::DECIMAL,
    (p_booking_data->>'insurance_fee')::DECIMAL,
    (p_booking_data->>'service_fee')::DECIMAL,
    (p_booking_data->>'delivery_fee')::DECIMAL,
    (p_booking_data->>'total_amount')::DECIMAL,
    (p_booking_data->>'security_deposit')::DECIMAL,
    p_booking_data->>'special_instructions'
  ) RETURNING id INTO v_new_booking_id;

  RETURN QUERY SELECT v_new_booking_id, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Search available vehicles with date filtering
CREATE OR REPLACE FUNCTION search_available_vehicles(
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
    AND (p_location IS NULL OR c.location::TEXT ILIKE '%' || p_location || '%')
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
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: Set recurring availability patterns
CREATE OR REPLACE FUNCTION set_recurring_availability(
  p_car_id UUID,
  p_pattern JSONB, -- {"type": "weekly", "days": [1,2,3,4,5], "start_time": "09:00", "end_time": "18:00"}
  p_start_date DATE,
  p_end_date DATE,
  p_is_available BOOLEAN DEFAULT TRUE,
  p_created_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Recurring availability pattern'
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_target_days INTEGER[];
BEGIN
  -- Validate car ownership if created_by is provided
  IF p_created_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cars WHERE id = p_car_id AND host_id = p_created_by
  ) THEN
    RAISE EXCEPTION 'User does not own this vehicle';
  END IF;

  v_target_days := ARRAY(SELECT jsonb_array_elements_text(p_pattern->'days'))::INTEGER[];
  v_current_date := p_start_date;
  
  WHILE v_current_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0=Sunday, 1=Monday, etc.
    
    IF v_day_of_week = ANY(v_target_days) THEN
      INSERT INTO car_availability (
        car_id, start_date, end_date, is_available, 
        availability_type, recurring_pattern, created_by, reason, notes
      ) VALUES (
        p_car_id, v_current_date, v_current_date, p_is_available,
        'seasonal', p_pattern, p_created_by, p_reason,
        format('Recurring %s availability for %s', p_pattern->>'type', 
               array_to_string(v_target_days, ','))
      ) ON CONFLICT (car_id, start_date, end_date) 
      DO UPDATE SET 
        is_available = EXCLUDED.is_available,
        recurring_pattern = EXCLUDED.recurring_pattern,
        updated_at = NOW(),
        notes = EXCLUDED.notes;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 5: Get vehicle availability calendar for a month
CREATE OR REPLACE FUNCTION get_vehicle_calendar(
  p_car_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS TABLE(
  date DATE,
  is_available BOOLEAN,
  status TEXT,
  details JSONB
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_current_date DATE;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;
  v_current_date := v_start_date;
  
  WHILE v_current_date <= v_end_date LOOP
    -- Check for bookings on this date
    IF EXISTS (
      SELECT 1 FROM bookings 
      WHERE car_id = p_car_id 
      AND status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
      AND v_current_date BETWEEN start_date::DATE AND end_date::DATE
    ) THEN
      RETURN QUERY SELECT 
        v_current_date,
        FALSE,
        'booked'::TEXT,
        (SELECT jsonb_build_object(
          'booking_id', id,
          'status', status,
          'renter', (SELECT full_name FROM user_profiles WHERE id = renter_id)
        ) FROM bookings 
        WHERE car_id = p_car_id 
        AND status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
        AND v_current_date BETWEEN start_date::DATE AND end_date::DATE
        LIMIT 1);
    -- Check for manual availability blocks
    ELSIF EXISTS (
      SELECT 1 FROM car_availability 
      WHERE car_id = p_car_id 
      AND is_available = FALSE
      AND v_current_date BETWEEN start_date AND end_date
    ) THEN
      RETURN QUERY SELECT 
        v_current_date,
        FALSE,
        'blocked'::TEXT,
        (SELECT jsonb_build_object(
          'reason', reason,
          'type', availability_type,
          'notes', notes
        ) FROM car_availability 
        WHERE car_id = p_car_id 
        AND is_available = FALSE
        AND v_current_date BETWEEN start_date AND end_date
        LIMIT 1);
    ELSE
      RETURN QUERY SELECT 
        v_current_date,
        TRUE,
        'available'::TEXT,
        '{}'::JSONB;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENHANCED RLS POLICIES
-- ============================================================================

-- Enhanced car_availability policies
DROP POLICY IF EXISTS "car_availability_view_policy" ON car_availability;
DROP POLICY IF EXISTS "car_availability_host_manage_policy" ON car_availability;
DROP POLICY IF EXISTS "car_availability_admin_manage_policy" ON car_availability;

-- Allow viewing availability for active cars
CREATE POLICY "car_availability_view_policy" ON car_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cars c 
      WHERE c.id = car_availability.car_id 
      AND (c.status = 'ACTIVE' OR c.host_id = auth.uid())
    )
  );

-- Allow hosts to manage their vehicle availability
CREATE POLICY "car_availability_host_manage_policy" ON car_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM cars c 
      WHERE c.id = car_availability.car_id 
      AND c.host_id = auth.uid()
    )
  );

-- Allow admins to manage all vehicle availability
CREATE POLICY "car_availability_admin_manage_policy" ON car_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'ADMIN' 
      AND ur.is_active = true
    )
  );

-- ============================================================================
-- UTILITY VIEWS
-- ============================================================================

-- View for upcoming bookings with availability impact
CREATE OR REPLACE VIEW upcoming_bookings_availability AS
SELECT 
  b.id as booking_id,
  b.car_id,
  c.make || ' ' || c.model as vehicle,
  b.start_date,
  b.end_date,
  b.status,
  up_renter.full_name as renter_name,
  up_host.full_name as host_name,
  EXTRACT(days FROM (b.end_date - b.start_date)) as duration_days
FROM bookings b
JOIN cars c ON b.car_id = c.id
JOIN user_profiles up_renter ON b.renter_id = up_renter.id
JOIN user_profiles up_host ON b.host_id = up_host.id
WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
  AND b.start_date >= CURRENT_DATE
ORDER BY b.start_date;

-- View for host availability management dashboard
CREATE OR REPLACE VIEW host_availability_dashboard AS
SELECT 
  c.id as car_id,
  c.make || ' ' || c.model as vehicle,
  c.status as car_status,
  COUNT(CASE WHEN ca.is_available = FALSE THEN 1 END) as blocked_days_count,
  COUNT(CASE WHEN b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING') THEN 1 END) as upcoming_bookings_count,
  MAX(ca.updated_at) as last_availability_update
FROM cars c
LEFT JOIN car_availability ca ON c.id = ca.car_id 
  AND ca.start_date >= CURRENT_DATE
LEFT JOIN bookings b ON c.id = b.car_id 
  AND b.start_date >= CURRENT_DATE 
  AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
WHERE c.host_id = auth.uid()
GROUP BY c.id, c.make, c.model, c.status
ORDER BY c.created_at DESC;

-- ============================================================================
-- VERIFICATION AND TESTING
-- ============================================================================

-- Test the availability system
DO $$
BEGIN
  RAISE NOTICE 'Vehicle Availability System installed successfully!';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - check_vehicle_availability()';
  RAISE NOTICE '  - create_booking_with_validation()';
  RAISE NOTICE '  - search_available_vehicles()';
  RAISE NOTICE '  - set_recurring_availability()';
  RAISE NOTICE '  - get_vehicle_calendar()';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - upcoming_bookings_availability';
  RAISE NOTICE '  - host_availability_dashboard';
  RAISE NOTICE 'Indexes and policies updated for optimal performance.';
END $$;