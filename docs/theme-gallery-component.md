# Theme Gallery Component Design

## UI Structure
```html
<!-- Add to admin.html -->
<div class="theme-gallery">
  <div class="theme-filter">
    <input type="text" placeholder="Search themes..." class="search-input">
    <select class="category-filter">
      <option>All Categories</option>
    </select>
  </div>
  
  <div class="theme-grid">
    <!-- Generated Theme Cards -->
    <div class="theme-card" data-theme-id="dark-modern">
      <div class="theme-preview">
        <img src="/themes/dark-modern/preview.jpg" class="theme-thumbnail">
        <div class="theme-actions">
          <button class="btn-apply">Apply</button>
          <button class="btn-edit">Edit</button>
        </div>
      </div>
      <div class="theme-info">
        <h3>Dark Modern</h3>
        <div class="theme-meta">
          <span class="version">1.2.0</span>
          <span class="author">By Quandary Team</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

## JavaScript Implementation
```javascript
class ThemeGallery {
  constructor() {
    this.grid = document.querySelector('.theme-grid');
    this.loadThemes();
  }

  async loadThemes() {
    try {
      const response = await fetch('/themes');
      const themes = await response.json();
      
      this.grid.innerHTML = themes.map(theme => `
        <div class="theme-card" data-theme-id="${theme.id}">
          <div class="theme-preview" style="background-image: url('${theme.previewUrl}')">
            <div class="theme-actions">
              <button class="btn-apply" onclick="themeGallery.applyTheme('${theme.id}')">
                Apply
              </button>
              <button class="btn-edit" onclick="themeGallery.editTheme('${theme.id}')">
                Customize
              </button>
            </div>
          </div>
          <div class="theme-info">
            <h3>${theme.name}</h3>
            ${theme.parent ? `<div class="child-theme">Child of ${theme.parent}</div>` : ''}
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }

  async applyTheme(themeId) {
    try {
      const response = await fetch(`/rooms/current/theme`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ themeId })
      });
      
      if (response.ok) {
        window.location.reload(); // Refresh to apply changes
      }
    } catch (error) {
      showErrorNotification('Failed to apply theme');
    }
  }
}

// Initialize
window.themeGallery = new ThemeGallery();
```

## CSS Requirements
```css
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  padding: 1rem;
}

.theme-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s;
}

.theme-preview {
  position: relative;
  height: 200px;
  background-size: cover;
}

.theme-actions {
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 1rem;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  opacity: 0;
  transition: opacity 0.2s;
}

.theme-card:hover .theme-actions {
  opacity: 1;
}
```

## Features
1. Live preview hover effects
2. Search/filter functionality
3. Parent theme indication
4. Responsive grid layout
5. Error handling for theme application