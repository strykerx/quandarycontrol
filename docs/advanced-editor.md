# Advanced Editor System (Phase 7) - Technical Specification

Status: In Progress
Owner: Rooroo Developer
Scope: HTML/CSS editor components with live preview, template integration

1. Objectives
- Provide an in-browser editor for HTML and CSS with a live sandbox preview.
- Integrate authored HTML/CSS into the existing template system and player layout.
- Keep implementation modular, minimal-dependency, and safe (sandboxed preview).

2. Non-Goals
- Full IDE experience (linting, autocomplete) at this phase.
- Arbitrary JS execution in preview (security).

3. Architecture Overview
3.1 Components
- EditorHost: orchestrates editor instances, state, and IO.
- HtmlEditor: CodeMirror-backed source editor for HTML.
- CssEditor: CodeMirror-backed source editor for CSS.
- PreviewSandbox: iframe-based renderer, isolated from parent DOM.
- TemplateBridge: converts editor state to Template JSON compatible with schema and POSTs to API.
- StorageLayer: localStorage persistence + server API saves.
- Validator: client-side schema pre-check (ajv) + server-side POST /api/templates/validate.

3.2 Data Flow
- User edits HTML/CSS => EditorHost state updated (debounced).
- EditorHost notifies PreviewSandbox => regenerates preview document in iframe.
- Save => TemplateBridge merges layout metadata + customization + component content => POST to /api/templates or PUT /api/templates/:id.
- Validate => POST /api/templates/validate => show diagnostics.
- Apply to Room => emit socket.io layout_preview/apply events with snippet refs or composed layout.

3.3 Files
- UI container (to be added): [public/layout-builder.html](public/layout-builder.html) editor section.
- Script: [public/advanced-editor.js](public/advanced-editor.js) for the editor runtime.
- Styles: reuse [public/layout-builder.css](public/layout-builder.css). Add minimal editor panel CSS if necessary.
- Documentation (this): [docs/advanced-editor.md](docs/advanced-editor.md).

4. Dependencies
- CodeMirror via CDN (no npm addition required initially).
  - CM6 bundles (basicSetup, html, css). CDN: esm.sh or unpkg.
- ajv (already installed) and ajv-formats (already installed) if client-side validation is desired; optional for Phase 7 (server-side validate is sufficient).

5. UI/UX Specification
5.1 Placement
- Add a new “Editor” tab to the existing Layout Builder header tabs.
- 2-column split:
  - Left: Tabs (HTML | CSS) with CodeMirror instances.
  - Right: Live Preview (iframe), 100% height of panel, with toolbar.

5.2 Controls
- Toolbar (top right above preview):
  - Save Template
  - Validate Template
  - Apply to Room
  - Export (download JSON)
  - Clear (reset to starter boilerplate)
- Editor Tabs (left):
  - HTML editor (CodeMirror)
  - CSS editor (CodeMirror)

5.3 Shortcuts
- Ctrl/Cmd + S => Save
- Ctrl/Cmd + Enter => Validate
- Ctrl/Cmd + Shift + P => Apply to Room

6. Live Preview
6.1 Sandbox
- Use iframe with sandbox attributes: sandbox="allow-same-origin"
- Inject composed document:
  - <style> user CSS </style>
  - HTML body from editor
- Debounce updates (300ms). Full iframe document rewrite for simplicity and isolation.

6.2 Error Handling
- If CSS parse fails (best-effort), still render HTML.
- Display overlay banner in preview pane for last validation result.

7. Template Integration
7.1 Mapping to Template JSON
- The Template JSON MUST adhere to [config/template-schema.json](config/template-schema.json).
- Strategy:
  - Attach authored HTML/CSS as Template “customization” artifacts and/or into “components[*].config.customData”.
  - Recommended minimal baseline:
    {
      "id": "tpl_{generated}",
      "name": "Custom Editor Template",
      "version": "1.0.0",
      "layout": {
        "columns": 12,
        "rows": 6,
        "gap": 10,
        "components": [
          { "id":"comp_html", "type":"media", "col":1, "row":2, "width":12,
            "config": { "customData": { "html": "<...>" } }
          }
        ]
      },
      "customization": {
        "theme": { "colors": {}, "fonts": {}, "spacing": {} },
        "background": {}
      },
      "metadata": {
        "category":"custom",
        "complexity":"simple",
        "responsive": true
      }
    }
