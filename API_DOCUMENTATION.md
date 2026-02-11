# API Documentation

This project has **two separate API docs**:

| Document | Audience | Description |
|----------|-----------|-------------|
| **[APP_API_DOCUMENTATION.md](./APP_API_DOCUMENTATION.md)** | Mobile app (Flutter, etc.) | Social auth, profile, patients, coverage, bookings. Patient-facing. |
| **[ADMIN_API_DOCUMENTATION.md](./ADMIN_API_DOCUMENTATION.md)** | Staff dashboard (admin panel) | Bookings, users, zones, audit logs, dashboard. Requires `isAdmin: true`. |

Use the doc that matches your client. The sections below are a combined reference; for full detail use the links above.

---

## Base URL

**Production (Vercel):**
```
https://doctor-house-call-backend.vercel.app
```

**Local:**
```
http://localhost:3000
```

API paths are appended (e.g. `/api/auth/login`, `/api/bookings`).

## Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### Register User (Email/Password)
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John (optional)",
  "lastName": "Doe (optional)",
  "phone": "2045551234 (optional)",
  "address": "123 Main St, Winnipeg, MB (optional)"
}
```

Response:
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isAdmin": false
  }
}
```

#### Register Admin (Email/Password)
```http
POST /api/auth/register-admin
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123",
  "firstName": "Admin (optional)",
  "lastName": "User (optional)",
  "phone": "2045551234 (optional)",
  "address": "123 Main St, Winnipeg, MB (optional)"
}
```

Response:
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "isAdmin": true
  }
}
```

#### Login (Email/Password)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isAdmin": false
  }
}
```

#### Social Auth (App) - Google, Facebook, Apple

**Google Sign-In**
```http
POST /api/auth/google
Content-Type: application/json

{
  "providerUserId": "google_user_id",
  "email": "string (optional)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "profilePicture": "url (optional)"
}
```

**Facebook Login**
```http
POST /api/auth/facebook
Content-Type: application/json

{
  "providerUserId": "facebook_user_id",
  "email": "string (optional)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "profilePicture": "url (optional)"
}
```

**Sign in with Apple**
```http
POST /api/auth/apple
Content-Type: application/json

{
  "providerUserId": "apple_user_id",
  "email": "string (optional, only on first sign-in)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "profilePicture": "url (optional)"
}
```

**Generic OAuth** (provider in body)
```http
POST /api/auth/oauth
Content-Type: application/json

{
  "provider": "google" | "facebook" | "apple",
  "providerUserId": "string",
  "email": "string (optional)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "profilePicture": "string (optional)"
}
```

**App flow:** Use the SDK on the client (Google Sign-In, Facebook Login, Sign in with Apple), get the user ID and profile, then POST to the matching endpoint.

Response:
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

Response includes `isAdmin` and `profilePicture` / `profilePictureUrl` (Cloudinary URL when set). Set `isAdmin: true` on a user (e.g. via MongoDB or `PUT /api/admin/users/:id`) to grant admin access.

#### Update Profile (optional profile picture)
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json
# Or multipart/form-data with optional "image" file for profile picture (Cloudinary)

{
  "phone": "string (optional)",
  "email": "string (optional)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "address": "string (optional)",
  "profilePicture": "url (optional, or send image file in multipart)"
}
```

#### Upload Profile Picture (Cloudinary)
```http
POST /api/auth/profile/picture
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
Body: form field `image` (file, JPEG/PNG/WebP, max 5MB). Returns `{ "success": true, "data": { "profilePicture": "https://res.cloudinary.com/...", "profilePictureUrl": "..." } }`.

---

### Coverage Check

#### Check Service Coverage
```http
POST /api/coverage/check
Content-Type: application/json

{
  "address": "123 Main St, Winnipeg, MB"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "address": "123 Main St, Winnipeg, MB, Canada",
    "lat": 49.8951,
    "lng": -97.1384,
    "zone": {
      "id": "zone_id",
      "name": "Downtown Winnipeg"
    },
    "availableTypes": {
      "phoneCall": true,
      "houseCall": true,
      "message": "Good news — we offer both phone and in-home visits in your area.",
      "zoneName": "Downtown Winnipeg"
    },
    "isInServiceArea": true
  }
}
```

---

### Bookings

#### Create Booking (App Flow)
```http
POST /api/bookings
Content-Type: application/json
Authorization: Bearer <token>

{
  "familyMemberId": "patient_id",
  "contactPhone": "2045551234",
  "contactEmail": "patient@example.com",
  "notes": "Additional notes (optional)",
  "visitType": "phone_call" | "house_call",
  "lat": 49.8951,
  "lng": -97.1384
}
```

**App flow:** 1) Select patient from list → 2) Enter visit details (phone, email, note) → 3) Select phone_call or house_call → 4) Get current location (lat, lng) → 5) Book.

