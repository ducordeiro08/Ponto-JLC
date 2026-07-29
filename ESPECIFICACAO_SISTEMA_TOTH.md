# Especificacao do Sistema TOTH

## Nota de escopo atual

O nome correto do produto e **TOTH**. Nao havera solicitacao de edicao de horarios neste momento.

## Visao geral

O TOTH possui dois produtos:

- **TOTH Gestao**: aplicacao web para gestao/encarregado, usada tambem por outros computadores.
- **TOTH Funcionario**: aplicacao desktop ja instalada no computador.

Os dois devem compartilhar o mesmo backend.

## Direcao arquitetural

Como o TOTH Gestao sera web e multi-computador, o backend compartilhado deve ser acessivel por API HTTP. O navegador nao deve acessar SQLite diretamente e nao deve depender de IPC do Electron.

O backend compartilhado fica em:

- `backend/server.ts`

Ele reaproveita o nucleo local em:

- `electron/database.ts`
- `shared/types.ts`

Por padrao, a API escuta em `0.0.0.0:3333`, permitindo acesso de outros computadores na rede local quando o firewall liberar a porta.

## TOTH Gestao

- Produto web.
- Deve rodar em desenvolvimento com `npm run dev:gestao`.
- Deve buildar com `npm run build:gestao`.
- Deve consumir backend compartilhado por API.
- Em outro computador, deve usar `VITE_TOTH_API_URL=http://IP-DO-SERVIDOR:3333`.
- Nao deve gerar instalador.

## TOTH Funcionario

- Produto desktop ja instalado.
- Deve registrar ponto individual por CPF e obra.
- Atualizacoes devem ser planejadas com cuidado para nao reinstalar desnecessariamente.
- Novo instalador so deve ser gerado por pedido explicito.

## Backend compartilhado

Responsabilidades:

- Funcionarios.
- Obras.
- Sessoes.
- Registros de ponto.
- Registros de presenca.
- Observacoes de presenca.

Regras:

- O frontend web nao acessa SQLite diretamente.
- O desktop nao deve ter regra divergente do backend comum.
- Toda regra de negocio deve ficar no backend compartilhado.

## Modelo de dados atual

- `roles`
- `employees`
- `worksites`
- `employee_worksites`
- `forms`
- `time_entries`
- `presence_records`
- `presence_record_entries`

## Criterios de aceite atuais

- `npm test` passa.
- `npm run build:api` passa.
- `npm run build:gestao` passa.
- `npm run build:funcionario` passa.
- Nenhum instalador e gerado sem pedido explicito.
- O escopo nao inclui solicitacao de edicao de horarios.
