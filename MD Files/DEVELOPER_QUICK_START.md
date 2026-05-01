# 👨‍💻 Developer Quick Start Guide

## For Developers Maintaining This Code

### What Was Added

Two major features were added to the CloudSpace application:

1. **Cloud Coins Discount System** - Allow users to redeem coins for plan upgrade discounts
2. **Storage Usage Card** - Beautiful animated storage display on upload page

---

## 🪙 Cloud Coins Discount - File Guide

### Main Implementation File
**File:** `public/upgrade-form.html`

#### HTML Section (Lines 243-287)
```html
<!-- Radio buttons for discount selection -->
<input type="radio" name="discountType" value="coupon" checked>
<input type="radio" name="discountType" value="coins">

<!-- Coin input and button -->
<input type="number" id="coinsToUse" placeholder="Enter coins">
<button id="useCoinsBtn">Use Coins</button>
```

#### JavaScript Section (Lines 798-903)
Main functions:
- `loadUserCoinsForDiscount()` - Fetches coin balance
- Radio button event listener - Toggles sections
- `useCoinsBtn` click handler - Validates and applies discount

### Configuration
**File:** `.env` (Lines 31-32)
```env
COINS_DISCOUNT_ENABLED=true
COINS_PER_RUPEE=20  # 20 coins = 1 rupee
```

### Key Functions Explained

#### 1. Load Coin Balance
```javascript
async function loadUserCoinsForDiscount() {
  const res = await fetch(`${api}/api/coins/balance`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  // Updates #userCoinsDisplay with balance
}
```

#### 2. Toggle Sections
```javascript
// When user clicks radio button:
if (selectedType === "coupon") {
  couponSection.style.display = "flex";    // Show coupon
  coinsSection.style.display = "none";     // Hide coins
} else {
  couponSection.style.display = "none";    // Hide coupon
  coinsSection.style.display = "block";    // Show coins
}
```

#### 3. Apply Discount
```javascript
// Validation flow:
1. Check plan selected
2. Check coin amount entered
3. Check user has coins
4. Check minimum (20 coins)
5. Calculate: coins / 20 = rupees
6. Store: window.coinsDiscount = { coinsUsed, discountAmount }
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Coin balance shows 0 | Check user is logged in (token in localStorage) |
| Coins button not working | Check console for `/api/coins/balance` errors |
| Coupon not disabling | Verify `#applyCouponBtn` exists in HTML |
| Radio buttons not toggling | Check if `name="discountType"` matches selector |

---

## 💾 Storage Usage Card - File Guide

### Main Implementation Files

**File 1:** `public/upload.html`

#### HTML Section (Lines 1357-1387)
```html
<div class="storage-usage-card">
  <div class="storage-usage-header">
    <span class="storage-icon">💾</span>
    <h3>Storage Usage</h3>
  </div>
  <div class="storage-usage-content">
    <!-- SVG circle -->
    <!-- Detail items -->
  </div>
</div>
```

#### CSS Section (Lines 493-559)
Key classes:
- `.storage-usage-card` - Main container
- `.storage-icon` - Spinning icon
- `.usage-percentage` - Gold percentage text
- `.detail-item` - Each row with label/value

**File 2:** `public/upload.js` (Lines 1640-1669)

Updates elements:
- `#usagePercent` - Percentage display
- `#usedAmount` - Used storage
- `#totalAmount` - Total capacity
- `#availableAmount` - Available space
- `#usageCircle` - SVG progress animation

### SVG Circle Animation

The storage card uses an SVG circle with stroke-dasharray animation:

```javascript
// Calculate circumference
const radius = 45;
const circumference = 2 * Math.PI * radius; // ≈ 282.743

// Calculate offset based on percentage
const offset = circumference - (percent / 100) * circumference;

// Apply to circle
usageCircle.style.strokeDashoffset = offset;
```

At 50% storage: offset = 282.743 - (0.5 × 282.743) ≈ 141.37

### CSS Animations Reference

```css
/* Spinning icon */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Pulsing circle */
@keyframes coinPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

/* Slide in animation */
@keyframes slideInUp {
  from { transform: translateY(30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

---

## 🔧 How to Modify

### Change Coin Conversion Rate

**Option 1 - In .env:**
```env
COINS_PER_RUPEE=25  # Now 25 coins = 1 rupee
```

**Option 2 - In JavaScript:**
Navigate to `upgrade-form.html` line 880:
```javascript
const coinsPerRupee = 25;  // Change this number
```

### Change Storage Card Position

The card is positioned after the drag zone. To move it:

1. Find `<div id="dropZone">` in upload.html
2. Find `<div class="storage-usage-card">` (line 1357)
3. Move the entire `storage-usage-card` div to desired location

### Change Animation Speed

In `upload.html`:

```css
/* Icon spin speed (line 504) */
animation: spin 4s linear infinite;  /* Change 4s to desired duration */

/* Card slide-in speed (line 500) */
animation: slideInUp 0.8s ease-out 0.3s both;  /* Change 0.8s */

/* Pulsing speed (line 525) */
animation: coinPulse 2s ease-in-out infinite;  /* Change 2s */
```

### Change Colors

Coin discount gold color:
- HTML: Line 273 - `#ffd700` (gold)
- CSS: Line 532 - `#ffd700` (gold)

