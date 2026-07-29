# ADR-002: TOTH Gestao web e TOTH Funcionario com backend compartilhado

## Status

Aceito.

## Contexto

O TOTH possui dois produtos:

- **TOTH Gestao**, que sera uma aplicacao web usada tambem por outros computadores.
- **TOTH Funcionario**, que ja existe como aplicacao desktop instalada no PC.

Os dois precisam compartilhar o mesmo backend e a mesma fonte de dados. Como a Gestao sera web e multi-computador, o backend nao pode depender de IPC interno do Electron nem de acesso direto do navegador ao SQLite.

## Decisao

Manter o nome **TOTH** como nome canonico.

Criar uma API HTTP compartilhada em `backend/server.ts`, usando Fastify, CORS e Zod. A API reaproveita o nucleo de persistencia atual em `electron/database.ts`.

Por padrao, a API escuta em:

```text
0.0.0.0:3333
```

Isso permite acesso por outros computadores da rede local quando a porta estiver liberada no firewall.

## Alternativas consideradas

- Dois apps Electron lado a lado: rejeitado, porque TOTH Gestao sera web.
- Compartilhar apenas arquivo SQLite: rejeitado, porque navegador web nao acessa SQLite local diretamente.
- Duplicar backend em cada app: rejeitado por risco de divergencia.

## Consequencias

- TOTH Gestao passa a consumir API HTTP.
- TOTH Funcionario pode continuar com Electron durante a transicao.
- O backend compartilhado passa a ser o ponto oficial de integracao.
- Nenhum instalador deve ser gerado sem pedido explicito.
