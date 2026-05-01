# 📊 USER PURCHASE SUMMARY - API Documentation

## Overview

The system now includes **user-level purchase aggregation** that tracks:
- **Total Payments Done** by any user ID
- **Active Plans** for that user
- Complete breakdown of all purchases and statistics

---

## 🎯 What's New

### Two New Endpoints

#### 1. **GET /purchases/:uid** (Enhanced)
**Quick summary of user purchases**

```
GET http://localhost:5000/purchases/:uid
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalPayments": 2,      ← HOW MANY PAYMENTS DONE
    "activePlans": 2,        ← HOW MANY PLANS ACTIVE
    "totalSpent": 1499.40
  },
  "purchases": [
    {
      "_id": "PURCHASE-1767100991971",
      "uid": "USR-G5ZX1E2Q",
      "plan": "silver",
      "finalAmount": 300,
      "status": "completed",
      "isActive": true,
      ...more fields
    },
    ...more purchases
  ]
}
```

---

#### 2. **GET /purchases/:uid/summary** (New)
**Detailed user statistics and breakdown**

```
GET http://localhost:5000/purchases/:uid/summary
```

**Response:**
```json
{
  "success": true,
  "uid": "USR-G5ZX1E2Q",
  "totalPayments": 2,              ← TOTAL PAYMENTS
  "activePlans": 2,               ← ACTIVE PLANS
  "completedPayments": 2,
  "pendingPayments": 0,
  "blockedPlans": 0,
  "totalSpent": 1499.40,
  "totalDiscount": 999.60,
  "planBreakdown": {
    "silver": {
      "count": 1,                  ← Purchased 1 time
      "active": 1,                 ← 1 active
      "totalSpent": 300.00,
      "lastExpiry": "2026-01-29T13:23:11.971Z"
    },
    "gold": {
      "count": 1,
      "active": 1,
      "totalSpent": 1199.40,
      "lastExpiry": "2026-03-30T14:23:08.420Z"
    }
  },
  "purchases": [...]  ← Last 10 purchases
}
```

---

## 📊 Data Returned

### Summary Object
```javascript
{
  totalPayments: Number,           // Total # of times user purchased
  activePlans: Number,             // # of currently active plans
  completedPayments: Number,       // # of completed/verified purchases
  pendingPayments: Number,         // # awaiting verification
  blockedPlans: Number,            // # of blocked purchases
  totalSpent: Number,              // Total amount paid (final amount)
  totalDiscount: Number,           // Total discount given
  planBreakdown: Object            // Breakdown by plan type
}
```

### Plan Breakdown Object
```javascript
{
  "silver": {
    count: Number,                 // How many times purchased
    active: Number,                // Currently active
    totalSpent: Number,            // Total spent on this plan
    lastExpiry: String             // ISO date of last expiry
  },
  "gold": { ... },
  "platinum": { ... },
  "ultra": { ... }
}
```

---

## 💻 Example Usage

### JavaScript/Node.js

```javascript
// Using Fetch API
const uid = "USR-G5ZX1E2Q";
const token = "your_jwt_token";

// Get quick summary
const response = await fetch(`/purchases/${uid}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

console.log(`User has made ${data.summary.totalPayments} payments`);
console.log(`Currently has ${data.summary.activePlans} active plans`);
console.log(`Total spent: ₹${data.summary.totalSpent}`);

