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

  const labelSpan = document.createElement("span");
  labelSpan.className = "label";
  labelSpan.textContent = item.label || "";

  const amountInput = document.createElement("input");
  amountInput.className = "num";
  amountInput.type = "number";
  amountInput.min = "0";
  amountInput.step = "0.01";
  amountInput.value = Number(item.amount || 0);

  amountInput.addEventListener("change", () => {
    item.amount = sanitizeAmount(amountInput.value);
    amountInput.value = item.amount;
    persist();
    toast("Montant mis à jour.");
  });

  row.appendChild(labelSpan);
  row.appendChild(amountInput);

  return row;
}

function getSettingsList(key) {
  if (!Array.isArray(appData.settings[key])) {
    appData.settings[key] = [];
  }
  return appData.settings[key];
}

function sanitizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
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
