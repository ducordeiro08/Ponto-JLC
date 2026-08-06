# Manual TOTH: GitHub, instalacao e execucao do projeto

Este manual explica, em linguagem simples, como uma pessoa pode baixar o projeto TOTH pelo GitHub, instalar as ferramentas necessarias e rodar os sistemas em modo de desenvolvimento.

O projeto TOTH possui tres partes principais:

- TOTH Gestao: app web usado pelo gestor no navegador.
- TOTH Funcionario: app com tela vertical/mobile, usado por funcionario ou encarregado.
- Backend/API central: servidor que sincroniza as informacoes entre Gestao e Funcionario.

## 1. O que esta no GitHub

O GitHub guarda o codigo-fonte do projeto.

Isso significa que uma pessoa com conhecimento tecnico consegue baixar o projeto, instalar dependencias e rodar os apps.

O GitHub, por si so, nao transforma automaticamente o projeto em um instalador para usuario comum. Para usuario comum baixar e instalar, seria necessario publicar uma versao instalavel, por exemplo na aba "Releases" do GitHub.

## 2. Diferenca entre codigo-fonte, app instalado e app web

Codigo-fonte:

- Sao os arquivos usados por programadores para desenvolver o sistema.
- Ficam no GitHub.
- Precisam de Node.js, npm e comandos no terminal para rodar.

App instalado:

- E um arquivo pronto para abrir no computador, como um `.exe`.
- O usuario comum nao precisa entender o codigo.
- No caso do TOTH Funcionario atual, ele roda como app desktop Electron, mesmo tendo layout vertical/mobile.

App web:

- Roda pelo navegador.
- No caso do TOTH Gestao, o ideal e hospedar em um servidor/site e acessar por um link.
- Exemplo: `https://gestao.seusite.com.br`.

## 3. Ferramentas necessarias

Antes de rodar o projeto, a pessoa precisa instalar:

- Git
- Node.js
- npm, que normalmente ja vem junto com o Node.js
- VS Code, recomendado para editar e abrir o projeto

### 3.1. Como verificar se o Git esta instalado

Abra o PowerShell e rode:

```powershell
git --version
```

Se aparecer uma versao, por exemplo `git version 2.x.x`, esta instalado.

### 3.2. Como verificar se o Node.js esta instalado

No PowerShell, rode:

```powershell
node -v
```

Depois:

```powershell
npm -v
```

Se os dois comandos mostrarem numeros de versao, esta tudo certo.

## 4. Como baixar o projeto do GitHub

Escolha uma pasta onde deseja guardar o projeto. Exemplo:

```powershell
cd "C:\Users\SEU_USUARIO\Documents"
```

Depois baixe o projeto:

```powershell
git clone https://github.com/ducordeiro08/Ponto-JLC.git
```

Entre na pasta baixada:

```powershell
cd "Ponto-JLC"
```

## 5. Como instalar as dependencias

Dentro da pasta do projeto, rode:

```powershell
npm install
```

Esse comando baixa as bibliotecas que o projeto usa, como React, Fastify, Electron, SQLite e outras.

Pode demorar alguns minutos.

## 6. Como rodar o backend/API central

O backend e a parte central que recebe e entrega os dados para os dois apps.

Ele deve estar ligado para que a sincronizacao funcione corretamente.

No terminal, dentro da pasta do projeto, rode:

```powershell
npm run dev:api
```

Se funcionar, o backend ficara rodando no terminal.

Normalmente ele usa a porta:

```text
3333
```

Importante: deixe esse terminal aberto enquanto estiver usando os apps.

## 7. Como rodar o TOTH Gestao

Abra outro terminal dentro da mesma pasta do projeto.

Rode:

```powershell
npm run dev:gestao
```

O TOTH Gestao normalmente abre ou fica disponivel em:

```text
http://localhost:5174
```

Se quiser acessar pelo proprio computador, use:

```text
http://localhost:5174
```

Se quiser acessar de outro computador na mesma rede, sera necessario usar o IP da maquina que esta rodando o sistema.

Exemplo:

```text
http://192.168.0.10:5174
```

O numero `192.168.0.10` e apenas exemplo. Cada computador tem um IP diferente.

## 8. Como rodar o TOTH Funcionario

Abra um terceiro terminal dentro da pasta do projeto.

Rode:

```powershell
npm run dev:funcionario
```

Esse comando inicia o app TOTH Funcionario em modo de desenvolvimento.

Ele tambem inicia uma tela Electron, parecida com um aplicativo instalado no computador.

## 9. Ordem correta para ligar tudo

