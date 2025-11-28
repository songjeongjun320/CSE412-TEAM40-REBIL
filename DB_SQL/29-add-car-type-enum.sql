-- Migration 29: Add car_type ENUM and column to cars table
-- This migration adds a car_type enumeration for vehicle categorization

-- ============================================================================
-- CREATE CAR TYPE ENUM
-- ============================================================================

-- Create the car_type enum
CREATE TYPE car_type_enum AS ENUM ('sedan', 'suv', 'motorcycle', 'ev');

-- ============================================================================
-- ADD CAR_TYPE COLUMN TO CARS TABLE
-- ============================================================================

-- Add car_type column to cars table with default value
ALTER TABLE public.cars 
ADD COLUMN car_type car_type_enum NOT NULL DEFAULT 'sedan';

-- ============================================================================
-- UPDATE EXISTING RECORDS
-- ============================================================================

-- Update all existing records to have 'sedan' as car_type (already handled by DEFAULT)
-- This is safe because we set DEFAULT 'sedan' and NOT NULL, so existing records will automatically get 'sedan'

-- Optional: Update specific records based on make/model if needed
-- Example of how you might categorize existing vehicles:
/*
UPDATE public.cars SET car_type = 'suv' 
WHERE UPPER(make) IN ('TOYOTA', 'HONDA', 'NISSAN', 'MITSUBISHI') 
  AND UPPER(model) LIKE '%CR-V%' OR UPPER(model) LIKE '%FORTUNER%' OR UPPER(model) LIKE '%PAJERO%' 
  OR UPPER(model) LIKE '%X-TRAIL%' OR UPPER(model) LIKE '%INNOVA%';

UPDATE public.cars SET car_type = 'motorcycle' 
WHERE UPPER(make) IN ('YAMAHA', 'HONDA', 'SUZUKI', 'KAWASAKI') 
  AND seats <= 2;
*/

-- ============================================================================
-- ADD INDEX FOR PERFORMANCE
-- ============================================================================

-- Create index on car_type for efficient filtering
CREATE INDEX idx_cars_car_type ON public.cars(car_type);

-- ============================================================================
-- UPDATE SEARCH FUNCTION (if exists)
-- ============================================================================

-- Note: If you have custom search functions that need to support car_type filtering,
-- they should be updated accordingly. This is a placeholder for such updates.

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the migration
SELECT 
    'car_type column added successfully' as status,
    COUNT(*) as total_cars,
    COUNT(CASE WHEN car_type = 'sedan' THEN 1 END) as sedan_count,
    COUNT(CASE WHEN car_type = 'suv' THEN 1 END) as suv_count,
    COUNT(CASE WHEN car_type = 'motorcycle' THEN 1 END) as motorcycle_count,
    COUNT(CASE WHEN car_type = 'ev' THEN 1 END) as ev_count
FROM public.cars;

-- Show enum values
SELECT 
    'Available car_type values:' as info,
    unnest(enum_range(NULL::car_type_enum)) as car_types;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (for reference)
-- ============================================================================

/*
-- To rollback this migration:
-- 1. Remove the column
ALTER TABLE public.cars DROP COLUMN IF EXISTS car_type;

-- 2. Drop the enum type
DROP TYPE IF EXISTS car_type_enum;

-- 3. Drop the index
DROP INDEX IF EXISTS idx_cars_car_type;
*/