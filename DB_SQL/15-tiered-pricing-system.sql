-- 15-tiered-pricing-system-final-fixed.sql
-- Migration to implement tiered daily rate pricing system
-- FINAL VERSION: Resolves constraint violations and schema errors
-- FIXED: PostgreSQL syntax errors that caused "schema cars does not exist" error

-- First, let's add the new columns for tiered pricing
ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS weekly_daily_rate DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS monthly_daily_rate DECIMAL(10,2) DEFAULT NULL;

-- Add comments to clarify the new pricing model
COMMENT ON COLUMN cars.daily_rate IS 'Daily rate for bookings 1-6 days';
COMMENT ON COLUMN cars.weekly_rate IS 'DEPRECATED: Use weekly_daily_rate instead';
COMMENT ON COLUMN cars.monthly_rate IS 'DEPRECATED: Use monthly_daily_rate instead';
COMMENT ON COLUMN cars.weekly_daily_rate IS 'Daily rate applied for bookings 7-29 days';
COMMENT ON COLUMN cars.monthly_daily_rate IS 'Daily rate applied for bookings 30+ days';

-- IMPROVED migration logic with constraint validation
-- This ensures the tiered pricing hierarchy is maintained: daily >= weekly >= monthly
UPDATE cars 
SET 
    weekly_daily_rate = CASE 
        -- Use existing weekly rate if it's valid and creates a reasonable weekly daily rate
        WHEN weekly_rate IS NOT NULL 
             AND weekly_rate > 0 
             AND weekly_rate < daily_rate * 7 
             AND ROUND(weekly_rate / 7, 2) <= daily_rate
        THEN ROUND(weekly_rate / 7, 2)
        -- Otherwise use a 10% discount from daily rate
        ELSE ROUND(daily_rate * 0.9, 2)
    END,
    monthly_daily_rate = CASE 
        -- Calculate potential monthly daily rate from existing data
        WHEN monthly_rate IS NOT NULL 
             AND monthly_rate > 0 
             AND monthly_rate < daily_rate * 30
        THEN 
            -- Ensure monthly rate respects the hierarchy: monthly <= weekly <= daily
            LEAST(
                ROUND(monthly_rate / 30, 2),
                CASE 
                    WHEN weekly_rate IS NOT NULL 
                         AND weekly_rate > 0 
                         AND weekly_rate < daily_rate * 7 
                         AND ROUND(weekly_rate / 7, 2) <= daily_rate
                    THEN ROUND(weekly_rate / 7, 2) * 0.95  -- 5% less than weekly
                    ELSE ROUND(daily_rate * 0.9, 2) * 0.95  -- 5% less than weekly default
                END,
                daily_rate * 0.8  -- Maximum 20% discount from daily
            )
        -- Use default 20% discount, but ensure it's less than weekly rate
        ELSE 
            LEAST(
                ROUND(daily_rate * 0.8, 2),
                CASE 
                    WHEN weekly_rate IS NOT NULL 
                         AND weekly_rate > 0 
                         AND weekly_rate < daily_rate * 7 
                         AND ROUND(weekly_rate / 7, 2) <= daily_rate
                    THEN ROUND(weekly_rate / 7, 2) * 0.95
                    ELSE ROUND(daily_rate * 0.9, 2) * 0.95
                END
            )
    END
WHERE daily_rate > 0;

-- Additional cleanup for edge cases where calculated rates might still be invalid
UPDATE cars 
SET monthly_daily_rate = weekly_daily_rate * 0.95
WHERE monthly_daily_rate > weekly_daily_rate 
  AND weekly_daily_rate IS NOT NULL 
  AND monthly_daily_rate IS NOT NULL;

-- Ensure no monthly rate is higher than weekly rate (final safety check)
UPDATE cars 
SET monthly_daily_rate = LEAST(monthly_daily_rate, weekly_daily_rate * 0.99)
WHERE monthly_daily_rate IS NOT NULL 
  AND weekly_daily_rate IS NOT NULL 
  AND monthly_daily_rate > weekly_daily_rate;

-- Pre-constraint validation query to verify data is clean
-- This should return 0 rows before adding the constraint
SELECT 
    id, make, model, daily_rate, weekly_daily_rate, monthly_daily_rate,
    CASE 
        WHEN daily_rate <= 0 THEN 'Daily rate must be positive'
        WHEN weekly_daily_rate IS NOT NULL AND weekly_daily_rate <= 0 THEN 'Weekly daily rate must be positive'
        WHEN monthly_daily_rate IS NOT NULL AND monthly_daily_rate <= 0 THEN 'Monthly daily rate must be positive'
        WHEN weekly_daily_rate IS NOT NULL AND weekly_daily_rate > daily_rate THEN 'Weekly rate exceeds daily rate'
        WHEN monthly_daily_rate IS NOT NULL AND monthly_daily_rate > daily_rate THEN 'Monthly rate exceeds daily rate'
        WHEN weekly_daily_rate IS NOT NULL AND monthly_daily_rate IS NOT NULL AND monthly_daily_rate > weekly_daily_rate 
             THEN 'Monthly rate exceeds weekly rate'
        ELSE 'OK'
    END as validation_issue
