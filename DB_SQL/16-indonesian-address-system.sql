-- ============================================================================
-- INDONESIAN ADDRESS SYSTEM SETUP
-- ============================================================================
-- Creates reference tables for Indonesian provinces and cities
-- Supports dropdown selection for address forms

-- ============================================================================
-- CREATE REFERENCE TABLES
-- ============================================================================

-- Indonesian Provinces Reference Table
CREATE TABLE public.indonesian_provinces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE, -- Province code for sorting/reference
  island_group TEXT NOT NULL, -- Sumatra, Java, Kalimantan, etc.
  is_special_region BOOLEAN DEFAULT FALSE, -- For Jakarta, Yogyakarta, Aceh
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indonesian Cities Reference Table
CREATE TABLE public.indonesian_regencies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  province_id UUID REFERENCES public.indonesian_provinces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('city', 'regency', 'municipality')),
  is_capital BOOLEAN DEFAULT FALSE, -- Provincial capital
  is_major_city BOOLEAN DEFAULT FALSE, -- Major tourist/business destination
  population INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(province_id, name)
);

-- ============================================================================
-- INSERT INDONESIAN PROVINCES DATA (38 provinces as of 2024)
-- ============================================================================

INSERT INTO public.indonesian_provinces (name, code, island_group, is_special_region) VALUES
-- Sumatra (10 provinces)
('Nanggroe Aceh Darussalam', 'AC', 'Sumatra', true),
('North Sumatra', 'SU', 'Sumatra', false),
('South Sumatra', 'SS', 'Sumatra', false),
('West Sumatra', 'SB', 'Sumatra', false),
('Bengkulu', 'BE', 'Sumatra', false),
('Riau', 'RI', 'Sumatra', false),
('Riau Islands', 'KR', 'Sumatra', false),
('Jambi', 'JA', 'Sumatra', false),
('Lampung', 'LA', 'Sumatra', false),
('Bangka Belitung', 'BB', 'Sumatra', false),

-- Java (6 provinces)
('Banten', 'BT', 'Java', false),
('DKI Jakarta', 'JK', 'Java', true),
('West Java', 'JB', 'Java', false),
('Central Java', 'JT', 'Java', false),
('Yogyakarta Special Region', 'YO', 'Java', true),
('East Java', 'JI', 'Java', false),

-- Kalimantan (5 provinces)
('West Kalimantan', 'KB', 'Kalimantan', false),
('East Kalimantan', 'KI', 'Kalimantan', false),
('South Kalimantan', 'KS', 'Kalimantan', false),
('Central Kalimantan', 'KT', 'Kalimantan', false),
('North Kalimantan', 'KU', 'Kalimantan', false),

-- Bali and Nusa Tenggara (3 provinces)
('Bali', 'BA', 'Bali and Nusa Tenggara', false),
('East Nusa Tenggara', 'NT', 'Bali and Nusa Tenggara', false),
('West Nusa Tenggara', 'NB', 'Bali and Nusa Tenggara', false),

-- Sulawesi (6 provinces)
('North Sulawesi', 'SA', 'Sulawesi', false),
('Gorontalo', 'GO', 'Sulawesi', false),
('Central Sulawesi', 'ST', 'Sulawesi', false),
('West Sulawesi', 'SR', 'Sulawesi', false),
('South Sulawesi', 'SN', 'Sulawesi', false),
('Southeast Sulawesi', 'SG', 'Sulawesi', false),

-- Maluku (2 provinces)
('Maluku', 'MA', 'Maluku', false),
('North Maluku', 'MU', 'Maluku', false),

-- Papua (6 provinces - expanded from original Papua)
('Papua', 'PA', 'Papua', true),
('West Papua', 'PB', 'Papua', true),
('South Papua', 'PS', 'Papua', false),
('Central Papua', 'PT', 'Papua', false),
('Highland Papua', 'PG', 'Papua', false),
('Southwest Papua', 'PD', 'Papua', false);

-- ============================================================================
-- INSERT MAJOR INDONESIAN CITIES DATA
-- ============================================================================

