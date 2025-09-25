-- Add business hours column to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN business_hours JSONB DEFAULT '[
  {"day": 1, "dayName": "Måndag", "isOpen": true, "openTime": "08:00", "closeTime": "17:00"},
  {"day": 2, "dayName": "Tisdag", "isOpen": true, "openTime": "08:00", "closeTime": "17:00"},
  {"day": 3, "dayName": "Onsdag", "isOpen": true, "openTime": "08:00", "closeTime": "17:00"},
  {"day": 4, "dayName": "Torsdag", "isOpen": true, "openTime": "08:00", "closeTime": "17:00"},
  {"day": 5, "dayName": "Fredag", "isOpen": true, "openTime": "08:00", "closeTime": "17:00"},
  {"day": 6, "dayName": "Lördag", "isOpen": false, "openTime": "09:00", "closeTime": "15:00"},
  {"day": 0, "dayName": "Söndag", "isOpen": false, "openTime": "10:00", "closeTime": "14:00"}
]'::jsonb;