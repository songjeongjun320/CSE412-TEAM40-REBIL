-- FORCE DELETE ALL REMAINING TABLES
-- This will aggressively remove everything in public schema

-- First, disable all foreign key constraints to avoid dependency issues
SET session_replication_role = replica;

-- Drop all policies that might be protecting these tables
DROP POLICY IF EXISTS "Enable read access for all users" ON public.car_listings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.car_listings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.trip_photos;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.trip_photos;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.extras;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.extras;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vehicle_images;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.vehicle_images;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vehicle_tracking;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.vehicle_tracking;

-- Drop any other possible policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Re-enable foreign key constraints
SET session_replication_role = DEFAULT;

-- Verification
SELECT 'FORCE DELETE COMPLETE!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;