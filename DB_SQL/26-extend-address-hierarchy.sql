-- =============================================
-- Migration 26: Extend Address Hierarchy
-- Add districts and villages tables to support complete Indonesian administrative hierarchy
-- =============================================

-- Create indonesian_districts table
CREATE TABLE IF NOT EXISTS public.indonesian_districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.indonesian_regencies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    government_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indonesian_villages table  
CREATE TABLE IF NOT EXISTS public.indonesian_villages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES public.indonesian_districts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    government_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_districts_city_id ON public.indonesian_districts(city_id);
CREATE INDEX IF NOT EXISTS idx_districts_gov_code ON public.indonesian_districts(government_code);
CREATE INDEX IF NOT EXISTS idx_districts_name ON public.indonesian_districts(name);

CREATE INDEX IF NOT EXISTS idx_villages_district_id ON public.indonesian_villages(district_id);
CREATE INDEX IF NOT EXISTS idx_villages_gov_code ON public.indonesian_villages(government_code);
CREATE INDEX IF NOT EXISTS idx_villages_name ON public.indonesian_villages(name);

-- Add unique constraints
ALTER TABLE public.indonesian_districts 
ADD CONSTRAINT unique_district_gov_code UNIQUE (government_code);

ALTER TABLE public.indonesian_villages 
ADD CONSTRAINT unique_village_gov_code UNIQUE (government_code);

-- Create updated_at trigger for districts
CREATE OR REPLACE FUNCTION update_indonesian_districts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_indonesian_districts_updated_at
    BEFORE UPDATE ON public.indonesian_districts
    FOR EACH ROW
    EXECUTE FUNCTION update_indonesian_districts_updated_at();

-- Create updated_at trigger for villages
CREATE OR REPLACE FUNCTION update_indonesian_villages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_indonesian_villages_updated_at
    BEFORE UPDATE ON public.indonesian_villages
    FOR EACH ROW
    EXECUTE FUNCTION update_indonesian_villages_updated_at();

-- =============================================
-- RPC Functions for Districts
-- =============================================

-- Get districts dropdown by city
CREATE OR REPLACE FUNCTION public.get_districts_by_city(city_uuid UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    government_code VARCHAR(20)
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.government_code
    FROM public.indonesian_districts d
    WHERE d.city_id = city_uuid
    ORDER BY d.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Search districts with autocomplete
CREATE OR REPLACE FUNCTION public.search_districts(
    search_term TEXT, 
    city_uuid UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    government_code VARCHAR(20),
    city_id UUID
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.government_code,
        d.city_id
    FROM public.indonesian_districts d
    WHERE 
        (city_uuid IS NULL OR d.city_id = city_uuid)
        AND d.name ILIKE '%' || search_term || '%'
    ORDER BY 
        CASE WHEN d.name ILIKE search_term || '%' THEN 1 ELSE 2 END,
        d.name ASC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Get district by government code
CREATE OR REPLACE FUNCTION public.get_district_by_government_code(code TEXT)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    government_code VARCHAR(20),
    city_id UUID
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.government_code,
        d.city_id
    FROM public.indonesian_districts d
    WHERE d.government_code = code;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RPC Functions for Villages
-- =============================================

-- Get villages dropdown by district
CREATE OR REPLACE FUNCTION public.get_villages_by_district(district_uuid UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    government_code VARCHAR(20)
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.name,
        v.government_code
    FROM public.indonesian_villages v
    WHERE v.district_id = district_uuid
    ORDER BY v.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Search villages with autocomplete
CREATE OR REPLACE FUNCTION public.search_villages(
    search_term TEXT, 
    district_uuid UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    government_code VARCHAR(20),
    district_id UUID
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.name,
        v.government_code,
        v.district_id
    FROM public.indonesian_villages v
    WHERE 
        (district_uuid IS NULL OR v.district_id = district_uuid)
        AND v.name ILIKE '%' || search_term || '%'
    ORDER BY 
        CASE WHEN v.name ILIKE search_term || '%' THEN 1 ELSE 2 END,
        v.name ASC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Get village by government code
CREATE OR REPLACE FUNCTION public.get_village_by_government_code(code TEXT)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    government_code VARCHAR(20),
    district_id UUID
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.name,
        v.government_code,
        v.district_id
    FROM public.indonesian_villages v
    WHERE v.government_code = code;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Row Level Security Policies
-- =============================================

-- Enable RLS on districts table
ALTER TABLE public.indonesian_districts ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read districts
CREATE POLICY "Districts are viewable by authenticated users" ON public.indonesian_districts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Enable RLS on villages table
ALTER TABLE public.indonesian_villages ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read villages
CREATE POLICY "Villages are viewable by authenticated users" ON public.indonesian_villages
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================
-- Helper Views for Enhanced Address Display
-- =============================================

-- View for complete address hierarchy
CREATE OR REPLACE VIEW public.address_hierarchy AS
SELECT 
    p.id as province_id,
    p.name as province_name,
    c.id as city_id,
    c.name as city_name,
    c.type as city_type,
    d.id as district_id,
    d.name as district_name,
    v.id as village_id,
    v.name as village_name,
    -- Use province code if available, otherwise use fallback
    p.code as province_code,
    -- Build regency code from city mapping
    NULL as city_code, -- To be populated by import service
    d.government_code as district_code,
    v.government_code as village_code
FROM public.indonesian_provinces p
JOIN public.indonesian_regencies c ON c.province_id = p.id
LEFT JOIN public.indonesian_districts d ON d.city_id = c.id
LEFT JOIN public.indonesian_villages v ON v.district_id = d.id;

-- =============================================
-- Grant permissions to service role
-- =============================================

-- Grant necessary permissions for the application service role
GRANT SELECT ON public.indonesian_districts TO service_role;
GRANT SELECT ON public.indonesian_villages TO service_role;
GRANT INSERT ON public.indonesian_districts TO service_role;
GRANT INSERT ON public.indonesian_villages TO service_role;
GRANT UPDATE ON public.indonesian_districts TO service_role;
GRANT UPDATE ON public.indonesian_villages TO service_role;

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION public.get_districts_by_city(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_districts(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_district_by_government_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_villages_by_district(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_villages(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_village_by_government_code(TEXT) TO authenticated;

-- Grant permissions on view
GRANT SELECT ON public.address_hierarchy TO authenticated;

-- =============================================
-- Validation and testing
-- =============================================

-- Verify tables exist with correct structure
DO $$ 
BEGIN
    -- Check if tables were created successfully
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indonesian_districts') THEN
        RAISE EXCEPTION 'indonesian_districts table was not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indonesian_villages') THEN
        RAISE EXCEPTION 'indonesian_villages table was not created';
    END IF;
    
    -- Check if indexes exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_districts_city_id') THEN
        RAISE EXCEPTION 'idx_districts_city_id index was not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_villages_district_id') THEN
        RAISE EXCEPTION 'idx_villages_district_id index was not created';
    END IF;
    
    RAISE NOTICE 'Migration 26 completed successfully: Address hierarchy tables and functions created';
END $$;

-- Add comment for migration tracking
COMMENT ON TABLE public.indonesian_districts IS 'Districts (Kecamatan) administrative level - Migration 26';
COMMENT ON TABLE public.indonesian_villages IS 'Villages (Desa/Kelurahan) administrative level - Migration 26';