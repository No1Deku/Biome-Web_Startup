    // ==========================================================
    // BIOME
    // Shared Authentication Module
    // ==========================================================


    // ==========================================================
    // WAIT FOR SUPABASE SDK
    // ==========================================================

    if (!window.supabase) {

        throw new Error("Supabase SDK failed to load.");

    }


    // ==========================================================
    // SUPABASE CONFIGURATION
    // ==========================================================

    const supabaseUrl =
        "https://cwatxxamkoukctwijomr.supabase.co";

    const supabaseKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3YXR4eGFta291a2N0d2lqb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDU0NDYsImV4cCI6MjA5OTY4MTQ0Nn0.rfVtSuJK5xgmHCinKHbni0DLazedmvW6yKQaVTBD3PM";


    const supabaseClient =
        window.supabase.createClient(
            supabaseUrl,
            supabaseKey
        );


    // ==========================================================
    // GET CURRENT SESSION
    // ==========================================================

    async function getSession() {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();

        if (error) {

            console.error("Session Error:", error);

            return null;

        }

        return data.session;

    }


    // ==========================================================
    // GET CURRENT USER
    // ==========================================================

    async function getCurrentUser() {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getUser();

        if (error) {

            console.error(error);

            return null;

        }

        return data.user;

    }


    // ==========================================================
    // GET CURRENT PROFILE
    // ==========================================================

    async function getCurrentProfile() {

        const user =
            await getCurrentUser();

        if (!user)
            return null;

        const {
            data,
            error
        } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq("profile_id", user.id)
                .single();

        if (error) {

            console.error("Profile Error:", error);

            return null;

        }

        return data;

    }


    // ==========================================================
    // REQUIRE AUTHENTICATION
    // ==========================================================

    async function requireAuth() {

        const session =
            await getSession();

        if (!session) {

            window.location.href = "sign-in.html";

            return false;

        }

        return true;

    }


    // ==========================================================
    // REQUIRE ROLE
    // ==========================================================

    async function requireRole(role) {

        const profile =
            await getCurrentProfile();

        if (!profile) {

            window.location.href = "sign-in.html";

            return false;

        }

        if (profile.account_type !== role) {

            alert("You do not have permission to access this page.");

            window.location.href = "index.html";

            return false;

        }

        return true;

    }


    // ==========================================================
    // LOGOUT
    // ==========================================================

    async function logout() {

        const {
            error
        } =
            await supabaseClient.auth.signOut();

        if (error) {

            console.error(error);

            return;

        }

        window.location.href = "sign-in.html";

    }


    // ==========================================================
    // SESSION LISTENER
    // ==========================================================

    supabaseClient.auth.onAuthStateChange(

        async (event, session) => {

            console.log("Auth Event:", event);

            if (event === "SIGNED_OUT") {

                window.location.href = "sign-in.html";

            }

            if (event === "TOKEN_REFRESHED") {

                console.log("Session refreshed.");

            }

            if (event === "USER_UPDATED") {

                console.log("User updated.");

            }

        }

    );


    // ==========================================================
    // REDIRECT USER
    // ==========================================================

    async function redirectUser() {

        const profile =
            await getCurrentProfile();

        if (!profile)
            return;

        switch (profile.account_type) {

            case "buyer":

                window.location.href =
                    "buyer-dashboard.html";

                break;

            case "seller":

                window.location.href =
                    "seller-dashboard.html";

                break;

            case "admin":

                window.location.href =
                    "admin-dashboard.html";

                break;

            default:

                window.location.href =
                    "index.html";

        }

    }


    // ==========================================================
    // CHECK IF ALREADY LOGGED IN
    // ==========================================================

    async function redirectIfAuthenticated() {

        const session =
            await getSession();

        if (!session)
            return;

        await redirectUser();

    }


    // ==========================================================
    // CURRENT USER NAME
    // ==========================================================

    async function getDisplayName() {

        const profile =
            await getCurrentProfile();

        if (!profile)
            return "";

        return `${profile.first_name} ${profile.last_name}`;

    }


    // ==========================================================
    // CURRENT ACCOUNT TYPE
    // ==========================================================

    async function getAccountType() {

        const profile =
            await getCurrentProfile();

        if (!profile)
            return null;

        return profile.account_type;

    }


    // ==========================================================
    // PROFILE PHOTO
    // ==========================================================

    async function getProfilePhoto() {

        const profile =
            await getCurrentProfile();

        if (!profile)
            return null;

        return profile.profile_photo;

    }


    // ==========================================================
    // EXPORT TO WINDOW
    // ==========================================================

    window.BiomeAuth = {

        supabase: supabaseClient,

        getSession,

        getCurrentUser,

        getCurrentProfile,

        requireAuth,

        requireRole,

        logout,

        redirectUser,

        redirectIfAuthenticated,

        getDisplayName,

        getAccountType,

        getProfilePhoto

    };