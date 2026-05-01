#!/usr/bin/env node
/**
 * Purchase System Test & Demo Script
 * Run: node purchase-test.js
 * 
 * This script demonstrates:
 * 1. Reading purchase data
 * 2. Querying by user/plan/status
 * 3. Calculating statistics
 * 4. Exporting data
 */

const fs = require('fs');
const path = require('path');

const purchasesFile = path.join(__dirname, 'support', 'payments', 'purchases.json');

console.log('🎯 CloudSpace+ Purchase System - Test & Demo\n');
console.log('=' .repeat(60));

// Check if purchases file exists
if (!fs.existsSync(purchasesFile)) {
    console.error('❌ purchases.json not found at', purchasesFile);
    process.exit(1);
}

// Read purchases
let purchases = [];
try {
    purchases = JSON.parse(fs.readFileSync(purchasesFile, 'utf8'));
    console.log(`✅ Loaded ${purchases.length} purchase records\n`);
} catch (err) {
    console.error('❌ Error reading purchases.json:', err);
    process.exit(1);
}

// ==================== STATISTICS ====================
console.log('\n📊 STATISTICS');
console.log('=' .repeat(60));

const stats = {
    totalPurchases: purchases.length,
    totalRevenue: purchases.reduce((sum, p) => sum + (p.finalAmount || 0), 0),
    activePlans: purchases.filter(p => p.isActive && !p.isBlocked).length,
    blockedPlans: purchases.filter(p => p.isBlocked).length,
    pendingVerification: purchases.filter(p => p.status === 'pending_verification').length,
    byPlan: {},
    byPaymentMethod: {},
    byStatus: {}
};

purchases.forEach(p => {
    stats.byPlan[p.plan] = (stats.byPlan[p.plan] || 0) + 1;
    stats.byPaymentMethod[p.paymentMethod] = (stats.byPaymentMethod[p.paymentMethod] || 0) + 1;
    stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
});

console.log(`Total Purchases:      ${stats.totalPurchases}`);
console.log(`Total Revenue:        ₹${stats.totalRevenue.toLocaleString('en-IN')}`);
console.log(`Active Plans:         ${stats.activePlans}`);
console.log(`Blocked Plans:        ${stats.blockedPlans}`);
console.log(`Pending Verification: ${stats.pendingVerification}`);

console.log('\n📋 By Plan Type:');
Object.entries(stats.byPlan).forEach(([plan, count]) => {
    console.log(`  ${plan.padEnd(12)} : ${count} purchases`);
});

console.log('\n💳 By Payment Method:');
Object.entries(stats.byPaymentMethod).forEach(([method, count]) => {
    console.log(`  ${method.padEnd(12)} : ${count} purchases`);
});

console.log('\n✔️  By Status:');
Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`  ${status.padEnd(20)} : ${count} purchases`);
});

// ==================== RECENT PURCHASES ====================
console.log('\n\n📅 RECENT PURCHASES (Last 5)');
console.log('=' .repeat(60));

const recent = purchases
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))
    .slice(0, 5);

recent.forEach((p, idx) => {
    console.log(`\n${idx + 1}. ${p.username || 'Unknown'} <${p.email}>`);
    console.log(`   Plan:     ${p.plan.toUpperCase()}`);
    console.log(`   Amount:   ₹${p.finalAmount} (was ₹${p.amount}, ${p.discountApplied}% off)`);
    console.log(`   Method:   ${p.paymentMethod.toUpperCase()}`);
    console.log(`   Status:   ${p.status}`);
    console.log(`   Expires:  ${p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '1 Year'}`);
});

// ==================== ACTIVE PLANS ====================
console.log('\n\n✅ ACTIVE PLANS');
console.log('=' .repeat(60));

const activePlans = purchases
    .filter(p => p.isActive && !p.isBlocked)
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));

if (activePlans.length === 0) {
    console.log('No active plans');
} else {
    console.log(`\nTotal: ${activePlans.length} active plans\n`);
    
    const planStats = {};
    activePlans.forEach(p => {
        if (!planStats[p.plan]) planStats[p.plan] = 0;
        planStats[p.plan]++;
    });
    
    Object.entries(planStats).forEach(([plan, count]) => {
        console.log(`${plan.padEnd(12)}: ${count} users`);
    });
}

// ==================== BLOCKED PLANS ====================
console.log('\n\n🚫 BLOCKED PLANS');
console.log('=' .repeat(60));

