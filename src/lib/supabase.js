import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://srdljxbumxkgjxoqqrzs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZGxqeGJ1bXhrZ2p4b3FxcnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjk3MzAsImV4cCI6MjA4MDk0NTczMH0.9ky1F9JVhzAH2A6_2l_nVeLmEOGrKlTC5KFTnanMfDk';

// Singleton instances — created once and reused
let supabaseInstance = globalThis.__shringarikaSupabaseClient || null;

if (!supabaseInstance) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-application-name': 'shringarika-frontend'
      }
    }
  });
  globalThis.__shringarikaSupabaseClient = supabaseInstance;
}

export const supabase = supabaseInstance;

// Helper functions for common Supabase operations

/**
 * Sign up a new user
 */
export const signUp = async (email, password, userData = {}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData
    }
  });
  
  if (error) throw error;
  return data;
};

/**
 * Sign in with email and password
 */
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * Get current session
 */
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

/**
 * Reset password
 */
export const resetPassword = async (email) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  
  if (error) throw error;
  return data;
};

/**
 * Update user password
 */
export const updatePassword = async (newPassword) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  
  if (error) throw error;
  return data;
};

export default supabase;
