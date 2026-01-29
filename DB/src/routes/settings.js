import { Router } from "express";
import {
  listSettings,
  createSetting,
  updateSetting,
  deleteSetting,
} from "../controllers/settingsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", listSettings);
router.post("/:category", createSetting);
router.put("/:category/:id", updateSetting);
router.delete("/:category/:id", deleteSetting);

export default router;
