-- STEP 7: ADMIN APPROVAL SYSTEM (FIXED VERSION)
-- Execute this after running 6-car-images-storage-setup-FIXED.sql

-- ============================================================================
-- DROP EXISTING FUNCTIONS FIRST
-- ============================================================================

-- Drop the existing function with old return type
DROP FUNCTION IF EXISTS public.submit_car_for_approval(UUID, UUID);

-- ============================================================================
-- ADMIN APPROVAL FUNCTIONS
-- ============================================================================

-- Function to approve a car (admin only)
CREATE OR REPLACE FUNCTION public.approve_car(
  admin_user_id UUID,
  car_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_user_admin(admin_user_id) THEN
    RAISE EXCEPTION 'Only administrators can approve cars';
  END IF;
  
  -- Update car status to ACTIVE
  UPDATE public.cars 
  SET status = 'ACTIVE', updated_at = NOW()
  WHERE id = car_uuid 
  AND status = 'PENDING_APPROVAL';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Log admin action
  INSERT INTO public.admin_actions (
    admin_id, 
    action_type, 
    target_id, 
    target_type, 
    reason,
    details
  ) VALUES (
    admin_user_id,
    'CAR_APPROVE',
    car_uuid,
    'car',
    'Car approved by admin',
    json_build_object(
      'car_id', car_uuid,
      'new_status', 'ACTIVE',
      'previous_status', 'PENDING_APPROVAL'
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a car (admin only)
CREATE OR REPLACE FUNCTION public.reject_car(
  admin_user_id UUID,
  car_uuid UUID,
  rejection_reason TEXT DEFAULT 'Car rejected by admin'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_user_admin(admin_user_id) THEN
    RAISE EXCEPTION 'Only administrators can reject cars';
  END IF;
  
  -- Update car status to INACTIVE
  UPDATE public.cars 
  SET status = 'INACTIVE', updated_at = NOW()
  WHERE id = car_uuid 
  AND status = 'PENDING_APPROVAL';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Log admin action
  INSERT INTO public.admin_actions (
    admin_id, 
    action_type, 
    target_id, 
    target_type, 
    reason,
    details
  ) VALUES (
    admin_user_id,
    'CAR_SUSPEND',
    car_uuid,
    'car',
    rejection_reason,
    json_build_object(
      'car_id', car_uuid,
      'new_status', 'INACTIVE',
      'previous_status', 'PENDING_APPROVAL',
      'rejection_reason', rejection_reason
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit car for approval (NEW JSON RETURN TYPE)
CREATE OR REPLACE FUNCTION public.submit_car_for_approval(
  host_user_id UUID,
  car_uuid UUID
)
RETURNS JSON AS $$
DECLARE
  car_record RECORD;
  image_count INTEGER;
BEGIN
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
  
  -- Check current status
  IF car_record.status != 'DRAFT' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only draft cars can be submitted for approval. Current status: ' || car_record.status,
      'error_code', 'INVALID_STATUS',
      'current_status', car_record.status
    );
  END IF;
  
  -- Check if car has at least one image
  SELECT COUNT(*) INTO image_count
  FROM public.car_images 
  WHERE car_id = car_uuid;
  
  IF image_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Car must have at least one image before submission. Please upload images first.',
      'error_code', 'NO_IMAGES',
      'image_count', image_count
    );
  END IF;
  
  -- Update car status to PENDING_APPROVAL
  UPDATE public.cars 
  SET status = 'PENDING_APPROVAL', updated_at = NOW()
  WHERE id = car_uuid;
  
  -- Return success response
  RETURN json_build_object(
    'success', true,
    'message', 'Car successfully submitted for approval',
    'car_id', car_uuid,
    'image_count', image_count,
    'new_status', 'PENDING_APPROVAL'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM,
      'error_code', 'DATABASE_ERROR',
      'sql_state', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending approval cars (admin only)
CREATE OR REPLACE FUNCTION public.get_pending_approval_cars(admin_user_id UUID)
RETURNS TABLE (
  id UUID,
  host_id UUID,
  host_name TEXT,
  host_email TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  license_plate TEXT,
  color TEXT,
  transmission TEXT,
  fuel_type TEXT,
  seats INTEGER,
  description TEXT,
  daily_rate DECIMAL(10,2),
  location JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  image_count INTEGER,
  primary_image_url TEXT
) AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_user_admin(admin_user_id) THEN
    RAISE EXCEPTION 'Only administrators can view pending approval cars';
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.host_id,
    up.full_name as host_name,
    up.email as host_email,
    c.make,
    c.model,
    c.year,
    c.license_plate,
    c.color,
    c.transmission::TEXT,
    c.fuel_type::TEXT,
    c.seats,
    c.description,
    c.daily_rate,
    c.location,
    c.created_at,
    c.updated_at,
    COALESCE(img_count.image_count, 0)::INTEGER as image_count,
    primary_img.image_url as primary_image_url
  FROM public.cars c
  JOIN public.user_profiles up ON c.host_id = up.id
  LEFT JOIN (
    SELECT car_id, COUNT(*) as image_count
    FROM public.car_images
    GROUP BY car_id
  ) img_count ON c.id = img_count.car_id
  LEFT JOIN (
    SELECT car_id, image_url
    FROM public.car_images
    WHERE is_primary = TRUE
  ) primary_img ON c.id = primary_img.car_id
  WHERE c.status = 'PENDING_APPROVAL'
  ORDER BY c.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADDITIONAL RLS POLICIES FOR ADMIN APPROVAL (WITH DROP IF EXISTS)
-- ============================================================================

DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admins can view pending approval cars" ON public.cars;
    DROP POLICY IF EXISTS "Admins can update car status for approval" ON public.cars;
    
    -- Create new policies
    CREATE POLICY "Admins can view pending approval cars" ON public.cars
      FOR SELECT USING (
        status = 'PENDING_APPROVAL' AND
        EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = auth.uid() 
          AND ur.role = 'ADMIN' 
          AND ur.is_active = true
        )
      );

    CREATE POLICY "Admins can update car status for approval" ON public.cars
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = auth.uid() 
          AND ur.role = 'ADMIN' 
          AND ur.is_active = true
        )
      );
END $$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- This script sets up:
-- ✅ Admin approval functions (with proper DROP FUNCTION)
-- ✅ Car submission for approval function (JSON return type)
-- ✅ Additional RLS policies for admin actions
-- ✅ Admin action logging
-- 
-- Next steps:
-- 1. Create admin interface for car approval
-- 2. Update vehicle submission workflow
-- 3. Test approval process