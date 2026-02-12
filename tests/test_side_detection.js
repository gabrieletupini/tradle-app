// Test: simulate the full flow with today's SHORT trades from the screenshot
// Orders from the screenshot (chronological, Filled only):

const orders = [
    // Today's trades from screenshot - these are SHORT positions
    // Pattern: Sell Limit/Stop (entry) -> Buy Market (exit)
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6971.25, status: 'Filled', placingTime: new Date('2026-02-11T16:08:46'), orderId: '2749458076' },
    { symbol: 'CME_MINI:ES1!', side: 'Sell', type: 'Limit',  qty: 5, fillPrice: 6968.50, status: 'Filled', placingTime: new Date('2026-02-11T16:09:09'), orderId: '2749462244' },
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6967.50, status: 'Filled', placingTime: new Date('2026-02-11T16:09:40'), orderId: '2749467707' },
    { symbol: 'CME_MINI:ES1!', side: 'Sell', type: 'Limit',  qty: 5, fillPrice: 6965.75, status: 'Filled', placingTime: new Date('2026-02-11T16:10:07'), orderId: '2749472681' },
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6963.75, status: 'Filled', placingTime: new Date('2026-02-11T16:10:20'), orderId: '2749474854' },
    { symbol: 'CME_MINI:ES1!', side: 'Sell', type: 'Limit',  qty: 5, fillPrice: 6960.50, status: 'Filled', placingTime: new Date('2026-02-11T16:11:48'), orderId: '2749489657' },
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6954.00, status: 'Filled', placingTime: new Date('2026-02-11T16:13:06'), orderId: '2749504340' },
    { symbol: 'CME_MINI:ES1!', side: 'Sell', type: 'Limit',  qty: 5, fillPrice: 6949.50, status: 'Filled', placingTime: new Date('2026-02-11T16:13:23'), orderId: '2749507273' },
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6954.25, status: 'Filled', placingTime: new Date('2026-02-11T16:14:37'), orderId: '2749520230' },
    { symbol: 'CME_MINI:ES1!', side: 'Sell', type: 'Stop',   qty: 5, fillPrice: 6950.75, status: 'Filled', placingTime: new Date('2026-02-11T16:16:40'), orderId: '2749540416' },
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6950.75, status: 'Filled', placingTime: new Date('2026-02-11T16:18:08'), orderId: '2749552271' },
    { symbol: 'CME_MINI:ES1!', side: 'Sell', type: 'Stop',   qty: 5, fillPrice: 6946.50, status: 'Filled', placingTime: new Date('2026-02-11T16:19:43'), orderId: '2749566520' },
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6945.50, status: 'Filled', placingTime: new Date('2026-02-11T16:20:37'), orderId: '2749574330' },
    { symbol: 'CME_MINI:ES1!', side: 'Sell', type: 'Stop',   qty: 5, fillPrice: 6934.75, status: 'Filled', placingTime: new Date('2026-02-11T16:24:28'), orderId: '2749607594' },
    { symbol: 'CME_MINI:ES1!', side: 'Buy',  type: 'Market', qty: 5, fillPrice: 6931.75, status: 'Filled', placingTime: new Date('2026-02-11T16:26:03'), orderId: '2749621212' },
];

console.log('=== Testing matchTrades with today\'s SHORT data ===\n');
console.log('Raw orders (chronological):');
orders.forEach((o, i) => {
    console.log(`  ${i+1}. ${o.side.padEnd(4)} ${o.type.padEnd(7)} ${o.fillPrice} @ ${o.placingTime.toLocaleTimeString()}`);
});

// Simulate isEntryOrderType
function isEntryOrderType(type) {
    const t = (type || '').toLowerCase().trim();
    if (t === 'stop loss' || t === 'take profit') return false;
    if (t === 'limit' || t === 'stop') return true;
    return false;
}

// Simulate isValidTradePair
function isValidTradePair(o1, o2) {
    return o1.side !== o2.side && o1.qty === o2.qty && o1.status === 'Filled' && o2.status === 'Filled' && o1.symbol === o2.symbol;
}

// Simulate matchTrades
const sorted = [...orders].sort((a, b) => a.placingTime - b.placingTime);
const trades = [];
let i = 0;
while (i < sorted.length - 1) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (!isValidTradePair(current, next)) {
        i++;
        continue;
    }

    const currentIsEntry = isEntryOrderType(current.type);
    const nextIsEntry = isEntryOrderType(next.type);

    if (currentIsEntry && !nextIsEntry) {
        const side = current.side.toLowerCase() === 'buy' ? 'LONG' : 'SHORT';
        trades.push({ entry: current, exit: next, side });
        i += 2;
    } else if (!currentIsEntry && nextIsEntry) {
        console.log(`\n⏭️  Skipping orphan exit: ${current.side} ${current.type} ${current.fillPrice}`);
        i++;
    } else {
        const side = current.side.toLowerCase() === 'buy' ? 'LONG' : 'SHORT';
        trades.push({ entry: current, exit: next, side });
        i += 2;
    }
}

console.log('\n=== Matched Trades ===\n');
trades.forEach((t, idx) => {
    const pnl = t.side === 'SHORT' 
        ? (t.entry.fillPrice - t.exit.fillPrice) * 5 * 50
        : (t.exit.fillPrice - t.entry.fillPrice) * 5 * 50;
    console.log(`Trade ${idx+1}: ${t.side.padEnd(5)} | Entry: ${t.entry.side} ${t.entry.type} ${t.entry.fillPrice} -> Exit: ${t.exit.side} ${t.exit.type} ${t.exit.fillPrice} | P&L: $${pnl.toFixed(2)}`);
});

console.log(`\nTotal trades: ${trades.length}`);
console.log(`SHORT trades: ${trades.filter(t => t.side === 'SHORT').length}`);
console.log(`LONG trades: ${trades.filter(t => t.side === 'LONG').length}`);
