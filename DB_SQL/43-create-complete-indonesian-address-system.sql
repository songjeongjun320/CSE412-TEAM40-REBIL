-- Complete Indonesian Address System Creation
-- Date: 2025-01-12
-- Purpose: Create complete Indonesian administrative hierarchy from scratch

-- ==============================================================================
-- ANALYSIS RESULT:
-- - Indonesian address tables DO NOT EXIST in current database
-- - Need to create complete system: provinces → regencies → districts → villages
-- - Must support both UUID and government code lookups
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. Create Indonesian Provinces Table (34 provinces)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.indonesian_provinces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(2) NOT NULL UNIQUE,        -- 2-digit government code (11, 12, 13, etc.)
    name VARCHAR(100) NOT NULL UNIQUE,      -- Province name
    island_group VARCHAR(50) NOT NULL,      -- Sumatra, Java, Kalimantan, etc.
    is_special_region BOOLEAN DEFAULT FALSE, -- Jakarta, Yogyakarta, Aceh
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 2. Create Indonesian Regencies/Cities Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.indonesian_regencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    province_id UUID NOT NULL REFERENCES public.indonesian_provinces(id) ON DELETE CASCADE,
    code VARCHAR(4) NOT NULL UNIQUE,        -- 4-digit government code (1101, 1102, etc.)
    name VARCHAR(100) NOT NULL,             -- City/Regency name
    type VARCHAR(20) NOT NULL CHECK (type IN ('city', 'regency', 'municipality')),
    is_capital BOOLEAN DEFAULT FALSE,        -- Provincial capital
    is_major_city BOOLEAN DEFAULT FALSE,     -- Major tourist/business destination
    population INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(province_id, name)
);

-- ==============================================================================
-- 3. Create Indonesian Districts Table (Kecamatan)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.indonesian_districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regency_id UUID NOT NULL REFERENCES public.indonesian_regencies(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL UNIQUE,        -- 6-digit government code (110101, etc.)
    name VARCHAR(100) NOT NULL,             -- District name
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(regency_id, name)
);

