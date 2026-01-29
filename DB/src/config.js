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

const isProduction = process.env.NODE_ENV === "production";

const config = {
  port: Number(process.env.PORT || process.env.APP_PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  clientOrigins: resolvedOrigins,
  authCookie: {
    name: process.env.AUTH_COOKIE_NAME || "token",
    sameSite: process.env.AUTH_COOKIE_SAMESITE || (isProduction ? "none" : "lax"),
    secure: process.env.AUTH_COOKIE_SECURE
      ? process.env.AUTH_COOKIE_SECURE === "true"
      : isProduction,
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    maxAgeMs: Number(process.env.AUTH_COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000,
  },
};

if (!process.env.DATABASE_URL) {
  console.warn("[config] DATABASE_URL est absent. Prisma échouera sans connexion valide.");
}

export default config;
