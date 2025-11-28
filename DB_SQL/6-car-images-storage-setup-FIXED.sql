-- STEP 6: CAR IMAGES STORAGE SETUP (FIXED VERSION)
-- Execute this after creating the vehicle-images bucket in Supabase Storage

-- ============================================================================
-- CAR IMAGES TABLE POLICIES (WITH IF NOT EXISTS LOGIC)
-- ============================================================================

-- Enable RLS on car_images table
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DO $$ 
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Car owners can insert their car images" ON public.car_images;
    DROP POLICY IF EXISTS "Anyone can view car images" ON public.car_images;
    DROP POLICY IF EXISTS "Car owners can update their car images" ON public.car_images;
    DROP POLICY IF EXISTS "Car owners can delete their car images" ON public.car_images;
    
    -- Create new policies
    CREATE POLICY "Car owners can insert their car images" ON public.car_images
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.cars 
          WHERE cars.id = car_images.car_id 
          AND cars.host_id = auth.uid()
        )
      );

    CREATE POLICY "Anyone can view car images" ON public.car_images
      FOR SELECT USING (true);

    CREATE POLICY "Car owners can update their car images" ON public.car_images
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.cars 
          WHERE cars.id = car_images.car_id 
          AND cars.host_id = auth.uid()
        )
      );

    CREATE POLICY "Car owners can delete their car images" ON public.car_images
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.cars 
          WHERE cars.id = car_images.car_id 
          AND cars.host_id = auth.uid()
        )
      );
END $$;