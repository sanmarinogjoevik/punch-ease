-- Migration 1b: Create companies table and add company_id to all tables

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create default company "San Marino Gjøvik" and add company_id to all tables
DO $$
DECLARE
  default_company_id UUID;
BEGIN
  -- Insert default company
  INSERT INTO public.companies (name, email)
  VALUES ('San Marino Gjøvik', 'sanmarinogjoevik@gmail.com')
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_company_id;

  -- If company already exists, get its ID
  IF default_company_id IS NULL THEN
    SELECT id INTO default_company_id 
    FROM public.companies 
    WHERE name = 'San Marino Gjøvik' 
    LIMIT 1;
  END IF;

  -- Add company_id columns to all relevant tables
  
  -- profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);
    UPDATE public.profiles SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- bedriftskunder
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bedriftskunder' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.bedriftskunder ADD COLUMN company_id UUID REFERENCES public.companies(id);
    UPDATE public.bedriftskunder SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.bedriftskunder ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- beställningar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'beställningar' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.beställningar ADD COLUMN company_id UUID REFERENCES public.companies(id);
    UPDATE public.beställningar SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.beställningar ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- shifts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.shifts ADD COLUMN company_id UUID REFERENCES public.companies(id);
    UPDATE public.shifts SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.shifts ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- time_entries
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'time_entries' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.time_entries ADD COLUMN company_id UUID REFERENCES public.companies(id);
    UPDATE public.time_entries SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.time_entries ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- temperature_logs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'temperature_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.temperature_logs ADD COLUMN company_id UUID REFERENCES public.companies(id);
    UPDATE public.temperature_logs SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.temperature_logs ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- equipment
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'equipment' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.equipment ADD COLUMN company_id UUID REFERENCES public.companies(id);
    UPDATE public.equipment SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.equipment ALTER COLUMN company_id SET NOT NULL;
  END IF;

  -- company_settings (UNIQUE per company)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.company_settings ADD COLUMN company_id UUID REFERENCES public.companies(id) UNIQUE;
    UPDATE public.company_settings SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.company_settings ALTER COLUMN company_id SET NOT NULL;
  END IF;

END $$;

-- Add trigger for companies updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Basic RLS policies for companies
CREATE POLICY "Superadmin can manage all companies"
  ON public.companies
  FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admin can view their company"
  ON public.companies
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    AND id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Employees can view their company"
  ON public.companies
  FOR SELECT
  USING (
    id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );