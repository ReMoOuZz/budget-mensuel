// js/dashboard.js
// Dépendances: store.js (appData, saveData) + calculations.js (calculateMonth)

const DEFAULT_INCOME_PLACEHOLDERS = [
  "Salaire principal",
  "Salaire secondaire",
  "Autres revenus",
];

const PIE_CHART_COLORS = {
  global: ["#ff7b8f", "#6fe7c8", "#a883ff"],
  balance: ["#ff7b8f", "#5bfab5", "#ffb347"],
  savings: ["#a883ff", "#6fe7c8", "#ed51ff", "#ff7b8f", "#ffb347"],
};

const PIE_LABEL_COLOR = "#f6f2ff";
const CHARGES_COMPARISON_COLORS = [
  "#ff7b8f",
  "#a883ff",
  "#ffb347",
  "#6fe7c8",
  "#5bfab5",
];

const DOUGHNUT_LABELS_PLUGIN = {
  id: "doughnutLabels",
  afterDatasetsDraw(chart) {
    if (chart.config.type !== "doughnut") return;
    const { ctx, data } = chart;
    const dataset = data.datasets[0];
    if (!dataset) return;
    const metas = chart.getDatasetMeta(0);
    ctx.save();
    ctx.fillStyle = PIE_LABEL_COLOR;
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    metas.data.forEach((arc, index) => {
      const value = dataset.data[index];
      if (!value) return;
      const label = data.labels[index];
      if (!label) return;
      const { x, y } = arc.tooltipPosition();
      const text = label.length > 14 ? `${label.slice(0, 11)}…` : label;
      ctx.fillText(text, x, y);
    });
    ctx.restore();
  },
};

if (typeof Chart !== "undefined" && Chart.register) {
  Chart.register(DOUGHNUT_LABELS_PLUGIN);
}

const PIE_OPTIONS = {
  responsive: true,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        color: "#f6f2ff",
      },
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const label = context.label || "";
          const raw = Number(context.raw) || 0;
          return `${label}: ${money(raw)} €`;
        },
      },
    },
  },
  animation: {
    duration: 350,
  },
  cutout: "60%",
};

const MAX_HISTORY_ENTRIES = 1;
const pieCharts = {
  global: null,
  balance: null,
  savings: null,
};
let chargesComparisonChart = null;

let currentMonthKey = getInitialMonthKey();

document.addEventListener("DOMContentLoaded", () => {
  initMonthSelector();
  initMonthButtons();
  initTabs();
  initExpenseForm();
  initVariableChargeForm();
  initSavingsCategoryForm();
  ensureTodayDefault("expDate");
  ensureTodayDefault("varDate");
  render();
});

/* -----------------------------
   Init helpers
------------------------------ */

function getInitialMonthKey() {
  // Si le mois courant existe, on le prend, sinon on prend le dernier mois existant.
  const nowKey = getYYYYMM(new Date());
  if (appData.months[nowKey]) return nowKey;

  const keys = Object.keys(appData.months).sort();
  return keys[keys.length - 1] || nowKey;
}

function getYYYYMM(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(yyyyMm, delta) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return getYYYYMM(d);
}

function getPreviousMonthKey(key) {
  return addMonths(key, -1);
}

function ensureTodayDefault(inputId = "expDate") {
  const dateInput = document.getElementById(inputId);
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
}

/* -----------------------------
   Month selector + actions
------------------------------ */

function initMonthSelector() {
  const sel = document.getElementById("monthSelector");
  sel.addEventListener("change", (e) => {
    currentMonthKey = e.target.value;
    render();
    toast(`Mois sélectionné : ${currentMonthKey}`);
  });

  rebuildMonthSelectorOptions();
  sel.value = currentMonthKey;
}

function rebuildMonthSelectorOptions() {
  const sel = document.getElementById("monthSelector");
  const keys = Object.keys(appData.months).sort();

  sel.innerHTML = "";
  keys.forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k;
    sel.appendChild(opt);
  });
}

function initMonthButtons() {
  document.getElementById("newMonthBtn").addEventListener("click", () => {
    const nextKey = addMonths(currentMonthKey, 1);
    if (appData.months[nextKey]) {
      toast(`Le mois ${nextKey} existe déjà.`, "warn");
      return;
    }
    createMonthFromTemplatesWithCarryOver(nextKey);
    switchToMonth(nextKey);
  });
}

function initTabs() {
  const tabs = document.querySelectorAll(".tab[data-tab-target]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tabTarget;
      if (target) {
        activateTab(target);
      }
    });
  });

  const defaultTab =
    document.querySelector(".tab.is-active")?.dataset.tabTarget || "check";
  activateTab(defaultTab);
}

function activateTab(targetKey) {
  const tabs = document.querySelectorAll(".tab[data-tab-target]");
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tabTarget === targetKey;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    if (isActive) {
      tab.removeAttribute("tabindex");
    } else {
      tab.setAttribute("tabindex", "-1");
    }
  });

  const panels = document.querySelectorAll("[data-tab-panel]");
  panels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === targetKey;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function switchToMonth(key) {
  currentMonthKey = key;
  rebuildMonthSelectorOptions();
  document.getElementById("monthSelector").value = key;
  render();
}

