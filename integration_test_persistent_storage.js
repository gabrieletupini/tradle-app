/**
 * Integration Test for Persistent Data Storage and Order ID Deduplication
 * 
 * This test validates:
 * 1. Persistent data storage across navigation
 * 2. Order ID-based deduplication
 * 3. Cumulative trade database functionality
 * 4. Idempotent CSV uploads
 */

const fs = require('fs');
const path = require('path');

// Mock localStorage for testing
global.localStorage = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = value; },
    removeItem(key) { delete this.data[key]; },
    clear() { this.data = {}; }
};

// Mock console methods
global.console = {
    log: (...args) => console.log('[TEST]', ...args),
    warn: (...args) => console.warn('[TEST]', ...args),
    error: (...args) => console.error('[TEST]', ...args)
};

// Load the main application classes
const mainJsPath = path.join(__dirname, 'js', 'main.js');
const tradeCalculatorPath = path.join(__dirname, 'js', 'tradeCalculator.js');
const csvParserPath = path.join(__dirname, 'js', 'csvParser.js');

// Mock DOM elements and methods
global.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    body: { style: {} },
    documentElement: { setAttribute: () => { } }
};
global.window = { location: { reload: () => { } } };

// Load application code
eval(fs.readFileSync(csvParserPath, 'utf8'));
eval(fs.readFileSync(tradeCalculatorPath, 'utf8'));
eval(fs.readFileSync(mainJsPath, 'utf8'));

class PersistentStorageIntegrationTest {
    constructor() {
        this.testResults = [];
        this.app = null;
    }

    async runAllTests() {
        console.log('🧪 Starting Persistent Storage Integration Tests');
        console.log('================================================');

        try {
            await this.setupTest();
            await this.testPersistentDataStorage();
            await this.testOrderIdDeduplication();
            await this.testCumulativeDatabase();
            await this.testIdempotentUploads();
            await this.testNavigationPersistence();
            await this.cleanupTest();

            this.printResults();
            return this.testResults.every(result => result.passed);
        } catch (error) {
            console.error('❌ Integration test failed:', error);
            return false;
        }
    }

    async setupTest() {
        console.log('🔧 Setting up test environment...');

        // Clear localStorage
        global.localStorage.clear();

        // Create app instance with mock UI
        const mockUIController = {
            showToast: () => { },
            updateDashboard: () => { },
            hideDashboard: () => { },
            showDashboard: () => { },
            hideLoading: () => { },
            hideUploadStatus: () => { },
            showUploadStatus: () => { },
            updateSummaryCards: () => { },
            updateDashboardTable: () => { },
            updateTradesTable: () => { }
        };

        // Initialize app
        this.app = new TradleApp();
        this.app.uiController = mockUIController;

        this.addTestResult('Setup', 'Test environment initialized', true);
        console.log('✅ Test environment ready');
    }

    async testPersistentDataStorage() {
        console.log('\n📂 Testing Persistent Data Storage...');

        // Test 1: Initial database should be empty
        const initialLoad = this.app.loadTradeDatabase();
        this.addTestResult(
            'Initial Load',
            'Database should be empty initially',
            this.app.tradeDatabase.trades.length === 0 && !initialLoad
        );

        // Test 2: Save and load data
        const testTrade = this.createMockTrade('ORD_001', 'ORD_002');
        this.app.tradeDatabase.trades.push(testTrade);
        this.app.tradeDatabase.orderIds.add('ORD_001');
        this.app.tradeDatabase.orderIds.add('ORD_002');

        this.app.saveTradeDatabase();
        this.addTestResult(
            'Save Database',
            'Should save trade database to localStorage',
            global.localStorage.getItem('tradle_trade_database') !== null
        );

        // Reset and reload
        this.app.tradeDatabase = { trades: [], orderIds: new Set(), lastUpdated: null };
        const reloaded = this.app.loadTradeDatabase();

        this.addTestResult(
            'Reload Database',
            'Should reload saved trades from localStorage',
            reloaded && this.app.tradeDatabase.trades.length === 1
        );

        console.log('✅ Persistent data storage tests completed');
    }

