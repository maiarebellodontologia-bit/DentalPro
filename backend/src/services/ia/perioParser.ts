// Interpreta o ditado do periograma: "16 vestibular 3 2 5 sangramento; 16 palatina 3 3 4".
// Funciona com o texto vindo do microfone do navegador (Web Speech API) ou digitado.

import { ALL_TEETH } from "./catalog.js";

export interface PerioTooth {
  V: number[]; // profundidade de sondagem, 3 sítios vestibulares (mm)
  L: number[]; // 3 sítios linguais/palatinos
  bV: number[]; // sangramento (0/1) por sítio
  bL: number[];
}

export type PerioData = Record<string, PerioTooth>;

export interface ParseResult {
  ok: boolean;
  text: string;
}

const WORDNUM: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

export const emptyTooth = (): PerioTooth => ({
  V: [0, 0, 0],
  L: [0, 0, 0],
  bV: [0, 0, 0],
  bL: [0, 0, 0],
});

export function parseDictation(text: string, data: PerioData): ParseResult[] {
  const out: ParseResult[] = [];

  text
    .toLowerCase()
    .split(/[;\n.]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const words = segment
        .replace(/,/g, " ")
        .split(/\s+/)
        .map((w) => (WORDNUM[w] !== undefined ? String(WORDNUM[w]) : w));

      let tooth: number | null = null;
      let face: "V" | "L" | null = null;
      const nums: number[] = [];
      let bleed = false;

      for (const w of words) {
        if (tooth === null && /^\d{2}$/.test(w) && ALL_TEETH.includes(+w)) {
          tooth = +w;
        } else if (/^vest/.test(w) || w === "v") {
          face = "V";
        } else if (/^(ling|pala)/.test(w) || w === "l" || w === "p") {
          face = "L";
        } else if (/^sangr/.test(w)) {
          bleed = true;
        } else if (/^\d{1,2}$/.test(w) && tooth !== null && face && nums.length < 3) {
          const v = +w;
          if (v >= 0 && v <= 15) nums.push(v);
        }
      }

      if (tooth && face && (nums.length || bleed)) {
        const cell = (data[tooth] ??= emptyTooth());
        nums.forEach((v, i) => (cell[face!][i] = v));
        if (bleed) cell[face === "V" ? "bV" : "bL"] = [1, 1, 1];
        const faceName = face === "V" ? "vestibular" : tooth < 30 ? "palatina" : "lingual";
        out.push({
          ok: true,
          text: `Dente ${tooth}, ${faceName}: ${nums.length ? nums.join(" · ") + " mm" : "sem medidas"}${bleed ? ", com sangramento" : ""}`,
        });
      } else {
        const missing = !tooth ? "o número do dente" : !face ? "a face" : "as medidas";
        out.push({ ok: false, text: `Não entendi "${segment}". Falta ${missing}.` });
      }
    });

  return out;
}

// Resumo clínico simples: sítios com bolsa ≥ 4 mm e índice de sangramento.
export function summarize(data: PerioData) {
  let sites = 0, deep = 0, bleeding = 0;
  for (const t of Object.values(data)) {
    for (const v of [...t.V, ...t.L]) {
      if (v > 0) sites++;
      if (v >= 4) deep++;
    }
    bleeding += [...t.bV, ...t.bL].filter(Boolean).length;
  }
  return {
    measuredSites: sites,
    pocketsOver4mm: deep,
    bleedingIndex: sites ? Math.round((bleeding / sites) * 100) : 0,
  };
}