function buildResetIncomes(source = []) {
  if (Array.isArray(source) && source.length) {
    return source.map((income, index) => ({
      id: crypto.randomUUID(),
      label: income.label || "",
      amount: 0,
      placeholder: income.placeholder || getIncomePlaceholderText(index),
    }));
  }

  return DEFAULT_INCOME_PLACEHOLDERS.map((placeholder) => ({
    id: crypto.randomUUID(),
    label: "",
    amount: 0,
    placeholder,
  }));
}

function createBlankMonth(carryOver, incomeTemplate = []) {
  return {
    incomes: buildResetIncomes(incomeTemplate),
    variableCharges: [],
    expenses: [],
    carryOver,
    paidFixedCharges: [],
    paidSubscriptions: [],
    paidCredits: [],
    savingsEntries: [],
  };
}

function createMonthFromTemplatesWithCarryOver(key) {
  // 1) carryOver = pnl (balance) du mois précédent si dispo
  const prevKey = getPreviousMonthKey(key);
  let carryOver = 0;

  if (appData.months[prevKey]) {
    carryOver = calculateMonth(appData.months[prevKey]).balance;
  } else {
    // sinon, essayer de prendre le dernier mois existant
    const keys = Object.keys(appData.months).sort();
    const lastKey = keys[keys.length - 1];
    if (lastKey && appData.months[lastKey]) {
      carryOver = calculateMonth(appData.months[lastKey]).balance;
    }
  }

  const previousIncomes = appData.months[prevKey]?.incomes || [];
  appData.months[key] = createBlankMonth(carryOver, previousIncomes);

  saveData();
  toast(`Mois créé : ${key} (report: ${carryOver}€)`);
}

/* -----------------------------
   Render summary
------------------------------ */

function render() {
  const month = appData.months[currentMonthKey];
  if (!month) return;
  ensureMonthTrackingState(month);

  const calc = calculateMonth(month);

  setText("carryOver", money(month.carryOver));
  setText("totalIncome", money(calc.income));
  setText("totalCharges", money(calc.totalCharges));
  setText("balance", money(calc.balance));
  setText("expensesNet", money(calc.expensesNet));

  renderIncomes();
  renderSettingsSections(month);
  renderSavingsCategories(month);
  renderVariableCharges();
  renderExpenses();
  renderHistory();
  updateCharts(month);
  updateChargesComparisonChart();

  saveData();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0,00";
  return moneyFormatter.format(amount);
}

/* -----------------------------
   Incomes CRUD
------------------------------ */

function renderIncomes() {
  const month = appData.months[currentMonthKey];
  const container = document.getElementById("incomeList");
  container.innerHTML = "";

  month.incomes.forEach((inc, index) => {
    const row = document.createElement("div");
    row.className = "row";
    const placeholder = inc.placeholder || getIncomePlaceholderText(index);

    row.innerHTML = `
      <input class="text" aria-label="Libellé revenu" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(inc.label || "")}" />
      <input class="num" aria-label="Montant revenu" type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" placeholder="0" value="${escapeHtml(formatNumberInputValue(inc.amount, true))}" />
      <button class="danger" title="Supprimer">✕</button>
    `;

    const [labelInput, amountInput, delBtn] =
      row.querySelectorAll("input,button");
    labelInput.dataset.focusKey = `income-label-${inc.id}`;
    amountInput.dataset.focusKey = `income-amount-${inc.id}`;

    labelInput.addEventListener("input", () => {
      inc.label = labelInput.value;
      rerenderPreservingFocus();
    });

    amountInput.addEventListener("input", () => {
      inc.amount = sanitizeAmount(amountInput.value);
      rerenderPreservingFocus();
    });

    delBtn.addEventListener("click", () => {
      if (month.incomes.length <= 3) {
        toast("Minimum conseillé: 2 salaires + autres.", "warn");
        return;
      }
      month.incomes = month.incomes.filter((x) => x.id !== inc.id);
      toast("Revenu supprimé.");
      render();
    });

    container.appendChild(row);
  });
}

window.addIncome = function addIncome() {
  const month = appData.months[currentMonthKey];
  month.incomes.push({
    id: crypto.randomUUID(),
    label: "",
    amount: 0,
    placeholder: getIncomePlaceholderText(month.incomes.length),
  });
  toast("Revenu ajouté.");
  render();
};

function getIncomePlaceholderText(index) {
  if (!Number.isInteger(index) || index < 0) return "Revenu";
  return DEFAULT_INCOME_PLACEHOLDERS[index] || `Revenu ${index + 1}`;
}

window.adjustCarryOver = function adjustCarryOver() {
  const month = appData.months[currentMonthKey];
  if (!month) return;

  const currentValue = Number(month.carryOver) || 0;
  const input = prompt(
    "Report manuel (positif ou négatif) à intégrer au calcul :",
    currentValue.toString(),
  );
  if (input === null) return;

  const normalized = input.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    toast("Montant invalide.", "warn");
    return;
  }

  month.carryOver = value;
  toast(`Report mis à jour : ${money(value)} €.`);
  render();
};

