/* =====================================================
   BIOME - Shared Utilities
   =====================================================
   All helper functions are centralized here.
   No other file should duplicate these functions.
   ===================================================== */

// =====================================================
// FORMATTING UTILITIES
// =====================================================

/**
 * Format currency in ZAR
 */
function formatCurrency(price) {
    if (!price || price === 0) return 'Price on Request';
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format address for display
 */
function formatAddress(address) {
    if (!address) return '';
    const parts = [];
    if (address.address) parts.push(address.address);
    if (address.suburb) parts.push(address.suburb);
    if (address.city) parts.push(address.city);
    if (address.province) parts.push(address.province);
    if (address.postal_code) parts.push(address.postal_code);
    return parts.join(', ');
}

// =====================================================
// IMAGE UTILITIES
// =====================================================

/**
 * Get public URL from storage path
 * Uses the shared client from window.biomeSupabase
 */
function getPublicImageUrl(storagePath) {
    if (!storagePath) return null;

    const client = window.biomeSupabase;
    if (!client) {
        console.warn('⚠️ Shared client not available for image URL generation');
        return null;
    }

    try {
        const { data } = client.storage
            .from('listing-media')
            .getPublicUrl(storagePath);
        return data.publicUrl || null;
    } catch (error) {
        console.warn('Failed to get public URL:', error);
        return null;
    }
}

/**
 * Get safe image URL with fallback to placeholder
 */
function getSafeImageUrl(storagePath) {
    const url = getPublicImageUrl(storagePath);
    return url || getPlaceholderImage();
}

/**
 * Get placeholder image (SVG data URI)
 * FIXED: Properly terminated string
 */
function getPlaceholderImage() {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23f3f4f6"/%3E%3Ctext x="400" y="300" font-family="Arial" font-size="24" fill="%239ca3af" text-anchor="middle"%3ENo Image Available%3C/text%3E%3C/svg%3E';
}

// =====================================================
// UI UTILITIES
// =====================================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 4000);
}

/**
 * Debounce function for search/filter inputs
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

/**
 * Validate UUID format
 */
function isValidUUID(id) {
    if (!id || typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

/**
 * Get URL parameter
 */
function getUrlParam(param) {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
}

/**
 * Redirect with optional delay
 */
function redirectTo(url, delay = 0) {
    if (delay > 0) {
        setTimeout(() => {
            window.location.href = url;
        }, delay);
    } else {
        window.location.href = url;
    }
}

// =====================================================
// CLIENT VALIDATION
// =====================================================

/**
 * Validate that the shared Supabase client is available
 */
function validateSharedClient() {
    const client = window.biomeSupabase;
    if (!client) {
        console.error('❌ Shared Supabase client not found.');
        return false;
    }
    console.log('✅ Shared Supabase client available.');
    return true;
}

/**
 * Get the shared Supabase client
 * @throws {Error} If client is not available
 */
function getSharedClient() {
    const client = window.biomeSupabase;
    if (!client) {
        throw new Error('Shared Supabase client not available. Please refresh the page.');
    }
    return client;
}

// =====================================================
// EXPOSE TO WINDOW
// =====================================================

// Formatting
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatAddress = formatAddress;

// Images
window.getPublicImageUrl = getPublicImageUrl;
window.getSafeImageUrl = getSafeImageUrl;
window.getPlaceholderImage = getPlaceholderImage;

// UI
window.showToast = showToast;
window.debounce = debounce;

// Validation
window.isValidUUID = isValidUUID;
window.getUrlParam = getUrlParam;
window.redirectTo = redirectTo;

// Client
window.validateSharedClient = validateSharedClient;
window.getSharedClient = getSharedClient;

console.log('✅ Shared utilities loaded.');
