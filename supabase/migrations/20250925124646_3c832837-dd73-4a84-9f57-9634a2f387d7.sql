-- Update Willys Mansour's shift on 2025-09-25 to correct time
UPDATE shifts 
SET start_time = '2025-09-25 09:00:00+02:00', 
    end_time = '2025-09-25 14:40:00+02:00',
    updated_at = now()
WHERE employee_id = '2ee11f99-2cd0-4a85-8498-fdf227d5999b' 
  AND DATE(start_time) = '2025-09-25';