# 🎯 Cloud Coins Discount & Storage Card - Quick Reference

## 📊 Coin Discount at Checkout

### User Flow:
```
Upgrade Page → Select Plan → Choose Discount Type (Radio Button)
    ↓
    └─ Option 1: Coupon Code (existing system)
    └─ Option 2: Cloud Coins (NEW!)
       ├─ Enter Coin Amount
       ├─ Click "Use Coins"
       ├─ Get Discount (coins ÷ 20 = rupees)
       └─ Proceed to Payment
```

### Key Numbers:
- **2000 Coins = ₹100 Discount** (Ratio: 20 coins = ₹1)
- **Minimum:** 20 coins for ₹1 discount
- **Maximum:** User's available balance

### Code Locations:
- **HTML UI:** `public/upgrade-form.html` lines 248-287
- **JavaScript Logic:** `public/upgrade-form.html` lines 798-903
- **Configuration:** `.env` lines 31-32

### Functions:
- `loadUserCoinsForDiscount()` → Fetches `/api/coins/balance`
- `discountTypeRadios` event listener → Toggles coupon/coins sections
- `useCoinsBtn` click handler → Validates, calculates, and applies discount

---

## 💾 Storage Usage Card

### Visual Display:
```
┌─────────────────────────────────────┐
│ 💾 Storage Usage                    │
├─────────────────────────────────────┤
│  ┌──────────┐   Used:      150 GB   │
│  │   ◯◯     │   Total:     512 GB   │
│  │  75.8%   │   Available: 362 GB   │
│  └──────────┘                       │
└─────────────────────────────────────┘
```

### Location:
- **Placement:** Below file upload drag zone in `upload.html`
- **HTML:** Lines 1357-1387
- **CSS:** Lines 493-559
- **JavaScript:** `upload.js` lines 1640-1669

### Components:
1. **SVG Circle Progress:** Animated, gradient-colored
2. **Percentage Display:** Gold text (#ffd700) with glow
3. **Details Grid:** Used / Total / Available storage
4. **Animations:** Slide-in, pulse, shine effects

### Data Source:
- Fetches from `/storage/{email}` endpoint
- Updates with `loadStorage()` function
- Real-time refresh when files uploaded

---

## 🔗 API Endpoints Used

### For Coin Discount:
```
GET /api/coins/balance
Headers: Authorization: Bearer {token}
Response: { balance: 5000, transactions: [...] }
```

### For Storage Display:
```
GET /storage/{email}
Response: {
  percent: 29.5,
  usedGB: 150.8,
  maxGB: 512,
  usedFormatted: "150.8 GB"
}
```

---

## 🎨 UI/UX Features

### Coin Discount:
- ✨ Gradient gold button (#ffd700)
- 🎚️ Radio button selection for discount type
- ✅ Automatic coupon disable when coins active
- 💬 Real-time validation messages
- 🔢 Formatted coin amounts with comma separators

### Storage Card:
- 🎭 Glassmorphic design with backdrop blur
- 💫 Spinning icon animation (4s loop)
- 📊 SVG progress ring with smooth transitions
- 🌈 Gradient colors (purple to violet)
- ⚡ Slide-in and pulse animations
- 📱 Fully responsive layout

---

## ⚙️ Configuration

### .env Variables:
```env
COINS_DISCOUNT_ENABLED=true      # Enable coin discount feature
COINS_PER_RUPEE=20               # Conversion rate (20 coins = ₹1)
```

### Modification Points (if needed):
- Change conversion rate: Update `COINS_PER_RUPEE` in .env or line 880 of upgrade-form.html
- Disable coin discount: Set `COINS_DISCOUNT_ENABLED=false`
- Change minimum coins: Update line 883 validation logic

---

## 📝 Testing Commands

### Browser Console Tests:

**Test 1: Check coin balance loading**
```javascript
// Should show user's coin balance
document.getElementById("userCoinsDisplay").textContent
```

**Test 2: Check coin discount calculation**
```javascript
// 100 coins should show ₹5 discount
const coinsPerRupee = 20;
const discountAmount = Math.floor(100 / coinsPerRupee);
console.log(`${100} coins = ₹${discountAmount}`); // ₹5
```

**Test 3: Check storage percentage**
```javascript
// Should show usage percentage
document.getElementById("usagePercent").textContent
```

**Test 4: Verify radio toggle**
```javascript
// Check coin section visibility
document.getElementById("coinsSection").style.display
document.getElementById("couponSection").style.display
```

---

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Coin balance shows "0" | Check if user logged in (token in localStorage) |
| Discount not applying | Verify `/api/coins/balance` endpoint is accessible |
| Storage card not updating | Check if `/storage/{email}` endpoint returns correct data |
| Radio buttons not toggling | Open browser console, check for JavaScript errors |
| Coupon not disabling | Verify `#applyCouponBtn` exists in HTML |

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    UPGRADE PAGE LOAD                         │
├─────────────────────────────────────────────────────────────┤
│                          ↓                                   │
│  loadUserCoinsForDiscount() ←──── /api/coins/balance        │
│  └─→ Updates #userCoinsDisplay                              │
│                          ↓                                   │
│          User Selects Plan + Discount Type                   │
│                          ↓                                   │
│  ┌──────────────────┬──────────────────┐                    │
│  │   COUPON PATH    │   COINS PATH     │                    │
│  │  (Existing)      │   (NEW!)         │                    │
│  │                  │                  │                    │
│  │ Enter code  →    │ Enter coins  →   │                    │
│  │ Click Apply →    │ Click UseCoins → │                    │
│  │ /qr endpoint →   │ /qr endpoint →   │                    │
│  └──────────────────┴──────────────────┘                    │
│                          ↓                                   │
│          Generate QR Code + Payment Instructions            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 Related Files Summary

| File | Changes | Impact |
|------|---------|--------|
| `upgrade-form.html` | Added coin discount UI + JS logic | User can now pay with coins |
| `upload.html` | Added storage usage card | Better storage visibility |
| `upload.js` | Extended loadStorage() | Storage card data updates |
| `.env` | Added coin config variables | System coin rates |

---

## 🎁 Bonus: Future Enhancement Ideas

1. **Coin Rewards Dashboard:** Show coin earning history and milestones
2. **Auto-apply Discount:** Suggest best discount option based on user's coins
3. **Loyalty Program:** Bonus coins for monthly activity
4. **Storage Tiers:** Different coin rewards for different plan tiers
5. **Referral Bonus:** Extra coins for referring friends