| Field | Required | Description |
|-------|----------|-------------|
| familyMemberId | Yes | Patient ID from GET /api/family-members |
| contactPhone | Yes | Phone number |
| contactEmail | Yes | Email address |
| notes | No | Additional note |
| visitType | Yes | "phone_call" or "house_call" |
| lat, lng | Yes* | From device "get current location" |
| address | Yes* | Alternative to lat/lng |

Response:
```json
{
  "success": true,
  "data": {
    "_id": "booking_id",
    "status": "new",
    "visitType": "phone_call",
    "patientInfo": { "firstName": "Jane", "lastName": "Doe", "dob": "..." },
    "contactPhone": "2045551234",
    "contactEmail": "test@example.com",
    "notes": "Morning preferred",
    "address": { "raw": "...", "normalized": "..." },
    "location": { "lat": 49.8951, "lng": -97.1384 }
  }
}
```

#### Get My Bookings
```http
GET /api/bookings
Authorization: Bearer <token>
```

#### Get Booking Details
```http
GET /api/bookings/:id
Authorization: Bearer <token>
```

---

### Family Members

#### Get All Family Members
```http
GET /api/family-members
Authorization: Bearer <token>
```

#### Create Family Member (Add Patient)
```http
POST /api/family-members
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "firstName": "Jane (optional, use name or firstName+lastName)",
  "lastName": "Doe (optional)",
  "dob": "2010-05-15",
  "image": "https://example.com/photo.jpg or base64 string (optional)",
  "address": "123 Main St, Winnipeg, MB (optional)",
  "phin": "string (optional)",
  "mhsc": "string (optional)",
  "notes": "string (optional)"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "_id": "patient_id",
    "firstName": "Jane",
    "lastName": "Doe",
    "dob": "2010-05-15",
    "image": "...",
    "address": "123 Main St"
  }
}
```

#### Update Family Member
```http
PUT /api/family-members/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe (optional)",
  "firstName": "Jane (optional)",
  "lastName": "Doe (optional)",
  "dob": "2010-05-15 (optional)",
  "image": "URL or base64 (optional)",
  "address": "string (optional)",
  "phin": "string (optional)",
  "mhsc": "string (optional)",
  "notes": "string (optional)"
}
```

#### Delete Family Member
```http
DELETE /api/family-members/:id
Authorization: Bearer <token>
```

---

### Admin Endpoints

All admin endpoints require authentication and admin role.

#### Get All Bookings
```http
GET /api/admin/bookings?status=new&zoneId=zone_id&visitType=phone_call&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin_token>
```

#### Create Booking (manual, from admin panel)
```http
POST /api/admin/bookings
Authorization: Bearer <admin_token>
Content-Type: application/json

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
Creates a booking on behalf of the given user. Patient must belong to that user. Confirmation email is sent.

#### Get Booking Details
```http
GET /api/admin/bookings/:id
Authorization: Bearer <admin_token>
```

#### Update Booking Status
```http
PUT /api/admin/bookings/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "new" | "needs_review" | "confirmed" | "completed" | "cancelled",
  "assignedProvider": {
    "providerId": "user_id",
    "providerName": "Dr. Smith"
  },
  "scheduledTime": "2024-01-15T10:00:00Z",
  "reason": "string (optional)"
}
```

#### Override Booking
```http
PUT /api/admin/bookings/:id/override
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "overrideZoneId": "zone_id (optional)",
  "allowedVisitTypes": {
    "phoneCall": true,
    "houseCall": true
  },
  "reason": "Required reason for override"
}
```

#### Delete Booking
```http
DELETE /api/admin/bookings/:id
Authorization: Bearer <admin_token>
```

#### Get Location Heatmap
```http
GET /api/admin/bookings/heatmap?startDate=2024-01-01&endDate=2024-12-31&visitType=phone_call
Authorization: Bearer <admin_token>
```

#### Get All Users (admin full access)
```http
GET /api/admin/users?isActive=true&isAdmin=false
Authorization: Bearer <admin_token>
```

#### Get Single User
```http
GET /api/admin/users/:id
Authorization: Bearer <admin_token>
```

#### Update User (e.g. set isAdmin)
```http
PUT /api/admin/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

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

#### Delete / Deactivate User
```http
DELETE /api/admin/users/:id
Authorization: Bearer <admin_token>
```

#### Get All Zones
```http
GET /api/admin/zones
Authorization: Bearer <admin_token>
```

#### Create Zone
```http
POST /api/admin/zones
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Downtown Winnipeg",
  "boundaryData": {
    "type": "Polygon",
    "coordinates": [[[-97.2, 49.8], [-97.1, 49.8], [-97.1, 49.9], [-97.2, 49.9], [-97.2, 49.8]]]
  },
  "allowPhoneCall": true,
  "allowHouseCall": true,
  "priority": 1,
  "isActive": true
}
```

