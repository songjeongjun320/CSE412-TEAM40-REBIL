-- Fix renter_stats schema to match TypeScript definitions
-- This addresses the 406 error caused by schema mismatch

-- Add missing columns that exist in TypeScript but not in database
ALTER TABLE public.renter_stats 
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing columns for enhanced functionality
ALTER TABLE public.renter_stats 
ADD COLUMN IF NOT EXISTS favorite_car_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_locations TEXT[] DEFAULT '{}';

-- Update existing records to have the calculated_at timestamp
UPDATE public.renter_stats 
SET calculated_at = updated_at 
WHERE calculated_at IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_renter_stats_calculated_at ON public.renter_stats(calculated_at);

-- Verify the schema update
SELECT 
    'Schema updated successfully' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN total_reviews IS NOT NULL THEN 1 END) as records_with_reviews,
    COUNT(CASE WHEN calculated_at IS NOT NULL THEN 1 END) as records_with_calc_date
FROM public.renter_stats;