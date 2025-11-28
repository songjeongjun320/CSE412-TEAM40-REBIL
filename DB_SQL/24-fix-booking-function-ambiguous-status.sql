-- ============================================================================
-- FIX BOOKING FUNCTION - AMBIGUOUS STATUS COLUMN REFERENCE
-- ============================================================================
-- This script fixes the "column reference 'status' is ambiguous" error
-- in the create_booking_with_business_rules function
-- ============================================================================

-- Replace the function with proper table qualifiers
CREATE OR REPLACE FUNCTION create_booking_with_business_rules(
  p_booking_data JSONB
) RETURNS TABLE(
  booking_id UUID,
  success BOOLEAN,
  status booking_status,
  approval_type TEXT,
  message TEXT,
  details JSONB
) AS $$
DECLARE
  v_car_id UUID;
  v_renter_id UUID;
  v_host_id UUID;
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_end_date TIMESTAMP WITH TIME ZONE;
  v_total_amount DECIMAL;
  v_new_booking_id UUID;
  v_conflict_check RECORD;
  v_availability_check RECORD;
  v_auto_approval RECORD;
  v_final_status booking_status;
  v_approval_type TEXT;
  v_message TEXT;
  v_details JSONB := '{}';
BEGIN
  -- Extract booking parameters
  v_car_id := (p_booking_data->>'car_id')::UUID;
  v_renter_id := (p_booking_data->>'renter_id')::UUID;
  v_host_id := (p_booking_data->>'host_id')::UUID;
  v_start_date := (p_booking_data->>'start_date')::TIMESTAMP WITH TIME ZONE;
  v_end_date := (p_booking_data->>'end_date')::TIMESTAMP WITH TIME ZONE;
  v_total_amount := (p_booking_data->>'total_amount')::DECIMAL;

  -- Step 1: Validate car exists and is active (FIX: Qualify status with table alias)
  IF NOT EXISTS (
    SELECT 1 FROM cars c
    WHERE c.id = v_car_id AND c.status = 'ACTIVE'
  ) THEN
    RETURN QUERY SELECT 
      NULL::UUID, FALSE, NULL::booking_status, NULL::TEXT,
      'Vehicle not found or inactive', 
      jsonb_build_object('error', 'invalid_vehicle');
    RETURN;
  END IF;

  -- Step 2: Check for booking conflicts
  SELECT * INTO v_conflict_check 
  FROM check_booking_conflicts(v_car_id, v_start_date, v_end_date);

  IF v_conflict_check.has_conflict THEN
    RETURN QUERY SELECT 
      NULL::UUID, FALSE, NULL::booking_status, NULL::TEXT,
      format('Booking conflict detected: %s existing bookings overlap', v_conflict_check.conflict_count),
      jsonb_build_object(
        'error', 'booking_conflict',
        'conflicting_bookings', v_conflict_check.conflicting_bookings
      );
    RETURN;
  END IF;

  -- Step 3: Check vehicle availability using existing function
  SELECT * INTO v_availability_check 
  FROM check_vehicle_availability(v_car_id, v_start_date, v_end_date);

  IF NOT v_availability_check.is_available THEN
    RETURN QUERY SELECT 
      NULL::UUID, FALSE, NULL::booking_status, NULL::TEXT,
      format('Vehicle not available: %s', v_availability_check.conflict_type),
      jsonb_build_object(
        'error', 'vehicle_unavailable',
        'conflict_details', v_availability_check.conflict_details
      );
    RETURN;
  END IF;

  -- Step 4: Evaluate auto-approval eligibility
  SELECT * INTO v_auto_approval 
  FROM evaluate_auto_approval_eligibility(v_car_id, v_renter_id, v_start_date, v_total_amount);

  IF v_auto_approval.is_eligible THEN
    v_final_status := 'AUTO_APPROVED';
    v_approval_type := 'automatic';
    v_message := 'Booking automatically approved';
  ELSE
    v_final_status := 'PENDING';
    v_approval_type := 'manual';
    v_message := 'Booking created - awaiting host approval';
  END IF;

  v_details := jsonb_build_object(
    'auto_approval_score', v_auto_approval.approval_score,
    'eligibility_details', v_auto_approval.eligibility_details,
    'conflict_check_passed', true,
    'availability_check_passed', true
  );

  -- Step 5: Create the booking
  INSERT INTO bookings (
    car_id, renter_id, host_id, start_date, end_date,
    pickup_location, dropoff_location, insurance_type,
    daily_rate, total_days, subtotal, insurance_fee,
    service_fee, delivery_fee, total_amount, security_deposit,
    special_instructions, status, approval_type, auto_approval_eligible,
    approved_at, approved_by
  ) VALUES (
    v_car_id, v_renter_id, v_host_id, v_start_date, v_end_date,
    (p_booking_data->>'pickup_location')::JSONB,
    (p_booking_data->>'dropoff_location')::JSONB,
    (p_booking_data->>'insurance_type')::insurance_type,
    (p_booking_data->>'daily_rate')::DECIMAL,
    (p_booking_data->>'total_days')::INTEGER,
    (p_booking_data->>'subtotal')::DECIMAL,
    (p_booking_data->>'insurance_fee')::DECIMAL,
    (p_booking_data->>'service_fee')::DECIMAL,
    (p_booking_data->>'delivery_fee')::DECIMAL,
    v_total_amount,
    (p_booking_data->>'security_deposit')::DECIMAL,
    p_booking_data->>'special_instructions',
    v_final_status, v_approval_type, v_auto_approval.is_eligible,
    CASE WHEN v_final_status = 'AUTO_APPROVED' THEN NOW() ELSE NULL END,
    CASE WHEN v_final_status = 'AUTO_APPROVED' THEN v_host_id ELSE NULL END
  ) RETURNING id INTO v_new_booking_id;

  -- Step 6: Update renter booking count
  INSERT INTO renter_scores (renter_id, total_bookings, last_updated)
  VALUES (v_renter_id, 1, NOW())
  ON CONFLICT (renter_id) DO UPDATE SET
    total_bookings = renter_scores.total_bookings + 1,
    last_updated = NOW();

  RETURN QUERY SELECT 
    v_new_booking_id, TRUE, v_final_status, v_approval_type, v_message, v_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the check_booking_conflicts function if it has similar issues
