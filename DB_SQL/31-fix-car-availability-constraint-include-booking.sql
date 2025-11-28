-- ============================================================================
-- FIX: Expand car_availability.availability_type CHECK to include 'booking'
-- Reason: Booking approval trigger inserts availability_type = 'booking'
--         which violated the previous CHECK constraint
-- ============================================================================

ALTER TABLE public.car_availability
  DROP CONSTRAINT IF EXISTS car_availability_availability_type_check;

ALTER TABLE public.car_availability
  ADD CONSTRAINT car_availability_availability_type_check
  CHECK (availability_type IN ('manual', 'maintenance', 'personal', 'seasonal', 'booking'));

-- Optional: ensure default remains
ALTER TABLE public.car_availability
  ALTER COLUMN availability_type SET DEFAULT 'manual';

-- Verification (no-op if lacking permissions in some clients)
-- SELECT conname AS constraint, convalidated
-- FROM pg_constraint
-- WHERE conname = 'car_availability_availability_type_check';


