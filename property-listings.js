/* =====================================================
   PROPERTY DETAILS - Refactored Module
   =====================================================
   Architecture follows property-listings.js pattern
   Uses shared client from supabase.js
   ===================================================== */

// =====================================================
// STATE
// =====================================================

const pageState = {
    listing: null,
    gallery: [],
    seller: null,
    similarListings: [],
    loading: true,
    error: null,
    listingId: null
};

// =====================================================
// DOM CACHE - Match HTML IDs exactly
// =====================================================

const $ = (id) => document.getElementById(id);

const DOM = {
    loading: $('detailsLoading'),
    error: $('detailsError'),
    errorTitle: $('errorTitle'),
    errorMessage: $('errorMessage'),
    content: $('propertyContent'),
    breadcrumbName: $('breadcrumbPropertyName'),

    gallery: $('detailsGallery'),
    header: $('detailsHeader'),
    quickFacts: $('detailsQuickFacts'),
    description: $('detailsDescription'),
    amenities: $('detailsAmenities'),
    seller: $('detailsSeller'),
    location: $('detailsLocation'),
    similar: $('detailsSimilar')
};

// =====================================================
// VALIDATE SHARED CLIENT EXISTS
// =====================================================

function validateSharedClient() {
    // Check for the shared client from supabase.js
    // The shared client could be window.supabase, window.biomeSupabase, or window.supabaseClient
    const client = window.supabase || window.biomeSupabase || window.supabaseClient;
    
    if (!client) {
        console.error('❌ Shared Supabase client not found. Check script loading order.');
        return false;
    }
    
    console.log('✅ Shared Supabase client found.');
    return true;
}

// =====================================================
// URL HANDLING
// =====================================================

