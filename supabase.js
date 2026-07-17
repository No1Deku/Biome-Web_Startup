/* ============================================================
   BIOME – Shared Supabase Client
   Single instance across the entire application
   ============================================================ */

// Prevent redeclaration errors
if (!window.BIOME_SUPABASE_INITIALIZED) {
    window.BIOME_SUPABASE_INITIALIZED = true;

    const SUPABASE_URL =
        "https://cwatxxamkoukctwijomr.supabase.co";

    const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3YXR4eGFta291a2N0d2lqb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDU0NDYsImV4cCI6MjA5OTY4MTQ0Nn0.rfVtSuJK5xgmHCinKHbni0DLazedmvW6yKQaVTBD3PM";


    // Create the single Supabase client
    window.biomeSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}