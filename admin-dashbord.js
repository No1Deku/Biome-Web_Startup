/* ============================================================
   BIOME ADMIN DASHBOARD — PRODUCTION REFACTOR
   RLS-ready | Row-count validation | Debug logging
   ============================================================ */

const DEBUG = true;
const log = (...args) => DEBUG && console.log('[Admin Dashboard]', ...args);

const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DRAFT: 'draft',
};

const STATUS_DISPLAY = {
  [STATUS.DRAFT]: 'Draft',
  [STATUS.PENDING]: 'Pending Review',
  [STATUS.APPROVED]: 'Published',
  [STATUS.REJECTED]: 'Rejected',
};

const BUCKET_NAME = 'listing-media';

const dom = {
  logoutBtn: document.getElementById('logoutBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  listingsContainer: document.getElementById('listingsContainer'),
  emptyState: document.getElementById('emptyState'),
  pageTitle: document.getElementById('pageTitle'),
  totalCount: document.getElementById('totalCount'),
  pendingCount: document.getElementById('pendingCount'),
  approvedCount: document.getElementById('approvedCount'),
  rejectedCount: document.getElementById('rejectedCount'),
  pendingBadge: document.getElementById('pendingBadge'),
  approvedBadge: document.getElementById('approvedBadge'),
  rejectedBadge: document.getElementById('rejectedBadge'),
  modal: document.getElementById('detailModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
};

const DashboardState = {
  listings: [],
  currentView: STATUS.PENDING,
  currentUser: null,
  currentProfile: null,
  loading: false,
  searchDebounceTimer: null,
  queryError: false,
};

document.addEventListener('DOMContentLoaded', initializeDashboard);

async function initializeDashboard() {
  log('Initialization started');
  try {
    await BiomeAuth.requireAuth();
    await BiomeAuth.requireRole('admin');
    const supabase = BiomeAuth.supabase;
    window.supabase = supabase;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');
    DashboardState.currentUser = user;
    DashboardState.currentProfile = await BiomeAuth.getCurrentProfile();
    log('[Auth] Admin user:', user.email, '| Role:', DashboardState.currentProfile?.account_type);

    registerEventListeners();
    changeView(STATUS.PENDING);
    await loadMetrics();
    await loadListings();
    startRealtimeSubscription();
    log('Dashboard ready');
  } catch (error) {
    console.error('[Admin Dashboard] Initialization failed:', error);
    showToast('Failed to load dashboard. Please refresh.', 'error');
  }
}

function changeView(view) {
  DashboardState.currentView = view;
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.view === view) link.classList.add('active');
  });
  const titles = {
    pending: 'Pending Reviews',
    approved: 'Published Listings',
    rejected: 'Rejected Listings',
    all: 'All Listings',
    users: 'Users',
  };
  dom.pageTitle.textContent = titles[view] || 'Dashboard';
  if (view === 'users') {
    dom.listingsContainer.innerHTML = `
      <div class="empty-state" style="display:block;grid-column:1/-1;">
        <div class="empty-icon">👥</div>
        <h3>User Management</h3>
        <p>User administration will be available in a future update.</p>
      </div>`;
    dom.emptyState.style.display = 'none';
    return;
  }
  loadListings();
}

async function loadMetrics() {
  try {
    const statuses = [STATUS.PENDING, STATUS.APPROVED, STATUS.REJECTED];
    const counts = {};
    for (const status of statuses) {
      const { count, error } = await window.supabase
        .from('listing_complete_view')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      counts[status] = count || 0;
      if (error) console.error(`Metrics error (${status}):`, error);
    }
    const { count: total, error: totalErr } = await window.supabase
      .from('listing_complete_view')
      .select('*', { count: 'exact', head: true });
    if (totalErr) console.error('Total metrics error:', totalErr);

    dom.totalCount.textContent = total || 0;
    dom.pendingCount.textContent = counts[STATUS.PENDING];
    dom.approvedCount.textContent = counts[STATUS.APPROVED];
    dom.rejectedCount.textContent = counts[STATUS.REJECTED];
    dom.pendingBadge.textContent = counts[STATUS.PENDING];
    dom.approvedBadge.textContent = counts[STATUS.APPROVED];
    dom.rejectedBadge.textContent = counts[STATUS.REJECTED];
  } catch (err) {
    console.error('[Metrics]', err);
    showToast('Could not load statistics.', 'error');
  }
}

