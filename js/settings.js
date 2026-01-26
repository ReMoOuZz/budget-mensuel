// js/settings.js
// Page permettant d'ajuster les montants des charges récurrentes.

const SETTINGS_CATEGORIES = ["fixedCharges", "subscriptions", "savings", "credits"];

document.addEventListener("DOMContentLoaded", () => {
  if (!appData?.settings) appData.settings = {};
  SETTINGS_CATEGORIES.forEach((key) => renderCategory(key));
});

function renderCategory(key) {
  const container = document.getElementById(`settings-${key}`);
  if (!container) return;

  const list = getSettingsList(key);
  container.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Aucune entrée disponible dans store.js.";
    container.appendChild(empty);
    return;
  }

  list.forEach((item) => container.appendChild(buildRow(key, item)));
}

function buildRow(key, item) {
  const row = document.createElement("div");
  row.className = "row row-manage";

  const labelInput = document.createElement("input");
  labelInput.className = "text";
  labelInput.type = "text";
  labelInput.placeholder = "Libellé";
  labelInput.value = item.label || "";

  labelInput.addEventListener("blur", () => updateLabel(item, labelInput));
  labelInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      labelInput.blur();
    }
  });

  const amountInput = document.createElement("input");
  amountInput.className = "num";
  amountInput.type = "text";
  amountInput.inputMode = "decimal";
  amountInput.pattern = "[0-9]*[.,]?[0-9]*";
  amountInput.placeholder = "0";
  amountInput.value = formatAmountInput(item.amount);

  amountInput.addEventListener("change", () => {
    item.amount = sanitizeAmount(amountInput.value);
    amountInput.value = formatAmountInput(item.amount);
    persist();
    toast("Montant mis à jour.");
  });

  row.appendChild(labelInput);
  row.appendChild(amountInput);

  return row;
}

function updateLabel(item, input) {
  const newValue = input.value.trim();
  if (item.label === newValue) return;
  item.label = newValue;
  input.value = newValue;
  persist();
  toast("Libellé mis à jour.");
}

function getSettingsList(key) {
  if (!Array.isArray(appData.settings[key])) {
    appData.settings[key] = [];
  }
  return appData.settings[key];
}

function sanitizeAmount(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function formatAmountInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(".", ",");
}

function persist() {
  saveData();
}

function toast(message, type = "ok") {
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
