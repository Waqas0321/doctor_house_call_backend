# Admin API Documentation

**Staff dashboard only.** Use this document for the admin panel (manage bookings, users, zones, audit logs). For the mobile app APIs, see [APP_API_DOCUMENTATION.md](./APP_API_DOCUMENTATION.md).

- All endpoints require **`Authorization: Bearer <admin_token>`** and the user must have **`isAdmin: true`**.
- **Base URL (Production):** `https://doctor-house-call-backend.vercel.app`
- **Base URL (Local):** `http://localhost:3000`

---

## 1. Admin Auth & Profile

Use the same auth routes as the app; the logged-in user must be an admin. Profile picture uses Cloudinary (same as app).

### Get Current Admin (profile, isAdmin, profilePicture)
```http
GET /api/auth/me
Authorization: Bearer <admin_token>
```

**Response:** Includes `isAdmin`, `profilePicture`, `profilePictureUrl`. Use `isAdmin` to show/hide admin UI.

### Update Admin Profile (optional profile picture)
```http
PUT /api/auth/profile
Authorization: Bearer <admin_token>
Content-Type: application/json
```
Or **multipart/form-data** with optional `image` file for profile picture (Cloudinary).

**Request (JSON):**
```json
{
  "firstName": "Admin",
  "lastName": "User",
  "email": "admin@example.com",
  "phone": "2045551234",
  "address": "123 Office St"
}
```

### Upload Admin Profile Picture
```http
POST /api/auth/profile/picture
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```
Body: form field **`image`** (file, JPEG/PNG/WebP, max 5MB).

**Response:**
```json
{
  "success": true,
  "data": {
    "profilePicture": "https://res.cloudinary.com/.../profile.jpg",
    "profilePictureUrl": "https://res.cloudinary.com/.../profile.jpg"
  }
}
```

---

## 2. Bookings

### Get All Bookings
```http
GET /api/admin/bookings?status=new&zoneId=zone_id&visitType=phone_call&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin_token>
```

**Query:** `status`, `zoneId`, `visitType`, `startDate`, `endDate` (all optional).

### Create Booking (manual, from admin panel)
```http
POST /api/admin/bookings
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "userId": "user_id_for_whom_booking_is_created",
  "familyMemberId": "patient_id_belonging_to_that_user",
  "contactPhone": "2045551234",
  "contactEmail": "patient@example.com",
  "visitType": "phone_call",
  "lat": 49.8951,
  "lng": -97.1384,
  "address": "optional if lat/lng provided",
  "notes": "optional",
  "unitBuzzer": "optional",
  "accessInstructions": "optional"
}
```
Patient must belong to `userId`. Confirmation email is sent.

### Get Booking Details
```http
GET /api/admin/bookings/:id
Authorization: Bearer <admin_token>
```

### Update Booking Status
```http
PUT /api/admin/bookings/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "status": "new" | "needs_review" | "confirmed" | "completed" | "cancelled",
  "assignedProvider": {
    "providerId": "user_id",
    "providerName": "Dr. Smith"
  },
  "scheduledTime": "2024-01-15T10:00:00Z",
  "reason": "optional"
}
```

### Override Booking (zone / visit type)
```http
PUT /api/admin/bookings/:id/override
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "overrideZoneId": "zone_id (optional)",
  "allowedVisitTypes": { "phoneCall": true, "houseCall": true },
  "reason": "Required reason for override"
}
```

### Delete Booking
```http
DELETE /api/admin/bookings/:id
Authorization: Bearer <admin_token>
```

### Get Location Heatmap
```http
GET /api/admin/bookings/heatmap?startDate=2024-01-01&endDate=2024-12-31&visitType=phone_call
Authorization: Bearer <admin_token>
```

---

## 3. Users

### Get All Users
```http
GET /api/admin/users?isActive=true&isAdmin=false
Authorization: Bearer <admin_token>
```

**Query:** `isActive`, `isAdmin` (optional booleans).

### Get Single User
```http
GET /api/admin/users/:id
Authorization: Bearer <admin_token>
```

### Update User (e.g. set isAdmin)
```http
PUT /api/admin/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "isAdmin": true,
  "isActive": true,
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "address": "string (optional)"
}
```

### Delete / Deactivate User
```http
DELETE /api/admin/users/:id
Authorization: Bearer <admin_token>
```
Soft delete (sets `isActive: false`, anonymizes data).

---

## 4. Service Zones

### Get All Zones
```http
GET /api/admin/zones
Authorization: Bearer <admin_token>
```
Returns **all** zones (active and inactive). Each zone includes **`isActive`** so the admin panel can show enable/disable state.

