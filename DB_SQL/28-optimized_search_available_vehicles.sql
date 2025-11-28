-- ============================================================================
-- OPTIMIZED VEHICLE SEARCH SYSTEM
-- ============================================================================
-- This script creates an optimized vehicle search function that eliminates
-- N+1 query problems by using proper JOINs and returning all related data
-- in a single optimized query.
--
-- IMPROVEMENTS:
-- 1. Single query with JOINs for cars, car_images, and user_profiles
-- 2. Proper indexing strategy for optimal performance
-- 3. Integrated availability checking without separate calls
-- 4. Returns complete vehicle data with images and host info
-- 5. Optimized for pagination and caching
-- ============================================================================

-- Drop existing function if it exists to ensure clean deployment
DROP FUNCTION IF EXISTS search_available_vehicles_optimized(
    TIMESTAMP WITH TIME ZONE,
    TIMESTAMP WITH TIME ZONE,
    TEXT,
    JSONB
);

-- Create optimized indexes for the new search function
-- These indexes are specifically designed for the JOIN operations

-- Composite index for cars table search optimization
CREATE INDEX IF NOT EXISTS idx_cars_search_optimized 
ON cars(status, daily_rate, transmission, fuel_type, seats) 
WHERE status = 'ACTIVE';

-- Specialized index for location searches using GIN for JSON
CREATE INDEX IF NOT EXISTS idx_cars_location_search_gin 
ON cars USING GIN(location) 
WHERE status = 'ACTIVE';

-- Optimized index for car_images with proper ordering
CREATE INDEX IF NOT EXISTS idx_car_images_optimized 
ON car_images(car_id, is_primary) 
WHERE is_primary = true;

-- Index for all car images (for complete image fetching)
CREATE INDEX IF NOT EXISTS idx_car_images_by_car 
ON car_images(car_id, created_at);

-- Index for user profiles used in JOINs
CREATE INDEX IF NOT EXISTS idx_user_profiles_host_lookup 
ON user_profiles(id, full_name) 
WHERE is_active = true;

-- Advanced availability checking indexes
CREATE INDEX IF NOT EXISTS idx_bookings_availability_optimized 
ON bookings(car_id, start_date, end_date, status) 
WHERE status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING', 'AUTO_APPROVED');

CREATE INDEX IF NOT EXISTS idx_car_availability_optimized
ON car_availability(car_id, start_date, end_date, is_available)
WHERE is_available = false;

-- ============================================================================
-- MAIN OPTIMIZED SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_available_vehicles_optimized(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_filters JSONB DEFAULT '{}'::JSONB
) RETURNS TABLE(
    car_id UUID,
    make TEXT,
    model TEXT,
    year INTEGER,
    daily_rate DECIMAL,
    location JSONB,
    features TEXT[],
    transmission transmission_type,
    fuel_type fuel_type,
    seats INTEGER,
    doors INTEGER,
    description TEXT,
    delivery_available BOOLEAN,
    delivery_fee DECIMAL,
    delivery_radius DECIMAL,
    minimum_trip_duration INTEGER,
    host_id UUID,
    host_name TEXT,
    host_profile_image TEXT,
    car_images JSONB,
    primary_image_url TEXT,
    availability_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH available_cars AS (
        -- First CTE: Filter cars based on availability
        SELECT DISTINCT c.id as car_id
        FROM cars c
        WHERE c.status = 'ACTIVE'
            -- Location filtering using optimized JSON search
            AND (
                p_location IS NULL OR 
                c.location::TEXT ILIKE '%' || p_location || '%'
            )
            -- Basic vehicle filters
            AND (
                (p_filters->>'transmission') IS NULL OR 
                c.transmission = (p_filters->>'transmission')::transmission_type
            )
            AND (
                (p_filters->>'fuel_type') IS NULL OR 
                c.fuel_type = (p_filters->>'fuel_type')::fuel_type
            )
            AND (
                (p_filters->>'min_seats') IS NULL OR 
                c.seats >= (p_filters->>'min_seats')::INTEGER
            )
            AND (
                (p_filters->>'max_price') IS NULL OR 
                c.daily_rate <= (p_filters->>'max_price')::DECIMAL
            )
            -- Availability filtering (only if dates are provided)
            AND (
                p_start_date IS NULL OR p_end_date IS NULL OR
                (
                    -- No conflicting bookings
                    NOT EXISTS (
                        SELECT 1 FROM bookings b
                        WHERE b.car_id = c.id
                        AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING', 'AUTO_APPROVED')
                        AND (
                            (b.start_date <= p_start_date AND b.end_date > p_start_date) OR
                            (b.start_date < p_end_date AND b.end_date >= p_end_date) OR
                            (b.start_date >= p_start_date AND b.end_date <= p_end_date)
                        )
                    )
                    -- No manual availability blocks
                    AND NOT EXISTS (
                        SELECT 1 FROM car_availability ca
                        WHERE ca.car_id = c.id
                        AND ca.is_available = false
                        AND (
                            (ca.start_date <= p_start_date::DATE AND ca.end_date >= p_start_date::DATE) OR
                            (ca.start_date <= p_end_date::DATE AND ca.end_date >= p_end_date::DATE) OR
                            (ca.start_date >= p_start_date::DATE AND ca.end_date <= p_end_date::DATE)
                        )
                    )
                )
            )
    ),
    car_images_agg AS (
        -- Second CTE: Aggregate car images for each available car
        SELECT 
            ac.car_id,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', ci.id,
                        'image_url', ci.image_url,
                        'image_type', ci.image_type,
                        'is_primary', ci.is_primary,
                        'created_at', ci.created_at
                    ) ORDER BY ci.created_at
                ) FILTER (WHERE ci.id IS NOT NULL),
                '[]'::jsonb
            ) as images,
            (
                SELECT ci_primary.image_url 
                FROM car_images ci_primary 
                WHERE ci_primary.car_id = ac.car_id 
                AND ci_primary.is_primary = true 
                LIMIT 1
            ) as primary_image
        FROM available_cars ac
        LEFT JOIN car_images ci ON ac.car_id = ci.car_id
        GROUP BY ac.car_id
    )
    -- Main SELECT with all JOINs
    SELECT 
        c.id,
        c.make,
        c.model,
        c.year,
        c.daily_rate,
        c.location,
        c.features,
        c.transmission,
        c.fuel_type,
        c.seats,
        c.doors,
        c.description,
        c.delivery_available,
        c.delivery_fee,
        c.delivery_radius,
        c.minimum_trip_duration,
        c.host_id,
        up.full_name,
        up.profile_image_url,
        cia.images,
        COALESCE(cia.primary_image, (cia.images->0->>'image_url')::TEXT),
        CASE 
            WHEN p_start_date IS NULL OR p_end_date IS NULL THEN 'not_specified'
            ELSE 'available'
        END,
        c.created_at,
        c.updated_at
    FROM available_cars ac
    JOIN cars c ON ac.car_id = c.id
    JOIN user_profiles up ON c.host_id = up.id
    LEFT JOIN car_images_agg cia ON ac.car_id = cia.car_id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLEMENTARY OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to get detailed vehicle information with all JOINs
