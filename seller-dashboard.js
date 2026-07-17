/* =====================================================
   BIOME SELLER DASHBOARD — PRODUCTION REFACTOR
   Complete approval workflow | Draft/Submit/Resubmit
   ===================================================== */

const DEBUG = true;
const log = (...args) => DEBUG && console.log('[Dashboard]', ...args);

const BUCKET_NAME = 'listing-media';
const MAX_IMAGES = 10;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// DOM cache
const dom = {
  logoutBtn: document.getElementById('logoutBtn'),
  welcomeMessage: document.getElementById('welcomeMessage'),
  companyLabel: document.getElementById('companyLabel'),
  totalListings: document.getElementById('totalListings'),
  draftListings: document.getElementById('draftListings'),
  pendingListings: document.getElementById('pendingListings'),
  publishedListings: document.getElementById('publishedListings'),
  rejectedListings: document.getElementById('rejectedListings'),
  createBtn: document.getElementById('createBtn'),
  editBtn: document.getElementById('editBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  viewBtn: document.getElementById('viewBtn'),
  statusFilter: document.getElementById('statusFilter'),
  searchListings: document.getElementById('searchListings'),
  listingContainer: document.getElementById('listingContainer'),
  listingModal: document.getElementById('listingModal'),
  modalTitle: document.getElementById('modalTitle'),
  closeModalBtn: document.getElementById('closeModal'),
  cancelBtn: document.getElementById('cancelBtn'),
  listingForm: document.getElementById('listingForm'),
  title: document.getElementById('title'),
  propertyType: document.getElementById('propertyType'),
  description: document.getElementById('description'),
  price: document.getElementById('price'),
  bedrooms: document.getElementById('bedrooms'),
  bathrooms: document.getElementById('bathrooms'),
  street: document.getElementById('street'),
  suburb: document.getElementById('suburb'),
  city: document.getElementById('city'),
  province: document.getElementById('province'),
  propertyImages: document.getElementById('propertyImages'),
  propertyVideo: document.getElementById('propertyVideo'),
  saveDraftBtn: document.getElementById('saveDraftBtn'),
  submitListingBtn: document.getElementById('submitListingBtn'),
  imagePreview: document.getElementById('imagePreview'),
  videoPreview: document.getElementById('videoPreview'),
  formLoading: document.getElementById('formLoading'),
};

const DashboardState = {
  currentUser: null,
  currentUserId: null,
  profile: null,
  listings: [],
  propertyTypes: [],
  selectedListing: null,
  modalMode: 'create',
  uploading: false,
};

// Initialization
document.addEventListener('DOMContentLoaded', initializeDashboard);

async function initializeDashboard() {
  log('Initialization started');
  try {
    await BiomeAuth.requireAuth();
    await BiomeAuth.requireRole('seller');
    const supabase = BiomeAuth.supabase;
    window.supabase = supabase;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user');
    DashboardState.currentUser = user;
    DashboardState.currentUserId = user.id;
    log('[Auth] User', user.email);

    await loadProfile();
    await loadPropertyTypes();
    await Promise.all([loadMetrics(), loadListings()]);

    registerEventListeners();
    startRealtimeSubscription();
    checkStorageBucket();
    log('Ready');
  } catch (error) {
    console.error(error);
    showToast('Failed to load dashboard. Please refresh.', 'error');
  }
}

async function loadProfile() {
  const profile = await BiomeAuth.getCurrentProfile();
  if (!profile) throw new Error('Profile not found');
  DashboardState.profile = profile;
  const firstName = profile.first_name || 'Seller';
  dom.welcomeMessage.textContent = `Welcome Back, ${firstName}`;
  dom.companyLabel.textContent = profile.company_name || 'Independent Seller';
}

async function loadPropertyTypes() {
  const { data: types, error } = await window.supabase
    .from('property_types')
    .select('property_type_id, property_name')
    .order('property_name');

  dom.propertyType.innerHTML = '';

  if (error) {
    console.error('[PropertyTypes]', error);
    dom.propertyType.innerHTML = '<option value="" selected disabled>Unavailable</option>';
    return;
  }

  if (!types || types.length === 0) {
    dom.propertyType.innerHTML = '<option value="" selected disabled>No property types available</option>';
    return;
  }

  DashboardState.propertyTypes = types;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select Property Type';
  placeholder.disabled = true;
  placeholder.selected = true;
  dom.propertyType.appendChild(placeholder);

  types.forEach(type => {
    const option = document.createElement('option');
    option.value = type.property_type_id;
    option.textContent = type.property_name;
    dom.propertyType.appendChild(option);
  });
}

async function loadMetrics() {
  const { data: listings, error } = await window.supabase
    .from('listing_complete_view')
    .select('status')
    .eq('owner_id', DashboardState.currentUserId);

  if (error) {
    console.error('[Metrics]', error);
    return;
  }

  const total = listings.length;
  const draft = listings.filter(l => l.status === 'draft').length;
  const pending = listings.filter(l => l.status === 'pending').length;
  const published = listings.filter(l => l.status === 'approved').length;
  const rejected = listings.filter(l => l.status === 'rejected').length;

  dom.totalListings.textContent = total;
  dom.draftListings.textContent = draft;
  dom.pendingListings.textContent = pending;
  dom.publishedListings.textContent = published;
  dom.rejectedListings.textContent = rejected;
}

function getPublicImage(path) {
  if (!path) return null;
  const { data } = window.supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data?.publicUrl || null;
}

async function loadListings() {
  const { data, error } = await window.supabase
    .from('listing_complete_view')
    .select('*')
    .eq('owner_id', DashboardState.currentUserId)
    .order('submitted_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[Listings]', error);
    showToast('Could not load listings.', 'error');
    return;
  }

  DashboardState.listings = (data || []).map(listing => ({
    ...listing,
    cover_image: listing.cover_public_url || getPublicImage(listing.cover_storage_path),
  }));

  renderListings();
  clearSelection();
}

