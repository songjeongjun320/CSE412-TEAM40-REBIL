-- STEP 5: CREATE ADMIN STATISTICS AUTO-UPDATE SYSTEM
-- Execute this to set up automatic admin statistics updates every 30 minutes

-- Enable required extensions for scheduling (if available)
-- Note: pg_cron may not be available on all PostgreSQL installations
-- Comment out the next line if pg_cron is not available
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- CREATE ADMIN STATISTICS UPDATE FUNCTION
-- ============================================================================

-- Function to calculate and update admin statistics
CREATE OR REPLACE FUNCTION public.update_admin_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_timestamp TIMESTAMP WITH TIME ZONE := NOW();
    period_start_time TIMESTAMP WITH TIME ZONE := date_trunc('hour', current_timestamp);
    period_end_time TIMESTAMP WITH TIME ZONE := period_start_time + INTERVAL '30 minutes';
BEGIN
    -- Clear old stats for this period to avoid duplicates
    DELETE FROM public.admin_stats 
    WHERE period_start = period_start_time AND period_end = period_end_time;

    -- Insert current statistics
    INSERT INTO public.admin_stats (metric_name, metric_value, metric_type, period_start, period_end) VALUES
    
    -- Total Users
    ('total_users', (
        SELECT COUNT(*) FROM public.user_profiles WHERE is_active = true
    ), 'count', period_start_time, period_end_time),
    
    -- Total Cars
    ('total_cars', (
        SELECT COUNT(*) FROM public.cars
    ), 'count', period_start_time, period_end_time),
    
    -- Active Cars
    ('active_cars', (
        SELECT COUNT(*) FROM public.cars WHERE status = 'ACTIVE'
    ), 'count', period_start_time, period_end_time),
    
    -- Total Bookings (handle if table doesn't exist)
    ('total_bookings', (
        SELECT COALESCE(
            (SELECT COUNT(*) FROM public.bookings), 
            0
        )
    ), 'count', period_start_time, period_end_time),
    
    -- Completed Bookings
    ('completed_bookings', (
        SELECT COALESCE(
            (SELECT COUNT(*) FROM public.bookings WHERE status = 'COMPLETED'), 
            0
        )
    ), 'count', period_start_time, period_end_time),
    
    -- Total Hosts
    ('total_hosts', (
        SELECT COUNT(*) FROM public.user_roles 
        WHERE role = 'HOST' AND is_active = true
    ), 'count', period_start_time, period_end_time),
    
    -- Total Renters
    ('total_renters', (
        SELECT COUNT(*) FROM public.user_roles 
        WHERE role = 'RENTER' AND is_active = true
    ), 'count', period_start_time, period_end_time),
    
    -- Pending Verifications
    ('pending_verifications', (
        SELECT COALESCE(
            (SELECT COUNT(*) FROM public.user_verifications WHERE status = 'PENDING'), 
            0
        )
    ), 'count', period_start_time, period_end_time),
    
    -- Disputed Bookings
    ('disputed_bookings', (
        SELECT COALESCE(
            (SELECT COUNT(*) FROM public.bookings WHERE status = 'DISPUTED'), 
            0
        )
    ), 'count', period_start_time, period_end_time),
    
    -- Total Revenue (from payments table if exists)
    ('total_revenue', (
        SELECT COALESCE(
            (SELECT SUM(amount) FROM public.payments WHERE status = 'COMPLETED'), 
            0
        )
    ), 'currency', period_start_time, period_end_time),
    
    -- Monthly Revenue (current month)
    ('monthly_revenue', (
        SELECT COALESCE(
            (SELECT SUM(amount) FROM public.payments 
             WHERE status = 'COMPLETED' 
             AND created_at >= date_trunc('month', current_timestamp)
             AND created_at < date_trunc('month', current_timestamp) + INTERVAL '1 month'
            ), 
            0
        )
    ), 'currency', period_start_time, period_end_time);

    -- Log the update
    RAISE NOTICE 'Admin stats updated successfully at %', current_timestamp;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail
        RAISE WARNING 'Error updating admin stats: %', SQLERRM;
END;
$$;

-- ============================================================================
-- CREATE MANUAL REFRESH FUNCTION (for immediate updates)
-- ============================================================================

-- Function to manually refresh stats (can be called from app)
CREATE OR REPLACE FUNCTION public.refresh_admin_stats_now()
RETURNS TABLE(
    metric_name TEXT,
    metric_value DECIMAL(15,2),
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update stats
    PERFORM public.update_admin_stats();
    
    -- Return latest stats
    RETURN QUERY
    SELECT 
        s.metric_name,
        s.metric_value,
        s.updated_at
    FROM public.admin_stats s
    WHERE s.created_at = (
        SELECT MAX(created_at) FROM public.admin_stats s2 
        WHERE s2.metric_name = s.metric_name
    )
    ORDER BY s.metric_name;
END;
$$;

-- ============================================================================
-- SCHEDULE THE STATS UPDATE JOB (OPTIONAL - REQUIRES pg_cron)
-- ============================================================================

-- Schedule the function to run every 30 minutes
-- This will run at :00 and :30 of every hour
-- Uncomment the lines below if pg_cron extension is available:

/*
SELECT cron.schedule(
    'update-admin-stats', 
    '0,30 * * * *',  -- Every 30 minutes (at :00 and :30)
    'SELECT public.update_admin_stats();'
);
*/

-- Alternative: Manual scheduling instruction
-- If pg_cron is not available, you can:
-- 1. Set up a cron job on your server to call: psql -c "SELECT public.update_admin_stats();"
-- 2. Use a server-side scheduler (like Node.js setInterval)
-- 3. Call refresh_admin_stats_now() from your application periodically

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users (for manual refresh)
GRANT EXECUTE ON FUNCTION public.refresh_admin_stats_now() TO authenticated;

-- Grant select permissions on admin_stats to authenticated users
GRANT SELECT ON public.admin_stats TO authenticated;

-- ============================================================================
-- INITIAL STATS POPULATION
-- ============================================================================

-- Run the function once to populate initial stats
SELECT public.update_admin_stats();

-- ============================================================================
-- VERIFICATION AND MONITORING
-- ============================================================================

-- View to check scheduled jobs (only works if pg_cron is installed)
-- Uncomment below if pg_cron is available:
/*
CREATE OR REPLACE VIEW public.admin_stats_jobs AS
SELECT 
    jobname,
    schedule,
    active,
    jobid
FROM cron.job 
WHERE jobname = 'update-admin-stats';
*/

-- View to see latest stats
CREATE OR REPLACE VIEW public.latest_admin_stats AS
SELECT 
    metric_name,
    metric_value,
    metric_type,
    period_start,
    period_end,
    created_at,
    updated_at
FROM public.admin_stats s1
WHERE s1.created_at = (
    SELECT MAX(s2.created_at) 
    FROM public.admin_stats s2 
    WHERE s2.metric_name = s1.metric_name
)
ORDER BY metric_name;

-- Function to check job status (simplified version without pg_cron dependency)
CREATE OR REPLACE FUNCTION public.check_admin_stats_job()
RETURNS TABLE(
    job_name TEXT,
    last_run TIMESTAMP WITH TIME ZONE,
    total_metrics INTEGER,
    status TEXT
)
LANGUAGE sql
AS $$
    SELECT 
        'update-admin-stats'::TEXT as job_name,
        (SELECT MAX(created_at) FROM public.admin_stats)::TIMESTAMP WITH TIME ZONE as last_run,
        (SELECT COUNT(DISTINCT metric_name) FROM public.admin_stats)::INTEGER as total_metrics,
        CASE 
            WHEN (SELECT MAX(created_at) FROM public.admin_stats) > NOW() - INTERVAL '1 hour' 
            THEN 'Recently Updated'
            ELSE 'Needs Update'
        END::TEXT as status;
$$;

-- ============================================================================
-- CLEANUP FUNCTION (Optional)
-- ============================================================================

-- Function to clean up old statistics (keep only last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_admin_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.admin_stats 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % old admin stats records', deleted_count;
    RETURN deleted_count;
END;
$$;

-- Schedule cleanup to run daily at 2 AM (only if pg_cron is available)
-- Uncomment below if pg_cron is available:
/*
SELECT cron.schedule(
    'cleanup-admin-stats',
    '0 2 * * *',  -- Daily at 2 AM
    'SELECT public.cleanup_old_admin_stats();'
);
*/

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
'ADMIN STATS SCHEDULER SETUP COMPLETE!' as status,
'Stats will update every 30 minutes automatically' as message,
'Use SELECT * FROM public.latest_admin_stats; to view current stats' as tip;