#### Test Zone Matching
```http
POST /api/admin/zones/test
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "address": "123 Main St, Winnipeg, MB"
}
```

#### Update Zone
```http
PUT /api/admin/zones/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "string (optional)",
  "boundaryData": "object (optional)",
  "allowPhoneCall": "boolean (optional)",
  "allowHouseCall": "boolean (optional)",
  "phoneCallsFull": "boolean (optional)",
  "houseCallsFull": "boolean (optional)",
  "priority": "number (optional)",
  "isActive": "boolean (optional)"
}
```

#### Delete Zone
```http
DELETE /api/admin/zones/:id
Authorization: Bearer <admin_token>
```

#### Get Audit Logs
```http
GET /api/admin/audit-logs?action=booking_created&entityType=booking&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin_token>
```

---

### Dashboard (Admin Only)

All dashboard endpoints require admin authentication.

#### Get Dashboard Statistics
```http
GET /api/dashboard/stats
Authorization: Bearer <admin_token>
```

Response:
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
    "bookingsByStatus": {
      "new": 20,
      "confirmed": 50,
      "completed": 70,
      "cancelled": 10
    },
    "bookingsByVisitType": {
      "phone_call": 80,
      "house_call": 70
    },
    "recentBookings": [...]
  }
}
```

#### Get Dashboard Charts Data
```http
GET /api/dashboard/charts?period=7days|30days|90days
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "bookingsOverTime": [
      { "_id": "2024-01-15", "count": 5 },
      { "_id": "2024-01-16", "count": 8 }
    ],
    "bookingsByZone": [
      { "zoneName": "Downtown", "count": 45 },
      { "zoneName": "Suburbs", "count": 30 }
    ]
  }
}
```

#### Get Recent Activity
```http
GET /api/dashboard/activity?limit=20
Authorization: Bearer <admin_token>
```

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

## Notes

1. All dates should be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
2. Phone numbers should be provided as strings (e.g., "2045551234")
3. Zone coordinates use GeoJSON format: `[longitude, latitude]` (note: longitude first!)
4. Admin users must have `isAdmin: true` in their user document

---

## Testing

Use these cURL commands to test the API. Replace `YOUR_TOKEN` with the JWT from login/register, and `PATIENT_ID` with an ID from the family members list.

### 1. Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```
*Copy the `token` from the response for subsequent requests.*

### 3. Add Patient
```bash
curl -X POST http://localhost:3000/api/family-members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Jane Doe",
    "dob": "1990-05-15",
    "address": "123 Main St, Winnipeg, MB"
  }'
```
*Copy the `_id` from the response for the booking.*

### 4. Get All Patients
```bash
curl -X GET http://localhost:3000/api/family-members \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Create Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "familyMemberId": "PATIENT_ID",
    "contactPhone": "2045551234",
    "contactEmail": "test@example.com",
    "notes": "Morning preferred",
    "visitType": "phone_call",
    "lat": 49.8951,
    "lng": -97.1384
  }'
```

### 6. Get My Bookings
```bash
curl -X GET http://localhost:3000/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. Social Auth - Google
```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "providerUserId": "google_user_123",
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 8. Social Auth - Apple
```bash
curl -X POST http://localhost:3000/api/auth/apple \
  -H "Content-Type: application/json" \
  -d '{
    "providerUserId": "001234.abc123xyz.1234",
    "email": "user@privaterelay.appleid.com",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 9. Health Check
```bash
curl http://localhost:3000/health
```

### App Flow Test Sequence
1. Register or Login → get `token`
2. Add Patient → get `_id` (patient)
3. Create Booking → use patient `_id`, token, lat/lng

---

## Code Locations

### Route Definitions (API Paths)
- **Auth Routes**: `src/routes/auth.js`
- **Booking Routes**: `src/routes/bookings.js`
- **Admin Routes**: `src/routes/admin.js`
- **Dashboard Routes**: `src/routes/dashboard.js`
- **Coverage Routes**: `src/routes/coverage.js`
- **Family Members Routes**: `src/routes/familyMembers.js`

### Controller Functions (API Logic)
- **Auth Controller**: `src/controllers/authController.js`
- **Booking Controller**: `src/controllers/bookingController.js`
- **Admin Controller**: `src/controllers/adminController.js`
- **Dashboard Controller**: `src/controllers/dashboardController.js`
- **Coverage Controller**: `src/controllers/coverageController.js`
- **Family Member Controller**: `src/controllers/familyMemberController.js`

### Middleware (Authentication & Authorization)
- **Auth Middleware**: `src/middleware/auth.js`
  - `protect` - Requires JWT token
  - `authorize('admin')` - Requires admin role
  - `optionalAuth` - Optional authentication
