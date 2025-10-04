-- Create a trigger function to automatically set company_id from the authenticated user's profile
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the company_id from the user's profile
  SELECT company_id INTO NEW.company_id
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to bedriftskunder table
DROP TRIGGER IF EXISTS set_bedriftskunder_company_id ON public.bedriftskunder;
CREATE TRIGGER set_bedriftskunder_company_id
  BEFORE INSERT ON public.bedriftskunder
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

-- Apply trigger to beställningar table
DROP TRIGGER IF EXISTS set_beställningar_company_id ON public.beställningar;
CREATE TRIGGER set_beställningar_company_id
  BEFORE INSERT ON public.beställningar
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

-- Apply trigger to equipment table
DROP TRIGGER IF EXISTS set_equipment_company_id ON public.equipment;
CREATE TRIGGER set_equipment_company_id
  BEFORE INSERT ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

-- Apply trigger to shifts table
DROP TRIGGER IF EXISTS set_shifts_company_id ON public.shifts;
CREATE TRIGGER set_shifts_company_id
  BEFORE INSERT ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

-- Apply trigger to temperature_logs table
DROP TRIGGER IF EXISTS set_temperature_logs_company_id ON public.temperature_logs;
CREATE TRIGGER set_temperature_logs_company_id
  BEFORE INSERT ON public.temperature_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

-- Apply trigger to time_entries table
DROP TRIGGER IF EXISTS set_time_entries_company_id ON public.time_entries;
CREATE TRIGGER set_time_entries_company_id
  BEFORE INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();