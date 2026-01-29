import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../utils/prisma.js";
import config from "../config.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function issueToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: "7d",
  });
}

function sanitizeUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function register(req, res) {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });
    const token = issueToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    console.error("[register]", error);
    return res.status(500).json({ error: "Inscription impossible" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }
    const token = issueToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    console.error("[login]", error);
    return res.status(500).json({ error: "Connexion impossible" });
  }
}

export async function me(req, res) {
  if (!req.user?.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }
  return res.json({ user: sanitizeUser(user) });
}

export function logout(req, res) {
  res.clearCookie("token");
  return res.status(204).end();
}