async function loadListings() {
  if (DashboardState.loading) return;
  DashboardState.loading = true;
  DashboardState.queryError = false;
  toggleLoading(true);

  try {
    let query = window.supabase
      .from('listing_complete_view')
      .select('*');

    if (DashboardState.currentView !== 'all' && DashboardState.currentView !== 'users') {
      query = query.eq('status', DashboardState.currentView);
    }
    query = query.order('submitted_at', { ascending: false, nullsFirst: false });

    const { data, error } = await query;
    if (error) {
      DashboardState.queryError = true;
      throw error;
    }
    DashboardState.listings = data || [];
    applyFilters();
  } catch (err) {
    console.error('[Listings]', err);
    DashboardState.listings = DashboardState.listings || [];
    showToast('Could not load listings. Displaying cached data.', 'error');
    renderListings(DashboardState.listings);
  } finally {
    DashboardState.loading = false;
    toggleLoading(false);
  }
}

function getPublicImage(path) {
  if (!path) return null;
  const { data } = window.supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data?.publicUrl || null;
}

function applyFilters() {
  const searchTerm = dom.searchInput.value.trim().toLowerCase();
  let filtered = DashboardState.listings;
  if (searchTerm) {
    filtered = filtered.filter(l =>
      (l.title || '').toLowerCase().includes(searchTerm) ||
      (l.city || '').toLowerCase().includes(searchTerm) ||
      (l.suburb || '').toLowerCase().includes(searchTerm) ||
      (l.property_type || '').toLowerCase().includes(searchTerm) ||
      (l.seller_name || '').toLowerCase().includes(searchTerm)
    );
  }
  renderListings(filtered);
}

