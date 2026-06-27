# Web Security Analyzer — Sprint 0 (MVP)

Ferramenta para análise passiva de segurança de sites: HTTPS/TLS, cabeçalhos HTTP, cookies,
informações expostas, tecnologias detectadas e performance — com score consolidado, dashboard
e relatórios em Markdown.

> ⚠️ Todas as verificações são **passivas e não intrusivas**. Não há exploração de vulnerabilidades.

---

## Stack

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + Express + TypeScript
- **Banco de dados:** Prisma + SQLite

## Estrutura

```
web-security-analyzer/
├── backend/        # API REST, scanner, relatórios, banco de dados
├── frontend/       # Dashboard React
├── shared/         # (reservado para tipos compartilhados em sprints futuras)
└── docker-compose.yml
```

---

## Opção 1 — Executar com Docker Compose (recomendado)

Pré-requisitos: Docker e Docker Compose instalados.

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001/api/health

---

## Opção 2 — Executar localmente (sem Docker)

Pré-requisitos: Node.js 18+ e npm.

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

O backend sobe em `http://localhost:3001`.

### Frontend

Em outro terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

O frontend sobe em `http://localhost:5173`.

---

## Endpoints principais da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auditorias` | Inicia uma nova análise (`{ "url": "https://exemplo.com" }`) |
| GET | `/api/auditorias` | Lista o histórico de análises |
| GET | `/api/auditorias/:id` | Detalhes de uma análise |
| GET | `/api/auditorias/:id/relatorio` | Relatório em Markdown |
| DELETE | `/api/auditorias/:id` | Remove uma análise |
| GET/PUT | `/api/configuracoes` | Lê/atualiza configurações |
| GET | `/api/health` | Healthcheck |

---

## Segurança implementada nesta sprint

- Proteção contra **SSRF**: bloqueio de hosts que resolvem para IPs privados/reservados (RFC1918, loopback, link-local, metadata de cloud).
- Validação e sanitização de URL antes de qualquer requisição.
- Limite de timeout e de tamanho máximo de resposta no scanner.
- `helmet` para cabeçalhos de segurança da própria API.
- Rate limiting nas rotas `/api/*`.

## Próximas sprints

Esta arquitetura (módulos `scanner/`, `services/`, `reports/`, `controllers/`, `routes/`) foi
projetada para suportar as Sprints 1–8 sem necessidade de refatoração estrutural. Aguardando
confirmação para iniciar a Sprint 1.
