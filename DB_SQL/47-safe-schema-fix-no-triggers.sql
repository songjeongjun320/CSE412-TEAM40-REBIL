-- ============================================================================
-- Safe Schema Fix - Disable Triggers and Handle Missing Columns
-- ============================================================================

-- Temporarily disable all triggers to avoid conflicts
SET session_replication_role = replica;

-- ============================================================================
-- 1. Add missing updated_at columns if they don't exist
-- ============================================================================

DO $$
BEGIN
    -- Add updated_at to provinces if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' AND column_name = 'updated_at') THEN
        ALTER TABLE public.indonesian_provinces ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to provinces';
    END IF;
    
    -- Add updated_at to regencies if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'updated_at') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to regencies';
    END IF;
    
    -- Add updated_at to districts if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_districts' AND column_name = 'updated_at') THEN
        ALTER TABLE public.indonesian_districts ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to districts';
    END IF;
    
    -- Add updated_at to villages if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_villages' AND column_name = 'updated_at') THEN
        ALTER TABLE public.indonesian_villages ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to villages';
    END IF;
END $$;

-- ============================================================================
-- 2. Check for and clean up duplicates
-- ============================================================================

DO $$
DECLARE
    duplicate_count INT;
    duplicate_codes TEXT[];
BEGIN
    RAISE NOTICE '=== Checking for Duplicate Codes ===';
    
    -- Check districts for duplicates (the problematic table)
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
        
        -- Delete duplicates keeping the first ID (using text comparison)
        DELETE FROM public.indonesian_districts 
        WHERE id NOT IN (
            SELECT (MIN(id::text))::uuid 
            FROM public.indonesian_districts 
            WHERE code IS NOT NULL
            GROUP BY code
        );
        
        RAISE NOTICE 'Cleaned up duplicate districts';
    ELSE
        RAISE NOTICE 'No duplicate district codes found';
    END IF;
    
    -- Check other tables for duplicates
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT code, COUNT(*) as cnt 
        FROM public.indonesian_provinces 
        GROUP BY code 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        DELETE FROM public.indonesian_provinces 
        WHERE id NOT IN (
            SELECT (MIN(id::text))::uuid 
            FROM public.indonesian_provinces 
            GROUP BY code
        );
        RAISE NOTICE 'Cleaned up duplicate provinces';
    END IF;
    
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT code, COUNT(*) as cnt 
        FROM public.indonesian_regencies 
        WHERE code IS NOT NULL
        GROUP BY code 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        DELETE FROM public.indonesian_regencies 
        WHERE id NOT IN (
            SELECT (MIN(id::text))::uuid 
            FROM public.indonesian_regencies 
            WHERE code IS NOT NULL
            GROUP BY code
        );
        RAISE NOTICE 'Cleaned up duplicate regencies';
    END IF;
    
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT code, COUNT(*) as cnt 
        FROM public.indonesian_villages 
        WHERE code IS NOT NULL
        GROUP BY code 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        DELETE FROM public.indonesian_villages 
        WHERE id NOT IN (
            SELECT (MIN(id::text))::uuid 
            FROM public.indonesian_villages 
            WHERE code IS NOT NULL
            GROUP BY code
        );
        RAISE NOTICE 'Cleaned up duplicate villages';
    END IF;
END $$;

-- ============================================================================
-- 3. Add missing columns safely
-- ============================================================================

DO $$
BEGIN
    -- Add missing columns to provinces
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' AND column_name = 'island_group') THEN
        ALTER TABLE public.indonesian_provinces ADD COLUMN island_group TEXT;
        RAISE NOTICE 'Added island_group column to provinces';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' AND column_name = 'is_special_region') THEN
        ALTER TABLE public.indonesian_provinces ADD COLUMN is_special_region BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_special_region column to provinces';
    END IF;
    
    -- Add missing columns to regencies
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'province_id') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN province_id UUID;
        RAISE NOTICE 'Added province_id column to regencies';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'type') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN type TEXT;
        RAISE NOTICE 'Added type column to regencies';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'is_capital') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN is_capital BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_capital column to regencies';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'is_major_city') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN is_major_city BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_major_city column to regencies';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'population') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN population INTEGER;
        RAISE NOTICE 'Added population column to regencies';
    END IF;
    
    -- Add missing columns to districts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_districts' AND column_name = 'regency_id') THEN
        ALTER TABLE public.indonesian_districts ADD COLUMN regency_id UUID;
        RAISE NOTICE 'Added regency_id column to districts';
    END IF;
    
    -- Add missing columns to villages
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_villages' AND column_name = 'district_id') THEN
        ALTER TABLE public.indonesian_villages ADD COLUMN district_id UUID;
        RAISE NOTICE 'Added district_id column to villages';
    END IF;
