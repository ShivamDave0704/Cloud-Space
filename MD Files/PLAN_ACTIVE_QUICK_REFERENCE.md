# ✅ PLAN-ACTIVE.JSON - QUICK REFERENCE

## 🎯 What You Got

A JSON file showing **all users with all their plans and complete details**:
- User info (uid, email, username)
- All plans they purchased
- Plan details (storage, duration, features)
- Transaction info (ID, payment method, amount, dates)
- Plan status (active, blocked)
- User summary (total plans, spent, storage)

---

## 📁 FILE LOCATION
```
/support/plan-active.json
```

---

## 📋 FILE STRUCTURE

```
[User 1]
  ├─ self: { uid, email, username }
  ├─ plans: [
  │   ├─ Plan 1: { plan, planDetails, transaction, status }
  │   ├─ Plan 2: { plan, planDetails, transaction, status }
  │   └─ ...
  │ ]
  └─ summary: { totalPlans, activePlans, blockedPlans, totalSpent, ... }

[User 2]
  ├─ self: { ... }
  ├─ plans: [ ... ]
  └─ summary: { ... }
```

---

## 🎁 WHAT'S INCLUDED PER USER

✅ **User Information**
```json
"self": {
  "uid": "USR-G5ZX1E2Q",
  "email": "email@example.com",
  "username": "Full Name"
}
```

✅ **All Plans** (with all details)
```json
"plans": [
  {
    "plan": "silver",           // Plan name
    "planDetails": {            // Plan specs
      "storage": 5,
      "storageTB": 5,
      "durationDays": 30,
      "maxUploadSize": "500MB",
      "features": ["5GB Storage", "30 Day Duration"]
    },
    "transaction": {            // Payment details
      "transactionId": "...",
      "paymentMethod": "qr",
      "amount": 500,            // Original price
      "finalAmount": 300,       // What they paid
      "amountDiscount": 200,    // Discount amount
      "purchasedAt": "...",
      "activatedAt": "...",
      "expiresAt": "..."
    },
    "status": {                 // Current status
      "isActive": true,
      "isBlocked": false
    }
  }
]
```

✅ **User Summary**
```json
"summary": {
  "totalPlans": 2,            // How many plans bought
  "activePlans": 2,           // How many active now
  "blockedPlans": 0,
  "totalSpent": 1499.40,
  "totalDiscount": 999.60,
  "totalStorageTB": 25
}
```

---

## 🚀 API ENDPOINTS

### Get All Users' Plans
```
GET /api/plan-active
```

### Get One User's Plans
```
GET /api/plan-active/USR-G5ZX1E2Q
```

---

## 💻 USAGE

### See File Content
```bash
node test-plan-active.cjs
```

### Use in JavaScript
```javascript
// All users
const response = await fetch('/api/plan-active');
const { data } = await response.json();

// One user
const response = await fetch('/api/plan-active/USR-G5ZX1E2Q');
const { data } = await response.json();

console.log(data.self.username);           // User name
console.log(data.summary.totalPlans);      // Plans count
console.log(data.summary.activePlans);     // Active count
console.log(data.summary.totalStorageTB);  // Storage
console.log(data.summary.totalSpent);      // Amount spent

// Loop through plans
data.plans.forEach(plan => {
  console.log(`${plan.plan}: ${plan.transaction.finalAmount}`);
});
```

---

## 📊 EXAMPLE OUTPUT

```
User: Shivam Dave
├─ UID: USR-G5ZX1E2Q
├─ Email: shivamdave.0704@gmail.com
├─ Plans: 2
├─ Active Plans: 2
├─ Blocked Plans: 0
├─ Total Storage: 25 TB
├─ Total Spent: ₹1,499.40
└─ Total Discount: ₹999.60

Plans:
1. SILVER
   ├─ Storage: 5 GB
   ├─ Duration: 30 days
   ├─ Status: ✅ ACTIVE
   ├─ Price: ₹300 (was ₹500, saved ₹200)
   └─ Expires: 29/1/2026

2. GOLD
   ├─ Storage: 20 GB
   ├─ Duration: 90 days
   ├─ Status: ✅ ACTIVE
   ├─ Price: ₹1,199.40 (was ₹1,999, saved ₹799.60)
   └─ Expires: 30/3/2026
```

