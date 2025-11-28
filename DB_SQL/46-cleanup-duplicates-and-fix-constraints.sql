-- ============================================================================
-- Cleanup Duplicate Data and Add UNIQUE Constraints Safely
-- ============================================================================

-- First, let's check for duplicates in each table
DO $$
BEGIN
    RAISE NOTICE '=== Checking for Duplicate Codes ===';
END $$;

-- Check and clean up duplicate provinces
DO $$
DECLARE
    duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT code, COUNT(*) as cnt 
        FROM public.indonesian_provinces 
        GROUP BY code 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate province codes', duplicate_count;
        
        -- Keep only the first record for each duplicate code
        DELETE FROM public.indonesian_provinces 
        WHERE id NOT IN (
            SELECT DISTINCT ON (code) id 
            FROM public.indonesian_provinces 
            ORDER BY code, id
        );
        
        RAISE NOTICE 'Cleaned up duplicate provinces';
    ELSE
        RAISE NOTICE 'No duplicate province codes found';
    END IF;
END $$;

-- Check and clean up duplicate regencies
DO $$
DECLARE
    duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT code, COUNT(*) as cnt 
        FROM public.indonesian_regencies 
        WHERE code IS NOT NULL
        GROUP BY code 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate regency codes', duplicate_count;
        
        -- Keep only the first record for each duplicate code
        DELETE FROM public.indonesian_regencies 
        WHERE id NOT IN (
            SELECT DISTINCT ON (code) id 
            FROM public.indonesian_regencies 
            WHERE code IS NOT NULL
            ORDER BY code, id
        );
        
        RAISE NOTICE 'Cleaned up duplicate regencies';
    ELSE
        RAISE NOTICE 'No duplicate regency codes found';
    END IF;
END $$;

-- Check and clean up duplicate districts
DO $$
DECLARE
    duplicate_count INT;
    duplicate_codes TEXT[];
BEGIN
    SELECT COUNT(*), array_agg(code) INTO duplicate_count, duplicate_codes
    FROM (
        SELECT code, COUNT(*) as cnt 
        FROM public.indonesian_districts 
        WHERE code IS NOT NULL
        GROUP BY code 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate district codes: %', duplicate_count, duplicate_codes;
        
        -- Keep only the first record for each duplicate code
        DELETE FROM public.indonesian_districts 
        WHERE id NOT IN (
            SELECT DISTINCT ON (code) id 
            FROM public.indonesian_districts 
            WHERE code IS NOT NULL
            ORDER BY code, id
        );
        
        RAISE NOTICE 'Cleaned up duplicate districts';
    ELSE
        RAISE NOTICE 'No duplicate district codes found';
    END IF;
END $$;

-- Check and clean up duplicate villages
DO $$
DECLARE
    duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT code, COUNT(*) as cnt 
        FROM public.indonesian_villages 
        WHERE code IS NOT NULL
        GROUP BY code 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate village codes', duplicate_count;
        
        -- Keep only the first record for each duplicate code
        DELETE FROM public.indonesian_villages 
        WHERE id NOT IN (
            SELECT DISTINCT ON (code) id 
            FROM public.indonesian_villages 
            WHERE code IS NOT NULL
            ORDER BY code, id
        );
        
        RAISE NOTICE 'Cleaned up duplicate villages';
    ELSE
        RAISE NOTICE 'No duplicate village codes found';
    END IF;
END $$;

-- ============================================================================
-- Add missing columns safely
-- ============================================================================

-- Add missing columns to provinces if they don't exist
DO $$
BEGIN
    -- Add island_group column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' AND column_name = 'island_group') THEN
        ALTER TABLE public.indonesian_provinces ADD COLUMN island_group TEXT;
        RAISE NOTICE 'Added island_group column to provinces';
    END IF;
    
    -- Add is_special_region column if not exists  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' AND column_name = 'is_special_region') THEN
        ALTER TABLE public.indonesian_provinces ADD COLUMN is_special_region BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_special_region column to provinces';
    END IF;
END $$;

-- Add missing columns to regencies if they don't exist
DO $$
BEGIN
    -- Add province_id column if not exists (UUID reference)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'province_id') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN province_id UUID;
        RAISE NOTICE 'Added province_id column to regencies';
    END IF;
    
    -- Add type column if not exists (Kota/Kabupaten)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'type') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN type TEXT;
        RAISE NOTICE 'Added type column to regencies';
    END IF;
    
    -- Add is_capital column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'is_capital') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN is_capital BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_capital column to regencies';
    END IF;
    
    -- Add is_major_city column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'is_major_city') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN is_major_city BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_major_city column to regencies';
    END IF;
    
    -- Add population column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'population') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN population INTEGER;
        RAISE NOTICE 'Added population column to regencies';
    END IF;
