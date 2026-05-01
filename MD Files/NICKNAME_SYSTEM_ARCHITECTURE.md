# 🏗️ Friend Nickname System - Architecture & Data Flow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRIEND NICKNAME SYSTEM                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER (friends.html)                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Friends List Display                                       │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ 🎯 Cool Guy ✏️                 (displayName)         │   │   │
│  │  │    @USR-H3QQAXII              (username fallback)    │   │   │
│  │  │ 🎯 Awesome Friend ✏️                                 │   │   │
│  │  │    @USR-RTU6F45P                                    │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  loadFriends()                                             │   │
│  │  ├─ Extract friendNickname from friendship               │   │
│  │  ├─ Set displayName = nickname || username              │   │
│  │  └─ Render edit badge onclick handler                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          ▲                                          │
│                          │ Reload on Save                          │
│                          │                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Nickname Editor Modal                                      │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  ✨ CUSTOMIZE FRIEND NICKNAME                       │   │   │
│  │  │  ┌─────────────────────────────────────────────┐   │   │   │
│  │  │  │ Edit nickname for USR-H3QQAXII              │   │   │   │
│  │  │  │ ┌───────────────────────────────────────┐   │   │   │   │
│  │  │  │ │ Cool Guy                          │   │   │   │   │
│  │  │  │ └───────────────────────────────────────┘   │   │   │   │
│  │  │  │ ✨ Tip: Make it fun!                       │   │   │   │
│  │  │  │ [💾 Save Nickname] [Cancel]               │   │   │   │
│  │  │  └─────────────────────────────────────────────┘   │   │   │
│  │  │                                                     │   │   │
│  │  │  Animation: slideUpBounce (0.6s)                  │   │   │
│  │  │  Max Length: 50 characters                        │   │   │
│  │  │  Enter Key Support: Yes                           │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  Functions:                                                │   │
│  │  ├─ openNicknameEditor(id, name, uid)                     │   │
│  │  ├─ saveNickname()  ──────────────────┐                   │   │
│  │  └─ closeNicknameEditor()             │                   │   │
│  └─────────────────────────────────────────────┬──────────────┘   │
│                                                │                  │
└────────────────────────────────────────────────┼──────────────────┘
                                                 │
                    ┌────────────────────────────▼─────────────────────┐
                    │  NETWORK REQUEST                                 │
                    │                                                  │
                    │  POST /api/friends/update-nickname              │
                    │  ├─ Headers: Authorization (JWT Token)          │
                    │  ├─ Body: { friendshipId, nickname }            │
                    │  └─ Validation: Max 50 characters               │
                    └────────────────────────────┬──────────────────────┘
                                                │