CREATE OR REPLACE FUNCTION check_booking_conflicts(
  p_car_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(
  has_conflict BOOLEAN,
  conflict_count INTEGER,
  conflicting_bookings JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN COUNT(*) > 0 THEN TRUE ELSE FALSE END,
    COUNT(*)::INTEGER,
    CASE 
      WHEN COUNT(*) > 0 THEN
        jsonb_agg(jsonb_build_object(
          'booking_id', b.id,
          'status', b.status,  -- This is qualified as b.status
          'start_date', b.start_date,
          'end_date', b.end_date,
          'renter_name', up.full_name,
          'total_amount', b.total_amount
        ))
      ELSE '[]'::JSONB
    END
  FROM bookings b
  JOIN user_profiles up ON b.renter_id = up.id
  WHERE b.car_id = p_car_id
    AND b.status IN ('PENDING', 'CONFIRMED', 'AUTO_APPROVED', 'IN_PROGRESS')  -- This is qualified as b.status
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      -- Check for any overlap between date ranges
      (b.start_date <= p_start_date AND b.end_date > p_start_date) OR
      (b.start_date < p_end_date AND b.end_date >= p_end_date) OR
      (b.start_date >= p_start_date AND b.end_date <= p_end_date)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed ambiguous status column reference in booking functions';
  RAISE NOTICE '🔧 Updated functions:';
  RAISE NOTICE '  - create_booking_with_business_rules()';
  RAISE NOTICE '  - check_booking_conflicts()';
  RAISE NOTICE '🚀 Booking system should now work correctly!';
END $$;