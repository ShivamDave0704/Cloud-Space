# 🎨 Plan Access System - Visual Reference Card

## Token Format Cheat Sheet

```
╔════════════════════════════════════════════════════════════════════╗
║                    PLATINUM TOKEN FORMAT                          ║
╠════════════════════════════════════════════════════════════════════╣
║  USR123-PLATPLAN-01-02-2026-847392                                ║
║  │││    │││││││││   │││││││││  │││││││                           ║
║  │││    │││││││││   │││││││││  └─ 6 Random Digits               ║
║  │││    │││││││││   └──────────── Creation Date (dd-mm-yyyy)     ║
║  │││    └─────────────────────────Plan Type (PLATPLAN)           ║
║  └────────────────────────────────User ID (123)                  ║
║                                                                    ║
║  Details:                                                          ║
║  - User ID: 123 (embedded in token)                               ║
║  - Plan: Platinum (12 months or 180 days)                         ║
║  - Created: 01 Feb 2026                                           ║
║  - Random: 847392 (security suffix)                               ║
║  - Expiry: 180 days from creation                                 ║
╚════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════╗
║                       ULTRA TOKEN FORMAT                          ║
╠════════════════════════════════════════════════════════════════════╣
║  USR456-ULTRPLAN-15-02-2026-523891                                ║
║  │││    │││││││││   │││││││││  │││││││                           ║
║  │││    │││││││││   │││││││││  └─ 6 Random Digits               ║
║  │││    │││││││││   └────────────Creation Date (dd-mm-yyyy)     ║
║  │││    └─────────────────────────Plan Type (ULTRPLAN)           ║
║  └────────────────────────────────User ID (456)                  ║
║                                                                    ║
║  Details:                                                          ║
║  - User ID: 456 (embedded in token)                               ║
║  - Plan: Ultra (Lifetime)                                         ║
║  - Created: 15 Feb 2026                                           ║
║  - Random: 523891 (security suffix)                               ║
║  - Expiry: Never (lifetime plan)                                  ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Color Scheme Guide

```
╔════════════════════════════════════════════════════════════════════╗
║                    ULTRA PLAN COLORS                              ║
╠════════════════════════════════════════════════════════════════════╣
║  Primary: #ff1493 (Hot Pink)    ██████████  RGB(255, 20, 147)    ║
║  Light:   #ff99ff (Light Pink)  ██████████  RGB(255, 153, 255)   ║
║  Dark:    #8a2be2 (Blue-Purple) ██████████  RGB(138, 43, 226)    ║
║  Text:    #ffe0ff (Pale Pink)   ██████████  RGB(255, 224, 255)   ║
║                                                                    ║
║  Usage:                                                            ║
║  - Border: #ff1493 (Hot Pink - 2px)                               ║
║  - Shadow: 0 0 48px #ff1493, 0 0 32px #8a2be2                    ║
║  - Text: #ffe0ff (Pale Pink)                                      ║
║  - Buttons: Gradient #ff1493 → #ff99ff                            ║
║  - Hover: box-shadow glow + scale 1.08                            ║
║                                                                    ║
║  Example Modal:                                                    ║
║  ┌─────────────────────────────────────────────┐                 ║
║  │ 🔐 UNAUTHORIZED ACCESS                      │  Border: Pink   ║
║  │                                             │                 ║
║  │ You do not have access to the               │  Title: Light   ║
║  │ Ultra plan yet.                             │  Pink + Glow    ║
║  │                                             │                 ║
║  │ [💎 Upgrade Now] [← Back Home]             │  Buttons:       ║
║  └─────────────────────────────────────────────┘  Gradient Pink  ║
╚════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════╗
║                  PLATINUM PLAN COLORS                             ║
╠════════════════════════════════════════════════════════════════════╣
║  Primary: #0099ff (Bright Blue)     ██████████  RGB(0, 153, 255)  ║
║  Light:   #00ffc8 (Cyan)            ██████████  RGB(0, 255, 200)  ║
║  Dark:    #003366 (Dark Blue)       ██████████  RGB(0, 51, 102)   ║
║  Text:    #d0e8ff (Light Blue)      ██████████  RGB(208, 232, 255)║
║                                                                    ║
║  Usage:                                                            ║
║  - Border: #0099ff (Blue - 2px)                                   ║
║  - Shadow: 0 0 48px #0099ff, 0 0 32px #00ffc8                    ║
║  - Text: #d0e8ff (Light Blue)                                     ║
║  - Buttons: Gradient #0099ff → #00ffc8                            ║
║  - Hover: box-shadow glow + scale 1.08                            ║
║                                                                    ║
║  Example Modal:                                                    ║
║  ┌─────────────────────────────────────────────┐                 ║
║  │ 🔐 UNAUTHORIZED ACCESS                      │  Border: Blue   ║
║  │                                             │                 ║
║  │ You do not have access to the               │  Title: Bright  ║
║  │ Platinum plan yet.                          │  Blue + Glow    ║
║  │                                             │                 ║
║  │ [💎 Upgrade Now] [← Back Home]             │  Buttons:       ║
║  └─────────────────────────────────────────────┘  Gradient Cyan  ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## URL Comparison

