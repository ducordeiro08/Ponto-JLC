# Ponto JLC

Aplicativo mobile para registro de ponto por obra.

## Como usar no celular

1. Publique estes arquivos em um servidor ou abra em um ambiente local.
2. No Android, acesse pelo Chrome.
3. Toque no menu do navegador e escolha **Adicionar à tela inicial**.

O app funciona como PWA, com visual focado em celular e armazenamento local dos registros confirmados.

## Fluxo

1. Informar o nome do responsável.
2. Selecionar a obra.
3. Marcar um ou mais funcionários presentes na obra.
4. Avançar para a conferência.
5. Confirmar o ponto.
6. Gerar um formulário com registros de presença para todos os funcionários selecionados.
7. Compartilhar/exportar a base de dados em JSON.

Também há uma opção para ver formulários salvos. A lista mostra apenas os dados gerais no início; ao tocar em um formulário, os colaboradores daquele registro são exibidos.

## Estrutura de dados

A exportação gera um JSON com tabelas compatíveis com banco relacional:

- `Formulario`: `ID_Formulario`, `Data`, `Hora`, `Obra`, `ID_Responsavel`
- `Responsavel`: `ID_Responsavel`, `Nome`
- `Funcionario`: `ID_Funcionario`, `Nome`, `Cargo`
- `Registro_Presenca`: `ID_RegistroPonto`, `ID_Formulario`, `ID_Funcionario`

`ID_RegistroPonto` é a chave primária de cada presença. A tabela `Registro_Presenca` relaciona os formulários com os funcionários selecionados.

## APK

Este ambiente não possui Java, Gradle, Android SDK ou npm instalados, então não foi possível compilar o APK localmente.

Para gerar APK a partir deste app:

1. Use o Android Studio ou um serviço como PWABuilder.
2. Aponte para a pasta/URL onde este PWA está publicado.
3. Gere o pacote Android e exporte o APK assinado.

Arquivos principais:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