### Create Zone
```http
POST /api/admin/zones
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Downtown Winnipeg",
  "boundaryData": {
    "type": "Polygon",
    "coordinates": [[[-97.2, 49.8], [-97.1, 49.8], [-97.1, 49.9], [-97.2, 49.9], [-97.2, 49.8]]]
  },
  "allowPhoneCall": true,
  "allowHouseCall": true,
  "phoneCallsFull": false,
  "houseCallsFull": false,
  "priority": 1,
  "isActive": true
}
```
- **isActive** (optional, default `true`) – Set to `false` to add a zone in disabled state. GeoJSON: `coordinates` use **[longitude, latitude]**.

### Enable or Disable Zone
```http
PATCH /api/admin/zones/:id/active
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "isActive": true
}
```
or `{ "isActive": false }` to disable. Use this for a simple on/off toggle in the admin panel.

### Test Zone Matching
```http
POST /api/admin/zones/test
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "address": "123 Main St, Winnipeg, MB"
}
```

### Update Zone
```http
PUT /api/admin/zones/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:** Any of `name`, `boundaryData`, `allowPhoneCall`, `allowHouseCall`, `phoneCallsFull`, `houseCallsFull`, `priority`, **`isActive`** (all optional). Set `isActive: false` to disable or `true` to enable.

### Delete Zone
```http
DELETE /api/admin/zones/:id
Authorization: Bearer <admin_token>
```

---

## 5. Push Notifications

### Get All Notifications
```http
GET /api/admin/notifications?status=sent&type=manual
Authorization: Bearer <admin_token>
```
Returns notifications with stats: `total`, `sent`, `draft`, `failed`. Display on admin panel.

### Create Manual Notification
```http
POST /api/admin/notifications
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Service Zone Update",
  "body": "Downtown Core zone has been updated successfully",
  "targetAudience": {
    "type": "all_users",
    "userId": "optional for single_user",
    "bookingId": "optional for booking_id",
    "zoneId": "optional for service_zone"
  },
  "deliveryType": "push_only",
  "scheduledFor": "optional ISO date",
  "deepLink": "optional wdhc://path"
}
```
`targetAudience.type`: `single_user`, `booking_id`, `service_zone`, `all_users`. Sends push and stores in DB; displays on admin and app.

### Get Notification
```http
GET /api/admin/notifications/:id
Authorization: Bearer <admin_token>
```

### Delete Notification
```http
DELETE /api/admin/notifications/:id
Authorization: Bearer <admin_token>
```

**Auto push:** Admins get push when app user creates booking. Users get push when admin updates or creates their booking.

---

## 6. Audit Logs

### Get Audit Logs
```http
GET /api/admin/audit-logs?action=booking_created&entityType=booking&entityId=id&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin_token>
```

**Query:** `action`, `entityType`, `entityId`, `startDate`, `endDate` (all optional).

---

## 7. Dashboard & Analytics

### Get Heatmap & Analytics (combined, auto-detected)
```http
GET /api/dashboard/analytics?period=7days|30days|90days
Authorization: Bearer <admin_token>
```
Returns all Heatmap & Analytics data in one call:

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalBookings": 1247,
      "activeZones": 12,
      "avgResponseTimeMinutes": 2.5,
      "customerSatisfaction": 94
    },
    "zoneHeatmap": [
      { "zoneId": "...", "zoneName": "Downtown Core", "count": 342, "activityLevel": "high" },
      { "zoneId": "...", "zoneName": "St. Vital / St. Boniface", "count": 289, "activityLevel": "high" },
      { "zoneName": "Transcona Perimeter", "count": 156, "activityLevel": "medium" }
    ],
    "bookingTrends": [
      { "day": "Mon", "date": "2024-01-15", "count": 65 },
      { "day": "Tue", "date": "2024-01-16", "count": 80 }
    ],
    "heatmapData": [
      { "lat": 49.89, "lng": -97.13, "visitType": "phone_call", "createdAt": "..." }
    ]
  }
}
```
- **overview**: Total Bookings, Active Zones, Avg Response Time (minutes), Customer Satisfaction (%)
- **zoneHeatmap**: Zones with count and activityLevel (`high`, `medium`, `low`)
- **bookingTrends**: Last 7 days by weekday
- **heatmapData**: Lat/lng for map visualization

### Get Dashboard Statistics
```http
GET /api/dashboard/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalBookings": 150,
      "todayBookings": 5,
      "weekBookings": 25,
      "monthBookings": 80,
      "totalUsers": 120,
      "totalZones": 10
    },
    "bookingsByStatus": { "new": 20, "confirmed": 50, "completed": 70, "cancelled": 10 },
    "bookingsByVisitType": { "phone_call": 80, "house_call": 70 },
    "recentBookings": [...]
  }
}
```

