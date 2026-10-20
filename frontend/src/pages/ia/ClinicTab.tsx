import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ClinicConfig, URGENCY_STYLE, Urgency, errorMessage, iaApi } from "../../services/iaApi";
import { TabProps } from "./IAModule";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

export const ClinicTab: React.FC<TabProps> = ({ status, notify }) => {
  const { user } = useContext(AuthContext);
  const [cfg, setCfg] = useState<ClinicConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newProc, setNewProc] = useState({ name: "", price: "" });
  const canEdit = user?.role === "admin";

  useEffect(() => {
    iaApi.config().then(setCfg).catch(() => notify("Erro ao carregar a configuração", "error"));
  }, [notify]);

  if (!cfg) return <p className="text-gray-600">Carregando...</p>;

  const change = (next: ClinicConfig) => {
    setCfg(next);
    setDirty(true);
  };

  const save = async () => {
    try {
      setCfg(await iaApi.saveConfig(cfg));
      setDirty(false);
      notify("Configuração salva", "success");
    } catch (error) {
      notify(errorMessage(error, "Erro ao salvar"), "error");
    }
  };

  const addProc = () => {
    const key = slug(newProc.name);
    if (!key || cfg.procedures[key]) return notify("Nome vazio ou já existente", "error");
    change({ ...cfg, procedures: { ...cfg.procedures, [key]: { name: newProc.name.trim(), price: Number(newProc.price) || 0 } } });
    setNewProc({ name: "", price: "" });
  };

  const procOptions = Object.entries(cfg.procedures);
  const ProcSelect: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => (
    <div className="flex flex-wrap gap-1 items-center">
      {value.map((k, i) => (
        <span key={i} className="text-xs bg-gray-100 rounded px-2 py-1">
          {cfg.procedures[k]?.name ?? k}
          {canEdit && (
            <button className="ml-1 text-gray-500 hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remover">
              ×
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <select value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} className="text-xs border border-gray-300 rounded px-1 py-1">
          <option value="">+ adicionar</option>
          {procOptions.map(([k, p]) => (
            <option key={k} value={k}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {!canEdit && (
        <p className="bg-amber-50 text-amber-800 text-sm rounded-lg p-4">Só o administrador pode alterar preços e regras.</p>
      )}
      {canEdit && dirty && (
        <div className="sticky top-2 z-10 bg-white shadow rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-gray-700">Há alterações não salvas.</span>
          <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar configuração</button>
        </div>
      )}

      <section className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Procedimentos e preços</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {procOptions.map(([k, p]) => (
              <tr key={k}>
                <td className="py-2">{p.name}</td>
                <td className="py-2 w-40">
                  <input
                    type="number"
                    min={0}
                    disabled={!canEdit}
                    value={p.price}
                    onChange={(e) => change({ ...cfg, procedures: { ...cfg.procedures, [k]: { ...p, price: Number(e.target.value) } } })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                    aria-label={`Preço de ${p.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-4">
            <input value={newProc.name} onChange={(e) => setNewProc({ ...newProc, name: e.target.value })} placeholder="Novo procedimento" className="flex-1 min-w-[12rem] px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input value={newProc.price} onChange={(e) => setNewProc({ ...newProc, price: e.target.value })} placeholder="Preço" inputMode="decimal" className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <button onClick={addProc} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Adicionar</button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Regras: do achado ao tratamento</h2>
        <p className="text-sm text-gray-600 mb-3">
          A opção principal entra nos planos Urgente e Recomendado. O plano Econômico usa a opção mais barata.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr>
                <th className="py-2">Achado</th>
                <th className="py-2">Urgência</th>
                <th className="py-2">Opção principal</th>
                <th className="py-2">Alternativa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(cfg.rules).map(([type, r]) => {
                const set = (patch: Partial<typeof r>) => change({ ...cfg, rules: { ...cfg.rules, [type]: { ...r, ...patch } } });
                return (
                  <tr key={type}>
                    <td className="py-2 pr-2">{r.label}</td>
                    <td className="py-2 pr-2">
                      <select
                        disabled={!canEdit}
                        value={r.urgency}
                        onChange={(e) => set({ urgency: e.target.value as Urgency })}
                        className={`text-xs rounded px-2 py-1 ${URGENCY_STYLE[r.urgency].chip}`}
                      >
                        {Object.entries(status.urgencyLabels).map(([k, l]) => (
                          <option key={k} value={k}>{l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2"><ProcSelect value={r.recommended} onChange={(v) => set({ recommended: v })} /></td>
                    <td className="py-2"><ProcSelect value={r.alternative} onChange={(v) => set({ alternative: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
