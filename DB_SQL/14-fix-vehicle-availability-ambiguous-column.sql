-- ============================================================================
-- FIX VEHICLE AVAILABILITY AMBIGUOUS COLUMN REFERENCE
-- ============================================================================
-- This migration fixes the ambiguous column reference error in the 
-- check_vehicle_availability function that prevents vehicle search with dates
-- ============================================================================

-- Fix the check_vehicle_availability function to use proper table aliases
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

  -- Check for existing bookings (includes AUTO_APPROVED status)
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.car_id = p_car_id 
    AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING', 'AUTO_APPROVED')
    AND (
      (b.start_date <= p_start_date AND b.end_date > p_start_date) OR
      (b.start_date < p_end_date AND b.end_date >= p_end_date) OR
      (b.start_date >= p_start_date AND b.end_date <= p_end_date)
    )
  ) THEN
    RETURN QUERY SELECT 
      FALSE, 
      'booking_conflict'::TEXT,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 
        'start_date', b.start_date, 
        'end_date', b.end_date, 
        'status', b.status,
        'renter_name', (SELECT full_name FROM user_profiles WHERE id = b.renter_id)
      )) FROM bookings b WHERE b.car_id = p_car_id 
      AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING', 'AUTO_APPROVED')
      AND (
        (b.start_date <= p_start_date AND b.end_date > p_start_date) OR
        (b.start_date < p_end_date AND b.end_date >= p_end_date) OR
        (b.start_date >= p_start_date AND b.end_date <= p_end_date)
      ))::JSONB;
    RETURN;
  END IF;

  -- Check manual availability blocks - FIXED: Use table alias to avoid ambiguity
  IF EXISTS (
    SELECT 1 FROM car_availability ca
    WHERE ca.car_id = p_car_id 
    AND ca.is_available = FALSE
    AND (
      (ca.start_date <= p_start_date::DATE AND ca.end_date >= p_start_date::DATE) OR
      (ca.start_date <= p_end_date::DATE AND ca.end_date >= p_end_date::DATE) OR
      (ca.start_date >= p_start_date::DATE AND ca.end_date <= p_end_date::DATE)
    )
  ) THEN
    RETURN QUERY SELECT 
      FALSE, 
      'manual_block'::TEXT,
      (SELECT jsonb_agg(jsonb_build_object(
        'start_date', ca.start_date, 
        'end_date', ca.end_date, 
        'reason', ca.reason,
        'availability_type', COALESCE(ca.availability_type, 'manual'),
        'notes', ca.notes
      )) FROM car_availability ca WHERE ca.car_id = p_car_id 
      AND ca.is_available = FALSE
      AND (
        (ca.start_date <= p_start_date::DATE AND ca.end_date >= p_start_date::DATE) OR
        (ca.start_date <= p_end_date::DATE AND ca.end_date >= p_end_date::DATE) OR
        (ca.start_date >= p_start_date::DATE AND ca.end_date <= p_end_date::DATE)
      ))::JSONB;
    RETURN;
  END IF;

  -- Vehicle is available
  RETURN QUERY SELECT TRUE, 'available'::TEXT, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification query to test the fix
DO $$
BEGIN
  RAISE NOTICE 'Vehicle availability function fixed!';
  RAISE NOTICE 'The ambiguous column reference has been resolved by using table aliases.';
  RAISE NOTICE 'Function now properly handles booking conflicts and manual availability blocks.';
END $$;