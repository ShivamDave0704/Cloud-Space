# CloudSpace+ Purchase Tracking System

## Overview
The purchase tracking system logs all plan purchases with detailed information including user ID, plan type, pricing, discounts, payment method, and status (active/blocked).

## File Structure

### 📁 Purchase Data File
**Location:** `/support/payments/purchases.json`

This file stores all purchase records with the following structure:

```json
{
  "_id": "PURCHASE-1703020800000",
  "uid": "user-uuid-1",
  "email": "user@example.com",
  "username": "john_doe",
  "plan": "platinum",
  "amount": 4199,
  "amountDiscount": 2519,
  "discountApplied": 40,
  "finalAmount": 2519,
  "currency": "INR",
  "paymentMethod": "card",
  "cardLast4": "4242",
  "status": "completed",
  "purchasedAt": "2024-12-20T10:00:00Z",
  "activatedAt": "2024-12-20T10:05:00Z",
  "expiresAt": "2025-06-20T10:00:00Z",
  "durationDays": 180,
  "storageTB": 100,
  "transactionId": "CARD-1703020800000",
  "notes": "Payment via credit card",
  "isActive": true,
  "isBlocked": false,
  "blockedReason": null,
  "blockedAt": null,
  "renewalAttempts": 0,
  "lastRenewalAttempt": null
}
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Unique purchase record ID (PURCHASE-timestamp) |
| `uid` | String | User's unique ID from JWT token |
| `email` | String | User's email address |
| `username` | String | User's display name |
| `plan` | String | Plan type: `free`, `silver`, `gold`, `platinum`, `ultra` |
| `amount` | Number | Original plan price (in INR) |
| `amountDiscount` | Number | Discount amount (in INR) |
| `discountApplied` | Number | Discount percentage (0-100) |
| `finalAmount` | Number | Final amount paid after discount (in INR) |
| `currency` | String | Always "INR" |
| `paymentMethod` | String | `card`, `proof`, `upi`, or `qr` |
| `cardLast4` | String | Last 4 digits of credit card (if paid by card) |
| `proofId` | String | Proof submission ID (if proof-based payment) |
| `status` | String | `completed`, `pending_verification`, `failed` |
| `purchasedAt` | ISO String | When the purchase was initiated |
| `activatedAt` | ISO String | When the plan was activated/approved |
| `expiresAt` | ISO String | When the plan expires (null = lifetime) |
| `durationDays` | Number | Plan duration in days |
| `storageTB` | Number | Storage allocated in TB |
| `transactionId` | String | Transaction/Payment ID |
| `notes` | String | Additional notes about the purchase |
| `isActive` | Boolean | Whether the plan is currently active |
| `isBlocked` | Boolean | Whether the plan has been blocked by admin |
| `blockedReason` | String | Reason for blocking (if blocked) |
| `blockedAt` | ISO String | When the plan was blocked |
| `renewalAttempts` | Number | Number of renewal attempts |
| `lastRenewalAttempt` | ISO String | When renewal was last attempted |

## Plan Pricing

```javascript
{
  silver: { amount: 500, storageTB: 5, durationDays: 30 },      // 1 month
  gold: { amount: 1999, storageTB: 20, durationDays: 90 },      // 3 months
  platinum: { amount: 4199, storageTB: 100, durationDays: 180 }, // 6 months
  ultra: { amount: 6999, storageTB: 200, durationDays: 9999 }   // lifetime
}
```

## API Endpoints

### 1. Get User Purchase History
**Endpoint:** `GET /purchases/:uid`
**Authentication:** Required (JWT Token)
**Parameters:** 
- `uid` - User ID from URL

**Response:**
```json
{
  "success": true,
  "purchases": [
    { /* purchase record */ }
  ]
}
```

### 2. Get All Purchases (Admin)
**Endpoint:** `GET /admin/purchases`
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "totalPurchases": 150,
  "totalRevenue": 500000,
  "purchases": [ /* all purchase records */ ]
}
```

