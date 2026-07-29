# Backlog do Sistema TOTH

## Nota de escopo atual

O nome correto do produto e **TOTH**. Nao havera solicitacao de edicao de horarios neste momento.

## Produtos

| Produto | Objetivo | Distribuicao |
| --- | --- | --- |
| TOTH Gestao | Gestao web de presenca/equipe por obra | Web |
| TOTH Funcionario | Registro individual de ponto por obra | Desktop ja instalado |

## Prioridades imediatas

| Prioridade | Item | Motivo |
| --- | --- | --- |
| P0 | API de backend compartilhado | Necessario para o web e o desktop usarem a mesma fonte |
| P0 | Adaptar TOTH Gestao para HTTP | Ele nao deve depender de Electron/IPC |
| P0 | Preservar TOTH Funcionario instalado | Evitar reinstalacao desnecessaria |
| P1 | QA de rede local | Garantir acesso a partir de outros computadores |
| P1 | Documentar fluxo dos agentes | Facilitar continuidade das proximas conversas |

## Epicos

### EP01 - Backend compartilhado

- Manter API comum para obras, sessoes, pontos, funcionarios e presencas.
- Rodar a API em `0.0.0.0:3333` para permitir acesso por outros computadores na rede.
- Reaproveitar persistencia existente em `electron/database.ts`.
- Validar entradas HTTP com Zod.
- Impedir acesso direto do frontend web ao SQLite.

### EP02 - TOTH Gestao web

- Rodar com `npm run dev:gestao`.
- Buildar com `npm run build:gestao`.
- Consumir o backend compartilhado por API.
- Usar `VITE_TOTH_API_URL` quando a API estiver em outro computador.
- Nao gerar instalador.

### EP03 - TOTH Funcionario instalado

- Manter o app instalado como produto desktop.
- Planejar atualizacao somente quando necessario.
- Evitar gerar instalador sem pedido explicito.

### EP04 - Agentes

- Manter `meta/product-map.yaml`.
- Manter `meta/policy-rules.yaml`.
- Manter `meta/agent-registry.yaml`.
- Usar os 16 agentes como disciplina de desenvolvimento durante a conversa.

## Fora do escopo atual

- Solicitacao de edicao de horarios.
- Novo instalador do TOTH Gestao.
- Novo instalador do TOTH Funcionario sem pedido explicito.
