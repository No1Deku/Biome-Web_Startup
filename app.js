/* ============================================================
   BIOME LANDING PAGE – Revised Orchestrator
   Uses shared supabase.js | No duplicate client | Clean MVP
   ============================================================ */

const DEBUG = true;
const log = (...args) => DEBUG && console.log('[Landing]', ...args);

// Use the shared Supabase client (no redeclaration)
const supabase = window.biomeSupabase;

// ============================================================
// DOM CACHE
// ============================================================
const dom = {
    navButtons: document.getElementById('navButtons'),
    hamburgerBtn: document.getElementById('hamburgerBtn'),
    navLinks: document.getElementById('navLinks'),
    heroPropertyType: document.getElementById('heroPropertyType'),
    searchForm: document.getElementById('searchForm'),
    featuredGrid: document.getElementById('featuredGrid'),
    becomeHostBtn: document.getElementById('becomeHostBtn'),
    statProperties: document.getElementById('statProperties'),
    statOwners: document.getElementById('statOwners'),
    statCities: document.getElementById('statCities'),
    statSuccessful: document.getElementById('statSuccessful'),
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    log('Landing page initializing');

    // Load independent data in parallel
    await Promise.all([
        updateNavbar(),
        loadHeroPropertyTypes(),
        loadStatistics(),
        loadFeaturedListings(),
    ]);

    registerEventListeners();
    log('Landing page ready');
}

// ============================================================
// NAVBAR – Auth State Detection
// ============================================================
async function updateNavbar() {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            dom.navButtons.innerHTML = `
                <a href="sign-in.html" class="btn btn-outline">Sign In</a>
                <a href="sign-up.html" class="btn btn-primary">Get Started</a>
            `;
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('account_type, first_name')
            .eq('profile_id', user.id)
            .single();

        const accountType = profile?.account_type || 'buyer';

        const dashboardUrls = {
            buyer: 'buyer-dashboard.html',
            seller: 'seller-dashboard.html',
            admin: 'admin-dashboard.html',
        };
        const dashboardUrl = dashboardUrls[accountType] || 'buyer-dashboard.html';

        dom.navButtons.innerHTML = `
            <a href="${dashboardUrl}" class="btn btn-outline">
                <i class="fa-solid fa-gauge"></i> Dashboard
            </a>
            <button id="logoutBtn" class="btn btn-primary">
                <i class="fa-solid fa-right-from-bracket"></i> Logout
            </button>
        `;

        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });
    } catch (err) {
        console.error('[Navbar] Error:', err);
        dom.navButtons.innerHTML = `
            <a href="sign-in.html" class="btn btn-outline">Sign In</a>
            <a href="sign-up.html" class="btn btn-primary">Get Started</a>
        `;
    }
}

// ============================================================
// HERO PROPERTY TYPES (dropdown only, no category section)
// ============================================================
async function loadHeroPropertyTypes() {
    try {
        const { data: types, error } = await supabase
            .from('property_types')
            .select('property_type_id, property_name')
            .order('property_name');

        if (error) throw error;
        if (!types || types.length === 0) return;

        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.property_type_id;
            option.textContent = type.property_name;
            dom.heroPropertyType.appendChild(option);
        });
    } catch (err) {
        console.error('[PropertyTypes] Error:', err);
    }
}

// ============================================================
// MARKETPLACE STATISTICS
// ============================================================
async function loadStatistics() {
    try {
        const [propsResult, ownersResult] = await Promise.all([
            supabase.from('listing_complete_view').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'seller'),
        ]);

        const totalProperties = propsResult.count || 0;
        const totalOwners = ownersResult.count || 0;

        // Count unique cities
        const { data: citiesData } = await supabase
            .from('listing_complete_view')
            .select('city')
            .eq('status', 'approved');
        const uniqueCities = new Set((citiesData || []).map(l => l.city).filter(Boolean));

        animateValue(dom.statProperties, totalProperties);
        animateValue(dom.statOwners, totalOwners);
        animateValue(dom.statCities, uniqueCities.size);
        animateValue(dom.statSuccessful, totalProperties);
    } catch (err) {
        console.error('[Statistics] Error:', err);
        dom.statProperties.textContent = '0';
        dom.statOwners.textContent = '0';
        dom.statCities.textContent = '0';
        dom.statSuccessful.textContent = '0';
    }
}

