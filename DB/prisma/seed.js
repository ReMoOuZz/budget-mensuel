import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
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
  credits: [
    { id: "cr_maison", label: "Maison", amount: 613 },
    { id: "cr_conso", label: "Conso", amount: 349 },
    { id: "cr_mac", label: "Mac", amount: 60.0 },
  ],
  savings: [],
};

const DEFAULT_MONTH_KEY = "2026-01";

async function main() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("Veuillez définir SEED_EMAIL et SEED_PASSWORD dans l'environnement");
  }
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const user = existingUser
    ? existingUser
    : await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(password, 12),
        },
      });

  await upsertSettings(user.id);
  await upsertMonth(user.id, DEFAULT_MONTH_KEY);
  console.log(`Seed terminé pour ${email}`);
}

async function upsertSettings(userId) {
  const existingCounts = await Promise.all([
    prisma.settingsFixedCharge.count({ where: { userId } }),
    prisma.settingsSubscription.count({ where: { userId } }),
    prisma.settingsCredit.count({ where: { userId } }),
  ]);
  if (existingCounts.every((count) => count > 0)) {
    console.log("Paramètres déjà présents, skip");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.settingsFixedCharge.createMany({
      data: DEFAULT_SETTINGS.fixedCharges.map((entry, index) => ({
        id: entry.id,
        label: entry.label,
        amount: entry.amount,
        sortOrder: index,
        userId,
      })),
      skipDuplicates: true,
    });
    await tx.settingsSubscription.createMany({
      data: DEFAULT_SETTINGS.subscriptions.map((entry, index) => ({
        id: entry.id,
        label: entry.label,
        amount: entry.amount,
        sortOrder: index,
        userId,
      })),
      skipDuplicates: true,
    });
    await tx.settingsCredit.createMany({
      data: DEFAULT_SETTINGS.credits.map((entry, index) => ({
        id: entry.id,
        label: entry.label,
        amount: entry.amount,
        sortOrder: index,
        userId,
      })),
      skipDuplicates: true,
    });
    console.log("Paramètres insérés");
  });
}

async function upsertMonth(userId, key) {
  const existing = await prisma.month.findFirst({ where: { userId, key } });
  if (existing) {
    console.log(`Le mois ${key} existe déjà, skip`);
    return;
  }
  const month = await prisma.month.create({
    data: {
      key,
      carryOver: 0,
      userId,
      incomes: {
        create: [
          { label: "", placeholder: "Salaire principal", amount: 0 },
          { label: "", placeholder: "Salaire secondaire", amount: 0 },
          { label: "", placeholder: "Autres revenus", amount: 0 },
        ],
      },
    },
  });
  console.log(`Mois ${month.key} créé`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
