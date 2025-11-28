-- =====================================================
-- Renter Booking Cancellation System
-- 3-day advance cancellation policy implementation
-- =====================================================

-- Add cancellation tracking columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by_type TEXT CHECK (cancelled_by_type IN ('renter', 'host', 'admin'));

-- Function to calculate cancellation deadline
CREATE OR REPLACE FUNCTION get_cancellation_deadline(p_start_date TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_start_date - INTERVAL '3 days';
$$;

-- Function to check if booking can be cancelled by renter
CREATE OR REPLACE FUNCTION can_renter_cancel_booking(
    p_booking_id UUID,
    p_renter_id UUID DEFAULT NULL
) RETURNS TABLE(
    can_cancel BOOLEAN,
    reason TEXT,
    days_remaining INTEGER,
    cancellation_deadline TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_record RECORD;
    v_current_time TIMESTAMP WITH TIME ZONE := NOW();
    v_days_remaining INTEGER;
BEGIN
    -- Get booking details
    SELECT 
        b.id,
        b.renter_id,
        b.start_date,
        b.status,
        b.cancelled_at,
        get_cancellation_deadline(b.start_date) as can_cancel_until
    INTO v_booking_record
    FROM bookings b
    WHERE b.id = p_booking_id;
    
    -- Check if booking exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            'Booking not found'::TEXT,
            0::INTEGER,
            NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Check if user is the renter (if renter_id provided)
    IF p_renter_id IS NOT NULL AND v_booking_record.renter_id != p_renter_id THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            'Not authorized to cancel this booking'::TEXT,
            0::INTEGER,
            v_booking_record.can_cancel_until;
        RETURN;
    END IF;
    
    -- Check if already cancelled
    IF v_booking_record.cancelled_at IS NOT NULL THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            'Booking is already cancelled'::TEXT,
            0::INTEGER,
            v_booking_record.can_cancel_until;
        RETURN;
    END IF;
    
    -- Check if booking is in cancellable status
    IF v_booking_record.status NOT IN ('PENDING', 'AUTO_APPROVED', 'CONFIRMED') THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            format('Cannot cancel booking with status: %s', v_booking_record.status)::TEXT,
            0::INTEGER,
            v_booking_record.can_cancel_until;
        RETURN;
    END IF;
    
    -- Check if booking has already started
    IF v_booking_record.start_date <= v_current_time THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            'Cannot cancel booking that has already started'::TEXT,
            0::INTEGER,
            v_booking_record.can_cancel_until;
        RETURN;
    END IF;
    
    -- Calculate days remaining until cancellation deadline
    v_days_remaining := EXTRACT(EPOCH FROM (v_booking_record.can_cancel_until - v_current_time)) / 86400;
    
    -- Check 3-day advance cancellation policy
    IF v_current_time > v_booking_record.can_cancel_until THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            format('Cancellation deadline has passed. Must cancel at least 3 days before start date (deadline was %s)', 
                   v_booking_record.can_cancel_until::TEXT)::TEXT,
            v_days_remaining::INTEGER,
            v_booking_record.can_cancel_until;
        RETURN;
    END IF;
    
    -- All checks passed - can cancel
    RETURN QUERY SELECT 
        TRUE::BOOLEAN,
        format('Booking can be cancelled. %s days remaining until deadline', 
               CEIL(v_days_remaining)::TEXT)::TEXT,
        CEIL(v_days_remaining)::INTEGER,
        v_booking_record.can_cancel_until;
        
END;
$$;

-- Function to cancel booking by renter
CREATE OR REPLACE FUNCTION cancel_booking_by_renter(
    p_booking_id UUID,
    p_renter_id UUID,
    p_cancellation_reason TEXT DEFAULT 'Cancelled by renter'
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    booking_id UUID,
    refund_amount DECIMAL(10,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_record RECORD;
    v_can_cancel BOOLEAN;
    v_cancel_reason TEXT;
    v_refund_amount DECIMAL(10,2) := 0;
    v_cancellation_fee DECIMAL(10,2) := 0;
BEGIN
    -- Check if booking can be cancelled
    SELECT cc.can_cancel, cc.reason
    INTO v_can_cancel, v_cancel_reason
    FROM can_renter_cancel_booking(p_booking_id, p_renter_id) cc;
    
    IF NOT v_can_cancel THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            v_cancel_reason::TEXT,
            p_booking_id,
            0::DECIMAL(10,2);
        RETURN;
    END IF;
    
    -- Get booking details for refund calculation
    SELECT 
        b.id,
        b.total_amount,
        b.security_deposit,
        b.start_date,
        b.status,
        get_cancellation_deadline(b.start_date) as can_cancel_until
    INTO v_booking_record
    FROM bookings b
    WHERE b.id = p_booking_id;
    
    -- Calculate refund amount (full refund for 3+ days advance cancellation)
    -- Note: In a real system, you might have different refund policies
    -- For now, we'll do full refund for qualifying cancellations
    v_refund_amount := v_booking_record.total_amount + v_booking_record.security_deposit;
    
    -- Begin transaction for booking cancellation
    BEGIN
        -- Update booking status and cancellation details
        UPDATE bookings 
        SET 
            status = 'CANCELLED',
            cancelled_at = NOW(),
            cancellation_reason = p_cancellation_reason,
            cancelled_by_type = 'renter',
            updated_at = NOW()
        WHERE id = p_booking_id;
        
        -- Update car availability - make dates available again
        -- Note: This assumes you want to make the car available again
        -- You might want to keep some cancellation history
        DELETE FROM car_availability 
        WHERE car_id = (SELECT car_id FROM bookings WHERE id = p_booking_id)
        AND start_date >= v_booking_record.start_date
        AND reason = 'booking'
        AND booking_id = p_booking_id;
        
        -- Log the cancellation (optional - for audit trail)
        INSERT INTO booking_logs (
            booking_id,
            action_type,
            action_by,
            action_by_type,
            notes,
            created_at
        ) VALUES (
            p_booking_id,
            'cancelled',
            p_renter_id,
            'renter',
            p_cancellation_reason,
            NOW()
        ) ON CONFLICT DO NOTHING; -- In case booking_logs table doesn't exist yet
        
        -- Return success
        RETURN QUERY SELECT 
            TRUE::BOOLEAN,
            format('Booking cancelled successfully. Refund amount: $%.2f', v_refund_amount)::TEXT,
            p_booking_id,
            v_refund_amount;
            
    EXCEPTION WHEN OTHERS THEN
        -- Rollback handled automatically
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            format('Error cancelling booking: %s', SQLERRM)::TEXT,
            p_booking_id,
            0::DECIMAL(10,2);
    END;
END;
$$;

-- Function to get booking cancellation details
CREATE OR REPLACE FUNCTION get_booking_cancellation_info(
    p_booking_id UUID,
    p_renter_id UUID DEFAULT NULL
) RETURNS TABLE(
    booking_id UUID,
    can_cancel BOOLEAN,
    cancellation_deadline TIMESTAMP WITH TIME ZONE,
    days_until_deadline INTEGER,
    hours_until_deadline INTEGER,
    cancellation_message TEXT,
    potential_refund DECIMAL(10,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_record RECORD;
    v_can_cancel_result RECORD;
    v_current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Get booking details
    SELECT 
        b.id,
        b.renter_id,
        b.total_amount,
        b.security_deposit,
        get_cancellation_deadline(b.start_date) as can_cancel_until,
        b.status,
        b.cancelled_at
    INTO v_booking_record
    FROM bookings b
    WHERE b.id = p_booking_id;
    
    -- Check if booking exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            p_booking_id,
            FALSE::BOOLEAN,
            NULL::TIMESTAMP WITH TIME ZONE,
            0::INTEGER,
            0::INTEGER,
            'Booking not found'::TEXT,
            0::DECIMAL(10,2);
        RETURN;
    END IF;
    
    -- Get cancellation eligibility
    SELECT *
    INTO v_can_cancel_result
    FROM can_renter_cancel_booking(p_booking_id, p_renter_id);
    
    -- Return comprehensive cancellation info
    RETURN QUERY SELECT 
        p_booking_id,
        v_can_cancel_result.can_cancel,
        v_can_cancel_result.cancellation_deadline,
        v_can_cancel_result.days_remaining,
        CASE 
            WHEN v_can_cancel_result.can_cancel THEN 
                EXTRACT(EPOCH FROM (v_can_cancel_result.cancellation_deadline - v_current_time)) / 3600
            ELSE 0
        END::INTEGER as hours_until_deadline,
        v_can_cancel_result.reason,
        CASE 
            WHEN v_can_cancel_result.can_cancel THEN 
                v_booking_record.total_amount + v_booking_record.security_deposit
            ELSE 0
        END::DECIMAL(10,2) as potential_refund;
END;
$$;

-- Create booking_logs table if it doesn't exist (for audit trail)
CREATE TABLE IF NOT EXISTS booking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'created', 'confirmed', 'cancelled', 'modified', etc.
    action_by UUID NOT NULL REFERENCES auth.users(id),
    action_by_type TEXT NOT NULL CHECK (action_by_type IN ('renter', 'host', 'admin')),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for booking logs
CREATE INDEX IF NOT EXISTS idx_booking_logs_booking_id ON booking_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_logs_created_at ON booking_logs(created_at DESC);

-- RLS Policies for booking_logs
ALTER TABLE booking_logs ENABLE ROW LEVEL SECURITY;

-- Policy for renters to view their own booking logs
CREATE POLICY "booking_logs_renter_view" ON booking_logs
    FOR SELECT USING (
        action_by = auth.uid() OR
        booking_id IN (
            SELECT id FROM bookings WHERE renter_id = auth.uid()
        )
    );

-- Policy for hosts to view logs for their bookings
CREATE POLICY "booking_logs_host_view" ON booking_logs
    FOR SELECT USING (
        booking_id IN (
            SELECT b.id FROM bookings b
            JOIN cars c ON b.car_id = c.id
            WHERE c.host_id = auth.uid()
        )
    );

-- Function to get renter's bookings with cancellation info
CREATE OR REPLACE FUNCTION get_renter_bookings_with_cancellation(
    p_renter_id UUID,
    p_status_filter TEXT DEFAULT 'all',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE(
    booking_id UUID,
    car_id UUID,
    car_make TEXT,
    car_model TEXT,
    car_year INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    total_amount DECIMAL(10,2),
    status TEXT,
    can_cancel BOOLEAN,
    cancellation_deadline TIMESTAMP WITH TIME ZONE,
    days_until_cancellation INTEGER,
    potential_refund DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id as booking_id,
        b.car_id,
        c.make as car_make,
        c.model as car_model,
        c.year as car_year,
        b.start_date,
        b.end_date,
        b.total_amount,
        b.status::TEXT,
        COALESCE(cancel_info.can_cancel, FALSE) as can_cancel,
        cancel_info.cancellation_deadline,
        COALESCE(cancel_info.days_until_deadline, 0) as days_until_cancellation,
        COALESCE(cancel_info.potential_refund, 0) as potential_refund,
        b.created_at
    FROM bookings b
    JOIN cars c ON b.car_id = c.id
    LEFT JOIN LATERAL get_booking_cancellation_info(b.id, p_renter_id) cancel_info ON true
    WHERE b.renter_id = p_renter_id
    AND (p_status_filter = 'all' OR b.status = p_status_filter)
    ORDER BY b.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_cancellation_deadline TO authenticated;
GRANT EXECUTE ON FUNCTION can_renter_cancel_booking TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking_by_renter TO authenticated;
GRANT EXECUTE ON FUNCTION get_booking_cancellation_info TO authenticated;
GRANT EXECUTE ON FUNCTION get_renter_bookings_with_cancellation TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_cancellation_deadline IS 'Calculates the cancellation deadline (3 days before start date)';
COMMENT ON FUNCTION can_renter_cancel_booking IS 'Checks if a renter can cancel a booking based on 3-day advance policy';
COMMENT ON FUNCTION cancel_booking_by_renter IS 'Cancels a booking by renter with full refund for qualifying cancellations';
COMMENT ON FUNCTION get_booking_cancellation_info IS 'Gets comprehensive cancellation information for a booking';
COMMENT ON FUNCTION get_renter_bookings_with_cancellation IS 'Gets renter bookings with cancellation eligibility information';

-- Test queries (commented out for production)
/*
-- Test cancellation check
SELECT * FROM can_renter_cancel_booking('your-booking-id-here', 'your-renter-id-here');

-- Test booking cancellation
SELECT * FROM cancel_booking_by_renter('your-booking-id-here', 'your-renter-id-here', 'Changed my plans');

-- Test getting cancellation info
SELECT * FROM get_booking_cancellation_info('your-booking-id-here', 'your-renter-id-here');

-- Test getting renter bookings with cancellation info
SELECT * FROM get_renter_bookings_with_cancellation('your-renter-id-here', 'all', 10, 0);
*/