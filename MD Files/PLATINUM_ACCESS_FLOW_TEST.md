# 🔐 Platinum/Ultra Access Flow - Complete Testing Guide

## 📋 Updated System Overview

The platinum/ultra access system now works with **dual authentication**:

1. **Token-Based Access** (12-digit code)
   - Generated when admin approves payment proof
   - Passed in redirect URL after payment success
   - Stored securely in `support/tokens.json`
   - Validates against expiry and token validity

2. **Plan-Based Access** (JWT + Plan Check)
   - JWT token from login
   - Plan check via `getActivePlanSnapshot()`
   - Allows access if user has active platinum/ultra plan
   - No need for 12-digit token if plan is active in system

---

## 🔄 Complete User Journey

### Phase 1: Purchase
```
User → Upgrade Form
     ↓
     Select "Platinum" or "Ultra" plan
     ↓
     Apply coupon (optional, e.g., "GET40" for 40% discount)
     ↓
     Click "Generate Payment QR"
     ↓ (Coupon + Discount info stored in hidden form fields)
     ↓
     UPI QR code displayed
```

**Expected Console Output (Frontend):**
```
📋 Submitting proof with coupon
💰 Submitting with discount: ₹10000 (40%)
💵 Amount being submitted: ₹15000
```

---

### Phase 2: Proof Submission
```
User → Upload payment screenshot
     ↓
     Submit proof
     ↓
     Server logs:
     - 🧾 Payment proof saved → UID=xxx, Original: ₹25000, Final: ₹15000 (Coupon: GET40, Discount: ₹10000)
```

**Expected Server Output:**
```
🧾 Payment proof saved → UID=shivamdave_0704_gmail_com
Original Amount: ₹25000
Final Amount: ₹15000
Coupon Applied: GET40
Discount: ₹10000 (40%)
Proof ID: xxxxx
```

---

### Phase 3: Admin Approval
```
Admin → Open Admin Panel (admin.html)
     ↓
     Find the platinum/ultra proof in "Pending Verification"
     ↓
     Click "Approve"
     ↓
     Server logs:
     - ✅ Token generated for UID=xxx, Plan=platinum
     - 💾 Purchase record updated
     - 🔄 Auto-synced plan-active.json
```

**Expected Server Output:**
```
🔔 Proof status updated for UID=xxx to 'approved'
✅ Token generated for UID=shivamdave_0704_gmail_com, Plan=platinum
💾 Purchase record updated for proof xxxxx
🔄 AUTO-SYNC: plan-active.json regenerated from purchases.json
📩 Plan activation email sent to user@email.com
```

---

### Phase 4: Redirect to Platinum UI
```
Admin approves
     ↓
     Token generated: 12-digit code (e.g., "827465091234")
     ↓
     Token stored in: support/tokens.json
     ↓
     Email sent to user with activation notice
     ↓
     User can now visit platinum-ui-upload.html
```

**Expected Token Entry in support/tokens.json:**
```json
{
  "token": "827465091234",
  "uid": "shivamdave_0704_gmail_com",
  "plan": "platinum",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "expiresAt": "2025-01-15T10:30:00.000Z",
  "used": false
}
```

---

### Phase 5: Access Platinum UI
```
User → Redirected by payment.html
     ↓ (URL includes token)
     platinum-ui-upload.html?uid=xxx&token=827465091234
     ↓
     Frontend stores token in sessionStorage (secure)
     ↓
     URL token removed for security (history.replaceState)
     ↓
     Page loads with platinum interface
```

**Expected Frontend Console Output:**
```
✅ Token stored securely
✅ UID stored: shivamdave_0704_gmail_com
🔐 Platinum UI Access - Token Status: { hasToken: true, hasUID: true, timestamp: "..." }
```

---

## ✅ Testing Checklist

### Test 1: Token Generation on Admin Approval
- [ ] Navigate to admin.html
- [ ] Find a platinum/ultra payment proof in "Pending Verification"
- [ ] Click "Approve"
- [ ] Check server console for: `✅ Token generated for UID=...`
- [ ] Check `support/tokens.json` - new token entry should exist
- [ ] Check 12-digit token is numeric only

### Test 2: Payment Redirect
- [ ] Complete a platinum purchase with QR
- [ ] Submit payment proof
- [ ] Go to admin.html and approve the proof
- [ ] Open browser console and watch payment.html redirect
- [ ] Verify URL redirects to: `platinum-ui-upload.html?uid=xxx&token=yyy`

### Test 3: Token Validation on Page Load
- [ ] After redirect, open platinum-ui-upload.html
- [ ] Check browser console for: `✅ Token stored securely`
- [ ] Check URL - token should be removed from it
- [ ] Page should load normally with platinum interface
- [ ] sessionStorage should contain 'platinumToken'

### Test 4: Invalid Token Rejection
- [ ] Try to access platinum-ui-upload.html with invalid token: 
   ```
   platinum-ui-upload.html?token=111111111111
   ```
