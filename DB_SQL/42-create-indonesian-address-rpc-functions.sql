-- Create RPC functions for Indonesian address system
-- Execute this in Supabase SQL Editor

-- 1. Function to get all provinces
CREATE OR REPLACE FUNCTION get_indonesian_provinces()
RETURNS TABLE (
  id uuid,
  code text,
  name text
) 
LANGUAGE SQL STABLE
AS $$
  SELECT 
    p.id,
    p.code,
    p.name
  FROM indonesian_provinces p
  ORDER BY p.name;
$$;

-- 2. Function to get regencies by province code
CREATE OR REPLACE FUNCTION get_indonesian_regencies(province_code_param text)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  province_code text
) 
LANGUAGE SQL STABLE
AS $$
  SELECT 
    r.id,
    r.code,
    r.name,
    r.province_code
  FROM indonesian_regencies r
  WHERE r.province_code = province_code_param
  ORDER BY r.name;
$$;

-- 3. Function to get districts by regency code
CREATE OR REPLACE FUNCTION get_indonesian_districts(regency_code_param text)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  regency_code text
) 
LANGUAGE SQL STABLE
AS $$
  SELECT 
    d.id,
    d.code,
    d.name,
    d.regency_code
  FROM indonesian_districts d
  WHERE d.regency_code = regency_code_param
  ORDER BY d.name;
$$;

-- 4. Function to get villages by district code
CREATE OR REPLACE FUNCTION get_indonesian_villages(district_code_param text)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  district_code text
) 
LANGUAGE SQL STABLE
AS $$
  SELECT 
    v.id,
    v.code,
    v.name,
    v.district_code
  FROM indonesian_villages v
  WHERE v.district_code = district_code_param
  ORDER BY v.name;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_indonesian_provinces() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_indonesian_regencies(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_indonesian_districts(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_indonesian_villages(text) TO authenticated, anon;
