/* =====================================================
   PROPERTY DETAILS - Complete Module
   ===================================================== */

// =====================================================
// STATE
// =====================================================

const PageState = {
    listing: null,
    gallery: [],
    seller: null,
    similarListings: [],
    loading: true,
    error: null
};

// =====================================================
// UTILITIES
// =====================================================

function formatPrice(price) {
    if (!price) return 'Price on Request';
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getPublicImage(storagePath) {
    if (!storagePath) return null;

    try {
        const { data } = supabase.storage
            .from('listing-images')
            .getPublicUrl(storagePath);
        return data.publicUrl;
    } catch (error) {
        console.warn('Failed to get public URL:', error);
        return null;
    }
}

function getImageUrl(imageData) {
    if (!imageData) return null;

    // If it's already a full URL
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        return imageData;
    }

    // If it's a storage path
    if (imageData.includes('/')) {
        return getPublicImage(imageData);
    }

    // If it's just a filename, assume it's in the bucket
    return getPublicImage(imageData);
}

function getPlaceholderImage() {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23f3f4f6"/%3E%3Ctext x="400" y="300" font-family="Arial" font-size="24" fill="%239ca3af" text-anchor="middle"%3ENo Image Available%3C/text%3E%3C/svg%3E';
}

function getSafeImageUrl(storagePath) {
    const url = getImageUrl(storagePath);
    return url || getPlaceholderImage();
}

// =====================================================
// DOM REFS
// =====================================================

const DOM = {
    loading: document.getElementById('loadingState'),
    error: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    content: document.getElementById('propertyContent'),
    breadcrumbName: document.getElementById('breadcrumbPropertyName'),

    gallery: document.getElementById('detailsGallery'),
    header: document.getElementById('detailsHeader'),
    quickFacts: document.getElementById('detailsQuickFacts'),
    description: document.getElementById('detailsDescription'),
    amenities: document.getElementById('detailsAmenities'),
    seller: document.getElementById('detailsSeller'),
    location: document.getElementById('detailsLocation'),
    similar: document.getElementById('detailsSimilar')
};

// =====================================================
// CORE FUNCTIONS
// =====================================================

