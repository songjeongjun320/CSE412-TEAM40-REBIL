-- ============================================================================
-- Fix Indonesian Address Schema - Add Missing Columns and Relationships
-- ============================================================================

-- Add missing columns to support hierarchical structure
-- Expected code format: 11, 11.01, 11.01.01, 11.01.01.001

-- ============================================================================
-- 1. Fix Indonesian Provinces Table
-- ============================================================================

-- Add missing columns to provinces if they don't exist
DO $$
BEGIN
    -- Add island_group column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' AND column_name = 'island_group') THEN
        ALTER TABLE public.indonesian_provinces ADD COLUMN island_group TEXT;
    END IF;
    
    -- Add is_special_region column if not exists  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_provinces' AND column_name = 'is_special_region') THEN
        ALTER TABLE public.indonesian_provinces ADD COLUMN is_special_region BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================================================
-- 2. Fix Indonesian Regencies Table
-- ============================================================================

DO $$
BEGIN
    -- Add province_id column if not exists (UUID reference)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'province_id') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN province_id UUID;
    END IF;
    
    -- Add type column if not exists (Kota/Kabupaten)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'type') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN type TEXT;
    END IF;
    
    -- Add is_capital column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'is_capital') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN is_capital BOOLEAN DEFAULT false;
    END IF;
    
    -- Add is_major_city column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'is_major_city') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN is_major_city BOOLEAN DEFAULT false;
    END IF;
    
    -- Add population column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_regencies' AND column_name = 'population') THEN
        ALTER TABLE public.indonesian_regencies ADD COLUMN population INTEGER;
    END IF;
END $$;

-- ============================================================================
-- 3. Fix Indonesian Districts Table
-- ============================================================================

DO $$
BEGIN
    -- Add regency_id column if not exists (UUID reference)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_districts' AND column_name = 'regency_id') THEN
        ALTER TABLE public.indonesian_districts ADD COLUMN regency_id UUID;
    END IF;
END $$;

-- ============================================================================
-- 4. Fix Indonesian Villages Table
-- ============================================================================

DO $$
BEGIN
    -- Add district_id column if not exists (UUID reference)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'indonesian_villages' AND column_name = 'district_id') THEN
        ALTER TABLE public.indonesian_villages ADD COLUMN district_id UUID;
    END IF;
END $$;

-- ============================================================================
-- 5. Create Foreign Key Constraints
-- ============================================================================

-- Add foreign key constraint for regencies -> provinces
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_regencies_province') THEN
        ALTER TABLE public.indonesian_regencies 
        ADD CONSTRAINT fk_regencies_province 
        FOREIGN KEY (province_id) REFERENCES public.indonesian_provinces(id);
    END IF;
END $$;

-- Add foreign key constraint for districts -> regencies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_districts_regency') THEN
        ALTER TABLE public.indonesian_districts 
        ADD CONSTRAINT fk_districts_regency 
        FOREIGN KEY (regency_id) REFERENCES public.indonesian_regencies(id);
    END IF;
END $$;

-- Add foreign key constraint for villages -> districts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_villages_district') THEN
        ALTER TABLE public.indonesian_villages 
        ADD CONSTRAINT fk_villages_district 
        FOREIGN KEY (district_id) REFERENCES public.indonesian_districts(id);
    END IF;
END $$;

-- ============================================================================
-- 6. Add UNIQUE Constraints and Indexes
-- ============================================================================

-- Add UNIQUE constraints on code columns (required for ON CONFLICT)
DO $$
BEGIN
    -- Add unique constraint on provinces.code if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_provinces_code' AND table_name = 'indonesian_provinces') THEN
        ALTER TABLE public.indonesian_provinces ADD CONSTRAINT uk_provinces_code UNIQUE (code);
    END IF;
    
    -- Add unique constraint on regencies.code if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_regencies_code' AND table_name = 'indonesian_regencies') THEN
        ALTER TABLE public.indonesian_regencies ADD CONSTRAINT uk_regencies_code UNIQUE (code);
    END IF;
    
    -- Add unique constraint on districts.code if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_districts_code' AND table_name = 'indonesian_districts') THEN
        ALTER TABLE public.indonesian_districts ADD CONSTRAINT uk_districts_code UNIQUE (code);
    END IF;
    
    -- Add unique constraint on villages.code if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'uk_villages_code' AND table_name = 'indonesian_villages') THEN
        ALTER TABLE public.indonesian_villages ADD CONSTRAINT uk_villages_code UNIQUE (code);
    END IF;
