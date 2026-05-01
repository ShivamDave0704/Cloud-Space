# 📊 Plan Access System - Flow Diagrams

## 1. Payment Approval & Token Creation

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER PURCHASES PLAN                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUBMITS PAYMENT PROOF                        │
│              (Screenshot of UPI/Card payment)                   │
│                  Endpoint: /submit-proof                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Stored in: support/proofs.json                     │
│              Status: "pending" (awaiting admin)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN REVIEWS PROOF                          │
│              Dashboard: /admin.html                             │
│           Views pending payment proofs + screenshot             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  APPROVE PROOF  │
                    └────────┬────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Endpoint: /admin/update-status            │
        │  Action: Approve + Create Token            │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Generate Token:                           │
        │  Format: USR{UID}-PLATPLAN-dd-mm-yyyy-{6}  │
        │  Example: USR123-PLATPLAN-01-02-2026-847392│
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Save to: support/tokens.json              │
        │  Metadata:                                 │
        │  - email, uid, plan, token                 │
        │  - createdAt, expiresAt                    │
        │  - active: true, used: false               │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Create Purchase Record                    │
        │  Stored in: purchases.json                 │
        │  Status: "completed", isActive: true       │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Send Email to User:                       │
        │  "Payment Approved! Welcome to [Plan]"     │
        │  "Please login to access your plan"        │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  ✅ PROCESS COMPLETE                       │
        │  User now has valid token in system        │
        └────────────────────────────────────────────┘
```

---

## 2. User Login & Redirect Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              USER GOES TO /login.html                          │
│              Enters email + password                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌────────────────────────────────────────────┐
        │  Endpoint: POST /login                     │
        │  Validates credentials                     │
        └────────────────────────────────────────────┘
                             ↓
                ┌──────────────────────┐
                │  CHECK ACTIVE PLANS  │
                │  (purchases.json)    │
                └──────────────────────┘
                             ↓
                    ┌────────┴──────────┐
                    ↓                   ↓
        ┌─────────────────┐    ┌──────────────────┐
        │  HAS NO PLAN    │    │  HAS PLAN        │
        │  (Free tier)    │    │  (Platinum/Ultra)│
        └────────┬────────┘    └────────┬─────────┘
                 ↓                      ↓
        ┌─────────────────┐    ┌──────────────────────────┐
        │ Return:         │    │ Return:                  │
        │ - jwt (2h)      │    │ - jwt (2h)               │
        │ - username      │    │ - premiumToken (long)    │
        │ - email         │    │ - activePlan (name)      │
        │ - uid           │    │ - redirectPage (path)    │
        │ - role          │    │ - username, email, etc.  │
        └────────┬────────┘    └────────┬──────────────────┘
                 ↓                      ↓
    ┌─────────────────────────┐ ┌──────────────────────────┐
    │  FRONTEND login.js      │ │  FRONTEND login.js       │
    │  stores in localStorage:│ │  stores in localStorage: │
    │                         │ │                          │
    │  token = jwt            │ │  token = jwt             │
    │  username = ...         │ │  premiumToken = ...      │
    │  email = ...            │ │  username = ...          │
    │  uid = ...              │ │  email = ...             │
    │  role = ...             │ │  uid = ...               │
    │                         │ │  activePlan = platinum   │
    └────────┬────────────────┘ └──────────┬───────────────┘
             ↓                             ↓
    ┌─────────────────────┐    ┌──────────────────────────┐
    │ REDIRECT to:        │    │ REDIRECT to:             │
    │ /upload.html        │    │ platinum-ui-upload.html? │
    │                     │    │ uid=123                  │
    │ (Standard upload)   │    │                          │
    │                     │    │ (CLEAN URL - No token!)  │
    └─────────────────────┘    └──────────┬───────────────┘
                                          ↓
                            ┌──────────────────────────┐
                            │  ✅ USER ON PLAN PAGE   │
                            │  Ready for auth check    │
                            └──────────────────────────┘
```

---

## 3. Plan Page Authorization Check