function getListingId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function validateListingId(id) {
    if (!id || id.length < 8) {
        return false;
    }
    // UUID validation (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

function showLoading() {
    DOM.loading.style.display = 'block';
    DOM.error.style.display = 'none';
    DOM.content.style.display = 'none';
}

function hideLoading() {
    DOM.loading.style.display = 'none';
}

function showError(message) {
    DOM.loading.style.display = 'none';
    DOM.content.style.display = 'none';
    DOM.error.style.display = 'block';
    DOM.errorMessage.textContent = message || 'Unable to load property details. Please try again.';
}

function hideError() {
    DOM.error.style.display = 'none';
}

function showContent() {
    DOM.loading.style.display = 'none';
    DOM.error.style.display = 'none';
    DOM.content.style.display = 'block';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =====================================================
// LOADER FUNCTIONS
// =====================================================

async function loadListing(listingId) {
    try {
        const { data, error } = await supabase
            .from('listing_complete_view')
            .select('*')
            .eq('listing_id', listingId)
            .eq('status', 'approved')
            .single();

        if (error) {
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

async function loadGallery(listingId) {
    try {
        const { data, error } = await supabase
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

async function loadSeller(sellerId) {
    try {
        if (!sellerId) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url, phone, email, agency, is_verified')
            .eq('user_id', sellerId)
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

async function loadSimilarListings(listing) {
    try {
        if (!listing) return [];

        const { data, error } = await supabase
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
// RENDER FUNCTIONS
// =====================================================

function renderBreadcrumb(listing) {
    if (!listing) return;
    DOM.breadcrumbName.textContent = listing.title || 'Property';
    document.title = `Biome | ${listing.title || 'Property Details'}`;
}

function renderGallery(gallery, listing) {
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

    // Build gallery HTML
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
    const thumbnails = container.querySelectorAll('.gallery-thumbnail');
    const mainImageElement = document.getElementById('galleryMainImage');
    const mainContainer = document.getElementById('galleryMain');

    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', function() {
            thumbnails.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const path = this.dataset.path;
            const type = this.dataset.type;
            const url = getSafeImageUrl(path);

            if (type === 'video') {
                // Show video player (simple implementation)
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

function renderHeader(listing) {
    const container = DOM.header;
    if (!container || !listing) return;

    const availability = listing.availability_status === 'available' ? 'Available' : 'Unavailable';
    const availabilityClass = listing.availability_status === 'available' ? 'status-available' : 'status-unavailable';

    container.innerHTML = `
        <div class="property-header">
            <h1 class="property-title">${listing.title || 'Untitled Property'}</h1>
            <div class="property-price-row">
                <span class="property-price">${formatPrice(listing.price)}</span>
                <span class="property-type-badge-large">${listing.property_type || 'Property'}</span>
                <span class="property-availability ${availabilityClass}">${availability}</span>
            </div>
            <div class="property-location-row">
                <i class="fa-solid fa-location-dot"></i>
                <span>${listing.address || ''}${listing.address && listing.suburb ? ', ' : ''}${listing.suburb || ''}${(listing.address || listing.suburb) && listing.city ? ', ' : ''}${listing.city || ''}${listing.city && listing.province ? ', ' : ''}${listing.province || ''}</span>
            </div>
            <div class="property-meta-row">
                <span><i class="fa-regular fa-calendar"></i> Listed: ${formatDate(listing.created_at)}</span>
                <span><i class="fa-regular fa-eye"></i> ${listing.views_count || 0} views</span>
            </div>
        </div>
    `;
}

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
            ${listing.postal_code ? `<p><i class="fa-solid fa-mailbox"></i> ${listing.postal_code}</p>` : ''}
        </div>
        <!-- Future enhancement: Interactive map -->
    `;
}

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
            ${listings.map(listing => `
                <div class="property-card similar-card" data-listing-id="${listing.listing_id}" role="button" tabindex="0">
                    <div class="property-image">
                        <img src="${getSafeImageUrl(listing.cover_image)}" alt="${listing.title || 'Property'}" loading="lazy">
                        <span class="property-type-badge">${listing.property_type || 'Property'}</span>
                    </div>
                    <div class="property-body">
                        <h3>${listing.title || 'Untitled'}</h3>
                        <div class="location">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${listing.city || listing.suburb || 'Location'}</span>
                        </div>
                        <div class="price-row">
                            <h4>${formatPrice(listing.price)}</h4>
                            <span class="view-property-link">View Details →</span>
                        </div>
                        <div class="property-tags">
                            <span><i class="fa-solid fa-bed"></i> ${listing.bedrooms || 0}</span>
                            <span><i class="fa-solid fa-bath"></i> ${listing.bathrooms || 0}</span>
                            <span><i class="fa-solid fa-car"></i> ${listing.parking || 0}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Register click events for similar listings
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
// INITIALIZATION
// =====================================================

async function init() {
    console.log('🚀 Property Details initializing...');

    // Show loading state
    showLoading();

    // Get listing ID from URL
    const listingId = getListingId();

    if (!validateListingId(listingId)) {
        showError('Invalid property ID. Please check the URL and try again.');
        return;
    }

    try {
        // Load listing data
        const listing = await loadListing(listingId);
        PageState.listing = listing;

        // Update breadcrumb
        renderBreadcrumb(listing);

        // Load gallery
        const gallery = await loadGallery(listingId);
        PageState.gallery = gallery;

        // Load seller
        if (listing.seller_id) {
            const seller = await loadSeller(listing.seller_id);
            PageState.seller = seller;
        }

        // Render all sections
        renderGallery(gallery, listing);
        renderHeader(listing);
        renderQuickFacts(listing);
        renderDescription(listing);
        renderAmenities(listing);
        renderSeller(PageState.seller);
        renderLocation(listing);

        // Hide loading, show content
        hideLoading();
        showContent();

        // Load similar listings (async, non-blocking)
        loadSimilarListings(listing).then(similar => {
            PageState.similarListings = similar;
            renderSimilarListings(similar);
        }).catch(err => {
            console.warn('Failed to load similar listings:', err);
            renderSimilarListings([]);
        });

        console.log('✅ Property details loaded successfully');

    } catch (error) {
        console.error('❌ Failed to load property:', error);
        showError(error.message || 'Unable to load property details. Please try again.');
    }
}

// =====================================================
// START
// =====================================================

document.addEventListener('DOMContentLoaded', init);