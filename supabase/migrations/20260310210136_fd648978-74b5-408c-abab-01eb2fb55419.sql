
-- ═══════════════════════════════════════════════════════════
-- Phase 1: Core enums, tables, RLS, triggers, seed data
-- ═══════════════════════════════════════════════════════════

-- ── Enums ──
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE public.location_type AS ENUM ('central_warehouse', 'person', 'department', 'shipment', 'overseas_site', 'flight_case', 'project', 'other');
CREATE TYPE public.source_type AS ENUM ('manual', 'bom', 'priority');
CREATE TYPE public.serial_status AS ENUM ('available', 'checked_out', 'in_transit', 'under_test', 'damaged', 'lost', 'archived');

-- ── Timestamp trigger function ──
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ═══════════════════════════════════════════════════════════
-- Profiles table (auto-created on signup)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- User Roles table (separate from profiles for security)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ── Security definer function to check roles (avoids RLS recursion) ──
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ── Get user role function ──
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- ═══════════════════════════════════════════════════════════
-- Auto-create profile + default role on signup
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════
-- Profiles RLS policies
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- User Roles RLS policies
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- Items table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,
  item_name TEXT,
  item_description TEXT,
  category TEXT,
  is_serialized BOOLEAN NOT NULL DEFAULT false,
  source_type source_type NOT NULL DEFAULT 'manual',
  source_reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view items"
  ON public.items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can insert items"
  ON public.items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins can update items"
  ON public.items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete items"
  ON public.items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- Locations table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location_type location_type NOT NULL DEFAULT 'other',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view locations"
  ON public.locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can insert locations"
  ON public.locations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins can update locations"
  ON public.locations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete locations"
  ON public.locations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- Bulk Inventory table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.bulk_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, location_id)
);

ALTER TABLE public.bulk_inventory ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_bulk_inventory_updated_at
  BEFORE UPDATE ON public.bulk_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view bulk inventory"
  ON public.bulk_inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage bulk inventory"
  ON public.bulk_inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- ═══════════════════════════════════════════════════════════
-- Serial Units table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.serial_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL UNIQUE,
  current_location_id UUID NOT NULL REFERENCES public.locations(id),
  status serial_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.serial_units ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_serial_units_updated_at
  BEFORE UPDATE ON public.serial_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view serial units"
  ON public.serial_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage serial units"
  ON public.serial_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- ═══════════════════════════════════════════════════════════
-- Seed: Default Central Warehouse location
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.locations (name, location_type, notes)
VALUES ('Central Warehouse', 'central_warehouse', 'Default central warehouse location');