```
┌─────────────────────────────────────────────────────────────────┐
│              USER LOADS PLAN PAGE                              │
│              (platinum-ui-upload.html or ultra-upload.html)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌────────────────────────────────────────────┐
        │  IMMEDIATE ACTIONS:                        │
        │  1. Hide sensitive params from URL         │
        │  2. Store UID in localStorage              │
        │  3. Prepare for authorization              │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  window.addEventListener('load', async)   │
        │  Run authorization check                   │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  AUTHORIZATION CHECK FUNCTION              │
        │                                            │
        │  1. Get uid from localStorage              │
        │  2. Get jwt from localStorage              │
        │  3. Call /api/check-plan-access            │
        │     Header: Authorization: Bearer JWT      │
        │     Body: { plan: "platinum/ultra" }       │
        └────────────────────────────────────────────┘
                             ↓
                    ┌────────┴──────────┐
                    ↓                   ↓
        ┌─────────────────┐    ┌──────────────────┐
        │  AUTHORIZED     │    │  NOT AUTHORIZED  │
        │  (data.auth...)  │    │  (data.auth...)   │
        └────────┬────────┘    └────────┬─────────┘
                 ↓                      ↓
        ┌─────────────────┐    ┌──────────────────┐
        │  Store token in │    │ SHOW MODAL       │
        │  sessionStorage │    │                  │
        │                 │    │ Modal properties:│
        │  Initialize     │    │ - ID: "unauthorized │
        │  page          │    │       Modal"      │
        │                 │    │ - Display: flex   │
        │  User can:      │    │ - Z-index: 9999  │
        │  - Upload files │    │ - Backdrop blur   │
        │  - View stats   │    │ - Centered        │
        │  - Access plan  │    │ - Animated        │
        └────────┬────────┘    └────────┬─────────┘
                 ↓                      ↓
        ┌─────────────────┐    ┌──────────────────┐
        │  ✅ ACCESS      │    │  🔐 BLOCKED      │
        │  GRANTED        │    │                  │
        │                 │    │  Options:        │
        │  Session Active │    │  - Upgrade Now   │
        │  (expires on    │    │  - Back Home     │
        │   browser close)│    │                  │
        └─────────────────┘    └──────────────────┘
```

---

## 4. Token Storage Timeline

```
TIME: LOGIN (Day 1, 10:00 AM)
════════════════════════════════════════════════════════════════

Event: User logs in successfully

BEFORE LOGIN.JS REDIRECT:
┌─────────────────────────────────────┐
│ localStorage:                       │
│  - token = JWT (2h expiry)         │
│  - username = "john_doe"           │
│  - email = "john@example.com"      │
│  - uid = "123"                     │
│  - activePlan = "platinum"         │
│                                     │
│ sessionStorage: (empty)             │
└─────────────────────────────────────┘

AFTER LOGIN.JS REDIRECT (Before Plan Page):
┌─────────────────────────────────────┐
│ localStorage:                       │
│  - token = JWT (valid for 2h)      │
│  - premiumToken = TOKEN (see below) │
│  - username = "john_doe"           │
│  - email = "john@example.com"      │
│  - uid = "123"                     │
│  - activePlan = "platinum"         │
│                                     │
│ sessionStorage: (empty yet)         │
└─────────────────────────────────────┘

TOKEN DETAILS:
═════════════════════════════════════════════════════════════════
Format: USR123-PLATPLAN-01-02-2026-847392
├─ USR: Prefix
├─ 123: User ID
├─ PLATPLAN: Plan type
├─ 01-02-2026: Creation date (dd-mm-yyyy)
└─ 847392: Random 6 digits


PLAN PAGE LOAD (Same time, ~10:00 AM):
┌─────────────────────────────────────┐
│ URL Bar: platinum-ui-upload.html    │ ✅ CLEAN!
│                                     │ (No ?token=... params)
│                                     │
│ localStorage: (SAME AS ABOVE)       │
│                                     │
│ sessionStorage: (still empty)       │
└─────────────────────────────────────┘
                    ↓
         [Authorization Check]
                    ↓
        ┌──────────────────────┐
        │  ✅ AUTHORIZED       │
        │  Fetch response OK   │
        │  Token returned      │
        └──────────────────────┘
                    ↓

AFTER AUTH SUCCESS (10:00:05 AM):
┌─────────────────────────────────────┐
│ localStorage: (UNCHANGED)           │
│  - token = JWT                      │
│  - premiumToken = TOKEN             │
│  - username, email, uid, etc.       │
│                                     │
│ sessionStorage:                     │
│  - premiumToken = TOKEN (NEW!)      │
│  - uid = "123" (NEW!)               │
│  - tokenTimestamp = 1706768405000   │
│  (Set to expire when browser closes)│
└─────────────────────────────────────┘


TIME: API CALLS (10:01 AM - 12:00 PM)
════════════════════════════════════════════════════════════════

For regular API calls:
  Header: Authorization: Bearer [JWT from localStorage.token]

For plan-specific features:
  May use: sessionStorage.premiumToken


TIME: BROWSER CLOSE (2:00 PM)
════════════════════════════════════════════════════════════════

CLEARED (Automatic):
✗ sessionStorage (ALL CONTENT CLEARED)
  ├─ premiumToken: DELETED
  ├─ uid: DELETED
  └─ tokenTimestamp: DELETED

REMAINS (In localStorage):
✓ token: JWT (but now expired since 2h passed)
✓ premiumToken: Still here (refreshed on next login)
✓ username, email, uid, etc.


TIME: USER REOPENS BROWSER NEXT DAY (10:00 AM, Day 2)
════════════════════════════════════════════════════════════════

Old localStorage still exists (persistent):
  - token: JWT from yesterday (EXPIRED!)
  - premiumToken: Still there
  - Other user info

User needs to login again:
  1. Old JWT expired (only valid for 2 hours)
  2. New login generates new JWT + verified token
  3. Fresh sessionStorage tokens created
  4. Process repeats

RESULT:
═══════════════════════════════════════════════════════════════

SessionStorage:
  ✅ Auto-clear on browser close (security)
  ✅ Separate from localStorage (isolation)
  ✅ No persistence to disk (privacy)
  ✅ Expires with session (automatic cleanup)

localStorage:
  ✅ Persists across sessions (user convenience)
  ✅ JWT expires in 2h (short window)
  ✅ Better than storing sensitive token permanently
  ✅ Users must login periodically

Result: Secure + User-friendly balance!
```

