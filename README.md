# Winnipeg Doctor House Calls - Booking API

A RESTful API for managing doctor house call bookings with location-based service availability.

## Features

- **Location-based Service Matching**: Automatically matches addresses to service zones
- **OAuth Authentication**: Google and Facebook login support
- **Family Member Management**: Save and reuse family member profiles
- **Booking Management**: Create, track, and manage appointments
- **Admin Portal**: Manage zones, bookings, and send notifications
- **Push Notifications**: Optional push notifications for appointment updates
- **Audit Logging**: Complete audit trail for admin actions

## Tech Stack

- Node.js & Express.js
- MongoDB with Mongoose
- JWT Authentication
- Geocoding API (Google Maps)
- Twilio (SMS)
- Nodemailer (Email)
- Firebase Cloud Messaging (Push Notifications - optional)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `GEOCODING_API_KEY`: Google Maps API key for geocoding
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`: Twilio credentials for SMS
- `EMAIL_USER`, `EMAIL_PASS`: Email credentials for Nodemailer

## API Endpoints

### Authentication
- `POST /api/auth/oauth` - OAuth login (Google/Facebook)
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/device` - Register device for push notifications
- `PUT /api/auth/notification-settings` - Update notification preferences

### Coverage Check
- `POST /api/coverage/check` - Check service availability for an address

### Bookings
- `POST /api/bookings` - Create a new booking (public, optional auth)
- `GET /api/bookings` - Get user's bookings (auth required)
- `GET /api/bookings/:id` - Get booking details (auth required)

### Family Members
- `GET /api/family-members` - Get all family members (auth required)
- `POST /api/family-members` - Create family member (auth required)
- `GET /api/family-members/:id` - Get family member (auth required)
- `PUT /api/family-members/:id` - Update family member (auth required)
- `DELETE /api/family-members/:id` - Delete family member (auth required)

### Admin Routes
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/bookings/:id` - Get booking details
- `PUT /api/admin/bookings/:id/status` - Update booking status
- `PUT /api/admin/bookings/:id/override` - Override booking zone/visit type
- `GET /api/admin/bookings/heatmap` - Get location heatmap data
- `GET /api/admin/zones` - Get all zones
- `POST /api/admin/zones` - Create zone
- `POST /api/admin/zones/test` - Test zone matching
- `PUT /api/admin/zones/:id` - Update zone
- `DELETE /api/admin/zones/:id` - Delete zone
- `GET /api/admin/notifications` - Get all notifications
- `POST /api/admin/notifications` - Send notification
- `GET /api/admin/audit-logs` - Get audit logs

## Database Models

### User
- OAuth provider information
- Contact details
- Push notification settings
- Device tokens

### FamilyMember
- Patient information (name, DOB, PHIN, MHSC)
- Linked to user account

### Zone
- Geographic boundaries (polygon)
- Service availability (phone call, house call)
- Capacity flags
- Priority for overlapping zones

### Booking
- Visit type and details
- Address and geocoded location
- Patient information snapshot
- Zone matching
- Status tracking
- Override information

### PushNotification
- Notification content
- Target audience
- Delivery status
- Scheduling

### AuditLog
- Action tracking
- Change history
- Admin actions

## Project Structure

```
src/
├── config/          # Configuration files (database, geocoder)
├── controllers/     # Route controllers
├── middleware/      # Express middleware (auth, validation, error handling)
├── models/          # Mongoose models
├── routes/          # API routes
├── services/        # Business logic services
├── app.js           # Express app configuration
└── server.js        # Server entry point
```

## Development Notes

- The API uses JWT tokens for authentication
- Address geocoding is required before booking
- Zone matching uses polygon intersection
- All admin actions are logged in audit logs
- Push notifications require Firebase Admin SDK (optional)

## License

ISC
