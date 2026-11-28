const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/lark.js'), 'utf8');
const start = source.indexOf('function larkStockAddedItemsHtml(');
const end = source.indexOf('function larkStockSummaryModalHtml(', start);
const helper = source.slice(start, end);
const render = summary => vm.runInNewContext(`${helper}\nlarkStockAddedItemsHtml(summary)`, {
  summary,
  fmtNum: n => String(n),
  esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
});

test('newly synced stock items show their names and codes in the summary', () => {
  const html = render({ addedItems: [
    { name: 'ปุ๋ย A', code: 'A-1', category: 'ปุ๋ยเคมี', size: '1 กิโลกรัม', unit: 'ถุง' },
    { name: '<script>', code: 'B-2' }
  ] });
  assert.match(html, /<details class="lark-sync-added" open>/);
  assert.match(html, /เพิ่มใหม่ 2 รายการ/);
  assert.match(html, /ปุ๋ย A/);
  assert.match(html, /รหัส A-1 · ปุ๋ยเคมี · 1 กิโลกรัม · ถุง/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('a long added-item list starts collapsed, and no additions show no list', () => {
  assert.equal(render({ addedItems: [] }), '');
  const html = render({ addedItems: Array.from({ length: 6 }, (_, i) => ({ name: `Item ${i}` })) });
  assert.match(html, /<details class="lark-sync-added" >/);
  assert.doesNotMatch(html, /<details class="lark-sync-added" open>/);
});

test('added items are captured before merge for both sync result dialogs', () => {
  const capture = source.indexOf('const addedItems = stockImportPlan(S, mergeProducts).rows');
  const merge = source.indexOf('const totalResult = mergeStockProducts(S, mergeProducts)', capture);
  assert.ok(capture >= 0 && merge > capture);
  assert.match(source, /function larkStockSummaryModalHtml\(summary\)[\s\S]*?larkStockAddedItemsHtml\(summary\)/);
  assert.match(source, /function larkStockConflictModalHtml\(\)[\s\S]*?larkStockAddedItemsHtml\(pending\.summary\)/);
});