    async testOrderIdDeduplication() {
        console.log('\n🔍 Testing Order ID Deduplication...');

        // Create mock trades and orders
        const mockOrders = [
            this.createMockOrder('ORD_100', 'BUY', 6900.00),
            this.createMockOrder('ORD_101', 'SELL', 6901.00),
            this.createMockOrder('ORD_102', 'BUY', 6902.00),
            this.createMockOrder('ORD_103', 'SELL', 6903.00)
        ];

        const mockTrades = [
            this.createMockTradeFromOrders(mockOrders[0], mockOrders[1]),
            this.createMockTradeFromOrders(mockOrders[2], mockOrders[3])
        ];

        // Clear database for clean test
        this.app.tradeDatabase = { trades: [], orderIds: new Set(), lastUpdated: null };

        // Test 1: First merge should add all trades
        const firstMerge = this.app.mergeTradesWithDatabase(mockTrades, mockOrders);
        this.addTestResult(
            'First Merge',
            'Should add all new trades',
            firstMerge.newTrades === 2 && firstMerge.duplicates === 0
        );

        // Test 2: Second merge should find duplicates
        const secondMerge = this.app.mergeTradesWithDatabase(mockTrades, mockOrders);
        this.addTestResult(
            'Duplicate Detection',
            'Should detect duplicate Order IDs',
            secondMerge.newTrades === 0 && secondMerge.duplicates === 2
        );

        // Test 3: Mixed scenario (some new, some duplicates)
        const newTrade = this.createMockTradeFromOrders(
            this.createMockOrder('ORD_104', 'BUY', 6904.00),
            this.createMockOrder('ORD_105', 'SELL', 6905.00)
        );
        const newOrders = [...mockOrders,
        this.createMockOrder('ORD_104', 'BUY', 6904.00),
        this.createMockOrder('ORD_105', 'SELL', 6905.00)
        ];
        const mixedTrades = [...mockTrades, newTrade];

        const mixedMerge = this.app.mergeTradesWithDatabase(mixedTrades, newOrders);
        this.addTestResult(
            'Mixed Merge',
            'Should handle mixed new/duplicate trades',
            mixedMerge.newTrades === 1 && mixedMerge.duplicates === 2
        );

        console.log('✅ Order ID deduplication tests completed');
    }

    async testCumulativeDatabase() {
        console.log('\n📈 Testing Cumulative Database...');

        // Clear database
        this.app.tradeDatabase = { trades: [], orderIds: new Set(), lastUpdated: null };

        // Upload 1: Initial trades
        const batch1Orders = [
            this.createMockOrder('BATCH1_001', 'BUY', 7000.00),
            this.createMockOrder('BATCH1_002', 'SELL', 7001.00)
        ];
        const batch1Trades = [this.createMockTradeFromOrders(batch1Orders[0], batch1Orders[1])];

        const result1 = this.app.mergeTradesWithDatabase(batch1Trades, batch1Orders);

        // Upload 2: Additional trades
        const batch2Orders = [
            this.createMockOrder('BATCH2_001', 'BUY', 7002.00),
            this.createMockOrder('BATCH2_002', 'SELL', 7003.00)
        ];
        const batch2Trades = [this.createMockTradeFromOrders(batch2Orders[0], batch2Orders[1])];

        const result2 = this.app.mergeTradesWithDatabase(batch2Trades, batch2Orders);

        this.addTestResult(
            'Cumulative Growth',
            'Database should accumulate trades from multiple uploads',
            this.app.tradeDatabase.trades.length === 4 && // Previous tests + 2 new batches
            result1.newTrades === 1 && result2.newTrades === 1
        );

        console.log('✅ Cumulative database tests completed');
    }

