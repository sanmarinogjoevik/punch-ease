-- Create temperature_logs table
CREATE TABLE public.temperature_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  equipment_name TEXT NOT NULL,
  temperature DECIMAL(5,2) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.temperature_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for temperature logs
CREATE POLICY "Employees can view their own temperature logs" 
ON public.temperature_logs 
FOR SELECT 
USING (auth.uid() = employee_id);

CREATE POLICY "Employees can insert their own temperature logs" 
ON public.temperature_logs 
FOR INSERT 
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admins can manage all temperature logs" 
ON public.temperature_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_temperature_logs_updated_at
BEFORE UPDATE ON public.temperature_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_temperature_logs_employee_id ON public.temperature_logs(employee_id);
CREATE INDEX idx_temperature_logs_timestamp ON public.temperature_logs(timestamp);
CREATE INDEX idx_temperature_logs_equipment ON public.temperature_logs(equipment_name);