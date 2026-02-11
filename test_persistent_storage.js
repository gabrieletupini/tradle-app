/**
 * Test script for persistent data storage and Order ID deduplication
 * Run this in the browser console to test the new functionality
 */

// Test data with Order IDs
const mockOrders = [
    {
        orderId: 'ORD_12345',
        symbol: 'CME_MINI:ES1!',
        side: 'BUY',
        qty: 5,
        fillPrice: 6987.75,
        placingTime: new Date('2026-02-10T15:30:00Z'),
        status: 'Filled'
    },
    {
        orderId: 'ORD_12346',
        symbol: 'CME_MINI:ES1!',
        side: 'SELL',
        qty: 5,
        fillPrice: 6988.50,
        placingTime: new Date('2026-02-10T15:35:00Z'),
        status: 'Filled'
    },
    {
        orderId: 'ORD_12347',
        symbol: 'CME_MINI:ES1!',
        side: 'BUY',
        qty: 3,
        fillPrice: 6990.25,
        placingTime: new Date('2026-02-10T16:00:00Z'),
        status: 'Filled'
    },
    {
        orderId: 'ORD_12348',
        symbol: 'CME_MINI:ES1!',
        side: 'SELL',
        qty: 3,
        fillPrice: 6991.00,
        placingTime: new Date('2026-02-10T16:05:00Z'),
        status: 'Filled'
    }
];

const mockTrades = [
    {
        id: 'trade_ORD_12345_ORD_12346',
        entryOrderId: 'ORD_12345',
        exitOrderId: 'ORD_12346',
        entryPrice: 6987.75,
        exitPrice: 6988.50,
        quantity: 5,
        entryTime: new Date('2026-02-10T15:30:00Z'),
        exitTime: new Date('2026-02-10T15:35:00Z'),
        contract: 'CME_MINI:ES1!',
        netProfit: 185,
        status: 'WIN'
    },
    {
        id: 'trade_ORD_12347_ORD_12348',
        entryOrderId: 'ORD_12347',
        exitOrderId: 'ORD_12348',
        entryPrice: 6990.25,
        exitPrice: 6991.00,
        quantity: 3,
        entryTime: new Date('2026-02-10T16:00:00Z'),
        exitTime: new Date('2026-02-10T16:05:00Z'),
        contract: 'CME_MINI:ES1!',
        netProfit: 112.5,
        status: 'WIN'
    }
];

// Test functions
function testPersistentStorage() {
    console.log('🧪 Testing Persistent Storage...');

    // Get the app instance
    const app = window.app || TradleApp.instance;
    if (!app) {
        console.error('❌ App instance not found');
        return;
    }

    // Test 1: Load database
    console.log('📂 Test 1: Loading database...');
    const loaded = app.loadTradeDatabase();
    console.log('✅ Database loaded:', loaded);
    console.log('📊 Current database:', {
        trades: app.tradeDatabase.trades.length,
        orderIds: app.tradeDatabase.orderIds.size
    });

    // Test 2: Merge trades
    console.log('🔄 Test 2: Merging mock trades...');
    const result = app.mergeTradesWithDatabase(mockTrades, mockOrders);
    console.log('✅ Merge result:', result);

    // Test 3: Save database
    console.log('💾 Test 3: Saving database...');
    app.saveTradeDatabase();
    console.log('✅ Database saved');

    // Test 4: Deduplication (add same trades again)
    console.log('🔄 Test 4: Testing deduplication...');
    const dedupResult = app.mergeTradesWithDatabase(mockTrades, mockOrders);
    console.log('✅ Deduplication result:', dedupResult);
    console.log('Expected: 0 new trades, 2 duplicates');

    return {
        initialLoad: loaded,
        firstMerge: result,
        deduplication: dedupResult
    };
}

function testOrderIdExtraction() {
    console.log('🧪 Testing Order ID Extraction...');

    const app = window.app || TradleApp.instance;
    if (!app) {
        console.error('❌ App instance not found');
        return;
    }

    // Test with mock trade
    const testTrade = mockTrades[0];
    const extractedIds = app.extractTradeOrderIds(testTrade, mockOrders);

    console.log('✅ Extracted Order IDs:', extractedIds);
    console.log('Expected:', ['ORD_12345', 'ORD_12346']);

    return extractedIds;
}

function clearTestData() {
    console.log('🗑️ Clearing test data...');

    const app = window.app || TradleApp.instance;
    if (!app) {
        console.error('❌ App instance not found');
        return;
    }

    app.clearTradeDatabase();
    console.log('✅ Test data cleared');
}

// Export test functions to window for browser console access
window.testPersistentStorage = testPersistentStorage;
window.testOrderIdExtraction = testOrderIdExtraction;
window.clearTestData = clearTestData;
window.mockTrades = mockTrades;
window.mockOrders = mockOrders;

console.log('🧪 Test functions loaded! Run in console:');
console.log('- testPersistentStorage() - Test full persistent storage');
console.log('- testOrderIdExtraction() - Test Order ID extraction');
console.log('- clearTestData() - Clear test data');