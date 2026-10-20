// Provedor de IA para leitura de radiografias. A IA só SUGERE achados; nada
// entra no plano até o dentista confirmar cada um.
//
// LGPD: só a imagem sai do servidor. Nome, CPF, data de nascimento e qualquer
// outro dado do paciente nunca vão para o provedor. Peça ao usuário para
// enviar imagens sem nome ou data gravados no filme.
//
// Para trocar por um modelo próprio de detecção (YOLO, U-Net etc.), basta
// implementar RadiographAI e escolher pela variável AI_PROVIDER.

import { FINDING_TYPES, isValidTooth } from "./catalog.js";

export interface SuggestedFinding {
  type: string;
  tooth: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number | null;
  note: string | null;
}

export interface RadiographAI {
  readonly model: string;
  analyze(image: Buffer, mimeType: string, kind: string): Promise<SuggestedFinding[]>;
}

const clamp01 = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

export function sanitizeSuggestions(raw: unknown): SuggestedFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f) => f && typeof f === "object" && FINDING_TYPES[(f as any).type])
    .slice(0, 40)
    .map((f: any) => {
      const x = clamp01(f.x), y = clamp01(f.y);
      return {
        type: f.type,
        tooth: isValidTooth(f.tooth) ? f.tooth : null,
        x,
        y,
        w: Math.max(0.01, Math.min(1 - x, clamp01(f.w))),
        h: Math.max(0.01, Math.min(1 - y, clamp01(f.h))),
        confidence: typeof f.confidence === "number" ? clamp01(f.confidence) : null,
        note: typeof f.note === "string" ? f.note.slice(0, 200) : null,
      };
    });
}

const SYSTEM_PROMPT = `Você apoia um cirurgião-dentista na leitura de radiografias odontológicas.
Liste apenas achados visíveis na imagem, com a posição aproximada (caixa normalizada de 0 a 1 em relação à largura e à altura da imagem) e o dente em notação FDI quando identificável.
Use somente estes tipos: ${Object.entries(FINDING_TYPES).map(([k, t]) => `${k} (${t.label})`).join(", ")}.
Na dúvida, não liste. Dê a confiança de 0 a 1. Suas sugestões serão revisadas pelo dentista antes de qualquer uso clínico.
Lembre que em radiografias panorâmicas o lado direito do paciente aparece à esquerda da imagem.`;

const REPORT_TOOL = {
  name: "registrar_achados",
  description: "Registra os achados radiográficos sugeridos para revisão do dentista.",
  input_schema: {
    type: "object",
    properties: {
      achados: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: Object.keys(FINDING_TYPES) },
            tooth: { type: ["integer", "null"], description: "Dente em notação FDI" },
            x: { type: "number" },
            y: { type: "number" },
            w: { type: "number" },
            h: { type: "number" },
            confidence: { type: "number" },
            note: { type: "string" },
          },
          required: ["type", "x", "y", "w", "h", "confidence"],
        },
      },
    },
    required: ["achados"],
  },
};

class ClaudeRadiographAI implements RadiographAI {
  constructor(
    private apiKey: string,
    readonly model: string
  ) {}

  async analyze(image: Buffer, mimeType: string, kind: string) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [REPORT_TOOL],
        tool_choice: { type: "tool", name: REPORT_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: image.toString("base64") },
              },
              { type: "text", text: `Radiografia ${kind}. Registre os achados.` },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provedor de IA respondeu ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as { content?: { type: string; input?: any }[] };
    const toolUse = data.content?.find((c) => c.type === "tool_use");
    return sanitizeSuggestions(toolUse?.input?.achados);
  }
}

// Sem chave configurada, o módulo funciona só com marcação manual.
export function getRadiographAI(): RadiographAI | null {
  const provider = process.env.AI_PROVIDER || "claude";
  if (provider === "claude" && process.env.ANTHROPIC_API_KEY) {
    return new ClaudeRadiographAI(
      process.env.ANTHROPIC_API_KEY,
      process.env.AI_MODEL || "claude-sonnet-5-5"
    );
  }
  return null;
}
