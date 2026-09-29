import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllAppointments = async (_req: Request, res: Response) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        patient: true,
        user: true,
      },
      orderBy: { date: "asc" },
    });

    res.json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
};

export const createAppointment = async (req: Request, res: Response) => {
  try {
    const { patientId, userId, date, duration, status, notes } = req.body;

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        userId,
        date: new Date(date),
        duration: duration || 60,
        status: status || "scheduled",
        notes,
      },
      include: {
        patient: true,
        user: true,
      },
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
};

export const updateAppointment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { patientId, userId, date, duration, status, notes } = req.body;

    const appointment = await prisma.appointment.update({
      where: { id: Number(id) },
      data: {
        patientId,
        userId,
        date: new Date(date),
        duration,
        status,
        notes,
      },
      include: {
        patient: true,
        user: true,
      },
    });

    res.json(appointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
};

export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.appointment.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Agendamento excluído com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir agendamento" });
  }
};
