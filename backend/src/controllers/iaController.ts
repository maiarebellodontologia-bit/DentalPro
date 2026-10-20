import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  DEFAULT_PROCEDURES,
  FINDING_TYPES,
  URGENCY_LABEL,
  isValidTooth,
} from "../services/ia/catalog.js";
import { buildPlans, ClinicRule } from "../services/ia/planBuilder.js";
import { PerioData, parseDictation, summarize } from "../services/ia/perioParser.js";
import { getRadiographAI } from "../services/ia/aiProvider.js";

const prisma = new PrismaClient();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads/radiografias");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};
const CONSENT_AI = "ia_radiografia";

const id = (v: string | string[]) => Number.parseInt(String(v), 10);
const parseList = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const audit = (req: Request, action: string, entity: string, entityId?: number, detail?: string) =>
  prisma.auditLog
    .create({ data: { userId: req.auth?.userId, action, entity, entityId, detail } })
    .catch((e) => console.error("Falha ao registrar auditoria", e));

// Copia preços e regras padrão para o banco na primeira vez.
async function loadClinic() {
  if ((await prisma.clinicProcedure.count()) === 0) {
    await prisma.clinicProcedure.createMany({
      data: Object.entries(DEFAULT_PROCEDURES).map(([key, p]) => ({ key, ...p })),
    });
  }
  if ((await prisma.findingRule.count()) === 0) {
    await prisma.findingRule.createMany({
      data: Object.entries(FINDING_TYPES).map(([type, t]) => ({
        type,
        urgency: t.urgency,
        recommended: JSON.stringify(t.recommended),
        alternative: JSON.stringify(t.alternative),
      })),
    });
  }

  const [procs, ruleRows] = await Promise.all([
    prisma.clinicProcedure.findMany({ orderBy: { name: "asc" } }),
    prisma.findingRule.findMany(),
  ]);

  const procedures = Object.fromEntries(procs.map((p) => [p.key, { name: p.name, price: p.price }]));
  const rules: Record<string, ClinicRule> = {};
  for (const [type, t] of Object.entries(FINDING_TYPES)) {
    const row = ruleRows.find((r) => r.type === type);
    rules[type] = {
      label: t.label,
      urgency: (row?.urgency as ClinicRule["urgency"]) ?? t.urgency,
      recommended: row ? parseList(row.recommended) : t.recommended,
      alternative: row ? parseList(row.alternative) : t.alternative,
    };
  }
  return { procedures, rules };
}

async function hasConsent(patientId: number) {
  const c = await prisma.consent.findFirst({
    where: { patientId, purpose: CONSENT_AI, revokedAt: null },
  });
  return !!c;
}

