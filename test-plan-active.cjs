// Test script for plan-active.json
const fs = require('fs');
const path = require('path');

const planActiveFile = path.join(__dirname, 'support', 'plan-active.json');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                 PLAN-ACTIVE.JSON - TEST DEMO                   ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

try {
    // Read plan-active.json
    const planActiveData = JSON.parse(fs.readFileSync(planActiveFile, 'utf8'));
    
    console.log(`✅ PLAN-ACTIVE.JSON LOADED\n`);
    console.log(`📊 Total Users: ${planActiveData.length}\n`);
    
    // Display each user and their plans
    planActiveData.forEach((user, index) => {
        console.log(`${'═'.repeat(70)}`);
        console.log(`👤 USER #${index + 1}`);
        console.log(`${'═'.repeat(70)}\n`);
        
        // User Info
        console.log(`📋 USER INFORMATION:`);
        console.log(`   UID: ${user.self.uid}`);
        console.log(`   Email: ${user.self.email}`);
        console.log(`   Username: ${user.self.username}\n`);
        
        // Summary
        console.log(`📊 PLAN SUMMARY:`);
        console.log(`   Total Plans: ${user.summary.totalPlans}`);
        console.log(`   Active Plans: ${user.summary.activePlans}`);
        console.log(`   Blocked Plans: ${user.summary.blockedPlans}`);
        console.log(`   Total Spent: ₹${user.summary.totalSpent.toFixed(2)}`);
        console.log(`   Total Discount: ₹${user.summary.totalDiscount.toFixed(2)}`);
        console.log(`   Total Storage: ${user.summary.totalStorageTB} TB\n`);
        
        // Plans Details
        console.log(`📋 PLANS DETAILS:\n`);
        user.plans.forEach((plan, planIndex) => {
            console.log(`   Plan ${planIndex + 1}: ${plan.plan.toUpperCase()}`);
            console.log(`   ├─ Status: ${plan.status.isActive ? '✅ ACTIVE' : '❌ INACTIVE'} ${plan.status.isBlocked ? '🚫 BLOCKED' : ''}`);
            console.log(`   ├─ Storage: ${plan.planDetails.storageTB} TB`);
            console.log(`   ├─ Duration: ${plan.planDetails.durationDays} days`);
            console.log(`   ├─ Features: ${plan.planDetails.features.join(', ')}`);
            
            // Transaction details
            console.log(`   │`);
            console.log(`   ├─ TRANSACTION DETAILS:`);
            console.log(`   │  ├─ Transaction ID: ${plan.transaction.transactionId}`);
            console.log(`   │  ├─ Payment Method: ${plan.transaction.paymentMethod.toUpperCase()}`);
            console.log(`   │  ├─ Amount: ₹${plan.transaction.amount} → ₹${plan.transaction.finalAmount} (₹${plan.transaction.amountDiscount} discount)`);
            console.log(`   │  ├─ Purchased: ${new Date(plan.transaction.purchasedAt).toLocaleDateString()}`);
            console.log(`   │  ├─ Activated: ${new Date(plan.transaction.activatedAt).toLocaleDateString()}`);
            console.log(`   │  ├─ Expires: ${new Date(plan.transaction.expiresAt).toLocaleDateString()}`);
            
            const expiryDate = new Date(plan.transaction.expiresAt);
            const today = new Date();
            const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            console.log(`   │  └─ Days Left: ${daysLeft} days`);
            
            console.log(`   │`);
            console.log(`   └─ STATUS:`);
            console.log(`      ├─ Active: ${plan.status.isActive ? 'YES' : 'NO'}`);
            console.log(`      ├─ Blocked: ${plan.status.isBlocked ? 'YES' : 'NO'}`);
            if (plan.status.isBlocked) {
                console.log(`      ├─ Reason: ${plan.status.blockedReason}`);
                console.log(`      └─ Blocked At: ${plan.status.blockedAt}`);
            }
            console.log();
        });
    });
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📁 FILE INFORMATION:`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`File Path: ${planActiveFile}`);
    console.log(`File Size: ${fs.statSync(planActiveFile).size} bytes`);
    console.log(`Last Updated: ${fs.statSync(planActiveFile).mtime.toISOString()}\n`);
    
    console.log(`${'═'.repeat(70)}`);
    console.log(`🔗 API ENDPOINTS:`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`\n1. Get All Users Plans:`);
    console.log(`   GET /api/plan-active`);
    console.log(`   Response: { success: true, data: [...all users...], timestamp: "..." }\n`);
    
    console.log(`2. Get Specific User Plans:`);
    console.log(`   GET /api/plan-active/:uid`);
    console.log(`   Example: GET /api/plan-active/USR-G5ZX1E2Q`);
    console.log(`   Response: { success: true, data: {...user data...}, timestamp: "..." }\n`);
    
    console.log(`${'═'.repeat(70)}`);
    console.log(`✨ STRUCTURE OF PLAN-ACTIVE.JSON`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`[
  {
    "self": {
      "uid": "USR-G5ZX1E2Q",        ← User ID
      "email": "email@example.com", ← Email
      "username": "Full Name"       ← Username
    },
    "plans": [                       ← Array of all plans
      {
        "plan": "silver",            ← Plan name
        "planDetails": {
          "storage": 5,              ← Storage in TB
          "storageTB": 5,
          "durationDays": 30,        ← Plan duration
          "maxUploadSize": "500MB",  ← Max upload per file
          "features": [...]          ← Plan features
        },
        "transaction": {             ← Payment transaction details
          "transactionId": "...",    ← Payment ID
          "paymentMethod": "qr",     ← How paid (card, qr, etc)
          "amount": 500,             ← Original price
          "amountDiscount": 200,     ← Discount amount
          "finalAmount": 300,        ← Final paid amount
          "purchasedAt": "...",      ← When purchased
          "activatedAt": "...",      ← When activated
          "expiresAt": "...",        ← When expires
          "status": "completed"      ← Transaction status
        },
        "status": {                  ← Current plan status
          "isActive": true,          ← Is plan active?
          "isBlocked": false,        ← Is plan blocked?
          "blockedReason": null,     ← Why blocked (if any)
          "blockedAt": null          ← When blocked
        }
      }
    ],
    "summary": {                     ← User's plan summary
      "totalPlans": 2,              ← How many plans purchased
      "activePlans": 2,             ← How many active now
      "blockedPlans": 0,            ← How many blocked
      "totalSpent": 1499.40,        ← Total amount paid
      "totalDiscount": 999.60,      ← Total discounts received
      "totalStorageTB": 25          ← Total storage across all plans
    }
  }
]`);
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ WHAT THIS FILE CONTAINS`);
    console.log(`${'═'.repeat(70)}\n`);
    
    console.log(`✅ User Information`);
    console.log(`   └─ UID, Email, Username\n`);
    
    console.log(`✅ All Plans Per User`);
    console.log(`   └─ Plan name, storage, duration, features\n`);
    
    console.log(`✅ Transaction Details`);
    console.log(`   └─ Transaction ID, payment method, amount, discounts, dates\n`);
    
    console.log(`✅ Plan Status`);
    console.log(`   └─ Active/Blocked status, reason if blocked\n`);
    
    console.log(`✅ User Summary`);
    console.log(`   └─ Total plans, active plans, total spent, total storage\n`);
    
    console.log(`${'═'.repeat(70)}`);
    console.log(`📍 FILE LOCATION: support/plan-active.json`);
    console.log(`${'═'.repeat(70)}\n`);
    
} catch (err) {
    console.error('❌ Error:', err.message);
}
