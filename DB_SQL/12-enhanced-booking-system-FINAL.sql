-- ============================================================================
-- ENHANCED BOOKING SYSTEM - CONFLICT PREVENTION & AUTO-APPROVAL (FIXED)
-- ============================================================================
-- This script enhances the booking system to prevent duplicate bookings,
-- implement automatic approval for available periods, and add host rejection
-- capabilities with deadline enforcement.
-- 
-- Execute this after all previous SQL files have been run.
-- FIXES: Generated column issue, enum commit issue, foreign key issues
-- ============================================================================

-- Step 1: Enhance booking_status enum to include auto-approval and rejection
-- Split into separate transactions to avoid commit issues
DO $$
BEGIN
  -- Add new booking statuses if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'AUTO_APPROVED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'AUTO_APPROVED';
  END IF;
END $$;

-- Commit the enum change before using it
COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'REJECTED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'REJECTED';
  END IF;
END $$;

-- Commit the enum change before using it
COMMIT;

-- Step 2: Add enhanced columns to bookings table
DO $$
BEGIN
  -- Add approval tracking columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'approval_type'
  ) THEN
    ALTER TABLE bookings 
    ADD COLUMN approval_type TEXT DEFAULT 'manual' 
    CHECK (approval_type IN ('manual', 'automatic'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE bookings ADD COLUMN approved_by UUID REFERENCES user_profiles(id);
  END IF;

  -- Add rejection tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'rejected_by'
  ) THEN
    ALTER TABLE bookings ADD COLUMN rejected_by UUID REFERENCES user_profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE bookings ADD COLUMN rejection_reason TEXT;
  END IF;

  -- Add regular column for rejection deadline (not generated - fixes immutable error)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'rejection_deadline'
  ) THEN
    ALTER TABLE bookings ADD COLUMN rejection_deadline TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add auto-approval eligibility flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'auto_approval_eligible'
  ) THEN
    ALTER TABLE bookings ADD COLUMN auto_approval_eligible BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Step 3: Create trigger to automatically set rejection deadline
CREATE OR REPLACE FUNCTION set_booking_rejection_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Set rejection deadline to 1 day before start_date
  NEW.rejection_deadline := NEW.start_date - INTERVAL '1 day';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to ensure clean state
DROP TRIGGER IF EXISTS set_rejection_deadline_trigger ON bookings;
CREATE TRIGGER set_rejection_deadline_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_rejection_deadline();

-- Step 4: Create host preferences table for auto-approval settings
CREATE TABLE IF NOT EXISTS public.host_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  auto_approval_enabled BOOLEAN DEFAULT FALSE,
  auto_approval_limit DECIMAL(10,2) DEFAULT 7750000.00, -- Auto-approve up to Rp 7,750,000
  advance_booking_hours INTEGER DEFAULT 24, -- Require 24h advance booking
  require_renter_verification BOOLEAN DEFAULT TRUE,
  minimum_renter_score INTEGER DEFAULT 70, -- Out of 100
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(host_id)
);

-- Step 5: Create renter scoring table for auto-approval eligibility
CREATE TABLE IF NOT EXISTS public.renter_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  renter_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  verification_score INTEGER DEFAULT 0, -- Based on documents verified
  booking_history_score INTEGER DEFAULT 50, -- Based on past bookings
  cancellation_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage of cancelled bookings
  dispute_count INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  completed_bookings INTEGER DEFAULT 0,
  overall_score INTEGER DEFAULT 50, -- Calculated composite score
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(renter_id)
);

