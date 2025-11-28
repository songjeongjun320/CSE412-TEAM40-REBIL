-- Initialize renter_stats data for users who don't have records
-- This ensures all renters have stats available, preventing 406 errors

-- Create renter_stats records for users with RENTER role who don't have stats yet
INSERT INTO public.renter_stats (
    renter_id,
    total_bookings,
    completed_bookings,
    cancelled_bookings,
    total_spent,
    average_rating,
    total_reviews,
    calculated_at,
    created_at,
    updated_at,
    favorite_car_types,
    preferred_locations
)
SELECT DISTINCT
    ur.user_id as renter_id,
    0 as total_bookings,
    0 as completed_bookings,
    0 as cancelled_bookings,
    0 as total_spent,
    0 as average_rating,
    0 as total_reviews,
    NOW() as calculated_at,
    NOW() as created_at,
    NOW() as updated_at,
    ARRAY[]::TEXT[] as favorite_car_types,
    ARRAY[]::TEXT[] as preferred_locations
FROM public.user_roles ur
WHERE ur.role = 'RENTER' 
  AND ur.is_active = true
  AND ur.user_id NOT IN (SELECT renter_id FROM public.renter_stats WHERE renter_id IS NOT NULL);

-- Specifically ensure the current user has stats (from the console error)
INSERT INTO public.renter_stats (
    renter_id,
    total_bookings,
    completed_bookings,
    cancelled_bookings,
    total_spent,
    average_rating,
    total_reviews,
    calculated_at,
    created_at,
    updated_at,
    favorite_car_types,
    preferred_locations
)
VALUES (
    'c1aa6a36-f420-4007-a6ef-caf56a49289d',
    0,
    0,
    0,
    0,
    0,
    0,
    NOW(),
    NOW(),
    NOW(),
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[]
)
ON CONFLICT (renter_id) DO NOTHING;

-- Update stats based on actual booking data
UPDATE public.renter_stats rs 
SET 
    total_bookings = COALESCE(booking_counts.total, 0),
    completed_bookings = COALESCE(booking_counts.completed, 0),
    cancelled_bookings = COALESCE(booking_counts.cancelled, 0),
    total_spent = COALESCE(booking_totals.spent, 0),
    updated_at = NOW()
FROM (
    SELECT 
        renter_id,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled
    FROM public.bookings
    GROUP BY renter_id
) booking_counts
LEFT JOIN (
    SELECT 
        renter_id,
        SUM(total_amount) as spent
    FROM public.bookings
    WHERE status = 'COMPLETED'
    GROUP BY renter_id
) booking_totals ON booking_totals.renter_id = booking_counts.renter_id
WHERE rs.renter_id = booking_counts.renter_id;

-- Update average ratings from reviews
UPDATE public.renter_stats rs
SET 
    average_rating = COALESCE(review_stats.avg_rating, 0),
    total_reviews = COALESCE(review_stats.review_count, 0),
    updated_at = NOW()
FROM (
    SELECT 
        reviewed_id as renter_id,
        AVG(rating) as avg_rating,
        COUNT(*) as review_count
    FROM public.reviews
    WHERE is_public = true
    GROUP BY reviewed_id
) review_stats
WHERE rs.renter_id = review_stats.renter_id;

-- Verify the initialization
SELECT 
    'Initialization complete' as status,
    COUNT(*) as total_renter_stats_records,
    COUNT(CASE WHEN renter_id = 'c1aa6a36-f420-4007-a6ef-caf56a49289d' THEN 1 END) as current_user_record_exists
FROM public.renter_stats;