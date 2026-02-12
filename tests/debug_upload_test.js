/**
 * Debug Upload Test - Test CSV processing pipeline with comprehensive logging
 */
console.log('🧪 Starting Debug Upload Test...');

// Mock DOM elements for testing
class MockElement {
    constructor(id) {
        this.id = id;
        this.style = { display: 'block' };
        this.value = '';
    }
}

// Mock document methods
if (typeof document === 'undefined') {
    global.document = {
        getElementById: (id) => new MockElement(id),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => { },
        createElement: (tag) => ({
            textContent: '',
            href: '',
            download: '',
            click: () => { },
            appendChild: () => { }
        })
    };
}

// Mock File API
class MockFile {
    constructor(content, name, options = {}) {
        this.name = name;
        this.size = content.length;
        this.type = options.type || 'text/csv';
        this.content = content;
        this.lastModified = Date.now();
    }
}

// Mock FileReader with debugging
class MockFileReader {
    constructor() {
        console.log('📁 MockFileReader: Constructor called');
    }

    readAsText(file) {
        console.log('📖 MockFileReader: readAsText called with file:', file.name);
        console.log('📏 File size:', file.size, 'bytes');

        // Simulate async reading with immediate callback
        setTimeout(() => {
            console.log('🔄 MockFileReader: Simulating onload event');
            if (this.onload) {
                this.onload({
                    target: {
                        result: file.content
                    }
                });
            }
        }, 10);
    }
}

// Set up global mocks
global.FileReader = MockFileReader;
global.localStorage = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { }
};

// Test CSV data (small sample)
const testCSV = `Symbol,Side,Type,Qty,Limit Price,Stop Price,Fill Price,Status,Commission,Placing Time,Closing Time,Order ID,Level ID,Leverage,Margin
CME_MINI:ES1!,Sell,Market,5,,,6976.75,Filled,,2/9/26 16:40,2/9/26 16:40,2741094918,,20:01,"87,209.38 USD"
CME_MINI:ES1!,Buy,Limit,5,6971,,6970.75,Filled,,2/9/26 16:31,2/9/26 16:31,2741028262,,20:01,"87,137.50 USD"`;

async function testCSVProcessing() {
    try {
        console.log('🧪 Creating test file...');
        const testFile = new MockFile(testCSV, 'test-paper-trading.csv', { type: 'text/csv' });

        console.log('🏗️ Setting up application components...');

        // Import and initialize components
        const { CSVParser } = require('./js/csvParser.js');
        const { TradeCalculator } = require('./js/tradeCalculator.js');
        const { UIController } = require('./js/ui.js');
        const { TradleApp } = require('./js/main.js');

        console.log('✅ Components loaded successfully');

        console.log('🚀 Starting file processing test...');
        const app = new TradleApp();

        // Test the complete pipeline
        console.log('📤 Calling processFile...');
        const startTime = Date.now();

        const result = await app.processFile(testFile, 'tradingview');

        const endTime = Date.now();
        console.log(`⏱️ Processing completed in ${endTime - startTime}ms`);
        console.log('🎉 Test completed successfully!');
        console.log('📊 Results:', {
            trades: result.trades.length,
            totalProfit: result.summary.totalProfit,
            winRate: result.summary.winRate
        });

        return true;

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('📍 Stack trace:', error.stack);
        return false;
    }
}

// Run the test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    testCSVProcessing()
        .then(success => {
            if (success) {
                console.log('✅ All tests passed!');
                process.exit(0);
            } else {
                console.log('❌ Tests failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Test execution error:', error);
            process.exit(1);
        });
}

module.exports = { testCSVProcessing };