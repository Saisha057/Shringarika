-- Check if returns table exists and view its structure
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'returns'
ORDER BY ordinal_position;

-- Check if the table exists at all
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'returns'
) AS returns_table_exists;

-- Count existing records
SELECT COUNT(*) as total_returns FROM returns;

-- Check for any exchange records
SELECT COUNT(*) as exchange_count 
FROM returns 
WHERE return_type = 'exchange';
