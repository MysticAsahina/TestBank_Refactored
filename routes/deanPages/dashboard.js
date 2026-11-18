import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { checkRole } from "../../middleware/checkRole.js"; // ✅ fixed path

const router = express.Router();

router.get("/", requireAuth, checkRole(["Dean", "Professor"]), (req, res) => {
  const user = req.session.user || { fullName: "Guest" };

  res.render("dean/Dashboard", {
    title: "Dean Dashboard",
    user,
  });
});

export default router;
