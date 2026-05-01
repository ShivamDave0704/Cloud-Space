# 🚀 USER PURCHASE SUMMARY - QUICK START

## ⚡ TL;DR

**You asked for**: Count total payments & active plans per user ID  
**You got**: 2 new API endpoints that track everything

---

## 🎯 Two Simple Endpoints

### 1️⃣ Quick View - Purchases with Summary
```
GET /purchases/:uid
```
**Shows**: Basic summary + all purchases  
**Returns**:
```json
{
  "summary": {
    "totalPayments": 2,
    "activePlans": 2,
    "totalSpent": 1499.40
  },
  "purchases": [...]
}
```

### 2️⃣ Detailed View - Complete Statistics
```
GET /purchases/:uid/summary
```
**Shows**: Detailed stats + plan breakdown  
**Returns**:
```json
{
  "totalPayments": 2,
  "activePlans": 2,
  "planBreakdown": {
    "silver": { "count": 1, "active": 1, "totalSpent": 300 },
    "gold": { "count": 1, "active": 1, "totalSpent": 1199.40 }
  },
  ...more data
}
```

---

## 💻 Usage

### Simple JavaScript
```javascript
const uid = "USR-G5ZX1E2Q";
const token = "your_token";

// Get summary
const res = await fetch(`/purchases/${uid}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await res.json();

console.log(data.summary.totalPayments);  // → 2
console.log(data.summary.activePlans);    // → 2
```

### cURL
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/purchases/USR-G5ZX1E2Q
```

---

## 📊 What's Included

| Field | What It Means |
|-------|---------------|
| `totalPayments` | 💳 How many times user purchased |
| `activePlans` | ✅ How many plans are currently active |
| `completedPayments` | ✔️ How many completed successfully |
| `pendingPayments` | ⏳ How many waiting for verification |
| `blockedPlans` | 🚫 How many are blocked |
| `totalSpent` | 💰 Total amount paid |
| `totalDiscount` | 🎁 Total discounts given |
| `planBreakdown` | 📋 Stats by each plan type |

---

## 🧪 Test It

```bash
node test-user-summary.cjs
```

Output shows all users and their stats!

---

## ✨ Real-World Examples

### Count Payments
```javascript
const { summary } = await fetch(`/purchases/${uid}`).then(r => r.json());
alert(`You've made ${summary.totalPayments} payments`);
```

### Check Active Plans
```javascript
const { summary } = await fetch(`/purchases/${uid}`).then(r => r.json());
if (summary.activePlans === 0) {
  alert('No active plans. Get one now!');
}
```

### Show Plan Breakdown
```javascript
const { planBreakdown } = await fetch(`/purchases/${uid}/summary`).then(r => r.json());
Object.entries(planBreakdown).forEach(([plan, info]) => {
  console.log(`${plan}: ${info.count} purchased, ${info.active} active`);
});
```

### Find Valuable Customers (Admin)
```javascript
const { summary } = await fetch(`/purchases/${uid}/summary`, {
  headers: { 'Authorization': `Bearer ${adminToken}` }
}).then(r => r.json());

const isVIP = summary.totalPayments >= 5;
const loyal = summary.totalSpent >= 5000;
```

---

## 📝 In Admin Dashboard

Already integrated! Go to `/admin-purchases.html`

Each user shows:
- 💳 Total payments count
- ✅ Active plan count  
- 💰 Total spent
- 📊 Plan breakdown

---

## 🔐 Security

✅ Users see only their own data  
✅ Admins see all users  
✅ Requires JWT token

---

## 📚 Full Docs

See [USER_PURCHASE_SUMMARY.md](USER_PURCHASE_SUMMARY.md) for complete details

---

**Status**: ✅ Live & Ready  
**Test Script**: `node test-user-summary.cjs`