END $$;

-- ============================================================================
-- 4. Add UNIQUE constraints safely
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== Adding UNIQUE Constraints ===';
    
    -- Handle null codes first
    UPDATE public.indonesian_regencies SET code = 'TEMP_REG_' || id::text WHERE code IS NULL;
    UPDATE public.indonesian_districts SET code = 'TEMP_DIST_' || id::text WHERE code IS NULL;
    UPDATE public.indonesian_villages SET code = 'TEMP_VILL_' || id::text WHERE code IS NULL;
    
    -- Add unique constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_provinces_code' AND table_name = 'indonesian_provinces') THEN
        ALTER TABLE public.indonesian_provinces ADD CONSTRAINT uk_provinces_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on provinces.code';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_regencies_code' AND table_name = 'indonesian_regencies') THEN
        ALTER TABLE public.indonesian_regencies ADD CONSTRAINT uk_regencies_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on regencies.code';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_districts_code' AND table_name = 'indonesian_districts') THEN
        ALTER TABLE public.indonesian_districts ADD CONSTRAINT uk_districts_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on districts.code';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_villages_code' AND table_name = 'indonesian_villages') THEN
        ALTER TABLE public.indonesian_villages ADD CONSTRAINT uk_villages_code UNIQUE (code);
        RAISE NOTICE 'Added UNIQUE constraint on villages.code';
    END IF;
END $$;

-- ============================================================================
-- 5. Insert/Update sample data safely
-- ============================================================================

-- Insert DKI Jakarta province
INSERT INTO public.indonesian_provinces (id, code, name, island_group, is_special_region)
VALUES (
    '31000000-0000-0000-0000-000000000000',
    '31',
    'DKI Jakarta',
    'Java',
    true
)
ON CONFLICT (code) DO UPDATE SET
    island_group = EXCLUDED.island_group,
    is_special_region = EXCLUDED.is_special_region,
    updated_at = NOW();

-- Insert Jakarta Selatan regency
INSERT INTO public.indonesian_regencies (id, code, name, province_code, province_id, type, is_capital, is_major_city, population)
VALUES (
    '31710000-0000-0000-0000-000000000000',
    '31.71',
    'Jakarta Selatan',
    '31',
    '31000000-0000-0000-0000-000000000000',
    'Kota',
    false,
    true,
    2200000
)
ON CONFLICT (code) DO UPDATE SET
    province_code = EXCLUDED.province_code,
    province_id = EXCLUDED.province_id,
    type = EXCLUDED.type,
    is_major_city = EXCLUDED.is_major_city,
    population = EXCLUDED.population,
    updated_at = NOW();

-- Insert Kebayoran Baru district
INSERT INTO public.indonesian_districts (id, code, name, regency_code, regency_id)
VALUES (
    '31710200-0000-0000-0000-000000000000',
    '31.71.02',
    'Kebayoran Baru',
    '31.71',
    '31710000-0000-0000-0000-000000000000'
)
ON CONFLICT (code) DO UPDATE SET
    regency_code = EXCLUDED.regency_code,
    regency_id = EXCLUDED.regency_id,
    updated_at = NOW();

-- Insert Senayan village
INSERT INTO public.indonesian_villages (id, code, name, district_code, district_id)
VALUES (
    '31710200-1000-0000-0000-000000000000',
    '31.71.02.001',
    'Senayan',
    '31.71.02',
    '31710200-0000-0000-0000-000000000000'
)
ON CONFLICT (code) DO UPDATE SET
    district_code = EXCLUDED.district_code,
    district_id = EXCLUDED.district_id,
    updated_at = NOW();

-- ============================================================================
-- 6. Create indexes
-- ============================================================================

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
-- 7. Create RPC Functions
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
    rows_affected INTEGER;
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
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    IF rows_affected = 0 THEN
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

-- Re-enable triggers
SET session_replication_role = DEFAULT;

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
    
    RAISE NOTICE '=== Schema Fix Complete ===';
END $$;