FROM cars 
WHERE daily_rate > 0
  AND (
    daily_rate <= 0 OR
    (weekly_daily_rate IS NOT NULL AND weekly_daily_rate <= 0) OR
    (monthly_daily_rate IS NOT NULL AND monthly_daily_rate <= 0) OR
    (weekly_daily_rate IS NOT NULL AND weekly_daily_rate > daily_rate) OR
    (monthly_daily_rate IS NOT NULL AND monthly_daily_rate > daily_rate) OR
    (weekly_daily_rate IS NOT NULL AND monthly_daily_rate IS NOT NULL AND monthly_daily_rate > weekly_daily_rate)
  );

-- Add constraints to ensure pricing makes sense
-- This should now succeed without violations
ALTER TABLE cars 
ADD CONSTRAINT check_pricing_logic 
CHECK (
    daily_rate > 0 AND
    (weekly_daily_rate IS NULL OR weekly_daily_rate > 0) AND
    (monthly_daily_rate IS NULL OR monthly_daily_rate > 0) AND
    (weekly_daily_rate IS NULL OR weekly_daily_rate <= daily_rate) AND
    (monthly_daily_rate IS NULL OR monthly_daily_rate <= daily_rate) AND
    (weekly_daily_rate IS NULL OR monthly_daily_rate IS NULL OR monthly_daily_rate <= weekly_daily_rate)
);

-- Create an updated pricing calculation function
CREATE OR REPLACE FUNCTION calculate_tiered_pricing(
    p_daily_rate DECIMAL(10,2),
    p_weekly_daily_rate DECIMAL(10,2),
    p_monthly_daily_rate DECIMAL(10,2),
    p_days INTEGER
) RETURNS TABLE (
    total_amount DECIMAL(10,2),
    effective_daily_rate DECIMAL(10,2),
    rate_type TEXT,
    discount_amount DECIMAL(10,2)
) AS $$
DECLARE
    v_rate DECIMAL(10,2);
    v_type TEXT;
    v_original_cost DECIMAL(10,2);
BEGIN
    -- Calculate original cost
    v_original_cost := p_daily_rate * p_days;
    
    -- Determine which rate to use
    IF p_days >= 30 AND p_monthly_daily_rate IS NOT NULL THEN
        v_rate := p_monthly_daily_rate;
        v_type := 'monthly';
    ELSIF p_days >= 7 AND p_weekly_daily_rate IS NOT NULL THEN
        v_rate := p_weekly_daily_rate;
        v_type := 'weekly';
    ELSE
        v_rate := p_daily_rate;
        v_type := 'daily';
    END IF;
    
    -- Return results
    RETURN QUERY SELECT 
        (v_rate * p_days)::DECIMAL(10,2) as total_amount,
        v_rate as effective_daily_rate,
        v_type as rate_type,
        (v_original_cost - (v_rate * p_days))::DECIMAL(10,2) as discount_amount;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy access to pricing information
CREATE OR REPLACE VIEW car_pricing_info AS
SELECT 
    c.id,
    c.make,
    c.model,
    c.year,
    c.daily_rate,
    c.weekly_daily_rate,
    c.monthly_daily_rate,
    CASE 
        WHEN c.weekly_daily_rate IS NOT NULL 
        THEN ROUND((c.daily_rate - c.weekly_daily_rate) / c.daily_rate * 100, 1)
        ELSE 0 
    END as weekly_discount_percent,
    CASE 
        WHEN c.monthly_daily_rate IS NOT NULL 
        THEN ROUND((c.daily_rate - c.monthly_daily_rate) / c.daily_rate * 100, 1)
        ELSE 0 
    END as monthly_discount_percent,
    c.status,
    c.host_id
FROM cars c
WHERE c.status IN ('ACTIVE', 'PENDING_APPROVAL');

-- FIXED: Update the search function to use proper PostgreSQL syntax for enum types
CREATE OR REPLACE FUNCTION search_available_vehicles_with_pricing(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_filters JSON DEFAULT NULL
) RETURNS TABLE (
    car_id UUID,
    make TEXT,
    model TEXT,
    year INTEGER,
    daily_rate DECIMAL(10,2),
    weekly_daily_rate DECIMAL(10,2),
    monthly_daily_rate DECIMAL(10,2),
    calculated_total DECIMAL(10,2),
    effective_daily_rate DECIMAL(10,2),
    rate_type TEXT,
    discount_amount DECIMAL(10,2),
    location JSON,
    features TEXT[],
    transmission TEXT,  -- FIXED: Changed from cars.transmission to TEXT
    fuel_type TEXT,     -- FIXED: Changed from cars.fuel_type to TEXT  
    seats INTEGER,
    host_name TEXT,
    primary_image_url TEXT,
    availability_status TEXT
) AS $$
DECLARE
    v_days INTEGER;
