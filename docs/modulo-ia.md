# Assistente clínico (módulo de IA)

Módulo do DentalPro inspirado na análise da DIO e da Pearl e no protótipo Lente Odonto. Fica em `/ia` no frontend e em `/api/ia` no backend.

## O que faz

| Aba | Função | Inspiração |
|---|---|---|
| Radiografia e plano | Envio da radiografia, marcação de achados sobre a imagem (manual ou sugerida pela IA), revisão pelo dentista e três opções de plano (Urgente, Recomendado, Econômico) com os preços da clínica | DIO (legenda interativa, plano pré-preenchido, vários planos) |
| Modo paciente | Tela em linguagem simples para mostrar ao paciente, que escolhe o plano | DIO ("remove a barreira de comunicação") |
| Periograma por voz | Ditado pelo microfone do navegador (pt-BR) ou digitado: "16 vestibular 3 2 5 sangramento" | Pearl Voice |
| Painel de tratamentos | Valor diagnosticado e não aceito, aceito e não realizado, taxa de aceitação e casos sem retorno na agenda | Pearl Practice Intelligence |
| Preços e regras | A clínica define preços e qual procedimento cada achado gera (só admin edita) | Protótipo Lente Odonto |

## Regras de segurança clínica e LGPD

- A IA só **sugere**. Sugestões entram como `suggested` (tracejadas) e não vão para o plano até o dentista confirmar. O plano não pode ser apresentado com sugestões pendentes.
- A análise por IA exige o **consentimento** do paciente registrado na tela (tabela `Consent`, com data e quem registrou; pode ser revogado).
- Para o provedor de IA só vai a **imagem**. Nome, telefone e outros dados nunca saem do servidor. Oriente a equipe a enviar imagens sem nome gravado no filme.
- Imagens ficam em `backend/uploads/` (fora do git), com nome aleatório, e só são servidas a usuários logados.
- Ações sensíveis (upload, análise, consentimento, plano, exclusão, mudança de preços) ficam em `AuditLog`.
- Todas as rotas de dados (`/api/patients`, `/api/appointments`, `/api/users` e `/api/ia`) agora exigem o token de login. Antes estavam abertas.
- Perfis: `admin` e `dentist` revisam achados, analisam e fazem periograma; só `admin` muda preços e regras.

## Configuração (`backend/.env`)

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="troque-isto"
ANTHROPIC_API_KEY=""          # vazio = IA desligada, só marcação manual
AI_MODEL="claude-sonnet-5-5"  # opcional
UPLOAD_DIR="uploads/radiografias"  # opcional
```

Depois: `cd backend && npx prisma migrate deploy`.

## Sobre a IA de radiografia

O provedor padrão usa a API do Claude com saída estruturada (caixas normalizadas, dente FDI, tipo e confiança). Modelos de linguagem com visão localizam achados de forma aproximada; por isso tudo passa pela revisão do dentista. Para precisão de produto regulado (DIO e Pearl têm registro na Anvisa), o caminho é um modelo de detecção próprio (YOLO/U-Net treinado em radiografias anotadas). Basta implementar a interface `RadiographAI` em `backend/src/services/ia/aiProvider.ts` e escolher pela variável `AI_PROVIDER`.

Atenção regulatória: software que sugere diagnóstico pode ser enquadrado como dispositivo médico (SaMD) pela Anvisa (RDC 657/2022). Enquanto não houver registro, apresente o recurso como apoio à documentação e à comunicação, sempre com decisão do dentista.

## Próximos passos sugeridos

1. Agente local para puxar a imagem direto do software de radiografia da clínica (o que a Pearl faz em `localhost:8040`).
2. Transcrição de áudio no servidor para o periograma e a evolução clínica, para quando o navegador não tiver reconhecimento de voz.
3. Mensagem de WhatsApp para os casos "sem retorno agendado" do painel.
4. Migrar de SQLite para Postgres antes de produção com várias unidades.
