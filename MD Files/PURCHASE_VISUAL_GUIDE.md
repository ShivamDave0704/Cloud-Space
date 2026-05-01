# 📊 Purchase Tracking System - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CloudSpace+ Payment Flow                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  PAYMENT METHODS │
└──────────────────┘
        │
        ├─────────────────────────────────────────────┐
        │                                             │
        ▼                                             ▼
    ┌────────────┐                            ┌──────────────┐
    │ Card Pay   │                            │ Proof Upload │
    │ (Instant)  │                            │  (Verify)    │
    └────────────┘                            └──────────────┘
        │                                             │
        ▼                                             ▼
    /process-card                          /submit-proof
        │                                             │
        ▼                                             ▼
    Status:                                 Status:
    COMPLETED                              PENDING_VERIFICATION
    Plan: ACTIVE                           Plan: INACTIVE
        │                                             │
        └──────────────────┬──────────────────────────┘
                           │
                           ▼
                   ┌───────────────────┐
                   │ Purchase Record   │
                   │ Logged to JSON    │
                   └───────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   [Admin Approved]  [User Views]      [Analytics]
   /admin/update-    /purchases/:uid   /admin/purchase-stats
   status             │                     │
        │             ▼                     ▼
        │        Shows Purchase         Revenue Report
        │        History                Plan Breakdown
        │                              Payment Methods
        ▼
    Status: COMPLETED
    activatedAt: Set
    Plan: ACTIVE
```

## Database Structure

```
/support/payments/purchases.json
│
├─ [0] {
│   _id: "PURCHASE-1703020800000",
│   uid: "user-uuid-1",
│   email: "user@example.com",
│   username: "john_doe",
│   plan: "platinum",
│   amount: 4199,
│   finalAmount: 2519,
│   discountApplied: 40,
│   currency: "INR",
│   paymentMethod: "card",
│   cardLast4: "4242",
│   status: "completed",
│   purchasedAt: "2024-12-20T10:00:00Z",
│   activatedAt: "2024-12-20T10:05:00Z",
│   expiresAt: "2025-06-20T10:00:00Z",
│   durationDays: 180,
│   storageTB: 100,
│   transactionId: "CARD-1703020800000",
│   isActive: true,
│   isBlocked: false,
│   blockedReason: null,
│   blockedAt: null
│ }
│
├─ [1] { ... },
├─ [2] { ... }
└─ [...]
```

## Plan Pricing Matrix

```
┌─────────────┬─────────┬──────────┬───────────┬─────────────┐
│   PLAN      │ PRICE   │ STORAGE  │ DURATION  │ API CALLS   │
├─────────────┼─────────┼──────────┼───────────┼─────────────┤
│ FREE        │ ₹0      │ 1 GB     │ Forever   │ API        │
│ SILVER      │ ₹500    │ 5 GB     │ 30 days   │ API        │
│ GOLD        │ ₹1,999  │ 20 GB    │ 90 days   │ API        │
│ PLATINUM    │ ₹4,199  │ 100 GB   │ 180 days  │ API        │
│ ULTRA       │ ₹6,999  │ 200 GB   │ 180 days  │ API        │
└─────────────┴─────────┴──────────┴───────────┴─────────────┘
```

## Admin Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│           💎 PURCHASE MANAGEMENT DASHBOARD                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┬──────────────┬──────────┬──────────┐       │
│  │ Total       │ Revenue      │ Active   │ Blocked  │       │
│  │ Purchases   │              │ Plans    │ Plans    │       │
│  │     150     │ ₹500,000     │   120    │    5     │       │
│  └─────────────┴──────────────┴──────────┴──────────┘       │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Filters:  [Plan ▼] [Status ▼] [Search] [Apply] [Refresh]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User      │ Email        │ Plan      │ Amount │ Payment    │
│─────────────────────────────────────────────────────────────│
│ john_doe   │john@ex.com   │ PLATINUM  │ ₹2519  │ Card       │
│ jane_smith │jane@ex.com   │ ULTRA     │ ₹4199  │ Proof      │
│ mike_ross  │mike@ex.com   │ GOLD      │ ₹1199  │ Card       │
│            │              │           │        │            │
│  [Block]   │              │           │        │ [Unblock]  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoint Hierarchy

```
/
├── PAYMENTS (Public)
│   ├── POST /process-card (Pay by card)
│   ├── POST /submit-proof (Submit proof)
│   └── GET /check-status (Check proof status)
│
├── PURCHASES (User)
│   └── GET /purchases/:uid (Get my purchases)
│
└── ADMIN (Admin-only)
    ├── GET /admin/purchases (All purchases)
    ├── GET /admin/purchase-stats (Statistics)
    ├── GET /admin/proofs (All proofs)
    ├── POST /admin/update-status (Approve proof)
    ├── POST /admin/block-plan (Block plan)
    └── POST /admin/unblock-plan (Unblock plan)