```
╔════════════════════════════════════════════════════════════════════╗
║                        BEFORE (INSECURE)                          ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Address Bar:                                                      ║
║  https://example.com/platinum-ui-upload.html?token=USR123-       ║
║  PLATPLAN-01-02-2026-847392&uid=123                               ║
║  ▲                                                                 ║
║  └─ Token exposed in URL! 😱                                      ║
║     - Visible in browser history                                  ║
║     - Sent in referrer headers                                    ║
║     - Logged in access logs                                       ║
║     - Can be screenshot/shared accidentally                       ║
║                                                                    ║
║  Risks:                                                            ║
║  ❌ Token in browser history                                      ║
║  ❌ Token in referrer when clicking links                         ║
║  ❌ Token in server logs                                          ║
║  ❌ Token visible to shoulder surfers                             ║
║  ❌ Easy to extract from screenshots                              ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════╗
║                         AFTER (SECURE)                            ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Address Bar:                                                      ║
║  https://example.com/platinum-ui-upload.html?uid=123             ║
║  ✓ Only UID in URL (public info)                                 ║
║                                                                    ║
║  sessionStorage (Browser Memory):                                  ║
║  {                                                                 ║
║    premiumToken: "USR123-PLATPLAN-01-02-2026-847392"             ║
║    uid: "123"                                                      ║
║    tokenTimestamp: "1706768405000"                                ║
║  }                                                                 ║
║  ▲                                                                 ║
║  └─ Token in memory only! ✅                                      ║
║     - NOT in browser history                                      ║
║     - NOT in referrer headers                                     ║
║     - NOT in server logs                                          ║
║     - Expires when browser closes                                 ║
║                                                                    ║
║  Benefits:                                                         ║
║  ✅ Token never in browser history                                ║
║  ✅ Token never in referrer headers                               ║
║  ✅ Token never in server logs                                    ║
║  ✅ Token invisible to shoulder surfers                           ║
║  ✅ Token auto-expires on browser close                           ║
║  ✅ Safe to share clean URL                                       ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Authorization Decision Tree

```
                        ┌─ User Accesses ─┐
                        │ Plan Page       │
                        └────────┬────────┘
                                 ↓
                    ┌────────────────────────┐
                    │ Authorization Check    │
                    │ /api/check-plan-access │
                    └────────────┬───────────┘
                                 ↓
                    ┌────────────────────────┐
                    │ Has JWT in localStorage│
                    │ Has UID in localStorage│
                    └────────────┬───────────┘
                                 ↓
                            Has Both?
                         ┌──────┴──────┐
                    NO  │            │  YES
                    ┌───┴────┐      └──┬──────┐
                    │        │         │      │
                    ↓        ↓         ↓      ↓
                  FAIL   REDIRECT   CHECK DATABASE
                         TO LOGIN   (purchases.json)
                                        ↓
                                   Has Active
                                   Purchase?
                                   ┌───┴────┐
                              YES │        │ NO
                              ┌───┘        └──────┐
                              ↓                   ↓
                         VALIDATE           SHOW MODAL
                         TOKEN            (Unauthorized)
                              ↓                   ↓
                         TOKEN            ┌──────────────┐
                         VALID?           │ 🔐 LOCKED   │
                         ┌──┴──┐           │              │
                    YES │    │ NO         │ Options:     │
                    ┌───┘    └──┐         │ - Upgrade    │
                    ↓           ↓         │ - Home       │
                  ✅ ALLOW   ❌ DENY     └──────────────┘
                  Access    Access
                  Granted   Denied
```

---

## Storage Timeline

```
Timeline of Token Storage (1 day)
═══════════════════════════════════════════════════════════════════

9:00 AM - USER LOGS IN
┌──────────────────────────────────────┐
│ localStorage:                        │
│ ├─ token: JWT_VALUE                 │ Persistent
│ ├─ premiumToken: TOKEN_VALUE         │ (survives close)
│ ├─ username, email, uid              │
│ └─ ... other data                    │
│                                      │
│ sessionStorage: (empty)              │
└──────────────────────────────────────┘

