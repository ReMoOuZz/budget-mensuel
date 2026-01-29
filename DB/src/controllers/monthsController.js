import { z } from "zod";
import prisma from "../utils/prisma.js";
import {
  cleanLabel,
  parseDateISO,
  toISODate,
  toPlainNumber,
} from "../utils/format.js";

const includeMonthRelations = {
  incomes: { orderBy: { createdAt: "asc" } },
  variableCharges: { orderBy: { incurredOn: "asc" } },
  expenses: { orderBy: { incurredOn: "asc" } },
  paidFixedCharges: { orderBy: { paidOn: "asc" } },
  paidSubscriptions: { orderBy: { paidOn: "asc" } },
  paidCredits: { orderBy: { paidOn: "asc" } },
  savingsEntries: { orderBy: { savedOn: "asc" } },
};

const moneySchema = z.coerce
  .number()
  .min(0)
  .max(1_000_000)
  .transform((value) => Math.round(value * 100) / 100);

const monthKeySchema = z
  .string()
  .regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, {
    message: "Le format doit être YYYY-MM",
  });

const dateSchema = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Date invalide",
  });

const incomeSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  amount: moneySchema,
});

const variableChargeSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  amount: moneySchema,
  dateISO: dateSchema,
});

const importanceSchema = z
  .union([
    z.literal("faible"),
    z.literal("modéré"),
    z.literal("important"),
    z.literal(""),
  ])
  .optional();

const expenseSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  amount: moneySchema,
  dateISO: dateSchema,
  importance: importanceSchema,
  isRefund: z.boolean().optional(),
  refund: moneySchema.optional(),
  category: z.string().optional(),
});

const savingsEntrySchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().optional(),
  label: z.string().optional(),
  amount: moneySchema,
  dateISO: dateSchema,
});

const paidIdsSchema = z.array(z.string()).default([]);

const monthPayloadSchema = z.object({
  key: monthKeySchema,
  carryOver: z.coerce
    .number()
    .min(-1_000_000)
    .max(1_000_000)
    .default(0),
  incomes: z.array(incomeSchema).default([]),
  variableCharges: z.array(variableChargeSchema).default([]),
  expenses: z.array(expenseSchema).default([]),
  paidFixedCharges: paidIdsSchema,
  paidSubscriptions: paidIdsSchema,
  paidCredits: paidIdsSchema,
  savingsEntries: z.array(savingsEntrySchema).default([]),
});

function monthToDto(month) {
  return {
    id: month.id,
    key: month.key,
    carryOver: toPlainNumber(month.carryOver),
    incomes: (month.incomes || []).map((income) => ({
      id: income.id,
      label: income.label || "",
      placeholder: income.placeholder || "",
      amount: toPlainNumber(income.amount),
    })),
    variableCharges: (month.variableCharges || []).map((charge) => ({
      id: charge.id,
      label: charge.label,
      amount: toPlainNumber(charge.amount),
      dateISO: toISODate(charge.incurredOn) || null,
    })),
    expenses: (month.expenses || []).map((expense) => ({
      id: expense.id,
      label: expense.label,
      amount: toPlainNumber(expense.amount),
      dateISO: toISODate(expense.incurredOn) || null,
      importance: expense.importance || "",
      isRefund: Boolean(expense.isRefund),
      refund: toPlainNumber(expense.reimbursed),
      category: expense.category || "",
    })),
    paidFixedCharges: (month.paidFixedCharges || []).map(
      (entry) => entry.settingId,
    ),
    paidSubscriptions: (month.paidSubscriptions || []).map(
      (entry) => entry.settingId,
    ),
    paidCredits: (month.paidCredits || []).map((entry) => entry.settingId),
    savingsEntries: (month.savingsEntries || []).map((entry) => ({
      id: entry.id,
      label: entry.label || "",
      amount: toPlainNumber(entry.amount),
      dateISO: toISODate(entry.savedOn) || null,
      categoryId: entry.categoryId || null,
    })),
  };
}

function ensureAuth(req, res) {
  if (!req.user?.userId) {
    res.status(401).json({ error: "Non authentifié" });
    return null;
  }
  return req.user.userId;
}

export async function listMonths(req, res) {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  const months = await prisma.month.findMany({
    where: { userId },
    orderBy: { key: "asc" },
    include: includeMonthRelations,
  });
  res.json({ months: months.map(monthToDto) });
}

export async function getMonth(req, res) {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  const key = req.params.key;
  if (!monthKeySchema.safeParse(key).success) {
    return res.status(400).json({ error: "Clé de mois invalide" });
  }
  const month = await prisma.month.findFirst({
    where: { userId, key },
    include: includeMonthRelations,
  });
  if (!month) return res.status(404).json({ error: "Mois introuvable" });
  res.json({ month: monthToDto(month) });
}

export async function createMonth(req, res) {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  try {
    const payload = monthPayloadSchema.parse(req.body);
    const existing = await prisma.month.findFirst({
      where: { userId, key: payload.key },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "Ce mois existe déjà pour cet utilisateur" });
    }
    const month = await prisma.$transaction(async (tx) => {
      const created = await tx.month.create({
        data: {
          key: payload.key,
          userId,
          carryOver: payload.carryOver,
        },
      });
      await replaceMonthRelations(tx, created.id, payload);
      return tx.month.findUnique({
        where: { id: created.id },
        include: includeMonthRelations,
      });
    });
    res.status(201).json({ month: monthToDto(month) });
  } catch (error) {
    handleMonthError(res, error);
  }
}

