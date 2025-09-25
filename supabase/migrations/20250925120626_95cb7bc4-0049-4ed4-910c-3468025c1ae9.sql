-- Create company_settings table
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT 'Mitt Företag AB',
  address text,
  postal_code text,
  city text,
  org_number text,
  phone text,
  email text,
  website text,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can view company settings" 
ON public.company_settings 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage company settings" 
ON public.company_settings 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default company settings
INSERT INTO public.company_settings (company_name, address, postal_code, city, org_number, phone, email)
VALUES (
  'Mitt Företag AB',
  'Företagsgatan 1',
  '123 45',
  'Stockholm',
  '556123-4567',
  '08-123 45 67',
  'info@mittforetag.se'
);