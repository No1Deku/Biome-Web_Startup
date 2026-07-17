/* ============================================================
   BIOME PROPERTY LISTINGS – Search Module
   Improved empty states | Stale request handling | Polished UX
   ============================================================ */

const DEBUG = true;
const log = (...args) => DEBUG && console.log('[Listings]', ...args);

// ----------------------------------------------------
// 1. CONSTANTS
// ----------------------------------------------------
const PAGE_SIZE = 12;
const DEBOUNCE_MS = 300;
const BUCKET_NAME = 'listing-media';

// ----------------------------------------------------
// 2. DOM CACHE
// ----------------------------------------------------
const dom = {
  searchInput: document.getElementById('searchInput'),
  filterToggleBtn: document.getElementById('filterToggleBtn'),
  extendedFilters: document.getElementById('extendedFilters'),
  closeFiltersBtn: document.getElementById('closeFiltersBtn'),
  categoryButtons: document.getElementById('categoryButtons'),
  propertyTypeFilter: document.getElementById('propertyTypeFilter'),
  minPrice: document.getElementById('minPrice'),
  maxPrice: document.getElementById('maxPrice'),
  bedroomsFilter: document.getElementById('bedroomsFilter'),
  bathroomsFilter: document.getElementById('bathroomsFilter'),
  provinceFilter: document.getElementById('provinceFilter'),
  cityFilter: document.getElementById('cityFilter'),
  suburbFilter: document.getElementById('suburbFilter'),
  sortBy: document.getElementById('sortBy'),
  applyFiltersBtn: document.getElementById('applyFiltersBtn'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  listingsGrid: document.getElementById('listingsGrid'),
  resultsCount: document.getElementById('resultsCount'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  errorState: document.getElementById('errorState'),
  pagination: document.getElementById('pagination'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageInfo: document.getElementById('pageInfo'),
};

// ----------------------------------------------------
// 3. SEARCH STATE
// ----------------------------------------------------
const SearchState = {
  searchText: '',
  propertyTypeId: null,
  minPrice: null,
  maxPrice: null,
  bedrooms: null,
  bathrooms: null,
  province: '',
  city: '',
  suburb: '',
  sortBy: 'newest',
  page: 1,
  pageSize: PAGE_SIZE,
  totalCount: 0,
  debounceTimer: null,
  requestId: 0, // For stale request handling
};

// ----------------------------------------------------
// 4. INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', init);

async function init() {
  log('Initializing listings page');

  // Get Supabase client (public access allowed for approved listings)
  const supabaseUrl = 'https://cwatxxamkoukctwijomr.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3YXR4eGFta291a2N0d2lqb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDU0NDYsImV4cCI6MjA5OTY4MTQ0Nn0.rfVtSuJK5xgmHCinKHbni0DLazedmvW6yKQaVTBD3PM';
  window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  // Load property types for filters
  await loadPropertyTypes();

  // Set up event listeners
  registerEventListeners();

  // Initial load: show approved listings
  await fetchAndRenderListings();

  // On mobile, start with filters collapsed
  if (window.innerWidth <= 768) {
    collapseFilters();
  }
}

// ----------------------------------------------------
// 5. PROPERTY TYPES (dynamic)
// ----------------------------------------------------
async function loadPropertyTypes() {
  try {
    const { data: types, error } = await window.supabase
      .from('property_types')
      .select('property_type_id, property_name')
      .order('property_name');

    if (error) throw error;
    if (!types || types.length === 0) return;

    // Populate category buttons
    dom.categoryButtons.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'active';
    allBtn.dataset.typeId = '';
    allBtn.innerHTML = '<i class="fa-solid fa-border-all"></i> All';
    dom.categoryButtons.appendChild(allBtn);

    types.forEach(type => {
      const btn = document.createElement('button');
      btn.dataset.typeId = type.property_type_id;
      btn.innerHTML = `<i class="fa-solid fa-building"></i> ${type.property_name}`;
      dom.categoryButtons.appendChild(btn);
    });

    // Populate filter dropdown
    dom.propertyTypeFilter.innerHTML = '<option value="">All Types</option>';
    types.forEach(type => {
      const option = document.createElement('option');
      option.value = type.property_type_id;
      option.textContent = type.property_name;
      dom.propertyTypeFilter.appendChild(option);
    });
  } catch (err) {
    console.error('[PropertyTypes] Failed to load:', err);
  }
}

// ----------------------------------------------------
// 6. GET PUBLIC IMAGE URL
// ----------------------------------------------------
function getPublicImage(path) {
  if (!path) return null;
  const { data } = window.supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data?.publicUrl || null;
}

// ----------------------------------------------------
// 7. FETCH & RENDER (with stale request handling)
// ----------------------------------------------------
async function fetchAndRenderListings() {
  // Increment request ID to track stale requests
  const currentRequestId = ++SearchState.requestId;

  // === PHASE 1: Clear previous listings immediately ===
  dom.listingsGrid.innerHTML = '';
  hideEmpty();
  hideError();
  showLoading();

  // Hide pagination during loading
  dom.pagination.style.display = 'none';

  try {
    const supabase = window.supabase;
    let query = supabase
      .from('listing_complete_view')
      .select('*', { count: 'exact' })
      .eq('status', 'approved'); // Only approved/published listings

    // Apply filters
    if (SearchState.propertyTypeId) {
      query = query.eq('property_type_id', SearchState.propertyTypeId);
    }
    if (SearchState.minPrice !== null) {
      query = query.gte('price', SearchState.minPrice);
    }
    if (SearchState.maxPrice !== null) {
      query = query.lte('price', SearchState.maxPrice);
    }
    if (SearchState.bedrooms !== null) {
      query = query.gte('bedrooms', SearchState.bedrooms);
    }
    if (SearchState.bathrooms !== null) {
      query = query.gte('bathrooms', SearchState.bathrooms);
    }
    if (SearchState.province) {
      query = query.ilike('province', `%${SearchState.province}%`);
    }
    if (SearchState.city) {
      query = query.ilike('city', `%${SearchState.city}%`);
    }
    if (SearchState.suburb) {
      query = query.ilike('suburb', `%${SearchState.suburb}%`);
    }
    if (SearchState.searchText) {
      query = query.or(
        `title.ilike.%${SearchState.searchText}%,` +
        `city.ilike.%${SearchState.searchText}%,` +
        `suburb.ilike.%${SearchState.searchText}%,` +
        `province.ilike.%${SearchState.searchText}%`
      );
    }

    // Sorting
    switch (SearchState.sortBy) {
      case 'oldest':
        query = query.order('submitted_at', { ascending: true });
        break;
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'bedrooms_desc':
        query = query.order('bedrooms', { ascending: false });
        break;
      default: // newest
        query = query.order('submitted_at', { ascending: false });
    }

    // Pagination
    const start = (SearchState.page - 1) * SearchState.pageSize;
    const end = start + SearchState.pageSize - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;

    // === PHASE 9: Handle stale requests ===
    // If a newer request was made, ignore this response
    if (currentRequestId !== SearchState.requestId) {
      log(`[Stale] Ignoring request #${currentRequestId}, latest is #${SearchState.requestId}`);
      return;
    }

    if (error) throw error;

    SearchState.totalCount = count || 0;
    hideLoading();

    // === PHASE 2: Handle zero results ===
    if (!data || data.length === 0) {
      dom.listingsGrid.innerHTML = '';
      SearchState.totalCount = 0;
      dom.pagination.style.display = 'none';
      showEmpty();
      updateResultsSummary();
      return;
    }

    // === PHASE 3: Restore results ===
    hideEmpty();
    renderListings(data);
    updateResultsSummary();
    updatePagination();
  } catch (err) {
    // Ignore stale errors too
    if (currentRequestId !== SearchState.requestId) return;

    console.error('[Listings] Query failed:', err);
    hideLoading();
    showError();
  }
}

// ----------------------------------------------------
// 8. RENDER LISTINGS
// ----------------------------------------------------
function renderListings(listings) {
  dom.listingsGrid.innerHTML = '';

  listings.forEach(listing => {
    const coverUrl = listing.cover_public_url || getPublicImage(listing.cover_storage_path);
    const card = document.createElement('div');
    card.className = 'property-card';
    card.addEventListener('click', () => {
      window.location.href = `property-details.html?id=${listing.listing_id}`;
    });

    card.innerHTML = `
      <img 
        src="${coverUrl || 'assets/images/placeholder-property.jpg'}" 
        alt="${listing.title || 'Property'}" 
        class="card-image"
        loading="lazy"
        onerror="this.src='assets/images/placeholder-property.jpg'"
      >
      <div class="card-body">
        <div class="card-price">${formatPrice(listing.price)}</div>
        <div class="card-title">${listing.title || 'Untitled'}</div>
        <div class="card-meta">
          <span><i class="fa-solid fa-bed"></i> ${listing.bedrooms || 0} Beds</span>
          <span><i class="fa-solid fa-bath"></i> ${listing.bathrooms || 0} Baths</span>
        </div>
        <div class="card-footer">
          <span class="card-location">
            <i class="fa-solid fa-location-dot"></i> ${listing.suburb || ''}, ${listing.city || ''}
          </span>
          <span class="card-type">${listing.property_type || 'Property'}</span>
        </div>
      </div>
    `;

    dom.listingsGrid.appendChild(card);
  });
}

// ----------------------------------------------------
// 9. STATE HELPERS
// ----------------------------------------------------
function showLoading() {
  dom.loadingState.style.display = 'block';
}

function hideLoading() {
  dom.loadingState.style.display = 'none';
}

function showEmpty() {
  dom.emptyState.style.display = 'block';
}

function hideEmpty() {
  dom.emptyState.style.display = 'none';
}

function showError() {
  dom.errorState.style.display = 'block';
}

function hideError() {
  dom.errorState.style.display = 'none';
}

// ----------------------------------------------------
// 10. UPDATE RESULTS SUMMARY (improved)
// ----------------------------------------------------
function updateResultsSummary() {
  const total = SearchState.totalCount;

  if (total === 0) {
    dom.resultsCount.textContent = '0 properties found';
    return;
  }

  const start = (SearchState.page - 1) * SearchState.pageSize + 1;
  const end = Math.min(SearchState.page * SearchState.pageSize, total);
  dom.resultsCount.textContent = `Showing ${start}–${end} of ${total} properties`;
}

// ----------------------------------------------------
// 11. UPDATE PAGINATION
// ----------------------------------------------------
function updatePagination() {
  const total = SearchState.totalCount;
  const totalPages = Math.ceil(total / SearchState.pageSize);

  // === PHASE 6: Hide pagination when no results or only one page ===
  if (total === 0 || totalPages <= 1) {
    dom.pagination.style.display = 'none';
    return;
  }

  dom.pagination.style.display = 'flex';
  dom.prevPageBtn.disabled = SearchState.page <= 1;
  dom.nextPageBtn.disabled = SearchState.page >= totalPages;
  dom.pageInfo.textContent = `Page ${SearchState.page} of ${totalPages}`;
}

// ----------------------------------------------------
// 12. FILTER LOGIC
// ----------------------------------------------------
function collectSearchState() {
  SearchState.searchText = dom.searchInput.value.trim();
  SearchState.propertyTypeId = dom.propertyTypeFilter.value || null;
  SearchState.minPrice = dom.minPrice.value ? parseFloat(dom.minPrice.value) : null;
  SearchState.maxPrice = dom.maxPrice.value ? parseFloat(dom.maxPrice.value) : null;
  SearchState.bedrooms = dom.bedroomsFilter.value ? parseInt(dom.bedroomsFilter.value) : null;
  SearchState.bathrooms = dom.bathroomsFilter.value ? parseInt(dom.bathroomsFilter.value) : null;
  SearchState.province = dom.provinceFilter.value.trim();
  SearchState.city = dom.cityFilter.value.trim();
  SearchState.suburb = dom.suburbFilter.value.trim();
  SearchState.sortBy = dom.sortBy.value;
  SearchState.page = 1; // Reset to first page on new filter
}

function applyFilters() {
  collectSearchState();
  fetchAndRenderListings();
}

function resetFilters() {
  // Reset all inputs
  dom.searchInput.value = '';
  dom.propertyTypeFilter.value = '';
  dom.minPrice.value = '';
  dom.maxPrice.value = '';
  dom.bedroomsFilter.value = '';
  dom.bathroomsFilter.value = '';
  dom.provinceFilter.value = '';
  dom.cityFilter.value = '';
  dom.suburbFilter.value = '';
  dom.sortBy.value = 'newest';

  // Reset category buttons
  document.querySelectorAll('.categories button').forEach(b => b.classList.remove('active'));
  const allBtn = document.querySelector('.categories button[data-type-id=""]');
  if (allBtn) allBtn.classList.add('active');

  // Reset state
  SearchState.searchText = '';
  SearchState.propertyTypeId = null;
  SearchState.minPrice = null;
  SearchState.maxPrice = null;
  SearchState.bedrooms = null;
  SearchState.bathrooms = null;
  SearchState.province = '';
  SearchState.city = '';
  SearchState.suburb = '';
  SearchState.sortBy = 'newest';
  SearchState.page = 1;

  fetchAndRenderListings();
}

// ----------------------------------------------------
// 13. FILTER PANEL TOGGLE
// ----------------------------------------------------
function collapseFilters() {
  dom.extendedFilters.classList.add('collapsed');
  dom.filterToggleBtn.style.display = 'flex';
  dom.filterToggleBtn.setAttribute('aria-expanded', 'false');
}

function expandFilters() {
  dom.extendedFilters.classList.remove('collapsed');
  if (window.innerWidth <= 768) {
    dom.filterToggleBtn.style.display = 'none';
  }
  dom.filterToggleBtn.setAttribute('aria-expanded', 'true');
}

function toggleFilters() {
  if (dom.extendedFilters.classList.contains('collapsed')) {
    expandFilters();
  } else {
    collapseFilters();
  }
}

// ----------------------------------------------------
// 14. UTILITIES
// ----------------------------------------------------
function formatPrice(price) {
  if (!price) return 'R 0';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
  }).format(price);
}

// ----------------------------------------------------
// 15. EVENT LISTENERS
// ----------------------------------------------------
function registerEventListeners() {
  // Search input (debounced)
  dom.searchInput.addEventListener('input', () => {
    clearTimeout(SearchState.debounceTimer);
    SearchState.debounceTimer = setTimeout(() => {
      SearchState.searchText = dom.searchInput.value.trim();
      SearchState.page = 1;
      fetchAndRenderListings();
    }, DEBOUNCE_MS);
  });

  // Filter toggle (mobile)
  dom.filterToggleBtn.addEventListener('click', toggleFilters);
  dom.closeFiltersBtn.addEventListener('click', collapseFilters);

  // Category buttons
  dom.categoryButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    document.querySelectorAll('.categories button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const typeId = btn.dataset.typeId || '';
    SearchState.propertyTypeId = typeId || null;
    dom.propertyTypeFilter.value = typeId;
    SearchState.page = 1;
    fetchAndRenderListings();
  });

  // Property type dropdown (sync with categories)
  dom.propertyTypeFilter.addEventListener('change', () => {
    const typeId = dom.propertyTypeFilter.value || '';
    document.querySelectorAll('.categories button').forEach(b => b.classList.remove('active'));
    const matchingBtn = document.querySelector(`.categories button[data-type-id="${typeId}"]`);
    if (matchingBtn) matchingBtn.classList.add('active');
    else {
      const allBtn = document.querySelector('.categories button[data-type-id=""]');
      if (allBtn) allBtn.classList.add('active');
    }
  });

  // Apply filters button
  dom.applyFiltersBtn.addEventListener('click', applyFilters);

  // Reset filters button
  dom.resetFiltersBtn.addEventListener('click', resetFilters);

  // Pagination
  dom.prevPageBtn.addEventListener('click', () => {
    if (SearchState.page > 1) {
      SearchState.page--;
      fetchAndRenderListings();
    }
  });

  dom.nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(SearchState.totalCount / SearchState.pageSize);
    if (SearchState.page < totalPages) {
      SearchState.page++;
      fetchAndRenderListings();
    }
  });

  // Close filters when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return;
    const container = document.getElementById('filtersContainer');
    if (container && !container.contains(e.target)) {
      collapseFilters();
    }
  });
}