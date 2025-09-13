// Theme Gallery JavaScript
console.log('Theme Gallery starting...');

// State
let themes = [];
let currentPage = 1;
let totalPages = 1;
let currentTheme = null;
let selectedRoomId = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing theme gallery...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Load themes
    loadThemes();
    
    console.log('Theme gallery initialized');
});

// Setup event listeners
function setupEventListeners() {
    // Theme gallery button
    const themeGalleryBtn = document.getElementById('theme-gallery-btn');
    if (themeGalleryBtn) {
        themeGalleryBtn.addEventListener('click', openThemeGallery);
    }
    
    // Close modal buttons
    const closeThemeGalleryModal = document.getElementById('close-theme-gallery-modal');
    if (closeThemeGalleryModal) {
        closeThemeGalleryModal.addEventListener('click', closeThemeGallery);
    }
    
    const closeThemeDetailsModal = document.getElementById('close-theme-details-modal');
    if (closeThemeDetailsModal) {
        closeThemeDetailsModal.addEventListener('click', closeThemeDetails);
    }
    
    // Theme gallery controls
    const refreshThemesBtn = document.getElementById('refresh-themes-btn');
    if (refreshThemesBtn) {
        refreshThemesBtn.addEventListener('click', loadThemes);
    }
    
    const createNewThemeBtn = document.getElementById('create-new-theme-btn');
    if (createNewThemeBtn) {
        createNewThemeBtn.addEventListener('click', createNewTheme);
    }
    
    // Search and filter
    const themeSearch = document.getElementById('theme-search');
    if (themeSearch) {
        themeSearch.addEventListener('input', debounce(handleSearch, 300));
    }
    
    const themeCategoryFilter = document.getElementById('theme-category-filter');
    if (themeCategoryFilter) {
        themeCategoryFilter.addEventListener('change', handleFilter);
    }
    
    const themeSort = document.getElementById('theme-sort');
    if (themeSort) {
        themeSort.addEventListener('change', handleSort);
    }
    
    // Pagination
    const prevPageBtn = document.getElementById('prev-page-btn');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
    }
    
    const nextPageBtn = document.getElementById('next-page-btn');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));
    }
    
    // Theme details actions
    const applyThemeBtn = document.getElementById('apply-theme-btn');
    if (applyThemeBtn) {
        applyThemeBtn.addEventListener('click', applyThemeToRoom);
    }
    
    const editThemeBtn = document.getElementById('edit-theme-btn');
    if (editThemeBtn) {
        editThemeBtn.addEventListener('click', editTheme);
    }
    
    const duplicateThemeBtn = document.getElementById('duplicate-theme-btn');
    if (duplicateThemeBtn) {
        duplicateThemeBtn.addEventListener('click', duplicateTheme);
    }
    
    const deleteThemeBtn = document.getElementById('delete-theme-btn');
    if (deleteThemeBtn) {
        deleteThemeBtn.addEventListener('click', deleteTheme);
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const themeGalleryModal = document.getElementById('theme-gallery-modal');
        const themeDetailsModal = document.getElementById('theme-details-modal');
        
        if (event.target === themeGalleryModal) {
            closeThemeGallery();
        }
        
        if (event.target === themeDetailsModal) {
            closeThemeDetails();
        }
    });
}

