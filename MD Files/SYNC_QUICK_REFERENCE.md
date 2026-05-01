# 🔄 Real-Time Sync - Quick Reference

## TL;DR (Too Long; Didn't Read)

**What Changed:**
- API endpoints now generate fresh data from purchases.json on EVERY request
- When purchase.json is updated, plan-active.json auto-regenerates
- Admin can manually sync with POST /admin/sync-plan-active endpoint
- No stale data ever served to users

## Before vs After

### BEFORE (Static Approach)
```
purchases.json → (once at startup) → plan-active.json
                                           ↓
                                      API serves static file
                                      
Problem: Admin changes purchases.json → plan-active.json doesn't update
Solution: Restart server
```

### AFTER (Real-Time Approach)
```
purchases.json → (always generates fresh) → plan-active.json
                                                  ↓
                                            API serves latest data

Admin changes purchases.json → API next request shows updated data ✅
```

---

## Key Changes in server.js

### 1. logPurchase() - Auto-Sync on Purchase
```javascript
// Line ~1570
fs.writeFileSync(purchasesFile, JSON.stringify(purchases, null, 2));

// 🆕 AUTO-SYNC
generatePlanActiveData();  // Regenerates plan-active.json
```

### 2. /admin/update-status - Auto-Sync on Approval
```javascript
// Line ~1992
fs.writeFileSync(purchasesFile, JSON.stringify(purchases, null, 2));

// 🆕 AUTO-SYNC
generatePlanActiveData();  // Regenerates plan-active.json
```

### 3. /api/plan-active - Generate Fresh Data
```javascript
// Line ~2708 (CHANGED)
// BEFORE: Read static plan-active.json file
// AFTER: Generate fresh from purchases.json

let planActiveData = generatePlanActiveData();  // 🆕 LIVE GENERATION
res.json({ success: true, data: planActiveData, ... });
```

### 4. New Admin Endpoint - Manual Sync
```javascript
// Line ~2728 (NEW)
POST /admin/sync-plan-active
→ Manually regenerate plan-active.json
→ Useful if admin directly edits purchases.json
```

---

## Use Cases

### Use Case 1: User Purchases Plan
```
1. User: POST /process-card → buys SILVER plan
2. Server: logPurchase() called → updates purchases.json
3. Server: 🔄 generatePlanActiveData() auto-runs
4. Result: plan-active.json now includes SILVER plan
5. User: GET /api/plan-active/USR-123 → sees SILVER plan ✅
```

### Use Case 2: Admin Approves Payment Proof
```
1. Admin: POST /admin/update-status → approves GOLD plan proof
2. Server: Updates purchase status in purchases.json
3. Server: 🔄 generatePlanActiveData() auto-runs
4. Result: plan-active.json shows GOLD as ACTIVE
5. User: Dashboard updates, storage increased ✅
```

### Use Case 3: Admin Edits JSON Directly
```
1. Admin: Opens purchases.json, changes isBlocked: true
2. Admin: POST /admin/sync-plan-active → manual trigger
3. Server: 🔄 generatePlanActiveData() runs
4. Result: plan-active.json reflects BLOCKED status
5. User: GET /api/plan-active → sees BLOCKED status ✅
```

---

## API Reference

### Endpoint 1: Get All Users' Plans (LIVE)
```
GET /api/plan-active
Authorization: Bearer <JWT>

Response: Array of all users with their plans (generated fresh from purchases.json)
```

### Endpoint 2: Get Specific User's Plans (LIVE)
```
GET /api/plan-active/:uid
Authorization: Bearer <JWT>

Example: GET /api/plan-active/USR-G5ZX1E2Q

Response: Single user object with all their plans (generated fresh from purchases.json)
```

### Endpoint 3: Manual Sync (ADMIN ONLY)
```
POST /admin/sync-plan-active
Authorization: Bearer <JWT>
admin-email: admin@cloudspace.com

Body: {} (empty)

Response: { success: true, message: "...", usersUpdated: N, timestamp: "..." }
```

---

## File Sync Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  purchases.json                          │
│  (Source of Truth - Raw transaction records)            │
│  - Contains 26 fields per purchase                       │
│  - Updated by logPurchase(), admin endpoints            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ generatePlanActiveData() runs when:
                      │ 1️⃣ New purchase created (logPurchase)
                      │ 2️⃣ Admin approves proof (/admin/update-status)
                      │ 3️⃣ Manual admin trigger (/admin/sync-plan-active)
                      │ 4️⃣ Every API request (/api/plan-active)
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   plan-active.json                       │
│  (User-Organized View - Always Fresh)                   │
│  - Contains grouped plans by user                        │
│  - References back to purchases.json via recordId       │
│  - Auto-generated and kept in sync                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ├── /api/plan-active
                      │   └─ Returns all users' plans (LIVE)
                      │
                      └── /api/plan-active/:uid
                          └─ Returns specific user's plans (LIVE)
```

---

## Data Linking Example

### purchases.json
```json
{
  "_id": "PURCHASE-1767100991971",  ← Primary Key
  "uid": "USR-G5ZX1E2Q",
  "plan": "silver",
  "amount": 500,
  "finalAmount": 300,
  "isActive": true,
  ...
}
```

### plan-active.json
```json
{
  "self": { "uid": "USR-G5ZX1E2Q", ... },
  "plans": [
    {
      "plan": "silver",
      "recordId": "PURCHASE-1767100991971",  ← Links back to _id
      ...
    }
  ]
}
```

**Result**: Can always trace from plan-active.json back to source transaction

---

## Testing Commands

### Test 1: Get All Plans
```bash
curl -X GET http://localhost:5000/api/plan-active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 2: Get Specific User
```bash
curl -X GET http://localhost:5000/api/plan-active/USR-G5ZX1E2Q \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 3: Manual Sync
```bash
curl -X POST http://localhost:5000/admin/sync-plan-active \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "admin-email: admin@cloudspace.com" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test 4: Verify Files Match
```bash
# Check purchases.json
cat support/payments/purchases.json | jq '.[] | select(.uid=="USR-G5ZX1E2Q")'

# Check plan-active.json
cat support/plan-active.json | jq '.[] | select(.self.uid=="USR-G5ZX1E2Q")'

# Both should show same user data ✅
```

---

## Status Check

**What's Working:**
- ✅ purchases.json as source of truth
- ✅ Auto-sync after new purchases
- ✅ Auto-sync after admin approvals
- ✅ Live data generation on API requests
- ✅ Manual sync endpoint for edge cases
- ✅ recordId linking between files
- ✅ Automatic plan-active.json updates

**Real-Time Sync Active:**
- ✅ Changes in purchases.json → appear in plan-active.json
- ✅ Admin changes → reflected immediately
- ✅ Users see latest data via API
- ✅ No stale cache issues

---

**Implementation Date**: 2025-12-30
**Status**: ✅ COMPLETE & TESTED