-- Step 6: Create performance indexes for new columns
CREATE INDEX IF NOT EXISTS idx_bookings_approval_type ON bookings(approval_type);
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates ON bookings(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_rejection_deadline ON bookings(rejection_deadline) 
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_host_preferences_auto_approval ON host_preferences(host_id, auto_approval_enabled);
CREATE INDEX IF NOT EXISTS idx_renter_scores_overall ON renter_scores(renter_id, overall_score);

-- ============================================================================
-- UPDATE EXISTING BOOKINGS WITH REJECTION DEADLINES
-- ============================================================================

-- Update existing bookings to have rejection deadlines
UPDATE bookings 
SET rejection_deadline = start_date - INTERVAL '1 day'
WHERE rejection_deadline IS NULL;

-- ============================================================================
-- ENHANCED BOOKING FUNCTIONS
-- ============================================================================

-- Function 1: Check for booking conflicts (prevents duplicate bookings)
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
          'status', b.status,
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
    AND b.status IN ('PENDING', 'CONFIRMED', 'AUTO_APPROVED', 'IN_PROGRESS')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      -- Check for any overlap between date ranges
      (b.start_date <= p_start_date AND b.end_date > p_start_date) OR
      (b.start_date < p_end_date AND b.end_date >= p_end_date) OR
      (b.start_date >= p_start_date AND b.end_date <= p_end_date)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Evaluate auto-approval eligibility
CREATE OR REPLACE FUNCTION evaluate_auto_approval_eligibility(
  p_car_id UUID,
  p_renter_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_total_amount DECIMAL
) RETURNS TABLE(
  is_eligible BOOLEAN,
  approval_score INTEGER,
  eligibility_details JSONB
) AS $$
DECLARE
  v_host_id UUID;
  v_host_prefs RECORD;
  v_renter_score RECORD;
  v_advance_hours INTEGER;
  v_score INTEGER := 0;
  v_details JSONB := '{}';
BEGIN
  -- Get host ID and preferences
  SELECT c.host_id INTO v_host_id 
  FROM cars c WHERE c.id = p_car_id;

  SELECT * INTO v_host_prefs 
  FROM host_preferences hp WHERE hp.host_id = v_host_id;

  -- Get renter score
  SELECT * INTO v_renter_score 
  FROM renter_scores rs WHERE rs.renter_id = p_renter_id;

  -- If no host preferences, default to manual approval
  IF v_host_prefs IS NULL OR NOT v_host_prefs.auto_approval_enabled THEN
    v_details := jsonb_build_object(
      'reason', 'Host has not enabled auto-approval',
      'auto_approval_enabled', false
    );
    RETURN QUERY SELECT FALSE, 0, v_details;
    RETURN;
  END IF;

  -- Check advance booking requirement
  v_advance_hours := EXTRACT(EPOCH FROM (p_start_date - NOW())) / 3600;
  IF v_advance_hours < v_host_prefs.advance_booking_hours THEN
    v_details := jsonb_build_object(
      'reason', 'Insufficient advance booking time',
      'required_hours', v_host_prefs.advance_booking_hours,
      'actual_hours', v_advance_hours
    );
    RETURN QUERY SELECT FALSE, 10, v_details;
    RETURN;
  END IF;
  v_score := v_score + 20; -- 20 points for advance booking

  -- Check amount limit
  IF p_total_amount > v_host_prefs.auto_approval_limit THEN
    v_details := jsonb_build_object(
      'reason', 'Booking amount exceeds auto-approval limit',
      'limit', v_host_prefs.auto_approval_limit,
      'amount', p_total_amount
    );
    RETURN QUERY SELECT FALSE, 20, v_details;
    RETURN;
  END IF;
  v_score := v_score + 25; -- 25 points for amount within limit

  -- Check renter verification if required
  IF v_host_prefs.require_renter_verification THEN
    IF v_renter_score IS NULL OR v_renter_score.verification_score < v_host_prefs.minimum_renter_score THEN
      v_details := jsonb_build_object(
        'reason', 'Renter verification score too low',
        'required_score', v_host_prefs.minimum_renter_score,
        'actual_score', COALESCE(v_renter_score.verification_score, 0)
      );
      RETURN QUERY SELECT FALSE, 30, v_details;
      RETURN;
    END IF;
  END IF;
  v_score := v_score + 20; -- 20 points for verification

  -- Check renter history
  IF v_renter_score IS NOT NULL THEN
    -- Booking history score (max 15 points)
    v_score := v_score + LEAST(15, v_renter_score.booking_history_score / 5);
    
    -- Cancellation rate penalty (max -10 points)
    v_score := v_score - LEAST(10, v_renter_score.cancellation_rate::INTEGER / 2);
    
    -- Dispute penalty (max -10 points)
    v_score := v_score - LEAST(10, v_renter_score.dispute_count * 5);
  END IF;

  -- Build details
  v_details := jsonb_build_object(
    'advance_hours', v_advance_hours,
    'amount_check', p_total_amount <= v_host_prefs.auto_approval_limit,
    'verification_score', COALESCE(v_renter_score.verification_score, 0),
    'booking_history_score', COALESCE(v_renter_score.booking_history_score, 50),
    'cancellation_rate', COALESCE(v_renter_score.cancellation_rate, 0),
    'dispute_count', COALESCE(v_renter_score.dispute_count, 0),
    'calculated_score', v_score
  );

  -- Approve if score >= 80
  RETURN QUERY SELECT (v_score >= 80), v_score, v_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Enhanced booking creation with conflict prevention and auto-approval
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

  -- Step 1: Validate car exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM cars 
    WHERE id = v_car_id AND status = 'ACTIVE'
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

-- Function 4: Host reject booking with deadline enforcement
CREATE OR REPLACE FUNCTION host_reject_booking(
  p_booking_id UUID,
  p_host_id UUID,
  p_rejection_reason TEXT
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  booking_status booking_status
) AS $$
DECLARE
  v_booking RECORD;
  v_can_reject BOOLEAN;
BEGIN
  -- Get booking details with rejection deadline
  SELECT 
    b.*, 
    (NOW() <= b.rejection_deadline) as can_reject,
    c.host_id
  INTO v_booking
  FROM bookings b
  JOIN cars c ON b.car_id = c.id
  WHERE b.id = p_booking_id;

  -- Validate booking exists
  IF v_booking IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Booking not found', NULL::booking_status;
    RETURN;
  END IF;

  -- Validate host ownership
  IF v_booking.host_id != p_host_id THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized - you are not the host for this booking', NULL::booking_status;
    RETURN;
  END IF;

  -- Check if booking can be rejected
  IF v_booking.status NOT IN ('PENDING', 'AUTO_APPROVED') THEN
    RETURN QUERY SELECT FALSE, 
      format('Cannot reject booking with status: %s', v_booking.status),
      v_booking.status;
    RETURN;
  END IF;

  -- Check rejection deadline
  IF NOT v_booking.can_reject THEN
    RETURN QUERY SELECT FALSE,
      format('Rejection deadline passed. Deadline was: %s', v_booking.rejection_deadline),
      v_booking.status;
    RETURN;
  END IF;

  -- Reject the booking
  UPDATE bookings 
  SET status = 'REJECTED',
      rejected_at = NOW(),
      rejected_by = p_host_id,
      rejection_reason = p_rejection_reason,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- Update renter cancellation statistics
  UPDATE renter_scores 
  SET cancellation_rate = (
    SELECT (COUNT(*) FILTER (WHERE status IN ('CANCELLED', 'REJECTED')) * 100.0 / NULLIF(COUNT(*), 0))
    FROM bookings 
    WHERE renter_id = v_booking.renter_id
  ),
  last_updated = NOW()
  WHERE renter_id = v_booking.renter_id;

  RETURN QUERY SELECT TRUE, 'Booking rejected successfully', 'REJECTED'::booking_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MANAGEMENT VIEWS FOR ENHANCED BOOKING SYSTEM
-- ============================================================================

-- View 1: Host booking management with rejection capabilities
CREATE OR REPLACE VIEW host_booking_management AS
SELECT 
  b.id as booking_id,
  b.status,
  b.approval_type,
  b.start_date,
  b.end_date,
  b.total_amount,
  b.rejection_deadline,
  (NOW() <= b.rejection_deadline) as can_reject,
  c.make || ' ' || c.model as vehicle_name,
  up_renter.full_name as renter_name,
  up_renter.email as renter_email,
  rs.overall_score as renter_score,
  rs.total_bookings as renter_total_bookings,
  rs.completed_bookings as renter_completed_bookings,
  rs.cancellation_rate as renter_cancellation_rate,
  b.special_instructions,
  b.created_at,
  EXTRACT(days FROM (b.start_date - NOW())) as days_until_start
FROM bookings b
JOIN cars c ON b.car_id = c.id
JOIN user_profiles up_renter ON b.renter_id = up_renter.id
LEFT JOIN renter_scores rs ON b.renter_id = rs.renter_id
WHERE c.host_id = auth.uid()
  AND b.status IN ('PENDING', 'AUTO_APPROVED', 'CONFIRMED')
ORDER BY b.start_date ASC;

-- ============================================================================
-- CREATE DEFAULT HOST PREFERENCES FOR EXISTING HOSTS SAFELY
-- ============================================================================

-- Only create preferences for hosts that actually exist in user_profiles
INSERT INTO host_preferences (host_id, auto_approval_enabled, auto_approval_limit)
SELECT DISTINCT c.host_id, FALSE, 500.00
FROM cars c
JOIN user_profiles up ON c.host_id = up.id
WHERE NOT EXISTS (
  SELECT 1 FROM host_preferences hp 
  WHERE hp.host_id = c.host_id
)
ON CONFLICT (host_id) DO NOTHING;

-- Create default renter scores for existing renters
INSERT INTO renter_scores (renter_id, verification_score, booking_history_score, overall_score)
SELECT DISTINCT b.renter_id, 0, 50, 50
FROM bookings b
JOIN user_profiles up ON b.renter_id = up.id
WHERE NOT EXISTS (
  SELECT 1 FROM renter_scores rs 
  WHERE rs.renter_id = b.renter_id
)
ON CONFLICT (renter_id) DO NOTHING;

-- ============================================================================
-- SETUP VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🎉 Enhanced Booking System installed successfully!';
  RAISE NOTICE '✨ New Features:';
  RAISE NOTICE '  - ✅ Automatic booking conflict prevention';
  RAISE NOTICE '  - ✅ Smart auto-approval based on host preferences';
  RAISE NOTICE '  - ✅ Host rejection with deadline enforcement';
  RAISE NOTICE '  - ✅ Renter scoring system for trust & safety';
  RAISE NOTICE '  - ✅ Enhanced booking status tracking';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Functions created:';
  RAISE NOTICE '  - check_booking_conflicts()';
  RAISE NOTICE '  - evaluate_auto_approval_eligibility()';
  RAISE NOTICE '  - create_booking_with_business_rules()';
  RAISE NOTICE '  - host_reject_booking()';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables created:';
  RAISE NOTICE '  - host_preferences (auto-approval settings)';
  RAISE NOTICE '  - renter_scores (trust & safety scoring)';
  RAISE NOTICE '';
  RAISE NOTICE '👀 Views created:';
  RAISE NOTICE '  - host_booking_management';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Ready for frontend integration!';
  RAISE NOTICE '⚠️  Fixed issues: Generated column, enum commit, foreign key constraints';
END $$;