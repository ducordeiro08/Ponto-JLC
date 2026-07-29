# ADR-001: Electron com SQLite isolado

## Status

Aceito.

## Contexto

O TOTH deve ser um aplicativo desktop Windows, funcionar offline, usar React, TypeScript e SQLite, e impedir acesso direto do frontend ao banco.

## Decisão

Usar Electron como runtime desktop. O renderer contém apenas React e acessa uma API mínima exposta pelo preload com `contextIsolation`. O processo principal concentra handlers IPC, regras de negócio, repositório e SQLite via `better-sqlite3`.

## Alternativas consideradas

- Tauri: menor pacote, mas adicionaria Rust à stack solicitada e elevaria o custo de manutenção.
- Aplicação web/PWA: não atende diretamente ao requisito de aplicativo desktop Windows com SQLite local.

## Consequências

- Operação totalmente offline e empacotamento Windows direto.
- Banco protegido do renderer.
- Pacote maior que uma solução Tauri.
