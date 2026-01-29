import { Router } from "express";
import {
  listMonths,
  getMonth,
  createMonth,
  replaceMonth,
  deleteMonth,
} from "../controllers/monthsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", listMonths);
router.get("/:key", getMonth);
router.post("/", createMonth);
router.put("/:key", replaceMonth);
router.delete("/:key", deleteMonth);

export default router;
