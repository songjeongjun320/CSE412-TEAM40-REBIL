-- ============================================================================
-- REVIEWS RATING SYSTEM SETUP
-- This file sets up RLS policies, database functions, and triggers for reviews
-- ============================================================================

-- ============================================================================
-- 1. CREATE RLS POLICIES FOR REVIEWS TABLE
-- ============================================================================

-- Drop existing policies if they exist (for clean setup)
DROP POLICY IF EXISTS "Users can view public reviews" ON public.reviews;
DROP POLICY IF EXISTS "Booking participants can view their reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews for their completed bookings" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;

-- Policy 1: Users can view public reviews
CREATE POLICY "Users can view public reviews" ON public.reviews
  FOR SELECT USING (
    auth.role() = 'authenticated' AND is_public = true
  );

-- Policy 2: Booking participants can view all reviews related to their bookings
CREATE POLICY "Booking participants can view their reviews" ON public.reviews
  FOR SELECT USING (
    auth.uid() = reviewer_id OR 
    auth.uid() = reviewed_id OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id 
      AND (b.renter_id = auth.uid() OR b.host_id = auth.uid())
    )
  );

-- Policy 3: Users can create reviews only for completed bookings they participated in
CREATE POLICY "Users can create reviews for their completed bookings" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id 
      AND b.status = 'COMPLETED'
      AND (
        (b.renter_id = auth.uid() AND reviewed_id = b.host_id) OR
        (b.host_id = auth.uid() AND reviewed_id = b.renter_id)
      )
    )
  );

-- Policy 4: Users can update their own reviews (within time limit - handled by function)
CREATE POLICY "Users can update their own reviews" ON public.reviews
  FOR UPDATE USING (
    auth.uid() = reviewer_id
  );

-- ============================================================================
-- 2. CREATE RATING CALCULATION FUNCTIONS
-- ============================================================================

-- Function to calculate average rating for a user
CREATE OR REPLACE FUNCTION public.calculate_user_average_rating(user_uuid UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  avg_rating DECIMAL(3,2);
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 2) INTO avg_rating
  FROM public.reviews
  WHERE reviewed_id = user_uuid 
    AND is_public = true
    AND rating IS NOT NULL;
  
  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate average rating for a car
CREATE OR REPLACE FUNCTION public.calculate_car_average_rating(car_uuid UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  avg_rating DECIMAL(3,2);
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 2) INTO avg_rating
  FROM public.reviews
  WHERE car_id = car_uuid 
    AND is_public = true
    AND rating IS NOT NULL;
  
  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get review statistics for a user
