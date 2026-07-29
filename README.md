# TOTH

Sistema TOTH para registro de ponto e presenca por obra.

## Produtos

- **TOTH Gestao**: aplicacao web para encarregado/gestao.
- **TOTH Funcionario**: aplicacao desktop ja instalada no computador do funcionario.

O nome correto do produto e **TOTH**.

## Backend compartilhado

A Gestao web sera usada por outros computadores. Por isso, o backend compartilhado agora e uma API HTTP em `backend/server.ts`.

Por padrao, a API escuta em:

```text
http://0.0.0.0:3333
```

No computador que hospeda o backend, descubra o IP da rede local com:

```powershell
ipconfig
```

Em outros computadores, a Gestao web deve apontar para esse IP:

```powershell
$env:VITE_TOTH_API_URL="http://IP-DO-SERVIDOR:3333"
npm run dev:gestao
```

## Desenvolvimento

```powershell
npm install
npm run dev:api
npm run dev:gestao
npm run dev:funcionario
```

## Validacao

```powershell
npm test
npm run build:api
npm run build:gestao
npm run build:funcionario
```

## Importante

Nao gere instaladores para o TOTH Gestao. Ele e web.

Nao gere instalador do TOTH Funcionario sem uma decisao explicita, pois ele ja esta instalado no PC.

## CPFs de demonstracao

- `12345678909` - Pedro Almeida
- `98765432100` - Mariana Costa
- `11122233344` - Joao Santos, encarregado
