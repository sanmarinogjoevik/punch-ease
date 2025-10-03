-- Remove foreign key constraints that were preventing data operations

ALTER TABLE shifts 
DROP CONSTRAINT IF EXISTS shifts_employee_id_fkey;

ALTER TABLE time_entries 
DROP CONSTRAINT IF EXISTS time_entries_employee_id_fkey;

ALTER TABLE temperature_logs 
DROP CONSTRAINT IF EXISTS temperature_logs_employee_id_fkey;

ALTER TABLE beställningar 
DROP CONSTRAINT IF EXISTS beställningar_created_by_fkey;