function getListingId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function validateListingId(id) {
    if (!id || id.length < 8) {
        return false;
    }
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

// =====================================================
// UI HELPERS
// =====================================================

function showLoading() {
    if (DOM.loading) DOM.loading.style.display = 'block';
    if (DOM.error) DOM.error.style.display = 'none';
    if (DOM.content) DOM.content.style.display = 'none';
}

function hideLoading() {
    if (DOM.loading) DOM.loading.style.display = 'none';
}

function showError(title, message) {
    if (DOM.loading) DOM.loading.style.display = 'none';
    if (DOM.content) DOM.content.style.display = 'none';
    if (DOM.error) {
        DOM.error.style.display = 'block';
        if (DOM.errorTitle) DOM.errorTitle.textContent = title || 'Unable to Load Property';
        if (DOM.errorMessage) DOM.errorMessage.textContent = message || 'Something went wrong.';
    }
}

function hideError() {
    if (DOM.error) DOM.error.style.display = 'none';
}

function showContent() {
    if (DOM.loading) DOM.loading.style.display = 'none';
    if (DOM.error) DOM.error.style.display = 'none';
    if (DOM.content) DOM.content.style.display = 'block';
}

// =====================================================
// DATABASE LOADERS - Using listing_complete_view
// =====================================================

/**
 * Load listing from listing_complete_view
 * Enforces status = 'approved'
 * Uses shared client
 */
async function loadListing(listingId) {
    const client = window.supabase || window.biomeSupabase || window.supabaseClient;
    if (!client) {
        throw new Error('Supabase client not available');
    }

    try {
        const { data, error } = await client
            .from('listing_complete_view')
            .select('*')
            .eq('listing_id', listingId)
            .eq('status', 'approved')
            .single();

        if (error) {
            console.error('Database error:', error);
            throw new Error('Property not found or access denied.');
        }

        if (!data) {
            throw new Error('Property not found.');
        }

        return data;
    } catch (error) {
        console.error('Failed to load listing:', error);
        throw error;
    }
}

/**
 * Load gallery from listing_media
 * Uses the shared client
 */
async function loadGallery(listingId) {
    const client = window.supabase || window.biomeSupabase || window.supabaseClient;
    if (!client) {
        console.warn('Supabase client not available for gallery');
        return [];
    }

    try {
        const { data, error } = await client
            .from('listing_media')
            .select('*')
            .eq('listing_id', listingId)
            .order('display_order', { ascending: true });

        if (error) {
            console.warn('Failed to load gallery:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.warn('Failed to load gallery:', error);
        return [];
    }
}

/**
 * Load seller from profiles
 * Uses the existing foreign key relationship
 */
async function loadSeller(sellerId) {
    const client = window.supabase || window.biomeSupabase || window.supabaseClient;
    if (!client || !sellerId) {
        return null;
    }

    try {
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', sellerId)
            .single();

        if (error) {
            console.warn('Failed to load seller:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.warn('Failed to load seller:', error);
        return null;
    }
}

/**
 * Load similar listings from listing_complete_view
 */
async function loadSimilarListings(listing) {
    const client = window.supabase || window.biomeSupabase || window.supabaseClient;
    if (!client || !listing) {
        return [];
    }

    try {
        const { data, error } = await client
            .from('listing_complete_view')
            .select('*')
            .eq('status', 'approved')
            .eq('property_type', listing.property_type)
            .eq('city', listing.city)
            .neq('listing_id', listing.listing_id)
            .limit(4);

        if (error) {
            console.warn('Failed to load similar listings:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.warn('Failed to load similar listings:', error);
        return [];
    }
}

// =====================================================
// RENDERERS - Using shared helpers from utils.js
// =====================================================

/**
 * Render breadcrumb
 */
function renderBreadcrumb(listing) {
    if (!listing || !DOM.breadcrumbName) return;
    DOM.breadcrumbName.textContent = listing.title || 'Property';
    document.title = `Biome | ${listing.title || 'Property Details'}`;
}

/**
 * Get safe image URL using shared helper
 */
function getSafeImageUrl(storagePath) {
    // Use shared helper if available
    if (window.getPublicImageUrl) {
        const url = window.getPublicImageUrl(storagePath);
        return url || getPlaceholderImage();
    }
    
    // Fallback implementation
    if (!storagePath) return getPlaceholderImage();
    
    const client = window.supabase || window.biomeSupabase || window.supabaseClient;
    if (!client) return getPlaceholderImage();
    
    try {
        const { data } = client.storage
            .from('listing-media')
            .getPublicUrl(storagePath);
        return data.publicUrl || getPlaceholderImage();
    } catch (error) {
        console.warn('Failed to get public URL:', error);
        return getPlaceholderImage();
    }
}

/**
 * Placeholder image
 */
function getPlaceholderImage() {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23f3f4f6"/%3E%3Ctext x="400" y="300" font-family="Arial" font-size="24" fill="%239ca3af" text-anchor="middle"%3ENo Image Available%3C/text%3E%3C/svg%3E';
}

/**
 * Format price using shared helper if available
 */
function formatPrice(price) {
    if (window.formatCurrency) {
        return window.formatCurrency(price);
    }
    
    if (!price || price === 0) return 'Price on Request';
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

/**
 * Format date using shared helper if available
 */
function formatDate(dateString) {
    if (window.formatDate) {
        return window.formatDate(dateString);
    }
    
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Render gallery
 */
function renderGallery(gallery) {
    const container = DOM.gallery;
    if (!container) return;

    if (!gallery || gallery.length === 0) {
        container.innerHTML = `
            <div class="gallery-container">
                <div class="gallery-main">
                    <img src="${getPlaceholderImage()}" alt="No images available" loading="lazy">
                </div>
            </div>
        `;
        return;
    }

    // Find cover image or use first
    let mainImage = gallery.find(item => item.is_cover) || gallery[0];
    const mainImageUrl = getSafeImageUrl(mainImage.storage_path);

    let thumbnailsHTML = gallery.map((item, index) => {
        const thumbUrl = getSafeImageUrl(item.storage_path);
        const isVideo = item.media_type === 'video';
        return `
            <button class="gallery-thumbnail ${index === 0 ? 'active' : ''}" 
                    data-index="${index}" 
                    data-type="${item.media_type || 'image'}"
                    data-path="${item.storage_path || ''}"
                    aria-label="View image ${index + 1}">
                <img src="${thumbUrl}" alt="Thumbnail ${index + 1}" loading="lazy">
                ${isVideo ? '<i class="fa-solid fa-play thumbnail-play-icon"></i>' : ''}
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="gallery-container">
            <div class="gallery-main" id="galleryMain">
                <img src="${mainImageUrl}" alt="Property image" loading="lazy" id="galleryMainImage">
                ${mainImage.media_type === 'video' ? '<div class="gallery-play-overlay"><i class="fa-solid fa-play"></i></div>' : ''}
            </div>
            <div class="gallery-thumbnails" id="galleryThumbnails">
                ${thumbnailsHTML}
            </div>
        </div>
    `;

    // Register gallery events
    registerGalleryEvents(container);
}

/**
 * Register gallery events
 */
function registerGalleryEvents(container) {
    const thumbnails = container.querySelectorAll('.gallery-thumbnail');
    const mainContainer = document.getElementById('galleryMain');

    if (!thumbnails.length || !mainContainer) return;

    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', function() {
            thumbnails.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const path = this.dataset.path;
            const type = this.dataset.type;
            const url = getSafeImageUrl(path);

            if (type === 'video') {
                mainContainer.innerHTML = `
                    <div class="gallery-video-container">
                        <video controls autoplay>
                            <source src="${url}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                `;
            } else {
                mainContainer.innerHTML = `
                    <img src="${url}" alt="Property image" loading="lazy" id="galleryMainImage">
                `;
            }
        });
    });
}

/**
 * Render property header
 * Uses actual schema fields
 */
function renderHeader(listing) {
    const container = DOM.header;
    if (!container || !listing) return;

    // Build location string from available fields
    const locationParts = [];
    if (listing.address) locationParts.push(listing.address);
    if (listing.suburb) locationParts.push(listing.suburb);
    if (listing.city) locationParts.push(listing.city);
    if (listing.province) locationParts.push(listing.province);
    const locationDisplay = locationParts.join(', ');

    container.innerHTML = `
        <div class="property-header">
            <h1 class="property-title">${listing.title || 'Untitled Property'}</h1>
            <div class="property-price-row">
                <span class="property-price">${formatPrice(listing.price)}</span>
                <span class="property-type-badge-large">${listing.property_type || 'Property'}</span>
            </div>
            ${locationDisplay ? `
                <div class="property-location-row">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${locationDisplay}</span>
                </div>
            ` : ''}
            <div class="property-meta-row">
                ${listing.created_at ? `<span><i class="fa-regular fa-calendar"></i> Listed: ${formatDate(listing.created_at)}</span>` : ''}
                ${listing.views_count ? `<span><i class="fa-regular fa-eye"></i> ${listing.views_count} views</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * Render quick facts
 */
function renderQuickFacts(listing) {
    const container = DOM.quickFacts;
    if (!container || !listing) return;

    const facts = [
        { icon: 'fa-solid fa-bed', label: 'Bedrooms', value: listing.bedrooms || 'N/A' },
        { icon: 'fa-solid fa-bath', label: 'Bathrooms', value: listing.bathrooms || 'N/A' },
        { icon: 'fa-solid fa-car', label: 'Parking', value: listing.parking || 'N/A' },
        { icon: 'fa-solid fa-arrows-alt', label: 'Floor Area', value: listing.floor_size ? `${listing.floor_size}m²` : 'N/A' },
        { icon: 'fa-solid fa-building', label: 'Property Type', value: listing.property_type || 'N/A' }
    ];

    container.innerHTML = `
        <h2>Quick Facts</h2>
        <div class="quick-facts-grid">
            ${facts.map(fact => `
                <div class="quick-fact-card">
                    <i class="${fact.icon}"></i>
                    <span class="fact-label">${fact.label}</span>
                    <span class="fact-value">${fact.value}</span>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render description
 */
function renderDescription(listing) {
    const container = DOM.description;
    if (!container || !listing) return;

    const description = listing.description || 'No description provided.';

    container.innerHTML = `
        <h2>About This Property</h2>
        <div class="property-description">
            ${description.split('\n').map(para => {
                if (para.trim() === '') return '';
                return `<p>${para.trim()}</p>`;
            }).join('')}
        </div>
    `;
}

/**
 * Render amenities - handles both array and string formats
 */
function renderAmenities(listing) {
    const container = DOM.amenities;
    if (!container) return;

    let amenities = [];
    if (listing.amenities) {
        try {
            if (Array.isArray(listing.amenities)) {
                amenities = listing.amenities;
            } else if (typeof listing.amenities === 'string') {
                amenities = listing.amenities.split(',').map(a => a.trim()).filter(a => a);
            }
        } catch (e) {
            amenities = [];
        }
    }

    if (amenities.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <h2>Amenities</h2>
        <div class="amenities-grid">
            ${amenities.map(amenity => `
                <span class="amenity-badge">
                    <i class="fa-solid fa-check"></i> ${amenity}
                </span>
            `).join('')}
        </div>
    `;
}

/**
 * Render seller information
 */
function renderSeller(seller) {
    const container = DOM.seller;
    if (!container) return;

    if (!seller) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const avatarUrl = seller.avatar_url ? getSafeImageUrl(seller.avatar_url) : getPlaceholderImage();

    container.innerHTML = `
        <h2>Seller Information</h2>
        <div class="seller-card">
            <div class="seller-avatar">
                <img src="${avatarUrl}" alt="${seller.full_name || 'Seller'}" loading="lazy">
                ${seller.is_verified ? '<span class="verified-badge"><i class="fa-solid fa-check-circle"></i></span>' : ''}
            </div>
            <div class="seller-info">
                <h3>${seller.full_name || 'Property Owner'}</h3>
                ${seller.agency ? `<p class="seller-agency">${seller.agency}</p>` : ''}
                ${seller.phone ? `<p class="seller-contact"><i class="fa-solid fa-phone"></i> ${seller.phone}</p>` : ''}
                ${seller.email ? `<p class="seller-contact"><i class="fa-solid fa-envelope"></i> ${seller.email}</p>` : ''}
                ${seller.is_verified ? '<p class="seller-verified"><i class="fa-solid fa-check-circle"></i> Verified Seller</p>' : ''}
            </div>
        </div>
    `;
}

/**
 * Render location
 */
function renderLocation(listing) {
    const container = DOM.location;
    if (!container || !listing) return;

    const hasLocation = listing.province || listing.city || listing.suburb || listing.address;

    if (!hasLocation) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <h2>Location</h2>
        <div class="location-details">
            ${listing.address ? `<p><i class="fa-solid fa-location-dot"></i> ${listing.address}</p>` : ''}
            ${listing.suburb ? `<p><i class="fa-solid fa-location-dot"></i> ${listing.suburb}</p>` : ''}
            ${listing.city ? `<p><i class="fa-solid fa-city"></i> ${listing.city}</p>` : ''}
            ${listing.province ? `<p><i class="fa-solid fa-map"></i> ${listing.province}</p>` : ''}
        </div>
    `;
}

/**
 * Render similar listings - REUSES property card pattern
 */
function renderSimilarListings(listings) {
    const container = DOM.similar;
    if (!container) return;

    if (!listings || listings.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <h2>Similar Listings</h2>
        <div class="similar-grid">
            ${listings.map(listing => renderSimilarCard(listing)).join('')}
        </div>
    `;

    // Register click events
    registerSimilarCardEvents(container);
}

/**
 * Render a similar listing card - reuses the property card pattern
 */
function renderSimilarCard(listing) {
    const imageUrl = getSafeImageUrl(listing.cover_image);
    const price = formatPrice(listing.price);
    const location = listing.city || listing.suburb || 'Location';

    return `
        <div class="property-card similar-card" data-listing-id="${listing.listing_id}" role="button" tabindex="0">
            <div class="property-image">
                <img src="${imageUrl}" alt="${listing.title || 'Property'}" loading="lazy">
                <span class="property-type-badge">${listing.property_type || 'Property'}</span>
            </div>
            <div class="property-body">
                <h3>${listing.title || 'Untitled'}</h3>
                <div class="location">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${location}</span>
                </div>
                <div class="price-row">
                    <h4>${price}</h4>
                    <span class="view-property-link">View Details →</span>
                </div>
                <div class="property-tags">
                    <span><i class="fa-solid fa-bed"></i> ${listing.bedrooms || 0}</span>
                    <span><i class="fa-solid fa-bath"></i> ${listing.bathrooms || 0}</span>
                    <span><i class="fa-solid fa-car"></i> ${listing.parking || 0}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Register click events for similar cards
 */
function registerSimilarCardEvents(container) {
    container.querySelectorAll('.similar-card').forEach(card => {
        const listingId = card.dataset.listingId;
        card.addEventListener('click', () => {
            window.location.href = `property-details.html?id=${listingId}`;
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.href = `property-details.html?id=${listingId}`;
            }
        });
    });
}

// =====================================================
// MAIN INITIALIZATION - FAIL FAST
// =====================================================

async function init() {
    console.log('🚀 Property Details initializing...');

    // 1. Validate shared client exists
    if (!validateSharedClient()) {
        showError(
            'Initialization Error',
            'Unable to connect to Biome. Please refresh the page or try again later.'
        );
        return;
    }

    // 2. Show loading state
    showLoading();

    // 3. Get and validate listing ID
    const listingId = getListingId();

    if (!validateListingId(listingId)) {
        showError(
            'Invalid Property',
            'The property ID provided is invalid. Please check the URL and try again.'
        );
        return;
    }

    pageState.listingId = listingId;

    try {
        // 4. Load listing - THIS MUST SUCCEED
        const listing = await loadListing(listingId);
        pageState.listing = listing;

        // 5. Render breadcrumb and header (immediate)
        renderBreadcrumb(listing);
        renderHeader(listing);

        // 6. Render remaining property details
        renderQuickFacts(listing);
        renderDescription(listing);
        renderAmenities(listing);
        renderLocation(listing);

        // 7. Show content immediately
        showContent();

        // 8. Load gallery (non-blocking)
        loadGallery(listingId).then(gallery => {
            pageState.gallery = gallery;
            renderGallery(gallery);
        }).catch(err => {
            console.warn('Gallery load failed:', err);
            renderGallery([]);
        });

        // 9. Load seller (non-blocking)
        if (listing.owner_id || listing.profile_id) {
            const sellerId = listing.owner_id || listing.profile_id;
            loadSeller(sellerId).then(seller => {
                pageState.seller = seller;
                renderSeller(seller);
            }).catch(err => {
                console.warn('Seller load failed:', err);
                renderSeller(null);
            });
        }

        // 10. Load similar listings (non-blocking, after page render)
        loadSimilarListings(listing).then(similar => {
            pageState.similarListings = similar;
            renderSimilarListings(similar);
        }).catch(err => {
            console.warn('Similar listings load failed:', err);
            renderSimilarListings([]);
        });

        console.log('✅ Property details loaded successfully');

    } catch (error) {
        console.error('❌ Failed to load property:', error);
        showError(
            'Unable to Load Property',
            error.message || 'Something went wrong. Please try again later.'
        );
    }
}

// =====================================================
// START - Only when DOM is ready
// =====================================================

document.addEventListener('DOMContentLoaded', init);
