import React, { useEffect, useRef, useState } from "react";
import { Perio, PerioTooth, errorMessage, iaApi } from "../../services/iaApi";
import { TabProps } from "./IAModule";

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Reconhecimento de voz do navegador (Chrome, Edge, Safari). Sem ele, o
// dentista pode usar o microfone do teclado do celular no campo de texto.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onend: () => void;
};
const SpeechRecognitionCtor = (window as unknown as Record<string, unknown>).SpeechRecognition ??
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition as (new () => SpeechRecognitionLike) | undefined;

const depthColor = (v: number) =>
  v >= 6 ? "bg-red-500 text-white" : v >= 4 ? "bg-amber-400 text-gray-900" : v > 0 ? "bg-green-100 text-gray-800" : "bg-gray-50 text-gray-400";

export const PerioTab: React.FC<TabProps> = ({ patient, notify }) => {
  const [perio, setPerio] = useState<Perio | null>(null);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (patient) iaApi.perio(patient.id).then(setPerio).catch(() => notify("Erro ao carregar periograma", "error"));
  }, [patient, notify]);

  useEffect(() => () => recRef.current?.stop(), []);

  if (!patient) return null;

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new (SpeechRecognitionCtor as new () => SpeechRecognitionLike)();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript + "; ";
      }
      setText((t) => t + chunk);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  const apply = async (novo = false) => {
    try {
      const r = await iaApi.dictate(patient.id, text, novo);
      setPerio(r);
      const ok = r.results?.filter((x) => x.ok).length ?? 0;
      notify(`${ok} de ${r.results?.length ?? 0} trechos aplicados`, ok ? "success" : "error");
      if (ok === r.results?.length) setText("");
    } catch (error) {
      notify(errorMessage(error, "Erro ao aplicar o ditado"), "error");
    }
  };

  // Clique num sítio para corrigir a profundidade manualmente.
  const editSite = async (tooth: number, face: "V" | "L", i: number) => {
    const current = perio?.data[tooth]?.[face][i] ?? 0;
    const value = window.prompt(`Profundidade em mm (dente ${tooth}, ${face === "V" ? "vestibular" : "lingual/palatina"})`, String(current));
    if (value === null || !/^\d{1,2}$/.test(value)) return;
    const data = structuredClone(perio?.data ?? {});
    const cell: PerioTooth = data[tooth] ?? { V: [0, 0, 0], L: [0, 0, 0], bV: [0, 0, 0], bL: [0, 0, 0] };
    cell[face][i] = Number(value);
    data[tooth] = cell;
    try {
      setPerio(await iaApi.savePerio(patient.id, data));
    } catch (error) {
      notify(errorMessage(error, "Erro ao salvar"), "error");
    }
  };

  const Row: React.FC<{ teeth: number[]; face: "V" | "L" }> = ({ teeth, face }) => (
    <tr>
      <th className="text-xs text-gray-500 pr-2 text-left whitespace-nowrap">{face === "V" ? "Vestibular" : "Lingual/Palatina"}</th>
      {teeth.map((t) => {
        const cell = perio?.data[t];
        return (
          <td key={t} className="p-0.5">
            <div className="flex gap-px">
              {[0, 1, 2].map((i) => {
                const v = cell?.[face][i] ?? 0;
                const bleed = cell?.[face === "V" ? "bV" : "bL"][i];
                return (
                  <button
                    key={i}
                    onClick={() => editSite(t, face, i)}
                    title={bleed ? "Sangramento" : undefined}
                    className={`w-5 h-6 text-[11px] rounded-sm ${depthColor(v)} ${bleed ? "ring-2 ring-red-600" : ""}`}
                  >
                    {v || ""}
                  </button>
                );
              })}
            </div>
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Ditado</h2>
        <p className="text-sm text-gray-600 mb-3">
          Fale ou digite: dente, face e as três medidas. Exemplo: "16 vestibular 3 2 5 sangramento; 16 palatina 3 3 4".
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="16 vestibular 3 2 5 sangramento; 16 palatina 3 3 4"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {SpeechRecognitionCtor && (
            <button
              onClick={toggleMic}
              className={`px-4 py-2 rounded-lg ${listening ? "bg-red-600 text-white" : "border border-gray-300 hover:bg-gray-50"}`}
            >
              {listening ? "Parar de ouvir" : "🎤 Ditar"}
            </button>
          )}
          <button onClick={() => apply()} disabled={!text.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Aplicar ao periograma
          </button>
          <button onClick={() => apply(true)} disabled={!text.trim()} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50">
            Começar exame novo com este ditado
          </button>
        </div>
        {perio?.results && (
          <ul className="mt-3 text-sm space-y-1">
            {perio.results.map((r, i) => (
              <li key={i} className={r.ok ? "text-gray-700" : "text-red-600"}>{r.text}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-lg shadow-sm p-5">
        <div className="flex flex-wrap gap-6 mb-4 text-sm">
          <span>Sítios medidos: <b>{perio?.summary.measuredSites ?? 0}</b></span>
          <span>Bolsas ≥ 4 mm: <b>{perio?.summary.pocketsOver4mm ?? 0}</b></span>
          <span>Sangramento: <b>{perio?.summary.bleedingIndex ?? 0}%</b></span>
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0">
            <thead>
              <tr>
                <th />
                {UPPER.map((t) => <th key={t} className="text-xs text-gray-600 font-mono">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              <Row teeth={UPPER} face="V" />
              <Row teeth={UPPER} face="L" />
              <tr><td className="h-4" /></tr>
              <Row teeth={LOWER} face="L" />
              <Row teeth={LOWER} face="V" />
              <tr>
                <th />
                {LOWER.map((t) => <th key={t} className="text-xs text-gray-600 font-mono">{t}</th>)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