/* -----------------------------
   Recurring settings lists (read-only)
------------------------------ */

const MONTH_TOGGLE_FIELDS = [
  "paidFixedCharges",
  "paidSubscriptions",
  "paidCredits",
];

const SETTINGS_SECTIONS = [
  {
    key: "fixedCharges",
    listId: "fixedChargesList",
    totalId: "fixedChargesTotal",
    empty: "Aucune charge fixe définie. Ouvrez la page Ajuster montants.",
    toggleField: "paidFixedCharges",
    rowClass: "row-fixed-charge",
  },
  {
    key: "subscriptions",
    listId: "subscriptionsList",
    totalId: "subscriptionsTotal",
    empty: "Aucun abonnement configuré.",
    toggleField: "paidSubscriptions",
    rowClass: "row-subscription",
  },
  {
    key: "savings",
    listId: "savingsList",
    totalId: "savingsTotal",
    empty: "Aucun virement d'épargne configuré.",
  },
  {
    key: "credits",
    listId: "creditsList",
    totalId: "creditsTotal",
    empty: "Aucun crédit configuré.",
    toggleField: "paidCredits",
    rowClass: "row-credit",
  },
];

function ensureMonthTrackingState(month) {
  if (!month) return;
  MONTH_TOGGLE_FIELDS.forEach((field) => {
    if (!Array.isArray(month[field])) {
      month[field] = [];
    }
  });
  if (!Array.isArray(month.savingsEntries)) {
    month.savingsEntries = [];
  }
}

function renderSettingsSections(month) {
  const settings = appData.settings || {};
  SETTINGS_SECTIONS.forEach((section) => {
    const list = Array.isArray(settings[section.key])
      ? settings[section.key]
      : [];
    renderSettingsSection(list, section, month);
  });
}

function renderSettingsSection(list, config, month) {
  const container = document.getElementById(config.listId);
  if (!container) return;
  container.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = config.empty;
    container.appendChild(empty);
  } else {
    list.forEach((item) => {
      const isToggleable = Boolean(config.toggleField);
      const rowClasses = ["row", "row-readonly"];
      if (isToggleable) rowClasses.push("row-recurring-toggle");
      if (config.rowClass) rowClasses.push(config.rowClass);

      const row = document.createElement("div");
      row.className = rowClasses.join(" ");
      const amountValue =
        config.key === "savings"
          ? getSavingsCategoryTotal(month, item.id)
          : toNumber(item.amount);
      row.innerHTML = `
        <span class="label">${escapeHtml(item.label)}</span>
        <span class="amount">${money(amountValue)} €</span>
      `;

      if (isToggleable) {
        row.dataset.recurringId = item.id;
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        const paidList = month?.[config.toggleField] || [];
        const isPaid = Array.isArray(paidList) && paidList.includes(item.id);
        row.classList.toggle("is-paid", isPaid);
        row.setAttribute("aria-pressed", String(isPaid));
        const toggle = () =>
          handleRecurringToggle(month, config.toggleField, item.id, row);
        row.addEventListener("click", toggle);
        row.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            toggle();
          }
        });
      }

      container.appendChild(row);
    });
  }

  if (config.totalId) {
    const totalValue =
      config.key === "savings" ? getSavingsTotal(month) : sum(list);
    setText(config.totalId, money(totalValue));
  }
}

function handleRecurringToggle(month, field, entryId, element) {
  if (!month || !field || !entryId || !element) return;
  ensureMonthTrackingState(month);
  const paidList = month[field];
  if (!Array.isArray(paidList)) return;

  const existingIndex = paidList.indexOf(entryId);
  const isRemoving = existingIndex >= 0;
  if (isRemoving) {
    paidList.splice(existingIndex, 1);
  } else {
    paidList.push(entryId);
  }

  const isPaid = !isRemoving;
  element.classList.toggle("is-paid", isPaid);
  element.setAttribute("aria-pressed", String(isPaid));
  element.classList.add("is-animating");
  setTimeout(() => element.classList.remove("is-animating"), 150);
  saveData();
}

/* -----------------------------
   Variable charges CRUD
------------------------------ */

function renderVariableCharges() {
  const month = appData.months[currentMonthKey];
  if (!month) return;
  normalizeVariableCharges(month);

  const tbody = document.getElementById("variableChargesTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = [...month.variableCharges].sort((a, b) => {
    const dateA = a.dateISO || "";
    const dateB = b.dateISO || "";
    const cmp = dateA.localeCompare(dateB);
    if (cmp !== 0) return cmp;
    return (a.label || "").localeCompare(b.label || "");
  });

  sorted.forEach((charge) => {
    const tr = document.createElement("tr");
    tr.dataset.variableId = charge.id;
    tr.tabIndex = -1;
    tr.innerHTML = `
      <td>${escapeHtml(charge.dateISO || "—")}</td>
      <td>${escapeHtml(formatExpenseLabel(charge.label))}</td>
      <td class="expense-amount expense">−${money(charge.amount)} €</td>
      <td>
        <button class="danger variable-delete" aria-label="Supprimer">
          Supprimer
        </button>
      </td>
    `;

    tr.querySelector("button").addEventListener("click", () => {
      month.variableCharges = month.variableCharges.filter(
        (entry) => entry.id !== charge.id,
      );
      toast("Charge variable supprimée.");
      render();
    });

    tbody.appendChild(tr);
  });

  const total = sum(month.variableCharges);
  setText("variableChargesTotal", money(total));
  focusLatestVariableChargeRow(tbody);
}

