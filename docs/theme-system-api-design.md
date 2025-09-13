# Theme System API Design

## Endpoints

### 1. Create Theme `POST /themes`
**Request Body:**
```json
{
  "name": "Dark Modern",
  "layout": "{...}",
  "styles": ".btn { ... }",
  "parent_theme_id": null
}
```

**Response:**
```json
{
  "id": "theme_123",
  "assets": ["styles.css", "layout.json"]
}
```

### 2. Apply Theme to Room `PUT /rooms/{id}/theme`
**Request Body:**
```json
{
  "theme_id": "theme_123",
  "apply_css": true,
  "apply_layout": true
}
```

### 3. Get Theme Assets `GET /themes/{id}/assets`
**Response Headers:**
```
Content-Type: text/css
Content-Disposition: attachment; filename="styles.css"
```

## Implementation Guide

1. Add to `routes/api.js`:
```javascript
// Theme endpoints
router.post('/themes', themeController.create);
router.put('/rooms/:id/theme', themeController.apply);
router.get('/themes/:id/assets/:file', themeController.getAsset);
```

2. Create `controllers/themeController.js`:
```javascript
exports.create = async (req, res) => {
  // Implementation using database.js
};

exports.apply = async (req, res) => {
  // Apply theme logic
};