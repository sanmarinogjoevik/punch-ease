-- Create enum for equipment types
CREATE TYPE public.equipment_type AS ENUM ('refrigerator', 'freezer');

-- Create equipment table
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type equipment_type NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "All authenticated users can view equipment" 
ON public.equipment 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage equipment" 
ON public.equipment 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default equipment from the hardcoded list
INSERT INTO public.equipment (name, type, description) VALUES
('Kyl 1', 'refrigerator', 'Huvudkyl för kött och mejeri'),
('Kyl 2', 'refrigerator', 'Kyl för grönsaker'),
('Kyl 3', 'refrigerator', 'Reservkyl'),
('Frys A', 'freezer', 'Huvudfrys för kött'),
('Frys B', 'freezer', 'Frys för glass och frysta varor'),
('Frys C', 'freezer', 'Reservfrys'),
('Displaykyl', 'refrigerator', 'Kyl för visning av produkter'),
('Vinskap', 'refrigerator', 'Särskild kyl för vin och drycker');