```

## Status Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                  PURCHASE STATUS FLOW                        │
└─────────────────────────────────────────────────────────────┘

CARD PAYMENT:
────────────
pending ──────────────────► completed ──┐
    (init)              (immediate)      │
                                         ├──► active ──► expired
                                         │
PROOF-BASED:                             │
────────────                             │
pending ──────────────────► pending_ver──┤
(init)              (awaiting)            │
                         │               │
                         ▼               │
                    reviewed ────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    approved          rejected          blocked
   (activate)        (discard)         (revoke)
        │                │                │
        ▼                ▼                ▼
    active            failed           revoked
    (plan on)      (plan off)        (plan off)
        │
        ▼
    expired
    (plan off)
```

## Purchase Record Lifecycle

```
TIME ──────────────────────────────────────────────────────────►

  [CREATE]
    │ User initiates payment
    ▼
  [PROCESS]
    │ Payment validated
    │ (by card or proof)
    ▼
  [LOG]
    │ Record created in JSON
    │ Status: completed or pending_verification
    ▼
  [ACTIVATE or WAIT]
    │ If card: activated immediately
    │ If proof: awaits admin approval
    ▼
  [ACTIVATE]
    │ Admin approves (for proof)
    │ Plan activated
    │ Email sent
    ▼
  [ACTIVE]
    │ User enjoys premium features
    │ Storage increased
    │ Special UI access (if ultra)
    ▼
  [MONITOR]
    │ Check expiry date
    │ Send renewal reminders
    ▼
  [EXPIRE]
    │ Date reached
    │ Plan reverts to free
    ▼
  [END]
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         DATA FLOW                             │
└──────────────────────────────────────────────────────────────┘

Frontend (Client)
    │
    ├─ POST /process-card
    │   └─────────────────────────┐
    │                             │
    ├─ POST /submit-proof         │
    │   └────────┐                │
    │            │                │
    └────────────┼────────────────┘
                 │
                 ▼
            server.js
                 │
        ┌────────┼────────┬────────────┐
        │        │        │            │
        ▼        ▼        ▼            ▼
      users    proofs  purchases    uploads
      .json    .json    .json         /
        │        │        │            │
        │        │        ▼            │
        │        │    logPurchase()    │
        │        │        │            │
        │        └────────┼────────────┘
        │                 │
        ▼                 ▼
   User Plan Info    Purchase Record
   (created/updated) (logged/updated)
```

## Statistics Breakdown

```
TOTAL REVENUE: ₹500,000
├─ By Plan:
│  ├─ Silver: 20 × ₹500 = ₹10,000 (2%)
│  ├─ Gold: 50 × ₹1,999 = ₹99,950 (20%)
│  ├─ Platinum: 60 × ₹4,199 = ₹251,940 (50%)
│  └─ Ultra: 20 × ₹6,999 = ₹139,980 (28%)
│
├─ By Payment Method:
│  ├─ Card: 80 purchases (80%)
│  ├─ Proof: 50 purchases (50%)
│  ├─ UPI: 15 purchases (15%)
│  └─ QR: 5 purchases (5%)
│
└─ By Status:
   ├─ Completed: 130 (87%)
   ├─ Pending: 15 (10%)
   └─ Failed: 5 (3%)
```

## File Size Estimation

```
As purchases grow:

10 purchases    ≈  12 KB
100 purchases   ≈  120 KB
1,000 purchases ≈  1.2 MB
10,000 purchases ≈ 12 MB

Each record ≈ 1.2 KB (with full data)
```

## Integration Points

```
PAYMENT SYSTEM          ──┐
  payment4.html            │
  upload.html              ├──► server.js ──┐
  platinum-upload.html     │                 │
                          ┘                 ├──► purchases.json
                                             │
ADMIN SYSTEM                                 │
  admin-purchases.html ──┐                   │
  admin.html             ├──► server.js ─────┘
  admin-purchases-api    │

USER SYSTEM
  upload.html ──────────┐
  files.html            ├──► server.js (GET /purchases/:uid)
  account.html          │
```

## Security Architecture

```
REQUEST comes in
    │
    ▼
Middleware (CORS, JSON parser)
    │
    ▼
Authentication Check (JWT)
    │
    ├─ ❌ Invalid/Missing ──► 401 Unauthorized
    │
    ▼
Authorization Check (Is admin?)
    │
    ├─ ❌ Not admin ──► 403 Forbidden (for admin endpoints)
    │
    ▼
Process Request
    │
    ▼
Log to purchases.json (if payment)
    │
    ▼
Return Response
```

---

This visual guide complements the technical documentation for quick understanding of the system architecture and flow!
