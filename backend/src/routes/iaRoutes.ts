import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  acceptPlan,
  analyzeRadiograph,
  createFinding,
  deleteFinding,
  deleteRadiograph,
  dictatePerio,
  getConfig,
  getConsent,
  getDashboard,
  getPerio,
  getPlans,
  getRadiograph,
  getRadiographImage,
  getStatus,
  listRadiographs,
  savePerio,
  setConsent,
  updateConfig,
  updateFinding,
  updatePlanStatus,
  uploadRadiograph,
} from "../controllers/iaController.js";

const router = Router();
const clinical = requireRole("admin", "dentist");

router.use(authenticate);

router.get("/status", getStatus);
router.get("/config", getConfig);
router.put("/config", requireRole("admin"), updateConfig);

router.get("/patients/:patientId/consent", getConsent);
router.put("/patients/:patientId/consent", setConsent);
router.get("/patients/:patientId/radiographs", listRadiographs);
router.post("/patients/:patientId/radiographs", uploadRadiograph);
router.get("/patients/:patientId/perio", getPerio);
router.post("/patients/:patientId/perio/dictation", clinical, dictatePerio);
router.put("/patients/:patientId/perio", clinical, savePerio);

router.get("/radiographs/:id", getRadiograph);
router.get("/radiographs/:id/image", getRadiographImage);
router.delete("/radiographs/:id", clinical, deleteRadiograph);
router.post("/radiographs/:id/analyze", clinical, analyzeRadiograph);
router.post("/radiographs/:id/findings", clinical, createFinding);
router.patch("/radiographs/:id/findings/:findingId", clinical, updateFinding);
router.delete("/radiographs/:id/findings/:findingId", clinical, deleteFinding);
router.get("/radiographs/:id/plans", getPlans);
router.post("/radiographs/:id/plans/accept", acceptPlan);
router.patch("/plans/:planId", updatePlanStatus);

router.get("/dashboard", getDashboard);

export default router;
