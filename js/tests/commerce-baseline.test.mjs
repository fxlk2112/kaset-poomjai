import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const dataSource = readFileSync(new URL("../data.js", import.meta.url), "utf8");

function loadCommerceContracts() {
  const storage = new Map();
  const context = {
    console,
    Date,
    JSON,
    Math,
    setTimeout,
    localStorage: {
      get length() { return storage.size; },
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(String(key), String(value)); },
      key(index) { return Array.from(storage.keys())[index] || null; }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    `${dataSource}
globalThis.__commerce = {
  receiveStock,
  addSale,
  updateSale,
  voidSale,
  saleTotal,
  saleGrandTotal,
  stockValue
};`,
    context,
    { filename: "js/data.js" }
  );
  return context.__commerce;
}

function demoState() {
  return {
    stock: [
      {
        id: "demo-chemical-a",
        code: "DEMO-A",
        name: "Demo Chemical A",
        unit: "ขวด",
        qty: 10,
        openQty: 2.5,
        avgCost: 20
      },
      {
        id: "demo-fertilizer-b",
        code: "DEMO-B",
        name: "Demo Fertilizer B",
        unit: "ถุง",
        qty: 4,
        openQty: 1,
        avgCost: 75
      }
    ],
    sales: []
  };
}

const commerce = loadCommerceContracts();

test("receiveStock rounds received stock down to whole units and recalculates weighted average cost", () => {
  const s = demoState();

  commerce.receiveStock(s, "demo-chemical-a", 2.9, 50);

  assert.equal(s.stock[0].qty, 12);
  assert.equal(s.stock[0].avgCost, 25);

  commerce.receiveStock(s, "demo-chemical-a", 0.9, 1000);

  assert.equal(s.stock[0].qty, 12);
  assert.equal(s.stock[0].avgCost, 25);
});

test("addSale deducts only main stock and preserves opened stock quantity", () => {
  const s = demoState();

  const sale = commerce.addSale(s, {
    date: "2026-09-05",
    customer: "Demo Customer",
    discount: 0,
    items: [
      { stockId: "demo-chemical-a", name: "Demo Chemical A", unit: "ขวด", qty: 3.7, price: 100, priceMode: "sale" }
    ]
  });

  assert.equal(sale.no, 1);
  assert.equal(sale.items[0].qty, 3);
  assert.equal(sale.items[0].fromMain, 3);
  assert.equal(sale.items[0].fromOpen, 0);
  assert.equal(sale.items[0].total, 300);
  assert.equal(s.stock[0].qty, 7);
  assert.equal(s.stock[0].openQty, 2.5);
});

test("updateSale restores previous stock before deducting new items and preserves receipt number", () => {
  const s = demoState();
  const sale = commerce.addSale(s, {
    date: "2026-09-05",
    customer: "Original Customer",
    discount: 20,
    items: [
      { stockId: "demo-chemical-a", name: "Demo Chemical A", unit: "ขวด", qty: 3, price: 100 }
    ]
  });

  const updated = commerce.updateSale(s, sale.id, {
    date: "2026-09-06",
    customer: "Updated Customer",
    discount: 10,
    items: [
      { stockId: "demo-chemical-a", name: "Demo Chemical A", unit: "ขวด", qty: 4, price: 90 },
      { stockId: "demo-fertilizer-b", name: "Demo Fertilizer B", unit: "ถุง", qty: 1, price: 200 }
    ]
  });

  assert.equal(updated.no, 1);
  assert.equal(updated.customer, "Updated Customer");
  assert.equal(s.stock[0].qty, 6);
  assert.equal(s.stock[0].openQty, 2.5);
  assert.equal(s.stock[1].qty, 3);
  assert.equal(s.stock[1].openQty, 1);
  assert.equal(commerce.saleTotal(updated), 560);
  assert.equal(commerce.saleGrandTotal(updated), 550);
});

test("voidSale restores main stock and removes the receipt", () => {
  const s = demoState();
  const sale = commerce.addSale(s, {
    date: "2026-09-05",
    customer: "Demo Customer",
    items: [
      { stockId: "demo-chemical-a", name: "Demo Chemical A", unit: "ขวด", qty: 4, price: 100 }
    ]
  });

  assert.equal(s.stock[0].qty, 6);
  assert.equal(commerce.voidSale(s, sale.id), true);
  assert.equal(s.stock[0].qty, 10);
  assert.equal(s.stock[0].openQty, 2.5);
  assert.deepEqual(s.sales, []);
});

test("sale grand total never goes below zero after discount", () => {
  const s = demoState();
  const sale = commerce.addSale(s, {
    date: "2026-09-05",
    customer: "Demo Customer",
    discount: 999,
    items: [
      { stockId: "demo-chemical-a", name: "Demo Chemical A", unit: "ขวด", qty: 1, price: 100 }
    ]
  });

  assert.equal(commerce.saleTotal(sale), 100);
  assert.equal(commerce.saleGrandTotal(sale), 0);
});

test("stockValue reports main, opened and total inventory value separately", () => {
  const s = {
    stock: [
      { id: "demo-main-open-a", qty: 3, openQty: 0.5, avgCost: 10 },
      { id: "demo-main-open-b", qty: 2, openQty: 1, avgCost: 7.5 }
    ],
    sales: []
  };

  const value = commerce.stockValue(s);
  assert.equal(value.main, 45);
  assert.equal(value.open, 12.5);
  assert.equal(value.total, 57.5);
});
