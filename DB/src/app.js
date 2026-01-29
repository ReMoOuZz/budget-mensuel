import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import settingsRouter from "./routes/settings.js";
import monthsRouter from "./routes/months.js";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
const allowedOrigins = new Set(config.clientOrigins);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    console.warn(`[cors] Origin refusé: ${origin}`);
    return callback(new Error("Origine non autorisée par Budgify API"));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/settings", settingsRouter);
app.use("/months", monthsRouter);

app.get("/", (req, res) => {
  res.json({ message: "Budgify API" });
});

app.use((err, req, res, _next) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Erreur serveur" });
});

export default app;