BEGIN
    -- Calculate days if dates provided
    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
        v_days := p_end_date - p_start_date;
    ELSE
        v_days := 1; -- Default to 1 day for comparison
    END IF;
    
    RETURN QUERY
    SELECT 
        c.id as car_id,
        c.make,
        c.model,
        c.year,
        c.daily_rate,
        c.weekly_daily_rate,
        c.monthly_daily_rate,
        pricing.total_amount as calculated_total,
        pricing.effective_daily_rate,
        pricing.rate_type,
        pricing.discount_amount,
        c.location,
        c.features,
        c.transmission::TEXT,  -- FIXED: Cast enum to TEXT
        c.fuel_type::TEXT,     -- FIXED: Cast enum to TEXT
        c.seats,
        up.full_name as host_name,
        COALESCE(
            (SELECT image_url FROM car_images WHERE car_id = c.id AND is_primary = true LIMIT 1),
            (SELECT image_url FROM car_images WHERE car_id = c.id ORDER BY display_order LIMIT 1)
        ) as primary_image_url,
        'available' as availability_status
    FROM cars c
    JOIN user_profiles up ON c.host_id = up.id
    CROSS JOIN LATERAL calculate_tiered_pricing(
        c.daily_rate, 
        c.weekly_daily_rate, 
        c.monthly_daily_rate, 
        v_days
    ) pricing
    WHERE c.status = 'ACTIVE'
    AND (p_location IS NULL OR c.location::text ILIKE '%' || p_location || '%')
    AND (p_start_date IS NULL OR p_end_date IS NULL OR 
         NOT EXISTS (
             SELECT 1 FROM bookings b 
             WHERE b.car_id = c.id 
             AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'AUTO_APPROVED')
             AND (b.start_date, b.end_date) OVERLAPS (p_start_date, p_end_date)
         ))
    ORDER BY pricing.total_amount ASC;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cars_pricing ON cars(daily_rate, weekly_daily_rate, monthly_daily_rate);
CREATE INDEX IF NOT EXISTS idx_cars_status_pricing ON cars(status, daily_rate) WHERE status = 'ACTIVE';

-- Post-migration validation and summary
SELECT 
    'Migration Summary' as description,
    COUNT(*) as total_cars,
    COUNT(*) FILTER (WHERE weekly_daily_rate IS NOT NULL) as cars_with_weekly_rate,
    COUNT(*) FILTER (WHERE monthly_daily_rate IS NOT NULL) as cars_with_monthly_rate,
    AVG(daily_rate) as avg_daily_rate,
    AVG(weekly_daily_rate) as avg_weekly_daily_rate,
    AVG(monthly_daily_rate) as avg_monthly_daily_rate,
    -- Verify constraint compliance
    COUNT(*) FILTER (WHERE 
        daily_rate > 0 AND
        (weekly_daily_rate IS NULL OR weekly_daily_rate > 0) AND
        (monthly_daily_rate IS NULL OR monthly_daily_rate > 0) AND
        (weekly_daily_rate IS NULL OR weekly_daily_rate <= daily_rate) AND
        (monthly_daily_rate IS NULL OR monthly_daily_rate <= daily_rate) AND
        (weekly_daily_rate IS NULL OR monthly_daily_rate IS NULL OR monthly_daily_rate <= weekly_daily_rate)
    ) as constraint_compliant_cars
FROM cars 
WHERE status IN ('ACTIVE', 'PENDING_APPROVAL');

-- Show before/after comparison for all cars
SELECT 
    'Data Migration Results' as description,
    c.make,
    c.model,
    c.daily_rate,
    c.weekly_rate as old_weekly_rate,
    c.monthly_rate as old_monthly_rate,
    c.weekly_daily_rate as new_weekly_daily_rate,
    c.monthly_daily_rate as new_monthly_daily_rate,
    ROUND((c.daily_rate - c.weekly_daily_rate) / c.daily_rate * 100, 1) as weekly_discount_pct,
    ROUND((c.daily_rate - c.monthly_daily_rate) / c.daily_rate * 100, 1) as monthly_discount_pct
FROM cars c
WHERE c.daily_rate > 0
ORDER BY c.daily_rate;

-- Example pricing calculations to demonstrate the new system
SELECT 
    'Pricing Examples' as description,
    '7 days booking example' as scenario,
    pricing.*
FROM calculate_tiered_pricing(50.00, 45.00, 40.00, 7) pricing

UNION ALL

SELECT 
    'Pricing Examples' as description,
    '30 days booking example' as scenario,
    pricing.*
FROM calculate_tiered_pricing(50.00, 45.00, 40.00, 30) pricing;

-- Add helpful comments for future reference
COMMENT ON FUNCTION calculate_tiered_pricing IS 'Calculates total cost and effective rate based on tiered daily pricing system';
COMMENT ON VIEW car_pricing_info IS 'Provides easy access to car pricing information with calculated discount percentages';
COMMENT ON FUNCTION search_available_vehicles_with_pricing IS 'Enhanced search function that includes calculated pricing based on rental duration';

-- Note: The check_pricing_logic constraint ensures tiered pricing hierarchy: daily >= weekly_daily >= monthly_daily, all rates positive