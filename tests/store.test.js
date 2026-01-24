const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SETTINGS_KEYS,
  DEFAULT_DATA_MODEL,
  mergeSettingsWithDefaults,
  ensureSettingsShape,
  cloneDefaults,
} = require("../js/store.js");

if (typeof global.structuredClone !== "function") {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

test("mergeSettingsWithDefaults conserve toutes les entrées par défaut", () => {
  const incoming = {
    fixedCharges: [
      { id: "fc_box", label: "Box", amount: 99 }, // override
      { id: "unknown", label: "Ancienne charge", amount: 12 }, // ignorée
    ],
  };

  const merged = mergeSettingsWithDefaults(incoming);
  const defaultLabels = DEFAULT_DATA_MODEL.settings.fixedCharges.map(
    (c) => c.label,
  );
  const mergedLabels = merged.fixedCharges.map((c) => c.label);

  assert.deepEqual(mergedLabels, defaultLabels);
  const boxEntry = merged.fixedCharges.find((c) => c.id === "fc_box");
  assert.equal(boxEntry.amount, 99);
});

test("mergeSettingsWithDefaults tombe à défaut si aucune donnée", () => {
  const merged = mergeSettingsWithDefaults();
  SETTINGS_KEYS.forEach((key) => {
    assert.equal(
      merged[key].length,
      DEFAULT_DATA_MODEL.settings[key].length,
    );
  });
});

test("ensureSettingsShape ajoute les tableaux manquants", () => {
  const data = { settings: { fixedCharges: null } };
  ensureSettingsShape(data);

  SETTINGS_KEYS.forEach((key) => {
    assert.ok(Array.isArray(data.settings[key]));
  });
});

test("cloneDefaults retourne une copie indépendante", () => {
  const clone = cloneDefaults();
  clone.settings.fixedCharges[0].amount = 999;

  assert.notEqual(
    clone.settings.fixedCharges[0].amount,
    DEFAULT_DATA_MODEL.settings.fixedCharges[0].amount,
  );
  assert.notStrictEqual(clone.settings, DEFAULT_DATA_MODEL.settings);
});
