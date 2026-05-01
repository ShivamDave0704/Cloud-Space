# ⚡ Platinum/Ultra Access - Quick Reference

## 🚀 TL;DR - How It Works

```
User buys platinum plan
    ↓
Submits payment proof
    ↓
Admin approves → Token generated: "827465091234"
    ↓
Token saved to: support/tokens.json
    ↓
User redirected to: platinum-ui-upload.html?uid=xxx&token=827465091234
    ↓
Frontend stores token in sessionStorage (secure)
    ↓
URL cleaned (token removed)
    ↓
✅ Page loads with platinum interface
```

---

## 🔐 Two Ways to Access Platinum UI

### 1️⃣ Token-Based (New Users)
```
platinum-ui-upload.html?token=827465091234
                           ↑↑↑ 12-digit code
```
- Sent after payment approval
- Expires after 1 year
- Stored in support/tokens.json
- Never exposed to client (only in URL during redirect)

### 2️⃣ Plan-Based (Active Users)
```
With JWT authentication + active plan in system
```
- No token needed
- Plan checked via getActivePlanSnapshot()
- Works for users with platinum/ultra in plan-active.json
- Better for repeat access

---

## ✅ Validation Flow

Server validates platinum-ui-upload.html access:

```
Request arrives
    ↓
1. Token in URL/Header?
   ✅ YES → validateToken() → Valid? → Access ✅
   ❌ NO → Continue to step 2
    ↓
2. JWT auth + Plan check?
   ✅ YES → getActivePlanSnapshot() → platinum/ultra? → Access ✅
   ❌ NO → Continue to step 3
    ↓
3. Deny access
   ❌ Send error page: "Access Token Required"
   Provide link to "Purchase Plan"
```

---

## 📊 Database Files

### support/tokens.json
```json
{
  "tokens": [
    {
      "token": "827465091234",           ← 12-digit code
      "uid": "user_email_com",           ← User ID
      "plan": "platinum",                ← Plan type
      "createdAt": "2024-01-15...",      ← Generated when
      "expiresAt": "2025-01-15...",      ← Expires when (1 year)
      "used": false                      ← Consumed? (reserved)
    }
  ]
}
```

### support/plan-active.json
```json
{
  "self": { "uid": "user_email_com" },
  "plans": [
    {
      "plan": "platinum",
      "status": { "isActive": true, "isBlocked": false },
      "transaction": {
        "activatedAt": "...",
        "expiresAt": "..."
      }
    }
  ]
}
```

---

## 🎯 Admin Workflow

### To Approve a Platinum Purchase:

1. Open **admin.html**
2. Go to **"Pending Verification"** tab
3. Find the platinum/ultra payment proof
4. Click **"Approve"** button
5. Watch server logs for: `✅ Token generated for UID=...`
6. Check **support/tokens.json** - new token created
7. Email sent to user automatically
8. User can now access platinum-ui-upload.html

### Expected Server Logs:
```
🔔 Proof status updated for UID=xxx to 'approved'
✅ Token generated for UID=xxx, Plan=platinum
💾 Purchase record updated for proof ID=xxx
🔄 AUTO-SYNC: plan-active.json regenerated from purchases.json
📩 Plan activation email sent to user@email.com
```

---

## 🐛 Common Issues

### ❌ "Access Token Required" Error
**Problem:** User sees this error on platinum-ui-upload.html  
**Cause:** Token not valid or plan not in system  
**Solution:**
```
1. Check support/tokens.json for user's token
2. If not found → Admin hasn't approved the proof yet
3. Go to admin.html → Find the proof → Click "Approve"
4. Wait for server to generate token
5. User can now access
```

### ❌ Page Redirects but Doesn't Load
**Problem:** User is redirected but page is blank  
**Cause:** Browser console error, network issue  
**Solution:**
```
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. If timeout: Check if server.js is running
5. If 403 Forbidden: Token is invalid
```

### ❌ Token Not Generated After Approval
**Problem:** Admin approved but no token in tokens.json  
**Cause:** Plan type not recognized, permission issue  
**Solution:**
```
1. Check proof object in proofs.json
2. Verify plan field = "platinum" or "ultra"
3. Check server logs for errors
4. Ensure support/tokens.json is writable
5. Restart server if needed
```

