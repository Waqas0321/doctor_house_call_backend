# App API Documentation

API documentation for the mobile app. All endpoints require `Authorization: Bearer <token>` except social auth and login.

**Base URL:** `http://localhost:3000/api`

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

## 3. Patients

### Add Patient
```http
POST /api/family-members
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Jane Doe",
  "dob": "1990-05-15",
  "image": "https://... or base64 (optional)",
  "address": "123 Main St (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "patient_id",
    "firstName": "Jane",
    "lastName": "Doe",
    "dob": "1990-05-15",
    "image": "...",
    "address": "..."
  }
}
```

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
      "_id": "patient_id",
      "firstName": "Jane",
      "lastName": "Doe",
      "dob": "1990-05-15",
      "image": "...",
      "address": "..."
    }
  ]
}
```

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
| Create Booking | POST | /api/bookings | Yes |
| Get My Bookings | GET | /api/bookings | Yes |

---

## Testing (cURL)

### 1. Google Sign-In
```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"providerUserId":"google_123","email":"user@gmail.com","firstName":"John","lastName":"Doe"}'
```

### 2. Store Address
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"address":"123 Main St, Winnipeg, MB"}'
```

### 3. Get Profile
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Add Patient
```bash
curl -X POST http://localhost:3000/api/family-members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Jane Doe","dob":"1990-05-15"}'
```

### 5. Get Patients
```bash
curl -X GET http://localhost:3000/api/family-members \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Create Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"familyMemberId":"PATIENT_ID","contactPhone":"2045551234","contactEmail":"test@example.com","visitType":"phone_call","lat":49.8951,"lng":-97.1384}'
```

### 7. Get My Bookings
```bash
curl -X GET http://localhost:3000/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN"
```
