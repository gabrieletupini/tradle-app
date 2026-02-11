/**
 * Validate the Tab Navigation Fix
 * 
 * This script tests the exact user workflow that was failing:
 * 1. Upload CSV → Dashboard shows data ✅
 * 2. Click "Import Data" tab → Dashboard should still show data ✅  (FIXED)
 * 3. Click "Dashboard" tab → Data should still be there ✅ (FIXED)
 */

console.log('🧪 TESTING: Tab Navigation Fix Validation');

// Test configuration
const TEST_CONFIG = {
    testDelay: 500,  // Delay between test steps
    debugMode: true  // Show detailed debugging
};

function debugLog(message, data = null) {
    if (TEST_CONFIG.debugMode) {
        console.log(`🔍 ${message}`, data || '');
    }
}

function testCurrentState() {
    const app = window.app;
    const ui = app?.uiController;

    if (!app || !ui) {
        console.error('❌ App not found');
        return null;
    }

    const dashboardTable = document.querySelector('#tradeTableBody');
    const visibleRows = dashboardTable ? dashboardTable.querySelectorAll('tr:not(.no-data)').length : 0;
    const activeTab = document.querySelector('.nav-tab.active')?.dataset?.tab || 'unknown';

    const state = {
        persistentTrades: app.tradeDatabase.trades.length,
        uiTrades: ui.currentTrades.length,
        dashboardRows: visibleRows,
        activeTab: activeTab,
        localStorage: localStorage.getItem('tradle_trade_database') ? 'EXISTS' : 'MISSING'
    };

    debugLog('Current State:', state);
    return state;
}

// Main test function
async function runTabNavigationTest() {
    console.log('\n🚀 Starting Tab Navigation Fix Test...');

    const app = window.app;
    if (!app) {
        console.error('❌ TradleApp not found. Load the application first.');
        return;
    }

    // Test 1: Ensure we have data to test with
    console.log('\n📊 Test 1: Checking for test data...');
    const initialState = testCurrentState();

    if (initialState.persistentTrades === 0) {
        console.log('📤 No data found. Loading sample data...');
        app.loadSampleDataMethod();

        // Wait for data to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        const afterLoad = testCurrentState();

        if (afterLoad.persistentTrades === 0) {
            console.error('❌ Could not load sample data. Test aborted.');
            return;
        }
        console.log('✅ Sample data loaded');
    }

    // Test 2: Verify dashboard shows data initially
    console.log('\n📋 Test 2: Initial dashboard state...');
    app.uiController.switchTab('dashboard');
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.testDelay));

    const dashboardState = testCurrentState();
    const hasDashboardData = dashboardState.dashboardRows > 0;

    console.log(`📊 Dashboard showing: ${hasDashboardData ? 'DATA ✅' : 'NO DATA ❌'}`);
    console.log(`📊 Rows visible: ${dashboardState.dashboardRows}`);

    if (!hasDashboardData && dashboardState.persistentTrades > 0) {
        console.error('❌ Dashboard not showing data despite having persistent trades');
        return;
    }

    // Test 3: Critical test - switch to Import tab
    console.log('\n📤 Test 3: Switching to Import tab...');
    app.uiController.switchTab('import');
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.testDelay));

    const importState = testCurrentState();
    console.log(`📤 Import tab active: ${importState.activeTab === 'import' ? 'YES ✅' : 'NO ❌'}`);
    console.log(`💾 Persistent data still there: ${importState.persistentTrades > 0 ? 'YES ✅' : 'NO ❌'}`);

    // Test 4: CRITICAL FIX VALIDATION - switch back to Dashboard
    console.log('\n🎯 Test 4: CRITICAL - Switching back to Dashboard...');
    console.log('This is where the bug occurred before the fix.');

    app.uiController.switchTab('dashboard');
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.testDelay + 200)); // Extra time for sync

    const finalState = testCurrentState();
    const dashboardWorking = finalState.dashboardRows > 0;

    console.log(`\n📊 FINAL RESULT:`);
    console.log(`  Active tab: ${finalState.activeTab}`);
    console.log(`  Persistent trades: ${finalState.persistentTrades}`);
    console.log(`  UI trades: ${finalState.uiTrades}`);
    console.log(`  Dashboard rows: ${finalState.dashboardRows}`);
    console.log(`  Dashboard showing data: ${dashboardWorking ? 'YES ✅' : 'NO ❌'}`);

    // Test validation
    const testResults = {
        persistentDataPreserved: finalState.persistentTrades > 0,
        uiDataSynced: finalState.uiTrades > 0,
        dashboardShowingData: dashboardWorking,
        dataConsistent: finalState.persistentTrades === finalState.uiTrades
    };

    console.log(`\n🧪 TEST RESULTS:`);
    Object.entries(testResults).forEach(([test, passed]) => {
        console.log(`  ${test}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    });

    const allTestsPassed = Object.values(testResults).every(Boolean);

    if (allTestsPassed) {
        console.log('\n🎉 SUCCESS: All tests passed! Tab navigation fix is working.');
        console.log('✅ Data persists across tab navigation');
        console.log('✅ Dashboard shows data after Import tab visit');
        console.log('✅ UI state syncs with persistent storage');
    } else {
        console.log('\n❌ FAILURE: Some tests failed. Fix needs more work.');

        // Diagnostic information
        if (!testResults.dashboardShowingData && finalState.persistentTrades > 0) {
            console.log('\n🔍 DIAGNOSTIC:');
            console.log('Persistent data exists but dashboard not showing it.');
            console.log('Check if updateDashboard() is being called properly in switchTab().');
        }
    }

    return allTestsPassed;
}

// Test 5: Multiple navigation cycles
async function runStressTest() {
    console.log('\n⚡ Running Stress Test: Multiple tab switches...');

    const cycles = 3;
    for (let i = 1; i <= cycles; i++) {
        console.log(`\n🔄 Cycle ${i}/${cycles}:`);

        // Dashboard → Import → Dashboard
        window.app.uiController.switchTab('dashboard');
        await new Promise(resolve => setTimeout(resolve, 200));
        const dashState = testCurrentState();

        window.app.uiController.switchTab('import');
        await new Promise(resolve => setTimeout(resolve, 200));

        window.app.uiController.switchTab('dashboard');
        await new Promise(resolve => setTimeout(resolve, 300));
        const finalState = testCurrentState();

        const cyclePass = finalState.dashboardRows > 0;
        console.log(`  Cycle ${i}: ${cyclePass ? '✅ PASS' : '❌ FAIL'}`);

        if (!cyclePass) {
            console.log('❌ Stress test failed at cycle', i);
            return false;
        }
    }

    console.log('✅ Stress test passed: Data persists through multiple tab switches');
    return true;
}

// Export test functions
window.testTabNavigationFix = runTabNavigationTest;
window.testStress = runStressTest;
window.testCurrentState = testCurrentState;

// Auto-run test if requested
if (window.location.hash === '#autotest') {
    setTimeout(() => {
        runTabNavigationTest().then(success => {
            if (success) {
                runStressTest();
            }
        });
    }, 1500);
}

console.log('\n📚 Available test commands:');
console.log('- window.testTabNavigationFix() - Run main fix validation');
console.log('- window.testStress() - Run multiple tab switch test');
console.log('- window.testCurrentState() - Check current state');
console.log('- Add #autotest to URL to run tests automatically');