function renderListings(filteredListings = null) {
  const listings = filteredListings || DashboardState.listings;
  dom.listingContainer.innerHTML = '';

  if (listings.length === 0) {
    dom.listingContainer.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-icon">🏠</div>
          <h3>No listings found</h3>
          <p>Create your first property listing to get started.</p>
        </td>
      </tr>`;
    return;
  }

  listings.forEach(listing => {
    const row = document.createElement('tr');
    row.dataset.listingId = listing.listing_id;
    if (DashboardState.selectedListing?.listing_id === listing.listing_id) {
      row.classList.add('selected');
    }

    // Checkbox
    const checkboxCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = row.classList.contains('selected');
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    checkboxCell.appendChild(checkbox);
    row.appendChild(checkboxCell);

    // Property cell
    const propertyCell = document.createElement('td');
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = listing.title;
    img.onerror = () => { img.src = 'assets/images/placeholder-property.jpg'; img.onerror = null; };
    img.src = listing.cover_image || 'assets/images/placeholder-property.jpg';
    img.style.cssText = 'width:60px;height:45px;object-fit:cover;border-radius:4px;margin-right:10px;';
    propertyCell.appendChild(img);
    propertyCell.appendChild(document.createTextNode(listing.title));
    row.appendChild(propertyCell);

    const typeCell = document.createElement('td');
    typeCell.textContent = listing.property_type || 'Unknown';
    row.appendChild(typeCell);

    const locationCell = document.createElement('td');
    locationCell.textContent = listing.city || '—';
    row.appendChild(locationCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = new Intl.NumberFormat('en-ZA', {
      style: 'currency', currency: 'ZAR', minimumFractionDigits: 0
    }).format(listing.price || 0);
    row.appendChild(priceCell);

    // Status cell with rejection reason for rejected listings
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `status ${listing.status === 'approved' ? 'published' : listing.status}`;
    badge.textContent = formatStatus(listing.status);
    statusCell.appendChild(badge);
    
    // Show rejection reason for rejected listings
    if (listing.status === 'rejected' && listing.rejection_reason) {
      const reason = document.createElement('div');
      reason.style.cssText = 'font-size:0.75rem;color:#ef4444;margin-top:4px;max-width:200px;';
      reason.textContent = listing.rejection_reason;
      statusCell.appendChild(reason);
    }
    row.appendChild(statusCell);

    const dateCell = document.createElement('td');
    dateCell.textContent = listing.submitted_at
      ? new Date(listing.submitted_at).toLocaleDateString('en-ZA')
      : '—';
    row.appendChild(dateCell);

    row.addEventListener('click', () => selectListing(listing, row));
    dom.listingContainer.appendChild(row);
  });
}

function formatStatus(status) {
  const map = { draft: 'Draft', pending: 'Pending Review', approved: 'Published', rejected: 'Rejected' };
  return map[status] || status;
}

function applyFilters() {
  const search = dom.searchListings.value.trim().toLowerCase();
  const statusFilter = dom.statusFilter.value;
  let filtered = DashboardState.listings;

  if (statusFilter !== 'all') {
    const map = { published: 'approved', pending: 'pending', draft: 'draft', rejected: 'rejected' };
    filtered = filtered.filter(l => l.status === map[statusFilter]);
  }

  if (search) {
    filtered = filtered.filter(l =>
      [l.title, l.city, l.province, l.property_type].some(f => (f || '').toLowerCase().includes(search))
    );
  }

  renderListings(filtered);
  if (DashboardState.selectedListing && !filtered.some(l => l.listing_id === DashboardState.selectedListing.listing_id)) {
    clearSelection();
  } else {
    updateToolbarButtons();
  }
}

function selectListing(listing, row) {
  const prev = document.querySelector('.listing-table tbody tr.selected');
  if (prev) prev.classList.remove('selected');
  DashboardState.selectedListing = listing;
  row.classList.add('selected');
  updateToolbarButtons();
}

function clearSelection() {
  DashboardState.selectedListing = null;
  const row = document.querySelector('.listing-table tbody tr.selected');
  if (row) row.classList.remove('selected');
  updateToolbarButtons();
}

function updateToolbarButtons() {
  const listing = DashboardState.selectedListing;
  const hasSelection = !!listing;
  
  // Edit: only allowed for draft and rejected
  dom.editBtn.disabled = !hasSelection || 
    (listing && listing.status !== 'draft' && listing.status !== 'rejected');
  
  // Delete: only allowed for draft and rejected
  dom.deleteBtn.disabled = !hasSelection || 
    (listing && listing.status !== 'draft' && listing.status !== 'rejected');
  
  // View: always enabled when selected
  dom.viewBtn.disabled = !hasSelection;

  document.querySelectorAll('.listing-table tbody tr').forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = row.classList.contains('selected');
  });
}

function openModal(mode = 'create') {
  // Prevent editing pending or approved listings
  if (mode === 'edit' && DashboardState.selectedListing) {
    const status = DashboardState.selectedListing.status;
    if (status === 'pending' || status === 'approved') {
      showToast('This listing cannot be edited in its current status.', 'warning');
      return;
    }
  }
  
  DashboardState.modalMode = mode;
  dom.modalTitle.textContent = mode === 'edit' ? 'Edit Property Listing' : 'Create Property Listing';
  resetForm();
  if (mode === 'edit' && DashboardState.selectedListing) populateForm(DashboardState.selectedListing);
  dom.listingModal.style.display = 'flex';
}

function closeModal() {
  dom.listingModal.style.display = 'none';
}

function resetForm() {
  dom.listingForm.reset();
  dom.propertyImages.value = '';
  dom.propertyVideo.value = '';
  document.querySelectorAll('.form-error').forEach(e => e.remove());
  if (dom.imagePreview) dom.imagePreview.innerHTML = '';
  if (dom.videoPreview) dom.videoPreview.innerHTML = '';
}

function populateForm(listing) {
  dom.title.value = listing.title || '';
  dom.description.value = listing.description || '';
  dom.price.value = listing.price || '';
  dom.bedrooms.value = listing.bedrooms || '';
  dom.bathrooms.value = listing.bathrooms || '';
  dom.street.value = listing.street || '';
  dom.suburb.value = listing.suburb || '';
  dom.city.value = listing.city || '';
  dom.province.value = listing.province || '';
  if (listing.property_type_id != null) {
    dom.propertyType.value = listing.property_type_id;
  }
}

function collectFormData() {
  const price = parseFloat(dom.price.value);
  const ptIdRaw = dom.propertyType.value;
  const propertyTypeId = (ptIdRaw !== '' && !isNaN(parseInt(ptIdRaw, 10)))
    ? parseInt(ptIdRaw, 10)
    : null;

  return {
    title: dom.title.value.trim(),
    description: dom.description.value.trim(),
    price: isNaN(price) ? 0 : price,
    bedrooms: parseInt(dom.bedrooms.value, 10) || 0,
    bathrooms: parseFloat(dom.bathrooms.value) || 0,
    street: dom.street.value.trim(),
    suburb: dom.suburb.value.trim(),
    city: dom.city.value.trim(),
    province: dom.province.value.trim(),
    property_type_id: propertyTypeId,
  };
}

function validateForm() {
  document.querySelectorAll('.form-error').forEach(e => e.remove());
  const errors = [];
  const data = collectFormData();
  const images = dom.propertyImages.files;
  const video = dom.propertyVideo.files[0];

  if (!data.title) errors.push('Title is required.');
  if (!data.description) errors.push('Description is required.');
  if (data.price <= 0) errors.push('Price must be a positive number.');
  if (!data.suburb) errors.push('Suburb is required.');
  if (!data.city) errors.push('City is required.');
  if (!data.province) errors.push('Province is required.');
  if (data.property_type_id === null || isNaN(data.property_type_id)) {
    errors.push('Please select a valid property type.');
  }
  if (data.bedrooms < 0) errors.push('Bedrooms cannot be negative.');
  if (data.bathrooms < 0) errors.push('Bathrooms cannot be negative.');

  if (images.length > MAX_IMAGES) errors.push(`Maximum ${MAX_IMAGES} images.`);
  for (const file of images) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      errors.push(`Unsupported image: ${file.type}`);
      break;
    }
  }
  if (video && !ALLOWED_VIDEO_TYPES.includes(video.type)) {
    errors.push(`Unsupported video: ${video.type}`);
  }

  if (errors.length > 0) {
    const div = document.createElement('div');
    div.className = 'form-error';
    div.style.cssText = 'color:var(--danger);margin-bottom:16px;';
    div.innerHTML = errors.map(e => `<p>• ${e}</p>`).join('');
    dom.listingForm.prepend(div);
    showToast(errors[0], 'error');
    return false;
  }
  return true;
}

function setupPreviews() {
  dom.propertyImages.addEventListener('change', () => {
    const preview = dom.imagePreview;
    preview.innerHTML = '';
    for (const file of dom.propertyImages.files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) continue;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'preview-thumb';
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  });
  dom.propertyVideo.addEventListener('change', () => {
    const preview = dom.videoPreview;
    preview.innerHTML = '';
    const file = dom.propertyVideo.files[0];
    if (!file) return;
    preview.appendChild(document.createTextNode(`🎬 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`));
  });
}

// ---------- SAVE ORCHESTRATOR ----------
async function saveListing(status) {
  if (!validateForm()) return;
  if (DashboardState.uploading) { showToast('Upload in progress...', 'warning'); return; }

  const formData = collectFormData();
  const listingId = DashboardState.modalMode === 'edit' ? DashboardState.selectedListing?.listing_id : null;

  try {
    if (dom.formLoading) dom.formLoading.hidden = false;
    const savedListingId = await saveListingData(formData, listingId, status);
    log('[Listing] Saved', savedListingId);

    const allFiles = [
      ...Array.from(dom.propertyImages.files).map(f => ({ file: f, type: 'image' })),
      ...(dom.propertyVideo.files.length ? [{ file: dom.propertyVideo.files[0], type: 'video' }] : []),
    ];

    if (allFiles.length > 0) {
      if (DashboardState.modalMode === 'edit') await clearExistingMedia(savedListingId);

      DashboardState.uploading = true;
      toggleUploadState(true);
      let uploadedFiles = [];
      try {
        uploadedFiles = await uploadFiles(savedListingId, allFiles);
        log('[Storage] Uploaded', uploadedFiles.length, 'files');
      } catch (uploadError) {
        console.error('[Storage] Partial failure:', uploadError);
        showToast('Some files could not be uploaded.', 'warning');
        uploadedFiles = uploadError.uploadedFiles || [];
      } finally {
        DashboardState.uploading = false;
        toggleUploadState(false);
      }

      if (uploadedFiles.length > 0) {
        try {
          await saveMediaMetadata(savedListingId, uploadedFiles);
        } catch (metaError) {
          console.error('[Metadata]', metaError);
          showToast('Listing saved, but media metadata failed.', 'error');
        }
      }
    }

    await new Promise(r => setTimeout(r, 300));
    await Promise.all([loadMetrics(), loadListings()]);
    if (dom.formLoading) dom.formLoading.hidden = true;
    closeModal();
    showToast(status === 'pending' ? 'Listing submitted for approval!' : 'Draft saved.', 'success');
  } catch (error) {
    console.error('[Save]', error);
    if (dom.formLoading) dom.formLoading.hidden = true;
    showToast(error.message || 'Failed to save listing.', 'error');
  }
}

async function saveListingData(formData, listingId, status) {
  const detailsPayload = { ...formData };

  if (listingId) {
    // Update existing
    await window.supabase.from('listings').update({ owner_id: DashboardState.currentUserId }).eq('listing_id', listingId);
    const { error: detailsError } = await window.supabase.from('listing_details').update(detailsPayload).eq('listing_id', listingId);
    if (detailsError) throw detailsError;
    
    // Set status with appropriate review fields
    const statusUpdate = status === 'pending'
      ? { 
          status: 'pending', 
          submitted_at: new Date().toISOString(),
          approved_date: null,
          reviewed_by: null,
          rejection_reason: null
        }
      : { status: 'draft' };
    
    const { error: statusError } = await window.supabase.from('listings').update(statusUpdate).eq('listing_id', listingId);
    if (statusError) throw statusError;
    return listingId;
  } else {
    // Create new listing
    const { data: newListing, error: listingError } = await window.supabase.from('listings')
      .insert({ owner_id: DashboardState.currentUserId, status: status })
      .select().single();
    if (listingError) throw listingError;
    const newId = newListing.listing_id;

    const { error: detailsError } = await window.supabase.from('listing_details')
      .insert({ ...detailsPayload, listing_id: newId });
    if (detailsError) throw new Error(`Failed to insert listing details: ${detailsError.message}`);

    // Set initial status
    const statusUpdate = status === 'pending'
      ? { status: 'pending', submitted_at: new Date().toISOString() }
      : { status: 'draft' };
    const { error: statusError } = await window.supabase.from('listings').update(statusUpdate).eq('listing_id', newId);
    if (statusError) throw statusError;

    return newId;
  }
}

async function clearExistingMedia(listingId) {
  const { data: existing } = await window.supabase.from('listing_media').select('storage_path').eq('listing_id', listingId);
  await window.supabase.from('listing_media').delete().eq('listing_id', listingId);
  if (existing && existing.length) {
    const paths = existing.map(m => m.storage_path);
    await window.supabase.storage.from(BUCKET_NAME).remove(paths);
  }
}

async function uploadFiles(listingId, fileObjects) {
  const results = [];
  const errors = [];

  const tasks = fileObjects.map(async (obj) => {
    const { file, type } = obj;
    if (type === 'image' && !ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error(`Invalid image: ${file.type}`);
    if (type === 'video' && !ALLOWED_VIDEO_TYPES.includes(file.type)) throw new Error(`Invalid video: ${file.type}`);
    const ext = file.name.split('.').pop();
    const path = `${listingId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await window.supabase.storage.from(BUCKET_NAME).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data: urlData } = window.supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return { storage_path: path, media_type: type, publicUrl: urlData?.publicUrl };
  });

  const settled = await Promise.allSettled(tasks);
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') results.push(r.value);
    else { console.error(`[Storage] File ${i} failed`, r.reason); errors.push({ index: i, error: r.reason }); }
  });

  if (results.length === 0) throw new Error('All media uploads failed.');
  if (errors.length > 0) {
    const e = new Error(`${errors.length} file(s) failed to upload.`);
    e.uploadedFiles = results;
    throw e;
  }
  return results;
}

