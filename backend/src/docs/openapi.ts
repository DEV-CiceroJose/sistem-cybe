export const openapiDocumento = {
  openapi: "3.0.3",
  info: {
    title: "Web Security Analyzer API",
    version: "1.0.0",
    description: "API REST de auditoria de segurança (versão v1).",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        summary: "Autentica e retorna um JWT",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { usuario: { type: "string" }, senha: { type: "string" } },
                required: ["usuario", "senha"],
              },
            },
          },
        },
        responses: { "200": { description: "Token emitido" }, "401": { description: "Credenciais inválidas" } },
      },
    },
    "/auditorias": {
      get: { summary: "Lista auditorias (paginado)", responses: { "200": { description: "Lista" } } },
      post: { summary: "Cria uma auditoria", responses: { "201": { description: "Criada" } } },
    },
    "/auditorias/{id}": {
      get: {
        summary: "Detalhe da auditoria",
        responses: { "200": { description: "Auditoria" }, "404": { description: "Não encontrada" } },
      },
    },
    "/auditorias/{id}/comparacao": {
      get: { summary: "Comparação com a auditoria anterior", responses: { "200": { description: "Comparação ou null" } } },
    },
    "/alertas": {
      get: { summary: "Lista alertas (paginado)", responses: { "200": { description: "Lista" } } },
    },
    "/agendamentos": {
      get: { summary: "Lista agendamentos", responses: { "200": { description: "Lista" } } },
      post: { summary: "Cria agendamento", responses: { "201": { description: "Criado" } } },
    },
    "/configuracoes": {
      get: { summary: "Lista configurações", responses: { "200": { description: "Lista" } } },
    },
    "/logs": {
      get: { summary: "Lista logs de requisição (paginado)", responses: { "200": { description: "Lista" } } },
    },
  },
} as const;