Para evitar erro de conexao, use esta ordem:

1. Ligue o backend/API:

```powershell
npm run dev:api
```

2. Ligue o TOTH Gestao:

```powershell
npm run dev:gestao
```

3. Ligue o TOTH Funcionario:

```powershell
npm run dev:funcionario
```

## 10. Como entender a sincronizacao

O TOTH Gestao e o TOTH Funcionario devem conversar com o mesmo backend/API central.

Fluxo esperado:

```text
TOTH Funcionario -> API central -> Banco central
TOTH Gestao -> API central -> Banco central
```

Exemplo pratico:

1. O funcionario bate ponto no TOTH Funcionario.
2. O TOTH Funcionario envia esse registro para a API central.
3. A API salva no banco central.
4. O TOTH Gestao busca os dados na API.
5. O gestor visualiza o ponto na tela de gestao.

O TOTH Funcionario pode ter cache local, mas esse cache deve ser usado apenas em situacoes offline. A fonte principal da verdade deve ser a API central.

## 11. Portas usadas pelo projeto

Portas comuns:

```text
3333 - Backend/API
5174 - TOTH Gestao
5173 - TOTH Funcionario em desenvolvimento
```

Se uma porta estiver ocupada, o terminal pode mostrar erro.

## 12. Como liberar portas no Windows

Se outro computador na rede nao conseguir acessar o TOTH Gestao, talvez o Firewall do Windows esteja bloqueando.

Para liberar a porta 5174 no PowerShell como administrador:

```powershell
New-NetFirewallRule -DisplayName "TOTH Gestao 5174" -Direction Inbound -Protocol TCP -LocalPort 5174 -Action Allow
```

Para liberar a API na porta 3333:

```powershell
New-NetFirewallRule -DisplayName "TOTH API 3333" -Direction Inbound -Protocol TCP -LocalPort 3333 -Action Allow
```

Use esses comandos apenas se voce entender que esta liberando acesso dentro da rede.

## 13. Como descobrir o IP do computador

No PowerShell, rode:

```powershell
ipconfig
```

Procure por algo como:

```text
IPv4 Address . . . . . . . . . . . : 192.168.0.10
```

Depois, em outro computador da mesma rede, acesse:

```text
http://192.168.0.10:5174
```

Troque `192.168.0.10` pelo IP real da maquina.

## 14. Login da Gestao

No ambiente atual, os CPFs de gestao autorizados sao:

```text
18303563807
39442581856
01042668809
```

A senha padrao de desenvolvimento e:

```text
toth123
```

O CPF pode ser digitado com ou sem pontos e tracos, dependendo da tela.

Exemplos:

```text
18303563807
183.035.638-07
```

## 15. Como usar o Git no dia a dia

Sempre entre na pasta correta do projeto:

```powershell
cd "C:\Users\ducor\Documents\Codex\TOTH APP\APP GESTÃO"
```

Veja o estado dos arquivos:

```powershell
git status
```

Adicionar alteracoes para o proximo commit:

```powershell
git add .
```

Criar um commit:

```powershell
git commit -m "Descreva aqui o que foi alterado"
```

Enviar para o GitHub:

```powershell
git push
```

Baixar alteracoes do GitHub:

```powershell
git pull
```

## 16. O que significa cada comando do Git

`git status`

Mostra se existem arquivos alterados, adicionados ou apagados.

`git add .`

Prepara as alteracoes para entrarem no proximo commit.

`git commit -m "mensagem"`

Cria um ponto salvo no historico do projeto.

`git push`

Envia os commits locais para o GitHub.

`git pull`

Baixa do GitHub as alteracoes feitas por outras pessoas ou em outro computador.

## 17. Aviso sobre LF e CRLF

No Windows, o Git pode mostrar avisos como:

```text
LF will be replaced by CRLF the next time Git touches it
```

Isso normalmente nao e erro.

Significa apenas que o Git esta ajustando o tipo de quebra de linha dos arquivos para o padrao do Windows.

Se o `git add .` terminar e voltar para o prompt, pode continuar com:

```powershell
git status
```

Depois:

```powershell
git commit -m "Mensagem do commit"
```

## 18. Como gerar a versao de producao do backend

Para compilar o backend:

```powershell
npm run build:api
```

Para iniciar o backend compilado:

```powershell
npm run start:api
```

Em desenvolvimento, normalmente se usa:

```powershell
npm run dev:api
```

## 19. Como gerar a versao de producao do TOTH Gestao

Para gerar os arquivos finais do TOTH Gestao:

```powershell
npm run build:gestao
```

Esses arquivos podem ser hospedados em um servidor web.

