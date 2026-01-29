const test = require("node:test");
const assert = require("node:assert/strict");

const {
  serializeMonth,
  updateSyncedSavings,
  getSyncedSavingsCategoryIds,
} = require("../js/sync.js");

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

test("serializeMonth normalise les montants et génère des IDs", () => {
  updateSyncedSavings([]);
  const month = {
    carryOver: "12.5",
    incomes: [{ amount: "1000" }],
    variableCharges: [{ label: "Courses", amount: "50", dateISO: "" }],
    expenses: [{ label: "Restaurant", amount: "30", refund: "10" }],
    paidFixedCharges: ["fc_1"],
    paidSubscriptions: [],
    paidCredits: [],
    savingsEntries: [{ label: "PEA", amount: "200", categoryId: "cat_local" }],
  };

  const payload = serializeMonth(month, "2026-01", {
    toNumber,
    now: () => "2026-01-15",
    syncedSavingsIds: getSyncedSavingsCategoryIds(),
  });

  assert.equal(payload.carryOver, 12.5);
  assert.equal(payload.incomes[0].amount, 1000);
  assert.equal(payload.variableCharges[0].dateISO, "2026-01-15");
  assert.equal(payload.expenses[0].refund, 10);
  assert.ok(payload.incomes[0].id?.startsWith("inc_"));
  assert.equal(payload.savingsEntries[0].categoryId, null);
});

test("serializeMonth conserve categoryId connus", () => {
  updateSyncedSavings([{ id: "cat_synced" }]);
  const month = {
    savingsEntries: [
      { id: "sav1", amount: 100, categoryId: "cat_synced" },
      { id: "sav2", amount: 50, categoryId: "cat_unknown" },
    ],
  };

  const payload = serializeMonth(month, "2026-02", {
    toNumber,
    now: () => "2026-02-01",
    syncedSavingsIds: getSyncedSavingsCategoryIds(),
  });

  assert.equal(payload.savingsEntries[0].categoryId, "cat_synced");
  assert.equal(payload.savingsEntries[1].categoryId, null);
});
