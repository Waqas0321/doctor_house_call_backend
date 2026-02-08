# App API Documentation

API documentation for the mobile app. All endpoints require `Authorization: Bearer <token>` except social auth and login.

**Base URL (Production):** `https://doctor-house-call-backend.vercel.app`

**Base URL (Local):** `http://localhost:3000`

API paths: `/api/auth/google`, `/api/family-members`, etc.

---

## 1. Social Auth

### Google Sign-In
```http
POST /api/auth/google
Content-Type: application/json
```

**Request:**
```json
{
  "providerUserId": "google_user_id",
  "email": "user@gmail.com",
  "firstName": "John",
  "lastName": "Doe",
  "profilePicture": "https://..."
}
```

### Apple Sign-In
```http
POST /api/auth/apple
Content-Type: application/json
```

**Request:**
```json
{
  "providerUserId": "apple_user_id",
  "email": "user@privaterelay.appleid.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (both):**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "..."
  }
}
```

---

## 2. Get & Store Address

### Get My Profile (includes address)
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main St, Winnipeg, MB",
    "phone": "2045551234"
  }
}
```

### Store Address
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "address": "123 Main St, Winnipeg, MB"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "address": "123 Main St, Winnipeg, MB"
  }
}
```

---

## 3. Patients (Family Members)

All patient endpoints require `Authorization: Bearer <token>`.

---

### Add Patient
```http
POST /api/family-members
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request (form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fullName | text | Yes | Full name (e.g. "Jane Doe") |
| dob | text | Yes | Date of birth (YYYY-MM-DD) |
| image | file | No | Image file (JPEG, PNG, WebP, max 5MB). Uploaded to Cloudinary; URL stored in DB. |
| address | text | No | Address |
| phin | text | No | Provincial Health ID |
| mhsc | text | No | Manitoba Health Services Card |
| notes | text | No | Notes |

**Flutter (image picker):** Send as `multipart/form-data` with `image` as file from `ImagePicker`.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6987317f3708db127e51d4d1",
    "userId": "user_id",
    "fullName": "Jane Doe",
    "dob": "1990-05-15T00:00:00.000Z",
    "image": "https://res.cloudinary.com/.../image/upload/.../photo.jpg",
    "imageUrl": "https://res.cloudinary.com/.../image/upload/.../photo.jpg",
    "address": "123 Main St",
    "phin": null,
    "mhsc": null,
    "notes": null,
    "isActive": true,
    "createdAt": "2025-02-07T...",
    "updatedAt": "2025-02-07T..."
  }
}
```

- `fullName` – Full name (single field).
- `image` and `imageUrl` – Cloudinary URL when image is uploaded; `null` when no image. Use in app to display photo (e.g. `<Image source={{ uri: data.imageUrl }} />`).

---

### Get All Patients
```http
GET /api/family-members
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "6987317f3708db127e51d4d1",
      "userId": "user_id",
      "fullName": "Jane Doe",
      "dob": "1990-05-15T00:00:00.000Z",
      "image": "https://res.cloudinary.com/.../photo.jpg",
      "imageUrl": "https://res.cloudinary.com/.../photo.jpg",
      "address": "123 Main St",
      "phin": null,
      "mhsc": null,
      "notes": null,
      "isActive": true,
      "createdAt": "2025-02-07T...",
      "updatedAt": "2025-02-07T..."
    }
  ]
}
```

---

### Get Single Patient
```http
GET /api/family-members/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6987317f3708db127e51d4d1",
    "fullName": "Jane Doe",
    "dob": "1990-05-15T00:00:00.000Z",
    "image": "https://res.cloudinary.com/.../photo.jpg",
    "imageUrl": "https://res.cloudinary.com/.../photo.jpg",
    "address": "123 Main St",
    "phin": null,
    "mhsc": null,
    "notes": null,
    "isActive": true
  }
}
```

**Errors:** `404` – Patient not found.

---

### Update Patient
```http
PUT /api/family-members/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "fullName": "Jane Doe",
  "dob": "1990-05-15",
  "address": "456 New St",
  "phin": "123456789",
  "mhsc": "MHSC123",
  "notes": "Updated notes"
}
```