- [ ] Server should respond with: "Invalid or Expired Token" error page
- [ ] User should see: "⚠️ Invalid or Expired Token" with link to upgrade

### Test 5: Expired Token Rejection
- [ ] Manually edit `support/tokens.json`
- [ ] Change `expiresAt` to a past date for a token
- [ ] Try to access platinum-ui-upload.html with that token
- [ ] Server should reject it (token validated in validateToken())

### Test 6: Plan-Based Access (No Token Needed)
- [ ] Edit `support/plan-active.json`
- [ ] Add user with platinum plan and isActive=true
- [ ] Access platinum-ui-upload.html WITHOUT token in URL
- [ ] With JWT auth, user should still get access via plan check
- [ ] Console should show plan validation passed

### Test 7: Access Denied Without Token or Plan
- [ ] Try to access platinum-ui-upload.html with:
   - [ ] No token in URL
   - [ ] No valid JWT session
   - [ ] No plan in plan-active.json
- [ ] Server should return: "Access Token Required" error page
- [ ] Should have link to "Purchase Plan"

---

## 🔧 Configuration

### Environment Variables (.env)
```env
AUTO_GENERATE_PLANS=true      # Regenerate plans on server startup
COUPON_CODE=GET40             # Coupon code for discounts
DISCOUNT_PERCENT=40           # Discount percentage for coupon
```

### Token Settings (TOKEN_SYSTEM.js)
- **Token Length:** 12 digits (numeric only)
- **Token Expiry:** 1 year from creation
- **Storage:** `support/tokens.json` (server-side, never exposed)

### Server Routes
- `GET /platinum-ui-upload.html` - Token-validated route
  - Accepts token in query string or X-Access-Token header
  - Falls back to JWT + plan check
  - Returns error page if access denied

---

## 🐛 Troubleshooting

### Problem: "Access Token Required" on platinum-ui-upload.html
**Solution:**
1. Check server logs for token generation: `✅ Token generated for UID=...`
2. If not found, admin hasn't approved the proof yet
3. Go to admin.html and approve the pending proof
4. Check `support/tokens.json` exists and has user's token entry

### Problem: Token disappears from URL too quickly
**Solution:**
- This is intentional! Frontend removes it with `history.replaceState`
- Token is stored in sessionStorage (browser memory, cleared on close)
- This prevents token exposure in browser history

### Problem: Same user gets new token every time they refresh
**Solution:**
- Each approval generates one token
- If user resubmits proof multiple times and admin approves each:
  - Multiple tokens created for same user
  - Any valid token grants access
  - This is OK - tokens auto-expire after 1 year

### Problem: User can't login to platinum UI after browser refresh
**Solution:**
1. User lost sessionStorage token (cleared on refresh)
2. If they have active plan: They can access without token
3. If they only have token (no plan): Need to bookmark the token URL
4. Better UX: Email user the token for future use (implement later)

---

## 📊 Database Files

### support/tokens.json
```json
{
  "tokens": [
    {
      "token": "827465091234",
      "uid": "shivamdave_0704_gmail_com",
      "plan": "platinum",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2025-01-15T10:30:00.000Z",
      "used": false
    }
  ]
}
```

### support/plan-active.json (Auto-generated)
```json
{
  "self": { "uid": "shivamdave_0704_gmail_com" },
  "plans": [
    {
      "plan": "platinum",
      "status": { "isActive": true, "isBlocked": false },
      "transaction": { "activatedAt": "...", "expiresAt": "..." }
    }
  ]
}
```

---

## 🎯 Security Features

✅ **Server-Side Token Storage**
- Tokens never sent to client (only via URL on redirect)
- Support/tokens.json is not accessible via HTTP

✅ **Token Expiry**
- All tokens expire after 1 year
- validateToken() checks expiry date

✅ **URL Token Removal**
- Token removed from URL after stored
- Prevents exposure in browser history/bookmarks

✅ **Dual Authentication**
- Token-based for newly approved users
- Plan-based for users with active plans in system

✅ **JWT Integration**
- Supports secure JWT token auth
- Fallback for users logged in via JWT

---

## 🚀 Next Steps

After successful testing:

1. **User Email Enhancement**
   - Send 12-digit token in activation email
   - Allow users to access platinum UI anytime with token

2. **Token Management UI**
   - Add token view/regenerate in user settings
   - Show token expiry date

3. **Analytics**
   - Track platinum UI access per token
   - Monitor token usage patterns

4. **Mobile Optimization**
   - Ensure token URL works on mobile
   - Consider QR code for token sharing

---

## 📞 Support

If you encounter issues during testing:

1. Check server console for error messages
2. Verify `.env` file has correct settings
3. Ensure `support/tokens.json` is writable
4. Check `support/plan-active.json` is being regenerated
5. Verify admin.html can approve proofs without errors
