// js/store.js
const STORAGE_KEY = "budgetAppData_v1";

// Petit helper local pour générer des ids uniques pour les données volatiles (revenus, dépenses).
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

const SETTINGS_KEYS = ["fixedCharges", "subscriptions", "savings", "credits"];

const DEFAULT_DATA_MODEL = {
  settings: {
    fixedCharges: [
      { id: "fc_sosh_remi", label: "Sosh Rémi", amount: 19.99 },
      { id: "fc_sosh_noemie", label: "Sosh Noémie", amount: 15.99 },
      { id: "fc_box", label: "Box", amount: 30.99 },
      { id: "fc_predica", label: "Prédica", amount: 14.33 },
      { id: "fc_assurances", label: "Assurances", amount: 69.31 },
      { id: "fc_assu_voiture", label: "Assu voiture", amount: 104.88 },
      { id: "fc_engie", label: "Engie", amount: 200.0 },
      { id: "fc_veolia", label: "Véolia", amount: 42.12 },
      { id: "fc_frais_carte", label: "Frais carte", amount: 18.0 },
      { id: "fc_taxe_fonciere", label: "Taxe foncière", amount: 154.0 },
    ],

    subscriptions: [
      { id: "sub_apple_music", label: "Apple Music", amount: 16.99 },
      { id: "sub_netflix", label: "Netflix", amount: 5.99 },
      { id: "sub_disney", label: "Disney", amount: 8.99 },
      { id: "sub_amazon", label: "Amazon", amount: 6.99 },
      { id: "sub_hachette", label: "Hachette", amount: 35.97 },
      { id: "sub_playstation", label: "Playstation", amount: 13.99 },
      { id: "sub_chatgpt", label: "ChatGPT", amount: 23.0 },
    ],

    savings: [],

    credits: [
      { id: "cr_maison", label: "Maison", amount: 613 },
      { id: "cr_conso", label: "Conso", amount: 349 },
      { id: "cr_mac", label: "Mac", amount: 60.0 },
    ],
  },

  // Exemple de mois initial (tu peux garder ton 2026-01 comme base)
  months: {
    "2026-01": {
      incomes: [
        { id: uid("inc"), label: "", placeholder: "Salaire principal", amount: 0 },
        { id: uid("inc"), label: "", placeholder: "Salaire secondaire", amount: 0 },
        { id: uid("inc"), label: "", placeholder: "Autres revenus", amount: 0 },
      ],
      variableCharges: [
        // (optionnel : dans ton ODT il y en a, mais tu ne me l’as pas demandé ici)
      ],
      expenses: [],
      carryOver: 0,
      paidFixedCharges: [],
      paidSubscriptions: [],
      paidCredits: [],
      savingsEntries: [],
    },
  },
};

const hasLocalStorage =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function loadData() {
  if (!hasLocalStorage) return cloneDefaults();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed = JSON.parse(raw);
    parsed.settings = mergeSettingsWithDefaults(parsed.settings);
    ensureSettingsShape(parsed);
    return parsed;
  } catch {
    console.warn("Données corrompues, reset sur défaut.");
    return cloneDefaults();
  }
}

let appData = loadData();

function saveData() {
  if (!hasLocalStorage) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function replaceAppData(nextData, { persist = true } = {}) {
  if (!nextData || typeof nextData !== "object") return appData;
  appData = nextData;
  if (persist) saveData();
  return appData;
}

function cloneDefaults() {
  const cloned = structuredClone(DEFAULT_DATA_MODEL);
  cloned.settings = mergeSettingsWithDefaults(cloned.settings);
  ensureSettingsShape(cloned);
  return cloned;
}

function ensureSettingsShape(data) {
  if (!data.settings) data.settings = {};
  SETTINGS_KEYS.forEach((key) => {
    if (!Array.isArray(data.settings[key])) data.settings[key] = [];
  });
}

function mergeSettingsWithDefaults(existing = {}) {
  const result = {};
  SETTINGS_KEYS.forEach((key) => {
    const defaults = DEFAULT_DATA_MODEL.settings[key] || [];
    const current = Array.isArray(existing[key]) ? existing[key] : [];

    const merged = defaults.map((item) => {
      const match =
        current.find((entry) => entry.id === item.id) ||
        current.find((entry) => entry.label === item.label);
      if (match) {
        return {
          ...item,
          amount: typeof match.amount === "number" ? match.amount : item.amount,
        };
      }
      return { ...item };
    });

    result[key] = merged;
  });
  return result;
}

if (typeof module !== "undefined") {
  module.exports = {
    SETTINGS_KEYS,
    DEFAULT_DATA_MODEL,
    mergeSettingsWithDefaults,
    ensureSettingsShape,
    cloneDefaults,
  };
}

if (typeof window !== "undefined") {
  window.BudgifyStore = {
    getAppData: () => appData,
    replaceAppData,
    cloneDefaults,
    ensureSettingsShape,
    mergeSettingsWithDefaults,
  };
}
