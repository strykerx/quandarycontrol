# Task ROO#TASK_20250903211105_1A3F Context

## Objective
Convert root route (/) to admin interface and implement dynamic room routing:
- Admin page at root (move current admin.html functionality)
- Player/GM pages at `/room/{roomId}/player` and `/room/{roomId}/gm`
- Dynamic template generation for new rooms

## Current Setup
- Existing admin.html at [/public/admin.html](public/admin.html)
- Current root route serves [/public/index.html](public/index.html)
- Express server configuration in [server.js](server.js)
- API routes in [routes/api.js](routes/api.js)

## Requirements
1. Update Express routing to serve admin interface at root
2. Preserve existing index.html as player template base
3. Create dynamic route handlers for:
   - /room/:roomId/player
   - /room/:roomId/gm
4. Implement room creation endpoint in API