import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllPatients = async (_req: Request, res: Response) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { name: "asc" },
    });

    res.json(patients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar pacientes" });
  }
};

export const getPatientById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id: Number(id) },
      include: { appointments: true },
    });

    if (!patient) {
      return res.status(404).json({ error: "Paciente não encontrado" });
    }

    res.json(patient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar paciente" });
  }
};

export const createPatient = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, birthDate, notes } = req.body;

    const patient = await prisma.patient.create({
      data: {
        name,
        email,
        phone,
        birthDate: birthDate ? new Date(birthDate) : null,
        notes,
      },
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar paciente" });
  }
};

export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, birthDate, notes } = req.body;

    const patient = await prisma.patient.update({
      where: { id: Number(id) },
      data: {
        name,
        email,
        phone,
        birthDate: birthDate ? new Date(birthDate) : null,
        notes,
      },
    });

    res.json(patient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar paciente" });
  }
};

export const deletePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.patient.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Paciente excluído com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir paciente" });
  }
};
