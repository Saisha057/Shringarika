/**
 * Singleton Supabase Client
 * 
 * CRITICAL FIX: Create only ONE Supabase client instance globally
 * to prevent multiple real-time subscriptions and connection issues.
 * 
 * Previous issue: Creating client in each component created multiple
 * GoTrueClient instances, causing duplicated event listeners and 
 * state synchronization problems.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing - real-time features will be disabled');
}

// Create/reuse single instance
let supabaseInstance = (globalThis as any).__shringarikaSupabaseClient || null;

if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  (globalThis as any).__shringarikaSupabaseClient = supabaseInstance;
}

export const supabase = supabaseInstance;

console.log('✅ Singleton Supabase client initialized');
