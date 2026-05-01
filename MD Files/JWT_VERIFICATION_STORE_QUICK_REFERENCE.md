# JWT Verification Store - Quick Reference

## ✅ What's New

A new JWT verification tracking system that stores all token verification attempts in `support/verification.json` instead of logging them to console.

## 🚀 Quick Start

### View Verification Dashboard (Admin Only)
```
http://localhost:5000/admin-verification-dashboard.html
```

Login with admin account:
- Email: `admin@cloudspace.com`
- Password: `Admin@123`

### API Endpoints

**Get Statistics:**
```bash
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:5000/api/admin/verification-stats
```

**Get Recent Attempts (last 50):**
```bash
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:5000/api/admin/verification-recent?limit=50
```

**Clear Store:**
```bash
curl -X POST -H "Authorization: Bearer <admin_token>" \
  http://localhost:5000/api/admin/verification-clear
```

## 📊 Dashboard Features

| Feature | Description |
|---------|-------------|
| **Total Attempts** | Count of all verification attempts since server start |
| **Success Rate** | Percentage of successful token verifications |
| **Malformed Count** | Number of malformed JWT tokens received |
| **Expired Count** | Number of expired token attempts |
| **Error Summary** | Breakdown of errors by type |
| **Recent Logs** | Table of last 50 verification attempts |
| **Auto-refresh** | Updates every 10 seconds automatically |

## 📁 Files

**New Files Created:**
- `utils/verification-store.js` - Core verification tracking module
- `public/admin-verification-dashboard.html` - Admin dashboard
- `support/verification.json` - Verification storage

**Files Modified:**
- `TOKEN_SYSTEM.js` - Now logs token validation attempts
- `server-core.js` - Now logs JWT middleware attempts
- `server-admin.js` - Added 3 new admin API endpoints

## 🔍 Status Types

```
✅ success    - Token verified successfully
⚠️  malformed - Invalid JWT format
❌ expired    - Token past expiry date
❌ invalid    - Token not found or inactive
⚪ missing    - No token provided
🔴 error      - Unexpected error
```

## 📈 Verification Stats Format

```javascript
{
  stats: {
    totalAttempts: 42,      // Total verification attempts
    successCount: 38,       // Successful verifications
    failureCount: 4,        // Failed verifications
    malformedCount: 2,      // Malformed tokens
    expiredCount: 0         // Expired tokens
  },
  errorSummary: {
    "jwt malformed": 2,     // Error type : count
    "No token": 1
  },
  successRate: "90%"        // Calculated success rate
}
```

## 💡 Use Cases

1. **Monitor authentication health**: Check success rate via dashboard
2. **Debug token issues**: View recent attempts and error types
3. **Identify patterns**: See which errors occur most frequently
4. **Audit trail**: Historical record of all verification attempts
5. **Performance**: Track token verification trends

## ⚙️ Configuration

The verification store automatically:
- Creates `verification.json` on server start
- Keeps last 100 verification attempts
- Maintains rolling statistics
- Truncates tokens for security (shows only first 20 chars)

## 🔐 Security

- ✅ Only admins can access verification APIs
- ✅ Tokens are truncated (never stored in full)
- ✅ Server-side only (not exposed to clients)
- ✅ Requires valid JWT authentication

## 📝 Example Output

```json
{
  "timestamp": "2026-02-05T12:35:00.123Z",
  "status": "success",
  "error": null,
  "source": "verifyToken",
  "uid": "USR-39KXAWTR",
  "tokenPrefix": "eyJhbGciOiJIUzI1NiIs..."
}
```

## 🛠️ Common Tasks

**Clear verification data:**
1. Open http://localhost:5000/admin-verification-dashboard.html
2. Click "🗑️ Clear Store" button
3. Confirm the action

**Export verification logs:**
1. Get logs via API: `/api/admin/verification-recent?limit=100`
2. Save response to file
3. Import to Excel or analysis tool

**Debug authentication failures:**
1. Login as admin
2. Open verification dashboard
3. Look for high "malformed" or "expired" counts
4. Check "Recent Attempts" table for patterns

## 📞 Support

If you see high error rates:
1. Check server logs for related errors
2. Verify JWT_SECRET is consistent
3. Check token expiry settings
4. Review recent verification attempts
5. Contact development team with error summary

## 🎯 Key Metrics to Monitor

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| **Success Rate** | > 90% | 70-90% | < 70% |
| **Malformed Count** | < 1% of attempts | 1-5% | > 5% |
| **Expired Count** | Low | Moderate | High |
| **Response Time** | < 50ms | 50-100ms | > 100ms |