┌────────────────────────────────────────────────▼──────────────────┐
│                     BACKEND LAYER (server-friends.js)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  POST /api/friends/update-nickname Endpoint              │    │
│  │                                                           │    │
│  │  1. Verify JWT Token                                    │    │
│  │     ├─ User not authenticated? → 401 Error             │    │
│  │     └─ Token valid → Continue                          │    │
│  │                                                           │    │
│  │  2. Extract User UID from Token                         │    │
│  │     └─ userUID = req.user.uid                           │    │
│  │                                                           │    │
│  │  3. Load friendships.json                               │    │
│  │     └─ Find friendship by friendshipId                  │    │
│  │     └─ Friendship not found? → 404 Error               │    │
│  │                                                           │    │
│  │  4. Authorize User                                      │    │
│  │     ├─ Is user part of friendship?                      │    │
│  │     │  (user1UID === userUID OR user2UID === userUID)  │    │
│  │     └─ Not authorized? → 403 Error                      │    │
│  │                                                           │    │
│  │  5. Validate Input                                      │    │
│  │     ├─ Trim whitespace                                  │    │
│  │     ├─ Check length > 50?                               │    │
│  │     └─ Too long? → 400 Error                            │    │
│  │                                                           │    │
│  │  6. Update Nickname Field                               │    │
│  │     ├─ Determine user position (1 or 2)                │    │
│  │     ├─ if isUser1:                                      │    │
│  │     │  friendship.user1Nickname = nickname.trim()       │    │
│  │     └─ else:                                            │    │
│  │        friendship.user2Nickname = nickname.trim()       │    │
│  │                                                           │    │
│  │  7. Save to friendships.json                            │    │
│  │     ├─ saveJSON(friendsFile, friends)                   │    │
│  │     └─ Write updated data to disk                       │    │
│  │                                                           │    │
│  │  8. Send Success Response (200 OK)                      │    │
│  │     └─ { success: true, friendship }                    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────┐
│                    DATABASE LAYER (JSON File)                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                  │
│  support/friends/friends.json                                   │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ [{                                                   │      │
│  │   "id": "FR-OHC2RM0P2W",                            │      │
│  │   "user1UID": "USR-RTU6F45P",                       │      │
│  │   "user1Email": "pragnadave.1973@gmail.com",        │      │
│  │   "user1Nickname": "Cool Guy",          ← UPDATED  │      │
│  │                                                      │      │
│  │   "user2UID": "USR-H3QQAXII",                       │      │
│  │   "user2Email": "shivamdave.0704@gmail.com",        │      │
│  │   "user2Nickname": "Awesome Friend",    ← UPDATED  │      │
│  │                                                      │      │
│  │   "status": "active",                               │      │
│  │   "createdAt": "2026-02-01T17:32:54.266Z"          │      │
│  │ }]                                                   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
└────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────▼─────────────────┐
                │  Success Response (200 OK)      │
                │                                 │
                │ {                               │
                │   "success": true,              │
                │   "message": "Nickname updated",│
                │   "friendship": { ... }         │
                │ }                               │
                │                                 │
                └───────────────┬─────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│                  FRONTEND RESPONSE HANDLING                   │
├────────────────────────────────────────────────────────────────┤
│                                                              │
│  saveNickname() continued...                                │
│  ├─ if res.ok                                              │
│  │  ├─ showMessage("✅ Nickname updated!", "success")      │
│  │  ├─ closeNicknameEditor()                              │
│  │  └─ loadFriends()  ─────────────────────────────┐       │
│  │                                                │       │
│  └─ else                                          │       │
│     └─ showMessage(`❌ ${data.error}`, "error")  │       │
│                                                   │       │
│     Catches errors and displays to user          │       │
│                                                   │       │
│  Final Result:                                   │       │
│  ┌─────────────────────────────────────────┐    │       │
│  │ Friends List Updates:                   │    │       │
│  │                                         │    │       │
│  │ 🎯 Cool Guy ✏️  ← New nickname shows   │◀───┘       │
│  │    @USR-H3QQAXII                        │            │
│  │                                         │            │
│  │ ✅ Success message displays briefly     │            │
│  └─────────────────────────────────────────┘            │
│                                                              │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Sequence Diagram

```
USER              FRONTEND              BACKEND              DATABASE
  │                  │                    │                    │
  │─ Click ✏️ badge──→│                    │                    │
  │                  │─ openNicknameEditor()                   │
  │                  │─ Show modal                              │
  │                  │─ Auto-focus input                        │
  │◀────── Modal Opens ───│                    │                    │
  │                  │                    │                    │
  │─ Type nickname──→│                    │                    │
  │                  │─ Validate length                         │
  │                  │ (max 50 chars)                           │
  │                  │                    │                    │
  │─ Press Enter────→│                    │                    │
  │                  │─ saveNickname()    │                    │
  │                  │─ Trim & validate   │                    │
  │                  │─ Prepare POST data │                    │
  │                  │                    │                    │
  │                  │─ POST /api/friends/update-nickname →    │
  │                  │  { friendshipId, nickname }    │        │
  │◀────────────────────────────────────────────────────────→  │
  │                  │                    │─ Verify JWT       │
  │                  │                    │─ Check auth       │
  │                  │                    │─ Find friendship  │
  │                  │                    │─ Update nickname  │
  │                  │                    │ friend.json ─────→│
  │                  │                    │ Save & return ←───│
  │                  │  ← 200 OK Response ─│                    │
  │                  │  { success: true,  │                    │
  │                  │    friendship }    │                    │
  │                  │                    │                    │
  │                  │─ Close modal       │                    │
  │◀──── Success msg ─│                    │                    │
  │                  │─ loadFriends()     │                    │
  │                  │─ Re-render list    │                    │
  │◀──── Updated list ─│                    │                    │
  │                  │                    │                    │
```

