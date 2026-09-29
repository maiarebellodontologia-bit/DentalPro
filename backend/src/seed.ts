import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@dentalpro.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@dentalpro.com",
      password: hashedPassword,
      role: "admin",
    },
  });

  console.log("✅ Usuário admin criado:", admin);

  const patient = await prisma.patient.create({
    data: {
      name: "Maria Silva",
      email: "maria@email.com",
      phone: "(35) 99999-1234",
      birthDate: new Date("1990-05-15"),
      notes: "Paciente de exemplo",
    },
  });

  console.log("✅ Paciente de exemplo criado:", patient);

  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      userId: admin.id,
      date: new Date("2026-10-01T14:00:00"),
      duration: 60,
      status: "scheduled",
      notes: "Consulta de rotina",
    },
  });

  console.log("✅ Agendamento de exemplo criado:", appointment);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