    async testIdempotentUploads() {
        console.log('\n🔄 Testing Idempotent Uploads...');

        // Create identical upload data
        const uploadOrders = [
            this.createMockOrder('IDEMPOTENT_001', 'BUY', 7100.00),
            this.createMockOrder('IDEMPOTENT_002', 'SELL', 7101.00)
        ];
        const uploadTrades = [this.createMockTradeFromOrders(uploadOrders[0], uploadOrders[1])];

        const initialCount = this.app.tradeDatabase.trades.length;

        // First upload
        const upload1 = this.app.mergeTradesWithDatabase(uploadTrades, uploadOrders);

        // Second identical upload
        const upload2 = this.app.mergeTradesWithDatabase(uploadTrades, uploadOrders);

        // Third identical upload
        const upload3 = this.app.mergeTradesWithDatabase(uploadTrades, uploadOrders);

        this.addTestResult(
            'Idempotent Uploads',
            'Multiple identical uploads should not create duplicates',
            upload1.newTrades === 1 &&
            upload2.newTrades === 0 && upload2.duplicates === 1 &&
            upload3.newTrades === 0 && upload3.duplicates === 1 &&
            this.app.tradeDatabase.trades.length === initialCount + 1
        );

        console.log('✅ Idempotent uploads tests completed');
    }

    async testNavigationPersistence() {
        console.log('\n🧭 Testing Navigation Persistence...');

        // Save current state
        this.app.saveTradeDatabase();
        const savedCount = this.app.tradeDatabase.trades.length;

        // Simulate page navigation by creating new app instance
        const newApp = new TradleApp();
        const mockUI = this.app.uiController;
        newApp.uiController = mockUI;

        // Should restore data on initialization
        const restored = newApp.loadTradeDatabase();

        this.addTestResult(
            'Navigation Persistence',
            'Data should persist across page navigation',
            restored && newApp.tradeDatabase.trades.length === savedCount
        );

        console.log('✅ Navigation persistence tests completed');
    }

    async cleanupTest() {
        console.log('\n🧹 Cleaning up test environment...');
        global.localStorage.clear();
        this.addTestResult('Cleanup', 'Test cleanup completed', true);
        console.log('✅ Cleanup completed');
    }

    // Helper methods
    createMockOrder(orderId, side, price) {
        return {
            orderId,
            symbol: 'CME_MINI:ES1!',
            side,
            qty: 5,
            fillPrice: price,
            placingTime: new Date(),
            status: 'Filled'
        };
    }

    createMockTrade(entryOrderId, exitOrderId) {
        return {
            id: `trade_${entryOrderId}_${exitOrderId}`,
            entryOrderId,
            exitOrderId,
            entryPrice: 7000.00,
            exitPrice: 7001.00,
            quantity: 5,
            entryTime: new Date(),
            exitTime: new Date(),
            contract: 'CME_MINI:ES1!',
            netProfit: 250,
            status: 'WIN'
        };
    }

    createMockTradeFromOrders(buyOrder, sellOrder) {
        return {
            id: `trade_${buyOrder.orderId}_${sellOrder.orderId}`,
            entryOrderId: buyOrder.orderId,
            exitOrderId: sellOrder.orderId,
            entryPrice: buyOrder.fillPrice,
            exitPrice: sellOrder.fillPrice,
            quantity: buyOrder.qty,
            entryTime: buyOrder.placingTime,
            exitTime: sellOrder.placingTime,
            contract: buyOrder.symbol,
            netProfit: (sellOrder.fillPrice - buyOrder.fillPrice) * buyOrder.qty * 50,
            status: sellOrder.fillPrice > buyOrder.fillPrice ? 'WIN' : 'LOSE'
        };
    }

    addTestResult(testName, description, passed) {
        this.testResults.push({ testName, description, passed });
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${status} ${testName}: ${description}`);
    }

    printResults() {
        console.log('\n📊 Test Results Summary');
        console.log('========================');

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => console.log(`  - ${r.testName}: ${r.description}`));
        }

        console.log('\n🎉 Integration test completed!');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const test = new PersistentStorageIntegrationTest();
    test.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = PersistentStorageIntegrationTest;