// Get detailed summary
const detailedResponse = await fetch(`/purchases/${uid}/summary`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const detailed = await detailedResponse.json();

console.log('Plan breakdown:');
Object.entries(detailed.planBreakdown).forEach(([plan, info]) => {
  console.log(`${plan}: ${info.count} purchased, ${info.active} active`);
});
```

---

## 🔐 Authentication

Both endpoints require:
- **JWT Token** in Authorization header
- User can only access their own data
- Admin can access any user's data

```
Header: Authorization: Bearer <token>
```

---

## 📈 Use Cases

### 1. **User Dashboard - Show Purchase History**
```javascript
// Display user's total payments and active plans
const { summary, purchases } = await getUSERPurchases(uid);

console.log(`You have made ${summary.totalPayments} payments`);
console.log(`You have ${summary.activePlans} active plans`);
console.log(`Total spent: ₹${summary.totalSpent}`);
```

### 2. **Admin Panel - User Statistics**
```javascript
// Show admin comprehensive user stats
const stats = await getUSERSummary(uid);

// Identify valuable customers
const isValuable = stats.totalPayments >= 3 && stats.totalSpent >= 5000;

// Check for suspicious activity
const isBlocked = stats.blockedPlans > 0;
const isPending = stats.pendingPayments > 0;
```

### 3. **Loyalty System**
```javascript
// Reward users based on payment count
const { totalPayments } = await getUSERSummary(uid);

if (totalPayments >= 5) {
  applyLoyaltyReward(uid, 'vip');
} else if (totalPayments >= 3) {
  applyLoyaltyReward(uid, 'gold');
}
```

### 4. **Plan Expiry Warnings**
```javascript
// Check which plans are expiring soon
const { planBreakdown } = await getUSERSummary(uid);

Object.entries(planBreakdown).forEach(([plan, info]) => {
  const expiryDate = new Date(info.lastExpiry);
  const daysLeft = Math.ceil((expiryDate - new Date()) / (1000*60*60*24));
  
  if (daysLeft <= 7) {
    sendRenewalReminder(uid, plan, daysLeft);
  }
});
```

---

## 🧪 Testing

### Run Test Script
```bash
node test-user-summary.cjs
```

### Manual Testing with cURL
```bash
# Get user purchases with summary
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/purchases/USR-G5ZX1E2Q

# Get detailed summary
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/purchases/USR-G5ZX1E2Q/summary
```

---

## 📊 Sample Output

From test script (test-user-summary.cjs):

```
👤 User ID: USR-G5ZX1E2Q
   Email: shivamdave.0704@gmail.com
   Name: Shivam Dave
   💳 Total Payments Done: 2
   ✅ Active Plans: 2
   💰 Total Spent: ₹1499.40
   📋 Plans Purchased: silver, gold

📊 PAYMENT STATISTICS:
   💳 Total Payments Done: 2
   ✅ Completed Payments: 2
   ⏳ Pending Payments: 0
   🚫 Blocked Plans: 0
   💰 Total Spent: ₹1499.40
   🎁 Total Discount: ₹999.60

📋 PLAN BREAKDOWN:
   SILVER
      • Purchased: 1 time(s)
      • Active: 1
      • Total Spent: ₹300.00
      • Last Expiry: 2026-01-29 (30 days left)
   GOLD
      • Purchased: 1 time(s)
      • Active: 1
      • Total Spent: ₹1199.40
      • Last Expiry: 2026-03-30 (90 days left)
```

---

## 🔍 API Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Data returned |
| 400 | Bad Request | Missing UID parameter |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Accessing other user's data |
| 404 | Not Found | User not found |
| 500 | Server Error | Database issue |

---

## 🎯 Implementation Details

### How It Works

1. **Request comes in** with user ID
2. **Filter purchases.json** for all records matching that UID
3. **Calculate statistics**:
   - Count total payments
   - Count active (not blocked, isActive=true) plans
   - Sum final amounts
   - Sum discounts
   - Group by plan type
4. **Return summary** with full purchase list

### Performance
- ✅ Fast JSON filtering
- ✅ Single file read operation
- ✅ Handles unlimited purchase history
- ✅ Scales to 1000s of users

---

## 📝 Integration Example

### Adding to Frontend Dashboard

```html
<div class="user-stats">
  <div class="stat-card">
    <h3>💳 Total Payments</h3>
    <p class="stat-value" id="totalPayments">0</p>
  </div>
  <div class="stat-card">
    <h3>✅ Active Plans</h3>
    <p class="stat-value" id="activePlans">0</p>
  </div>
  <div class="stat-card">
    <h3>💰 Total Spent</h3>
    <p class="stat-value" id="totalSpent">₹0</p>
  </div>
</div>

<script>
  const uid = localStorage.getItem('uid');
  const token = localStorage.getItem('token');

  fetch(`/purchases/${uid}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(data => {
    document.getElementById('totalPayments').textContent = data.summary.totalPayments;
    document.getElementById('activePlans').textContent = data.summary.activePlans;
    document.getElementById('totalSpent').textContent = 
      '₹' + data.summary.totalSpent.toFixed(2);
  });
</script>
```

---

## ✨ Key Features

✅ **Automatic Aggregation** - No manual calculation needed
✅ **Real-time Data** - Updates as purchases are made
✅ **User Isolation** - Users see only their data
✅ **Plan Breakdown** - See stats by each plan type
✅ **Admin Access** - Admins can view any user
✅ **Scalable** - Handles unlimited purchase history
✅ **Immutable** - Historical data never changes

---

## 🚀 Ready to Use

Both endpoints are **live now** and ready for:
- User dashboards
- Admin statistics
- Loyalty programs
- Renewal reminders
- Payment analytics
- Customer insights

---

## 📚 Related Documentation

- [PURCHASE_TRACKING_SYSTEM.md](PURCHASE_TRACKING_SYSTEM.md) - Full system reference
- [PURCHASE_QUICK_REFERENCE.md](PURCHASE_QUICK_REFERENCE.md) - Quick answers
- [START_HERE.md](START_HERE.md) - Getting started

---

**Version**: 1.0  
**Status**: ✅ Production Ready  
**Last Updated**: December 30, 2025
