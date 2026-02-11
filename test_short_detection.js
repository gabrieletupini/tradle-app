const fs = require('fs');
global.window = {};
eval(fs.readFileSync('js/csvParser.js', 'utf8'));
eval(fs.readFileSync('js/tradeCalculator.js', 'utf8'));
const CSVParser = window.CSVParser;
const TradeCalculator = window.TradeCalculator;

// Simulate Feb 11 SHORT trades from the screenshot (Sell entries, Buy exits)
const csvContent = [
    'Symbol,Side,Type,Qty,Limit Price,Stop Price,Fill Price,Status,Placing Time,Closing Time,Order ID,Level ID,Leverage,Margin,Commission',
    'CME_MINI:ES1!,Buy,Market,5,,,6931.75,Filled,2/11/26 16:26:03,2/11/26 16:26:03,2749621212,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Stop,5,,6935.00,6934.75,Filled,2/11/26 16:24:28,2/11/26 16:24:28,2749607594,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Buy,Market,5,,,6945.50,Filled,2/11/26 16:20:37,2/11/26 16:20:37,2749574330,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Stop,5,,6946.50,6946.50,Filled,2/11/26 16:19:43,2/11/26 16:19:50,2749566520,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Buy,Market,5,,,6950.75,Filled,2/11/26 16:18:08,2/11/26 16:18:09,2749552271,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Stop,5,,6950.75,6950.75,Filled,2/11/26 16:16:40,2/11/26 16:16:48,2749540416,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Buy,Market,5,,,6954.25,Filled,2/11/26 16:14:37,2/11/26 16:14:37,2749520230,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Limit,5,6949.50,,6949.50,Filled,2/11/26 16:13:23,2/11/26 16:13:53,2749507273,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Buy,Market,5,,,6954.00,Filled,2/11/26 16:13:06,2/11/26 16:13:06,2749504340,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Limit,5,6959.75,,6960.50,Filled,2/11/26 16:11:48,2/11/26 16:11:48,2749489657,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Buy,Market,5,,,6963.75,Filled,2/11/26 16:10:20,2/11/26 16:10:22,2749474854,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Limit,5,6964.25,,6965.75,Filled,2/11/26 16:10:07,2/11/26 16:10:07,2749472681,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Buy,Market,5,,,6967.50,Filled,2/11/26 16:09:40,2/11/26 16:09:40,2749467707,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Limit,5,6968.50,,6968.50,Filled,2/11/26 16:09:09,2/11/26 16:09:15,2749462244,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Buy,Market,5,,,6971.25,Filled,2/11/26 16:08:46,2/11/26 16:08:46,2749458076,,20:01,"87000 USD",',
    'CME_MINI:ES1!,Sell,Limit,5,6972.75,,6972.25,Filled,2/11/26 16:05:33,2/11/26 16:05:33,2749436262,,20:01,"87000 USD",'
].join('\n');

const parser = new CSVParser();
const result = parser.parseTradingViewCSV(csvContent);

const filled = result.orders.filter(o => o.status === 'Filled').sort((a, b) => a.placingTime - b.placingTime);
console.log('=== FEB 11 FILLED ORDERS (chronological) ===');
filled.forEach((o, i) => console.log(`  ${i}: ${o.side.padEnd(5)} ${o.type.padEnd(8)} ${String(o.fillPrice).padEnd(10)} @ ${o.placingTime?.toLocaleString()}`));

const calc = new TradeCalculator();
const tradeResult = calc.processOrders(result.orders);
console.log('\n=== MATCHED TRADES ===');
tradeResult.trades.forEach((t, i) => console.log(`  Trade ${i + 1}: ${t.side.padEnd(6)} entry=${t.entry} exit=${t.exit} P&L=$${t.netProfit?.toFixed(2)}`));
console.log(`\nTotal P&L: $${tradeResult.summary.totalProfit.toFixed(2)}`);
console.log(`Win Rate: ${tradeResult.summary.winRate.toFixed(1)}%`);
