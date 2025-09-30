-- Create bedriftskunder table
CREATE TABLE public.bedriftskunder (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firmanamn TEXT NOT NULL,
  orgnr TEXT NOT NULL UNIQUE,
  adress TEXT NOT NULL,
  telefon TEXT,
  epost TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create beställningar table
CREATE TABLE public.beställningar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bedriftskunde_id UUID NOT NULL REFERENCES public.bedriftskunder(id) ON DELETE CASCADE,
  beskrivning TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bedriftskunder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beställningar ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bedriftskunder
CREATE POLICY "Admins can manage all bedriftskunder"
  ON public.bedriftskunder
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated users can view bedriftskunder"
  ON public.bedriftskunder
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for beställningar
CREATE POLICY "Admins can view all beställningar"
  ON public.beställningar
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view their own beställningar"
  ON public.beställningar
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all beställningar"
  ON public.beställningar
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can insert their own beställningar"
  ON public.beställningar
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Create triggers for updated_at
CREATE TRIGGER update_bedriftskunder_updated_at
  BEFORE UPDATE ON public.bedriftskunder
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beställningar_updated_at
  BEFORE UPDATE ON public.beställningar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_beställningar_bedriftskunde_id ON public.beställningar(bedriftskunde_id);
CREATE INDEX idx_beställningar_created_by ON public.beställningar(created_by);
CREATE INDEX idx_bedriftskunder_orgnr ON public.bedriftskunder(orgnr);