# 🪙 Admin Coins Management - Visual Architecture

## System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     ADMIN PRIVACY PAGE                           │
│              (public/admin-privacy.html)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         🪙 Cloud Coins Management Section              │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Current Balance: [💰 300 coins] ◄── loadUserCoins...  │    │
│  │                                                          │    │
│  │  Adjust Coins:    [    100    ]                         │    │
│  │  Reason:          [   bonus   ]                         │    │
│  │                                                          │    │
│  │  [💰 Adjust Coins Button] ──► adjustUserCoins()       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                    │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                   adjustUserCoins() calls
                               │
                    POST /api/admin/coins/adjust
                     {userUID, amount, reason}
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EXPRESS.JS BACKEND                          │
│                    (server-admin.js)                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  POST /api/admin/coins/adjust                          │     │
│  │  (Lines 1467-1535)                                     │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │                                                         │     │
│  │  1. Verify token & Admin role                         │     │
│  │  2. Extract: userUID, amount, reason                  │     │
│  │  3. Read: cloud-coins.json file                       │     │
│  │  4. Find: user by userUID (or create new)             │     │
│  │  5. Update: balance = oldBalance + amount             │     │
│  │  6. Record: transaction with timestamp                │     │
│  │  7. Write: updated JSON to file                       │     │
│  │  8. Return: success response                          │     │
│  │                                                         │     │
│  └────────────────────────────────────────────────────────┘     │
│                          │                                        │
│                          ▼                                        │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  GET /api/admin/coins                                 │     │
│  │  (Lines 1449-1465)                                     │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  - Verify token & Admin role                          │     │
│  │  - Read: cloud-coins.json file                        │     │
│  │  - Return: Array of all coin records                  │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                    │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                      Reads & Writes to
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   PERSISTENT STORAGE                             │
│              (support/coins/cloud-coins.json)                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [                                                                │
│    {                                                              │
│      "userUID": "USR-0OSPHMPK",                                  │
│      "email": "shivamdave.0704@gmail.com",                       │
│      "username": "Dave Shivam",                                  │
│      "balance": 400,                                             │
│      "transactions": [                                            │
│        {                                                          │
│          "id": "ADMIN-ABC123XYZ",                                │
│          "type": "admin_adjustment",                             │
│          "amount": 100,                                          │
│          "reason": "Loyalty bonus",                              │
│          "timestamp": "2026-01-30T11:45:00Z"                     │
│        }                                                          │
│      ]                                                            │
│    }                                                              │
│  ]                                                                │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
ADMIN INTERFACE              API REQUEST              BACKEND          FILE STORAGE
─────────────────────────────────────────────────────────────────────────────────

User opens              
admin-privacy.html    
    │                
    │ Edit User       
    ├──────────────────► loadUserCoinsBalance()     
    │                                 │
    │                                 ├──────────────► GET /api/admin/coins
    │                                 │                    │
    │                                 │                    ├─► Read cloud-coins.json
    │                                 │                    │
    │                                 │◄───────────── Parse & Find User
    │                                 │
    │◄───────────────────────────────┤
    │
    │ Display Balance: 💰 200
    │
    │ Enter: Amount = 100
    │ Enter: Reason = "Bonus"
    │
    │ Click "Adjust Coins"
    │
    ├──────────────────► adjustUserCoins()
    │                           │
    │                           ├──────────────► POST /api/admin/coins/adjust
    │                           │                {userUID, amount, reason}
    │                           │                    │
    │                           │                    ├─► Validate inputs
    │                           │                    │
    │                           │                    ├─► Read cloud-coins.json
    │                           │                    │
    │                           │                    ├─► Find user by UID
    │                           │                    │
    │                           │                    ├─► Update balance
    │                           │                    │    (200 + 100 = 300)
    │                           │                    │
    │                           │                    ├─► Add transaction record
    │                           │                    │
    │                           │                    ├──► Write cloud-coins.json
    │                           │                    │     with new balance: 300
    │                           │                    │
    │                           │◄───────────── Return 200 OK
    │                           │                {balance: 300}
    │                           │
    │◄───────────────────────────┤
    │
    │ Show: ✅ Success
    │ Clear: Input fields
    │
    │ loadUserCoinsBalance()
    │ (refresh balance)
    │        │
    │        ├──────────────► GET /api/admin/coins
    │        │                    │
    │        │                    ├──► Read updated cloud-coins.json
    │        │                    │
    │        │◄───────────────────┤
    │
    │ Display: 💰 300 coins
    │ (auto-updated!)
    │
```

---

## File Relationships

```
PUBLIC FRONTEND
│
├─ admin-privacy.html
│  ├─ HTML: Coins Management section (lines 860-874)
│  ├─ JS: adjustUserCoins() (lines 2121-2165)
│  └─ JS: loadUserCoinsBalance() (lines 2171-2195)
│
└─ [Calls API endpoints]
     │
     └──► BACKEND
          │
          ├─ server-admin.js
          │  ├─ GET /api/admin/coins (lines 1449-1465)
          │  └─ POST /api/admin/coins/adjust (lines 1467-1535)
          │
          └──► STORAGE
               │
               └─ support/coins/cloud-coins.json
                  └─ [Array of coin records with balances]