const blockedPlans = purchases.filter(p => p.isBlocked);

if (blockedPlans.length === 0) {
    console.log('No blocked plans');
} else {
    console.log(`\nTotal blocked: ${blockedPlans.length}\n`);
    
    blockedPlans.forEach(p => {
        console.log(`${p.username || 'Unknown'} <${p.email}>`);
        console.log(`  Reason: ${p.blockedReason}`);
        console.log(`  Blocked at: ${new Date(p.blockedAt).toLocaleString()}`);
        console.log();
    });
}

// ==================== PENDING VERIFICATION ====================
console.log('\n📮 PENDING VERIFICATION');
console.log('=' .repeat(60));

const pendingPlans = purchases.filter(p => p.status === 'pending_verification');

if (pendingPlans.length === 0) {
    console.log('No pending verifications');
} else {
    console.log(`\nTotal pending: ${pendingPlans.length}\n`);
    
    pendingPlans.forEach(p => {
        console.log(`${p.username || 'Unknown'} <${p.email}>`);
        console.log(`  Plan: ${p.plan}`);
        console.log(`  Amount: ₹${p.finalAmount}`);
        console.log(`  Submitted: ${new Date(p.purchasedAt).toLocaleString()}`);
        console.log();
    });
}

// ==================== USER LOOKUP ====================
console.log('\n\n🔍 LOOKUP BY USER');
console.log('=' .repeat(60));

function lookupUser(uid) {
    const userPurchases = purchases.filter(p => p.uid === uid);
    if (userPurchases.length === 0) {
        console.log(`No purchases found for UID: ${uid}`);
        return;
    }
    
    console.log(`\nFound ${userPurchases.length} purchase(s) for UID: ${uid}\n`);
    
    userPurchases.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.plan.toUpperCase()} - ₹${p.finalAmount} - ${p.status}`);
        console.log(`   Purchased: ${new Date(p.purchasedAt).toLocaleDateString()}`);
        if (p.expiresAt) {
            const expiryDate = new Date(p.expiresAt);
            const today = new Date();
            const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            console.log(`   Expires: ${expiryDate.toLocaleDateString()} (${daysLeft} days left)`);
        } else {
            console.log(`   Expires: 1 Year`);
        }
        console.log();
    });
}

// Example: Lookup first user if available
if (purchases.length > 0) {
    const firstUserUid = purchases[0].uid;
    lookupUser(firstUserUid);
}

// ==================== REVENUE TRENDS ====================
console.log('\n📈 REVENUE TRENDS');
console.log('=' .repeat(60));

const revenueByDate = {};
purchases.forEach(p => {
    const date = new Date(p.purchasedAt).toLocaleDateString();
    if (!revenueByDate[date]) revenueByDate[date] = 0;
    revenueByDate[date] += p.finalAmount;
});

console.log('\nRevenue by Date:\n');
Object.entries(revenueByDate)
    .sort()
    .slice(-5)
    .forEach(([date, amount]) => {
        console.log(`${date}: ₹${amount.toLocaleString('en-IN')}`);
    });

// ==================== EXPORT OPTIONS ====================
console.log('\n\n📤 EXPORT OPTIONS');
console.log('=' .repeat(60));

console.log('\n1. Export all purchases as CSV:');
console.log('   node -e "const p = require(\'./support/payments/purchases.json\'); console.log(p.map(x => `${x.email},${x.plan},${x.finalAmount}`).join(\'\\n\'))" > purchases.csv');

console.log('\n2. Export statistics as JSON:');
console.log('   node -e "const p = require(\'./support/payments/purchases.json\'); const stats = {total: p.length, revenue: p.reduce((s,x)=>s+x.finalAmount,0), active: p.filter(x=>x.isActive).length}; console.log(JSON.stringify(stats, null, 2))"');

console.log('\n3. View raw JSON:');
console.log('   cat support/payments/purchases.json | jq \'.\'');

// ==================== SUMMARY ====================
console.log('\n\n' + '=' .repeat(60));
console.log('✅ Purchase System Test Complete');
console.log('=' .repeat(60));

console.log('\n📍 Purchase file location: ' + purchasesFile);
console.log('\n💡 Use the admin dashboard at: /admin-purchases.html');
console.log('   Or API: GET /admin/purchases (admin only)');
console.log('\n' );