END $$;

-- Add missing columns to districts if they don't exist
DO $$
BEGIN
    -- Add regency_id column if not exists (UUID reference)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_districts' AND column_name = 'regency_id') THEN
        ALTER TABLE public.indonesian_districts ADD COLUMN regency_id UUID;
        RAISE NOTICE 'Added regency_id column to districts';
    END IF;
END $$;

-- Add missing columns to villages if they don't exist
DO $$
BEGIN
    -- Add district_id column if not exists (UUID reference)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_villages' AND column_name = 'district_id') THEN
        ALTER TABLE public.indonesian_villages ADD COLUMN district_id UUID;
        RAISE NOTICE 'Added district_id column to villages';
    END IF;
END $$;

-- ============================================================================
-- Now safely add UNIQUE constraints
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== Adding UNIQUE Constraints ===';
    
    -- Add unique constraint on provinces.code if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_provinces_code' AND table_name = 'indonesian_provinces') THEN
        ALTER TABLE public.indonesian_provinces ADD CONSTRAINT uk_provinces_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on provinces.code';
    ELSE
        RAISE NOTICE 'UNIQUE constraint on provinces.code already exists';
    END IF;
    
    -- Add unique constraint on regencies.code if not exists (only for non-null codes)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_regencies_code' AND table_name = 'indonesian_regencies') THEN
        -- First, update any null codes to a temporary value to avoid constraint issues
        UPDATE public.indonesian_regencies SET code = 'TEMP_' || id::text WHERE code IS NULL;
        
        ALTER TABLE public.indonesian_regencies ADD CONSTRAINT uk_regencies_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on regencies.code';
    ELSE
        RAISE NOTICE 'UNIQUE constraint on regencies.code already exists';
    END IF;
    
    -- Add unique constraint on districts.code if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_districts_code' AND table_name = 'indonesian_districts') THEN
        -- First, update any null codes to a temporary value
        UPDATE public.indonesian_districts SET code = 'TEMP_' || id::text WHERE code IS NULL;
        
        ALTER TABLE public.indonesian_districts ADD CONSTRAINT uk_districts_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on districts.code';
    ELSE
        RAISE NOTICE 'UNIQUE constraint on districts.code already exists';
    END IF;
    
    -- Add unique constraint on villages.code if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_villages_code' AND table_name = 'indonesian_villages') THEN
        -- First, update any null codes to a temporary value
        UPDATE public.indonesian_villages SET code = 'TEMP_' || id::text WHERE code IS NULL;
        
        ALTER TABLE public.indonesian_villages ADD CONSTRAINT uk_villages_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on villages.code';
    ELSE
        RAISE NOTICE 'UNIQUE constraint on villages.code already exists';
    END IF;
END $$;

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

-- Indexes on code columns for fast lookups
CREATE INDEX IF NOT EXISTS idx_provinces_code ON public.indonesian_provinces(code);
CREATE INDEX IF NOT EXISTS idx_regencies_code ON public.indonesian_regencies(code);
CREATE INDEX IF NOT EXISTS idx_regencies_province_code ON public.indonesian_regencies(province_code);
CREATE INDEX IF NOT EXISTS idx_regencies_province_id ON public.indonesian_regencies(province_id);
CREATE INDEX IF NOT EXISTS idx_districts_code ON public.indonesian_districts(code);
CREATE INDEX IF NOT EXISTS idx_districts_regency_code ON public.indonesian_districts(regency_code);
CREATE INDEX IF NOT EXISTS idx_districts_regency_id ON public.indonesian_districts(regency_id);
CREATE INDEX IF NOT EXISTS idx_villages_code ON public.indonesian_villages(code);
CREATE INDEX IF NOT EXISTS idx_villages_district_code ON public.indonesian_villages(district_code);
CREATE INDEX IF NOT EXISTS idx_villages_district_id ON public.indonesian_villages(district_id);