function normalizeVariableCharges(month) {
  if (!Array.isArray(month.variableCharges)) {
    month.variableCharges = [];
  }
  const fallbackDate = currentMonthKey
    ? `${currentMonthKey}-01`
    : new Date().toISOString().slice(0, 10);
  month.variableCharges.forEach((entry) => {
    if (!entry.id) entry.id = crypto.randomUUID();
    if (!isValidDate(entry.dateISO)) entry.dateISO = fallbackDate;
    entry.amount = sanitizeAmount(entry.amount);
    if (typeof entry.label !== "string") entry.label = "";
  });
}

/* -----------------------------
   Savings manager
------------------------------ */

function initSavingsCategoryForm() {
  const form = document.getElementById("savingsCategoryForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("savingsCategoryInput");
    if (!input) return;
    const label = input.value.trim();
    if (!label) {
      toast("Nom de catégorie requis.", "warn");
      return;
    }
    addSavingsCategory(label);
    form.reset();
  });
}

function getSavingsCategories() {
  if (!appData.settings) appData.settings = {};
  if (!Array.isArray(appData.settings.savings)) {
    appData.settings.savings = [];
  }
  return appData.settings.savings;
}

function addSavingsCategory(label) {
  const categories = getSavingsCategories();
  categories.push({
    id: crypto.randomUUID(),
    label: formatExpenseLabel(label),
  });
  toast("Catégorie d'épargne ajoutée.");
  render();
}

function deleteSavingsCategory(categoryId) {
  if (!categoryId) return;
  const categories = getSavingsCategories();
  const index = categories.findIndex((cat) => cat.id === categoryId);
  if (index === -1) return;
  categories.splice(index, 1);
  Object.values(appData.months || {}).forEach((month) => {
    if (Array.isArray(month?.savingsEntries)) {
      month.savingsEntries = month.savingsEntries.filter(
        (entry) => entry.categoryId !== categoryId,
      );
    }
  });
  toast("Catégorie supprimée.");
  render();
}

function renderSavingsCategories(month) {
  const container = document.getElementById("savingsCategories");
  if (!container) return;
  container.innerHTML = "";

  const categories = getSavingsCategories();
  if (!categories.length) {
    const empty = document.createElement("p");
    empty.className = "savings-entry-empty";
    empty.textContent =
      "Ajoutez une catégorie d'épargne pour commencer à suivre vos virements.";
    container.appendChild(empty);
  } else {
    categories.forEach((category) => {
      container.appendChild(buildSavingsCategoryCard(category, month));
    });
  }

  const total = getSavingsTotal(month);
  setText("savingsMonthTotal", money(total));
  setText("savingsTotal", money(total));
}

function buildSavingsCategoryCard(category, month) {
  const card = document.createElement("div");
  card.className = "savings-category-card";
  card.dataset.categoryId = category.id;

  const header = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = category.label || "Sans nom";
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "danger icon-only";
  deleteBtn.title = `Supprimer ${category.label}`;
  deleteBtn.textContent = "✕";
  deleteBtn.addEventListener("click", () => deleteSavingsCategory(category.id));
  header.appendChild(title);
  header.appendChild(deleteBtn);

  const form = document.createElement("form");
  form.className = "savings-entry-form";
  form.innerHTML = `
    <input
      name="amount"
      type="text"
      inputmode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      placeholder="Montant"
    />
    <input name="date" type="date" />
    <button class="primary" type="submit">+ Ajouter</button>
  `;
  const dateInput = form.querySelector('input[name="date"]');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSavingsEntrySubmit(category.id, form);
  });

  const entries = getSavingsEntriesForCategory(month, category.id);

  let entriesNode;
  if (!entries.length) {
    entriesNode = document.createElement("p");
    entriesNode.className = "savings-entry-empty";
    entriesNode.textContent = "Aucun virement enregistré pour ce mois.";
  } else {
    entriesNode = document.createElement("table");
    entriesNode.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Montant</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = entriesNode.querySelector("tbody");
    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(entry.dateISO || "—")}</td>
        <td class="expense-amount expense">−${money(entry.amount)} €</td>
        <td><button class="danger">Supprimer</button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => {
        deleteSavingsEntry(entry.id);
      });
      tbody.appendChild(tr);
    });
  }

  const subtotal = document.createElement("p");
  subtotal.className = "savings-month-total";
  subtotal.textContent = `Total catégorie : ${money(getSavingsCategoryTotal(month, category.id))} €`;

  card.appendChild(header);
  card.appendChild(form);
  card.appendChild(entriesNode);
  card.appendChild(subtotal);
  return card;
}

