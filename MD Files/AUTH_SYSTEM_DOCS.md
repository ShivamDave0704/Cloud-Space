# 🔐 Authentication System Documentation

## System Overview
The CloudSpace authentication system uses **magic link verification** for signup and traditional email/password for login. All user data is stored in `support/users.json`.

## Key Files

### Frontend Pages
- **[Signup Page](public/index.html)** - Create new account with magic link verification
- **[Login Page](public/login.html)** - Login with email and password  
- **[Auth Records Dashboard](public/auth-records.html)** - View all login/signup activity ✨ NEW

### Backend
- **[server-auth.js](server-auth.js)** - Authentication routes and user management

## How It Works

### Signup Flow
1. User fills form on [index.html](public/index.html) with username, email, phone
2. Solves CAPTCHA and clicks "🔑 Verify Email"
3. Frontend calls `POST /request-magic-link`
4. Backend creates user entry in `users.json` with:
   - UID (e.g., USR-XXXXXXX)
   - Temporary password
   - `verified: false`
5. Magic link email sent (valid 15 minutes)
6. User clicks link → redirected to `/magic-login?token=...`
7. Account verified → `verified: true` set in `users.json`
8. User receives welcome email with credentials

### Login Flow
1. User enters email/password on [login.html](public/login.html)
2. Frontend calls `POST /login`
3. Backend checks credentials against `users.json`
4. If valid:
   - JWT token generated
   - User data returned (uid, email, role, etc.)
5. If unverified:
   - New verification email sent
   - Auto-block timers start (10 min → 24 hr → 30 days → permanent)

## API Endpoints

### Authentication
- `POST /request-magic-link` - Send verification email for signup
  ```json
  { "email": "user@example.com", "username": "John", "phone": "9876543210" }
  ```

- `POST /login` - Login with credentials
  ```json
  { "email": "user@example.com", "password": "password123" }
  ```

- `GET /magic-login?token=xxx` - Verify account via magic link

- `POST /forgot-password` - Verify user for password reset
  ```json
  { "email": "user@example.com", "phone": "9876543210", "uid": "USR-XXXXXXX" }
  ```

- `POST /reset-password-forgot` - Reset password after verification
  ```json
  { "email": "user@example.com", "newPassword": "newpass123" }
  ```

### User Data
- `GET /api/auth/all-users` - Get all users (passwords excluded) ✨ NEW
- `GET /user-by-email/:email` - Get user by email
- `GET /user-by-uid/:uid` - Get user by UID
- `POST /user-details` - Check if user exists
- `POST /update-profile` - Update username, phone, profile pic

## User JSON Structure

```json
{
  "uid": "USR-XXXXXXX",
  "username": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "encrypted_password",
  "role": "user",
  "profilePic": "/uploads/john_example_com/profile/profile-1234567890.png",
  "created_at": "2026-01-01T10:00:00.000Z",
  "verified": true,
  "blocked": false,
  "permanentBan": false,
  "uiAccess": null,
  "plan": "free",
  "storageTB": 0.5
}
```

## Role Types
- `superadmin` - Full system access (Owner)
- `admin` - Administrative access
- `user` - Standard user (default)

## Status Types
- `verified: true` - Email verified, account active
- `verified: false` - Pending email verification
- `blocked: true` - Temporarily blocked
- `permanentBan: true` - Permanently banned

## Access the Auth Records Dashboard

**URL:** http://localhost:5000/auth-records.html

### Features
- 📊 Real-time statistics (Total, Verified, Unverified, Blocked, Admins)
- 🔍 Search by UID, Email, Username, Phone
- 🎯 Filter by status (All, Verified, Unverified, Blocked, Admins)
- 📋 View raw JSON data
- 💾 Download records as JSON file
- 🔄 Real-time refresh

## Security Notes
- Passwords are stored in plain text in `users.json` ⚠️ (Consider bcrypt hashing)
- Magic links expire after 15 minutes
- Unverified accounts auto-block after 10 minutes
- Three-tier block system: 10min → 24hr → 30days → permanent
- JWT tokens used for session management
- Admin endpoints protected with role verification

## Default Admin Accounts

### Super Admin
- Email: `owner@cloudspace.com`
- Password: From `.env` file (`SUPER_ADMIN_PASSWORD`)
- UID: `SUPER-001`

### Admin
- Email: From `.env` file (`DEFAULT_ADMIN_EMAIL`)
- Password: From `.env` file (`DEFAULT_ADMIN_PASSWORD`)  
- UID: `ADMIN-001`

## Testing

1. **Signup Test:**
   - Go to: http://localhost:5000/
   - Fill form and verify email
   - Check `support/users.json` for new entry

2. **Login Test:**
   - Go to: http://localhost:5000/login.html
   - Use credentials from verification email
   - Check JWT token in response

3. **View Records:**
   - Go to: http://localhost:5000/auth-records.html
   - View all signup/login activity
   - Filter and search records

## File Locations
- Users database: `support/users.json`
- Login logs: `support/logs/login-attempts.log`
- Password resets: `support/logs/reset-requests.log`
- Flags/events: `support/logs/flags.log`
