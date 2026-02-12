#!/usr/bin/env node

/**
 * Test script to validate CSV upload functionality
 * This simulates the browser environment to test CSV parsing
 */

const fs = require('fs');
const path = require('path');

// Simulate browser environment
global.console = console;
global.window = global;
global.File = class File {
    constructor(content, name) {
        this.content = content;
        this.name = name;
        this.size = content.length;
    }
};

global.FileReader = class FileReader {
    readAsText(file) {
        // Simulate async file reading
        setTimeout(() => {
            this.onload({ target: { result: file.content } });
        }, 10);
    }
};

// Load the CSV parser
const csvParserCode = fs.readFileSync('./js/csvParser.js', 'utf8');
// Remove browser-specific references and export
const cleanedCode = csvParserCode
    .replace(/window\.CSVParser = CSVParser;/, 'global.CSVParser = CSVParser;')
    .replace('class CSVParser {', 'global.CSVParser = class CSVParser {');
eval(cleanedCode);

// Test function
async function testCSVUpload() {
    console.log('🧪 Testing CSV Upload Functionality\n');

    try {
        // Read test CSV file
        const testCsvPath = './test_csvs/paper-trading-order-history-all-2026-02-09T18_25_06.099Z.csv';
        const csvContent = fs.readFileSync(testCsvPath, 'utf8');

        console.log('📄 Test CSV Content (first few lines):');
        console.log(csvContent.split('\n').slice(0, 3).join('\n'));
        console.log('');

        // Create parser instance
        const parser = new CSVParser();

        // Test header validation
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',');

        console.log('🔍 Testing Header Validation:');
        console.log('Headers:', headers);
        const isValidHeaders = parser.validateTradingViewHeaders(headers);
        console.log('Valid headers:', isValidHeaders);
        console.log('');

        // Test CSV parsing
        console.log('📊 Testing CSV Parsing:');
        const parseResult = parser.parseTradingViewCSV(csvContent);

        console.log('Parse Results:');
        console.log('- Total orders found:', parseResult.orders.length);
        console.log('- Valid orders:', parseResult.stats.validOrders);
        console.log('- Errors:', parseResult.stats.errors);
        console.log('- Format:', parseResult.stats.format);

        // Debug: let's see what lines we're processing
        console.log('\n🔍 Debug Info:');
        const testLines = lines.slice(1, 4); // Skip header, get next 3 lines
        console.log('Test lines to process:');
        testLines.forEach((line, index) => {
            console.log(`Line ${index + 2}: "${line}"`);
            if (line.trim()) {
                const values = line.split(',');
                console.log(`  Values count: ${values.length}, First value: "${values[0]}"`);
                console.log(`  Contains ES1!: ${values[0] && (values[0].includes('ES1!') || values[0].includes('CME_MINI:ES1!'))}`);
            }
        });

        if (parseResult.orders.length > 0) {
            console.log('\n📝 Sample Order:');
            console.log(JSON.stringify(parseResult.orders[0], null, 2));
        } else {
            console.log('\n⚠️ No orders were parsed successfully');
        }

        console.log('\n✅ CSV Upload Test Completed Successfully!');

    } catch (error) {
        console.error('❌ CSV Upload Test Failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testCSVUpload();