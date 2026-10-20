import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Modal from "../../components/Modal";
import { Finding, PlanOption, Radiograph, URGENCY_STYLE, brl, errorMessage, iaApi } from "../../services/iaApi";
import { TabProps } from "./IAModule";
import { RadiographViewer, readImage } from "./RadiographViewer";
import { PatientMode } from "./PatientMode";

type Box = { x: number; y: number; w: number; h: number };

export const RadiographTab: React.FC<TabProps> = ({ status, patient, notify }) => {
  const [params, setParams] = useSearchParams();
  const [consent, setConsent] = useState(false);
  const [list, setList] = useState<Radiograph[]>([]);
  const [rx, setRx] = useState<Radiograph | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [plans, setPlans] = useState<{ pendingReview: number; options: PlanOption[] } | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [newBox, setNewBox] = useState<Box | null>(null);
  const [form, setForm] = useState({ type: "carie", tooth: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [patientMode, setPatientMode] = useState(false);
  const [kind, setKind] = useState("panoramica");

  const rxId = Number(params.get("rx")) || null;
  const selectRx = (id: number | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("rx", String(id));
    else p.delete("rx");
    setParams(p);
  };

  const loadList = useCallback(async () => {
    if (!patient) return;
    const [c, l] = await Promise.all([iaApi.consent(patient.id), iaApi.radiographs(patient.id)]);
    setConsent(c);
    setList(l);
  }, [patient]);

  const loadRx = useCallback(async () => {
    if (!rxId) {
      setRx(null);
      setPlans(null);
      return;
    }
    const [r, p] = await Promise.all([iaApi.radiograph(rxId), iaApi.plans(rxId)]);
    setRx(r);
    setPlans(p);
  }, [rxId]);

  useEffect(() => {
    loadList().catch(() => notify("Erro ao carregar radiografias", "error"));
  }, [loadList, notify]);

  useEffect(() => {
    loadRx().catch(() => notify("Erro ao abrir a radiografia", "error"));
  }, [loadRx, notify]);

  useEffect(() => {
    if (!rxId) return setSrc(null);
    let url: string | null = null;
    iaApi.imageUrl(rxId).then((u) => setSrc((url = u)));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [rxId]);

  if (!patient) return null;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) notify(ok, "success");
    } catch (error) {
      notify(errorMessage(error, "Não foi possível concluir"), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleConsent = () =>
    run(async () => {
      await iaApi.setConsent(patient.id, !consent);
      setConsent(!consent);
    }, consent ? "Consentimento revogado" : "Consentimento registrado");

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    run(async () => {
      const img = await readImage(file);
      const created = await iaApi.upload(patient.id, { ...img, kind });
      await loadList();
      selectRx(created.id);
    }, "Radiografia enviada");
  };

  const analyze = () =>
    run(async () => {
      const r = await iaApi.analyze(rx!.id);
      if (r.aiStatus === "error") throw new Error(r.aiError ?? "");
      await Promise.all([loadRx(), loadList()]);
    }, "Análise concluída. Revise as sugestões.");

  const setFinding = (f: Finding, data: Partial<Finding>) =>
    run(async () => {
      await iaApi.updateFinding(rx!.id, f.id, data);
      await Promise.all([loadRx(), loadList()]);
    });

  const saveNew = () =>
    run(async () => {
      await iaApi.addFinding(rx!.id, {
        ...newBox!,
        type: form.type,
        tooth: form.tooth ? Number(form.tooth) : null,
        note: form.note || null,
      });
      setNewBox(null);
      setDrawing(false);
      setForm({ type: "carie", tooth: "", note: "" });
      await Promise.all([loadRx(), loadList()]);
    }, "Achado adicionado");

  const accept = (option: string) =>
    run(async () => {
      await iaApi.acceptPlan(rx!.id, option);
      setPatientMode(false);
      await loadRx();
    }, "Plano registrado. O caso foi para o painel.");

  const findings = (rx?.findings ?? []).filter((f) => f.status !== "rejected");
  const suggested = findings.filter((f) => f.status === "suggested").length;
  const acceptedPlan = rx?.plans?.find((p) => p.status !== "cancelled");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <aside className="space-y-4">
        <section className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-2">Consentimento (LGPD)</h2>
          <p className="text-sm text-gray-600 mb-3">
            {consent
              ? "O paciente autorizou a análise das radiografias por IA."
              : "Sem autorização registrada. A marcação manual continua disponível."}
          </p>
          <button
            onClick={toggleConsent}
            disabled={busy}
            className={`px-3 py-2 text-sm rounded-lg ${consent ? "text-red-600 hover:bg-red-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}
          >
            {consent ? "Revogar autorização" : "Registrar autorização do paciente"}
          </button>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Radiografias</h2>
          <div className="flex gap-2 mb-3">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="panoramica">Panorâmica</option>
              <option value="periapical">Periapical</option>
              <option value="interproximal">Interproximal</option>
            </select>
            <label className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm cursor-pointer">
              + Enviar imagem
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onUpload} disabled={busy} />
            </label>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma radiografia ainda.</p>
          ) : (
            <ul className="divide-y">
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => selectRx(r.id)}
                    className={`w-full text-left py-2 px-2 rounded text-sm ${r.id === rxId ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"}`}
                  >
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")} · {r.kind} · {r._count?.findings ?? 0} achados
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <section className="lg:col-span-2 space-y-6">
        {!rx || !src ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
            Envie ou escolha uma radiografia para ver os achados e montar o plano.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-800">Radiografia e achados</h2>
                <div className="flex flex-wrap gap-2">
                  {status.aiEnabled && (
                    <button
                      onClick={analyze}
                      disabled={busy || !consent}
                      title={consent ? "" : "Registre a autorização do paciente primeiro"}
                      className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {busy && rx.aiStatus === "analyzing" ? "Analisando..." : "Sugerir achados com IA"}
                    </button>
                  )}
                  <button
                    onClick={() => setDrawing(!drawing)}
                    aria-pressed={drawing}
                    className={`px-3 py-2 text-sm rounded-lg border ${drawing ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-50"}`}
                  >
                    {drawing ? "Arraste sobre a imagem" : "Marcar achado"}
                  </button>
                  <button
                    onClick={() =>
                      window.confirm("Excluir esta radiografia e os achados?") &&
                      run(async () => {
                        await iaApi.removeRadiograph(rx.id);
                        selectRx(null);
                        await loadList();
                      }, "Radiografia excluída")
                    }
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <RadiographViewer
                src={src}
                findings={rx.findings ?? []}
                status={status}
                activeId={activeId}
                onSelect={setActiveId}
                onDraw={drawing ? setNewBox : undefined}
              />
              {rx.aiStatus === "error" && <p className="text-sm text-red-600 mt-3">{rx.aiError}</p>}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Achados</h2>
              {suggested > 0 && (
                <p className="text-sm text-purple-700 mb-3">
                  {suggested} sugestões da IA aguardam sua revisão. Confirme, corrija ou descarte cada uma.
                </p>
              )}
              {findings.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum achado. Use "Marcar achado" para desenhar sobre a imagem.</p>
              ) : (
                <ol className="divide-y">
                  {findings.map((f, i) => {
                    const t = status.findingTypes[f.type];
                    return (
                      <li
                        key={f.id}
                        onMouseEnter={() => setActiveId(f.id)}
                        className={`py-3 flex flex-wrap items-center gap-3 ${f.id === activeId ? "bg-blue-50" : ""}`}
                      >
                        <span className={`text-xs font-bold px-2 py-1 rounded ${URGENCY_STYLE[t.urgency].chip}`}>{i + 1}</span>
                        <select
                          value={f.type}
                          onChange={(e) => setFinding(f, { type: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {Object.entries(status.findingTypes).map(([k, ft]) => (
                            <option key={k} value={k}>{ft.label}</option>
                          ))}
                        </select>
                        <input
                          defaultValue={f.tooth ?? ""}
                          onBlur={(e) => e.target.value !== String(f.tooth ?? "") && setFinding(f, { tooth: Number(e.target.value) || null })}
                          placeholder="dente"
                          aria-label="Dente (FDI)"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-xs text-gray-500">
                          {f.source === "ai" ? `IA${f.confidence != null ? ` · ${Math.round(f.confidence * 100)}%` : ""}` : "dentista"}
                          {f.note ? ` · ${f.note}` : ""}
                        </span>
                        <span className="ml-auto flex gap-2">
                          {f.status === "suggested" ? (
                            <>
                              <button onClick={() => setFinding(f, { status: "confirmed" })} className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                                Confirmar
                              </button>
                              <button onClick={() => setFinding(f, { status: "rejected" })} className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded">
                                Descartar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => run(async () => { await iaApi.removeFinding(rx.id, f.id); await loadRx(); })}
                              className="px-2 py-1 text-sm text-gray-500 hover:text-red-600"
                            >
                              Remover
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {plans && (
              <div className="bg-white rounded-lg shadow-sm p-5">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <h2 className="font-semibold text-gray-800">Plano de tratamento</h2>
                  <button
                    onClick={() => setPatientMode(true)}
                    disabled={plans.pendingReview > 0 || plans.options[1].items.length === 0}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Mostrar ao paciente
                  </button>
                </div>
                {plans.pendingReview > 0 && (
                  <p className="text-sm text-amber-700 mb-3">O plano considera só os achados confirmados. Revise as sugestões antes de apresentar.</p>
                )}
                {acceptedPlan && (
                  <p className="text-sm text-green-700 mb-3">
                    Paciente escolheu o plano {acceptedPlan.option} ({brl(acceptedPlan.total)}).
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.options.map((p) => (
                    <article key={p.key} className={`border rounded-lg p-4 ${acceptedPlan?.option === p.key ? "border-green-500" : "border-gray-200"}`}>
                      <h3 className="font-semibold text-gray-800">{p.name}</h3>
                      <p className="text-xs text-gray-500 mb-2">{p.description}</p>
                      <p className="text-2xl font-bold text-gray-800 mb-2">{brl(p.total)}</p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {p.items.map((l) => (
                          <li key={l.findingId} className="flex justify-between gap-2">
                            <span>{l.tooth ? `${l.tooth} · ` : ""}{l.procedures.map((x) => x.name).join(" + ")}</span>
                            <span className="whitespace-nowrap">{brl(l.value)}</span>
                          </li>
                        ))}
                        {p.items.length === 0 && <li className="text-gray-500">Nenhum item.</li>}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <Modal isOpen={!!newBox} onClose={() => setNewBox(null)} title="Novo achado">
        <div className="space-y-4">
          <label className="block text-sm">
            Tipo
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
              {Object.entries(status.findingTypes).map(([k, ft]) => (
                <option key={k} value={k}>{ft.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Dente (FDI)
            <input value={form.tooth} onChange={(e) => setForm({ ...form, tooth: e.target.value })} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </label>
          <label className="block text-sm">
            Observação
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </label>
          <button onClick={saveNew} disabled={busy} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Salvar achado
          </button>
        </div>
      </Modal>

      {patientMode && plans && (
        <PatientMode
          src={src!}
          findings={findings.filter((f) => f.status === "confirmed")}
          plans={plans.options}
          status={status}
          onClose={() => setPatientMode(false)}
          onAccept={accept}
        />
      )}
    </div>
  );
};
