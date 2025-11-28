-- =====================================================
-- Remove Security Deposit from Refund Calculations
-- Update cancellation functions to exclude security deposit
-- =====================================================

-- Update the cancel_booking_by_renter function to remove security deposit from refund
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
        b.start_date,
        b.status,
        get_cancellation_deadline(b.start_date) as can_cancel_until
    INTO v_booking_record
    FROM bookings b
    WHERE b.id = p_booking_id;
    
    -- Calculate refund amount (full refund for 3+ days advance cancellation)
    -- Security deposit removed from refund calculation
    v_refund_amount := v_booking_record.total_amount;
    
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
        ) ON CONFLICT DO NOTHING;
        
        -- Return success
        RETURN QUERY SELECT 
            TRUE::BOOLEAN,
            format('Booking cancelled successfully. Refund amount: Rp %.0f', v_refund_amount)::TEXT,
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

-- Update the get_booking_cancellation_info function to remove security deposit from potential refund
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
                v_booking_record.total_amount
            ELSE 0
        END::DECIMAL(10,2) as potential_refund;
END;
$$; 