-- ============================================================================
-- Insert sample data safely
-- ============================================================================

-- Insert DKI Jakarta province if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.indonesian_provinces WHERE code = '31') THEN
        INSERT INTO public.indonesian_provinces (id, code, name, island_group, is_special_region)
        VALUES (
            '31000000-0000-0000-0000-000000000000',
            '31',
            'DKI Jakarta',
            'Java',
            true
        );
        RAISE NOTICE 'Inserted DKI Jakarta province';
    ELSE
        -- Update existing record
        UPDATE public.indonesian_provinces 
        SET island_group = 'Java', is_special_region = true 
        WHERE code = '31';
        RAISE NOTICE 'Updated DKI Jakarta province';
    END IF;
END $$;

-- Insert Jakarta Selatan regency if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.indonesian_regencies WHERE code = '31.71') THEN
        INSERT INTO public.indonesian_regencies (id, code, name, province_code, province_id, type, is_capital, is_major_city, population)
        VALUES (
            '31710000-0000-0000-0000-000000000000',
            '31.71',
            'Jakarta Selatan',
            '31',
            (SELECT id FROM public.indonesian_provinces WHERE code = '31'),
            'Kota',
            false,
            true,
            2200000
        );
        RAISE NOTICE 'Inserted Jakarta Selatan regency';
    ELSE
        -- Update existing record
        UPDATE public.indonesian_regencies 
        SET province_code = '31', 
            province_id = (SELECT id FROM public.indonesian_provinces WHERE code = '31'),
            type = 'Kota',
            is_major_city = true,
            population = 2200000
        WHERE code = '31.71';
        RAISE NOTICE 'Updated Jakarta Selatan regency';
    END IF;
END $$;

-- Insert Kebayoran Baru district if not exists  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.indonesian_districts WHERE code = '31.71.02') THEN
        INSERT INTO public.indonesian_districts (id, code, name, regency_code, regency_id)
        VALUES (
            '31710200-0000-0000-0000-000000000000',
            '31.71.02',
            'Kebayoran Baru',
            '31.71',
            (SELECT id FROM public.indonesian_regencies WHERE code = '31.71')
        );
        RAISE NOTICE 'Inserted Kebayoran Baru district';
    ELSE
        -- Update existing record
        UPDATE public.indonesian_districts 
        SET regency_code = '31.71',
            regency_id = (SELECT id FROM public.indonesian_regencies WHERE code = '31.71')
        WHERE code = '31.71.02';
        RAISE NOTICE 'Updated Kebayoran Baru district';
    END IF;
END $$;

-- Insert Senayan village if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.indonesian_villages WHERE code = '31.71.02.001') THEN
        INSERT INTO public.indonesian_villages (id, code, name, district_code, district_id)
        VALUES (
            '31710200-1000-0000-0000-000000000000',
            '31.71.02.001',
            'Senayan',
            '31.71.02',
            (SELECT id FROM public.indonesian_districts WHERE code = '31.71.02')
        );
        RAISE NOTICE 'Inserted Senayan village';
    ELSE
        -- Update existing record
        UPDATE public.indonesian_villages 
        SET district_code = '31.71.02',
            district_id = (SELECT id FROM public.indonesian_districts WHERE code = '31.71.02')
        WHERE code = '31.71.02.001';
        RAISE NOTICE 'Updated Senayan village';
    END IF;
END $$;

-- ============================================================================
-- Create RPC Functions
-- ============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_provinces_dropdown();
DROP FUNCTION IF EXISTS public.get_cities_by_province(TEXT);
DROP FUNCTION IF EXISTS public.update_car_status_by_host(UUID, UUID, TEXT);

