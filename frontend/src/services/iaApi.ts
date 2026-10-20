import api from "./api";

export type Urgency = "alta" | "media" | "baixa" | "info";

export interface FindingTypeInfo {
  label: string;
  urgency: Urgency;
  plain: string;
}

export interface IAStatus {
  aiEnabled: boolean;
  model: string | null;
  findingTypes: Record<string, FindingTypeInfo>;
  urgencyLabels: Record<Urgency, string>;
}

export interface Finding {
  id: number;
  type: string;
  tooth: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  note: string | null;
  source: "ai" | "dentist";
  confidence: number | null;
  status: "suggested" | "confirmed" | "rejected";
}

export interface Radiograph {
  id: number;
  patientId: number;
  kind: string;
  aiStatus: string;
  aiModel: string | null;
  aiError: string | null;
  createdAt: string;
  findings?: Finding[];
  plans?: TreatmentPlan[];
  _count?: { findings: number };
}

export interface PlanLine {
  findingId: number;
  tooth: number | null;
  label: string;
  procedures: { key: string; name: string; price: number }[];
  value: number;
}

export interface PlanOption {
  key: "urgente" | "recomendado" | "economico";
  name: string;
  description: string;
  items: PlanLine[];
  total: number;
}

export interface TreatmentPlan {
  id: number;
  option: string;
  total: number;
  status: string;
}

export interface ClinicConfig {
  procedures: Record<string, { name: string; price: number }>;
  rules: Record<string, { label: string; urgency: Urgency; recommended: string[]; alternative: string[] }>;
}

export interface PerioTooth {
  V: number[];
  L: number[];
  bV: number[];
  bL: number[];
}

export interface Perio {
  id: number | null;
  data: Record<string, PerioTooth>;
  summary: { measuredSites: number; pocketsOver4mm: number; bleedingIndex: number };
  results?: { ok: boolean; text: string }[];
}

export const URGENCY_STYLE: Record<Urgency, { box: string; chip: string }> = {
  alta: { box: "#ef4444", chip: "bg-red-100 text-red-800" },
  media: { box: "#f59e0b", chip: "bg-amber-100 text-amber-800" },
  baixa: { box: "#10b981", chip: "bg-emerald-100 text-emerald-800" },
  info: { box: "#6366f1", chip: "bg-indigo-100 text-indigo-800" },
};

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

export const iaApi = {
  status: () => api.get<IAStatus>("/ia/status").then((r) => r.data),
  config: () => api.get<ClinicConfig>("/ia/config").then((r) => r.data),
  saveConfig: (c: ClinicConfig) => api.put<ClinicConfig>("/ia/config", c).then((r) => r.data),

  consent: (patientId: number) =>
    api.get<{ granted: boolean }>(`/ia/patients/${patientId}/consent`).then((r) => r.data.granted),
  setConsent: (patientId: number, granted: boolean) =>
    api.put(`/ia/patients/${patientId}/consent`, { granted }),

  radiographs: (patientId: number) =>
    api.get<Radiograph[]>(`/ia/patients/${patientId}/radiographs`).then((r) => r.data),
  upload: (patientId: number, body: { image: string; kind: string; width: number; height: number }) =>
    api.post<Radiograph>(`/ia/patients/${patientId}/radiographs`, body).then((r) => r.data),
  radiograph: (id: number) => api.get<Radiograph>(`/ia/radiographs/${id}`).then((r) => r.data),
  imageUrl: async (id: number) => {
    const r = await api.get(`/ia/radiographs/${id}/image`, { responseType: "blob" });
    return URL.createObjectURL(r.data);
  },
  removeRadiograph: (id: number) => api.delete(`/ia/radiographs/${id}`),
  analyze: (id: number) => api.post<Radiograph>(`/ia/radiographs/${id}/analyze`).then((r) => r.data),

  addFinding: (rid: number, f: Partial<Finding>) =>
    api.post<Finding>(`/ia/radiographs/${rid}/findings`, f).then((r) => r.data),
  updateFinding: (rid: number, fid: number, f: Partial<Finding>) =>
    api.patch<Finding>(`/ia/radiographs/${rid}/findings/${fid}`, f).then((r) => r.data),
  removeFinding: (rid: number, fid: number) => api.delete(`/ia/radiographs/${rid}/findings/${fid}`),

  plans: (rid: number) =>
    api.get<{ pendingReview: number; options: PlanOption[] }>(`/ia/radiographs/${rid}/plans`).then((r) => r.data),
  acceptPlan: (rid: number, option: string) => api.post(`/ia/radiographs/${rid}/plans/accept`, { option }),
  setPlanStatus: (planId: number, status: string) => api.patch(`/ia/plans/${planId}`, { status }),

  perio: (patientId: number) => api.get<Perio>(`/ia/patients/${patientId}/perio`).then((r) => r.data),
  dictate: (patientId: number, text: string, novo = false) =>
    api.post<Perio>(`/ia/patients/${patientId}/perio/dictation`, { text, novo }).then((r) => r.data),
  savePerio: (patientId: number, data: Perio["data"]) =>
    api.put<Perio>(`/ia/patients/${patientId}/perio`, { data }).then((r) => r.data),

  dashboard: () => api.get("/ia/dashboard").then((r) => r.data),
};