Storage gradient:
- CSS: Line 507-509 - Gradient from purple to violet
- SVG: Line 1368-1371 - Linear gradient definition

---

## 🧪 Testing Locally

### Test Coin Discount

1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Verify `token` exists
4. Open upgrade-form.html
5. Check coin balance displays
6. Enter 2000 coins and verify ₹100 discount calculates

### Test Storage Card

1. Upload some files
2. Go back to upload page
3. Verify storage card shows correct percentages
4. Check SVG circle filled to right amount
5. Resize browser window to test responsiveness

### Debug with Console

```javascript
// Check coin balance
console.log(document.getElementById("userCoinsDisplay").textContent);

// Check storage percentage
console.log(document.getElementById("usagePercent").textContent);

// Check SVG offset
console.log(document.getElementById("usageCircle").style.strokeDashoffset);

// Check window object
console.log(window.coinsDiscount);
```

---

## 📡 API Integration

### Expected Server Response

**Coin Balance Endpoint:**
```json
{
  "balance": 5000,
  "transactions": [
    {
      "type": "login_bonus",
      "amount": 100,
      "date": "2024-01-15"
    }
  ]
}
```

**Storage Endpoint:**
```json
{
  "percent": 29.5,
  "usedGB": 150.8,
  "maxGB": 512,
  "usedFormatted": "150.8 GB"
}
```

### If Endpoints Return Different Data

Modify in `upload.js` or `upgrade-form.html`:

```javascript
// Example: If balance key is different
const balance = data.coins || data.balance || 0;

// Example: If storage percent needs calculation
const percent = (data.usedGB / data.maxGB) * 100;
```

---

## 🚀 Deployment Notes

### Before Deploying

1. Verify `.env` has correct coin configuration
2. Test coin balance API endpoint is working
3. Test storage API endpoint is working
4. Check all animations are smooth
5. Test on mobile devices

### After Deploying

1. Monitor error logs for API failures
2. Verify coin discount transactions are logged
3. Check user feedback on new features
4. Monitor performance metrics

---

## 🐛 Common Issues

### Issue: Coin balance not loading
**Cause:** API endpoint not accessible or user not logged in
**Fix:** Check localStorage has `token`, verify `/api/coins/balance` endpoint

### Issue: Storage card not updating
**Cause:** `/storage/{email}` endpoint returning wrong data
**Fix:** Check endpoint response format, verify email parameter

### Issue: Radio buttons not toggling
**Cause:** JavaScript error or missing HTML elements
**Fix:** Open DevTools console, check for errors, verify element IDs match

### Issue: Animations are choppy
**Cause:** Performance issue or unsupported CSS features
**Fix:** Check browser compatibility, reduce animation complexity

---

## 📚 Code Style Guide

### Naming Conventions
- Functions: `camelCase` - `loadUserCoinsForDiscount()`
- Variables: `camelCase` - `userCoinsBalance`
- IDs/Classes: `kebab-case` - `storage-usage-card`
- Constants: `UPPER_SNAKE_CASE` - `COINS_PER_RUPEE`

### Function Comments
```javascript
// Load user coins balance from server
async function loadUserCoinsForDiscount() {
  // Fetch from API
  // Update display
  // Handle errors
}
```

### Complex Logic Comments
```javascript
// 2000 coins = 100 rs discount (so 20 coins = 1 rupee)
const coinsPerRupee = 20;
const discountAmount = Math.floor(coinsToUse / coinsPerRupee);
```

---

## 🔗 Quick File Reference

| Task | File | Lines |
|------|------|-------|
| Add coin discount UI | upgrade-form.html | 243-287 |
| Add coin discount logic | upgrade-form.html | 798-903 |
| Add storage card HTML | upload.html | 1357-1387 |
| Add storage card CSS | upload.html | 493-559 |
| Update storage display | upload.js | 1640-1669 |
| Configure coins | .env | 31-32 |

---

## ✨ Additional Resources

### For Understanding the System:
1. Read `LATEST_UPDATES_SUMMARY.md` - Full technical documentation
2. Read `COIN_DISCOUNT_QUICK_REFERENCE.md` - User-facing features
3. Read `SESSION_COMPLETION_SUMMARY.md` - Implementation overview

### For Maintenance:
1. Check `FINAL_VERIFICATION_CHECKLIST.md` for complete list of changes
2. Review `IMPLEMENTATION_VALIDATION_REPORT.md` for validation details

---

## 📞 Questions?

### Common Questions

**Q: Where does the coin discount get applied?**
A: In the QR generation endpoint. The `window.coinsDiscount` object is sent to server.

**Q: What happens to coins after discount?**
A: Server deducts coins from user's account and creates transaction record.

**Q: Can user use both coupon and coins?**
A: No, they're mutually exclusive. Using coins disables coupon input.

**Q: Is storage card real-time?**
A: Yes, it updates when `loadStorage()` is called (on page load and after file uploads).

---

## 🎯 Next Steps for New Features

To add new features similar to these:

1. **For Payment Options:** Look at `upgrade-form.html` payment method tabs
2. **For Animated Cards:** Look at `upload.html` glass-card styling
3. **For API Integration:** Look at `loadUserCoinsForDiscount()` pattern
4. **For Validations:** Look at `useCoinsBtn` click handler validation

---

*Developer Guide - Last Updated: Latest Implementation*
*For Code Questions: Refer to inline comments in source files*
