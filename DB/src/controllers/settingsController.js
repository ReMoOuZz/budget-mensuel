import { z } from "zod";
import prisma from "../utils/prisma.js";
import { cleanLabel, toPlainNumber } from "../utils/format.js";

const currencySchema = z.coerce
  .number()
  .min(0)
  .max(1_000_000)
  .transform((value) => Math.round(value * 100) / 100);

const labelSchema = z.string().trim().max(120).optional();

const sortOrderSchema = z.coerce.number().int().min(0).max(10_000).optional();

const baseRecurringSchema = z.object({
  label: labelSchema,
  amount: currencySchema.optional(),
  sortOrder: sortOrderSchema,
});

const savingsSchema = z.object({
  label: labelSchema,
  amount: currencySchema.optional(),
});

const CATEGORY_CONFIG = {
  fixedCharges: {
    model: prisma.settingsFixedCharge,
    schema: baseRecurringSchema,
    toDb: (payload, userId) => ({
      label: cleanLabel(payload.label),
      amount: payload.amount ?? 0,
      sortOrder: payload.sortOrder ?? 0,
      userId,
    }),
    toUpdate: (payload) => ({
      ...(payload.label !== undefined
        ? { label: cleanLabel(payload.label) }
        : {}),
      ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      ...(payload.sortOrder !== undefined
        ? { sortOrder: payload.sortOrder }
        : {}),
    }),
    toDto: (record) => ({
      id: record.id,
      label: record.label,
      amount: toPlainNumber(record.amount),
      sortOrder: record.sortOrder,
    }),
  },
  subscriptions: {
    model: prisma.settingsSubscription,
    schema: baseRecurringSchema,
    toDb: (payload, userId) => ({
      label: cleanLabel(payload.label),
      amount: payload.amount ?? 0,
      sortOrder: payload.sortOrder ?? 0,
      userId,
    }),
    toUpdate: (payload) => ({
      ...(payload.label !== undefined
        ? { label: cleanLabel(payload.label) }
        : {}),
      ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      ...(payload.sortOrder !== undefined
        ? { sortOrder: payload.sortOrder }
        : {}),
    }),
    toDto: (record) => ({
      id: record.id,
      label: record.label,
      amount: toPlainNumber(record.amount),
      sortOrder: record.sortOrder,
    }),
  },
  credits: {
    model: prisma.settingsCredit,
    schema: baseRecurringSchema,
    toDb: (payload, userId) => ({
      label: cleanLabel(payload.label),
      amount: payload.amount ?? 0,
      sortOrder: payload.sortOrder ?? 0,
      userId,
    }),
    toUpdate: (payload) => ({
      ...(payload.label !== undefined
        ? { label: cleanLabel(payload.label) }
        : {}),
      ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      ...(payload.sortOrder !== undefined
        ? { sortOrder: payload.sortOrder }
        : {}),
    }),
    toDto: (record) => ({
      id: record.id,
      label: record.label,
      amount: toPlainNumber(record.amount),
      sortOrder: record.sortOrder,
    }),
  },
  savings: {
    model: prisma.settingsSavingCategory,
    schema: savingsSchema,
    toDb: (payload, userId) => ({
      label: cleanLabel(payload.label),
      target: payload.amount ?? 0,
      userId,
    }),
    toUpdate: (payload) => ({
      ...(payload.label !== undefined
        ? { label: cleanLabel(payload.label) }
        : {}),
      ...(payload.amount !== undefined ? { target: payload.amount } : {}),
    }),
    toDto: (record) => ({
      id: record.id,
      label: record.label,
      amount: toPlainNumber(record.target),
    }),
  },
};

function resolveCategory(raw) {
  if (!raw) return null;
  const normalized = raw.replace(/-/g, "").toLowerCase();
  switch (normalized) {
    case "fixedcharges":
      return { key: "fixedCharges", ...CATEGORY_CONFIG.fixedCharges };
    case "subscriptions":
      return { key: "subscriptions", ...CATEGORY_CONFIG.subscriptions };
    case "credits":
      return { key: "credits", ...CATEGORY_CONFIG.credits };
    case "savings":
      return { key: "savings", ...CATEGORY_CONFIG.savings };
    default:
      return null;
  }
}

export async function listSettings(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Non authentifié" });
  const [fixedCharges, subscriptions, credits, savings] = await Promise.all([
    prisma.settingsFixedCharge.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.settingsSubscription.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.settingsCredit.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.settingsSavingCategory.findMany({
      where: { userId },
      orderBy: { label: "asc" },
    }),
  ]);

  return res.json({
    settings: {
      fixedCharges: fixedCharges.map(CATEGORY_CONFIG.fixedCharges.toDto),
      subscriptions: subscriptions.map(
        CATEGORY_CONFIG.subscriptions.toDto,
      ),
      credits: credits.map(CATEGORY_CONFIG.credits.toDto),
      savings: savings.map(CATEGORY_CONFIG.savings.toDto),
    },
  });
}

export async function createSetting(req, res) {
  const userId = req.user?.userId;
  const category = resolveCategory(req.params.category);
  if (!category) return res.status(404).json({ error: "Catégorie inconnue" });
  if (!userId) return res.status(401).json({ error: "Non authentifié" });
  try {
    const payload = category.schema.parse(req.body);
    const record = await category.model.create({
      data: category.toDb(payload, userId),
    });
    return res.status(201).json({ item: category.toDto(record) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    console.error("[createSetting]", error);
    return res.status(500).json({ error: "Création impossible" });
  }
}

export async function updateSetting(req, res) {
  const userId = req.user?.userId;
  const category = resolveCategory(req.params.category);
  if (!category) return res.status(404).json({ error: "Catégorie inconnue" });
  if (!userId) return res.status(401).json({ error: "Non authentifié" });
  try {
    const payload = category.schema.partial().parse(req.body);
    const existing = await category.model.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ error: "Entrée introuvable" });
    const updated = await category.model.update({
      where: { id: existing.id },
      data: category.toUpdate(payload),
    });
    return res.json({ item: category.toDto(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    console.error("[updateSetting]", error);
    return res.status(500).json({ error: "Mise à jour impossible" });
  }
}

export async function deleteSetting(req, res) {
  const userId = req.user?.userId;
  const category = resolveCategory(req.params.category);
  if (!category) return res.status(404).json({ error: "Catégorie inconnue" });
  if (!userId) return res.status(401).json({ error: "Non authentifié" });
  try {
    const existing = await category.model.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ error: "Entrée introuvable" });
    await category.model.delete({ where: { id: existing.id } });
    return res.status(204).end();
  } catch (error) {
    console.error("[deleteSetting]", error);
    return res.status(500).json({ error: "Suppression impossible" });
  }
}
