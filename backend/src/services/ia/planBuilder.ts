// Monta as 3 opções de plano (urgente, recomendado, econômico) a partir dos
// achados CONFIRMADOS pelo dentista e da tabela de preços da clínica.

import { Urgency } from "./catalog.js";

export interface PlanFinding {
  id: number;
  type: string;
  tooth: number | null;
}

export interface ClinicRule {
  label: string;
  urgency: Urgency;
  recommended: string[];
  alternative: string[];
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

export function buildPlans(
  findings: PlanFinding[],
  rules: Record<string, ClinicRule>,
  procedures: Record<string, { name: string; price: number }>
): PlanOption[] {
  const cost = (keys: string[]) =>
    keys.reduce((sum, k) => sum + (procedures[k]?.price ?? 0), 0);

  const line = (f: PlanFinding, rule: ClinicRule, keys: string[]): PlanLine => ({
    findingId: f.id,
    tooth: f.tooth,
    label: rule.label,
    procedures: keys.map((k) => ({
      key: k,
      name: procedures[k]?.name ?? k,
      price: procedures[k]?.price ?? 0,
    })),
    value: cost(keys),
  });

  const treatable = findings
    .map((f) => ({ f, rule: rules[f.type] }))
    .filter((o) => o.rule && o.rule.recommended.length > 0);

  const cheapest = (rule: ClinicRule) =>
    [rule.recommended, rule.alternative]
      .filter((opt) => opt.length > 0)
      .sort((a, b) => cost(a) - cost(b))[0];

  const options: Omit<PlanOption, "total">[] = [
    {
      key: "urgente",
      name: "Urgente",
      description: "Só o que causa dor ou infecção agora.",
      items: treatable
        .filter((o) => o.rule.urgency === "alta")
        .map((o) => line(o.f, o.rule, o.rule.recommended)),
    },
    {
      key: "recomendado",
      name: "Recomendado",
      description: "Trata todos os achados com a melhor opção.",
      items: treatable.map((o) => line(o.f, o.rule, o.rule.recommended)),
    },
    {
      key: "economico",
      name: "Econômico",
      description: "Trata tudo com a opção de menor custo.",
      items: treatable.map((o) => line(o.f, o.rule, cheapest(o.rule))),
    },
  ];

  return options.map((o) => ({
    ...o,
    total: o.items.reduce((sum, l) => sum + l.value, 0),
  }));
}
