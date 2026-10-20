import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Toast } from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import api from "../../services/api";
import { IAStatus, iaApi } from "../../services/iaApi";
import { RadiographTab } from "./RadiographTab";
import { PerioTab } from "./PerioTab";
import { PanelTab } from "./PanelTab";
import { ClinicTab } from "./ClinicTab";

export interface PatientOption {
  id: number;
  name: string;
}

export interface TabProps {
  status: IAStatus;
  patient: PatientOption | null;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  openPatient: (patientId: number, radiographId?: number) => void;
}

const TABS = [
  { key: "radiografia", label: "Radiografia e plano" },
  { key: "periograma", label: "Periograma por voz" },
  { key: "painel", label: "Painel de tratamentos" },
  { key: "clinica", label: "Preços e regras" },
] as const;

export const IAModule: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<IAStatus | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const { toast, showToast, hideToast } = useToast();

  const tab = params.get("aba") ?? "radiografia";
  const patientId = Number(params.get("paciente")) || null;
  const patient = patients.find((p) => p.id === patientId) ?? null;

  useEffect(() => {
    Promise.all([iaApi.status(), api.get<PatientOption[]>("/patients")])
      .then(([s, p]) => {
        setStatus(s);
        setPatients(p.data);
      })
      .catch(() => showToast("Erro ao carregar o módulo de IA", "error"));
  }, [showToast]);

  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    setParams(p);
  };

  const openPatient = (id: number, radiographId?: number) =>
    update({ aba: "radiografia", paciente: String(id), rx: radiographId ? String(radiographId) : null });

  const needsPatient = tab === "radiografia" || tab === "periograma";

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <span>←</span>
            <span>Voltar</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Assistente clínico</h1>
          <span
            className={`text-xs px-2 py-1 rounded-full ${status?.aiEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
          >
            {status ? (status.aiEnabled ? "IA ativa" : "IA desligada (modo manual)") : "..."}
          </span>
        </div>
        <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => update({ aba: t.key })}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                tab === t.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {needsPatient && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label htmlFor="ia-patient" className="text-sm font-medium text-gray-700">
              Paciente
            </label>
            <select
              id="ia-patient"
              value={patientId ?? ""}
              onChange={(e) => update({ paciente: e.target.value || null, rx: null })}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white min-w-[16rem]"
            >
              <option value="">Selecione...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!status ? (
          <p className="text-gray-600">Carregando...</p>
        ) : needsPatient && !patient ? (
          <p className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
            Escolha um paciente para começar.
          </p>
        ) : tab === "radiografia" ? (
          <RadiographTab status={status} patient={patient} notify={showToast} openPatient={openPatient} />
        ) : tab === "periograma" ? (
          <PerioTab status={status} patient={patient} notify={showToast} openPatient={openPatient} />
        ) : tab === "painel" ? (
          <PanelTab status={status} patient={patient} notify={showToast} openPatient={openPatient} />
        ) : (
          <ClinicTab status={status} patient={patient} notify={showToast} openPatient={openPatient} />
        )}

        <p className="mt-8 text-xs text-gray-500">
          As sugestões da IA são apoio à decisão e não substituem o diagnóstico. Cada achado precisa ser
          revisado pelo cirurgião-dentista. Para a análise automática, só a imagem sai do DentalPro, sem
          nome ou dados do paciente; envie radiografias sem identificação gravada no filme.
        </p>
      </main>
    </div>
  );
};
