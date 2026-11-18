import express from "express";
import dashboardRoutes from "./dashboard.js";
import manageAccountsRoutes from "./manageAccounts.js";
import sectionsRoutes from "./sections.js";
import testRoutes from "./testManagement.js";

const router = express.Router();

// map both routes to the same controller so TestStatic becomes the main Tests page
router.use("/dashboard", dashboardRoutes);
router.use("/manage-accounts", manageAccountsRoutes);
router.use("/sections", sectionsRoutes);
router.use("/tests", testRoutes);

export default router;