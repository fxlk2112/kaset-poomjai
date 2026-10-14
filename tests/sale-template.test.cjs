const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function client(saved) {
  const elements = {};
  const storage = new Map();
  const context = vm.createContext({
    console, setTimeout() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: { getElementById: id => elements[id] },
    T: k => k === 'brandName' ? 'Farm' : 'Footer',
    esc: v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c])),
    dateLabel: v => v, ic: () => '', toast() {}, openModal(html) { context.modal = html; }
  });
  const run = s => vm.runInContext(s, context);
  for (const file of ['data', 'sales']) run(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'));
  if (saved) run(`S.saleTemplate = ${JSON.stringify(saved)};`);
  run(`const sample = {id:'sample', no:4, date:'2026-09-30', customer:'Customer', items:[{name:'Product',code:'001',qty:1,unit:'Bottle',price:380,total:380}],discount:20,payMethod:'cash'}; S.sales=[sample];`);
  const form = () => JSON.parse(run('JSON.stringify(saleTemplate())'));
  Object.entries(form()).forEach(([k, value]) => { elements['saleTpl_' + k] = { value, focus() {} }; });
  return { run, elements, context, storage, form };
}
test('legacy account renders default labels and unchanged totals', () => {
  const { run } = client();
  assert.equal(run('saleTemplate().title'), 'ใบส่งสินค้า');
  assert.match(run('saleReceiptHtml(sample)'), /380 บาท/);
  assert.match(run('saleReceiptHtml(sample)'), /360 บาท/);
});
test('receipt date shows only the formatted date without a parenthesized ISO date', () => {
  const { run, context } = client();
  context.dateLabel = () => '30 ก.ย. 2569';
  const html = run('saleReceiptHtml(sample)');
  assert.match(html, /<b>30 ก\.ย\. 2569<\/b>/);
  assert.ok(!html.includes('(2026-09-30)'));
});
test('simple receipt uses only actual item rows, without padding to eight rows', () => {
  const { run } = client();
  for (const count of [1, 3, 12]) {
    const html = run(`saleReceiptHtml({...sample,items:Array.from({length:${count}},()=>sample.items[0])})`);
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    assert.equal((body.match(/<tr>/g) || []).length, count);
    assert.ok(!body.includes('colspan'));
    assert.ok(!html.includes('receipt-empty-row'));
  }
});
test('simple receipt with no items shows one clear empty state, not blank ruled lines', () => {
  const { run } = client();
  const html = run('saleReceiptHtml({...sample,items:[]})');
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((body.match(/<tr>/g) || []).length, 1);
  assert.match(body, /ไม่มีรายการสินค้า/);
});
test('template saves once, survives reload and leaves sales and stock untouched', () => {
  const { run, elements, storage } = client();
  const before = run('JSON.stringify({sales:S.sales,stock:S.stock})');
  elements.saleTpl_brand.value = 'My Farm';
  elements.saleTpl_title.value = 'Delivery';
  elements.saleTpl_footer.value = '';
  run('App.saveSaleTemplate({preventDefault(){}}, "sample")');
  const state = JSON.parse([...storage.values()].pop());
  assert.equal(state.saleTemplate.brand, 'My Farm');
  assert.equal(run('JSON.stringify({sales:S.sales,stock:S.stock})'), before);
  const reloaded = client(state.saleTemplate);
  assert.equal(reloaded.run('saleTemplate().footer'), '');
  assert.match(reloaded.run('saleReceiptHtml(sample)'), /My Farm/);
  assert.match(reloaded.run('saleShareText(sample)'), /My Farm - Delivery #4/);
});
test('preview and reset do not persist until save', () => {
  const { run, elements, storage } = client({ brand: 'Saved Farm' });
  const before = JSON.stringify([...storage]);
  elements.saleTemplatePreview = {};
  elements.saleTpl_brand.value = 'Draft Farm';
  run('App.saleTemplatePreview("sample")');
  assert.match(elements.saleTemplatePreview.innerHTML, /Draft Farm/);
  assert.equal(run('S.saleTemplate.brand'), 'Saved Farm');
  run('App.resetSaleTemplate("sample")');
  assert.equal(elements.saleTpl_brand.value, 'Farm');
  assert.equal(run('S.saleTemplate.brand'), 'Saved Farm');
  assert.equal(JSON.stringify([...storage]), before);
});
test('untrusted template text is escaped in receipt and form; void status remains', () => {
  const { run, context } = client({ brand:'<img src=x onerror=alert(1)>', title:'</title><script>alert(1)</script>', col2:'<b>Product</b>' });
  const html = run('saleReceiptHtml({...sample,status:"void"})');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img/);
  assert.match(html, /ยกเลิกแล้ว/);
  run('App.editSaleTemplate("sample")');
  assert.ok(!context.modal.includes('<script>'));
});
test('invalid required fields and failed storage never replace saved template', () => {
  const { run, elements } = client({ brand:'Saved' });
  elements.saleTpl_title.value = '   ';
  run('App.saveSaleTemplate({preventDefault(){}}, "sample")');
  assert.equal(run('S.saleTemplate.brand'), 'Saved');
  elements.saleTpl_title.value = 'Delivery';
  elements.saleTpl_brand.value = 'New';
  run('saveState = function(){ storageSaveFailed=true; }; App.saveSaleTemplate({preventDefault(){}}, "sample")');
  assert.equal(run('S.saleTemplate.brand'), 'Saved');
});
test('account without a template cannot inherit another account template', () => {
  const { run } = client({ brand: 'Account A' });
  run('Object.keys(S).forEach(k => delete S[k]); Object.assign(S, seed());');
  assert.equal(run('saleTemplate().brand'), 'Farm');
});
test('print uses the same receipt HTML and escaped custom document title', () => {
  const { run, elements, context } = client({ title: 'Delivery <test>' });
  elements.receiptArea = { outerHTML: run('saleReceiptHtml(sample)') };
  let printed = '';
  context.window = { open: () => ({ document: { write: s => { printed = s; }, close() {} }, focus() {} }) };
  run('App.printSale()');
  assert.ok(printed.includes(elements.receiptArea.outerHTML));
  assert.match(printed, /<title>Delivery &lt;test&gt;<\/title>/);
  assert.match(printed, /@page \{ size: A4/);
  assert.match(printed, /\.receipt-items \{ min-height: 40mm; \}/);
  assert.match(printed, /\.receipt-closing \{ break-inside: avoid; \}/);
});
test('simple receipt reserves unruled space, expands for more items and groups the closing', () => {
  const { run } = client();
  const html = run('saleReceiptHtml(sample)');
  assert.match(html, /<div class="receipt-items">\s*<table class="receipt-table">/);
  assert.match(html, /<div class="receipt-closing">\s*<div class="receipt-total">/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  assert.match(css, /\.receipt-items \{ min-height: 140px; \}/);
  assert.ok(!run('saleReceiptHtml(sample,saleTemplate({layout:"fus"}))').includes('class="receipt-items"'));
});
test('FUS preset is opt-in, previews 19 numbered rows and does not overwrite account before save', () => {
  const { run, elements } = client({ brand:'Saved Brand' });
  elements.saleTemplatePreview = {};
  run('App.useFusSaleTemplate("sample")');
  assert.equal(run('S.saleTemplate.brand'), 'Saved Brand');
  assert.equal(elements.saleTpl_layout.value, 'fus');
  assert.equal(elements.saleTpl_brand.value, 'FUS');
  const html = elements.saleTemplatePreview.innerHTML;
  assert.match(html, /รายการเบิก\/ขายสินค้า/);
  assert.match(html, /<td>19<\/td>/);
  assert.ok(!html.includes('<tr><td>20</td>'));
  assert.match(html, /receipt-fus/);
  run('App.saveSaleTemplate({preventDefault(){}}, "sample")');
  assert.equal(run('S.saleTemplate.layout'), 'fus');
  assert.equal(run('saleTemplate().brand'), 'FUS');
});
test('FUS preserves all items beyond 19, discount, void marking, date and escaped text', () => {
  const { run, context } = client({ layout:'fus', brand:'<b>FUS</b>' });
  context.dateLabel = () => '30 ก.ย. 2569';
  const html = run('saleReceiptHtml({...sample,status:"void",items:Array.from({length:23},()=>sample.items[0])})');
  assert.match(html, /<td>23<\/td>/);
  assert.match(html, /&lt;b&gt;FUS&lt;\/b&gt;/);
  assert.match(html, /ยกเลิกแล้ว/);
  assert.match(html, /ส่วนลด<\/th><td class="fus-amount">20<\/td>/);
  assert.match(html, /30 ก\.ย\. 2569/);
  assert.ok(!html.includes('(2026-09-30)'));
});
test('FUS header has no divider lines while the product grid remains bordered', () => {
  const { run } = client({ layout:'fus' });
  const html = run('saleReceiptHtml(sample)');
  for (const name of ['fus-brand', 'fus-title', 'fus-customer']) {
    const rule = html.match(new RegExp('\\.receipt-fus \\.' + name + ' \\{([^}]+)\\}'));
    assert.ok(rule, name);
    assert.ok(!rule[1].includes('border'), name);
  }
  assert.match(html, /\.fus-items td \{ border:1px solid #111/);
});
test('FUS print includes the same scoped layout styles; unknown layouts use modern fallback', () => {
  const { run, context, elements } = client({ layout:'fus' });
  let output = '';
  elements.receiptArea = { outerHTML: run('saleReceiptHtml(sample)') };
  context.window = {open:()=>({document:{write:s=>{output=s;},close(){}},focus(){}})};
  run('App.printSale()');
  assert.ok(output.includes(elements.receiptArea.outerHTML));
  assert.match(output, /<tbody class="fus-bottom">/);
  assert.match(output, /<th colspan="2">รวมเป็นเงิน/);
  assert.equal((output.match(/colspan="2" class="fus-sign"/g) || []).length, 2);
  assert.ok(!output.includes('class="fus-totals"'));
  assert.equal(run('saleTemplate({layout:"unknown"}).layout'), 'modern');
});