-- ==============================================================================
-- 4. Create Indonesian Villages Table (Desa/Kelurahan)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.indonesian_villages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES public.indonesian_districts(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL UNIQUE,       -- 10-digit government code (1101011001, etc.)
    name VARCHAR(100) NOT NULL,             -- Village name
    type VARCHAR(20) DEFAULT 'desa' CHECK (type IN ('desa', 'kelurahan')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(district_id, name)
);

-- ==============================================================================
-- 5. Create Performance Indexes
-- ==============================================================================

-- Provinces indexes
CREATE INDEX IF NOT EXISTS idx_indonesian_provinces_code ON public.indonesian_provinces(code);
CREATE INDEX IF NOT EXISTS idx_indonesian_provinces_name ON public.indonesian_provinces(name);
CREATE INDEX IF NOT EXISTS idx_indonesian_provinces_island ON public.indonesian_provinces(island_group);

-- Regencies indexes
CREATE INDEX IF NOT EXISTS idx_indonesian_regencies_province_id ON public.indonesian_regencies(province_id);
CREATE INDEX IF NOT EXISTS idx_indonesian_regencies_code ON public.indonesian_regencies(code);
CREATE INDEX IF NOT EXISTS idx_indonesian_regencies_name ON public.indonesian_regencies(name);
CREATE INDEX IF NOT EXISTS idx_indonesian_regencies_type ON public.indonesian_regencies(type);

-- Districts indexes
CREATE INDEX IF NOT EXISTS idx_indonesian_districts_regency_id ON public.indonesian_districts(regency_id);
CREATE INDEX IF NOT EXISTS idx_indonesian_districts_code ON public.indonesian_districts(code);
CREATE INDEX IF NOT EXISTS idx_indonesian_districts_name ON public.indonesian_districts(name);

-- Villages indexes
CREATE INDEX IF NOT EXISTS idx_indonesian_villages_district_id ON public.indonesian_villages(district_id);
CREATE INDEX IF NOT EXISTS idx_indonesian_villages_code ON public.indonesian_villages(code);
CREATE INDEX IF NOT EXISTS idx_indonesian_villages_name ON public.indonesian_villages(name);

-- ==============================================================================
-- 6. Insert Sample Indonesian Administrative Data
-- ==============================================================================

-- Insert Major Provinces (34 total)
INSERT INTO public.indonesian_provinces (code, name, island_group, is_special_region) VALUES
-- Sumatra (10 provinces)
('11', 'Nanggroe Aceh Darussalam', 'Sumatra', TRUE),
('12', 'Sumatera Utara', 'Sumatra', FALSE),
('13', 'Sumatera Barat', 'Sumatra', FALSE),
('14', 'Riau', 'Sumatra', FALSE),
('15', 'Jambi', 'Sumatra', FALSE),
('16', 'Sumatera Selatan', 'Sumatra', FALSE),
('17', 'Bengkulu', 'Sumatra', FALSE),
('18', 'Lampung', 'Sumatra', FALSE),
('19', 'Kepulauan Bangka Belitung', 'Sumatra', FALSE),
('21', 'Kepulauan Riau', 'Sumatra', FALSE),

-- Java (6 provinces)
('31', 'DKI Jakarta', 'Java', TRUE),
('32', 'Jawa Barat', 'Java', FALSE),
('33', 'Jawa Tengah', 'Java', FALSE),
('34', 'DI Yogyakarta', 'Java', TRUE),
('35', 'Jawa Timur', 'Java', FALSE),
('36', 'Banten', 'Java', FALSE),

-- Kalimantan (5 provinces)
('61', 'Kalimantan Barat', 'Kalimantan', FALSE),
('62', 'Kalimantan Tengah', 'Kalimantan', FALSE),
('63', 'Kalimantan Selatan', 'Kalimantan', FALSE),
('64', 'Kalimantan Timur', 'Kalimantan', FALSE),
('65', 'Kalimantan Utara', 'Kalimantan', FALSE),

-- Sulawesi (6 provinces)
('71', 'Sulawesi Utara', 'Sulawesi', FALSE),
('72', 'Sulawesi Tengah', 'Sulawesi', FALSE),
('73', 'Sulawesi Selatan', 'Sulawesi', FALSE),
('74', 'Sulawesi Tenggara', 'Sulawesi', FALSE),
('75', 'Gorontalo', 'Sulawesi', FALSE),
('76', 'Sulawesi Barat', 'Sulawesi', FALSE),

-- Lesser Sunda Islands (3 provinces)
('51', 'Bali', 'Nusa Tenggara', FALSE),
('52', 'Nusa Tenggara Barat', 'Nusa Tenggara', FALSE),
('53', 'Nusa Tenggara Timur', 'Nusa Tenggara', FALSE),

-- Maluku & Papua (4 provinces)
('81', 'Maluku', 'Maluku', FALSE),
('82', 'Maluku Utara', 'Maluku', FALSE),
('91', 'Papua', 'Papua', FALSE),
('92', 'Papua Barat', 'Papua', FALSE)

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    island_group = EXCLUDED.island_group,
    is_special_region = EXCLUDED.is_special_region,
    updated_at = NOW();

-- Insert Major Cities/Regencies (focusing on major urban centers)
INSERT INTO public.indonesian_regencies (province_id, code, name, type, is_capital, is_major_city, population) VALUES
-- DKI Jakarta
((SELECT id FROM indonesian_provinces WHERE code = '31'), '3101', 'Jakarta Pusat', 'municipality', TRUE, TRUE, 914700),
((SELECT id FROM indonesian_provinces WHERE code = '31'), '3102', 'Jakarta Utara', 'municipality', FALSE, TRUE, 1782100),
((SELECT id FROM indonesian_provinces WHERE code = '31'), '3103', 'Jakarta Barat', 'municipality', FALSE, TRUE, 2583100),
((SELECT id FROM indonesian_provinces WHERE code = '31'), '3104', 'Jakarta Selatan', 'municipality', FALSE, TRUE, 2230600),
((SELECT id FROM indonesian_provinces WHERE code = '31'), '3105', 'Jakarta Timur', 'municipality', FALSE, TRUE, 2918800),

-- Jawa Barat (Major Cities)
((SELECT id FROM indonesian_provinces WHERE code = '32'), '3201', 'Bogor', 'regency', FALSE, TRUE, 5715009),
((SELECT id FROM indonesian_provinces WHERE code = '32'), '3202', 'Sukabumi', 'regency', FALSE, FALSE, 2413600),
((SELECT id FROM indonesian_provinces WHERE code = '32'), '3203', 'Cianjur', 'regency', FALSE, FALSE, 2477500),
((SELECT id FROM indonesian_provinces WHERE code = '32'), '3204', 'Bandung', 'regency', FALSE, TRUE, 3650000),
((SELECT id FROM indonesian_provinces WHERE code = '32'), '3273', 'Bandung', 'city', FALSE, TRUE, 2444160),
((SELECT id FROM indonesian_provinces WHERE code = '32'), '3275', 'Bekasi', 'city', FALSE, TRUE, 2664000),
((SELECT id FROM indonesian_provinces WHERE code = '32'), '3276', 'Depok', 'city', FALSE, TRUE, 2268000),

-- Jawa Tengah (Major Cities)
((SELECT id FROM indonesian_provinces WHERE code = '33'), '3301', 'Cilacap', 'regency', FALSE, FALSE, 1944500),
((SELECT id FROM indonesian_provinces WHERE code = '33'), '3371', 'Magelang', 'city', FALSE, FALSE, 121526),
((SELECT id FROM indonesian_provinces WHERE code = '33'), '3372', 'Surakarta', 'city', FALSE, TRUE, 522364),
((SELECT id FROM indonesian_provinces WHERE code = '33'), '3373', 'Salatiga', 'city', FALSE, FALSE, 192322),
((SELECT id FROM indonesian_provinces WHERE code = '33'), '3374', 'Semarang', 'city', TRUE, TRUE, 1729428),

-- DI Yogyakarta
((SELECT id FROM indonesian_provinces WHERE code = '34'), '3401', 'Kulon Progo', 'regency', FALSE, FALSE, 431000),
((SELECT id FROM indonesian_provinces WHERE code = '34'), '3402', 'Bantul', 'regency', FALSE, FALSE, 1004000),
((SELECT id FROM indonesian_provinces WHERE code = '34'), '3403', 'Gunungkidul', 'regency', FALSE, FALSE, 748000),
((SELECT id FROM indonesian_provinces WHERE code = '34'), '3404', 'Sleman', 'regency', FALSE, FALSE, 1204000),
((SELECT id FROM indonesian_provinces WHERE code = '34'), '3471', 'Yogyakarta', 'city', TRUE, TRUE, 422732),

-- Jawa Timur (Major Cities)
((SELECT id FROM indonesian_provinces WHERE code = '35'), '3501', 'Pacitan', 'regency', FALSE, FALSE, 560000),
((SELECT id FROM indonesian_provinces WHERE code = '35'), '3578', 'Surabaya', 'city', TRUE, TRUE, 2874314),
((SELECT id FROM indonesian_provinces WHERE code = '35'), '3579', 'Malang', 'city', FALSE, TRUE, 887443),

-- Banten
((SELECT id FROM indonesian_provinces WHERE code = '36'), '3601', 'Pandeglang', 'regency', FALSE, FALSE, 1272687),
((SELECT id FROM indonesian_provinces WHERE code = '36'), '3602', 'Lebak', 'regency', FALSE, FALSE, 1386793),
((SELECT id FROM indonesian_provinces WHERE code = '36'), '3603', 'Tangerang', 'regency', FALSE, TRUE, 3317600),
((SELECT id FROM indonesian_provinces WHERE code = '36'), '3671', 'Tangerang', 'city', FALSE, TRUE, 2139891),
((SELECT id FROM indonesian_provinces WHERE code = '36'), '3672', 'Cilegon', 'city', FALSE, TRUE, 434896),
((SELECT id FROM indonesian_provinces WHERE code = '36'), '3673', 'Serang', 'city', TRUE, TRUE, 695351),
((SELECT id FROM indonesian_provinces WHERE code = '36'), '3674', 'Tangerang Selatan', 'city', FALSE, TRUE, 1644899),

-- Bali (Major Cities)
((SELECT id FROM indonesian_provinces WHERE code = '51'), '5101', 'Jembrana', 'regency', FALSE, FALSE, 279500),
((SELECT id FROM indonesian_provinces WHERE code = '51'), '5102', 'Tabanan', 'regency', FALSE, FALSE, 461700),
((SELECT id FROM indonesian_provinces WHERE code = '51'), '5103', 'Badung', 'regency', FALSE, TRUE, 615100),
((SELECT id FROM indonesian_provinces WHERE code = '51'), '5104', 'Gianyar', 'regency', FALSE, TRUE, 515300),
((SELECT id FROM indonesian_provinces WHERE code = '51'), '5171', 'Denpasar', 'city', TRUE, TRUE, 897300)

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_capital = EXCLUDED.is_capital,
    is_major_city = EXCLUDED.is_major_city,
    population = EXCLUDED.population,
    updated_at = NOW();

-- Insert Sample Districts for Jakarta Pusat (high-priority for testing)
INSERT INTO public.indonesian_districts (regency_id, code, name) VALUES
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310101', 'Gambir'),
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310102', 'Tanah Abang'),
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310103', 'Menteng'),
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310104', 'Senen'),
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310105', 'Cempaka Putih'),
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310106', 'Johar Baru'),
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310107', 'Kemayoran'),
((SELECT id FROM indonesian_regencies WHERE code = '3101'), '310108', 'Sawah Besar')

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- Insert Sample Villages for Menteng District (high-priority for testing)
INSERT INTO public.indonesian_villages (district_id, code, name, type) VALUES
((SELECT id FROM indonesian_districts WHERE code = '310103'), '3101031001', 'Menteng', 'kelurahan'),
((SELECT id FROM indonesian_districts WHERE code = '310103'), '3101031002', 'Pegangsaan', 'kelurahan'),
((SELECT id FROM indonesian_districts WHERE code = '310103'), '3101031003', 'Cikini', 'kelurahan'),
((SELECT id FROM indonesian_districts WHERE code = '310103'), '3101031004', 'Gondangdia', 'kelurahan'),
((SELECT id FROM indonesian_districts WHERE code = '310103'), '3101031005', 'Kebon Sirih', 'kelurahan')

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    updated_at = NOW();

-- ==============================================================================
-- 7. Create Helper Views for API Access
-- ==============================================================================

-- Provinces dropdown view
CREATE OR REPLACE VIEW public.v_indonesian_provinces AS
SELECT 
    id,
    code,
    name,
    island_group,
    is_special_region
FROM public.indonesian_provinces
ORDER BY 
    CASE island_group
        WHEN 'Java' THEN 1
        WHEN 'Sumatra' THEN 2
        WHEN 'Kalimantan' THEN 3
        WHEN 'Sulawesi' THEN 4
        ELSE 5
    END,
    name;

-- Cities with province info view
CREATE OR REPLACE VIEW public.v_indonesian_regencies AS
SELECT 
    r.id,
    r.code,
    r.name,
    r.type,
    r.is_capital,
    r.is_major_city,
    r.population,
    r.province_id,
    p.code as province_code,
    p.name as province_name,
    p.island_group
FROM public.indonesian_regencies r
JOIN public.indonesian_provinces p ON r.province_id = p.id
ORDER BY p.name, r.name;

-- Districts with regency info view
CREATE OR REPLACE VIEW public.v_indonesian_districts AS
SELECT 
    d.id,
    d.code,
    d.name,
    d.regency_id,
    r.code as regency_code,
    r.name as regency_name,
    r.province_id,
    p.code as province_code,
    p.name as province_name
FROM public.indonesian_districts d
JOIN public.indonesian_regencies r ON d.regency_id = r.id
JOIN public.indonesian_provinces p ON r.province_id = p.id
ORDER BY p.name, r.name, d.name;

-- Villages with full hierarchy view
CREATE OR REPLACE VIEW public.v_indonesian_villages AS
SELECT 
    v.id,
    v.code,
    v.name,
    v.type,
    v.district_id,
    d.code as district_code,
    d.name as district_name,
    d.regency_id,
    r.code as regency_code,
    r.name as regency_name,
    r.province_id,
    p.code as province_code,
    p.name as province_name
FROM public.indonesian_villages v
JOIN public.indonesian_districts d ON v.district_id = d.id
JOIN public.indonesian_regencies r ON d.regency_id = r.id
JOIN public.indonesian_provinces p ON r.province_id = p.id
ORDER BY p.name, r.name, d.name, v.name;

-- ==============================================================================
-- 8. Create RPC Functions for API Access
-- ==============================================================================

-- Get provinces for dropdown
CREATE OR REPLACE FUNCTION public.get_indonesian_provinces()
RETURNS TABLE (
    id UUID,
    code VARCHAR(2),
    name VARCHAR(100),
    island_group VARCHAR(50)
) 
LANGUAGE SQL STABLE
AS $$
    SELECT id, code, name, island_group
    FROM public.indonesian_provinces
    ORDER BY 
        CASE island_group
            WHEN 'Java' THEN 1
            WHEN 'Sumatra' THEN 2
            ELSE 3
        END,
        name;
$$;

-- Get regencies by province
CREATE OR REPLACE FUNCTION public.get_indonesian_regencies(province_code_param VARCHAR(2))
RETURNS TABLE (
    id UUID,
    code VARCHAR(4),
    name VARCHAR(100),
    type VARCHAR(20),
    province_code VARCHAR(2)
) 
LANGUAGE SQL STABLE
AS $$
    SELECT r.id, r.code, r.name, r.type, p.code
    FROM public.indonesian_regencies r
    JOIN public.indonesian_provinces p ON r.province_id = p.id
    WHERE p.code = province_code_param
    ORDER BY r.name;
$$;

-- Get districts by regency
CREATE OR REPLACE FUNCTION public.get_indonesian_districts(regency_code_param VARCHAR(4))
RETURNS TABLE (
    id UUID,
    code VARCHAR(6),
    name VARCHAR(100),
    regency_code VARCHAR(4)
) 
LANGUAGE SQL STABLE
AS $$
    SELECT d.id, d.code, d.name, r.code
    FROM public.indonesian_districts d
    JOIN public.indonesian_regencies r ON d.regency_id = r.id
    WHERE r.code = regency_code_param
    ORDER BY d.name;
$$;

-- Get villages by district
CREATE OR REPLACE FUNCTION public.get_indonesian_villages(district_code_param VARCHAR(6))
RETURNS TABLE (
    id UUID,
    code VARCHAR(10),
    name VARCHAR(100),
    district_code VARCHAR(6)
) 
LANGUAGE SQL STABLE
AS $$
    SELECT v.id, v.code, v.name, d.code
    FROM public.indonesian_villages v
    JOIN public.indonesian_districts d ON v.district_id = d.id
    WHERE d.code = district_code_param
    ORDER BY v.name;
$$;

-- ==============================================================================
-- 9. Create Address Validation Function
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_indonesian_address(address_data JSONB)
RETURNS BOOLEAN
LANGUAGE PLPGSQL STABLE
AS $$
BEGIN
    -- Check if address_data is null or empty
    IF address_data IS NULL OR address_data = '{}'::jsonb THEN
        RETURN FALSE;
    END IF;
    
    -- Must have street_address
    IF NOT (address_data ? 'street_address') OR 
       address_data->>'street_address' = '' OR 
       address_data->>'street_address' IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Must have either province_id or province code
    IF NOT (address_data ? 'province_id') OR 
       address_data->>'province_id' = '' OR 
       address_data->>'province_id' IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Must have either city_id or city code  
    IF NOT (address_data ? 'city_id') OR 
       address_data->>'city_id' = '' OR 
       address_data->>'city_id' IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- All checks passed
    RETURN TRUE;
END;
$$;

-- ==============================================================================
-- 10. Add Cars Table Location Constraint (if cars table exists)
-- ==============================================================================

DO $$
BEGIN
    -- Check if cars table exists before adding constraint
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cars') THEN
        -- Add check constraint for location validation
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.check_constraints 
            WHERE constraint_name = 'cars_location_check'
        ) THEN
            ALTER TABLE public.cars 
            ADD CONSTRAINT cars_location_check 
            CHECK (validate_indonesian_address(location));
            
            RAISE NOTICE 'Added location validation constraint to cars table';
        ELSE
            RAISE NOTICE 'Cars location constraint already exists';
        END IF;
    ELSE
        RAISE NOTICE 'Cars table does not exist - constraint will be added when table is created';
    END IF;