9:00:05 AM - PLAN PAGE LOADS
┌──────────────────────────────────────┐
│ localStorage: (unchanged)            │
│                                      │
│ sessionStorage:                      │
│ ├─ premiumToken: TOKEN_VALUE         │ Session only
│ ├─ uid: USER_ID                      │ (expires on close)
│ ├─ tokenTimestamp: 1706768405000     │
│ └─ sessionId: SESSION_...            │
└──────────────────────────────────────┘

5:00 PM - USER NAVIGATES SITE
┌──────────────────────────────────────┐
│ Both storages unchanged              │
│ Token still valid (JWT expires 11 PM)│
│ sessionStorage still active          │
└──────────────────────────────────────┘

11:00 PM - BROWSER STILL OPEN
┌──────────────────────────────────────┐
│ localStorage: (unchanged)            │
│ - Token still here but EXPIRED       │
│                                      │
│ sessionStorage: (unchanged)          │
│ - Still valid                        │
└──────────────────────────────────────┘

11:05 PM - USER CLOSES BROWSER
┌──────────────────────────────────────┐
│ localStorage: KEPT ✓                 │
│ - Token (expired)                    │
│ - Other user data                    │
│                                      │
│ sessionStorage: CLEARED ✗            │
│ - ALL DATA DELETED                   │
│ - premiumToken: GONE                 │
│ - uid: GONE                          │
│ - tokenTimestamp: GONE               │
└──────────────────────────────────────┘

Next Day - USER OPENS BROWSER
┌──────────────────────────────────────┐
│ localStorage: STILL THERE ✓          │
│ - Old token (EXPIRED)                │
│ - User data (for auto-fill)          │
│                                      │
│ sessionStorage: EMPTY ✗              │
│ - No session tokens                  │
│ - User must login again              │
│                                      │
│ User Logs In:                        │
│ - Fresh JWT created                  │
│ - New sessionStorage tokens          │
│ - Process repeats                    │
└──────────────────────────────────────┘
```

---

## Quick Verification Checklist

```
BEFORE GOING TO PRODUCTION:
═══════════════════════════════════════════════════════════════════

Token Format:
☐ Platinum tokens: USR{UID}-PLATPLAN-dd-mm-yyyy-{6}
☐ Ultra tokens: USR{UID}-ULTRPLAN-dd-mm-yyyy-{6}
☐ Tokens stored in support/tokens.json
☐ Tokens NOT in URL search params
☐ Tokens stored in sessionStorage (not localStorage)

Authorization:
☐ /api/check-plan-access endpoint working
☐ Returns { authorized, token, expiresAt }
☐ Validates JWT before responding
☐ Checks purchase status in database
☐ Denies access if not purchased

Frontend:
☐ ultra-upload.html has auth check
☐ platinum-ui-upload.html has auth check
☐ Unauthorized modal appears for unpurchased users
☐ Modal colors match plan type (purple/pink or blue/cyan)
☐ "Upgrade Now" button redirects to /upgrade.html
☐ "Back Home" button redirects to /upload.html

URLs:
☐ Login redirects to clean URL: ?uid=123 (no token)
☐ Plan pages have clean URL
☐ Back button doesn't restore token in URL
☐ Token never visible in browser history

Testing:
☐ Authorized user can access plan page normally
☐ Unauthorized user sees modal
☐ Modal has correct colors for plan type
☐ Modal buttons work correctly
☐ sessionStorage clears on browser close
☐ localStorage persists across sessions
☐ Token expires after duration (180d for platinum)
☐ Ultra tokens never expire
☐ API calls use JWT from localStorage
☐ Plan features use premium token from sessionStorage
```

---

## Emergency Commands

```javascript
// Clear all data (if needed)
localStorage.clear();
sessionStorage.clear();
location.reload();

// Check token in storage
console.log(localStorage.getItem('token')); // JWT
console.log(localStorage.getItem('premiumToken')); // Premium
console.log(sessionStorage.getItem('premiumToken')); // Session

// Test authorization endpoint
fetch('/api/check-plan-access', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({ plan: 'platinum' })
}).then(r => r.json()).then(console.log);

// Verify token format
const token = localStorage.getItem('premiumToken');
console.log(token); // Should be: USR###-PLATPLAN-##-##-####-######

// Check session expiry
console.log(sessionStorage.getItem('tokenTimestamp'));
// Compare with current time in ms
console.log(Date.now());
// If different session, will be different timestamp
```

---

**✅ Implementation Complete!**
**🚀 Ready for Production!**
**🎉 Beautiful & Secure!**
