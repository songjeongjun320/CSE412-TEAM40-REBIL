-- STEP 3: ADD STATISTICS TABLES TO EXISTING REBIL SCHEMA
-- Execute this to add the new statistics tables to your existing database

-- ============================================================================
-- CREATE STATISTICS TABLES
-- ============================================================================

-- Admin Statistics (platform-wide stats for admins)
CREATE TABLE IF NOT EXISTS public.admin_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,2) NOT NULL,
  metric_type TEXT NOT NULL, -- 'count', 'currency', 'percentage', 'average'
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_name, period_start, period_end)
);

-- Host Statistics (individual host performance stats)
CREATE TABLE IF NOT EXISTS public.host_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  total_cars INTEGER DEFAULT 0,
  active_cars INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  completed_bookings INTEGER DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  response_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  acceptance_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(host_id)
);

-- Renter Statistics (individual renter activity stats)
CREATE TABLE IF NOT EXISTS public.renter_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  renter_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  total_bookings INTEGER DEFAULT 0,
  completed_bookings INTEGER DEFAULT 0,
  cancelled_bookings INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  favorite_car_types TEXT[],
  preferred_locations TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(renter_id)
);

-- ============================================================================
-- CREATE INDEXES FOR NEW TABLES
-- ============================================================================

-- Statistics table indexes
CREATE INDEX IF NOT EXISTS idx_admin_stats_metric_name ON public.admin_stats(metric_name);
CREATE INDEX IF NOT EXISTS idx_admin_stats_period ON public.admin_stats(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_host_stats_host_id ON public.host_stats(host_id);
CREATE INDEX IF NOT EXISTS idx_renter_stats_renter_id ON public.renter_stats(renter_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

ALTER TABLE public.admin_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renter_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Statistics Policies
CREATE POLICY "Admins can view all admin stats" ON public.admin_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'ADMIN' 
      AND ur.is_active = true
    )
  );

CREATE POLICY "Admins can manage admin stats" ON public.admin_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'ADMIN' 
      AND ur.is_active = true
    )
  );

CREATE POLICY "Hosts can view their own stats" ON public.host_stats
  FOR SELECT USING (auth.uid() = host_id);

CREATE POLICY "Admins can view all host stats" ON public.host_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'ADMIN' 
      AND ur.is_active = true
    )
  );

CREATE POLICY "System can manage host stats" ON public.host_stats
  FOR ALL USING (true);

CREATE POLICY "Renters can view their own stats" ON public.renter_stats
  FOR SELECT USING (auth.uid() = renter_id);

CREATE POLICY "Admins can view all renter stats" ON public.renter_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'ADMIN' 
      AND ur.is_active = true
    )
  );

CREATE POLICY "System can manage renter stats" ON public.renter_stats
  FOR ALL USING (true);

-- ============================================================================
-- CREATE TRIGGERS FOR NEW TABLES
-- ============================================================================

CREATE TRIGGER update_admin_stats_updated_at 
  BEFORE UPDATE ON public.admin_stats 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_host_stats_updated_at 
  BEFORE UPDATE ON public.host_stats 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_renter_stats_updated_at 
  BEFORE UPDATE ON public.renter_stats 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  'STATISTICS TABLES ADDED SUCCESSFULLY!' as status,
  COUNT(*) as new_tables_created
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('admin_stats', 'host_stats', 'renter_stats');