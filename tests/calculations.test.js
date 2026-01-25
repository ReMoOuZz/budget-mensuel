const test = require("node:test");
const assert = require("node:assert/strict");

const {
  toAmount,
  sum,
  calculateMonth,
  expenseNetValue,
} = require("../js/calculations.js");

if (typeof global.structuredClone !== "function") {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

const baseSettings = {
  fixedCharges: [
    { id: "a", label: "Loyer", amount: 800 },
    { id: "b", label: "Électricité", amount: 120 },
  ],
  subscriptions: [{ id: "c", label: "Netflix", amount: 15 }],
  savings: [{ id: "d", label: "Épargne", amount: 100 }],
  credits: [{ id: "e", label: "Crédit auto", amount: 250 }],
};

test("toAmount transforme correctement les entrées non numériques", () => {
  assert.equal(toAmount("42.5"), 42.5);
  assert.equal(toAmount(undefined), 0);
  assert.equal(toAmount("abc"), 0);
  assert.equal(toAmount(Infinity), 0);
});

test("sum gère les listes vides ou mal formées", () => {
  assert.equal(sum([]), 0);
  assert.equal(sum(null), 0);
  assert.equal(
    sum([
      { amount: 10 },
      { amount: "5.5" },
      { amount: "foo" },
      {},
    ]),
    15.5,
  );
});

test("calculateMonth agrège revenus, charges et remboursements", () => {
  global.appData = { settings: baseSettings };
  const month = {
    carryOver: 100,
    incomes: [
      { amount: 2000 },
      { amount: 500 },
    ],
    variableCharges: [
      { amount: 150 },
      { amount: 50 },
    ],
    expenses: [
      { amount: 120 },
      { amount: 60, isRefund: true },
    ],
  };

  const result = calculateMonth(month);

  assert.equal(result.income, 2500);
  assert.equal(result.expensesNet, 60);
  assert.equal(
    result.totalCharges,
    800 + 120 + 15 + 100 + 250 + 200 + 60,
  );
  assert.equal(result.balance, 100 + 2500 - result.totalCharges);
});

test("calculateMonth gère l'ancien champ refund", () => {
  global.appData = { settings: baseSettings };
  const month = {
    carryOver: 0,
    incomes: [],
    variableCharges: [],
    expenses: [
      { amount: 200, refund: 50 },
      { amount: 0, refund: 30 },
    ],
  };

  const result = calculateMonth(month);

  assert.equal(result.expensesNet, 120);
});

test("calculateMonth résiste aux champs manquants", () => {
  global.appData = { settings: baseSettings };
  const result = calculateMonth({});
  assert.equal(result.income, 0);
  assert.equal(result.expensesNet, 0);
  assert.equal(result.totalCharges, 800 + 120 + 15 + 100 + 250);
});

test("expenseNetValue déduit les montants remboursés", () => {
  assert.equal(
    expenseNetValue({ amount: 75, isRefund: true }),
    -75,
  );
  assert.equal(
    expenseNetValue({ amount: 100, refund: 25 }),
    75,
  );
  assert.equal(
    expenseNetValue({ amount: 0, refund: 40 }),
    -40,
  );
});
