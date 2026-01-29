import dotenv from "dotenv";

dotenv.config();

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "https://remoouzz.github.io",
  "https://remoouzz.github.io/budget-mensuel",
];

function parseOrigins(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const multiOrigins = parseOrigins(process.env.CLIENT_ORIGINS);
const singleOrigin = parseOrigins(process.env.CLIENT_ORIGIN);

const resolvedOrigins =
  multiOrigins.length > 0
    ? multiOrigins
    : singleOrigin.length > 0
      ? singleOrigin
      : DEFAULT_ORIGINS;

const config = {
  port: Number(process.env.PORT || process.env.APP_PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  clientOrigins: resolvedOrigins,
};

if (!process.env.DATABASE_URL) {
  console.warn("[config] DATABASE_URL est absent. Prisma échouera sans connexion valide.");
}

export default config;