export async function replaceMonth(req, res) {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  const keyParam = req.params.key;
  if (!monthKeySchema.safeParse(keyParam).success) {
    return res.status(400).json({ error: "Clé de mois invalide" });
  }
  try {
    const payload = monthPayloadSchema.parse({ ...req.body, key: keyParam });
    const month = await prisma.$transaction(async (tx) => {
      const existing = await tx.month.findFirst({
        where: { userId, key: keyParam },
      });
      if (!existing) {
        throw new NotFoundError();
      }
      await tx.month.update({
        where: { id: existing.id },
        data: { carryOver: payload.carryOver },
      });
      await replaceMonthRelations(tx, existing.id, payload);
      return tx.month.findUnique({
        where: { id: existing.id },
        include: includeMonthRelations,
      });
    });
    res.json({ month: monthToDto(month) });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: "Mois introuvable" });
    }
    handleMonthError(res, error);
  }
}

export async function deleteMonth(req, res) {
  const userId = ensureAuth(req, res);
  if (!userId) return;
  const keyParam = req.params.key;
  if (!monthKeySchema.safeParse(keyParam).success) {
    return res.status(400).json({ error: "Clé de mois invalide" });
  }
  try {
    const existing = await prisma.month.findFirst({
      where: { userId, key: keyParam },
    });
    if (!existing) {
      return res.status(404).json({ error: "Mois introuvable" });
    }
    await prisma.month.delete({
      where: { id: existing.id },
    });
    res.status(204).end();
  } catch (error) {
    console.error("[deleteMonth]", error);
    res.status(500).json({ error: "Suppression impossible" });
  }
}

class NotFoundError extends Error {}

function handleMonthError(res, error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: error.flatten() });
  }
  console.error("[month]", error);
  return res.status(500).json({ error: "Opération impossible" });
}

async function replaceMonthRelations(tx, monthId, payload) {
  await Promise.all([
    tx.income.deleteMany({ where: { monthId } }),
    tx.variableCharge.deleteMany({ where: { monthId } }),
    tx.expense.deleteMany({ where: { monthId } }),
    tx.paidFixedCharge.deleteMany({ where: { monthId } }),
    tx.paidSubscription.deleteMany({ where: { monthId } }),
    tx.paidCredit.deleteMany({ where: { monthId } }),
    tx.savingsEntry.deleteMany({ where: { monthId } }),
  ]);

  if (payload.incomes.length) {
    await tx.income.createMany({
      data: payload.incomes.map((income) => ({
        ...(income.id ? { id: income.id } : {}),
        label: cleanLabel(income.label),
        placeholder: income.placeholder || "",
        amount: income.amount,
        monthId,
      })),
    });
  }

  if (payload.variableCharges.length) {
    await tx.variableCharge.createMany({
      data: payload.variableCharges.map((charge) => ({
        ...(charge.id ? { id: charge.id } : {}),
        label: cleanLabel(charge.label),
        amount: charge.amount,
        incurredOn: parseDateISO(charge.dateISO, new Date()),
        monthId,
      })),
    });
  }

  if (payload.expenses.length) {
    await tx.expense.createMany({
      data: payload.expenses.map((expense) => ({
        ...(expense.id ? { id: expense.id } : {}),
        label: cleanLabel(expense.label),
        amount: expense.amount,
        incurredOn: parseDateISO(expense.dateISO, new Date()),
        category: expense.category || null,
        reimbursed: expense.refund ?? 0,
        importance: expense.importance || "",
        isRefund: expense.isRefund ?? false,
        monthId,
      })),
    });
  }

  const paidFixedIds = payload.paidFixedCharges.filter(Boolean);
  if (paidFixedIds.length) {
    await tx.paidFixedCharge.createMany({
      data: paidFixedIds.map((settingId) => ({
        settingId,
        monthId,
        amount: 0,
        paidOn: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  const paidSubIds = payload.paidSubscriptions.filter(Boolean);
  if (paidSubIds.length) {
    await tx.paidSubscription.createMany({
      data: paidSubIds.map((settingId) => ({
        settingId,
        monthId,
        amount: 0,
        paidOn: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  const paidCreditIds = payload.paidCredits.filter(Boolean);
  if (paidCreditIds.length) {
    await tx.paidCredit.createMany({
      data: paidCreditIds.map((settingId) => ({
        settingId,
        monthId,
        amount: 0,
        paidOn: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  if (payload.savingsEntries.length) {
    await tx.savingsEntry.createMany({
      data: payload.savingsEntries.map((entry) => ({
        ...(entry.id ? { id: entry.id } : {}),
        label: cleanLabel(entry.label),
        amount: entry.amount,
        savedOn: parseDateISO(entry.dateISO, new Date()),
        categoryId: entry.categoryId || null,
        monthId,
      })),
    });
  }
}