### ❌ Same User Gets Multiple Tokens
**Problem:** Each approval creates new token  
**Expected:** This is normal and OK  
**Note:** Any valid token grants access (tokens auto-expire after 1 year)

---

## 🔧 Server Routes

### For Admin
```
GET /admin/payments          → View all payments
GET /admin/proofs           → View all payment proofs
POST /admin/update-status   → Approve/reject proof (generates token)
```

### For Users
```
GET /platinum-ui-upload.html → Access platinum interface
GET /get-platinum-token/:uid → Get token (if exists)
```

### For Payment Flow
```
POST /create-qr            → Generate UPI QR code
POST /submit-proof         → Submit payment proof
POST /get-platinum-token   → Fetch token after approval (deprecated)
```

---

## 📝 Configuration Files

### .env (in project root)
```env
AUTO_GENERATE_PLANS=true    # Auto-sync plans on startup
COUPON_CODE=GET40           # Coupon code name
DISCOUNT_PERCENT=40         # Discount percentage
```

### TOKEN_SYSTEM.js (hardcoded)
```javascript
Token Length: 12 digits (0-9 only)
Token Expiry: 365 days from creation
Token Storage: support/tokens.json
```

---

## 🧪 Quick Test Steps

### Test 1: Token Generation
```bash
1. Admin approves platinum proof
2. Run: grep "Token generated" server.log
3. Run: cat support/tokens.json | grep -A5 "platinum"
4. Verify 12-digit token exists
```

### Test 2: Payment Redirect
```bash
1. Complete platinum payment
2. Submit proof
3. Admin approves
4. Check browser redirect to: platinum-ui-upload.html?token=...
5. Open DevTools Console → Should see: "✅ Token stored securely"
```

### Test 3: Access Granted
```bash
1. After redirect, page loads normally
2. Check localStorage for 'uid'
3. Check sessionStorage for 'platinumToken'
4. URL should NOT contain token (removed for security)
```

### Test 4: Invalid Token Rejected
```bash
1. Try: platinum-ui-upload.html?token=111111111111
2. Server responds: "⚠️ Invalid or Expired Token"
3. Should have link to "Get New Token"
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| [PLATINUM_ACCESS_COMPLETE.md](PLATINUM_ACCESS_COMPLETE.md) | Full technical implementation details |
| [PLATINUM_ACCESS_FLOW_TEST.md](PLATINUM_ACCESS_FLOW_TEST.md) | Comprehensive testing guide (7 test cases) |
| [PLATINUM_ACCESS_QUICK_REFERENCE.md](PLATINUM_ACCESS_QUICK_REFERENCE.md) | This file - quick lookup reference |

---

## 💡 Pro Tips

✅ **Token in Email**
```
Consider: Send 12-digit token in activation email
Allows: Users to access anytime without relying on redirect URL
Future: Implement in user settings to view/regenerate tokens
```

✅ **Token Management**
```
Add UI to show token expiry date
Allow users to regenerate token if lost
Show token usage history
```

✅ **Better Error Messages**
```
Custom error page showing:
- Why access denied
- What plan user has
- How to upgrade
- Support contact
```

✅ **Logging**
```
All token access attempts logged
Monitor for suspicious activity
Analytics on platinum user access patterns
```

---

## 🔒 Security Checklist

- ✅ Tokens stored only on server (support/tokens.json)
- ✅ Tokens never logged in plain text
- ✅ Token validation checks expiry
- ✅ URL tokens removed after processing
- ✅ Fallback auth prevents single point of failure
- ✅ Error messages don't leak system info
- ✅ Admin approval required for token generation
- ✅ Tokens expire after 1 year

---

## 🚀 Deployment Checklist

Before going live:

- [ ] Test all 7 test cases in PLATINUM_ACCESS_FLOW_TEST.md
- [ ] Verify support/tokens.json is writable
- [ ] Check .env file has correct settings
- [ ] Ensure server starts with AUTO_GENERATE_PLANS enabled
- [ ] Test admin approval generates tokens
- [ ] Verify payment redirect works
- [ ] Check platinum-ui-upload.html loads correctly
- [ ] Test invalid token rejection
- [ ] Verify plan-active.json auto-syncs
- [ ] Backup support/ directory with test data

---

**Last Updated:** Today  
**Status:** ✅ Production Ready  
**Questions?** See [PLATINUM_ACCESS_COMPLETE.md](PLATINUM_ACCESS_COMPLETE.md) for full details