-- Get provinces dropdown
CREATE OR REPLACE FUNCTION public.get_provinces_dropdown()
RETURNS TABLE (
    id TEXT,
    name TEXT,
    code TEXT,
    island_group TEXT,
    is_special_region BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        p.id::TEXT,
        p.name,
        p.code,
        COALESCE(p.island_group, 'Unknown') as island_group,
        COALESCE(p.is_special_region, false) as is_special_region
    FROM public.indonesian_provinces p
    WHERE p.name IS NOT NULL AND p.code IS NOT NULL
    ORDER BY p.name
    LIMIT 100;
$$;

-- Get regencies/cities by province
CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    type TEXT,
    is_capital BOOLEAN,
    is_major_city BOOLEAN,
    population INTEGER
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        r.id::TEXT,
        r.name,
        COALESCE(r.type, 'Regency') as type,
        COALESCE(r.is_capital, false) as is_capital,
        COALESCE(r.is_major_city, false) as is_major_city,
        r.population
    FROM public.indonesian_regencies r
    WHERE 
        r.name IS NOT NULL 
        AND r.code IS NOT NULL
        AND (
            province_identifier IS NULL 
            OR r.province_code = province_identifier 
            OR EXISTS (
                SELECT 1 FROM public.indonesian_provinces p 
                WHERE p.id::TEXT = province_identifier AND r.province_id = p.id
            )
        )
    ORDER BY r.name
    LIMIT 1000;
$$;

-- Create the update_car_status_by_host function
CREATE OR REPLACE FUNCTION public.update_car_status_by_host(
    host_user_id UUID,
    car_uuid UUID,
    new_status TEXT
)
RETURNS JSON AS $$
DECLARE
    car_record RECORD;
    status_enum car_status;
BEGIN
    -- Log function call
    RAISE LOG 'update_car_status_by_host: host_user_id=%, car_uuid=%, new_status=%', 
        host_user_id, car_uuid, new_status;
    
    -- Check if user owns this car
    SELECT * INTO car_record 
    FROM public.cars 
    WHERE id = car_uuid 
    AND host_id = host_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Car not found or you do not have permission to modify it',
            'error_code', 'CAR_NOT_FOUND'
        );
    END IF;
    
    -- Validate and convert status
    BEGIN
        status_enum := new_status::car_status;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Invalid status: ' || new_status,
                'error_code', 'INVALID_STATUS'
            );
    END;
    
    -- Update car status
    UPDATE public.cars 
    SET status = status_enum, updated_at = NOW()
    WHERE id = car_uuid AND host_id = host_user_id;
    
    GET DIAGNOSTICS ROWCOUNT = ROW_COUNT;
    
    IF ROW_COUNT = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to update car status',
            'error_code', 'UPDATE_FAILED'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Car status updated successfully',
        'old_status', car_record.status,
        'new_status', new_status,
        'updated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_provinces_dropdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_car_status_by_host(UUID, UUID, TEXT) TO authenticated;

-- Final verification
DO $$
DECLARE
    test_result JSON;
    province_count INT;
    regency_count INT;
BEGIN
    RAISE NOTICE '=== Final Verification ===';
    
    -- Test provinces
    SELECT COUNT(*) INTO province_count FROM public.get_provinces_dropdown();
    RAISE NOTICE '✅ Provinces available: %', province_count;
    
    -- Test regencies for DKI Jakarta (code 31)
    SELECT COUNT(*) INTO regency_count FROM public.get_cities_by_province('31');
    RAISE NOTICE '✅ Regencies in DKI Jakarta: %', regency_count;
    
    -- Test car status update function
    SELECT public.update_car_status_by_host(
        '00000000-0000-0000-0000-000000000000'::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID,
        'DRAFT'
    ) INTO test_result;
    
    IF test_result->>'error_code' = 'CAR_NOT_FOUND' THEN
        RAISE NOTICE '✅ update_car_status_by_host function working correctly';
    ELSE
        RAISE NOTICE '⚠️ Unexpected result: %', test_result;
    END IF;
    
    RAISE NOTICE '=== Indonesian Address Schema Fix Complete ===';
END $$;
