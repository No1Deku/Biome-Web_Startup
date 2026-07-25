/* =====================================================
   BIOME - Property Listings Module
   =====================================================
   Uses shared client from window.biomeSupabase
   Uses shared utilities from utils.js
   ===================================================== */

// =====================================================
// STATE
// =====================================================

const ListingsState = {
    properties: [],
    filteredProperties: [],
    currentPage: 1,
    itemsPerPage: 9,
    totalItems: 0,
    totalPages: 0,
    loading: false,
    propertyTypes: [],
    filters: {
        search: '',
        province: '',
        city: '',
        propertyType: '',
        minPrice: '',
        maxPrice: '',
        sortBy: 'created_at_desc'
    }
};

// =====================================================
// DOM CACHE
// =====================================================

const DOM = {
    grid: document.getElementById('featuredGrid'),
    loading: document.getElementById('featuredLoading'),
    empty: document.getElementById('featuredEmpty'),
    error: document.getElementById('featuredError'),
    searchInput: document.getElementById('heroSearch'),
    provinceSelect: document.getElementById('heroProvince'),
    citySelect: document.getElementById('heroCity'),
    propertyTypeSelect: document.getElementById('heroPropertyType'),
    minPriceSelect: document.getElementById('heroMinPrice'),
    maxPriceSelect: document.getElementById('heroMaxPrice'),
    pagination: document.getElementById('pagination'),
    totalCount: document.getElementById('totalCount'),
    resultsCount: document.getElementById('resultsCount')
};

// =====================================================
// CLIENT ACCESS
// =====================================================

function getClient() {
    const client = window.biomeSupabase;
    if (!client) {
        console.error('❌ Listings: Shared Supabase client not available');
        return null;
    }
    return client;
}

// =====================================================
// DATA LOADERS
// =====================================================

async function loadPropertyTypes() {
    const client = getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('property_types')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.warn('Failed to load property types:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.warn('Failed to load property types:', error);
        return [];
    }
}

async function loadListings(page = 1, filters = {}) {
    const client = getClient();
    if (!client) return { data: [], total: 0 };

    try {
        let query = client
            .from('listing_complete_view')
            .select('*', { count: 'exact' })
            .eq('status', 'approved');

        // Apply filters
        if (filters.search) {
            query = query.ilike('title', `%${filters.search}%`);
        }

        if (filters.province) {
            query = query.eq('province', filters.province);
        }

        if (filters.city) {
            query = query.eq('city', filters.city);
        }

        if (filters.propertyType) {
            query = query.eq('property_type', filters.propertyType);
        }

        if (filters.minPrice) {
            query = query.gte('price', parseInt(filters.minPrice));
        }

        if (filters.maxPrice) {
            query = query.lte('price', parseInt(filters.maxPrice));
        }

        // Apply sorting
        switch (filters.sortBy) {
            case 'price_asc':
                query = query.order('price', { ascending: true });
                break;
            case 'price_desc':
                query = query.order('price', { ascending: false });
                break;
            case 'created_at_desc':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }

        // Apply pagination
        const start = (page - 1) * 9;
        const end = start + 9 - 1;
        query = query.range(start, end);

        const { data, error, count } = await query;

        if (error) {
            console.error('Failed to load listings:', error);
            return { data: [], total: 0 };
        }

        return { data: data || [], total: count || 0 };
    } catch (error) {
        console.error('Failed to load listings:', error);
        return { data: [], total: 0 };
    }
}

// =====================================================
// RENDERERS
// =====================================================