function handleSavingsEntrySubmit(categoryId, form) {
  const amountInput = form.querySelector('input[name="amount"]');
  const dateInput = form.querySelector('input[name="date"]');
  const amount = sanitizeAmount(amountInput?.value);
  const dateISO = dateInput?.value;

  if (amount <= 0) {
    toast("Montant invalide.", "warn");
    return;
  }
  if (!isValidDate(dateISO)) {
    toast("Date invalide.", "warn");
    return;
  }

  const month = appData.months[currentMonthKey];
  ensureMonthTrackingState(month);
  month.savingsEntries.push({
    id: crypto.randomUUID(),
    categoryId,
    label: "",
    amount,
    dateISO,
  });

  toast("Épargne ajoutée.");
  form.reset();
  const dateField = form.querySelector('input[name="date"]');
  if (dateField) dateField.value = new Date().toISOString().slice(0, 10);
  render();
}

function deleteSavingsEntry(entryId) {
  if (!entryId) return;
  const month = appData.months[currentMonthKey];
  if (!Array.isArray(month?.savingsEntries)) return;
  month.savingsEntries = month.savingsEntries.filter(
    (entry) => entry.id !== entryId,
  );
  toast("Entrée d'épargne supprimée.");
  render();
}

function getSavingsEntries(month) {
  if (!month || !Array.isArray(month.savingsEntries)) return [];
  return month.savingsEntries;
}

function getSavingsEntriesForCategory(month, categoryId) {
  return getSavingsEntries(month)
    .filter((entry) => entry.categoryId === categoryId)
    .sort((a, b) => (a.dateISO || "").localeCompare(b.dateISO || ""));
}

function getSavingsTotalsByCategory(month) {
  const totals = {};
  getSavingsEntries(month).forEach((entry) => {
    const key = entry.categoryId;
    if (!key) return;
    totals[key] = (totals[key] || 0) + toNumber(entry.amount);
  });
  return totals;
}

function getSavingsCategoryTotal(month, categoryId) {
  if (!categoryId) return 0;
  const totals = getSavingsTotalsByCategory(month);
  return totals[categoryId] || 0;
}

function getSavingsTotal(month) {
  return getSavingsEntries(month).reduce(
    (sum, entry) => sum + toNumber(entry.amount),
    0,
  );
}

/* -----------------------------
   Expenses: form + table + sort
------------------------------ */

let expenseSort = { key: "dateISO", dir: "asc" };
let lastCreatedExpenseId = null;
let lastVariableChargeId = null;

function initExpenseForm() {
  const form = document.getElementById("expenseForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const label = document.getElementById("expLabel").value.trim();
    const amount = sanitizeAmount(document.getElementById("expAmount").value);
    const isRefund = document.getElementById("expIsRefund").checked;
    const dateISO = document.getElementById("expDate").value;
    const importance = document.getElementById("expImportance").value;

    if (!label) return toast("Objet obligatoire.", "warn");
    if (amount < 0) return toast("Montant invalide.", "warn");
    if (!isValidDate(dateISO)) return toast("Date invalide.", "warn");

    const month = appData.months[currentMonthKey];
    const newExpense = {
      id: crypto.randomUUID(),
      label,
      amount,
      dateISO,
      importance,
      isRefund,
    };
    month.expenses.push(newExpense);
    lastCreatedExpenseId = newExpense.id;
    expenseSort = { key: "dateISO", dir: "asc" };

    form.reset();
    ensureTodayDefault("expDate");
    document.getElementById("expIsRefund").checked = false;
    toast("Dépense ajoutée.");
    render();
  });

  // Click tri sur headers (simple + efficace)
  const expenseTable = document.querySelector(".expenses-card table");
  const headers = expenseTable
    ? expenseTable.querySelectorAll("thead th")
    : null;
  if (headers?.length) {
    // Date, Type, Objet, Montant, Importance, (actions)
    headers[0].style.cursor = "pointer";
    headers[3].style.cursor = "pointer";
    headers[4].style.cursor = "pointer";

    headers[0].addEventListener("click", () => setSort("dateISO"));
    headers[3].addEventListener("click", () => setSort("amount"));
    headers[4].addEventListener("click", () => setSort("importance"));
  }
}

function initVariableChargeForm() {
  const form = document.getElementById("variableChargeForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const label = document.getElementById("varLabel").value.trim();
    const amount = sanitizeAmount(document.getElementById("varAmount").value);
    const dateISO = document.getElementById("varDate").value;

    if (!label) return toast("Objet obligatoire.", "warn");
    if (amount < 0) return toast("Montant invalide.", "warn");
    if (!isValidDate(dateISO)) return toast("Date invalide.", "warn");

    const month = appData.months[currentMonthKey];
    const newCharge = {
      id: crypto.randomUUID(),
      label,
      amount,
      dateISO,
    };
    month.variableCharges.push(newCharge);
    lastVariableChargeId = newCharge.id;

    form.reset();
    ensureTodayDefault("varDate");
    toast("Charge variable ajoutée.");
    render();
  });
}

