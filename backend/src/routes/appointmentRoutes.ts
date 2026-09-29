import { Router } from "express";
import {
  createAppointment,
  deleteAppointment,
  getAllAppointments,
  updateAppointment,
} from "../controllers/appointmentController.js";

const router = Router();

router.get("/", getAllAppointments);
router.post("/", createAppointment);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

export default router;
