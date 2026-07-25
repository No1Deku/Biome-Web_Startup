/* =====================================================
   BIOME - Shared Supabase Client
   =====================================================
   This is the ONLY file that creates the Supabase client.
   All other modules must use window.biomeSupabase.
   ===================================================== */

// Ensure Supabase SDK is loaded
if (typeof supabase === 'undefined') {
    console.error('❌ Supabase SDK not loaded. Check script loading order.');
    throw new Error('Supabase SDK is required but not loaded.');
}

// Supabase configuration
const SUPABASE_URL =
        "https://cwatxxamkoukctwijomr.supabase.co";

const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3YXR4eGFta291a2N0d2lqb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDU0NDYsImV4cCI6MjA5OTY4MTQ0Nn0.rfVtSuJK5xgmHCinKHbni0DLazedmvW6yKQaVTBD3PM";


// Create the shared client - ONLY ONE
const biomeSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Expose the shared client globally
window.biomeSupabase = biomeSupabase;

// Also expose for backward compatibility (but should be deprecated)
window.supabaseClient = biomeSupabase;

console.log('✅ Shared Supabase client initialized.');

// Prevent any other file from creating a client
Object.freeze(window.biomeSupabase);
