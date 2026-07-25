/* =====================================================
   BIOME - Authentication Service
   =====================================================
   Consumes the shared client from window.biomeSupabase.
   Does NOT create its own Supabase client.
   ===================================================== */

// =====================================================
// STATE
// =====================================================

const AuthState = {
    user: null,
    profile: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    role: null
};

// =====================================================
// DOM REFS
// =====================================================

const AuthDOM = {
    navButtons: document.getElementById('navButtons'),
    authLinks: document.querySelectorAll('.auth-link'),
    protectedLinks: document.querySelectorAll('.protected-link')
};

// =====================================================
// CLIENT ACCESS
// =====================================================

function getClient() {
    const client = window.biomeSupabase;
    if (!client) {
        console.error('❌ Auth: Shared Supabase client not available');
        return null;
    }
    return client;
}

// =====================================================
// AUTH SERVICE
// =====================================================

async function getSession() {
    const client = getClient();
    if (!client) return null;

    try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error) {
            console.warn('Auth: Failed to get session:', error);
            return null;
        }
        return session;
    } catch (error) {
        console.warn('Auth: Error getting session:', error);
        return null;
    }
}

async function getCurrentUser() {
    const client = getClient();
    if (!client) return null;

    try {
        const { data: { user }, error } = await client.auth.getUser();
        if (error) {
            console.warn('Auth: Failed to get user:', error);
            return null;
        }
        return user;
    } catch (error) {
        console.warn('Auth: Error getting user:', error);
        return null;
    }
}

async function getProfile(userId) {
    const client = getClient();
    if (!client || !userId) return null;

    try {
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.warn('Auth: Failed to get profile:', error);
            return null;
        }
        return data;
    } catch (error) {
        console.warn('Auth: Error getting profile:', error);
        return null;
    }
}

async function signIn(email, password) {
    const client = getClient();
    if (!client) {
        throw new Error('Authentication service not available');
    }

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Auth: Sign in failed:', error);
        throw error;
    }
}

async function signUp(email, password, metadata = {}) {
    const client = getClient();
    if (!client) {
        throw new Error('Authentication service not available');
    }

    try {
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Auth: Sign up failed:', error);
        throw error;
    }
}

async function signOut() {
    const client = getClient();
    if (!client) {
        throw new Error('Authentication service not available');
    }

    try {
        const { error } = await client.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Auth: Sign out failed:', error);
        throw error;
    }
}

async function updateProfile(profileData) {
    const client = getClient();
    if (!client) {
        throw new Error('Authentication service not available');
    }

    const user = AuthState.user;
    if (!user) {
        throw new Error('No authenticated user');
    }

    try {
        const { data, error } = await client
            .from('profiles')
            .update(profileData)
            .eq('id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Auth: Profile update failed:', error);
        throw error;
    }
}

// =====================================================
// AUTH STATE HANDLER - SINGLE LISTENER
// =====================================================

function handleAuthStateChange() {
    const client = getClient();
    if (!client) {
        console.error('❌ Auth: Cannot listen for auth changes - client not available');
        return;
    }

    // Only ONE listener - remove any existing ones first
    if (window._authListener) {
        window._authListener.unsubscribe();
        console.log('🔐 Removed existing auth listener');
    }

    window._authListener = client.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth state changed:', event);

        AuthState.session = session;
        AuthState.isAuthenticated = !!session;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
                AuthState.user = session.user;
                const profile = await getProfile(session.user.id);
                AuthState.profile = profile;
                AuthState.role = profile?.role || 'user';
            }
            updateUI();
        } else if (event === 'SIGNED_OUT') {
            AuthState.user = null;
            AuthState.profile = null;
            AuthState.role = null;
            updateUI();
        } else if (event === 'USER_UPDATED') {
            if (session?.user) {
                AuthState.user = session.user;
                const profile = await getProfile(session.user.id);
                AuthState.profile = profile;
                AuthState.role = profile?.role || 'user';
            }
            updateUI();
        }

        AuthState.isLoading = false;
    });
}

// =====================================================
// UI UPDATES
// =====================================================

function updateUI() {
    const { isAuthenticated, user, profile, role } = AuthState;

    const navButtons = AuthDOM.navButtons;
    if (navButtons) {
        if (isAuthenticated && user) {
            navButtons.innerHTML = `
                <span class="user-greeting">Hello, ${profile?.full_name || user.email?.split('@')[0] || 'User'}</span>
                <a href="dashboard.html" class="btn btn-primary">Dashboard</a>
                <button onclick="window.handleSignOut()" class="btn btn-outline">Sign Out</button>
            `;
        } else {
            navButtons.innerHTML = `
                <a href="sign-in.html" class="btn btn-outline">Sign In</a>
                <a href="sign-up.html" class="btn btn-primary">Sign Up</a>
            `;
        }
    }

    // Update protected links
    document.querySelectorAll('.protected-link').forEach(link => {
        link.style.display = isAuthenticated ? 'inline' : 'none';
    });

    // Update role-specific links
    document.querySelectorAll('.admin-only').forEach(link => {
        link.style.display = role === 'admin' ? 'inline' : 'none';
    });

    document.querySelectorAll('.seller-only').forEach(link => {
        link.style.display = (role === 'seller' || role === 'admin') ? 'inline' : 'none';
    });
}

// =====================================================
// INITIALIZATION
// =====================================================

async function initAuth() {
    console.log('🔐 Auth service initializing...');

    // Validate shared client
    if (!window.biomeSupabase) {
        console.error('❌ Auth: Shared Supabase client not found');
        AuthState.isLoading = false;
        updateUI();
        return;
    }

    // Get initial session
    const session = await getSession();
    if (session?.user) {
        AuthState.user = session.user;
        AuthState.session = session;
        AuthState.isAuthenticated = true;
        const profile = await getProfile(session.user.id);
        AuthState.profile = profile;
        AuthState.role = profile?.role || 'user';
    }

    AuthState.isLoading = false;
    updateUI();

    // Start listening for auth changes - only if not already listening
    if (!window._authListener) {
        handleAuthStateChange();
    }
}

// =====================================================
// EXPOSE TO WINDOW
// =====================================================

window.AuthState = AuthState;
window.signIn = signIn;
window.signUp = signUp;
window.signOut = signOut;
window.updateProfile = updateProfile;
window.getCurrentUser = getCurrentUser;
window.getSession = getSession;
window.getProfile = getProfile;
window.initAuth = initAuth;
window.handleSignOut = async function() {
    try {
        await signOut();
    } catch (error) {
        console.error('Sign out failed:', error);
        window.showToast('Sign out failed. Please try again.', 'error');
    }
};

// =====================================================
// AUTO-INIT
// =====================================================

document.addEventListener('DOMContentLoaded', initAuth);

console.log('🔐 Auth service loaded.');