-- Helper function to get province ID by name
CREATE OR REPLACE FUNCTION get_province_id(province_name TEXT)
RETURNS UUID AS $$
DECLARE
    province_uuid UUID;
BEGIN
    SELECT id INTO province_uuid FROM public.indonesian_provinces WHERE name = province_name;
    RETURN province_uuid;
END;
$$ LANGUAGE plpgsql;

-- Insert major cities data
INSERT INTO public.indonesian_regencies (province_id, name, type, is_capital, is_major_city, population) VALUES

-- DKI Jakarta
(get_province_id('DKI Jakarta'), 'Jakarta', 'city', true, true, 10700000),
(get_province_id('DKI Jakarta'), 'Jakarta Pusat', 'municipality', false, true, 910000),
(get_province_id('DKI Jakarta'), 'Jakarta Utara', 'municipality', false, true, 1800000),
(get_province_id('DKI Jakarta'), 'Jakarta Barat', 'municipality', false, true, 2500000),
(get_province_id('DKI Jakarta'), 'Jakarta Selatan', 'municipality', false, true, 2200000),
(get_province_id('DKI Jakarta'), 'Jakarta Timur', 'municipality', false, true, 2900000),

-- West Java
(get_province_id('West Java'), 'Bandung', 'city', true, true, 2500000),
(get_province_id('West Java'), 'Bekasi', 'city', false, true, 2500000),
(get_province_id('West Java'), 'Depok', 'city', false, true, 2100000),
(get_province_id('West Java'), 'Bogor', 'city', false, true, 1100000),
(get_province_id('West Java'), 'Tangerang', 'city', false, true, 2200000),
(get_province_id('West Java'), 'Cimahi', 'city', false, false, 600000),

-- East Java  
(get_province_id('East Java'), 'Surabaya', 'city', true, true, 3000000),
(get_province_id('East Java'), 'Malang', 'city', false, true, 880000),
(get_province_id('East Java'), 'Kediri', 'city', false, false, 280000),
(get_province_id('East Java'), 'Madiun', 'city', false, false, 180000),

-- Central Java
(get_province_id('Central Java'), 'Semarang', 'city', true, true, 1700000),
(get_province_id('Central Java'), 'Solo', 'city', false, true, 520000),
(get_province_id('Central Java'), 'Yogyakarta', 'city', false, true, 420000),

-- Yogyakarta Special Region
(get_province_id('Yogyakarta Special Region'), 'Yogyakarta', 'city', true, true, 420000),

-- Banten
(get_province_id('Banten'), 'Serang', 'city', true, false, 690000),
(get_province_id('Banten'), 'Tangerang', 'city', false, true, 2200000),
(get_province_id('Banten'), 'Cilegon', 'city', false, false, 430000),

-- North Sumatra
(get_province_id('North Sumatra'), 'Medan', 'city', true, true, 2400000),
(get_province_id('North Sumatra'), 'Pematangsiantar', 'city', false, false, 350000),
(get_province_id('North Sumatra'), 'Binjai', 'city', false, false, 250000),

-- South Sumatra
(get_province_id('South Sumatra'), 'Palembang', 'city', true, true, 1700000),
(get_province_id('South Sumatra'), 'Lubuklinggau', 'city', false, false, 220000),

-- West Sumatra
(get_province_id('West Sumatra'), 'Padang', 'city', true, true, 900000),
(get_province_id('West Sumatra'), 'Bukittinggi', 'city', false, true, 130000),

-- Riau
(get_province_id('Riau'), 'Pekanbaru', 'city', true, true, 1100000),
(get_province_id('Riau'), 'Dumai', 'city', false, false, 320000),

-- Riau Islands
(get_province_id('Riau Islands'), 'Tanjung Pinang', 'city', true, false, 230000),
(get_province_id('Riau Islands'), 'Batam', 'city', false, true, 800000),

-- Lampung
(get_province_id('Lampung'), 'Bandar Lampung', 'city', true, true, 1200000),
(get_province_id('Lampung'), 'Metro', 'city', false, false, 160000),

-- Bengkulu
(get_province_id('Bengkulu'), 'Bengkulu', 'city', true, false, 370000),

-- Jambi
(get_province_id('Jambi'), 'Jambi', 'city', true, false, 610000),

