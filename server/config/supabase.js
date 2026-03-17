import { createClient } from '@supabase/supabase-js';

// Variables to hold clients
let supabase = null;
let supabaseAdmin = null;

// Initialize Supabase clients (call this after dotenv.config())
export const initializeSupabase = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.log('⚠️  SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('⚠️  SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'Missing');
    throw new Error('Supabase credentials not configured');
  }

  console.log('✅ Initializing Supabase with URL:', supabaseUrl);

  // Create Supabase client
  supabase = createClient(supabaseUrl, supabaseKey);

  // Create admin client with service role key for admin operations
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

  return { supabase, supabaseAdmin };
};

// Export getters
export const getSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase not initialized. Call initializeSupabase() first');
  }
  return supabase;
};

export const getSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin not initialized. Call initializeSupabase() first');
  }
  return supabaseAdmin;
};

// For backward compatibility, export supabase directly (will be null until initialized)
export { supabase, supabaseAdmin };

// Test database connection
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      // PGRST116 means table doesn't exist yet, which is okay
      throw error;
    }
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    console.log('⚠️  Server will continue without database connection');
    console.log('⚠️  Please configure SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
    return false;
  }
};

export default supabase;