function setSort(key) {
  if (expenseSort.key === key) {
    expenseSort.dir = expenseSort.dir === "asc" ? "desc" : "asc";
  } else {
    expenseSort.key = key;
    expenseSort.dir = "asc";
  }
  render();
}

function renderExpenses() {
  const month = appData.months[currentMonthKey];
  const tbody = document.getElementById("expensesTable");
  tbody.innerHTML = "";

  const sorted = [...month.expenses].sort((a, b) => compareExpense(a, b));

  sorted.forEach((e) => {
    const tr = document.createElement("tr");
    tr.dataset.expenseId = e.id;
    tr.tabIndex = -1;
    tr.className = importanceClass(e.importance);
    const descriptor = describeExpense(e);
    const amountText = `${descriptor.type === "refund" ? "+" : "−"}${money(descriptor.display)}`;
    const amountClass = `expense-amount ${descriptor.type === "refund" ? "refund" : "expense"}`;
    const flagIcon = descriptor.type === "refund" ? "↗" : "↘";
    const flagClass = `flag ${descriptor.type === "refund" ? "refund" : "expense"}`;

    const label = formatExpenseLabel(e.label);
    const importanceLabel = formatImportanceLabel(e.importance);

    tr.innerHTML = `
      <td>${escapeHtml(e.dateISO)}</td>
      <td class="expense-flag"><span class="${flagClass}">${flagIcon}</span></td>
      <td>${escapeHtml(label)}</td>
      <td class="${amountClass}">${amountText} €</td>
      <td>${escapeHtml(importanceLabel)}</td>
      <td><button class="danger">Supprimer</button></td>
    `;

    tr.querySelector("button").addEventListener("click", () => {
      month.expenses = month.expenses.filter((x) => x.id !== e.id);
      toast("Dépense supprimée.");
      render();
    });

    tbody.appendChild(tr);
  });

  focusLatestExpenseRow(tbody);
}

function renderHistory() {
  const container = document.getElementById("previousReports");
  if (!container) return;
  container.innerHTML = "";

  const historyKeys = getPreviousMonthKeys(currentMonthKey, MAX_HISTORY_ENTRIES);
  if (!historyKeys.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent =
      "Aucun mois précédent n'est disponible pour l'instant.";
    container.appendChild(empty);
    return;
  }

  historyKeys.forEach((key) => {
    const month = appData.months[key];
    const calc = calculateMonth(month);
    const item = document.createElement("div");
    item.className = `history-item ${calc.balance >= 0 ? "positive" : "negative"}`;
    item.innerHTML = `
      <span class="label">${escapeHtml(formatMonthLabel(key))}</span>
      <span class="value">${money(calc.balance)} €</span>
    `;
    container.appendChild(item);
  });
}

