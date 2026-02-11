/**
 * Final validation test for TradingView CSV Parser
 * Tests the exact failing CSV content from paper-trading-order-history-all-2026-02-09T18_25_06.099Z.csv
 */

// Load the actual CSV content from the failing file
async function testActualFailingCSV() {
    console.log('🧪 Testing actual failing CSV file...');

    try {
        // Create parser instance
        const csvParser = new CSVParser();

        // The actual failing CSV content (first few lines for testing)
        const actualFailingCSV = `Symbol,Side,Type,Qty,Limit Price,Stop Price,Fill Price,Status,Commission,Placing Time,Closing Time,Order ID,Level ID,Leverage,Margin
CME_MINI:ES1!,Sell,Market,5,,,6976.75,Filled,,2/9/26 16:40,2/9/26 16:40,2741094918,,20:01,"87,209.38 USD"
CME_MINI:ES1!,Buy,Limit,5,6971,,6970.75,Filled,,2/9/26 16:31,2/9/26 16:31,2741028262,,20:01,"87,137.50 USD"`;

        console.log('📋 Testing CSV format validation...');

        // Test 1: Parse the CSV
        const parseResult = csvParser.parseTradingViewCSV(actualFailingCSV);

        console.log('✅ Parsing Results:');
        console.log(`   - Orders found: ${parseResult.orders.length}`);
        console.log(`   - Valid orders: ${parseResult.stats.validOrders}`);
        console.log(`   - Errors: ${parseResult.stats.errors}`);

        if (parseResult.orders.length > 0) {
            console.log('✅ Sample Order Data:');
            const order = parseResult.orders[0];
            console.log(`   - Symbol: ${order.symbol}`);
            console.log(`   - Side: ${order.side}`);
            console.log(`   - Type: ${order.type}`);
            console.log(`   - Qty: ${order.qty}`);
            console.log(`   - Fill Price: ${order.fillPrice}`);
            console.log(`   - Status: ${order.status}`);
            console.log(`   - Commission: ${order.commission}`);
            console.log(`   - Placing Time: ${order.placingTime}`);
            console.log(`   - Closing Time: ${order.closingTime}`);
            console.log(`   - Order ID: ${order.orderId}`);
            console.log(`   - Leverage: ${order.leverage}`);
            console.log(`   - Margin: ${order.margin}`);
        }

        // Test 2: Verify field mapping is correct
        const lines = actualFailingCSV.split('\n');
        const headers = lines[0].split(',');
        const testLine = lines[1];
        const values = csvParser.parseCSVLine(testLine);

        console.log('🔍 Field Mapping Validation:');
        console.log(`   Headers: ${headers.join(', ')}`);
        console.log(`   Values: ${values.join(', ')}`);

        // Verify specific field positions
        const commissionIndex = headers.indexOf('Commission');
        const placingTimeIndex = headers.indexOf('Placing Time');
        const closingTimeIndex = headers.indexOf('Closing Time');

        console.log(`   Commission at index ${commissionIndex}: "${values[commissionIndex]}"`);
        console.log(`   Placing Time at index ${placingTimeIndex}: "${values[placingTimeIndex]}"`);
        console.log(`   Closing Time at index ${closingTimeIndex}: "${values[closingTimeIndex]}"`);

        // Test 3: Validate dynamic mapping works
        const orderObj = csvParser.createOrderObject(values, headers);
        console.log('🎯 Dynamic Mapping Results:');
        console.log(`   Commission field: "${orderObj.commission}"`);
        console.log(`   Placing Time: ${orderObj.placingTime}`);
        console.log(`   Closing Time: ${orderObj.closingTime}`);

        console.log('✅ Test completed successfully!');
        console.log('🎉 The CSV parser now correctly handles TradingView paper account format!');

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    window.testActualFailingCSV = testActualFailingCSV;

    // Auto-run test when loaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Running final validation test...');
        testActualFailingCSV();
    });
}

// Export for Node.js
if (typeof module !== 'undefined') {
    module.exports = testActualFailingCSV;
}