function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sum(list) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  return list.reduce((t, item) => t + toAmount(item.amount), 0);
}

function calculateMonth(month) {
  const income = sum(month?.incomes);
  const variable = sum(month?.variableCharges);
  const expenses = Array.isArray(month?.expenses) ? month.expenses : [];
  const expensesNet = expenses.reduce(
    (total, expense) => total + expenseNetValue(expense),
    0,
  );

  const s = appData.settings;

  const fixed = sum(s.fixedCharges);
  const subs = sum(s.subscriptions);
  const savings = sum(s.savings);
  const credits = sum(s.credits);

  const totalCharges =
    fixed + subs + savings + credits + variable + expensesNet;
  const balance = month.carryOver + income - totalCharges;

  return { income, totalCharges, expensesNet, balance };
}

function expenseNetValue(expense = {}) {
  const amount = toAmount(expense.amount);
  if (expense.isRefund === true) return -amount;

  const refund = toAmount(expense.refund);
  if (!amount && refund > 0) return -refund;
  return amount - refund;
}

if (typeof module !== "undefined") {
  module.exports = {
    toAmount,
    sum,
    calculateMonth,
    expenseNetValue,
  };
}
