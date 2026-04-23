# PsyAI Core — API Backend

Backend da plataforma PsyAI: sistema de gestão clínica para psicólogos e terapeutas, com gerenciamento de pacientes, sessões, planos de tratamento, diário terapêutico e análise por IA.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js 20+ / TypeScript 5.8 |
| Framework | Fastify 5 |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (JWT Bearer) |
| Vídeo em tempo real | LiveKit |
| Validação | Zod |
| Documentação | Swagger UI (`/docs`) |
| Deploy principal | Railway.app |

---

## Pré-requisitos

- Node.js `>=20 <25`
- Conta no [Supabase](https://supabase.com)
- Conta no [LiveKit](https://livekit.io) (opcional, para sessões em vídeo)

---

## Instalação e execução

```bash
# Instalar dependências
npm install

# Copiar e configurar variáveis de ambiente
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
PORT=3333
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

LIVEKIT_URL=wss://<seu-projeto>.livekit.cloud
LIVEKIT_API_KEY=<api-key>
LIVEKIT_API_SECRET=<api-secret>
```

```bash
# Desenvolvimento (hot reload)
npm run dev

# Build de produção
npm run build

# Iniciar em produção
npm run start
```

A API estará disponível em `http://localhost:3333`.
Documentação interativa (Swagger): `http://localhost:3333/docs`.

---

## Estrutura do projeto

```
src/
├── server.ts              # Ponto de entrada — inicializa o servidor Fastify
├── app.ts                 # Registra plugins e rotas
├── config/
│   ├── plans.ts           # Configuração dos planos de assinatura
│   └── approachFeatures.ts# Funcionalidades por abordagem terapêutica
├── plugins/
│   ├── env.ts             # Validação das variáveis de ambiente (Zod)
│   ├── supabase.ts        # Inicialização do cliente Supabase
│   └── auth.ts            # Middleware de autenticação JWT
├── routes/
│   └── health.route.ts    # GET /health
└── modules/               # Módulos de domínio
    ├── patients/           # Gerenciamento de pacientes
    ├── sessions/           # Sessões terapêuticas
    ├── analysis/           # Análise por IA
    ├── attachment/         # Upload e compartilhamento de arquivos
    ├── storage/            # Áudios de sessão
    ├── access/             # Controle de acesso e convites
    ├── diary/              # Diário do paciente
    ├── treatment/          # Planos e metas de tratamento
    ├── livekit/            # Sessões em vídeo (LiveKit)
    └── features/           # Funcionalidades por plano/abordagem
```

Cada módulo segue o padrão: `routes → service → repository → schemas/types`.

---

## Endpoints principais

**Autenticação:** `Authorization: Bearer <JWT_TOKEN>` em todos os endpoints protegidos.

| Módulo | Rotas |
|--------|-------|
| Health | `GET /health` |
| Pacientes | `GET/POST /v1/patients`, `GET/PUT/DELETE /v1/patients/:id` |
| Sessões | `GET/POST /v1/sessions`, `POST /v1/sessions/:id/finish`, `/cancel`, `/analyze-ai`, `/process-audio` |
| Análise IA | `GET /v1/patients/:id/analysis/latest`, `POST /v1/patients/:id/analysis/request` |
| Arquivos | `GET/POST/DELETE /v1/patients/:id/attachments`, `GET /v1/attachments/me` |
| Áudio | `POST/GET/DELETE /v1/sessions/:id/audio` |
| Acesso | `GET/POST /v1/patients/:id/access/invite`, `PATCH /v1/patients/:id/access/status` |
| Diário | `/v1/diary/me/*` (paciente), `/v1/patients/:id/diary/*` (terapeuta) |
| Tratamento | `/v1/patients/:id/treatment/plans/*` |
| Vídeo | `POST /v1/livekit/start`, `GET /v1/livekit/token/:sessionId`, `PATCH /v1/livekit/end/:sessionId` |
| Funcionalidades | `GET /v1/features/plan/:tier`, `GET /v1/features/approach/:approach` |

---

## Planos de assinatura

| Plano | Pacientes | Sessões/mês | Transcrições | IA Insights |
|-------|-----------|-------------|--------------|-------------|
| Free | 3 | 5 | 0 | Não |
| Basic | 15 | 30 | 5 | Não |
| Pro | 50 | 200 | 30 | Não |
| Ultra | Ilimitado | Ilimitado | Ilimitado | Sim |

---

## Abordagens terapêuticas

| Abordagem | Funcionalidades |
|-----------|-----------------|
| TCC | Planos de tratamento, Diário, Sessões, Arquivos |
| Psicanalítica | Sessões, Arquivos |
| Humanista | Sessões, Arquivos |

---

## Deploy

**Railway (principal):** configurado via `railway.json`. Health check em `/health`.

**Vercel (alternativo):** configurado via `vercel.json` com rewrites para funções serverless.