async function saveMediaMetadata(listingId, uploadedFiles) {
  let coverAssigned = false;
  const records = uploadedFiles.map((f, idx) => {
    const isCover = !coverAssigned && f.media_type === 'image';
    if (isCover) coverAssigned = true;
    return {
      listing_id: listingId,
      storage_path: f.storage_path,
      media_type: f.media_type,
      sort_order: idx + 1,
      is_cover: isCover,
    };
  });
  const { error } = await window.supabase.from('listing_media').insert(records);
  if (error) {
    await Promise.allSettled(uploadedFiles.map(f => window.supabase.storage.from(BUCKET_NAME).remove([f.storage_path])));
    throw new Error('Failed to store media metadata. Uploaded files cleaned up.');
  }
  log('[Media] Inserted', records.length);
}

async function deleteListing() {
  if (!DashboardState.selectedListing) return;
  
  // Prevent deleting pending or approved listings
  const status = DashboardState.selectedListing.status;
  if (status === 'pending' || status === 'approved') {
    showToast('This listing cannot be deleted in its current status.', 'warning');
    return;
  }
  
  const confirmed = confirm('Delete this listing? This action cannot be undone.');
  if (!confirmed) return;

  const listingId = DashboardState.selectedListing.listing_id;
  try {
    const { data: mediaFiles } = await window.supabase.from('listing_media').select('storage_path').eq('listing_id', listingId);
    await window.supabase.from('listing_media').delete().eq('listing_id', listingId);
    await window.supabase.from('listing_details').delete().eq('listing_id', listingId);
    const { error } = await window.supabase.from('listings').delete().eq('listing_id', listingId);
    if (error) throw error;
    if (mediaFiles?.length) {
      const paths = mediaFiles.map(m => m.storage_path);
      await window.supabase.storage.from(BUCKET_NAME).remove(paths);
    }
    clearSelection();
    await Promise.all([loadMetrics(), loadListings()]);
    showToast('Listing deleted.', 'success');
  } catch (error) {
    console.error('[Delete]', error);
    showToast('Failed to delete listing.', 'error');
  }
}

