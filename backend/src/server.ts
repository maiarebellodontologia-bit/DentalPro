import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import iaRoutes from "./routes/iaRoutes.js";
import { authenticate } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// 15 MB para caber a radiografia em base64.
app.use(express.json({ limit: "15mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", authenticate, userRoutes);
app.use("/api/patients", authenticate, patientRoutes);
app.use("/api/appointments", authenticate, appointmentRoutes);
app.use("/api/ia", iaRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "🦷 DentalPro API funcionando!" });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