function renderListings(listings) {
  dom.listingsContainer.innerHTML = '';
  if (DashboardState.queryError) {
    dom.emptyState.style.display = 'block';
    dom.emptyState.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <h3>Unable to load listings</h3>
      <p>Please refresh the page or try again later.</p>`;
    return;
  }
  if (!listings || listings.length === 0) {
    dom.emptyState.style.display = 'block';
    dom.emptyState.innerHTML = `
      <div class="empty-icon">📭</div>
      <h3>No listings found</h3>
      <p>No listings have been submitted.</p>`;
    return;
  }
  dom.emptyState.style.display = 'none';

  const fragment = document.createDocumentFragment();
  listings.forEach(listing => fragment.appendChild(createListingCard(listing)));
  dom.listingsContainer.appendChild(fragment);
}

function createListingCard(listing) {
  const card = document.createElement('div');
  card.className = 'listing-card';

  const coverUrl = listing.cover_public_url || getPublicImage(listing.cover_storage_path);
  const coverHtml = coverUrl
    ? `<img src="${coverUrl}" alt="${listing.title}" class="listing-cover">`
    : `<div class="listing-cover" style="background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:2rem;">🏠</div>`;

  const statusClass = listing.status === STATUS.APPROVED ? 'approved' : listing.status;
  const statusDisplay = STATUS_DISPLAY[listing.status] || listing.status;

  let actionsHtml = '';
  if (listing.status === STATUS.PENDING) {
    actionsHtml = `
      <button class="btn btn-approve" data-action="approve" data-id="${listing.listing_id}">✅ Approve</button>
      <button class="btn btn-reject" data-action="reject" data-id="${listing.listing_id}">❌ Reject</button>
    `;
  }

  let rejectionHtml = '';
  if (listing.status === STATUS.REJECTED && listing.rejection_reason) {
    rejectionHtml = `<div class="listing-meta"><span style="color:#ef4444;font-size:0.85rem;">❌ ${listing.rejection_reason}</span></div>`;
  }

  card.innerHTML = `
    ${coverHtml}
    <div class="listing-body">
      <div class="listing-row">
        <h3 class="listing-title">${listing.title || 'Untitled'}</h3>
        <span class="listing-price">${formatPrice(listing.price)}</span>
      </div>
      <div class="listing-meta">
        <span><span class="meta-icon">🏷️</span> ${listing.property_type || 'Unknown'}</span>
        <span><span class="meta-icon">📍</span> ${listing.suburb || ''}, ${listing.city || ''}</span>
      </div>
      ${rejectionHtml}
      <div class="listing-meta">
        <span><span class="meta-icon">👤</span> ${listing.seller_name || 'Unknown'}</span>
        <span><span class="meta-icon">📅</span> ${formatDate(listing.submitted_at)}</span>
      </div>
      <div class="listing-footer">
        <span class="status-badge ${statusClass}">${statusDisplay}</span>
        <div class="listing-actions">
          <button class="btn btn-view" data-action="view" data-id="${listing.listing_id}">👁️ View</button>
          ${actionsHtml}
        </div>
      </div>
    </div>
  `;
  return card;
}

function handleListingAction(e) {
  const target = e.target.closest('button');
  if (!target) return;
  const listingId = target.dataset.id;
  const action = target.dataset.action;
  if (!listingId || !action) return;

  switch (action) {
    case 'approve': approveListing(listingId); break;
    case 'reject': rejectListing(listingId); break;
    case 'view': openDetailModal(listingId); break;
  }
}

// ============================================================
// APPROVE LISTING (with row-count validation)
// ============================================================
async function approveListing(listingId) {
  log('═══════════════════════════════════════');
  log('[Approve] Starting approval process');
  
  const { data: { user } } = await window.supabase.auth.getUser();
  const profile = DashboardState.currentProfile;
  
  log('[Approve] Admin ID:', user.id);
  log('[Approve] Admin Role:', profile?.account_type);
  log('[Approve] Listing ID:', listingId);

  const updatePayload = {
    status: STATUS.APPROVED,
    approved_date: new Date().toISOString(),
    reviewed_by: user.id,
    rejection_reason: null,
  };
  
  log('[Approve] Payload:', updatePayload);

  try {
    // Use .select() to get the updated row back
    const { data, error } = await window.supabase
      .from('listings')
      .update(updatePayload)
      .eq('listing_id', listingId)
      .select();

    log('[Approve] Error:', error);
    log('[Approve] Returned rows:', data?.length);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(
        'No rows updated. This is likely caused by Row Level Security (RLS) restrictions. ' +
        'Ensure the admin RLS policy is applied: ' +
        'CREATE POLICY "Admins can update any listing" ON public.listings FOR UPDATE TO authenticated USING (...);'
      );
    }

    log('[Approve] ✅ Success – Listing status is now:', data[0]?.status);
    log('═══════════════════════════════════════');

    showToast('Listing approved successfully.', 'success');
    await Promise.all([loadMetrics(), loadListings()]);
  } catch (err) {
    console.error('[Approve] ❌ Failed:', err.message);
    log('═══════════════════════════════════════');
    showToast(err.message || 'Approval failed. No database rows were updated.', 'error');
  }
}

// ============================================================
// REJECT LISTING (with reason prompt + row-count validation)
// ============================================================
async function rejectListing(listingId) {
  log('═══════════════════════════════════════');
  log('[Reject] Starting rejection process');
  
  // Prompt for rejection reason
  const reason = prompt('Why is this listing being rejected?\n\n(Minimum 10 characters, maximum 500)');
  
  // Handle cancel
  if (reason === null) {
    log('[Reject] Cancelled by admin');
    return;
  }
  
  // Validate reason
  if (!reason.trim()) {
    showToast('Rejection reason is required.', 'error');
    return;
  }
  if (reason.trim().length < 10) {
    showToast('Rejection reason must be at least 10 characters.', 'error');
    return;
  }
  if (reason.trim().length > 500) {
    showToast('Rejection reason must be less than 500 characters.', 'error');
    return;
  }

  const { data: { user } } = await window.supabase.auth.getUser();
  const profile = DashboardState.currentProfile;
  
  log('[Reject] Admin ID:', user.id);
  log('[Reject] Admin Role:', profile?.account_type);
  log('[Reject] Listing ID:', listingId);
  log('[Reject] Reason:', reason.trim());

  const updatePayload = {
    status: STATUS.REJECTED,
    reviewed_by: user.id,
    rejection_reason: reason.trim(),
    approved_date: null,
  };
  
  log('[Reject] Payload:', updatePayload);

  try {
    // Use .select() to get the updated row back
    const { data, error } = await window.supabase
      .from('listings')
      .update(updatePayload)
      .eq('listing_id', listingId)
      .select();

    log('[Reject] Error:', error);
    log('[Reject] Returned rows:', data?.length);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(
        'No rows updated. This is likely caused by Row Level Security (RLS) restrictions. ' +
        'Ensure the admin RLS policy is applied: ' +
        'CREATE POLICY "Admins can update any listing" ON public.listings FOR UPDATE TO authenticated USING (...);'
      );
    }

    log('[Reject] ✅ Success – Listing status is now:', data[0]?.status);
    log('[Reject] Rejection reason stored:', data[0]?.rejection_reason);
    log('═══════════════════════════════════════');

    showToast('Listing rejected.', 'success');
    await Promise.all([loadMetrics(), loadListings()]);
  } catch (err) {
    console.error('[Reject] ❌ Failed:', err.message);
    log('═══════════════════════════════════════');
    showToast(err.message || 'Rejection failed. No database rows were updated.', 'error');
  }
}

// ============================================================
// DETAIL MODAL
// ============================================================
async function openDetailModal(listingId) {
  const listing = DashboardState.listings.find(l => l.listing_id === listingId);
  if (!listing) return;

  dom.modalTitle.textContent = listing.title || 'Listing Details';
  dom.modalBody.innerHTML = '<p style="text-align:center;padding:40px;">Loading details…</p>';
  dom.modal.style.display = 'flex';

  let allImages = [];
  try {
    const { data: media } = await window.supabase
      .from('listing_media')
      .select('storage_path, media_type, is_cover, sort_order')
      .eq('listing_id', listingId)
      .order('sort_order');
    if (media) {
      allImages = media.map(m => getPublicImage(m.storage_path)).filter(Boolean);
    }
  } catch (err) {
    console.error('[Modal] Media fetch failed:', err);
  }

  let imagesHtml = allImages.length
    ? allImages.map(url => `<img src="${url}" alt="Property image">`).join('')
    : '<p>No images available.</p>';

  let reviewHtml = '';
  if (listing.status === STATUS.APPROVED) {
    reviewHtml = `
      <div class="detail-item">
        <div class="detail-label">Approved Date</div>
        <div class="detail-value">${formatDate(listing.approved_date)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Reviewed By</div>
        <div class="detail-value">Admin ID: ${listing.reviewed_by || 'Unknown'}</div>
      </div>`;
  } else if (listing.status === STATUS.REJECTED) {
    reviewHtml = `
      <div class="detail-item detail-full">
        <div class="detail-label">Rejection Reason</div>
        <div class="detail-value" style="color:#ef4444;">${listing.rejection_reason || 'No reason provided.'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Reviewed By</div>
        <div class="detail-value">Admin ID: ${listing.reviewed_by || 'Unknown'}</div>
      </div>`;
  } else if (listing.status === STATUS.PENDING) {
    reviewHtml = `
      <div class="detail-item detail-full">
        <div class="detail-label">Review Status</div>
        <div class="detail-value">Awaiting admin review</div>
      </div>`;
  }

  dom.modalBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Property Type</div>
        <div class="detail-value">${listing.property_type || 'Unknown'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Price</div>
        <div class="detail-value">${formatPrice(listing.price)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Bedrooms</div>
        <div class="detail-value">${listing.bedrooms || '—'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Bathrooms</div>
        <div class="detail-value">${listing.bathrooms || '—'}</div>
      </div>
      <div class="detail-item detail-full">
        <div class="detail-label">Address</div>
        <div class="detail-value">${listing.street || ''}, ${listing.suburb || ''}, ${listing.city || ''}, ${listing.province || ''}</div>
      </div>
      <div class="detail-item detail-full">
        <div class="detail-label">Description</div>
        <div class="detail-value">${listing.description || 'No description'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Seller</div>
        <div class="detail-value">${listing.seller_name || 'Unknown'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Contact</div>
        <div class="detail-value">${listing.phone || ''} ${listing.email ? '· ' + listing.email : ''}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status</div>
        <div class="detail-value"><span class="status-badge ${listing.status === STATUS.APPROVED ? 'approved' : listing.status}">${STATUS_DISPLAY[listing.status]}</span></div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Submitted</div>
        <div class="detail-value">${formatDate(listing.submitted_at)}</div>
      </div>
      ${reviewHtml}
      <div class="detail-item detail-full">
        <div class="detail-label">Images</div>
        <div class="modal-images">${imagesHtml}</div>
      </div>
    </div>
  `;
}

function closeDetailModal() {
  dom.modal.style.display = 'none';
}

function startRealtimeSubscription() {
  window.supabase
    .channel('admin-listings-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, async payload => {
      log('[Realtime] Change detected:', payload.eventType);
      await Promise.all([loadMetrics(), loadListings()]);
      const labels = { INSERT: 'New listing submitted', UPDATE: 'Listing updated', DELETE: 'Listing removed' };
      showToast(labels[payload.eventType] || 'Listings updated', 'info');
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') log('[Realtime] Subscribed');
    });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(price) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
}

function toggleLoading(active) {
  if (dom.refreshBtn) {
    dom.refreshBtn.disabled = active;
    dom.refreshBtn.textContent = active ? '⏳ Loading…' : '🔄 Refresh';
  }
}

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); if (!container.children.length) container.remove(); }, 5000);
}

function registerEventListeners() {
  dom.logoutBtn?.addEventListener('click', () => BiomeAuth.logout());
  dom.refreshBtn?.addEventListener('click', async () => {
    await Promise.all([loadMetrics(), loadListings()]);
    showToast('Dashboard refreshed', 'success');
  });
  dom.searchInput?.addEventListener('input', () => {
    clearTimeout(DashboardState.searchDebounceTimer);
    DashboardState.searchDebounceTimer = setTimeout(applyFilters, 250);
  });
  dom.statusFilter?.addEventListener('change', () => changeView(dom.statusFilter.value));
  dom.modalClose?.addEventListener('click', closeDetailModal);
  dom.modalCloseBtn?.addEventListener('click', closeDetailModal);
  dom.modal?.addEventListener('click', e => { if (e.target === dom.modal) closeDetailModal(); });
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      if (link.dataset.view) changeView(link.dataset.view);
    });
  });
  dom.listingsContainer?.addEventListener('click', handleListingAction);
}