const handle =
  (label: string, fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Erro ao ${label}` });
    }
  };

// ---------- Status e catálogo ----------

export const getStatus = handle("ler status da IA", async (_req, res) => {
  const ai = getRadiographAI();
  res.json({
    aiEnabled: !!ai,
    model: ai?.model ?? null,
    findingTypes: Object.fromEntries(
      Object.entries(FINDING_TYPES).map(([k, t]) => [k, { label: t.label, urgency: t.urgency, plain: t.plain }])
    ),
    urgencyLabels: URGENCY_LABEL,
  });
});

export const getConfig = handle("carregar configuração", async (_req, res) => {
  res.json(await loadClinic());
});

export const updateConfig = handle("salvar configuração", async (req, res) => {
  const { procedures, rules } = req.body ?? {};
  if (!procedures || typeof procedures !== "object" || !rules || typeof rules !== "object") {
    return res.status(400).json({ error: "Envie procedimentos e regras" });
  }

  const procEntries = Object.entries(procedures as Record<string, any>).filter(
    ([key, p]) => /^[a-z0-9_]{1,40}$/.test(key) && typeof p?.name === "string" && p.name.trim() && Number(p.price) >= 0
  );
  const keys = new Set(procEntries.map(([k]) => k));
  const onlyKnown = (v: unknown) => (Array.isArray(v) ? v.filter((k) => keys.has(k)) : []);

  await prisma.$transaction([
    prisma.clinicProcedure.deleteMany({}),
    prisma.clinicProcedure.createMany({
      data: procEntries.map(([key, p]) => ({ key, name: String(p.name).trim().slice(0, 120), price: Number(p.price) })),
    }),
    ...Object.keys(FINDING_TYPES).map((type) => {
      const r = (rules as Record<string, any>)[type] ?? {};
      const urgency = ["alta", "media", "baixa", "info"].includes(r.urgency) ? r.urgency : FINDING_TYPES[type].urgency;
      const data = {
        urgency,
        recommended: JSON.stringify(onlyKnown(r.recommended)),
        alternative: JSON.stringify(onlyKnown(r.alternative)),
      };
      return prisma.findingRule.upsert({ where: { type }, update: data, create: { type, ...data } });
    }),
  ]);

  audit(req, "update", "clinic_config");
  res.json(await loadClinic());
});

// ---------- Consentimento (LGPD) ----------

export const getConsent = handle("ler consentimento", async (req, res) => {
  const patientId = id(req.params.patientId);
  res.json({ granted: await hasConsent(patientId) });
});

export const setConsent = handle("registrar consentimento", async (req, res) => {
  const patientId = id(req.params.patientId);
  const granted = req.body?.granted === true;
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });

  if (granted) {
    if (!(await hasConsent(patientId))) {
      await prisma.consent.create({ data: { patientId, purpose: CONSENT_AI, userId: req.auth!.userId } });
    }
  } else {
    await prisma.consent.updateMany({
      where: { patientId, purpose: CONSENT_AI, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  audit(req, granted ? "consent_grant" : "consent_revoke", "patient", patientId);
  res.json({ granted });
});

// ---------- Radiografias ----------

export const listRadiographs = handle("listar radiografias", async (req, res) => {
  const patientId = id(req.params.patientId);
  const items = await prisma.radiograph.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { findings: true } } },
  });
  res.json(items.map(({ filePath: _f, ...r }) => r));
});

export const uploadRadiograph = handle("enviar radiografia", async (req, res) => {
  const patientId = id(req.params.patientId);
  const { image, kind, width, height } = req.body ?? {};
  const match = typeof image === "string" ? /^data:(image\/[a-z]+);base64,(.+)$/.exec(image) : null;
  if (!match || !ALLOWED_MIME[match[1]]) {
    return res.status(400).json({ error: "Envie uma imagem JPG, PNG ou WebP" });
  }

  const buffer = Buffer.from(match[2], "base64");
  const magic = ALLOWED_MIME[match[1]];
  if (buffer.length > MAX_IMAGE_BYTES || !magic.every((b, i) => buffer[i] === b)) {
    return res.status(400).json({ error: "Imagem inválida ou maior que 10 MB" });
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${match[1].split("/")[1]}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

  const radiograph = await prisma.radiograph.create({
    data: {
      patientId,
      kind: ["panoramica", "periapical", "interproximal"].includes(kind) ? kind : "panoramica",
      filePath: fileName,
      mimeType: match[1],
      width: Number.isInteger(width) ? width : null,
      height: Number.isInteger(height) ? height : null,
    },
  });
  audit(req, "upload", "radiograph", radiograph.id);
  const { filePath: _f, ...rest } = radiograph;
  res.status(201).json(rest);
});

export const getRadiograph = handle("buscar radiografia", async (req, res) => {
  const radiograph = await prisma.radiograph.findUnique({
    where: { id: id(req.params.id) },
    include: {
      findings: { orderBy: { id: "asc" } },
      plans: { where: { status: { not: "cancelled" } } },
      patient: { select: { id: true, name: true } },
    },
  });
  if (!radiograph) return res.status(404).json({ error: "Radiografia não encontrada" });
  const { filePath: _f, ...rest } = radiograph;
  res.json(rest);
});

export const getRadiographImage = handle("abrir imagem", async (req, res) => {
  const radiograph = await prisma.radiograph.findUnique({ where: { id: id(req.params.id) } });
  if (!radiograph) return res.status(404).json({ error: "Radiografia não encontrada" });
  res.setHeader("Content-Type", radiograph.mimeType);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(await fs.readFile(path.join(UPLOAD_DIR, path.basename(radiograph.filePath))));
});

export const deleteRadiograph = handle("excluir radiografia", async (req, res) => {
  const radiograph = await prisma.radiograph.findUnique({ where: { id: id(req.params.id) } });
  if (!radiograph) return res.status(404).json({ error: "Radiografia não encontrada" });
  await prisma.radiograph.delete({ where: { id: radiograph.id } });
  await fs.rm(path.join(UPLOAD_DIR, path.basename(radiograph.filePath)), { force: true });
  audit(req, "delete", "radiograph", radiograph.id);
  res.json({ message: "Radiografia excluída" });
});

export const analyzeRadiograph = handle("analisar radiografia", async (req, res) => {
  const radiograph = await prisma.radiograph.findUnique({ where: { id: id(req.params.id) } });
  if (!radiograph) return res.status(404).json({ error: "Radiografia não encontrada" });

  const ai = getRadiographAI();
  if (!ai) {
    return res.status(503).json({ error: "IA não configurada. Marque os achados manualmente." });
  }
  if (!(await hasConsent(radiograph.patientId))) {
    return res.status(403).json({ error: "Registre o consentimento do paciente para análise por IA" });
  }

  await prisma.radiograph.update({ where: { id: radiograph.id }, data: { aiStatus: "analyzing", aiError: null } });
  try {
    const image = await fs.readFile(path.join(UPLOAD_DIR, path.basename(radiograph.filePath)));
    const suggestions = await ai.analyze(image, radiograph.mimeType, radiograph.kind);

    await prisma.$transaction([
      // Uma nova análise substitui só as sugestões ainda não revisadas.
      prisma.finding.deleteMany({ where: { radiographId: radiograph.id, source: "ai", status: "suggested" } }),
      prisma.finding.createMany({
        data: suggestions.map((s) => ({ ...s, radiographId: radiograph.id, source: "ai", status: "suggested" })),
      }),
      prisma.radiograph.update({ where: { id: radiograph.id }, data: { aiStatus: "done", aiModel: ai.model } }),
    ]);
    audit(req, "ai_analyze", "radiograph", radiograph.id, `${suggestions.length} sugestões`);
  } catch (error) {
    console.error(error);
    await prisma.radiograph.update({
      where: { id: radiograph.id },
      data: { aiStatus: "error", aiError: "A análise falhou. Tente de novo ou marque manualmente." },
    });
  }

  const updated = await prisma.radiograph.findUnique({
    where: { id: radiograph.id },
    include: { findings: { orderBy: { id: "asc" } } },
  });
  const { filePath: _f, ...rest } = updated!;
  res.json(rest);
});

// ---------- Achados (revisão do dentista) ----------

const readBox = (b: any) => {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
  const box = { x: n(b.x), y: n(b.y), w: n(b.w), h: n(b.h) };
  return Object.values(box).every((v) => v !== null) ? (box as Record<"x" | "y" | "w" | "h", number>) : null;
};

export const createFinding = handle("criar achado", async (req, res) => {
  const radiographId = id(req.params.id);
  const { type, tooth, note } = req.body ?? {};
  const box = readBox(req.body ?? {});
  if (!FINDING_TYPES[type] || !box) return res.status(400).json({ error: "Tipo ou posição inválidos" });

  const finding = await prisma.finding.create({
    data: {
      radiographId,
      type,
      tooth: isValidTooth(tooth) ? tooth : null,
      note: typeof note === "string" ? note.slice(0, 200) : null,
      ...box,
      source: "dentist",
      status: "confirmed",
    },
  });
  res.status(201).json(finding);
});

export const updateFinding = handle("atualizar achado", async (req, res) => {
  const { type, tooth, note, status } = req.body ?? {};
  const box = readBox(req.body ?? {});
  const data: Record<string, unknown> = {};
  if (type !== undefined) {
    if (!FINDING_TYPES[type]) return res.status(400).json({ error: "Tipo inválido" });
    data.type = type;
  }
  if (tooth !== undefined) data.tooth = isValidTooth(tooth) ? tooth : null;
  if (note !== undefined) data.note = typeof note === "string" ? note.slice(0, 200) : null;
  if (status !== undefined) {
    if (!["suggested", "confirmed", "rejected"].includes(status)) return res.status(400).json({ error: "Status inválido" });
    data.status = status;
  }
  if (box) Object.assign(data, box);

  const finding = await prisma.finding.update({ where: { id: id(req.params.findingId) }, data });
  if (status === "confirmed" || status === "rejected") {
    await prisma.radiograph.update({
      where: { id: finding.radiographId },
      data: { reviewedAt: new Date(), reviewedBy: req.auth!.userId },
    });
  }
  res.json(finding);
});

export const deleteFinding = handle("excluir achado", async (req, res) => {
  await prisma.finding.delete({ where: { id: id(req.params.findingId) } });
  res.json({ message: "Achado excluído" });
});

// ---------- Planos de tratamento ----------

async function plansFor(radiographId: number) {
  const [findings, clinic] = await Promise.all([
    prisma.finding.findMany({ where: { radiographId, status: "confirmed" }, orderBy: { id: "asc" } }),
    loadClinic(),
  ]);
  return buildPlans(findings, clinic.rules, clinic.procedures);
}

export const getPlans = handle("montar planos", async (req, res) => {
  const radiographId = id(req.params.id);
  const pending = await prisma.finding.count({ where: { radiographId, status: "suggested" } });
  res.json({ pendingReview: pending, options: await plansFor(radiographId) });
});

export const acceptPlan = handle("registrar plano", async (req, res) => {
  const radiographId = id(req.params.id);
  const radiograph = await prisma.radiograph.findUnique({ where: { id: radiographId } });
  if (!radiograph) return res.status(404).json({ error: "Radiografia não encontrada" });

  const pending = await prisma.finding.count({ where: { radiographId, status: "suggested" } });
  if (pending > 0) {
    return res.status(409).json({ error: `Revise as ${pending} sugestões da IA antes de apresentar o plano` });
  }

  const option = (await plansFor(radiographId)).find((p) => p.key === req.body?.option);
  if (!option || option.items.length === 0) return res.status(400).json({ error: "Opção de plano inválida" });

  const [, plan] = await prisma.$transaction([
    prisma.treatmentPlan.updateMany({
      where: { radiographId, status: "accepted" },
      data: { status: "cancelled" },
    }),
    prisma.treatmentPlan.create({
      data: {
        patientId: radiograph.patientId,
        radiographId,
        option: option.key,
        items: JSON.stringify(option.items),
        total: option.total,
        userId: req.auth!.userId,
      },
    }),
  ]);
  audit(req, "plan_accept", "treatment_plan", plan.id, option.key);
  res.status(201).json(plan);
});

export const updatePlanStatus = handle("atualizar plano", async (req, res) => {
  const status = req.body?.status;
  if (!["accepted", "done", "cancelled"].includes(status)) return res.status(400).json({ error: "Status inválido" });
  const plan = await prisma.treatmentPlan.update({
    where: { id: id(req.params.planId) },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });
  res.json(plan);
});

// ---------- Periograma ----------

const latestPerio = (patientId: number) =>
  prisma.perioChart.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" } });

const perioJson = (row: { id: number; data: string; updatedAt: Date } | null) => {
  const data: PerioData = row ? JSON.parse(row.data) : {};
  return { id: row?.id ?? null, updatedAt: row?.updatedAt ?? null, data, summary: summarize(data) };
};

export const getPerio = handle("carregar periograma", async (req, res) => {
  res.json(perioJson(await latestPerio(id(req.params.patientId))));
});

// Aplica um ditado ao periograma atual. Com "novo": true, começa um exame novo.
export const dictatePerio = handle("aplicar ditado", async (req, res) => {
  const patientId = id(req.params.patientId);
  const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 5000) : "";
  if (!text.trim()) return res.status(400).json({ error: "Dite ou digite as medidas" });

  const current = req.body?.novo ? null : await latestPerio(patientId);
  const data: PerioData = current ? JSON.parse(current.data) : {};
  const results = parseDictation(text, data);

  const row = current
    ? await prisma.perioChart.update({ where: { id: current.id }, data: { data: JSON.stringify(data) } })
    : await prisma.perioChart.create({ data: { patientId, userId: req.auth!.userId, data: JSON.stringify(data) } });

  res.json({ ...perioJson(row), results });
});

export const savePerio = handle("salvar periograma", async (req, res) => {
  const patientId = id(req.params.patientId);
  const data = req.body?.data;
  if (!data || typeof data !== "object") return res.status(400).json({ error: "Periograma inválido" });
  const current = await latestPerio(patientId);
  const row = current
    ? await prisma.perioChart.update({ where: { id: current.id }, data: { data: JSON.stringify(data) } })
    : await prisma.perioChart.create({ data: { patientId, userId: req.auth!.userId, data: JSON.stringify(data) } });
  res.json(perioJson(row));
});

// ---------- Painel: tratamento diagnosticado e não realizado ----------

export const getDashboard = handle("montar painel", async (_req, res) => {
  const now = new Date();
  const [radiographs, futureAppointments, clinic] = await Promise.all([
    prisma.radiograph.findMany({
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        findings: { where: { status: { in: ["confirmed", "suggested"] } } },
        plans: { where: { status: { not: "cancelled" } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { date: { gte: now }, status: "scheduled" },
      select: { patientId: true },
    }),
    loadClinic(),
  ]);

  const scheduled = new Set(futureAppointments.map((a) => a.patientId));
  const cases = radiographs.map((r) => {
    const confirmed = r.findings.filter((f) => f.status === "confirmed");
    const plan = r.plans[0];
    const recommended = buildPlans(confirmed, clinic.rules, clinic.procedures).find((p) => p.key === "recomendado")!;
    const stage = r.findings.some((f) => f.status === "suggested")
      ? "revisar"
      : plan?.status === "done"
        ? "realizado"
        : plan
          ? "aceito"
          : recommended.items.length
            ? "sem_plano"
            : "sem_tratamento";
    return {
      radiographId: r.id,
      patient: r.patient,
      date: r.createdAt,
      stage,
      urgent: confirmed.filter((f) => clinic.rules[f.type]?.urgency === "alta").length,
      diagnosedValue: recommended.total,
      plan: plan ? { id: plan.id, option: plan.option, total: plan.total, status: plan.status } : null,
      hasFutureAppointment: scheduled.has(r.patient.id),
    };
  });

  const sum = (list: typeof cases, f: (c: (typeof cases)[number]) => number) => list.reduce((a, c) => a + f(c), 0);
  const presented = cases.filter((c) => ["sem_plano", "aceito", "realizado"].includes(c.stage));
  const accepted = cases.filter((c) => c.stage === "aceito" || c.stage === "realizado");
  const open = cases.filter((c) => c.stage === "sem_plano" || c.stage === "aceito");

  res.json({
    totals: {
      toReview: cases.filter((c) => c.stage === "revisar").length,
      diagnosedNotAccepted: sum(cases.filter((c) => c.stage === "sem_plano"), (c) => c.diagnosedValue),
      acceptedNotDone: sum(cases.filter((c) => c.stage === "aceito"), (c) => c.plan!.total),
      done: sum(cases.filter((c) => c.stage === "realizado"), (c) => c.plan!.total),
      acceptanceRate: presented.length ? Math.round((accepted.length / presented.length) * 100) : 0,
      openWithoutAppointment: open.filter((c) => !c.hasFutureAppointment).length,
    },
    cases,
  });
});