---

## ✨ KEY FEATURES

✅ **Complete User View** - All plans for each user  
✅ **Plan Details** - Storage, duration, features, etc.  
✅ **Transaction Info** - Payment details, amounts, discounts  
✅ **Status Tracking** - Active/blocked with reasons  
✅ **Automatic** - Generated from purchases.json  
✅ **Real-time** - Updates when purchases change  
✅ **API Access** - Two endpoints for easy access  
✅ **Organized** - User-centric structure  

---

## 🔄 How It Works

```
purchases.json (raw purchase records)
         ↓
generatePlanActiveData() (groups by user)
         ↓
plan-active.json (user-organized view)
         ↓
/api/plan-active endpoints
         ↓
Your application
```

---

## 📊 REAL EXAMPLE DATA

### From File
```json
{
  "self": {
    "uid": "USR-G5ZX1E2Q",
    "email": "shivamdave.0704@gmail.com",
    "username": "Shivam Dave"
  },
  "plans": [
    {
      "plan": "silver",
      "planDetails": {
        "storage": 5,
        "storageTB": 5,
        "durationDays": 30,
        "maxUploadSize": "500MB",
        "features": ["5GB Storage", "30 Day Duration"]
      },
      "transaction": {
        "transactionId": "b0bbea3e-85f4-45eb-a334-b8909679e414",
        "paymentMethod": "qr",
        "amount": 500,
        "finalAmount": 300,
        "amountDiscount": 200,
        "purchasedAt": "2025-12-30T13:23:11.971Z",
        "expiresAt": "2026-01-29T13:23:11.971Z"
      },
      "status": {
        "isActive": true,
        "isBlocked": false
      }
    },
    {
      "plan": "gold",
      "planDetails": {
        "storage": 20,
        "storageTB": 20,
        "durationDays": 90,
        "maxUploadSize": "2GB",
        "features": ["20GB Storage", "90 Day Duration", "Priority Support"]
      },
      "transaction": {
        "transactionId": "7a0b1d68-35f4-45fc-9a5f-e772c6717983",
        "paymentMethod": "qr",
        "amount": 1999,
        "finalAmount": 1199.4,
        "amountDiscount": 799.6,
        "purchasedAt": "2025-12-30T14:23:08.420Z",
        "expiresAt": "2026-03-30T14:23:08.420Z"
      },
      "status": {
        "isActive": true,
        "isBlocked": false
      }
    }
  ],
  "summary": {
    "totalPlans": 2,
    "activePlans": 2,
    "blockedPlans": 0,
    "totalSpent": 1499.4,
    "totalDiscount": 999.6,
    "totalStorageTB": 25
  }
}
```

---

## 🧪 TEST IT

### Run Test Script
```bash
node test-plan-active.cjs
```

Shows all users, plans, transactions, and status

---

## 📝 USE CASES

**User Dashboard**  
→ Show user their active plans, expiry dates, storage

**Admin Panel**  
→ View all users with plan stats

**Plan Management**  
→ Check plan status, expiry, blocking

**Reports**  
→ Revenue by plan, user stats, etc

**Renewal System**  
→ Find expiring plans, send reminders

---

## 🎊 SUMMARY

✅ **File Created**: `/support/plan-active.json`  
✅ **Size**: ~2.5 KB per user  
✅ **Updated**: Auto-generated on server startup  
✅ **Access**: Via API endpoints or direct file read  
✅ **Contains**: User info, plans, transactions, status, summary  
✅ **Features**: 20+ fields per plan  

---

**Status**: ✅ COMPLETE & WORKING  
**Test**: `node test-plan-active.cjs`  
**View**: GET `/api/plan-active` or `/api/plan-active/:uid`