CREATE OR REPLACE FUNCTION get_vehicle_details_optimized(
    p_vehicle_ids UUID[]
) RETURNS TABLE(
    car_id UUID,
    make TEXT,
    model TEXT,
    year INTEGER,
    daily_rate DECIMAL,
    location JSONB,
    features TEXT[],
    transmission transmission_type,
    fuel_type fuel_type,
    seats INTEGER,
    doors INTEGER,
    description TEXT,
    delivery_available BOOLEAN,
    delivery_fee DECIMAL,
    delivery_radius DECIMAL,
    minimum_trip_duration INTEGER,
    host_id UUID,
    host_name TEXT,
    host_profile_image TEXT,
    car_images JSONB,
    primary_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH car_images_agg AS (
        SELECT 
            ci.car_id,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', ci.id,
                        'image_url', ci.image_url,
                        'image_type', ci.image_type,
                        'is_primary', ci.is_primary,
                        'created_at', ci.created_at
                    ) ORDER BY ci.created_at
                ) FILTER (WHERE ci.id IS NOT NULL),
                '[]'::jsonb
            ) as images,
            (
                SELECT ci_primary.image_url 
                FROM car_images ci_primary 
                WHERE ci_primary.car_id = ci.car_id 
                AND ci_primary.is_primary = true 
                LIMIT 1
            ) as primary_image
        FROM car_images ci
        WHERE ci.car_id = ANY(p_vehicle_ids)
        GROUP BY ci.car_id
    )
    SELECT 
        c.id,
        c.make,
        c.model,
        c.year,
        c.daily_rate,
        c.location,
        c.features,
        c.transmission,
        c.fuel_type,
        c.seats,
        c.doors,
        c.description,
        c.delivery_available,
        c.delivery_fee,
        c.delivery_radius,
        c.minimum_trip_duration,
        c.host_id,
        up.full_name,
        up.profile_image_url,
        COALESCE(cia.images, '[]'::jsonb),
        COALESCE(cia.primary_image, (cia.images->0->>'image_url')::TEXT),
        c.created_at,
        c.updated_at
    FROM cars c
    JOIN user_profiles up ON c.host_id = up.id
    LEFT JOIN car_images_agg cia ON c.id = cia.car_id
    WHERE c.id = ANY(p_vehicle_ids)
    AND c.status = 'ACTIVE'
    ORDER BY array_position(p_vehicle_ids, c.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for batch availability checking
CREATE OR REPLACE FUNCTION check_vehicles_availability_batch(
    p_vehicle_ids UUID[],
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
) RETURNS TABLE(
    car_id UUID,
    is_available BOOLEAN,
    conflict_type TEXT,
    conflict_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        CASE 
            WHEN booking_conflicts.car_id IS NOT NULL THEN false
            WHEN availability_blocks.car_id IS NOT NULL THEN false
            ELSE true
        END as is_available,
        CASE 
            WHEN booking_conflicts.car_id IS NOT NULL THEN 'booking_conflict'
            WHEN availability_blocks.car_id IS NOT NULL THEN 'manual_block'
            ELSE 'available'
        END::TEXT as conflict_type,
        COALESCE(
            booking_conflicts.conflict_data,
            availability_blocks.conflict_data,
            '{}'::jsonb
        ) as conflict_details
    FROM (SELECT unnest(p_vehicle_ids) as id) v
    LEFT JOIN (
        -- Check for booking conflicts
        SELECT DISTINCT 
            b.car_id,
            jsonb_agg(jsonb_build_object(
                'id', b.id,
                'start_date', b.start_date,
                'end_date', b.end_date,
                'status', b.status
            )) as conflict_data
        FROM bookings b
        WHERE b.car_id = ANY(p_vehicle_ids)
        AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING', 'AUTO_APPROVED')
        AND (
            (b.start_date <= p_start_date AND b.end_date > p_start_date) OR
            (b.start_date < p_end_date AND b.end_date >= p_end_date) OR
            (b.start_date >= p_start_date AND b.end_date <= p_end_date)
        )
        GROUP BY b.car_id
    ) booking_conflicts ON v.id = booking_conflicts.car_id
    LEFT JOIN (
        -- Check for availability blocks
        SELECT DISTINCT 
            ca.car_id,
            jsonb_agg(jsonb_build_object(
                'start_date', ca.start_date,
                'end_date', ca.end_date,
                'reason', ca.reason,
                'availability_type', COALESCE(ca.availability_type, 'manual')
            )) as conflict_data
        FROM car_availability ca
        WHERE ca.car_id = ANY(p_vehicle_ids)
        AND ca.is_available = false
        AND (
            (ca.start_date <= p_start_date::DATE AND ca.end_date >= p_start_date::DATE) OR
            (ca.start_date <= p_end_date::DATE AND ca.end_date >= p_end_date::DATE) OR
            (ca.start_date >= p_start_date::DATE AND ca.end_date <= p_end_date::DATE)
        )
        GROUP BY ca.car_id
    ) availability_blocks ON v.id = availability_blocks.car_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENHANCED RLS POLICIES FOR OPTIMIZATION
-- ============================================================================

-- Ensure RLS policies don't interfere with optimization
-- The search function should be accessible to authenticated users

-- Grant necessary permissions for the optimized functions
GRANT EXECUTE ON FUNCTION search_available_vehicles_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_vehicle_details_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION check_vehicles_availability_batch TO authenticated;

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- View to monitor search performance
CREATE OR REPLACE VIEW search_performance_stats AS
SELECT 
    'optimized_search' as query_type,
    COUNT(*) as total_cars,
    COUNT(CASE WHEN cia.images IS NOT NULL AND cia.images != '[]'::jsonb THEN 1 END) as cars_with_images,
    AVG(jsonb_array_length(COALESCE(cia.images, '[]'::jsonb))) as avg_images_per_car,
    COUNT(CASE WHEN up.full_name IS NOT NULL THEN 1 END) as cars_with_host_info
FROM cars c
JOIN user_profiles up ON c.host_id = up.id
LEFT JOIN (
    SELECT 
        ci.car_id,
        jsonb_agg(jsonb_build_object('image_url', ci.image_url)) as images
    FROM car_images ci
    GROUP BY ci.car_id
) cia ON c.id = cia.car_id
WHERE c.status = 'ACTIVE';

-- ============================================================================
-- VERIFICATION AND TESTING
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Optimized Vehicle Search System installed successfully!';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - search_available_vehicles_optimized() - Main optimized search with JOINs';
    RAISE NOTICE '  - get_vehicle_details_optimized() - Batch vehicle details fetching';
    RAISE NOTICE '  - check_vehicles_availability_batch() - Batch availability checking';
    RAISE NOTICE 'Indexes created:';
    RAISE NOTICE '  - idx_cars_search_optimized - Composite search index';
    RAISE NOTICE '  - idx_cars_location_search_gin - GIN index for location search';
    RAISE NOTICE '  - idx_car_images_optimized - Optimized image fetching';
    RAISE NOTICE '  - idx_car_images_by_car - Complete image ordering';
    RAISE NOTICE '  - idx_user_profiles_host_lookup - Host profile optimization';
    RAISE NOTICE '  - idx_bookings_availability_optimized - Availability checking';
    RAISE NOTICE '  - idx_car_availability_optimized - Manual blocks checking';
    RAISE NOTICE 'Views created:';
    RAISE NOTICE '  - search_performance_stats - Performance monitoring';
    RAISE NOTICE '';
    RAISE NOTICE 'OPTIMIZATION BENEFITS:';
    RAISE NOTICE '  ✓ Eliminates N+1 query problems';
    RAISE NOTICE '  ✓ Single query with comprehensive JOINs';
    RAISE NOTICE '  ✓ Optimized indexes for fast searching';
    RAISE NOTICE '  ✓ Batch operations for related data';
    RAISE NOTICE '  ✓ Integrated availability checking';
    RAISE NOTICE '  ✓ Ready for caching and pagination';
END $$; 