END $$;

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
-- 7. Insert Sample Data for Jakarta (if tables are empty)
-- ============================================================================

-- Insert sample data safely (only if not exists)

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
        RAISE NOTICE 'DKI Jakarta province already exists';
    END IF;
END $$;

-- Insert Jakarta Selatan regency if not exists
-- Note: regency code is hierarchical (31.71) but it's the regency's own code
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.indonesian_regencies WHERE code = '31.71') THEN
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
        );
        RAISE NOTICE 'Inserted Jakarta Selatan regency';
    ELSE
        RAISE NOTICE 'Jakarta Selatan regency already exists';
    END IF;
END $$;

-- Insert Kebayoran Baru district if not exists  
-- Note: district code is hierarchical (31.71.02) but it's the district's own code
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.indonesian_districts WHERE code = '31.71.02') THEN
        INSERT INTO public.indonesian_districts (id, code, name, regency_code, regency_id)
        VALUES (
            '31710200-0000-0000-0000-000000000000',
            '31.71.02',
            'Kebayoran Baru',
            '31.71',
            '31710000-0000-0000-0000-000000000000'
        );
        RAISE NOTICE 'Inserted Kebayoran Baru district';
    ELSE
        RAISE NOTICE 'Kebayoran Baru district already exists';
    END IF;
END $$;

-- Insert Senayan village if not exists
-- Note: village code is hierarchical (31.71.02.001) but it's the village's own code
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.indonesian_villages WHERE code = '31.71.02.001') THEN
        INSERT INTO public.indonesian_villages (id, code, name, district_code, district_id)
        VALUES (
            '31710200-1000-0000-0000-000000000000',
            '31.71.02.001',
            'Senayan',
            '31.71.02',
            '31710200-0000-0000-0000-000000000000'
        );
        RAISE NOTICE 'Inserted Senayan village';
    ELSE
        RAISE NOTICE 'Senayan village already exists';
    END IF;
END $$;

-- ============================================================================
-- 8. Create Updated RPC Functions
-- ============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_provinces_dropdown();
DROP FUNCTION IF EXISTS public.get_cities_by_province(TEXT);
DROP FUNCTION IF EXISTS public.get_indonesian_provinces();
DROP FUNCTION IF EXISTS public.get_indonesian_regencies(TEXT);

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
    WHERE p.name IS NOT NULL
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
        CASE 
            WHEN province_identifier IS NULL THEN true
            ELSE (
                r.province_code = province_identifier 
                OR EXISTS (
                    SELECT 1 FROM public.indonesian_provinces p 
                    WHERE p.id::TEXT = province_identifier AND r.province_id = p.id
                )
            )
        END
    ORDER BY r.name
    LIMIT 1000;
$$;

-- Get districts by regency
CREATE OR REPLACE FUNCTION public.get_districts_by_regency(regency_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    code TEXT,
    name TEXT,
    regency_code TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        d.id::TEXT,
        d.code,
        d.name,
        d.regency_code
    FROM public.indonesian_districts d
    WHERE 
        CASE 
            WHEN regency_identifier IS NULL THEN true
            ELSE (
                d.regency_code = regency_identifier 
                OR EXISTS (
                    SELECT 1 FROM public.indonesian_regencies r 
                    WHERE r.id::TEXT = regency_identifier AND d.regency_id = r.id
                )
            )
        END
    ORDER BY d.name
    LIMIT 1000;
$$;

-- Get villages by district
CREATE OR REPLACE FUNCTION public.get_villages_by_district(district_identifier TEXT)
RETURNS TABLE (
    id TEXT,
    code TEXT,
    name TEXT,
    district_code TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        v.id::TEXT,
        v.code,
        v.name,
        v.district_code
    FROM public.indonesian_villages v
    WHERE 
        CASE 
            WHEN district_identifier IS NULL THEN true
            ELSE (
                v.district_code = district_identifier 
                OR EXISTS (
                    SELECT 1 FROM public.indonesian_districts d 
                    WHERE d.id::TEXT = district_identifier AND v.district_id = d.id
                )
            )
        END
    ORDER BY v.name
    LIMIT 1000;
$$;

-- Create the missing update_car_status_by_host function (fixed version)
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

-- ============================================================================
-- 9. Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_provinces_dropdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cities_by_province(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_districts_by_regency(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_villages_by_district(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_car_status_by_host(UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- 10. Test Functions
-- ============================================================================

DO $$
DECLARE
    test_result JSON;
    province_count INT;
    regency_count INT;
BEGIN
    RAISE NOTICE '=== Testing Indonesian Address Functions ===';
    
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
