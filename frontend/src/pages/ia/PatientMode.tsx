import React, { useState } from "react";
import { Finding, IAStatus, PlanOption, URGENCY_STYLE, brl } from "../../services/iaApi";
import { RadiographViewer } from "./RadiographViewer";

interface Props {
  src: string;
  findings: Finding[];
  plans: PlanOption[];
  status: IAStatus;
  onClose: () => void;
  onAccept: (option: string) => void;
}

// Tela para virar o monitor para o paciente: linguagem simples, sem jargão.
export const PatientMode: React.FC<Props> = ({ src, findings, plans, status, onClose, onAccept }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const treatable = findings.filter((f) => status.findingTypes[f.type]?.urgency !== "info");
  const urgent = findings.filter((f) => status.findingTypes[f.type]?.urgency === "alta").length;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-start gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            {treatable.length
              ? `Encontramos ${treatable.length} ${treatable.length === 1 ? "ponto" : "pontos"} para cuidar${urgent ? `, ${urgent === 1 ? "um deles" : `${urgent} deles`} com urgência` : ""}.`
              : "Sua radiografia não tem pontos para tratar agora."}
          </h2>
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <RadiographViewer src={src} findings={findings} status={status} activeId={active} onSelect={setActive} />
            <ol className="mt-4 space-y-3">
              {findings.map((f, i) => {
                const t = status.findingTypes[f.type];
                return (
                  <li key={f.id} onMouseEnter={() => setActive(f.id)} className="flex gap-3">
                    <span className={`h-7 min-w-7 px-2 flex items-center justify-center text-sm font-bold rounded ${URGENCY_STYLE[t.urgency].chip}`}>{i + 1}</span>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {t.label} {f.tooth && <span className="text-sm text-gray-500">· dente {f.tooth}</span>}
                      </p>
                      <p className="text-gray-700">{t.plain}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Escolha o seu plano</h3>
            <div className="space-y-3">
              {plans.map((p) => (
                <button
                  key={p.key}
                  disabled={p.items.length === 0}
                  aria-pressed={selected === p.key}
                  onClick={() => setSelected(p.key)}
                  className={`w-full text-left border-2 rounded-xl p-4 flex justify-between gap-4 disabled:opacity-40 ${selected === p.key ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span>
                    <b className="text-lg">{p.name}</b>
                    <br />
                    <small className="text-gray-600">
                      {p.description} {p.items.length} {p.items.length === 1 ? "item" : "itens"}.
                    </small>
                  </span>
                  <span className="text-right">
                    <b className="text-xl">{brl(p.total)}</b>
                    <br />
                    <small className="text-gray-600">ou 10× {brl(p.total / 10)}</small>
                  </span>
                </button>
              ))}
            </div>
            <button
              disabled={!selected}
              onClick={() => selected && onAccept(selected)}
              className="mt-4 w-full px-4 py-3 text-lg bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
            >
              Quero este plano
            </button>
            <p className="mt-3 text-xs text-gray-500">
              Os valores são uma estimativa. O plano final é definido com o seu dentista.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
