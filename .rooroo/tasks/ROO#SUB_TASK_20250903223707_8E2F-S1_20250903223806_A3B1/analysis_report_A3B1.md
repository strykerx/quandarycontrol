# Database Schema Migration Analysis Report

## Executive Summary

This analysis examines the current database schema and API endpoints for compatibility with the planned migration from legacy tables to unified JSON storage in the `rooms` table. The system currently operates in a hybrid state, with some data stored in JSON columns and other data in legacy relational tables. Key findings indicate that while the schema is well-prepared for migration, several API endpoints require modification to fully utilize JSON storage. Data flow constraints involve maintaining backward compatibility during the transition.

## Detailed Analysis

### Current Schema Compatibility

The [`db/init.sql`](../../db/init.sql) defines the database schema:

- **Primary Table**: `rooms` with comprehensive JSON columns:
  - `config JSON` - For user configurations
  - `api_variables JSON DEFAULT '{}'` - For API variables storage
  - `rules_config JSON DEFAULT '{}'` - For rules configuration
  - `hint_config JSON DEFAULT '{}'` - For hint system configuration
  - `custom_html TEXT DEFAULT ''` - For custom HTML content
  - `custom_css TEXT DEFAULT ''` - For custom CSS styles
  - `timer_duration INTEGER DEFAULT 0` - For timer settings

- **Legacy Tables** (marked for migration):
  - `legacy_variables` - Individual variable storage
  - `legacy_timers` - Timer configurations
  - `legacy_hints` - Hint system data
  - `legacy_events` - Event triggers

The schema is fully compatible with JSON storage requirements as outlined in the migration plan. All necessary JSON columns exist in the `rooms` table.

### API Endpoint Analysis

The [`routes/api.js`](../../routes/api.js) contains endpoints that need modification:

#### Endpoints Using New JSON Storage (Compatible):
- `GET /api/rooms` - Retrieves all rooms (uses `rooms` table)
- `GET /api/rooms/:id` - Gets specific room (uses `rooms` table)
- `POST /api/rooms` - Creates new room (stores data in JSON columns)
- `PUT /api/rooms/:id` - Updates room (supports JSON field updates)

#### Endpoints Using Legacy Tables (Require Modification):
- `GET /api/rooms/:id/variables` (lines 162-177) - Fetches variables from `legacy_variables` instead of `api_variables` JSON
- `POST /api/rooms/:id/variables` (lines 182-220) - Adds variables to `legacy_variables` instead of `api_variables` JSON

#### Missing Endpoints for Full JSON Migration:
- No endpoints for managing `rules_config` operations
- No endpoints for managing `hint_config` operations
- No endpoints for timer management using JSON storage
- No endpoints for event trigger management

### Data Flow Constraints

1. **Backward Compatibility**: During migration, existing data in legacy tables must remain accessible. A dual-read approach may be necessary during transition.

2. **Data Consistency**: Updates to variables via API must synchronize between legacy and new JSON storage until legacy tables are deprecated.

3. **Migration Sequencing**: Data migration from legacy tables to JSON columns must be atomic to prevent data loss or inconsistency.

4. **Client Dependencies**: Frontend code may rely on current API responses structure, requiring careful API versioning or response transformation.

5. **Test Data**: The [`tests/utils/database.js`](../../tests/utils/database.js) inserts data into both new and legacy tables, indicating current test coverage includes hybrid operation.

## Recommendations

### Immediate Actions:
1. **Update Variable Endpoints**: Modify `/api/rooms/:id/variables` endpoints to use `api_variables` JSON column instead of `legacy_variables` table.
2. **Add Missing Endpoints**: Create endpoints for `rules_config`, `hint_config`, and timer management using JSON storage.
3. **Implement Data Migration**: Develop scripts to migrate existing data from legacy tables to JSON columns.

### Medium-Term Actions:
1. **Deprecate Legacy Endpoints**: Phase out legacy API endpoints after ensuring all clients use new JSON-based endpoints.
2. **Remove Legacy Tables**: Once migration is complete and verified, remove legacy tables from schema.
3. **Update Test Utilities**: Modify test data insertion to use only JSON storage for new features.

### Long-Term Considerations:
1. **API Versioning**: Consider versioned API endpoints to manage breaking changes.
2. **Validation Logic**: Add JSON schema validation for JSON columns to ensure data integrity.
3. **Indexing Strategy**: Evaluate need for JSON indexing on frequently queried fields.

## Actionable Insights

- **Migration Priority**: Focus on variable endpoints first as they are currently active and using legacy tables.
- **Testing Strategy**: Ensure comprehensive test coverage for both old and new data paths during transition.
- **Monitoring**: Implement logging to track usage of legacy vs new endpoints to inform deprecation timeline.
- **Documentation**: Update API documentation to reflect new JSON-based endpoints and deprecation notices for legacy endpoints.

The current architecture supports a smooth migration path with minimal disruption to existing functionality.