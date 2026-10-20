import React, { useCallback, useEffect, useState } from "react";
import { brl, errorMessage, iaApi } from "../../services/iaApi";
import { TabProps } from "./IAModule";

interface Case {
  radiographId: number;
  patient: { id: number; name: string; phone: string };
  date: string;
  stage: "revisar" | "sem_plano" | "aceito" | "realizado" | "sem_tratamento";
  urgent: number;
  diagnosedValue: number;
  plan: { id: number; option: string; total: number; status: string } | null;
  hasFutureAppointment: boolean;
}

interface Dashboard {
  totals: {
    toReview: number;
    diagnosedNotAccepted: number;
    acceptedNotDone: number;
    done: number;
    acceptanceRate: number;
    openWithoutAppointment: number;
  };
  cases: Case[];
}

const STAGE: Record<Case["stage"], { label: string; cls: string }> = {
  revisar: { label: "Revisar achados", cls: "bg-purple-100 text-purple-800" },
  sem_plano: { label: "Diagnosticado, sem plano aceito", cls: "bg-amber-100 text-amber-800" },
  aceito: { label: "Aceito, não realizado", cls: "bg-blue-100 text-blue-800" },
  realizado: { label: "Realizado", cls: "bg-green-100 text-green-800" },
  sem_tratamento: { label: "Sem tratamento", cls: "bg-gray-100 text-gray-600" },
};

// Inspirado no Practice Intelligence da Pearl: dinheiro parado em tratamento
// diagnosticado e não feito, cruzado com a agenda.
export const PanelTab: React.FC<TabProps> = ({ notify, openPatient }) => {
  const [data, setData] = useState<Dashboard | null>(null);
  const [filter, setFilter] = useState<string>("abertos");

  const load = useCallback(
    () => iaApi.dashboard().then(setData).catch(() => notify("Erro ao carregar o painel", "error")),
    [notify]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-gray-600">Carregando...</p>;

  const markDone = async (c: Case) => {
    try {
      await iaApi.setPlanStatus(c.plan!.id, "done");
      notify("Tratamento marcado como realizado", "success");
      load();
    } catch (error) {
      notify(errorMessage(error, "Erro ao atualizar"), "error");
    }
  };

  const cases = data.cases.filter((c) =>
    filter === "abertos" ? ["revisar", "sem_plano", "aceito"].includes(c.stage) : filter === "todos" ? true : c.stage === filter
  );

  const cards = [
    { label: "Diagnosticado, sem plano aceito", value: brl(data.totals.diagnosedNotAccepted), color: "border-amber-500" },
    { label: "Aceito e não realizado", value: brl(data.totals.acceptedNotDone), color: "border-blue-500" },
    { label: "Realizado", value: brl(data.totals.done), color: "border-green-500" },
    { label: "Taxa de aceitação", value: `${data.totals.acceptanceRate}%`, color: "border-gray-400" },
    { label: "Radiografias para revisar", value: data.totals.toReview, color: "border-purple-500" },
    { label: "Casos abertos sem retorno agendado", value: data.totals.openWithoutAppointment, color: "border-red-500" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c) => (
          <div key={c.label} className={`bg-white rounded-lg shadow-sm p-5 border-l-4 ${c.color}`}>
            <p className="text-sm text-gray-600 mb-1">{c.label}</p>
            <p className="text-3xl font-bold text-gray-800">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">Casos</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="abertos">Em aberto</option>
            <option value="sem_plano">Sem plano aceito</option>
            <option value="aceito">Aceitos, não realizados</option>
            <option value="revisar">Para revisar</option>
            <option value="realizado">Realizados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        {cases.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-500">Nenhum caso neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-6 py-3">Paciente</th>
                  <th className="px-6 py-3">Radiografia</th>
                  <th className="px-6 py-3">Situação</th>
                  <th className="px-6 py-3 text-right">Valor</th>
                  <th className="px-6 py-3">Retorno</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.map((c) => (
                  <tr key={c.radiographId}>
                    <td className="px-6 py-3">
                      <button onClick={() => openPatient(c.patient.id, c.radiographId)} className="text-blue-700 hover:underline">
                        {c.patient.name}
                      </button>
                      {c.urgent > 0 && <span className="ml-2 text-xs text-red-600">{c.urgent} urgente{c.urgent > 1 ? "s" : ""}</span>}
                    </td>
                    <td className="px-6 py-3">{new Date(c.date).toLocaleDateString("pt-BR")}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${STAGE[c.stage].cls}`}>{STAGE[c.stage].label}</span>
                    </td>
                    <td className="px-6 py-3 text-right">{brl(c.plan?.total ?? c.diagnosedValue)}</td>
                    <td className="px-6 py-3">
                      {c.hasFutureAppointment ? "Agendado" : <span className="text-red-600">Sem agenda · {c.patient.phone}</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {c.stage === "aceito" && (
                        <button onClick={() => markDone(c)} className="text-green-700 hover:text-green-900 font-medium">
                          Marcar realizado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
