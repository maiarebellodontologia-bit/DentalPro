// Catálogo inicial do módulo de IA. Os preços e as regras são copiados para o
// banco na primeira leitura e depois cada clínica edita os seus.

export type Urgency = "alta" | "media" | "baixa" | "info";

export const URGENCY_LABEL: Record<Urgency, string> = {
  alta: "Urgente",
  media: "Tratar logo",
  baixa: "Pode planejar",
  info: "Registro",
};

export const DEFAULT_PROCEDURES: Record<string, { name: string; price: number }> = {
  resina: { name: "Restauração em resina", price: 250 },
  troca: { name: "Troca de restauração", price: 280 },
  endo: { name: "Tratamento de canal", price: 950 },
  coroa: { name: "Coroa de porcelana", price: 1600 },
  extracao: { name: "Extração simples", price: 300 },
  siso: { name: "Extração de siso incluso", price: 650 },
  implante: { name: "Implante com coroa", price: 3800 },
  removivel: { name: "Prótese parcial removível", price: 1400 },
  raspagem: { name: "Raspagem periodontal (por região)", price: 320 },
  limpeza: { name: "Limpeza e remoção de tártaro", price: 220 },
  acompanha: { name: "Acompanhamento com nova radiografia", price: 0 },
};

export interface FindingType {
  label: string;
  urgency: Urgency;
  plain: string; // explicação para o paciente, sem jargão
  recommended: string[];
  alternative: string[];
}

export const FINDING_TYPES: Record<string, FindingType> = {
  carie: {
    label: "Cárie",
    urgency: "media",
    plain: "Uma parte do dente está sendo destruída por bactérias. Tratada agora, resolve com uma restauração simples.",
    recommended: ["resina"],
    alternative: [],
  },
  carie_profunda: {
    label: "Cárie profunda",
    urgency: "alta",
    plain: "A cárie chegou perto do nervo do dente. Sem tratamento, costuma doer e infeccionar.",
    recommended: ["endo", "coroa"],
    alternative: ["extracao", "implante"],
  },
  periapical: {
    label: "Lesão na ponta da raiz",
    urgency: "alta",
    plain: "Há uma infecção na ponta da raiz, dentro do osso. Ela pode não doer agora, mas cresce e pode inchar.",
    recommended: ["endo", "coroa"],
    alternative: ["extracao", "implante"],
  },
  fratura: {
    label: "Dente fraturado",
    urgency: "alta",
    plain: "O dente tem uma rachadura ou um pedaço quebrado e precisa ser protegido para não perder.",
    recommended: ["coroa"],
    alternative: ["extracao", "implante"],
  },
  restauracao: {
    label: "Restauração com defeito",
    urgency: "media",
    plain: "Uma restauração antiga está com falha na borda, por onde entram bactérias.",
    recommended: ["troca"],
    alternative: [],
  },
  perda_ossea: {
    label: "Perda óssea",
    urgency: "media",
    plain: "O osso que segura os dentes está diminuindo nesta região, um sinal de doença na gengiva.",
    recommended: ["raspagem"],
    alternative: [],
  },
  calculo: {
    label: "Tártaro",
    urgency: "baixa",
    plain: "Há tártaro acumulado. Ele irrita a gengiva e só sai com limpeza no consultório.",
    recommended: ["limpeza"],
    alternative: [],
  },
  siso: {
    label: "Siso incluso",
    urgency: "baixa",
    plain: "O dente do siso está preso no osso. Pode ser retirado ou acompanhado com radiografias.",
    recommended: ["siso"],
    alternative: ["acompanha"],
  },
  ausente: {
    label: "Dente ausente",
    urgency: "baixa",
    plain: "Falta um dente aqui. Os vizinhos tendem a se mover para o espaço com o tempo.",
    recommended: ["implante"],
    alternative: ["removivel"],
  },
  canal: {
    label: "Canal já tratado",
    urgency: "info",
    plain: "Este dente já fez canal. Está registrado para acompanhamento.",
    recommended: [],
    alternative: [],
  },
};

export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

export const isValidTooth = (n: unknown): n is number =>
  typeof n === "number" && ALL_TEETH.includes(n);