### Get Dashboard Charts
```http
GET /api/dashboard/charts?period=7days|30days|90days
Authorization: Bearer <admin_token>
```

### Get Recent Activity
```http
GET /api/dashboard/activity?limit=20
Authorization: Bearer <admin_token>
```

---

## Admin API Summary

| API | Method | Endpoint | Auth |
|-----|--------|----------|------|
| Get Profile | GET | /api/auth/me | Admin |
| Update Profile | PUT | /api/auth/profile | Admin |
| Upload Profile Picture | POST | /api/auth/profile/picture | Admin |
| Get All Bookings | GET | /api/admin/bookings | Admin |
| Create Booking (manual) | POST | /api/admin/bookings | Admin |
| Get Booking | GET | /api/admin/bookings/:id | Admin |
| Update Booking Status | PUT | /api/admin/bookings/:id/status | Admin |
| Override Booking | PUT | /api/admin/bookings/:id/override | Admin |
| Delete Booking | DELETE | /api/admin/bookings/:id | Admin |
| Bookings Heatmap | GET | /api/admin/bookings/heatmap | Admin |
| Get All Users | GET | /api/admin/users | Admin |
| Get User | GET | /api/admin/users/:id | Admin |
| Update User | PUT | /api/admin/users/:id | Admin |
| Delete User | DELETE | /api/admin/users/:id | Admin |
| Get All Zones | GET | /api/admin/zones | Admin |
| Create Zone | POST | /api/admin/zones | Admin |
| Enable/Disable Zone | PATCH | /api/admin/zones/:id/active | Admin |
| Test Zone | POST | /api/admin/zones/test | Admin |
| Update Zone | PUT | /api/admin/zones/:id | Admin |
| Delete Zone | DELETE | /api/admin/zones/:id | Admin |
| Get Audit Logs | GET | /api/admin/audit-logs | Admin |
| Get Notifications | GET | /api/admin/notifications | Admin |
| Create Notification | POST | /api/admin/notifications | Admin |
| Delete Notification | DELETE | /api/admin/notifications/:id | Admin |
| Heatmap & Analytics | GET | /api/dashboard/analytics | Admin |
| Dashboard Stats | GET | /api/dashboard/stats | Admin |
| Dashboard Charts | GET | /api/dashboard/charts | Admin |
| Dashboard Activity | GET | /api/dashboard/activity | Admin |

---

## Error Responses

```json
{
  "success": false,
  "error": "Error message"
}
```

- **401** – Missing or invalid token
- **403** – User role not authorized (not admin)
- **404** – Resource not found
- **400** – Bad request (validation)

---

## Testing (cURL)

Replace `ADMIN_TOKEN` with a JWT for a user with `isAdmin: true`.

### Get profile
```bash
curl -X GET https://doctor-house-call-backend.vercel.app/api/auth/me \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Upload profile picture
```bash
curl -X POST https://doctor-house-call-backend.vercel.app/api/auth/profile/picture \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "image=@/path/to/photo.jpg"
```

### Get all bookings
```bash
curl -X GET "https://doctor-house-call-backend.vercel.app/api/admin/bookings?status=new" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Create booking (manual)
```bash
curl -X POST https://doctor-house-call-backend.vercel.app/api/admin/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"userId":"USER_ID","familyMemberId":"PATIENT_ID","contactPhone":"2045551234","contactEmail":"p@example.com","visitType":"phone_call","lat":49.8951,"lng":-97.1384}'
```

### Set user as admin
```bash
curl -X PUT https://doctor-house-call-backend.vercel.app/api/admin/users/USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"isAdmin":true}'
```

### Get all zones
```bash
curl -X GET https://doctor-house-call-backend.vercel.app/api/admin/zones \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Create zone
```bash
curl -X POST https://doctor-house-call-backend.vercel.app/api/admin/zones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"name":"Downtown Winnipeg","boundaryData":{"type":"Polygon","coordinates":[[[-97.2,49.8],[-97.1,49.8],[-97.1,49.9],[-97.2,49.9],[-97.2,49.8]]]},"allowPhoneCall":true,"allowHouseCall":true,"priority":1,"isActive":true}'
```

### Enable or disable zone
```bash
# Disable zone
curl -X PATCH https://doctor-house-call-backend.vercel.app/api/admin/zones/ZONE_ID/active \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"isActive":false}'

# Enable zone
curl -X PATCH https://doctor-house-call-backend.vercel.app/api/admin/zones/ZONE_ID/active \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"isActive":true}'
```

### Heatmap & Analytics
```bash
curl -X GET "https://doctor-house-call-backend.vercel.app/api/dashboard/analytics?period=7days" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Dashboard stats
```bash
curl -X GET https://doctor-house-call-backend.vercel.app/api/dashboard/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```