function viewListing() {
  if (!DashboardState.selectedListing) return;
  window.open(`listing-preview.html?id=${DashboardState.selectedListing.listing_id}`, '_blank');
}

function startRealtimeSubscription() {
  if (!DashboardState.currentUserId) return;
  window.supabase.channel('seller-listings-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'listings', filter: `owner_id=eq.${DashboardState.currentUserId}` },
      async (payload) => {
        log('[Realtime]', payload.eventType);
        await Promise.all([loadMetrics(), loadListings()]);
        if (DashboardState.selectedListing && !DashboardState.listings.some(l => l.listing_id === DashboardState.selectedListing.listing_id)) {
          clearSelection();
        }
      })
    .subscribe();
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
  setTimeout(() => { toast.remove(); if (container.children.length === 0) container.remove(); }, 4000);
}

function toggleUploadState(active) {
  const btns = [dom.saveDraftBtn, dom.submitListingBtn];
  btns.forEach(btn => {
    btn.disabled = active;
    btn.textContent = active ? 'Uploading…' : (btn.id === 'saveDraftBtn' ? 'Save Draft' : 'Submit for Approval');
  });
}

async function checkStorageBucket() {
  try {
    await window.supabase.storage.from(BUCKET_NAME).list();
    log('[Storage] Bucket accessible');
  } catch (err) {
    console.warn('[Storage] Bucket may not exist:', err.message);
    showToast('Media storage is not configured.', 'warning');
  }
}

function registerEventListeners() {
  dom.createBtn.addEventListener('click', () => openModal('create'));
  dom.editBtn.addEventListener('click', () => { 
    if (DashboardState.selectedListing) openModal('edit'); 
  });
  dom.deleteBtn.addEventListener('click', deleteListing);
  dom.viewBtn.addEventListener('click', viewListing);

  dom.closeModalBtn?.addEventListener('click', closeModal);
  dom.cancelBtn?.addEventListener('click', closeModal);
  dom.listingModal.addEventListener('click', (e) => { if (e.target === dom.listingModal) closeModal(); });

  dom.saveDraftBtn.addEventListener('click', () => saveListing('draft'));
  dom.listingForm.addEventListener('submit', (e) => { e.preventDefault(); saveListing('pending'); });

  dom.logoutBtn.addEventListener('click', () => BiomeAuth.logout());
  dom.searchListings.addEventListener('input', applyFilters);
  dom.statusFilter.addEventListener('change', applyFilters);

  setupPreviews();

  document.querySelectorAll('.upload-box').forEach(box => {
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('dragover'); });
    box.addEventListener('dragleave', () => box.classList.remove('dragover'));
    box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('dragover'); });
  });
}