(function (global) {
  const syncedSavingsCategoryIds = new Set();

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function defaultToNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function generateId() {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    if (typeof require === "function") {
      try {
        const { randomUUID } = require("node:crypto");
        return randomUUID();
      } catch {
        // ignore
      }
    }
    return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
  }

  function ensureEntryId(entry, prefix = "id") {
    if (!entry.id) {
      entry.id = `${prefix}_${generateId()}`;
    }
    return entry.id;
  }

  function updateSyncedSavings(list = []) {
    syncedSavingsCategoryIds.clear();
    ensureArray(list).forEach((entry) => {
      if (entry?.id) syncedSavingsCategoryIds.add(entry.id);
    });
    return syncedSavingsCategoryIds;
  }

  function getSyncedSavingsCategoryIds() {
    return syncedSavingsCategoryIds;
  }

  function serializeMonth(month, key, options = {}) {
    if (!month) return null;
    const toNumber = typeof options.toNumber === "function"
      ? options.toNumber
      : defaultToNumber;
    const currentDate = typeof options.now === "function"
      ? options.now()
      : new Date().toISOString().slice(0, 10);
    const syncedIds = options.syncedSavingsIds || syncedSavingsCategoryIds;

    const normalizeDate = (value) => value || currentDate;

    return {
      key,
      carryOver: toNumber(month.carryOver),
      incomes: ensureArray(month.incomes).map((income, index) => ({
        id: ensureEntryId(income, "inc"),
        label: income.label || "",
        placeholder: income.placeholder || `Revenu ${index + 1}`,
        amount: toNumber(income.amount),
      })),
      variableCharges: ensureArray(month.variableCharges).map((charge) => ({
        id: ensureEntryId(charge, "var"),
        label: charge.label || "",
        amount: toNumber(charge.amount),
        dateISO: normalizeDate(charge.dateISO || charge.date),
      })),
      expenses: ensureArray(month.expenses).map((expense) => ({
        id: ensureEntryId(expense, "exp"),
        label: expense.label || "",
        amount: toNumber(expense.amount),
        dateISO: normalizeDate(expense.dateISO),
        importance: expense.importance || "",
        isRefund: Boolean(expense.isRefund),
        refund: toNumber(expense.refund),
        category: expense.category || "",
      })),
      paidFixedCharges: ensureArray(month.paidFixedCharges),
      paidSubscriptions: ensureArray(month.paidSubscriptions),
      paidCredits: ensureArray(month.paidCredits),
      savingsEntries: ensureArray(month.savingsEntries).map((entry) => ({
        id: ensureEntryId(entry, "sav"),
        label: entry.label || "",
        amount: toNumber(entry.amount),
        dateISO: normalizeDate(entry.dateISO),
        categoryId:
          entry.categoryId && syncedIds.has(entry.categoryId)
            ? entry.categoryId
            : null,
      })),
    };
  }

  const api = {
    ensureArray,
    ensureEntryId,
    serializeMonth,
    updateSyncedSavings,
    getSyncedSavingsCategoryIds,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (global) {
    global.BudgifySync = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
