// js/settings.js
// Page permettant d'ajuster les montants des charges récurrentes.

const SETTINGS_CONFIG = {
  fixedCharges: {
    addLabel: "+ Ajouter une charge fixe",
    defaultLabel: "Nouvelle charge fixe",
    idPrefix: "fc_custom",
    toastAdd: "Charge fixe ajoutée.",
    toastDelete: "Charge fixe supprimée.",
    emptyText: "Aucune charge fixe enregistrée. Ajoutez votre première ligne.",
    trackingField: "paidFixedCharges",
  },
  subscriptions: {
    addLabel: "+ Ajouter un abonnement",
    defaultLabel: "Nouvel abonnement",
    idPrefix: "sub_custom",
    toastAdd: "Abonnement ajouté.",
    toastDelete: "Abonnement supprimé.",
    emptyText: "Aucun abonnement configuré pour l'instant.",
    trackingField: "paidSubscriptions",
  },
  credits: {
    addLabel: "+ Ajouter un crédit",
    defaultLabel: "Nouveau crédit",
    idPrefix: "cr_custom",
    toastAdd: "Crédit ajouté.",
    toastDelete: "Crédit supprimé.",
    emptyText: "Aucun crédit configuré actuellement.",
    trackingField: "paidCredits",
  },
};

const SETTINGS_CATEGORIES = Object.keys(SETTINGS_CONFIG);

document.addEventListener("DOMContentLoaded", () => {
  if (!appData?.settings) appData.settings = {};
  SETTINGS_CATEGORIES.forEach((key) => renderCategory(key));
  initAddButtons();
});

function renderCategory(key) {
  const container = document.getElementById(`settings-${key}`);
  if (!container) return;

  const list = getSettingsList(key);
  const config = getCategoryConfig(key);
  container.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      config.emptyText || "Aucune entrée configurée pour cette section.";
    container.appendChild(empty);
  }

  list.forEach((item) => container.appendChild(buildRow(key, item, config)));
}

function buildRow(key, item, config = {}) {
  const row = document.createElement("div");
  row.className = "row row-manage";

  const labelInput = document.createElement("input");
  labelInput.className = "text";
  labelInput.type = "text";
  labelInput.placeholder = config.defaultLabel || "Libellé";
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

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "danger icon-only";
  deleteBtn.title = "Supprimer";
  deleteBtn.setAttribute(
    "aria-label",
    `Supprimer ${item.label || "l'entrée"}`,
  );
  deleteBtn.textContent = "✕";
  deleteBtn.addEventListener("click", () => removeEntry(key, item));

  row.appendChild(labelInput);
  row.appendChild(amountInput);
  row.appendChild(deleteBtn);

  return row;
}

function updateLabel(item, input) {
  const newValue = input.value.trim();
  if (item.label === newValue) return;
  const normalized = newValue ? capitalizeFirstLetter(newValue) : "";
  item.label = normalized;
  input.value = normalized;
  persist();
  toast("Libellé mis à jour.");
}

function getSettingsList(key) {
  if (!Array.isArray(appData.settings[key])) {
    appData.settings[key] = [];
  }
  return appData.settings[key];
}

function getCategoryConfig(key) {
  return SETTINGS_CONFIG[key] || {};
}

function addEntry(key) {
  const list = getSettingsList(key);
  const config = getCategoryConfig(key);
  list.push({
    id: uid(config.idPrefix || `custom_${key}`),
    label: "",
    amount: 0,
  });
  persist();
  renderCategory(key);
  toast(config.toastAdd || "Entrée ajoutée.");
}

function removeEntry(key, item) {
  const list = getSettingsList(key);
  const index = list.indexOf(item);
  if (index === -1) return;
  const removedId = list[index]?.id;
  list.splice(index, 1);
  cleanupTrackingForEntry(key, removedId);
  persist();
  renderCategory(key);
  const config = getCategoryConfig(key);
  toast(config.toastDelete || "Entrée supprimée.");
}

function cleanupTrackingForEntry(key, entryId) {
  if (!entryId || !appData?.months) return;
  const trackingField = getCategoryConfig(key).trackingField;
  if (!trackingField) return;
  Object.values(appData.months).forEach((month) => {
    if (Array.isArray(month[trackingField])) {
      const idx = month[trackingField].indexOf(entryId);
      if (idx >= 0) month[trackingField].splice(idx, 1);
    }
  });
}

function initAddButtons() {
  document.querySelectorAll("[data-add-category]").forEach((button) => {
    const key = button.dataset.addCategory;
    if (!SETTINGS_CATEGORIES.includes(key)) return;
    button.addEventListener("click", () => addEntry(key));
  });
}

function capitalizeFirstLetter(value = "") {
  if (!value) return "";
  return value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1);
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
