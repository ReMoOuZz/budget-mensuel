import dotenv from "dotenv";

dotenv.config();

const config = {
  port: Number(process.env.PORT || process.env.APP_PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
};

if (!process.env.DATABASE_URL) {
  console.warn("[config] DATABASE_URL est absent. Prisma échouera sans connexion valide.");
}

export default config;
