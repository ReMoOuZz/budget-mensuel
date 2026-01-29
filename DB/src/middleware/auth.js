import jwt from "jsonwebtoken";
import config from "../config.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ").pop();
  if (!token) {
    return res.status(401).json({ error: "Auth token manquant" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalide" });
  }
}