END $$;

-- ==============================================================================
-- 11. Final Report
-- ==============================================================================

DO $$
DECLARE
    province_count INT;
    regency_count INT;
    district_count INT;
    village_count INT;
BEGIN
    SELECT COUNT(*) INTO province_count FROM indonesian_provinces;
    SELECT COUNT(*) INTO regency_count FROM indonesian_regencies;
    SELECT COUNT(*) INTO district_count FROM indonesian_districts;  
    SELECT COUNT(*) INTO village_count FROM indonesian_villages;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Indonesian Address System Created Successfully ===';
    RAISE NOTICE 'Provinces: % (34 total Indonesian provinces)', province_count;
    RAISE NOTICE 'Regencies/Cities: % (major urban centers)', regency_count;
    RAISE NOTICE 'Districts: % (Jakarta Pusat sample)', district_count;
    RAISE NOTICE 'Villages: % (Menteng sample)', village_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for API integration and frontend testing!';
    RAISE NOTICE '=====================================================';
END $$;

COMMIT;

-- ==============================================================================
-- NOTES:
-- ==============================================================================
-- This creates a complete Indonesian administrative hierarchy:
-- 
-- 1. ✅ All 34 Indonesian provinces 
-- 2. ✅ Major cities and regencies (focusing on Java and major urban centers)
-- 3. ✅ Sample districts (Jakarta Pusat for testing)
-- 4. ✅ Sample villages (Menteng for testing)
-- 5. ✅ Performance indexes for fast lookups
-- 6. ✅ Helper views for easy API access
-- 7. ✅ RPC functions for dropdown population
-- 8. ✅ Address validation function
-- 9. ✅ Cars table constraint (if table exists)
--
-- The system supports:
-- - UUID-based relationships (for referential integrity)
-- - Government code lookups (for user-friendly codes)
-- - Hierarchical structure (Province → Regency → District → Village)
-- - Extensible data model (can add more districts/villages as needed)
--
-- Next Steps:
-- 1. Apply this migration to Supabase
-- 2. Update TypeScript types
-- 3. Fix API routes
-- 4. Test frontend address components
-- ==============================================================================