function animateValue(element, target) {
    if (!element) return;
    element.textContent = '0';
    const duration = 1500;
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.floor(target * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ============================================================
// FEATURED LISTINGS (latest 6 approved)
// ============================================================
async function loadFeaturedListings() {
    try {
        const { data: listings, error } = await supabase
            .from('listing_complete_view')
            .select('listing_id, title, price, bedrooms, bathrooms, city, suburb, property_type, cover_public_url, cover_storage_path')
            .eq('status', 'approved')
            .order('submitted_at', { ascending: false })
            .limit(6);

        if (error) throw error;

        dom.featuredGrid.innerHTML = '';

        if (!listings || listings.length === 0) {
            dom.featuredGrid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-icon">🏠</div>
                    <h3>No listings yet</h3>
                    <p>Check back soon for new properties.</p>
                </div>`;
            return;
        }

        listings.forEach(listing => {
            const coverUrl = listing.cover_public_url || getPublicImage(listing.cover_storage_path);
            const card = document.createElement('div');
            card.className = 'property-card';
            card.addEventListener('click', () => {
                window.location.href = `property-details.html?id=${listing.listing_id}`;
            });

            card.innerHTML = `
                <div class="property-image">
                    <img src="${coverUrl || 'Assets/Images/placeholder-property.jpg'}" 
                         alt="${listing.title}" 
                         loading="lazy"
                         onerror="this.src='Assets/Images/placeholder-property.jpg'">
                    <span class="property-type-badge">${listing.property_type || 'Property'}</span>
                </div>
                <div class="property-body">
                    <h3>${listing.title}</h3>
                    <div class="location">
                        <i class="fa-solid fa-location-dot"></i> ${listing.suburb || ''}, ${listing.city || ''}
                    </div>
                    <div class="price-row">
                        <h4>${formatPrice(listing.price)} <span>/month</span></h4>
                    </div>
                    <div class="property-tags">
                        <span><i class="fa-solid fa-bed"></i> ${listing.bedrooms || 0} Beds</span>
                        <span><i class="fa-solid fa-bath"></i> ${listing.bathrooms || 0} Baths</span>
                    </div>
                </div>
            `;

            dom.featuredGrid.appendChild(card);
        });
    } catch (err) {
        console.error('[Featured] Error:', err);
        dom.featuredGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <p>Unable to load listings. Please try again.</p>
            </div>`;
    }
}

// ============================================================
// HERO SEARCH – Redirect to listings page
// ============================================================
function handleSearchSubmit(e) {
    e.preventDefault();

    const search = document.getElementById('heroSearch').value.trim();
    const location = document.getElementById('heroLocation').value;
    const type = document.getElementById('heroPropertyType').value;
    const priceRange = document.getElementById('heroPriceRange').value;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (location) params.set('city', location);
    if (type) params.set('type', type);
    if (priceRange) {
        const [min, max] = priceRange.split('-');
        if (min) params.set('minPrice', min);
        if (max) params.set('maxPrice', max);
    }

    window.location.href = `property-listings.html?${params.toString()}`;
}

// ============================================================
// BECOME A HOST – Role-based redirect
// ============================================================
async function handleBecomeHost() {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            window.location.href = 'sign-up.html';
            return;
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('account_type')
            .eq('profile_id', user.id)
            .single();

        if (!profile || profile.account_type === 'buyer') {
            window.location.href = 'seller-onboarding.html';
        } else if (profile.account_type === 'seller') {
            window.location.href = 'seller-dashboard.html';
        } else if (profile.account_type === 'admin') {
            window.location.href = 'admin-dashboard.html';
        }
    } catch (err) {
        console.error('[Host] Error:', err);
        window.location.href = 'sign-up.html';
    }
}

// ============================================================
// UTILITIES
// ============================================================
function getPublicImage(path) {
    if (!path) return null;
    const { data } = supabase.storage.from('listing-media').getPublicUrl(path);
    return data?.publicUrl || null;
}

function formatPrice(price) {
    if (!price) return 'R 0';
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
    }).format(price);
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function registerEventListeners() {
    dom.searchForm.addEventListener('submit', handleSearchSubmit);
    dom.becomeHostBtn.addEventListener('click', handleBecomeHost);

    // Mobile hamburger menu
    dom.hamburgerBtn.addEventListener('click', () => {
        dom.hamburgerBtn.classList.toggle('active');
        dom.navLinks.classList.toggle('active');
    });

    dom.navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            dom.hamburgerBtn.classList.remove('active');
            dom.navLinks.classList.remove('active');
        });
    });

    // Sticky navbar shadow
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.style.boxShadow = window.scrollY > 10 
                ? '0 4px 20px rgba(0,0,0,0.1)' 
                : '0 2px 20px rgba(0,0,0,0.05)';
        }
    });
}