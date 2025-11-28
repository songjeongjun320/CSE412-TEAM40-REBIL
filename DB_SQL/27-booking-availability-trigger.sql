-- ============================================================================
-- BOOKING AVAILABILITY TRIGGER
-- ============================================================================
-- This script creates a trigger that automatically adds entries to car_availability
-- when a booking is confirmed, ensuring the vehicle is marked as unavailable
-- during the booking period
-- ============================================================================

-- Function to handle booking status changes
CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When booking is confirmed, add to car_availability as unavailable
  IF NEW.status = 'CONFIRMED' AND (OLD.status IS NULL OR OLD.status != 'CONFIRMED') THEN
    INSERT INTO car_availability (
      car_id,
      start_date,
      end_date,
      is_available,
      reason,
      availability_type,
      created_by,
      notes
    ) VALUES (
      NEW.car_id,
      NEW.start_date::DATE,
      NEW.end_date::DATE,
      FALSE,
      'Confirmed booking',
      'booking',
      NEW.host_id,
      format('Confirmed booking #%s for %s days', 
             NEW.id::TEXT, 
             EXTRACT(days FROM (NEW.end_date - NEW.start_date))::TEXT)
    )
    ON CONFLICT (car_id, start_date, end_date) 
    DO UPDATE SET 
      is_available = FALSE,
      reason = 'Confirmed booking',
      availability_type = 'booking',
      updated_at = NOW(),
      notes = format('Confirmed booking #%s for %s days', 
                    NEW.id::TEXT, 
                    EXTRACT(days FROM (NEW.end_date - NEW.start_date))::TEXT);
  END IF;

  -- When booking is cancelled or completed, remove from car_availability
  IF (NEW.status = 'CANCELLED' OR NEW.status = 'COMPLETED') AND 
     (OLD.status = 'CONFIRMED' OR OLD.status = 'IN_PROGRESS') THEN
    DELETE FROM car_availability 
    WHERE car_id = NEW.car_id 
      AND start_date = NEW.start_date::DATE 
      AND end_date = NEW.end_date::DATE
      AND availability_type = 'booking'
      AND reason = 'Confirmed booking';
  END IF;

  -- When booking becomes IN_PROGRESS, ensure it's still marked as unavailable
  IF NEW.status = 'IN_PROGRESS' AND OLD.status = 'CONFIRMED' THEN
    INSERT INTO car_availability (
      car_id,
      start_date,
      end_date,
      is_available,
      reason,
      availability_type,
      created_by,
      notes
    ) VALUES (
      NEW.car_id,
      NEW.start_date::DATE,
      NEW.end_date::DATE,
      FALSE,
      'Active booking',
      'booking',
      NEW.host_id,
      format('Active booking #%s in progress', NEW.id::TEXT)
    )
    ON CONFLICT (car_id, start_date, end_date) 
    DO UPDATE SET 
      is_available = FALSE,
      reason = 'Active booking',
      availability_type = 'booking',
      updated_at = NOW(),
      notes = format('Active booking #%s in progress', NEW.id::TEXT);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS booking_status_change_trigger ON bookings;
CREATE TRIGGER booking_status_change_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_booking_status_change();

-- Also handle new bookings that are created as CONFIRMED (auto-approved)
CREATE OR REPLACE FUNCTION handle_new_confirmed_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new booking is created as CONFIRMED (auto-approved)
  IF NEW.status = 'CONFIRMED' THEN
    INSERT INTO car_availability (
      car_id,
      start_date,
      end_date,
      is_available,
      reason,
      availability_type,
      created_by,
      notes
    ) VALUES (
      NEW.car_id,
      NEW.start_date::DATE,
      NEW.end_date::DATE,
      FALSE,
      'Auto-confirmed booking',
      'booking',
      NEW.host_id,
      format('Auto-confirmed booking #%s for %s days', 
             NEW.id::TEXT, 
             EXTRACT(days FROM (NEW.end_date - NEW.start_date))::TEXT)
    )
    ON CONFLICT (car_id, start_date, end_date) 
    DO UPDATE SET 
      is_available = FALSE,
      reason = 'Auto-confirmed booking',
      availability_type = 'booking',
      updated_at = NOW(),
      notes = format('Auto-confirmed booking #%s for %s days', 
                    NEW.id::TEXT, 
                    EXTRACT(days FROM (NEW.end_date - NEW.start_date))::TEXT);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new bookings
DROP TRIGGER IF EXISTS new_confirmed_booking_trigger ON bookings;
CREATE TRIGGER new_confirmed_booking_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_confirmed_booking();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Booking Availability Triggers installed successfully!';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - handle_booking_status_change()';
  RAISE NOTICE '  - handle_new_confirmed_booking()';
  RAISE NOTICE 'Triggers created:';
  RAISE NOTICE '  - booking_status_change_trigger';
  RAISE NOTICE '  - new_confirmed_booking_trigger';
  RAISE NOTICE '';
  RAISE NOTICE 'Now when a booking is confirmed, it will automatically:';
  RAISE NOTICE '  1. Add an entry to car_availability with is_available = FALSE';
  RAISE NOTICE '  2. Mark the vehicle as unavailable during the booking period';
  RAISE NOTICE '  3. Remove the block when booking is cancelled or completed';
END $$; 