- Alternatively, map “html” to a dedicated top-level field under “customization” (schema supports flexible objects). Chosen approach: store under components[0].config.customData.html and a single customData.css (string) for authored CSS.

7.2 Save/Update
- New template: POST /api/templates
- Existing: PUT /api/templates/:id
- Upload pathway remains available but not primary here.

7.3 Validate
- POST /api/templates/validate with constructed JSON; present errors inline (left panel footer and preview overlay).

8. API Contracts
8.1 Server endpoints already available:
- GET /api/templates
- GET /api/templates/:id
- POST /api/templates
- PUT /api/templates/:id
- DELETE /api/templates/:id
- POST /api/templates/upload
- POST /api/templates/validate
- GET /api/templates/:id/download

8.2 Socket Events (existing)
- layout_preview
- apply_layout
Use these for “Apply to Room” (transmit minimal payload: { roomId, layout, source:'editor' }).

9. State Model
type EditorState = {
  html: string,
  css: string,
  templateId?: string,
  roomId?: string,
  lastValidated?: { valid: boolean, errors: Array<any> }
}

Storage:
- localStorage key: quandary-advanced-editor-state
- Optional: templateId for editing existing template.

10. Security
- No user JS execution in preview. Only HTML + CSS.
- Sanitize HTML for src/href protocols if needed (phase 7.1 optional).
- iframe sandbox prevents DOM escape.

11. Performance
- Debounce 300ms; cancel pending reflows on rapid typing.
- Throttle validation on demand (only when user triggers or on save).

12. Error Reporting
- Non-blocking banners with clear messages:
  - Validation errors: list with pointers to schema path.
  - Save/Apply: toast success/failure.

13. Integration Steps (Incremental)
Step 1: Add Editor tab shell to [public/layout-builder.html](public/layout-builder.html)
- Create editor panel DOM containers (left editors, right preview).
- Add tab switcher button.

Step 2: Implement [public/advanced-editor.js](public/advanced-editor.js)
- Boot CM editors via CDN.
- Wire debounced preview rendering.

Step 3: Add Save / Validate / Apply handlers
- Compose Template JSON and call APIs.
- Surface results in UI.

Step 4: Persist to localStorage
- Load last state at init; guard for malformed JSON.

Step 5: Documentation and examples
- Provide starter boilerplate (simple, mobile-friendly HTML structure and CSS tokens).

14. CDN References
- CodeMirror 6 via esm.sh:
  - https://esm.sh/@codemirror/state
  - https://esm.sh/@codemirror/view
  - https://esm.sh/@codemirror/basic-setup
  - https://esm.sh/@codemirror/lang-html
  - https://esm.sh/@codemirror/lang-css

15. Starter Boilerplate
HTML:
<div class="qc-root">
  <h1>Quandary Custom View</h1>
  <p>Edit me in the left panel.</p>
</div>

CSS:
/* Uses player theme variables where possible */
.qc-root {
  color: var(--text-light, #fff);
  padding: 1rem;
}

16. Test Plan (Manual)
- Editor typing updates preview (debounced).
- Validate shows schema errors for malformed JSON structure.
- Save creates new template (200/201) and persists to data store.
- Apply sends layout preview event; player reacts without crash.
- Export downloads the composed template JSON.

17. Future Extensions
- JS “module script” whitelist with CSP and sanitizer.
- Multiple components mapping with drag selection from layout builder into editor context.
- Asset picker integration (images/videos) mapped to media component customData.

Appendix A: Minimal DOM IDs
- #editor-tab
- #editor-panel
- #editor-html
- #editor-css
- #editor-preview-iframe
- #editor-btn-save
- #editor-btn-validate
- #editor-btn-apply
- #editor-btn-export
- #editor-btn-clear

Appendix B: Event Names
- editor:state:changed
- editor:preview:refresh
- editor:validation:result
