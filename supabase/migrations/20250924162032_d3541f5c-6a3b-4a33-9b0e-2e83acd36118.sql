-- Add phone and personal number fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN phone TEXT,
ADD COLUMN personal_number TEXT;