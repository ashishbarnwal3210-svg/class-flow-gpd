import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const backendConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = backendConfigured ? createClient(url!, anonKey!, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;
export type ClassFlowUser = User;
export function requireBackend(): SupabaseClient {
  if (!supabase) throw new Error('ClassFlow backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  return supabase;
}