// Load themes from server
function loadThemes() {
    console.log('Loading themes...');
    
    const search = document.getElementById('theme-search')?.value || '';
    const category = document.getElementById('theme-category-filter')?.value || 'all';
    const sort = document.getElementById('theme-sort')?.value || 'name';
    
    const params = new URLSearchParams({
        page: currentPage,
        search: search,
        category: category,
        sort: sort
    });
    
    fetch(`/api/themes?${params}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                themes = data.data.themes;
                currentPage = data.data.page;
                totalPages = data.data.totalPages;
                
                renderThemes();
                updatePagination();
                
                console.log(`Loaded ${themes.length} themes (page ${currentPage} of ${totalPages})`);
            } else {
                console.error('Failed to load themes:', data.error);
                showNotification('Failed to load themes: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error loading themes:', error);
            showNotification('Error loading themes: ' + error.message, 'error');
        });
}

// Render themes in the gallery
function renderThemes() {
    const themeGalleryGrid = document.getElementById('theme-gallery-grid');
    if (!themeGalleryGrid) return;
    
    if (themes.length === 0) {
        themeGalleryGrid.innerHTML = `
            <div class="no-themes-message">
                <p>No themes found.</p>
                <button class="btn-primary" onclick="createNewTheme()">Create Your First Theme</button>
            </div>
        `;
        return;
    }
    
    themeGalleryGrid.innerHTML = themes.map(theme => `
        <div class="theme-card" data-theme-id="${theme.id}">
            <div class="theme-card-header">
                <h3 class="theme-name">${theme.name}</h3>
                <span class="theme-version">v${theme.theme_meta?.version || '1.0.0'}</span>
            </div>
            <div class="theme-card-body">
                <div class="theme-preview">
                    ${renderThemePreview(theme)}
                </div>
                <p class="theme-description">${theme.description || 'No description available'}</p>
            </div>
            <div class="theme-card-footer">
                <div class="theme-meta">
                    <span class="theme-author">by ${theme.theme_meta?.author || 'Unknown'}</span>
                    <span class="theme-type">${theme.is_child ? 'Child Theme' : 'Standalone'}</span>
                </div>
                <div class="theme-actions">
                    <button class="btn-secondary btn-sm" onclick="viewThemeDetails(${theme.id})">View</button>
                    <button class="btn-primary btn-sm" onclick="quickApplyTheme(${theme.id})">Apply</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Render theme preview
function renderThemePreview(theme) {
    const colors = theme.theme_meta || {};
    const primaryColor = colors.primary_color || '#667eea';
    const secondaryColor = colors.secondary_color || '#764ba2';
    const accentColor = colors.accent_color || '#ff6b6b';
    
    return `
        <div class="theme-preview-mini" style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});">
            <div class="preview-component" style="background: ${accentColor};"></div>
            <div class="preview-component" style="background: rgba(255,255,255,0.2);"></div>
            <div class="preview-component" style="background: rgba(255,255,255,0.1);"></div>
        </div>
    `;
}

// Update pagination controls
function updatePagination() {
    const pageInfo = document.getElementById('page-info');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage <= 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage >= totalPages;
    }
}

// Open theme gallery modal
function openThemeGallery() {
    const themeGalleryModal = document.getElementById('theme-gallery-modal');
    if (themeGalleryModal) {
        themeGalleryModal.style.display = 'block';
        loadThemes();
    }
}

// Close theme gallery modal
function closeThemeGallery() {
    const themeGalleryModal = document.getElementById('theme-gallery-modal');
    if (themeGalleryModal) {
        themeGalleryModal.style.display = 'none';
    }
}

// View theme details
function viewThemeDetails(themeId) {
    console.log('Viewing theme details for:', themeId);
    
    fetch(`/api/themes/${themeId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentTheme = data.data;
                showThemeDetails(currentTheme);
            } else {
                console.error('Failed to load theme details:', data.error);
                showNotification('Failed to load theme details: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error loading theme details:', error);
            showNotification('Error loading theme details: ' + error.message, 'error');
        });
}

// Show theme details modal
function showThemeDetails(theme) {
    const themeDetailsModal = document.getElementById('theme-details-modal');
    if (!themeDetailsModal) return;
    
    // Update theme details
    document.getElementById('theme-details-title').textContent = theme.name;
    document.getElementById('theme-info-name').textContent = theme.name;
    document.getElementById('theme-info-description').textContent = theme.description || 'No description available';
    document.getElementById('theme-info-version').textContent = theme.theme_meta?.version || '1.0.0';
    document.getElementById('theme-info-author').textContent = theme.theme_meta?.author || 'Unknown';
    document.getElementById('theme-info-type').textContent = theme.is_child ? 'Child Theme' : 'Standalone Theme';
    document.getElementById('theme-info-created').textContent = formatDate(theme.created_at);
    document.getElementById('theme-info-updated').textContent = formatDate(theme.updated_at);
    
    // Show/hide parent theme info
    const parentThemeInfo = document.getElementById('parent-theme-info');
    if (theme.is_child && theme.parent_theme_id) {
        parentThemeInfo.style.display = 'block';
        document.getElementById('theme-info-parent').textContent = `Theme ID: ${theme.parent_theme_id}`;
    } else {
        parentThemeInfo.style.display = 'none';
    }
    
    // Update theme preview
    const themePreviewContainer = document.getElementById('theme-preview-container');
    if (themePreviewContainer) {
        themePreviewContainer.innerHTML = renderThemePreview(theme);
    }
    
    // Load theme assets
    loadThemeAssets(theme.id);
    
    // Show modal
    themeDetailsModal.style.display = 'block';
}

// Close theme details modal
function closeThemeDetails() {
    const themeDetailsModal = document.getElementById('theme-details-modal');
    if (themeDetailsModal) {
        themeDetailsModal.style.display = 'none';
        currentTheme = null;
    }
}

// Load theme assets
function loadThemeAssets(themeId) {
    const themeAssetsList = document.getElementById('theme-assets-list');
    if (!themeAssetsList) return;
    
    fetch(`/api/themes/${themeId}/assets`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const assets = data.data.assets || [];
                
                if (assets.length === 0) {
                    themeAssetsList.innerHTML = '<p class="no-assets">No assets found for this theme.</p>';
                } else {
                    themeAssetsList.innerHTML = assets.map(asset => `
                        <div class="asset-item">
                            <div class="asset-info">
                                <span class="asset-name">${asset.file_path}</span>
                                <span class="asset-size">${formatFileSize(asset.file_size)}</span>
                            </div>
                            <div class="asset-actions">
                                <button class="btn-secondary btn-sm" onclick="downloadAsset(${themeId}, '${asset.file_path}')">Download</button>
                                <button class="btn-danger btn-sm" onclick="deleteAsset(${themeId}, '${asset.file_path}')">Delete</button>
                            </div>
                        </div>
                    `).join('');
                }
            } else {
                console.error('Failed to load theme assets:', data.error);
                themeAssetsList.innerHTML = '<p class="error">Failed to load assets.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading theme assets:', error);
            themeAssetsList.innerHTML = '<p class="error">Error loading assets.</p>';
        });
}

// Quick apply theme to room
function quickApplyTheme(themeId) {
    if (!selectedRoomId) {
        // Prompt user to select a room
        selectRoomForTheme(themeId);
        return;
    }
    
    applyThemeToRoom(themeId);
}

// Apply theme to room
function applyThemeToRoom(themeId) {
    const theme = themeId || currentTheme?.id;
    if (!theme) {
        showNotification('No theme selected', 'error');
        return;
    }
    
    if (!selectedRoomId) {
        selectRoomForTheme(theme);
        return;
    }
    
    if (!confirm(`Are you sure you want to apply this theme to room ${selectedRoomId}?`)) {
        return;
    }
    
    fetch(`/api/rooms/${selectedRoomId}/theme`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ themeId: theme })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Theme applied successfully!', 'success');
            closeThemeDetails();
            closeThemeGallery();
        } else {
            console.error('Failed to apply theme:', data.error);
            showNotification('Failed to apply theme: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error applying theme:', error);
        showNotification('Error applying theme: ' + error.message, 'error');
    });
}

// Select room for theme application
function selectRoomForTheme(themeId) {
    // Load rooms and show selection dialog
    fetch('/api/rooms')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data.length > 0) {
                const roomOptions = data.data.map(room => 
                    `<option value="${room.id}">${room.name}</option>`
                ).join('');
                
                const selectedRoom = prompt(`Select a room to apply the theme:\n\n${data.data.map(r => `${r.id}: ${r.name}`).join('\n')}\n\nEnter room ID:`);
                
                if (selectedRoom && data.data.find(r => r.id == selectedRoom)) {
                    selectedRoomId = selectedRoom;
                    applyThemeToRoom(themeId);
                }
            } else {
                showNotification('No rooms available. Please create a room first.', 'error');
            }
        })
        .catch(error => {
            console.error('Error loading rooms:', error);
            showNotification('Error loading rooms: ' + error.message, 'error');
        });
}

// Create new theme
function createNewTheme() {
    // Redirect to layout builder with save-as-theme mode
    window.location.href = '/layout-builder.html?mode=create-theme';
}

// Edit theme
function editTheme() {
    if (!currentTheme) {
        showNotification('No theme selected', 'error');
        return;
    }
    
    // Redirect to layout builder with theme data
    window.location.href = `/layout-builder.html?mode=edit-theme&themeId=${currentTheme.id}`;
}

// Duplicate theme
function duplicateTheme() {
    if (!currentTheme) {
        showNotification('No theme selected', 'error');
        return;
    }
    
    const newName = prompt('Enter a name for the duplicated theme:', `${currentTheme.name} (Copy)`);
    if (!newName) return;
    
    const duplicatedTheme = {
        ...currentTheme,
        name: newName,
        description: `${currentTheme.description || ''} (Duplicated)`,
        is_child: false,
        parent_theme_id: null
    };
    
    // Remove ID to create new theme
    delete duplicatedTheme.id;
    
    fetch('/api/themes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(duplicatedTheme)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Theme duplicated successfully!', 'success');
            loadThemes();
            closeThemeDetails();
        } else {
            console.error('Failed to duplicate theme:', data.error);
            showNotification('Failed to duplicate theme: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error duplicating theme:', error);
        showNotification('Error duplicating theme: ' + error.message, 'error');
    });
}

// Delete theme
function deleteTheme() {
    if (!currentTheme) {
        showNotification('No theme selected', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the theme "${currentTheme.name}"? This action cannot be undone.`)) {
        return;
    }
    
    fetch(`/api/themes/${currentTheme.id}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Theme deleted successfully!', 'success');
            loadThemes();
            closeThemeDetails();
        } else {
            console.error('Failed to delete theme:', data.error);
            showNotification('Failed to delete theme: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting theme:', error);
        showNotification('Error deleting theme: ' + error.message, 'error');
    });
}

// Handle search
function handleSearch() {
    currentPage = 1;
    loadThemes();
}

// Handle filter
function handleFilter() {
    currentPage = 1;
    loadThemes();
}

// Handle sort
function handleSort() {
    currentPage = 1;
    loadThemes();
}

// Change page
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    loadThemes();
}

// Download asset
function downloadAsset(themeId, filePath) {
    window.open(`/api/themes/${themeId}/assets/${encodeURIComponent(filePath)}`, '_blank');
}

// Delete asset
function deleteAsset(themeId, filePath) {
    if (!confirm(`Are you sure you want to delete "${filePath}"?`)) {
        return;
    }
    
    fetch(`/api/themes/${themeId}/assets/${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Asset deleted successfully!', 'success');
            loadThemeAssets(themeId);
        } else {
            console.error('Failed to delete asset:', data.error);
            showNotification('Failed to delete asset: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting asset:', error);
        showNotification('Error deleting asset: ' + error.message, 'error');
    });
}

// Utility functions
function debounce(func, wait) {
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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

console.log('Theme Gallery JavaScript loaded');