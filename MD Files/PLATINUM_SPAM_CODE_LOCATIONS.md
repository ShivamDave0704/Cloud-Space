# Platinum Plan Anti-Spam - Code Location Map

## 📍 File: [server-plans.js](server-plans.js)

### 1️⃣ Helper Function: `hasActivePlanOfType()`
**Location**: Line 830
**Type**: New function
**Purpose**: Check if user has active plan of given type

```javascript
// Helper: Check if user has an active plan of a specific type (prevents duplicate/spam purchases)
function hasActivePlanOfType(uid, planType) {
  try {
    const purchases = readStore('purchases.json', []);
    
    // Check if user has an active, non-blocked purchase of the same plan type
    const activeExists = purchases.some(
      (p) => p.uid === uid && 
             p.plan === planType && 
             p.isActive && 
             !p.isBlocked &&
             (!p.expiresAt || new Date(p.expiresAt).getTime() > Date.now())
    );
    
    if (activeExists) {
      return true;
    }

    // Also check for uiAccess in users.json for platinum/ultra grants
    if (['platinum', 'ultra'].includes(planType)) {
      const users = readStore('users.json', []);
      const user = users.find(u => u.uid === uid);
      if (user && user.uiAccess && user.uiAccess.toLowerCase() === planType) {
        return true; // User already has uiAccess for this plan
      }
    }

    return false;
  } catch (err) {
    console.error("Error checking active plan:", err);
    return false; // On error, allow purchase to proceed (fail-open)
  }
}
```

---

### 2️⃣ Endpoint: POST /create-netbanking-session
**Location**: Line ~1500
**Type**: Protection added
**What changed**: Added anti-spam check before approving request

**Code Added**:
```javascript
// ANTI-SPAM: Check if user already has an active plan of this type
if (hasActivePlanOfType(uid, plan)) {
  return res.json({ 
    success: false, 
    msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.` 
  });
}
```

**Before This Check**: Validates `uid`, `plan`, `bank` parameters
**After This Check**: Returns success/fallback response

---

### 3️⃣ Endpoint: POST /process-card
**Location**: Line ~1525
**Type**: Protection added
**What changed**: Added anti-spam check that respects extensions

**Code Added**:
```javascript
const allowExtend = extend === "1" || source === "email";

// ANTI-SPAM: Check if user already has an active plan of this type
if (!allowExtend && hasActivePlanOfType(targetUid, plan)) {
  return res.json({ 
    success: false, 
    msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.` 
  });
}
```

**Key Detail**: Uses `!allowExtend` to allow extensions (extend=1 or source=email)

---

### 4️⃣ Endpoint: POST /create-qr
**Location**: Line ~1625
**Type**: Protection added
**What changed**: Added anti-spam check before QR generation

**Code Added**:
```javascript
// ANTI-SPAM: Check if user already has an active plan of this type
if (!['custom'].includes(plan) && hasActivePlanOfType(uid, plan)) {
  return res.json({ 
    success: false, 
    msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.` 
  });
}
```

**Key Detail**: Excludes 'custom' plans (allows multiple custom purchases)

**Placement**: Right after parameter validation, before plan details lookup

---

### 5️⃣ Endpoint: POST /submit-proof
**Location**: Line ~1729
**Type**: Protection added
**What changed**: Added anti-spam check with file cleanup on rejection

**Code Added**:
```javascript
// ANTI-SPAM: Check if user already has an active plan of this type
const allowExtend = extend === "1" || source === "email";
if (!allowExtend && !['custom'].includes(plan) && hasActivePlanOfType(uid, plan)) {
  // Clean up uploaded file if exists
  if (req.file) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
  }
  return res.json({ 
    success: false, 
    msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.` 
  });
}
```

**Key Features**:
- Cleans up uploaded proof file (saves disk space)
- Respects extensions (allowExtend flag)
- Excludes custom plans
- Early validation (before processing)

**Removed Code**: 
- Duplicate `const allowExtend` declaration removed (was at line 1858)

---

## 🔄 Execution Flow

```
User submits purchase request
        ↓
Endpoint receives request (process-card, submit-proof, create-qr, or create-netbanking)
        ↓
Validate basic parameters (uid, plan, payment details)
        ↓
[NEW] Call hasActivePlanOfType(uid, plan)
        ↓
    ├─ YES: Active plan found
    │   └─ Return error message ❌
    │
    └─ NO: No active plan found
        └─ Continue with normal processing ✅
```

---

## 📊 Change Summary Table

| Endpoint | Line | Type | Details |
|----------|------|------|---------|
| Helper Function | 830 | NEW | hasActivePlanOfType() |
| /create-netbanking-session | 1500 | ADDED | Basic anti-spam check |
| /process-card | 1525 | ADDED | Check with extension support |
| /create-qr | 1625 | ADDED | Check with custom plan bypass |
| /submit-proof | 1729 | ADDED | Check with file cleanup + extension support |

---

## 🎯 Test Each Endpoint

### Test POST /create-netbanking-session
```bash
curl -X POST http://localhost:5000/create-netbanking-session \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "USR-001",
    "plan": "platinum",
    "bank": "HDFC"
  }'
```
Expected: `{"success": false, "msg": "You already have an active platinum plan..."}`

---

### Test POST /process-card
```bash
curl -X POST http://localhost:5000/process-card \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "USR-001",
    "plan": "platinum",
    "cardNumber": "4111111111111111",
    "cardName": "John Doe",
    "expiry": "12/25",
    "cvv": "123"
  }'
```
Expected: `{"success": false, "msg": "You already have an active platinum plan..."}`

---

### Test POST /create-qr
```bash
curl -X POST http://localhost:5000/create-qr \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "USR-001",
    "plan": "platinum"
  }'
```
Expected: `{"success": false, "msg": "You already have an active platinum plan..."}`

---

### Test POST /submit-proof
```bash
curl -X POST http://localhost:5000/submit-proof \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -F "uid=USR-001" \
  -F "plan=platinum" \
  -F "method=upi" \
  -F "screenshot=@proof.jpg"
```
Expected: `{"success": false, "msg": "You already have an active platinum plan..."}`

---

## ✨ Verification Checklist

- [x] Helper function added at line 830
- [x] /create-netbanking-session protected (line ~1500)
- [x] /process-card protected (line ~1525)
- [x] /create-qr protected (line ~1625)
- [x] /submit-proof protected (line ~1729)
- [x] File cleanup implemented in /submit-proof
- [x] Extension support added (extend=1, source=email)
- [x] Custom plan bypass implemented
- [x] Server tested and running
- [x] No syntax errors

---

## 📚 Related Documentation

See also:
- [PLATINUM_SPAM_PROTECTION.md](PLATINUM_SPAM_PROTECTION.md) - Full details
- [PLATINUM_SPAM_QUICK_REFERENCE.md](PLATINUM_SPAM_QUICK_REFERENCE.md) - Quick guide
- [server-plans.js](server-plans.js) - Full source code
- [support/purchases.json](support/purchases.json) - Purchase records

---

**Generated**: 2026-02-05
**Status**: ✅ Complete and Tested
