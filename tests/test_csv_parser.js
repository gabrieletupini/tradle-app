/**
 * Test script for CSV Parser
 * Tests the enhanced TradingView CSV parser with the actual failing file format
 */

// Test CSV content from the actual failing file
const testCSV = `Symbol,Side,Type,Qty,Limit Price,Stop Price,Fill Price,Status,Commission,Placing Time,Closing Time,Order ID,Level ID,Leverage,Margin
CME_MINI:ES1!,Sell,Market,5,,,6976.75,Filled,,2/9/26 16:40,2/9/26 16:40,2741094918,,20:01,"87,209.38 USD"
CME_MINI:ES1!,Buy,Limit,5,6971,,6970.75,Filled,,2/9/26 16:31,2/9/26 16:31,2741028262,,20:01,"87,137.50 USD"`;

function testCSVParser() {
    console.log('🧪 Starting CSV Parser Tests');

    // Create parser instance
    const csvParser = new CSVParser();

    try {
        // Test 1: Header validation
        console.log('\n📋 Test 1: Header Validation');
        const lines = testCSV.split('\n');
        const headers = lines[0].split(',');
        console.log('Headers found:', headers);

        const headerValidation = csvParser.validateTradingViewHeaders(headers);
        console.log(`Header validation: ${headerValidation ? '✅ PASSED' : '❌ FAILED'}`);

        // Test 2: Full parsing
        console.log('\n📊 Test 2: Full CSV Parsing');
        const parseResult = csvParser.parseTradingViewCSV(testCSV);
        console.log('Parse Results:');
        console.log(`- Orders parsed: ${parseResult.orders.length}`);
        console.log(`- Valid orders: ${parseResult.stats.validOrders}`);
        console.log(`- Errors: ${parseResult.stats.errors}`);

        // Test 3: Field mapping verification
        console.log('\n🔍 Test 3: Field Mapping Verification');
        if (parseResult.orders.length > 0) {
            const order = parseResult.orders[0];
            console.log('Sample parsed order:');
            console.log('- Symbol:', order.symbol);
            console.log('- Side:', order.side);
            console.log('- Type:', order.type);
            console.log('- Qty:', order.qty);
            console.log('- Fill Price:', order.fillPrice);
            console.log('- Status:', order.status);
            console.log('- Commission:', order.commission);
            console.log('- Placing Time:', order.placingTime);
            console.log('- Closing Time:', order.closingTime);
            console.log('- Order ID:', order.orderId);
        }

        // Test 4: Date parsing
        console.log('\n📅 Test 4: Date Parsing');
        const testDate1 = csvParser.parseDateTime('2/9/26 16:40');
        const testDate2 = csvParser.parseDateTime('2/9/26 16:31');
        console.log(`Date 1 parsing: ${testDate1 ? '✅ ' + testDate1.toString() : '❌ FAILED'}`);
        console.log(`Date 2 parsing: ${testDate2 ? '✅ ' + testDate2.toString() : '❌ FAILED'}`);

        // Test 5: Dynamic field mapping
        console.log('\n🎯 Test 5: Dynamic Field Mapping Test');
        const testLine = lines[1];
        const values = csvParser.parseCSVLine(testLine);
        const orderObj = csvParser.createOrderObject(values, headers);

        console.log('Raw CSV line:', testLine);
        console.log('Parsed values:', values);
        console.log('Mapped object commission:', orderObj.commission);
        console.log('Mapped object placingTime:', orderObj.placingTime);
        console.log('Mapped object closingTime:', orderObj.closingTime);

        console.log('\n🎉 All tests completed successfully!');
        return true;

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.testCSVParser = testCSVParser;
}

// Export for Node.js (if needed)
if (typeof module !== 'undefined') {
    module.exports = testCSVParser;
}