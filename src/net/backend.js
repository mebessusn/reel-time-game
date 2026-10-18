// Supabase connection. Configure with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).
// When they are missing the game runs in guest/offline mode only.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const cloudConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let client = null;
export async function getSupabase() {
  if (!cloudConfigured) return null;
  if (client) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

export function redirectUrl() {
  return `${location.origin}${location.pathname}`;
}

export function displayNameFrom(user) {
  const m = user?.user_metadata || {};
  return String(m.user_name || m.preferred_username || m.name || m.full_name || (user?.email || 'Angler').split('@')[0]).slice(0, 20);
}

export function providerLabel(user) {
  const p = user?.app_metadata?.provider;
  return p === 'github' ? 'GitHub' : p === 'email' ? 'email' : p || '';
}