### 3. Get Purchase Statistics (Admin)
**Endpoint:** `GET /admin/purchase-stats`
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalPurchases": 150,
    "totalRevenue": 500000,
    "activePlans": 120,
    "blockedPlans": 5,
    "pendingVerification": 25,
    "byPlan": {
      "silver": 20,
      "gold": 50,
      "platinum": 60,
      "ultra": 20
    },
    "byPaymentMethod": {
      "card": 80,
      "proof": 50,
      "upi": 15,
      "qr": 5
    }
  }
}
```

### 4. Block a Plan (Admin)
**Endpoint:** `POST /admin/block-plan`
**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "purchaseId": "PURCHASE-1703020800000",
  "reason": "Suspicious activity detected"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Plan blocked successfully",
  "purchase": { /* updated purchase record */ }
}
```

### 5. Unblock a Plan (Admin)
**Endpoint:** `POST /admin/unblock-plan`
**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "purchaseId": "PURCHASE-1703020800000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Plan unblocked successfully",
  "purchase": { /* updated purchase record */ }
}
```

## Purchase Logging Flow

### When Payment is Made (Card)
1. User submits card details on payment page
2. `/process-card` endpoint processes the payment
3. User plan is updated in `users.json`
4. Purchase record is logged to `purchases.json` with status: `completed`

### When Proof is Submitted
1. User uploads payment proof (QR/UPI/Card)
2. `/submit-proof` endpoint creates proof record
3. Purchase record is logged with status: `pending_verification`
4. Purchase remains inactive until admin approves

### When Admin Approves Proof
1. Admin verifies the payment proof
2. `/admin/update-status` endpoint updates proof status to `approved`
3. User plan is activated in `users.json`
4. Purchase record status changes to `completed`
5. `activatedAt` timestamp is set
6. User receives activation email

## Usage Examples

### JavaScript - Fetch User Purchase History
```javascript
const uid = localStorage.getItem('uid');
const token = localStorage.getItem('token');

const response = await fetch(`/purchases/${uid}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { purchases } = await response.json();
purchases.forEach(p => {
  console.log(`${p.plan}: ${p.finalAmount}₹ - ${p.status}`);
});
```

### Display Purchase Status
```javascript
const purchase = purchases[0];

console.log(`Plan: ${purchase.plan}`);
console.log(`Paid: ${purchase.finalAmount}₹`);
console.log(`Discount: ${purchase.discountApplied}%`);
console.log(`Status: ${purchase.isBlocked ? 'BLOCKED' : purchase.isActive ? 'ACTIVE' : 'INACTIVE'}`);
console.log(`Expires: ${new Date(purchase.expiresAt).toLocaleDateString()}`);
console.log(`Storage: ${purchase.storageTB} TB`);
```

## Admin Dashboard Integration

Admins can:
1. ✅ View all purchases and revenue
2. ✅ Filter by plan, status, payment method
3. ✅ See purchase statistics and trends
4. ✅ Block suspicious plans
5. ✅ Unblock plans when needed
6. ✅ Track pending verifications
7. ✅ Monitor payment methods

## Data Integrity

- All timestamps are ISO 8601 format
- Prices are in whole numbers (INR paise)
- Purchase records are immutable (only status can change)
- Deleted purchases are never removed (only marked with status)
- All financial data is logged for audit trail

## Backup & Recovery

To backup purchase data:
```bash
cp support/payments/purchases.json support/payments/purchases.backup.json
```

To view purchases in terminal:
```bash
cat support/payments/purchases.json | jq '.'
```

## Notes

- Purchases are never deleted, only status is changed
- Plan expiry is automatically calculated from durationDays
- Lifetime plans (ultra) have `expiresAt: null`
- Blocked plans automatically revert user to free plan
- All purchases visible only to their owner or admins
