// js/dashboard.js
// Dépendances: store.js (appData, saveData) + calculations.js (calculateMonth)

let currentMonthKey = getInitialMonthKey();

document.addEventListener("DOMContentLoaded", () => {
  initMonthSelector();
  initMonthButtons();
  initExpenseForm();
  ensureTodayDefault();
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

function ensureTodayDefault() {
  const dateInput = document.getElementById("expDate");
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
    const newKey = getYYYYMM(new Date());
    if (appData.months[newKey]) {
      // si le mois courant existe déjà, on crée le mois suivant
      const nextKey = addMonths(newKey, 1);
      createMonthFromTemplatesWithCarryOver(nextKey);
      switchToMonth(nextKey);
      return;
    }
    createMonthFromTemplatesWithCarryOver(newKey);
    switchToMonth(newKey);
  });

  document.getElementById("duplicateMonthBtn").addEventListener("click", () => {
    const nextKey = addMonths(currentMonthKey, 1);
    if (appData.months[nextKey]) {
      toast(`Le mois ${nextKey} existe déjà.`, "warn");
      return;
    }
    duplicateMonth(currentMonthKey, nextKey);
    switchToMonth(nextKey);
  });
}

function switchToMonth(key) {
  currentMonthKey = key;
  rebuildMonthSelectorOptions();
  document.getElementById("monthSelector").value = key;
  render();
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

  // 2) Copier les templates settings vers le mois (option : garder modifiable ensuite)
  // Ici: on copie les revenus de base + on laisse variableCharges vide + expenses vide
  const defaultIncomes = [
    { id: crypto.randomUUID(), label: "Rémi", amount: 0 },
    { id: crypto.randomUUID(), label: "Noémie", amount: 0 },
    { id: crypto.randomUUID(), label: "Autres", amount: 0 },
  ];

  // Si un mois précédent existe, on peut copier ses revenus (plus réaliste)
  if (appData.months[prevKey]?.incomes?.length) {
    appData.months[key] = {
      incomes: deepClone(appData.months[prevKey].incomes),
      variableCharges: [],
      expenses: [],
      carryOver,
    };
  } else {
    appData.months[key] = {
      incomes: defaultIncomes,
      variableCharges: [],
      expenses: [],
      carryOver,
    };
  }

  saveData();
  toast(`Mois créé : ${key} (report: ${carryOver}€)`);
}

function duplicateMonth(fromKey, toKey) {
  const source = appData.months[fromKey];
  if (!source) return;

  // Report basé sur le PnL du mois source (réaliste)
  const carryOver = calculateMonth(source).balance;

  appData.months[toKey] = {
    incomes: deepClone(source.incomes),
    variableCharges: deepClone(source.variableCharges),
    expenses: deepClone(source.expenses),
    carryOver,
  };

  saveData();
  toast(`Mois dupliqué : ${fromKey} → ${toKey}`);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* -----------------------------
   Render summary
------------------------------ */

function render() {
  const month = appData.months[currentMonthKey];
  if (!month) return;

  const calc = calculateMonth(month);

  setText("carryOver", money(month.carryOver));
  setText("totalIncome", money(calc.income));
  setText("totalCharges", money(calc.totalCharges));
  setText("balance", money(calc.balance));
  setText("expensesNet", money(calc.expensesNet));

  renderIncomes();
  renderSettingsSections();
  renderVariableCharges();
  renderExpenses();

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

  month.incomes.forEach((inc) => {
    const row = document.createElement("div");
    row.className = "row";

    row.innerHTML = `
      <input class="text" aria-label="Libellé revenu" value="${escapeHtml(inc.label)}" />
      <input class="num" aria-label="Montant revenu" type="number" min="0" value="${Number(inc.amount || 0)}" />
      <button class="danger" title="Supprimer">✕</button>
    `;

    const [labelInput, amountInput, delBtn] =
      row.querySelectorAll("input,button");

    labelInput.addEventListener("input", () => {
      inc.label = labelInput.value;
      render();
    });

    amountInput.addEventListener("input", () => {
      inc.amount = sanitizeAmount(amountInput.value);
      render();
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
    label: "Nouveau revenu",
    amount: 0,
  });
  toast("Revenu ajouté.");
  render();
};

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

const SETTINGS_SECTIONS = [
  {
    key: "fixedCharges",
    listId: "fixedChargesList",
    totalId: "fixedChargesTotal",
    empty: "Aucune charge fixe définie. Ouvrez la page Ajuster montants.",
  },
  {
    key: "subscriptions",
    listId: "subscriptionsList",
    totalId: "subscriptionsTotal",
    empty: "Aucun abonnement configuré.",
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
  },
];

function renderSettingsSections() {
  const settings = appData.settings || {};
  SETTINGS_SECTIONS.forEach((section) => {
    const list = Array.isArray(settings[section.key])
      ? settings[section.key]
      : [];
    renderSettingsSection(list, section);
  });
}

function renderSettingsSection(list, config) {
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
      const row = document.createElement("div");
      row.className = "row row-readonly";
      row.innerHTML = `
        <span class="label">${escapeHtml(item.label)}</span>
        <span class="amount">${money(item.amount)} €</span>
      `;
      container.appendChild(row);
    });
  }

  if (config.totalId) setText(config.totalId, money(sum(list)));
}