CREATE OR REPLACE FUNCTION public.get_user_review_stats(user_uuid UUID)
RETURNS TABLE(
  total_reviews INTEGER,
  average_rating DECIMAL(3,2),
  rating_1_count INTEGER,
  rating_2_count INTEGER,
  rating_3_count INTEGER,
  rating_4_count INTEGER,
  rating_5_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_reviews,
    ROUND(AVG(rating)::numeric, 2)::DECIMAL(3,2) as average_rating,
    COUNT(CASE WHEN rating = 1 THEN 1 END)::INTEGER as rating_1_count,
    COUNT(CASE WHEN rating = 2 THEN 1 END)::INTEGER as rating_2_count,
    COUNT(CASE WHEN rating = 3 THEN 1 END)::INTEGER as rating_3_count,
    COUNT(CASE WHEN rating = 4 THEN 1 END)::INTEGER as rating_4_count,
    COUNT(CASE WHEN rating = 5 THEN 1 END)::INTEGER as rating_5_count
  FROM public.reviews
  WHERE reviewed_id = user_uuid 
    AND is_public = true
    AND rating IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get review statistics for a car
CREATE OR REPLACE FUNCTION public.get_car_review_stats(car_uuid UUID)
RETURNS TABLE(
  total_reviews INTEGER,
  average_rating DECIMAL(3,2),
  rating_1_count INTEGER,
  rating_2_count INTEGER,
  rating_3_count INTEGER,
  rating_4_count INTEGER,
  rating_5_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_reviews,
    ROUND(AVG(rating)::numeric, 2)::DECIMAL(3,2) as average_rating,
    COUNT(CASE WHEN rating = 1 THEN 1 END)::INTEGER as rating_1_count,
    COUNT(CASE WHEN rating = 2 THEN 1 END)::INTEGER as rating_2_count,
    COUNT(CASE WHEN rating = 3 THEN 1 END)::INTEGER as rating_3_count,
    COUNT(CASE WHEN rating = 4 THEN 1 END)::INTEGER as rating_4_count,
    COUNT(CASE WHEN rating = 5 THEN 1 END)::INTEGER as rating_5_count
  FROM public.reviews
  WHERE car_id = car_uuid 
    AND is_public = true
    AND rating IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a review with validation
CREATE OR REPLACE FUNCTION public.create_review_with_validation(
  p_booking_id UUID,
  p_reviewer_id UUID,
  p_reviewed_id UUID,
  p_car_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT true
)
RETURNS TABLE(
  success BOOLEAN,
  review_id UUID,
  message TEXT
) AS $$
DECLARE
  v_review_id UUID;
  v_booking_status TEXT;
  v_existing_review_count INTEGER;
BEGIN
  -- Check if booking exists and is completed
  SELECT b.status INTO v_booking_status
  FROM public.bookings b
  WHERE b.id = p_booking_id 
    AND (b.renter_id = p_reviewer_id OR b.host_id = p_reviewer_id);

  IF v_booking_status IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Booking not found or you are not a participant';
    RETURN;
  END IF;

  IF v_booking_status != 'COMPLETED' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Can only review completed bookings';
    RETURN;
  END IF;

  -- Check for existing review by this reviewer for this booking
  SELECT COUNT(*) INTO v_existing_review_count
  FROM public.reviews
  WHERE booking_id = p_booking_id AND reviewer_id = p_reviewer_id;

  IF v_existing_review_count > 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'You have already reviewed this booking';
    RETURN;
  END IF;

  -- Validate rating range
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Rating must be between 1 and 5';
    RETURN;
  END IF;

  -- Insert the review
  INSERT INTO public.reviews (
    booking_id,
    reviewer_id,
    reviewed_id,
    car_id,
    rating,
    comment,
    is_public
  ) VALUES (
    p_booking_id,
    p_reviewer_id,
    p_reviewed_id,
    p_car_id,
    p_rating,
    p_comment,
    p_is_public
  ) RETURNING id INTO v_review_id;

  RETURN QUERY SELECT true, v_review_id, 'Review created successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update host and renter stats after review
CREATE OR REPLACE FUNCTION public.update_stats_after_review()
RETURNS TRIGGER AS $$
BEGIN
  -- Update host stats (average_rating)
  UPDATE public.host_stats 
  SET 
    average_rating = public.calculate_user_average_rating(NEW.reviewed_id),
    updated_at = NOW()
  WHERE host_id = NEW.reviewed_id;

  -- Update renter stats (average_rating) 
  UPDATE public.renter_stats 
  SET 
    average_rating = public.calculate_user_average_rating(NEW.reviewed_id),
    updated_at = NOW()
  WHERE renter_id = NEW.reviewed_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CREATE TRIGGERS FOR AUTOMATIC STATS UPDATES
-- ============================================================================

-- Trigger to update stats after review insert
DROP TRIGGER IF EXISTS update_stats_after_review_insert ON public.reviews;
CREATE TRIGGER update_stats_after_review_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stats_after_review();

-- Trigger to update stats after review update
DROP TRIGGER IF EXISTS update_stats_after_review_update ON public.reviews;
CREATE TRIGGER update_stats_after_review_update
  AFTER UPDATE OF rating ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stats_after_review();

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding reviews by reviewed user
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_id ON public.reviews(reviewed_id);

-- Index for finding reviews by car
CREATE INDEX IF NOT EXISTS idx_reviews_car_id ON public.reviews(car_id);

-- Index for public reviews
CREATE INDEX IF NOT EXISTS idx_reviews_public ON public.reviews(is_public) WHERE is_public = true;

-- Index for reviews by rating
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);

-- Composite index for user reviews with rating
CREATE INDEX IF NOT EXISTS idx_reviews_user_rating ON public.reviews(reviewed_id, rating, is_public);

-- Composite index for car reviews with rating
CREATE INDEX IF NOT EXISTS idx_reviews_car_rating ON public.reviews(car_id, rating, is_public);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  'Reviews rating system setup complete!' as status,
  COUNT(*) as policies_created
FROM information_schema.table_privileges 
WHERE table_name = 'reviews' AND table_schema = 'public';