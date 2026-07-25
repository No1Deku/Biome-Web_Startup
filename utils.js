/* =====================================================
   BIOME - Shared Utilities
   ===================================================== */

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
 * Get public URL from storage path
 */
function getPublicImageUrl(storagePath) {
    if (!storagePath) return null;

    const client = window.supabase || window.biomeSupabase || window.supabaseClient;
    if (!client) return null;

    try {
        const { data } = client.storage
            .from('listing-media')
            .getPublicUrl(storagePath);
        return data.publicUrl;
    } catch (error) {
        console.warn('Failed to get public URL:', error);
        return null;
    }
}

/**
 * Placeholder image
 */
function getPlaceholderImage() {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0