function getPreviousMonthKeys(currentKey, limit = MAX_HISTORY_ENTRIES) {
  const keys = Object.keys(appData.months || {});
  const previous = keys
    .filter((key) => key < currentKey)
    .sort();
  return previous.slice(-limit).reverse();
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

/* -----------------------------
   Charts
------------------------------ */

function updateCharts(month) {
  updateGlobalSpendingChart(month);
  updateIncomeVsChargesChart(month);
  updateSavingsChart(month);
}

function updateGlobalSpendingChart(month) {
  const settings = appData.settings || {};
  const chargesTotal =
    sum(settings.fixedCharges) +
    sum(settings.subscriptions) +
    sum(settings.credits) +
    sum(month.variableCharges);
  const savingsTotal = getSavingsTotal(month);
  const expensesTotal = getPositiveExpensesTotal(month.expenses);

  const labels = ["Charges", "Épargne", "Dépenses courantes"];
  const data = [chargesTotal, savingsTotal, expensesTotal];

  updatePieChart(
    "global",
    "globalSpendingPie",
    "globalSpendingEmpty",
    labels,
    data,
    PIE_CHART_COLORS.global,
  );
}

function updateIncomeVsChargesChart(month) {
  const calc = calculateMonth(month);
  const totalIncome = Math.max(calc.income, 0);
  const totalCharges = Math.max(calc.totalCharges, 0);
  const chargesWithinIncome = Math.min(totalCharges, totalIncome);
  const remainingIncome = Math.max(totalIncome - totalCharges, 0);
  const shortage = Math.max(totalCharges - totalIncome, 0);

  const labels = [];
  const data = [];

  labels.push("Charges");
  data.push(chargesWithinIncome);

  if (remainingIncome > 0) {
    labels.push("Reste à vivre");
    data.push(remainingIncome);
  }

  if (shortage > 0) {
    labels.push("Dépassement");
    data.push(shortage);
  }

  updatePieChart(
    "balance",
    "incomeChargesPie",
    "incomeChargesEmpty",
    labels,
    data,
    PIE_CHART_COLORS.balance,
  );
}

function updateSavingsChart(month) {
  const categories = getSavingsCategories();
  const totals = getSavingsTotalsByCategory(month);
  const labels = [];
  const data = [];

  categories.forEach((category) => {
    const amount = toNumber(totals[category.id]);
    if (amount > 0) {
      labels.push(category.label || "Épargne");
      data.push(amount);
    }
  });

  updatePieChart(
    "savings",
    "savingsPie",
    "savingsChartEmpty",
    labels,
    data,
    PIE_CHART_COLORS.savings,
  );
}

function updateChargesComparisonChart() {
  const canvas = document.getElementById("chargesComparisonChart");
  const emptyState = document.getElementById("chargesComparisonEmpty");
  if (!canvas || !emptyState || typeof Chart === "undefined") return;

  const currentMonth = appData.months[currentMonthKey];
  const prevKey = getPreviousMonthKey(currentMonthKey);
  const prevMonth = appData.months[prevKey];

  const settings = appData.settings || {};
  const fixedTotal = sum(settings.fixedCharges);
  const subscriptionsTotal = sum(settings.subscriptions);
  const creditsTotal = sum(settings.credits);

  if (!currentMonth || !prevMonth) {
    if (chargesComparisonChart) {
      chargesComparisonChart.destroy();
      chargesComparisonChart = null;
    }
    canvas.style.display = "none";
    emptyState.hidden = false;
    return;
  }

  const prevVariable = sum(prevMonth.variableCharges);
  const currentVariable = sum(currentMonth.variableCharges);
  const prevSavings = getSavingsTotal(prevMonth);
  const currentSavings = getSavingsTotal(currentMonth);
  const labels = [formatMonthLabel(prevKey), formatMonthLabel(currentMonthKey)];

  const datasetsConfig = [
    { label: "Charges fixes", data: [fixedTotal, fixedTotal] },
    { label: "Abonnements", data: [subscriptionsTotal, subscriptionsTotal] },
    { label: "Crédits", data: [creditsTotal, creditsTotal] },
    { label: "Charges variables", data: [prevVariable, currentVariable] },
    { label: "Épargne", data: [prevSavings, currentSavings] },
  ];

  const hasData = datasetsConfig.some((dataset) =>
    dataset.data.some((value) => Number(value) > 0),
  );

  if (!hasData) {
    if (chargesComparisonChart) {
      chargesComparisonChart.destroy();
      chargesComparisonChart = null;
    }
    canvas.style.display = "none";
    emptyState.hidden = false;
    return;
  }

  const datasets = datasetsConfig.map((dataset, index) => {
    const isTopLayer = index === datasetsConfig.length - 1;
    return {
      label: dataset.label,
      data: dataset.data,
      backgroundColor:
        CHARGES_COMPARISON_COLORS[index % CHARGES_COMPARISON_COLORS.length],
      stack: "charges",
      borderSkipped: false,
      borderRadius: isTopLayer ? { topLeft: 10, topRight: 10 } : 0,
    };
  });

  const chartData = {
    labels,
    datasets,
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { color: "#f6f2ff" } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${money(context.raw)} €`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
        ticks: {
          callback: (value) => `${money(value)} €`,
          color: "#f6f2ff",
        },
        grid: {
          color: "rgba(255,255,255,0.12)",
        },
      },
      x: {
        stacked: true,
        ticks: { color: "#f6f2ff" },
        grid: { display: false },
      },
    },
  };

  if (!chargesComparisonChart) {
    chargesComparisonChart = new Chart(canvas, {
      type: "bar",
      data: chartData,
      options: chartOptions,
    });
  } else {
    chargesComparisonChart.data = chartData;
    chargesComparisonChart.options = chartOptions;
    chargesComparisonChart.update();
  }

  canvas.style.display = "block";
  emptyState.hidden = true;
}

function getPositiveExpensesTotal(expenses) {
  if (!Array.isArray(expenses)) return 0;
  return expenses.reduce((total, expense) => {
    const value = expenseNetValue(expense);
    return value > 0 ? total + value : total;
  }, 0);
}

function updatePieChart(key, canvasId, emptyId, labels, data, baseColors) {
  const normalizedData = data.map((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
  });
  const hasData = normalizedData.some((value) => value > 0);
  toggleChartEmpty(canvasId, emptyId, hasData);

  if (!hasData || typeof Chart === "undefined") {
    return;
  }

  const chart = ensurePieChart(key, canvasId);
  if (!chart) return;

  chart.data.labels = labels;
  chart.data.datasets[0].data = normalizedData;
  chart.data.datasets[0].backgroundColor = buildColorSet(
    baseColors,
    normalizedData.length,
  );
  chart.update();
}

function ensurePieChart(key, canvasId) {
  if (pieCharts[key]) return pieCharts[key];
  if (typeof Chart === "undefined") return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  pieCharts[key] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [],
          borderWidth: 0,
        },
      ],
    },
    options: PIE_OPTIONS,
  });
  return pieCharts[key];
}

function buildColorSet(baseColors = [], length = 0) {
  if (!length) return [];
  if (!Array.isArray(baseColors) || !baseColors.length) {
    return Array.from({ length }, () => "#a883ff");
  }
  const colors = [];
  for (let i = 0; i < length; i += 1) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}

function toggleChartEmpty(canvasId, emptyId, hasData) {
  const canvas = document.getElementById(canvasId);
  if (canvas) {
    canvas.style.display = hasData ? "block" : "none";
  }
  const empty = document.getElementById(emptyId);
  if (empty) {
    empty.hidden = hasData;
  }
}

function compareExpense(a, b) {
  const dir = expenseSort.dir === "asc" ? 1 : -1;
  const key = expenseSort.key;

  if (key === "dateISO") return a.dateISO.localeCompare(b.dateISO) * dir;
  if (key === "amount") {
    return (describeExpense(a).net - describeExpense(b).net) * dir;
  }

  if (key === "importance") {
    const rank = { faible: 1, modéré: 2, important: 3 };
    return (rank[a.importance] - rank[b.importance]) * dir;
  }

  return 0;
}

function importanceClass(imp) {
  if (imp === "important") return "imp-high";
  if (imp === "modéré") return "imp-med";
  return "imp-low";
}

function focusLatestExpenseRow(tbody) {
  if (!lastCreatedExpenseId) return;
  const selectorId = escapeSelectorKey(lastCreatedExpenseId);
  const row = tbody.querySelector(`[data-expense-id=\"${selectorId}\"]`);
  if (!row) {
    lastCreatedExpenseId = null;
    return;
  }
  row.classList.add("is-latest");
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const focusTarget = row.querySelector("button") || row;
  if (focusTarget && focusTarget.focus) {
    try {
      focusTarget.focus({ preventScroll: true });
    } catch {
      focusTarget.focus();
    }
  }
  lastCreatedExpenseId = null;
}

function focusLatestVariableChargeRow(tbody) {
  if (!lastVariableChargeId) return;
  const selectorId = escapeSelectorKey(lastVariableChargeId);
  const row = tbody.querySelector(`[data-variable-id=\"${selectorId}\"]`);
  if (!row) {
    lastVariableChargeId = null;
    return;
  }
  row.classList.add("is-latest");
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const focusTarget = row.querySelector("button") || row;
  if (focusTarget && focusTarget.focus) {
    try {
      focusTarget.focus({ preventScroll: true });
    } catch {
      focusTarget.focus();
    }
  }
  lastVariableChargeId = null;
}

/* -----------------------------
   Validation + UI
------------------------------ */

function rerenderPreservingFocus() {
  withPreservedInputFocus(render);
}

function withPreservedInputFocus(callback) {
  const active = document.activeElement;
  const isEditable =
    active && active.matches && active.matches("input, textarea");
  const snapshot = isEditable
    ? {
        key: active.dataset.focusKey,
        selectionStart: active.selectionStart,
        selectionEnd: active.selectionEnd,
        value: active.value,
      }
    : null;

  callback();

  if (!snapshot?.key) return;

  const target = document.querySelector(
    `[data-focus-key="${escapeSelectorKey(snapshot.key)}"]`,
  );
  if (!target) return;

  target.focus({ preventScroll: true });
  if (typeof snapshot.value === "string") {
    target.value = snapshot.value;
  }
  if (
    target.setSelectionRange &&
    typeof snapshot.selectionStart === "number" &&
    typeof snapshot.selectionEnd === "number"
  ) {
    const len = target.value?.length ?? 0;
    const start = Math.min(snapshot.selectionStart, len);
    const end = Math.min(snapshot.selectionEnd, len);
    target.setSelectionRange(start, end);
  }
}

function sanitizeAmount(v) {
  const normalized = String(v ?? "")
    .trim()
    .replace(",", ".");
  const n = Number(normalized);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function describeExpense(expense) {
  const amount = toNumber(expense.amount);
  if (expense.isRefund === true) {
    return {
      net: -amount,
      display: amount,
      type: "refund",
    };
  }

  const legacyRefund = toNumber(expense.refund);
  if (expense.isRefund === false) {
    return {
      net: amount - legacyRefund,
      display: amount,
      type: amount - legacyRefund < 0 ? "refund" : "expense",
    };
  }

  if (!amount && legacyRefund > 0) {
    return {
      net: -legacyRefund,
      display: legacyRefund,
      type: "refund",
    };
  }

  const net = amount - legacyRefund;
  return {
    net,
    display: net < 0 ? Math.abs(net) : amount || Math.abs(net),
    type: net < 0 ? "refund" : "expense",
  };
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeSelectorKey(value) {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }
  return String(value).replaceAll('"', '\\"');
}

function formatNumberInputValue(value, blankZero = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (blankZero && n === 0) return "";
  return String(n).replace(".", ",");
}

function formatExpenseLabel(label) {
  if (typeof label !== "string") return "";
  const trimmed = label.trimStart();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function formatImportanceLabel(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "important") return "Important";
  if (normalized === "modéré") return "Modéré";
  if (normalized === "faible") return "Faible";
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isValidDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime());
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message, type = "ok") {
  // Toast minimaliste (sans lib externe)
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
}
