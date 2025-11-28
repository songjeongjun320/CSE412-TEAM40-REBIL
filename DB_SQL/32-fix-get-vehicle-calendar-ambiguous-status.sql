-- ============================================================================
-- FIX: Qualify column references in get_vehicle_calendar to avoid ambiguity
-- Reason: Error "column reference 'status' is ambiguous" when selecting details
-- ============================================================================

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
      SELECT 1 FROM bookings b
      WHERE b.car_id = p_car_id 
      AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
      AND v_current_date BETWEEN b.start_date::DATE AND b.end_date::DATE
    ) THEN
      RETURN QUERY SELECT 
        v_current_date,
        FALSE,
        'booked'::TEXT,
        (SELECT jsonb_build_object(
          'booking_id', b2.id,
          'status', b2.status,
          'renter', (SELECT up.full_name FROM user_profiles up WHERE up.id = b2.renter_id)
        ) FROM bookings b2
        WHERE b2.car_id = p_car_id 
        AND b2.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
        AND v_current_date BETWEEN b2.start_date::DATE AND b2.end_date::DATE
        LIMIT 1);
    -- Check for manual availability blocks
    ELSIF EXISTS (
      SELECT 1 FROM car_availability ca
      WHERE ca.car_id = p_car_id 
      AND ca.is_available = FALSE
      AND v_current_date BETWEEN ca.start_date AND ca.end_date
    ) THEN
      RETURN QUERY SELECT 
        v_current_date,
        FALSE,
        'blocked'::TEXT,
        (SELECT jsonb_build_object(
          'reason', ca2.reason,
          'type', COALESCE(ca2.availability_type, 'manual'),
          'notes', ca2.notes
        ) FROM car_availability ca2
        WHERE ca2.car_id = p_car_id 
        AND ca2.is_available = FALSE
        AND v_current_date BETWEEN ca2.start_date AND ca2.end_date
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


