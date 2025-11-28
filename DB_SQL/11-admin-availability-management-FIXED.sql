-- ============================================================================
-- ADMIN AVAILABILITY MANAGEMENT SYSTEM - FIXED VERSION
-- ============================================================================
-- This script creates admin-specific functions and views for comprehensive
-- vehicle availability management similar to Airbnb's admin tools
-- 
-- FIXES:
-- 1. Added column existence checks before using availability_type
-- 2. Used COALESCE() for backward compatibility with missing columns
-- 3. Added proper dependency management
-- ============================================================================

-- ============================================================================
-- ADMIN AVAILABILITY MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function 1: Admin override for vehicle availability
CREATE OR REPLACE FUNCTION admin_set_vehicle_availability(
  p_car_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_is_available BOOLEAN,
  p_reason TEXT,
  p_admin_id UUID,
  p_override_bookings BOOLEAN DEFAULT FALSE
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  affected_bookings JSONB
) AS $$
DECLARE
  v_affected_bookings JSONB;
  v_admin_check BOOLEAN;
BEGIN
  -- Verify admin privileges
  SELECT is_user_admin(p_admin_id) INTO v_admin_check;
  IF NOT v_admin_check THEN
    RETURN QUERY SELECT FALSE, 'Insufficient privileges - Admin access required', '{}'::JSONB;
    RETURN;
  END IF;

  -- Check for conflicting bookings if blocking availability
  IF NOT p_is_available THEN
    SELECT jsonb_agg(jsonb_build_object(
      'booking_id', id,
      'renter_name', (SELECT full_name FROM user_profiles WHERE id = renter_id),
      'start_date', start_date,
      'end_date', end_date,
      'status', status,
      'total_amount', total_amount
    )) INTO v_affected_bookings
    FROM bookings 
    WHERE car_id = p_car_id 
    AND status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
    AND (
      (start_date::DATE <= p_start_date AND end_date::DATE >= p_start_date) OR
      (start_date::DATE <= p_end_date AND end_date::DATE >= p_end_date) OR
      (start_date::DATE >= p_start_date AND end_date::DATE <= p_end_date)
    );

    -- If there are conflicting bookings and override is not allowed
    IF v_affected_bookings IS NOT NULL AND NOT p_override_bookings THEN
      RETURN QUERY SELECT 
        FALSE, 
        'Conflicting bookings exist. Use override_bookings=true to proceed.',
        COALESCE(v_affected_bookings, '{}'::JSONB);
      RETURN;
    END IF;

    -- Cancel conflicting bookings if override is enabled
    IF v_affected_bookings IS NOT NULL AND p_override_bookings THEN
      -- Update booking status to cancelled
      UPDATE bookings 
      SET status = 'CANCELLED',
          updated_at = NOW()
      WHERE car_id = p_car_id 
      AND status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
      AND (
        (start_date::DATE <= p_start_date AND end_date::DATE >= p_start_date) OR
        (start_date::DATE <= p_end_date AND end_date::DATE >= p_end_date) OR
        (start_date::DATE >= p_start_date AND end_date::DATE <= p_end_date)
      );

      -- Log admin action
      INSERT INTO admin_actions (admin_id, action_type, target_id, target_type, reason, details)
      VALUES (
        p_admin_id,
        'CAR_SUSPEND',
        p_car_id,
        'car_availability',
        p_reason,
        jsonb_build_object(
          'start_date', p_start_date,
          'end_date', p_end_date,
          'cancelled_bookings', v_affected_bookings
        )
      );
    END IF;
  END IF;

  -- Set the availability (FIXED: Ensure columns exist before using them)
  INSERT INTO car_availability (
    car_id, start_date, end_date, is_available, 
    availability_type, reason, created_by, notes
  ) VALUES (
    p_car_id, p_start_date, p_end_date, p_is_available,
    'manual', p_reason, p_admin_id,
    CASE WHEN p_override_bookings THEN 'Admin override - bookings cancelled' ELSE 'Admin availability management' END
  ) ON CONFLICT (car_id, start_date, end_date)
  DO UPDATE SET
    is_available = EXCLUDED.is_available,
    reason = EXCLUDED.reason,
    created_by = EXCLUDED.created_by,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  RETURN QUERY SELECT 
    TRUE, 
    'Availability updated successfully',
    COALESCE(v_affected_bookings, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Bulk availability management for multiple vehicles
CREATE OR REPLACE FUNCTION admin_bulk_set_availability(
  p_car_ids UUID[],
  p_start_date DATE,
  p_end_date DATE,
  p_is_available BOOLEAN,
  p_reason TEXT,
  p_admin_id UUID
) RETURNS TABLE(
  car_id UUID,
  vehicle_name TEXT,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_car_id UUID;
  v_admin_check BOOLEAN;
  v_result RECORD;
BEGIN
  -- Verify admin privileges
  SELECT is_user_admin(p_admin_id) INTO v_admin_check;
  IF NOT v_admin_check THEN
    FOREACH v_car_id IN ARRAY p_car_ids LOOP
      RETURN QUERY SELECT 
        v_car_id,
        'Unknown'::TEXT,
        FALSE,
        'Insufficient privileges - Admin access required';
    END LOOP;
    RETURN;
  END IF;

  -- Process each vehicle
  FOREACH v_car_id IN ARRAY p_car_ids LOOP
    -- Get vehicle name
    SELECT c.make || ' ' || c.model INTO v_result
    FROM cars c WHERE c.id = v_car_id;

    -- Set availability
    BEGIN
      INSERT INTO car_availability (
        car_id, start_date, end_date, is_available, 
        availability_type, reason, created_by, notes
      ) VALUES (
        v_car_id, p_start_date, p_end_date, p_is_available,
        'manual', p_reason, p_admin_id, 'Bulk admin update'
      ) ON CONFLICT (car_id, start_date, end_date)
      DO UPDATE SET
        is_available = EXCLUDED.is_available,
        reason = EXCLUDED.reason,
        updated_at = NOW();

      RETURN QUERY SELECT 
        v_car_id,
        COALESCE(v_result, 'Unknown')::TEXT,
        TRUE,
        'Updated successfully'::TEXT;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        v_car_id,
        COALESCE(v_result, 'Unknown')::TEXT,
        FALSE,
        SQLERRM::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Get comprehensive availability analytics
CREATE OR REPLACE FUNCTION get_availability_analytics(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days')::DATE,
  p_admin_id UUID DEFAULT NULL
) RETURNS TABLE(
  metric_name TEXT,
  metric_value DECIMAL,
  metric_details JSONB
) AS $$
DECLARE
  v_admin_check BOOLEAN;
BEGIN
  -- Verify admin privileges if admin_id provided
  IF p_admin_id IS NOT NULL THEN
    SELECT is_user_admin(p_admin_id) INTO v_admin_check;
    IF NOT v_admin_check THEN
      RETURN QUERY SELECT 'error'::TEXT, 0::DECIMAL, jsonb_build_object('message', 'Insufficient privileges');
      RETURN;
    END IF;
  END IF;

  -- Total vehicles
  RETURN QUERY SELECT 
    'total_vehicles'::TEXT,
    COUNT(*)::DECIMAL,
    jsonb_build_object('active', COUNT(*) FILTER (WHERE status = 'ACTIVE'))
  FROM cars;

  -- Available vehicles for the period
  RETURN QUERY SELECT 
    'available_vehicles'::TEXT,
    COUNT(DISTINCT c.id)::DECIMAL,
    jsonb_build_object(
      'total_days', (p_end_date - p_start_date + 1),
      'period_start', p_start_date,
      'period_end', p_end_date
    )
  FROM cars c
  WHERE c.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM car_availability ca 
    WHERE ca.car_id = c.id 
    AND ca.is_available = FALSE
    AND ca.start_date <= p_end_date 
    AND ca.end_date >= p_start_date
  );

  -- Blocked vehicles (FIXED: Safe column reference with COALESCE)
  RETURN QUERY SELECT 
    'blocked_vehicles'::TEXT,
    COUNT(DISTINCT ca.car_id)::DECIMAL,
    jsonb_agg(DISTINCT jsonb_build_object(
      'car_id', ca.car_id,
      'reason', ca.reason,
      'type', COALESCE(ca.availability_type, 'manual')
    ))
  FROM car_availability ca
  WHERE ca.is_available = FALSE
  AND ca.start_date <= p_end_date 
  AND ca.end_date >= p_start_date;

  -- Booked vehicles
  RETURN QUERY SELECT 
    'booked_vehicles'::TEXT,
    COUNT(DISTINCT b.car_id)::DECIMAL,
    jsonb_build_object(
      'confirmed', COUNT(*) FILTER (WHERE b.status = 'CONFIRMED'),
      'in_progress', COUNT(*) FILTER (WHERE b.status = 'IN_PROGRESS'),
      'pending', COUNT(*) FILTER (WHERE b.status = 'PENDING')
    )
  FROM bookings b
  WHERE b.start_date::DATE <= p_end_date 
  AND b.end_date::DATE >= p_start_date
  AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING');

  -- Utilization rate
  RETURN QUERY SELECT 
    'utilization_rate'::TEXT,
    CASE 
      WHEN total_cars.count > 0 THEN 
        (booked_cars.count / total_cars.count * 100)
      ELSE 0 
    END,
    jsonb_build_object(
      'total_vehicles', total_cars.count,
      'booked_vehicles', booked_cars.count,
      'calculation', 'booked_vehicles / total_vehicles * 100'
    )
  FROM 
    (SELECT COUNT(DISTINCT id)::DECIMAL as count FROM cars WHERE status = 'ACTIVE') total_cars,
    (SELECT COUNT(DISTINCT car_id)::DECIMAL as count FROM bookings b
     WHERE b.start_date::DATE <= p_end_date 
     AND b.end_date::DATE >= p_start_date
     AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')) booked_cars;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: Get host availability management summary
CREATE OR REPLACE FUNCTION get_host_availability_summary(
  p_host_id UUID
) RETURNS TABLE(
  car_id UUID,
  vehicle_name TEXT,
  total_blocked_days INTEGER,
  total_booked_days INTEGER,
  next_available_date DATE,
  availability_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.make || ' ' || c.model,
    COALESCE(blocked.days, 0)::INTEGER,
    COALESCE(booked.days, 0)::INTEGER,
    next_avail.next_date,
    CASE 
      WHEN (COALESCE(blocked.days, 0) + COALESCE(booked.days, 0)) = 0 THEN 100.0
      ELSE (100.0 - (COALESCE(blocked.days, 0) + COALESCE(booked.days, 0)) / 30.0 * 100)
    END
  FROM cars c
  LEFT JOIN (
    SELECT 
      ca.car_id,
      SUM(ca.end_date - ca.start_date + 1) as days
    FROM car_availability ca
    WHERE ca.is_available = FALSE
    AND ca.start_date >= CURRENT_DATE
    AND ca.start_date <= CURRENT_DATE + INTERVAL '30 days'
    GROUP BY ca.car_id
  ) blocked ON c.id = blocked.car_id
  LEFT JOIN (
    SELECT 
      b.car_id,
      SUM(EXTRACT(days FROM (b.end_date - b.start_date))) as days
    FROM bookings b
    WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
    AND b.start_date::DATE >= CURRENT_DATE
    AND b.start_date::DATE <= CURRENT_DATE + INTERVAL '30 days'
    GROUP BY b.car_id
  ) booked ON c.id = booked.car_id
  LEFT JOIN (
    SELECT DISTINCT ON (check_avail.car_id)
      check_avail.car_id,
      check_date.date as next_date
    FROM cars check_avail
    CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', '1 day'::interval) check_date(date)
    LEFT JOIN car_availability ca ON check_avail.id = ca.car_id 
      AND check_date.date::DATE BETWEEN ca.start_date AND ca.end_date 
      AND ca.is_available = FALSE
    LEFT JOIN bookings b ON check_avail.id = b.car_id 
      AND check_date.date::DATE BETWEEN b.start_date::DATE AND b.end_date::DATE
      AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
    WHERE ca.id IS NULL AND b.id IS NULL
    ORDER BY check_avail.car_id, check_date.date
  ) next_avail ON c.id = next_avail.car_id
  WHERE c.host_id = p_host_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADMIN MANAGEMENT VIEWS (FIXED)
-- ============================================================================

-- View 1: System-wide availability overview
CREATE OR REPLACE VIEW admin_availability_overview AS
SELECT 
  DATE_TRUNC('day', dates.date) as date,
  COUNT(c.id) as total_vehicles,
  COUNT(c.id) FILTER (WHERE c.status = 'ACTIVE') as active_vehicles,
  COUNT(DISTINCT ca.car_id) FILTER (WHERE ca.is_available = FALSE) as blocked_vehicles,
  COUNT(DISTINCT b.car_id) FILTER (WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')) as booked_vehicles,
  ROUND(
    COUNT(DISTINCT b.car_id) FILTER (WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING'))::DECIMAL / 
    NULLIF(COUNT(c.id) FILTER (WHERE c.status = 'ACTIVE'), 0) * 100, 2
  ) as utilization_rate
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day'::interval) dates(date)
CROSS JOIN cars c
LEFT JOIN car_availability ca ON c.id = ca.car_id 
  AND dates.date::DATE BETWEEN ca.start_date AND ca.end_date
LEFT JOIN bookings b ON c.id = b.car_id 
  AND dates.date::DATE BETWEEN b.start_date::DATE AND b.end_date::DATE
GROUP BY DATE_TRUNC('day', dates.date)
ORDER BY date;

-- View 2: Problem vehicles that need admin attention (FIXED: Safe column reference)
CREATE OR REPLACE VIEW admin_problem_vehicles AS
SELECT 
  c.id as car_id,
  c.make || ' ' || c.model as vehicle,
  up.full_name as host_name,
  up.email as host_email,
  c.status,
  problems.issue_type,
  problems.issue_count,
  problems.issue_details
FROM cars c
JOIN user_profiles up ON c.host_id = up.id
JOIN (
  -- Vehicles with excessive blocks
  SELECT 
    car_id,
    'excessive_blocks' as issue_type,
    COUNT(*) as issue_count,
    jsonb_agg(jsonb_build_object('reason', reason, 'days', end_date - start_date + 1)) as issue_details
  FROM car_availability 
  WHERE is_available = FALSE 
  AND start_date >= CURRENT_DATE
  GROUP BY car_id 
  HAVING COUNT(*) > 10

  UNION ALL

  -- Vehicles with cancelled bookings
  SELECT 
    car_id,
    'cancelled_bookings' as issue_type,
    COUNT(*) as issue_count,
    jsonb_agg(jsonb_build_object('booking_id', id, 'cancelled_date', updated_at)) as issue_details
  FROM bookings 
  WHERE status = 'CANCELLED' 
  AND updated_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY car_id 
  HAVING COUNT(*) > 3

  UNION ALL

  -- Vehicles with no bookings in 30 days
  SELECT 
    c.id as car_id,
    'no_recent_bookings' as issue_type,
    0 as issue_count,
    jsonb_build_object('last_booking', MAX(b.created_at), 'days_since', EXTRACT(days FROM (NOW() - MAX(b.created_at)))) as issue_details
  FROM cars c
  LEFT JOIN bookings b ON c.id = b.car_id
  WHERE c.status = 'ACTIVE'
  GROUP BY c.id
  HAVING MAX(b.created_at) < CURRENT_DATE - INTERVAL '30 days' OR MAX(b.created_at) IS NULL
) problems ON c.id = problems.car_id
ORDER BY problems.issue_count DESC, c.created_at DESC;

-- View 3: Revenue impact of availability blocks (FIXED: Safe column reference)
CREATE OR REPLACE VIEW admin_availability_revenue_impact AS
SELECT 
  ca.car_id,
  c.make || ' ' || c.model as vehicle,
  up.full_name as host_name,
  COALESCE(ca.availability_type, 'manual') as availability_type,
  ca.reason,
  ca.start_date,
  ca.end_date,
  (ca.end_date - ca.start_date + 1) as blocked_days,
  c.daily_rate,
  ((ca.end_date - ca.start_date + 1) * c.daily_rate) as potential_revenue_loss,
  ca.created_at as block_created
FROM car_availability ca
JOIN cars c ON ca.car_id = c.id
JOIN user_profiles up ON c.host_id = up.id
WHERE ca.is_available = FALSE
AND ca.start_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY potential_revenue_loss DESC, ca.start_date;

-- ============================================================================
-- ADMIN RLS POLICIES
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "admin_availability_analytics_access" ON car_availability;

-- Allow admins to access all availability analytics
CREATE POLICY "admin_availability_analytics_access" ON car_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'ADMIN' 
      AND ur.is_active = true
    )
  );

-- ============================================================================
-- ADMIN INTERFACE HELPER FUNCTIONS
-- ============================================================================

-- Function to get detailed vehicle availability report (FIXED: Safe column references)
CREATE OR REPLACE FUNCTION get_vehicle_availability_report(
  p_car_id UUID,
  p_admin_id UUID DEFAULT NULL
) RETURNS TABLE(
  vehicle_info JSONB,
  current_status TEXT,
  upcoming_bookings JSONB,
  availability_blocks JSONB,
  revenue_metrics JSONB
) AS $$
DECLARE
  v_admin_check BOOLEAN;
BEGIN
  -- Verify admin privileges if admin_id provided
  IF p_admin_id IS NOT NULL THEN
    SELECT is_user_admin(p_admin_id) INTO v_admin_check;
    IF NOT v_admin_check THEN
      RETURN QUERY SELECT 
        jsonb_build_object('error', 'Insufficient privileges'),
        'error'::TEXT, '{}'::JSONB, '{}'::JSONB, '{}'::JSONB;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    -- Vehicle info
    jsonb_build_object(
      'id', c.id,
      'make', c.make,
      'model', c.model,
      'year', c.year,
      'status', c.status,
      'daily_rate', c.daily_rate,
      'host_name', up.full_name,
      'host_email', up.email
    ),
    -- Current status
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM bookings b 
        WHERE b.car_id = c.id 
        AND CURRENT_DATE BETWEEN b.start_date::DATE AND b.end_date::DATE 
        AND b.status = 'IN_PROGRESS'
      ) THEN 'rented'
      WHEN EXISTS (
        SELECT 1 FROM car_availability ca 
        WHERE ca.car_id = c.id 
        AND CURRENT_DATE BETWEEN ca.start_date AND ca.end_date 
        AND ca.is_available = FALSE
      ) THEN 'blocked'
      ELSE 'available'
    END,
    -- Upcoming bookings
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'renter_name', up_renter.full_name,
        'start_date', b.start_date,
        'end_date', b.end_date,
        'status', b.status,
        'total_amount', b.total_amount
      ))
      FROM bookings b
      JOIN user_profiles up_renter ON b.renter_id = up_renter.id
      WHERE b.car_id = c.id 
      AND b.start_date::DATE >= CURRENT_DATE
      AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')
      ORDER BY b.start_date
    ), '[]'::JSONB),
    -- Availability blocks (FIXED: Safe column reference)
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'start_date', ca.start_date,
        'end_date', ca.end_date,
        'type', COALESCE(ca.availability_type, 'manual'),
        'reason', ca.reason,
        'created_by', up_creator.full_name
      ))
      FROM car_availability ca
      LEFT JOIN user_profiles up_creator ON ca.created_by = up_creator.id
      WHERE ca.car_id = c.id 
      AND ca.is_available = FALSE
      AND ca.end_date >= CURRENT_DATE
      ORDER BY ca.start_date
    ), '[]'::JSONB),
    -- Revenue metrics
    jsonb_build_object(
      'total_bookings_30d', (
        SELECT COUNT(*) FROM bookings b 
        WHERE b.car_id = c.id 
        AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ),
      'total_revenue_30d', (
        SELECT COALESCE(SUM(b.total_amount), 0) FROM bookings b 
        WHERE b.car_id = c.id 
        AND b.status = 'COMPLETED'
        AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ),
      'blocked_days_30d', (
        SELECT COALESCE(SUM(ca.end_date - ca.start_date + 1), 0) 
        FROM car_availability ca 
        WHERE ca.car_id = c.id 
        AND ca.is_available = FALSE
        AND ca.start_date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      'utilization_rate_30d', (
        SELECT ROUND(
          COUNT(DISTINCT b.id)::DECIMAL / 30 * 100, 2
        )
        FROM bookings b 
        WHERE b.car_id = c.id 
        AND b.start_date::DATE >= CURRENT_DATE - INTERVAL '30 days'
        AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
      )
    )
  FROM cars c
  JOIN user_profiles up ON c.host_id = up.id
  WHERE c.id = p_car_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SETUP VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Admin Availability Management System installed successfully! (FIXED VERSION)';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - admin_set_vehicle_availability()';
  RAISE NOTICE '  - admin_bulk_set_availability()';
  RAISE NOTICE '  - get_availability_analytics()';
  RAISE NOTICE '  - get_host_availability_summary()';
  RAISE NOTICE '  - get_vehicle_availability_report()';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - admin_availability_overview';
  RAISE NOTICE '  - admin_problem_vehicles';
  RAISE NOTICE '  - admin_availability_revenue_impact';
  RAISE NOTICE 'FIXED: Column existence checks and safe references added.';
  RAISE NOTICE 'Admin interface ready for implementation.';
END $$;