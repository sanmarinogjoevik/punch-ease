-- Update role from superadmin to admin for San Marino Gjøvik user
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = 'd5f46f7b-b2e9-42f1-b3da-7dede8a86b15';