-- Nanggroe Aceh Darussalam
(get_province_id('Nanggroe Aceh Darussalam'), 'Banda Aceh', 'city', true, true, 270000),
(get_province_id('Nanggroe Aceh Darussalam'), 'Lhokseumawe', 'city', false, false, 200000),

-- Bangka Belitung
(get_province_id('Bangka Belitung'), 'Pangkalpinang', 'city', true, false, 210000),

-- Bali
(get_province_id('Bali'), 'Denpasar', 'city', true, true, 950000),
(get_province_id('Bali'), 'Ubud', 'regency', false, true, 75000),
(get_province_id('Bali'), 'Sanur', 'regency', false, true, 50000),
(get_province_id('Bali'), 'Canggu', 'regency', false, true, 30000),

-- West Nusa Tenggara
(get_province_id('West Nusa Tenggara'), 'Mataram', 'city', true, true, 440000),
(get_province_id('West Nusa Tenggara'), 'Bima', 'city', false, false, 150000),

-- East Nusa Tenggara
(get_province_id('East Nusa Tenggara'), 'Kupang', 'city', true, false, 450000),

-- West Kalimantan
(get_province_id('West Kalimantan'), 'Pontianak', 'city', true, true, 650000),
(get_province_id('West Kalimantan'), 'Singkawang', 'city', false, false, 270000),

-- Central Kalimantan
(get_province_id('Central Kalimantan'), 'Palangkaraya', 'city', true, false, 290000),

-- South Kalimantan
(get_province_id('South Kalimantan'), 'Banjarmasin', 'city', true, true, 680000),
(get_province_id('South Kalimantan'), 'Banjarbaru', 'city', false, false, 250000),

-- East Kalimantan
(get_province_id('East Kalimantan'), 'Samarinda', 'city', true, true, 830000),
(get_province_id('East Kalimantan'), 'Balikpapan', 'city', false, true, 650000),

-- North Kalimantan
(get_province_id('North Kalimantan'), 'Tanjung Selor', 'city', true, false, 60000),

-- North Sulawesi
(get_province_id('North Sulawesi'), 'Manado', 'city', true, true, 450000),
(get_province_id('North Sulawesi'), 'Bitung', 'city', false, false, 230000),

-- Central Sulawesi
(get_province_id('Central Sulawesi'), 'Palu', 'city', true, false, 380000),

-- South Sulawesi
(get_province_id('South Sulawesi'), 'Makassar', 'city', true, true, 1500000),
(get_province_id('South Sulawesi'), 'Pare-Pare', 'city', false, false, 140000),

-- Southeast Sulawesi
(get_province_id('Southeast Sulawesi'), 'Kendari', 'city', true, false, 350000),

-- West Sulawesi
(get_province_id('West Sulawesi'), 'Mamuju', 'city', true, false, 130000),

-- Gorontalo
(get_province_id('Gorontalo'), 'Gorontalo', 'city', true, false, 220000),

-- Maluku
(get_province_id('Maluku'), 'Ambon', 'city', true, true, 450000),

-- North Maluku
(get_province_id('North Maluku'), 'Ternate', 'city', true, false, 220000),

-- Papua
(get_province_id('Papua'), 'Jayapura', 'city', true, true, 380000),

-- West Papua
(get_province_id('West Papua'), 'Manokwari', 'city', true, false, 190000),

-- South Papua
(get_province_id('South Papua'), 'Merauke', 'city', true, false, 110000),

-- Central Papua
(get_province_id('Central Papua'), 'Nabire', 'city', true, false, 60000),

-- Highland Papua
(get_province_id('Highland Papua'), 'Wamena', 'city', true, false, 40000),

-- Southwest Papua
(get_province_id('Southwest Papua'), 'Sorong', 'city', true, false, 250000);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_indonesian_provinces_name ON public.indonesian_provinces(name);
CREATE INDEX idx_indonesian_provinces_code ON public.indonesian_provinces(code);
CREATE INDEX idx_indonesian_provinces_island_group ON public.indonesian_provinces(island_group);