```

---

## Request/Response Format

### 1️⃣ Load Balance Request
```javascript
// frontend sends
GET /api/admin/coins
Authorization: Bearer [token]

// backend returns
[
  {userUID: "USR-001", balance: 200, ...},
  {userUID: "USR-002", balance: 150, ...}
]

// frontend filters and displays
💰 200 coins
```

### 2️⃣ Adjust Coins Request
```javascript
// frontend sends
POST /api/admin/coins/adjust
Authorization: Bearer [token]
Content-Type: application/json

{
  "userUID": "USR-001",
  "amount": 100,
  "reason": "Loyalty bonus"
}

// backend processes
1. Reads file: [userUID: "USR-001", balance: 200]
2. Updates: balance = 200 + 100 = 300
3. Records: {id: "ADMIN-...", amount: 100, reason: "..."}
4. Writes file: [userUID: "USR-001", balance: 300, transactions: [...]
5. Returns response

// backend returns
{
  "success": true,
  "message": "Coins adjusted: 200 → 300",
  "user": {
    "userUID": "USR-001",
    "balance": 300,
    "transactions": [...]
  }
}

// frontend displays
✅ Coins adjusted: 200 → 300
[Auto-refresh balance]
```

---

## State Changes

```
INITIAL STATE
────────────
cloud-coins.json:
{
  userUID: "USR-001",
  balance: 200,
  transactions: [...]
}

admin-privacy.html:
Current Balance: [💰 200 coins] (read-only)
Adjust Coins: [empty]
Reason: [empty]


USER ENTERS DATA
────────────────
Adjust Coins: [100]
Reason: [Loyalty bonus]


BUTTON CLICKED
──────────────
adjustUserCoins() → POST /api/admin/coins/adjust


BACKEND PROCESSES
─────────────────
1. Read: balance = 200
2. Calculate: 200 + 100 = 300
3. Record transaction
4. Write new balance: 300


FINAL STATE
───────────
cloud-coins.json:
{
  userUID: "USR-001",
  balance: 300,
  transactions: [
    {...existing...},
    {id: "ADMIN-ABC", amount: 100, reason: "Loyalty bonus"}
  ]
}

admin-privacy.html:
Current Balance: [💰 300 coins] (auto-updated!)
Adjust Coins: [empty] (cleared)
Reason: [empty] (cleared)
✅ Success message shown!
```

---

## Component Interactions

```
                    ADMIN INTERFACE
                          │
                   ┌──────┴──────┐
                   │             │
            Click Edit    Coins Section
                   │             │
                   ▼             ▼
           Show User Modal    Load Balance
                   │             │
                   │        [GET /api/admin/coins]
                   │             │
                   │        Find user by UID
                   │             │
                   │       Display balance
                   │
            Enter Adjustment
                   │
            Click Adjust Button
                   │
                   ▼
          adjustUserCoins()
                   │
           [POST /api/admin/coins/adjust]
                   │
                   ▼
          BACKEND PROCESSING
                   │
         Read → Find → Update → Record → Write
                   │
                   ▼
          [cloud-coins.json updated]
                   │
                   ▼
          Return Success Response
                   │
                   ▼
          FRONTEND FEEDBACK
                   │
         ✅ Show Success Message
         Clear Input Fields
         Refresh Balance Display
                   │
                   ▼
          [GET /api/admin/coins] (auto-refresh)
                   │
                   ▼
          Display New Balance: 💰 300 coins
```

---

## Security Layers

```
                REQUEST
                   │
                   ▼
         ┌─────────────────────┐
         │  MIDDLEWARE LAYER   │
         ├─────────────────────┤
         │ 1. verifyToken()    │
         │    - Check JWT      │
         │    - Validate sig   │
         │ 2. isAdmin()        │
         │    - Check role     │
         │    - Verify admin   │
         └─────────────────────┘
                   │
                   ▼ (Authorized)
         ┌─────────────────────┐
         │ VALIDATION LAYER    │
         ├─────────────────────┤
         │ 1. Check userUID    │
         │ 2. Check amount     │
         │ 3. Validate input   │
         │ 4. Prevent negative │
         │    balance          │
         └─────────────────────┘
                   │
                   ▼ (Valid)
         ┌─────────────────────┐
         │  PROCESSING LAYER   │
         ├─────────────────────┤
         │ 1. Read file        │
         │ 2. Find user        │
         │ 3. Update balance   │
         │ 4. Record trans     │
         │ 5. Write file       │
         └─────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │   ERROR HANDLING    │
         ├─────────────────────┤
         │ Try-catch block     │
         │ Log errors          │
         │ Return error msg    │
         └─────────────────────┘
                   │
                   ▼
              RESPONSE
```

---

## Feature Summary

| Aspect | Details |
|--------|---------|
| **Location** | admin-privacy.html + server-admin.js |
| **Endpoints** | GET /api/admin/coins, POST /api/admin/coins/adjust |
| **Auth** | Requires admin token + admin role |
| **Data** | Stored in support/coins/cloud-coins.json |
| **Features** | Add/remove coins, track transactions, auto-save |
| **Validation** | UID check, amount check, balance protection |
| **Feedback** | Success/error messages, auto-refresh |
| **Audit** | Transaction history with timestamps |

---

This system provides a complete, secure, and user-friendly way for admins to manage user coins! 🎉
