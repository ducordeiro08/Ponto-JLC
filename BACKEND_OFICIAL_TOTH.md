# Backend oficial TOTH

## Decisao atual

O backend compartilhado oficial do TOTH, neste momento, roda neste PC da rede local.

- Host da API: `0.0.0.0`
- Porta da API: `3333`
- URL para este PC: `http://127.0.0.1:3333`
- URL para outros computadores da rede: `http://192.168.0.133:3333`
- URL da Gestao web: `http://192.168.0.133:5174`

## Arquivo de configuracao do Funcionario

O TOTH Funcionario le o endpoint do backend neste arquivo:

```text
%APPDATA%\TOTH\config.json
```

Tambem existem copias de seguranca em `%APPDATA%\toth\config.json`,
na pasta do executavel instalado e em `resources\config.json`. Todas devem apontar
para a mesma API.

Conteudo atual:

```json
{
  "backendMode": "local-network-pc",
  "apiUrl": "http://127.0.0.1:3333"
}
```

Importante: grave esse arquivo como UTF-8 sem BOM. O app atual ja tolera BOM, mas
manter o arquivo sem BOM evita que versoes antigas ignorem a configuracao e caiam
para o cache local.

## Como iniciar em desenvolvimento

```powershell
cd "C:\Users\ducor\Documents\Codex\TOTH APP\APP GESTÃO"
npm run dev:api
```

Em outro terminal:

```powershell
cd "C:\Users\ducor\Documents\Codex\TOTH APP\APP GESTÃO"
npm run dev:gestao
```

## Fluxo de sincronizacao

1. O TOTH Funcionario usa a API central como fonte principal.
2. Obras, login, funcionarios da obra, pontos, listas do encarregado e historicos sao lidos/gravados primeiro na API central.
3. O SQLite local do TOTH Funcionario nao e fonte principal de verdade.
4. O SQLite local serve apenas como cache/fila offline quando a API estiver indisponivel.
5. Quando offline, pontos/listas entram na fila local `sync_queue`.
6. No proximo login ou proxima gravacao online, a fila e reenviada para `/sync/time-entries` e `/sync/presence-records`.
7. O TOTH Gestao le dados reais da API pelos endpoints `/management/*`.