---

## 5. Unauthorized User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              USER WITHOUT PLAN TRIES ACCESSING PAGE            │
│              (Directly via URL or from somewhere else)         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌────────────────────────────────────────────┐
        │  Opens: platinum-ui-upload.html             │
        │  In URL bar: just the path, no params       │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Page JavaScript executes                   │
        │  Authorization check runs                   │
        │  Calls: /api/check-plan-access              │
        │  Header: Bearer [their JWT token]           │
        │  Body: { plan: "platinum" }                 │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Backend Response:                          │
        │  {                                          │
        │    authorized: false,                       │
        │    msg: "No active plan found"              │
        │  }                                          │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  Frontend: Not Authorized                   │
        │  Calls: showUnauthorizedModal("Platinum")   │
        └────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────────┐
        │  MODAL APPEARS (Full screen overlay)        │
        │                                            │
        │  ┌──────────────────────────────────────┐  │
        │  │                                      │  │
        │  │          🔐  (animated bounce)      │  │
        │  │                                      │  │
        │  │      UNAUTHORIZED ACCESS            │  │
        │  │                                      │  │
        │  │  You do not have access to the      │  │
        │  │  Platinum plan yet.                 │  │
        │  │                                      │  │
        │  │  Upgrade now to unlock premium      │  │
        │  │  features and exclusive benefits!   │  │
        │  │                                      │  │
        │  │  ┌──────────────┬───────────────┐   │  │
        │  │  │💎 Upgrade    │ ← Back Home   │   │  │
        │  │  │   Now        │               │   │  │
        │  │  └──────────────┴───────────────┘   │  │
        │  │                                      │  │
        │  └──────────────────────────────────────┘  │
        │                                            │
        │  Colors: BLUE/CYAN (#0099ff → #00ffc8)     │
        │  For Ultra would be: PINK/PURPLE (#ff1493) │
        │                                            │
        └────────────────────────────────────────────┘
                             ↓
                    ┌────────┴──────────┐
                    ↓                   ↓
        ┌─────────────────┐    ┌──────────────────┐
        │  CLICK UPGRADE  │    │  CLICK BACK HOME │
        │      NOW        │    │                  │
        └────────┬────────┘    └────────┬─────────┘
                 ↓                      ↓
        ┌─────────────────┐    ┌──────────────────┐
        │ Redirect to:    │    │ Redirect to:     │
        │ /upgrade.html   │    │ /upload.html     │
        │                 │    │                  │
        │ Shows plans,    │    │ Back to free     │
        │ pricing,        │    │ upload interface │
        │ payment options │    │                  │
        └─────────────────┘    └──────────────────┘
```

---

## 6. Security Validation Points

```
REQUEST: User tries to upload file to Platinum storage

┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION POINT 1                          │
│              Frontend (platinum-ui-upload.html)                │
│                                                                 │
│  Check: Is sessionStorage.premiumToken present?               │
│  If NO: Can't make API call, authorization failed at load     │
│  If YES: Continue to Point 2                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION POINT 2                          │
│              API Call Headers (Frontend)                       │
│                                                                 │
│  Headers sent:                                                  │
│  - Authorization: Bearer [JWT from localStorage.token]        │
│  - X-Plan-Token: [premium token from sessionStorage]          │
│                                                                 │
│  Server receives both tokens and validates both              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION POINT 3                          │
│              Backend - JWT Verification                        │
│                                                                 │
│  Endpoint middleware checks:                                   │
│  - JWT signature valid                                        │
│  - JWT not expired (2h max)                                   │
│  - User exists in database                                    │
│                                                                 │
│  If any fail → Return 401 Unauthorized                        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION POINT 4                          │
│              Backend - Premium Token Verification              │
│                                                                 │
│  Check premium token against support/tokens.json:            │
│  - Token exists                                               │
│  - Token belongs to requesting user                           │
│  - Token is active (not revoked)                              │
│  - Token not expired                                          │
│  - Token plan matches resource being accessed                 │
│                                                                 │
│  If any fail → Return 403 Forbidden                           │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    ┌────────┴──────────┐
                    ↓                   ↓
        ┌─────────────────┐    ┌──────────────────┐
        │  ALL VALID      │    │  ANY FAILED      │
        │  ✅ ALLOW       │    │  ❌ DENY         │
        │  Upload file    │    │  Return error    │
        │  to Platinum    │    │  Try again or    │
        │  storage        │    │  login again     │
        │                 │    │                  │
        │  Log entry:     │    │  Log entry:      │
        │  "Platinum-ULd  │    │  "Upload denied  │
        │   upload OK"    │    │   - invalid token"│
        └─────────────────┘    └──────────────────┘
```

---

## 7. Complete Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: URL SECURITY                       │
├─────────────────────────────────────────────────────────────────┤
│  ✅ No tokens in URL search params                             │
│  ✅ No tokens in browser history                               │
│  ✅ No tokens in referrer headers                              │
│  ✅ Clean URLs only: /page.html?uid=123                        │
│  ✅ Prevents: URL sharing, logged tokens, cached URLs          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                LAYER 2: STORAGE SECURITY                       │
├─────────────────────────────────────────────────────────────────┤
│  localStorage:                                                   │
│  ✅ JWT (short-lived, 2h)                                      │
│  ✅ Premium token (refreshed on login)                         │
│  ✗ NOT: Sensitive plan details, payment info                  │
│                                                                 │
│  sessionStorage:                                                │
│  ✅ Temporary tokens (expires on browser close)                │
│  ✅ Session IDs                                                │
│  ✗ NOT: Persisted between sessions                            │
│                                                                 │
│  Prevents: Token theft from disk, session hijacking            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 3: AUTHENTICATION (API)                     │
├─────────────────────────────────────────────────────────────────┤
│  Every API call requires:                                       │
│  ✅ Bearer JWT token (validates user)                          │
│  ✅ Premium token (validates plan access)                      │
│  ✅ Token signatures verified                                  │
│  ✅ Token expiration checked                                   │
│  ✅ User existence confirmed                                   │
│                                                                 │
│  Prevents: Unauthorized API access, token reuse                │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│            LAYER 4: AUTHORIZATION (PLAN ACCESS)                │
├─────────────────────────────────────────────────────────────────┤
│  On plan page load:                                             │
│  ✅ Check active purchase in database                          │
│  ✅ Verify status = "completed"                                │
│  ✅ Verify isActive = true                                     │
│  ✅ Verify expiration not passed                               │
│  ✅ Return valid token only if all pass                        │
│                                                                 │
│  Prevents: Accessing plans without purchase                    │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│           LAYER 5: RESOURCE PROTECTION (Backend)               │
├─────────────────────────────────────────────────────────────────┤
│  All platinum/ultra resources protected:                        │
│  ✅ midleware checks req.user is authenticated                 │
│  ✅ Verify user owns the resource                              │
│  ✅ Verify user's plan includes this feature                   │
│  ✅ Log all access for audit trail                             │
│                                                                 │
│  Prevents: Cross-user access, feature misuse                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│        LAYER 6: USER INTERFACE (Frontend Guards)               │
├─────────────────────────────────────────────────────────────────┤
│  Unauthorized Modal displays when:                              │
│  ✅ Authorization check fails                                  │
│  ✅ Plan not active or expired                                 │
│  ✅ Token invalid/missing                                      │
│  ✅ Prevents user from accessing features                      │
│                                                                 │
│  Prevents: Accidental misuse, better UX                        │
└─────────────────────────────────────────────────────────────────┘

Result: 6-layer security ensures only authorized users with 
active plans can access premium features. Multi-point validation
prevents exploitation of any single layer.
```

---

## Summary

This complete system provides:
- ✅ **Secure token handling** (hidden from URLs, limited lifetime)
- ✅ **Real-time authorization** (backend validates every request)
- ✅ **Beautiful UX** (modals guide unauthorized users)
- ✅ **Production-ready** (comprehensive error handling)
- ✅ **Audit trail** (all actions logged)

**Result: Professional payment & access system! 🚀**
