-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('consumer', 'farmer', 'lead_farmer', 'driver', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create profiles table for all users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  
  -- Consumer fields
  delivery_address TEXT,
  zip_code TEXT,
  delivery_days TEXT[], -- days of week they want deliveries
  
  -- Farmer fields (both regular and lead)
  farm_name TEXT,
  collection_point_lead_farmer_id UUID REFERENCES public.profiles(id), -- for regular farmers
  
  -- Lead farmer specific
  collection_point_address TEXT,
  delivery_schedule TEXT[], -- days they deliver (e.g., ['monday', 'thursday'])
  commission_rate DECIMAL DEFAULT 5.0, -- percentage
  
  -- Driver fields
  vehicle_type TEXT,
  vehicle_make TEXT,
  vehicle_year TEXT,
  license_number TEXT,
  
  -- Payment info (will be expanded with Stripe)
  payment_setup_complete BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create farm profiles table
CREATE TABLE public.farm_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  farm_name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(farmer_id)
);

ALTER TABLE public.farm_profiles ENABLE ROW LEVEL SECURITY;

-- Create farm photos table
CREATE TABLE public.farm_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_profile_id UUID REFERENCES public.farm_profiles(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.farm_photos ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_profile_id UUID REFERENCES public.farm_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  unit TEXT NOT NULL, -- 'lb', 'bunch', 'each', etc.
  available_quantity INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create orders table with cutoff logic
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  delivery_date DATE NOT NULL,
  delivery_batch_id UUID, -- will reference delivery_batches
  status TEXT DEFAULT 'pending', -- pending, confirmed, in_transit, delivered, cancelled
  total_amount DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure orders are placed before 11:59 PM the night before
  CONSTRAINT valid_order_time CHECK (
    created_at < (delivery_date::timestamp - interval '1 second')
  )
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL NOT NULL,
  subtotal DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create delivery batches table (for grouping customers by proximity)
CREATE TABLE public.delivery_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_farmer_id UUID REFERENCES public.profiles(id) NOT NULL,
  driver_id UUID REFERENCES public.profiles(id),
  delivery_date DATE NOT NULL,
  batch_number INTEGER NOT NULL,
  zip_codes TEXT[], -- zips included in this batch
  status TEXT DEFAULT 'pending', -- pending, assigned, in_progress, completed
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.delivery_batches ENABLE ROW LEVEL SECURITY;

-- Add foreign key to orders
ALTER TABLE public.orders 
ADD CONSTRAINT fk_delivery_batch 
FOREIGN KEY (delivery_batch_id) 
REFERENCES public.delivery_batches(id);

-- Create routes table for driver route assignments
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  delivery_batch_id UUID REFERENCES public.delivery_batches(id) NOT NULL,
  route_data JSONB, -- will store waypoints, directions, etc.
  status TEXT DEFAULT 'assigned', -- assigned, in_progress, completed
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can view their own profile, admins can view all
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Farm profiles: Public read, farmers can manage their own
CREATE POLICY "Anyone can view farm profiles"
ON public.farm_profiles FOR SELECT
USING (true);

CREATE POLICY "Farmers can create their farm profile"
ON public.farm_profiles FOR INSERT
WITH CHECK (
  auth.uid() = farmer_id AND
  (public.has_role(auth.uid(), 'farmer') OR public.has_role(auth.uid(), 'lead_farmer'))
);

CREATE POLICY "Farmers can update their farm profile"
ON public.farm_profiles FOR UPDATE
USING (auth.uid() = farmer_id);

-- Farm photos: Public read, farmers can manage their own
CREATE POLICY "Anyone can view farm photos"
ON public.farm_photos FOR SELECT
USING (true);

CREATE POLICY "Farmers can manage their farm photos"
ON public.farm_photos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.farm_profiles
    WHERE id = farm_profile_id AND farmer_id = auth.uid()
  )
);

CREATE POLICY "Farmers can delete their farm photos"
ON public.farm_photos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.farm_profiles
    WHERE id = farm_profile_id AND farmer_id = auth.uid()
  )
);

-- Products: Public read, farmers can manage their own
CREATE POLICY "Anyone can view products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Farmers can manage their products"
ON public.products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.farm_profiles
    WHERE id = farm_profile_id AND farmer_id = auth.uid()
  )
);

CREATE POLICY "Farmers can update their products"
ON public.products FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.farm_profiles
    WHERE id = farm_profile_id AND farmer_id = auth.uid()
  )
);

CREATE POLICY "Farmers can delete their products"
ON public.products FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.farm_profiles
    WHERE id = farm_profile_id AND farmer_id = auth.uid()
  )
);

-- Orders: Consumers can view/manage their own, admins can view all
CREATE POLICY "Consumers can view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = consumer_id);

CREATE POLICY "Consumers can create orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = consumer_id AND public.has_role(auth.uid(), 'consumer'));

CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Order items: Users can view items for their orders
CREATE POLICY "Users can view order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_id AND orders.consumer_id = auth.uid()
  )
);

-- Delivery batches: Drivers and lead farmers can view relevant batches
CREATE POLICY "Lead farmers can view their batches"
ON public.delivery_batches FOR SELECT
USING (auth.uid() = lead_farmer_id);

CREATE POLICY "Drivers can view assigned batches"
ON public.delivery_batches FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all batches"
ON public.delivery_batches FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Routes: Drivers can view their routes
CREATE POLICY "Drivers can view own routes"
ON public.routes FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all routes"
ON public.routes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- User roles: Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.farm_profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.delivery_batches
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();