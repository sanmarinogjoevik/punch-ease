-- Fix the trigger to not overwrite company_id if it's already set
-- This allows edge functions (like auto-punch-in) to set company_id directly
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only set company_id if it's not already set (null)
  -- This allows edge functions to set it directly
  IF NEW.company_id IS NULL THEN
    -- Get the company_id from the user's profile using auth.uid()
    SELECT company_id INTO NEW.company_id
    FROM public.profiles
    WHERE user_id = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$function$;