All fields are optional; only include fields to update.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6987317f3708db127e51d4d1",
    "fullName": "Jane Doe",
    "dob": "1990-05-15T00:00:00.000Z",
    "image": "https://res.cloudinary.com/.../photo.jpg",
    "imageUrl": "https://res.cloudinary.com/.../photo.jpg",
    "address": "456 New St",
    "notes": "Updated notes"
  }
}
```

---

### Delete Patient (Soft Delete)
```http
DELETE /api/family-members/:id
Authorization: Bearer <token>
```

Sets `isActive: false`; patient is hidden from GET list but not removed from DB.

**Response:**
```json
{
  "success": true,
  "message": "Family member deleted successfully"
}
```

**Errors:** `404` – Patient not found.

---

## 4. Bookings

### Create Booking
```http
POST /api/bookings
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "familyMemberId": "patient_id",
  "contactPhone": "2045551234",
  "contactEmail": "patient@example.com",
  "notes": "Morning preferred (optional)",
  "visitType": "phone_call",
  "lat": 49.8951,
  "lng": -97.1384
}
```

| Field | Required | Description |
|-------|----------|-------------|
| familyMemberId | Yes | Patient ID from Get All Patients |
| contactPhone | Yes | Phone number |
| contactEmail | Yes | Email address |
| notes | No | Additional note |
| visitType | Yes | "phone_call" or "house_call" |
| lat, lng | Yes | From device GPS |

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "booking_id",
    "status": "new",
    "visitType": "phone_call",
    "patientInfo": { "firstName": "Jane", "lastName": "Doe" }
  }
}
```

### Get My Bookings
```http
GET /api/bookings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "booking_id",
      "status": "new",
      "visitType": "phone_call",
      "patientInfo": { "firstName": "Jane", "lastName": "Doe" },
      "address": { "raw": "..." },
      "createdAt": "..."
    }
  ]
}
```

---

## App API Summary

| API | Method | Endpoint | Auth |
|-----|--------|----------|------|
| Google Sign-In | POST | /api/auth/google | No |
| Apple Sign-In | POST | /api/auth/apple | No |
| Get Profile (address) | GET | /api/auth/me | Yes |
| Store Address | PUT | /api/auth/profile | Yes |
| Add Patient | POST | /api/family-members | Yes |
| Get Patients | GET | /api/family-members | Yes |
| Get Single Patient | GET | /api/family-members/:id | Yes |
| Update Patient | PUT | /api/family-members/:id | Yes |
| Delete Patient | DELETE | /api/family-members/:id | Yes |
| Create Booking | POST | /api/bookings | Yes |
| Get My Bookings | GET | /api/bookings | Yes |

---

## Testing (cURL)

Examples use production URL. For local: replace with `http://localhost:3000`.

### 1. Google Sign-In
```bash
curl -X POST https://doctor-house-call-backend.vercel.app/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"providerUserId":"google_123","email":"user@gmail.com","firstName":"John","lastName":"Doe"}'
```

### 2. Store Address
```bash
curl -X PUT https://doctor-house-call-backend.vercel.app/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"address":"123 Main St, Winnipeg, MB"}'
```

### 3. Get Profile
```bash
curl -X GET https://doctor-house-call-backend.vercel.app/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Add Patient (JSON, no image)
```bash
curl -X POST https://doctor-house-call-backend.vercel.app/api/family-members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fullName":"Jane Doe","dob":"1990-05-15"}'
```

### 4b. Add Patient (with image – multipart)
```bash
curl -X POST https://doctor-house-call-backend.vercel.app/api/family-members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "fullName=Jane Doe" \
  -F "dob=1990-05-15" \
  -F "image=@/path/to/photo.jpg"
```

### 5. Get Patients
```bash
curl -X GET https://doctor-house-call-backend.vercel.app/api/family-members \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5b. Get Single Patient
```bash
curl -X GET https://doctor-house-call-backend.vercel.app/api/family-members/PATIENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5c. Update Patient
```bash
curl -X PUT https://doctor-house-call-backend.vercel.app/api/family-members/PATIENT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fullName":"Jane Doe","address":"456 New St","notes":"Updated"}'
```

### 5d. Delete Patient
```bash
curl -X DELETE https://doctor-house-call-backend.vercel.app/api/family-members/PATIENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Create Booking
```bash
curl -X POST https://doctor-house-call-backend.vercel.app/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"familyMemberId":"PATIENT_ID","contactPhone":"2045551234","contactEmail":"test@example.com","visitType":"phone_call","lat":49.8951,"lng":-97.1384}'
```

### 7. Get My Bookings
```bash
curl -X GET https://doctor-house-call-backend.vercel.app/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN"
```