/* -----------------------------
   Variable charges CRUD
------------------------------ */

function renderVariableCharges() {
  const month = appData.months[currentMonthKey];
  const container = document.getElementById("variableChargesList");
  container.innerHTML = "";

  month.variableCharges.forEach((ch) => {
    const row = document.createElement("div");
    row.className = "row";

    row.innerHTML = `
      <input class="text" aria-label="Libellé charge variable" value="${escapeHtml(ch.label)}" />
      <input class="num" aria-label="Montant charge variable" type="number" min="0" value="${Number(ch.amount || 0)}" />
      <button class="danger" title="Supprimer">✕</button>
    `;

    const [labelInput, amountInput, delBtn] =
      row.querySelectorAll("input,button");

    labelInput.addEventListener("input", () => {
      ch.label = labelInput.value;
      render();
    });

    amountInput.addEventListener("input", () => {
      ch.amount = sanitizeAmount(amountInput.value);
      render();
    });

    delBtn.addEventListener("click", () => {
      month.variableCharges = month.variableCharges.filter(
        (x) => x.id !== ch.id,
      );
      toast("Charge variable supprimée.");
      render();
    });

    container.appendChild(row);
  });
}

window.addVariableCharge = function addVariableCharge() {
  const month = appData.months[currentMonthKey];
  month.variableCharges.push({
    id: crypto.randomUUID(),
    label: "Nouvelle charge",
    amount: 0,
  });
  toast("Charge variable ajoutée.");
  render();
};

/* -----------------------------
   Expenses: form + table + sort
------------------------------ */

let expenseSort = { key: "dateISO", dir: "desc" };

function initExpenseForm() {
  const form = document.getElementById("expenseForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const label = document.getElementById("expLabel").value.trim();
    const amount = sanitizeAmount(document.getElementById("expAmount").value);
    const refund = sanitizeAmount(
      document.getElementById("expRefund").value || 0,
    );
    const dateISO = document.getElementById("expDate").value;
    const importance = document.getElementById("expImportance").value;

    if (!label) return toast("Objet obligatoire.", "warn");
    if (amount < 0) return toast("Montant invalide.", "warn");
    if (!isValidDate(dateISO)) return toast("Date invalide.", "warn");
    if (refund < 0) return toast("Remboursement invalide.", "warn");

    const month = appData.months[currentMonthKey];
    month.expenses.push({
      id: crypto.randomUUID(),
      label,
      amount,
      refund,
      dateISO,
      importance,
    });

    form.reset();
    ensureTodayDefault();
    toast("Dépense ajoutée.");
    render();
  });

  // Click tri sur headers (simple + efficace)
  const headers = document.querySelectorAll("table thead th");
  if (headers?.length) {
    // Date, Objet, Montant, Remb., Importance, (actions)
    headers[0].style.cursor = "pointer";
    headers[2].style.cursor = "pointer";
    headers[4].style.cursor = "pointer";

    headers[0].addEventListener("click", () => setSort("dateISO"));
    headers[2].addEventListener("click", () => setSort("amount"));
    headers[4].addEventListener("click", () => setSort("importance"));
  }
}

function setSort(key) {
  if (expenseSort.key === key) {
    expenseSort.dir = expenseSort.dir === "asc" ? "desc" : "asc";
  } else {
    expenseSort.key = key;
    expenseSort.dir = key === "dateISO" ? "desc" : "asc";
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
    tr.className = importanceClass(e.importance);

    tr.innerHTML = `
      <td>${escapeHtml(e.dateISO)}</td>
      <td>${escapeHtml(e.label)}</td>
      <td>${money(e.amount)}</td>
      <td>${money(e.refund)}</td>
      <td>${escapeHtml(e.importance)}</td>
      <td><button class="danger">Supprimer</button></td>
    `;

    tr.querySelector("button").addEventListener("click", () => {
      month.expenses = month.expenses.filter((x) => x.id !== e.id);
      toast("Dépense supprimée.");
      render();
    });

    tbody.appendChild(tr);
  });
}

function compareExpense(a, b) {
  const dir = expenseSort.dir === "asc" ? 1 : -1;
  const key = expenseSort.key;

  if (key === "dateISO") return a.dateISO.localeCompare(b.dateISO) * dir;
  if (key === "amount") return (Number(a.amount) - Number(b.amount)) * dir;

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

/* -----------------------------
   Validation + UI
------------------------------ */

function sanitizeAmount(v) {
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, n);
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