---

## Error Handling Flow

```
USER REQUEST
    │
    ├─→ Missing Token?
    │   └─→ 401 Unauthorized
    │
    ├─→ Invalid Token?
    │   └─→ 401 Unauthorized
    │
    ├─→ Friendship Not Found?
    │   └─→ 404 Not Found
    │
    ├─→ User Not in Friendship?
    │   └─→ 403 Forbidden
    │
    ├─→ Nickname Too Long (>50)?
    │   └─→ 400 Bad Request
    │
    ├─→ Database Write Error?
    │   └─→ 500 Server Error
    │
    └─→ All Checks Pass?
        └─→ 200 Success
            └─→ Return updated friendship
```

---

## State Management

```
GLOBAL STATE (friends.html)

pendingNicknameUpdate = {
    friendshipId: string | null,
    friendUID: string | null
}

MODAL STATE

<div id="nicknameEditorModal">
    display: flex | none
    
    Elements:
    ├─ nicknameInput (value, focus)
    ├─ nicknameLabel (textContent)
    ├─ Save button (onclick)
    └─ Cancel button (onclick)

FORM STATE

<input id="nicknameInput">
    ├─ value: string (user input)
    ├─ maxlength: 50
    ├─ placeholder: "Enter a cool nickname..."
    └─ events: onkeyup (Enter key check)
```

---

## Component Hierarchy

```
FriendsPage
├─ Friends Container
│  ├─ Friend Item (rendered for each friend)
│  │  ├─ Friend Display Name
│  │  │  └─ Edit Badge (✏️)
│  │  │     └─ onclick → openNicknameEditor()
│  │  ├─ Friend Username (@USR-...)
│  │  ├─ Chat Button
│  │  └─ Remove Button
│  └─ Add Friend Form
│
└─ Modals
   ├─ Nickname Editor Modal
   │  ├─ Modal Header
   │  │  ├─ Title (✨ Customize Friend Nickname)
   │  │  └─ Close Button (×)
   │  └─ Modal Body
   │     ├─ Label (Friend UID)
   │     ├─ Input (nickname-input)
   │     ├─ Hint (Max 50 chars)
   │     └─ Buttons
   │        ├─ Save Nickname (💾)
   │        └─ Cancel
   │
   ├─ Chat Modal
   ├─ Share File Modal
   └─ Confirmation Alert
```

---

## API Endpoint Details

### Endpoint: POST /api/friends/update-nickname

**Request:**
```
Method: POST
URL: /api/friends/update-nickname
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

Body:
{
    "friendshipId": "FR-OHC2RM0P2W",
    "nickname": "Cool Guy"
}
```

**Response (Success - 200):**
```
{
    "success": true,
    "message": "Nickname updated",
    "friendship": {
        "id": "FR-OHC2RM0P2W",
        "user1UID": "USR-RTU6F45P",
        "user1Nickname": "Cool Guy",
        "user2UID": "USR-H3QQAXII",
        "user2Nickname": "Awesome Friend",
        "status": "active",
        "createdAt": "2026-02-01T17:32:54.266Z"
    }
}
```

**Response (Error - 404):**
```
{
    "error": "Friendship not found"
}
```

**Response (Error - 403):**
```
{
    "error": "Not authorized"
}
```

**Response (Error - 400):**
```
{
    "error": "Nickname too long (max 50 characters)"
}
```

---

**Architecture Version:** 1.0
**Status:** Complete & Deployed
**Date:** February 2026
