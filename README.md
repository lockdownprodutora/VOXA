# Projeto Lockdown

Este é o projeto Lockdown completo, contendo o frontend em React/Vite com Tailwind CSS e o backend seguro em Node.js com Express para proxy do Google Drive e integração com o Firebase.

## Estrutura do Projeto

- `server.ts` - Servidor backend Node.js (Express) com integração segura para upload/media proxy do Google Drive corporativo.
- `src/` - Código-fonte do frontend React.
  - `components/` - Componentes reutilizáveis e páginas do site público.
  - `components/admin/` - Módulos administrativos (Gerenciamento de Músicas, Store, Ingressos, Assinaturas, etc.), incluindo o `StoreModule.tsx`.
  - `components/AdminPanel.tsx` - Painel de controle central de administração.
  - `utils/upload.ts` - Utilitário cliente para envio de mídias integrado ao backend.
- `package.json` - Dependências do projeto e scripts de execução.
- `.env.example` - Modelo de variáveis de ambiente necessárias para o funcionamento correto do Google Drive e Firebase.

## Requisitos

- Node.js (v18 ou superior)
- NPM, Yarn ou Bun

## Configuração

1. Faça uma cópia do arquivo `.env.example` e salve-a como `.env`:
   ```bash
   cp .env.example .env
   ```
2. Preencha as credenciais no arquivo `.env` de acordo com as suas contas do Firebase e do Google Cloud Service Account (com acesso de gravação e leitura no Google Drive corporativo).

## Como Executar

### 1. Instalar as dependências:
```bash
npm install
```

### 2. Executar em modo de desenvolvimento (Frontend + Backend integrados):
```bash
npm run dev
```
O servidor e o Vite serão iniciados juntos através de `tsx` na porta `3000`.

### 3. Compilar e executar em produção:
Para gerar o build de produção do frontend e do backend empacotados de forma otimizada:
```bash
npm run build
npm run start
```
Isso compilará o frontend para a pasta `dist` e empacotará o backend para `dist/server.cjs` com `esbuild`, garantindo máxima compatibilidade.