function renderPropertyCard(listing) {
    const imageUrl = window.getSafeImageUrl(listing.cover_image);
    const price = window.formatCurrency(listing.price);
    const location = listing.city || listing.suburb || 'Location';

    return `
        <div class="property-card" data-listing-id="${listing.listing_id}" role="button" tabindex="0">
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

function renderListings(listings) {
    const grid = DOM.grid;
    if (!grid) return;

    if (!listings || listings.length === 0) {
        grid.style.display = 'none';
        if (DOM.empty) DOM.empty.style.display = 'block';
        if (DOM.error) DOM.error.style.display = 'none';
        return;
    }

    grid.style.display = 'grid';
    if (DOM.empty) DOM.empty.style.display = 'none';
    if (DOM.error) DOM.error.style.display = 'none';

    grid.innerHTML = listings.map(listing => renderPropertyCard(listing)).join('');

    // Register click events
    registerCardEvents(grid);
}

function registerCardEvents(container) {
    container.querySelectorAll('.property-card').forEach(card => {
        const listingId = card.dataset.listingId;
        if (!listingId) {
            console.warn('Card missing listing_id');
            return;
        }

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

function renderPagination(totalItems, currentPage, itemsPerPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    ListingsState.totalPages = totalPages;

    const paginationContainer = DOM.pagination;
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '<div class="pagination-controls">';

    // Previous button
    if (currentPage > 1) {
        html += `<button class="page-btn" data-page="${currentPage - 1}"><i class="fa-solid fa-chevron-left"></i></button>`;
    }

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span class="page-ellipsis">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="page-ellipsis">...</span>`;
        }
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    if (currentPage < totalPages) {
        html += `<button class="page-btn" data-page="${currentPage + 1}"><i class="fa-solid fa-chevron-right"></i></button>`;
    }

    html += '</div>';
    paginationContainer.innerHTML = html;

    // Register pagination events
    paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && page !== ListingsState.currentPage) {
                ListingsState.currentPage = page;
                loadAndRender();
            }
        });
    });
}

// =====================================================
// FILTER HANDLING
// =====================================================

function getFilters() {
    return {
        search: DOM.searchInput?.value || '',
        province: DOM.provinceSelect?.value || '',
        city: DOM.citySelect?.value || '',
        propertyType: DOM.propertyTypeSelect?.value || '',
        minPrice: DOM.minPriceSelect?.value || '',
        maxPrice: DOM.maxPriceSelect?.value || '',
        sortBy: 'created_at_desc'
    };
}

function updateFilters() {
    ListingsState.filters = getFilters();
    ListingsState.currentPage = 1;
    loadAndRender();
}

// =====================================================
// MAIN LOAD FUNCTION
// =====================================================

async function loadAndRender() {
    const loading = DOM.loading;
    const grid = DOM.grid;
    const empty = DOM.empty;
    const error = DOM.error;

    // Show loading
    if (loading) loading.style.display = 'block';
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (error) error.style.display = 'none';

    ListingsState.loading = true;

    try {
        const { data, total } = await loadListings(
            ListingsState.currentPage,
            ListingsState.filters
        );

        ListingsState.properties = data;
        ListingsState.totalItems = total;

        renderListings(data);
        renderPagination(total, ListingsState.currentPage, ListingsState.itemsPerPage);

        if (DOM.totalCount) DOM.totalCount.textContent = total;

    } catch (err) {
        console.error('Failed to load listings:', err);
        if (error) error.style.display = 'block';
        if (grid) grid.style.display = 'none';
        if (empty) empty.style.display = 'none';
        window.showToast('Failed to load listings. Please try again.', 'error');
    } finally {
        ListingsState.loading = false;
        if (loading) loading.style.display = 'none';
    }
}

// =====================================================
// INITIALIZATION
// =====================================================

async function init() {
    console.log('🚀 Property Listings initializing...');

    // Validate shared client
    if (!window.validateSharedClient()) {
        if (DOM.error) {
            DOM.error.style.display = 'block';
            DOM.error.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation empty-icon" style="color:var(--danger);"></i>
                <h3>Unable to Connect</h3>
                <p>Please refresh the page or try again later.</p>
            `;
        }
        return;
    }

    // Load property types for filter dropdown
    const types = await loadPropertyTypes();
    ListingsState.propertyTypes = types;

    if (DOM.propertyTypeSelect) {
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.name;
            option.textContent = type.name;
            DOM.propertyTypeSelect.appendChild(option);
        });
    }

    // Set up filter events (debounced)
    const debouncedUpdate = window.debounce(updateFilters, 300);

    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', debouncedUpdate);
    }

    if (DOM.provinceSelect) {
        DOM.provinceSelect.addEventListener('change', updateFilters);
    }

    if (DOM.citySelect) {
        DOM.citySelect.addEventListener('change', updateFilters);
    }

    if (DOM.propertyTypeSelect) {
        DOM.propertyTypeSelect.addEventListener('change', updateFilters);
    }

    if (DOM.minPriceSelect) {
        DOM.minPriceSelect.addEventListener('change', updateFilters);
    }

    if (DOM.maxPriceSelect) {
        DOM.maxPriceSelect.addEventListener('change', updateFilters);
    }

    // Load initial listings
    await loadAndRender();

    console.log('✅ Property Listings initialized');
}

// =====================================================
// START
// =====================================================

document.addEventListener('DOMContentLoaded', init);