Importante: o TOTH Gestao web precisa saber o endereco da API central.

## 20. Como gerar a versao de producao do TOTH Funcionario

Para compilar o TOTH Funcionario:

```powershell
npm run build:funcionario
```

Esse comando prepara os arquivos de build.

Para criar um instalador `.exe`, o projeto precisa ter configuracao de empacotamento com Electron Builder. Caso ainda nao exista um comando especifico para gerar o instalador, ele deve ser configurado antes.

## 20.1. Como rodar o TOTH Funcionario como PWA

O TOTH Funcionario tambem pode rodar como PWA, ou seja, como um app web instalavel pelo navegador.

Em desenvolvimento, primeiro ligue a API:

```powershell
npm run dev:api
```

Depois, em outro terminal, ligue a PWA:

```powershell
npm run dev:funcionario:pwa
```

Normalmente ela ficara disponivel em:

```text
http://localhost:5173
```

No celular ou em outro computador da mesma rede, use o IP da maquina que esta rodando o projeto:

```text
http://IP-DA-MAQUINA:5173
```

Exemplo:

```text
http://192.168.0.10:5173
```

Para gerar os arquivos finais da PWA:

```powershell
npm run build:funcionario:pwa
```

Os arquivos finais ficarao na pasta:

```text
dist/
```

Essa pasta e a parte que deve ser publicada em uma hospedagem web.

Importante: para instalar como PWA em celular de forma correta, o ideal e publicar com HTTPS. Em producao, a PWA tambem precisa apontar para uma API central publica e segura.

## 21. Como um programador roda o projeto depois de baixar do GitHub

Resumo para alguem intermediario:

```powershell
git clone https://github.com/ducordeiro08/Ponto-JLC.git
cd "Ponto-JLC"
npm install
npm run dev:api
```

Em outro terminal:

```powershell
cd "Ponto-JLC"
npm run dev:gestao
```

Em outro terminal:

```powershell
cd "Ponto-JLC"
npm run dev:funcionario
```

## 22. Problemas comuns

### 22.1. Erro: npm nao e reconhecido

Significa que o Node.js nao esta instalado ou nao foi reiniciado o terminal depois da instalacao.

Solucoes:

- Instalar Node.js.
- Fechar e abrir novamente o VS Code.
- Abrir um novo terminal.

### 22.2. Erro: git nao e reconhecido

Significa que o Git nao esta instalado ou nao foi adicionado ao PATH do Windows.

Solucoes:

- Instalar Git.
- Fechar e abrir novamente o terminal.

### 22.3. Porta em uso

Se aparecer erro de porta ocupada, algum processo ja esta usando aquela porta.

Portas principais:

```text
3333 - API
5174 - Gestao
5173 - Funcionario
```

Pode fechar o terminal antigo ou reiniciar o computador se nao souber qual processo esta usando a porta.

### 22.4. Gestao abre, mas nao carrega dados

Verifique se a API esta ligada:

```powershell
npm run dev:api
```

Se a API nao estiver rodando, o TOTH Gestao pode abrir a tela, mas nao conseguira buscar os dados reais.

### 22.5. Funcionario nao sincroniza

Verifique:

- A API esta ligada?
- O app esta apontando para o endereco correto da API?
- O CPF do funcionario existe na obra correta?
- O funcionario esta vinculado a obra no TOTH Gestao?
- O computador esta online?

## 23. Regras importantes do projeto TOTH

- Funcionarios devem ser cadastrados de forma centralizada.
- Obras devem ser gerenciadas pela Gestao.
- Pontos batidos pelo Funcionario devem ir para a API central.
- Listas feitas pelo encarregado tambem devem ir para a API central.
- O app Funcionario pode usar cache local apenas quando estiver offline.
- O TOTH Gestao deve exibir dados reais da API, filtrados pela obra selecionada.

## 24. Recomendacao para producao

Para usar profissionalmente em varios computadores ou celulares, o ideal e:

1. Hospedar o backend/API em um servidor confiavel.
2. Hospedar o TOTH Gestao como site web.
3. Configurar o TOTH Funcionario para apontar para a API oficial.
4. Usar HTTPS.
5. Proteger login, senha e dados dos funcionarios.
6. Fazer backup do banco central.

## 25. Caminho mental simples

Pense assim:

```text
GitHub guarda o codigo.
API guarda e entrega os dados.
Gestao consulta e administra.
Funcionario registra ponto e lista.
Banco central e a fonte principal da verdade.
```

Se esses cinco pontos estiverem claros, fica muito mais facil entender o projeto.