CREATE INDEX idx_indonesian_regencies_province_id ON public.indonesian_regencies(province_id);
CREATE INDEX idx_indonesian_regencies_name ON public.indonesian_regencies(name);
CREATE INDEX idx_indonesian_regencies_type ON public.indonesian_regencies(type);
CREATE INDEX idx_indonesian_regencies_major ON public.indonesian_regencies(is_major_city);

-- ============================================================================
-- CREATE HELPER VIEWS FOR FRONTEND DROPDOWN DATA
-- ============================================================================

-- View for provinces dropdown (sorted by name)
CREATE OR REPLACE VIEW public.provinces_dropdown AS
SELECT 
  id,
  name,
  code,
  island_group,
  is_special_region
FROM public.indonesian_provinces
ORDER BY name ASC;

-- View for cities dropdown by province
CREATE OR REPLACE VIEW public.cities_by_province AS
SELECT 
  c.id,
  c.province_id,
  c.name,
  c.type,
  c.is_capital,
  c.is_major_city,
  c.population,
  p.name as province_name,
  p.code as province_code
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
ORDER BY p.name ASC, c.is_capital DESC, c.is_major_city DESC, c.name ASC;

-- View for major cities only (for quick selection)
CREATE OR REPLACE VIEW public.major_cities_dropdown AS
SELECT 
  c.id,
  c.province_id,
  c.name,
  c.type,
  c.population,
  p.name as province_name,
  p.code as province_code
FROM public.indonesian_regencies c
JOIN public.indonesian_provinces p ON c.province_id = p.id
WHERE c.is_major_city = true OR c.is_capital = true
ORDER BY c.population DESC;

-- ============================================================================
-- CREATE API FUNCTIONS FOR FRONTEND
-- ============================================================================

-- Function to get provinces for dropdown
CREATE OR REPLACE FUNCTION public.get_provinces_dropdown()
RETURNS TABLE(
  id UUID,
  name TEXT,
  code TEXT,
  island_group TEXT,
  is_special_region BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.provinces_dropdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cities by province for dropdown
CREATE OR REPLACE FUNCTION public.get_cities_by_province(province_uuid UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  type TEXT,
  is_capital BOOLEAN,
  is_major_city BOOLEAN,
  population INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.type,
    c.is_capital,
    c.is_major_city,
    c.population
  FROM public.indonesian_regencies c
  WHERE c.province_id = province_uuid
  ORDER BY c.is_capital DESC, c.is_major_city DESC, c.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search cities by name (for autocomplete)
CREATE OR REPLACE FUNCTION public.search_cities(search_term TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  type TEXT,
  province_name TEXT,
  is_major_city BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.type,
    p.name as province_name,
    c.is_major_city
  FROM public.indonesian_regencies c
  JOIN public.indonesian_provinces p ON c.province_id = p.id
  WHERE c.name ILIKE '%' || search_term || '%'
  ORDER BY c.is_major_city DESC, c.name ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.indonesian_provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indonesian_regencies ENABLE ROW LEVEL SECURITY;

-- Policies for public read access (needed for dropdowns)
CREATE POLICY "Provinces viewable by authenticated users" ON public.indonesian_provinces
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Cities viewable by authenticated users" ON public.indonesian_regencies
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- CLEANUP HELPER FUNCTION
-- ============================================================================

-- Drop the helper function as it's no longer needed
DROP FUNCTION IF EXISTS get_province_id(TEXT);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify setup
SELECT 
  'Indonesian Address System Setup Complete!' as status,
  (SELECT COUNT(*) FROM public.indonesian_provinces) as provinces_count,
  (SELECT COUNT(*) FROM public.indonesian_regencies) as cities_count,
  (SELECT COUNT(*) FROM public.indonesian_regencies WHERE is_major_city = true) as major_cities_count;

-- Test province dropdown function
SELECT * FROM public.get_provinces_dropdown() LIMIT 5;

-- Test cities by province function (using Jakarta as example)
SELECT * FROM public.get_cities_by_province(
  (SELECT id FROM public.indonesian_provinces WHERE name = 'DKI Jakarta')
) LIMIT 5;

-- Test city search function
SELECT * FROM public.search_cities('Jakarta') LIMIT 5;