-- STEP 2: CREATE FRESH REBIL SCHEMA
-- Execute this after running 1-delete-all-tables.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATE CUSTOM TYPES
-- ============================================================================

CREATE TYPE user_role_type AS ENUM ('ADMIN', 'HOST', 'RENTER');
CREATE TYPE verification_type AS ENUM ('ID_CARD', 'DRIVERS_LICENSE', 'PASSPORT', 'FACE_SCAN');
CREATE TYPE verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE transmission_type AS ENUM ('MANUAL', 'AUTOMATIC', 'CVT');
CREATE TYPE fuel_type AS ENUM ('GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID');
CREATE TYPE car_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');
CREATE TYPE insurance_type AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE payment_type AS ENUM ('BOOKING', 'SECURITY_DEPOSIT', 'EXTRA_CHARGES', 'REFUND');
CREATE TYPE admin_action_type AS ENUM ('USER_SUSPEND', 'USER_ACTIVATE', 'CAR_APPROVE', 'CAR_SUSPEND', 'DISPUTE_RESOLVE');

-- ============================================================================
-- CREATE CORE TABLES
-- ============================================================================

-- User Profiles (main user data)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  profile_image_url TEXT,
  address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- User Roles (multi-role support)
CREATE TABLE public.user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role user_role_type NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, role)
);

-- User Verifications (KYC documents)
CREATE TABLE public.user_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  verification_type verification_type NOT NULL,
  document_url TEXT,
  verification_data JSONB,
  status verification_status DEFAULT 'PENDING',
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cars (vehicle listings)
CREATE TABLE public.cars (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  vin TEXT UNIQUE,
  license_plate TEXT,
  color TEXT,
  transmission transmission_type NOT NULL,
  fuel_type fuel_type NOT NULL,
  seats INTEGER NOT NULL,
  doors INTEGER NOT NULL,
  description TEXT,
  features TEXT[],
  daily_rate DECIMAL(10,2) NOT NULL,
  weekly_rate DECIMAL(10,2),
  monthly_rate DECIMAL(10,2),
  location JSONB NOT NULL,
  delivery_available BOOLEAN DEFAULT FALSE,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  delivery_radius INTEGER DEFAULT 0,
  minimum_trip_duration INTEGER DEFAULT 1,
  status car_status DEFAULT 'DRAFT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Car Images (vehicle photos)
CREATE TABLE public.car_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id UUID REFERENCES public.cars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Car Availability (calendar management)
CREATE TABLE public.car_availability (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id UUID REFERENCES public.cars(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(car_id, start_date, end_date)
);

-- Bookings (reservations)
CREATE TABLE public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  car_id UUID REFERENCES public.cars(id) ON DELETE RESTRICT,
  renter_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  host_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  pickup_location JSONB,
  dropoff_location JSONB,
  insurance_type insurance_type NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  total_days INTEGER NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  insurance_fee DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  security_deposit DECIMAL(10,2) DEFAULT 0,
  status booking_status DEFAULT 'PENDING',
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments (transaction records)
CREATE TABLE public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'IDR',
  payment_type payment_type NOT NULL,
  payment_method_id TEXT,
  stripe_payment_intent_id TEXT,
  status payment_status DEFAULT 'PENDING',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages (user communication)
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  receiver_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews (rating system)
CREATE TABLE public.reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  reviewed_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  car_id UUID REFERENCES public.cars(id) ON DELETE RESTRICT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id, reviewer_id)
);

-- Admin Actions (audit log)
CREATE TABLE public.admin_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  action_type admin_action_type NOT NULL,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Statistics (platform-wide stats for admins)
CREATE TABLE public.admin_stats (
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
CREATE TABLE public.host_stats (
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
CREATE TABLE public.renter_stats (
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
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_cars_host_id ON public.cars(host_id);
CREATE INDEX idx_cars_status ON public.cars(status);
CREATE INDEX idx_cars_location ON public.cars USING GIN(location);
CREATE INDEX idx_bookings_car_id ON public.bookings(car_id);
CREATE INDEX idx_bookings_renter_id ON public.bookings(renter_id);
CREATE INDEX idx_bookings_host_id ON public.bookings(host_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_dates ON public.bookings(start_date, end_date);
CREATE INDEX idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX idx_messages_participants ON public.messages(sender_id, receiver_id);

-- Statistics table indexes
CREATE INDEX idx_admin_stats_metric_name ON public.admin_stats(metric_name);
CREATE INDEX idx_admin_stats_period ON public.admin_stats(period_start, period_end);
CREATE INDEX idx_host_stats_host_id ON public.host_stats(host_id);
CREATE INDEX idx_renter_stats_renter_id ON public.renter_stats(renter_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renter_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- User Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles viewable by authenticated users" ON public.user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- User Roles Policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their default renter role" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'RENTER');

-- Cars Policies
CREATE POLICY "Hosts can manage their own cars" ON public.cars
  FOR ALL USING (auth.uid() = host_id);

CREATE POLICY "Active cars viewable by authenticated users" ON public.cars
  FOR SELECT USING (auth.role() = 'authenticated' AND status = 'ACTIVE');

-- Car Images Policies
CREATE POLICY "Car images viewable with cars" ON public.car_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cars 
      WHERE cars.id = car_images.car_id 
      AND (cars.host_id = auth.uid() OR cars.status = 'ACTIVE')
    )
  );

CREATE POLICY "Hosts can manage their car images" ON public.car_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cars 
      WHERE cars.id = car_images.car_id 
      AND cars.host_id = auth.uid()
    )
  );

-- Bookings Policies
CREATE POLICY "Users can view their own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = renter_id OR auth.uid() = host_id);

CREATE POLICY "Renters can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = renter_id);

CREATE POLICY "Participants can update bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = renter_id OR auth.uid() = host_id);

-- Messages Policies
CREATE POLICY "Users can view their own messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

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
-- CREATE FUNCTIONS
-- ============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get user roles function
CREATE OR REPLACE FUNCTION public.get_user_roles(user_uuid UUID)
RETURNS TABLE(role user_role_type) AS $$
BEGIN
  RETURN QUERY
  SELECT ur.role
  FROM public.user_roles ur
  WHERE ur.user_id = user_uuid
    AND ur.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_user_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_uuid
      AND role = 'ADMIN'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is host
CREATE OR REPLACE FUNCTION public.is_user_host(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_uuid
      AND role = 'HOST'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile from auth data
  INSERT INTO public.user_profiles (id, email, full_name, profile_image_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Assign default RENTER role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'RENTER');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Updated at triggers
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_verifications_updated_at 
  BEFORE UPDATE ON public.user_verifications 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cars_updated_at 
  BEFORE UPDATE ON public.cars 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON public.bookings 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
  BEFORE UPDATE ON public.payments 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_stats_updated_at 
  BEFORE UPDATE ON public.admin_stats 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_host_stats_updated_at 
  BEFORE UPDATE ON public.host_stats 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_renter_stats_updated_at 
  BEFORE UPDATE ON public.renter_stats 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto user registration trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SETUP VERIFICATION
-- ============================================================================

SELECT 
  'REBIL SCHEMA SETUP COMPLETE!' as status,
  COUNT(*) as tables_created
FROM information_schema.tables 
WHERE table_schema = 'public';