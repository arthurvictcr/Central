# Seiva — aplicativo

A mesma Seiva do claude.ai, agora como aplicativo instalável no celular e no computador, com sincronização entre os dois.

## Como funciona
- **Login:** só com a sua conta Google. A Seiva não guarda nenhuma senha.
- **Sincronização:** seus dados ficam no Firestore (Firebase), dentro de `users/<seu id>`. As regras (`firestore.rules`) só deixam a sua conta ler e escrever ali.
- **Offline:** abre sem internet e sincroniza quando a conexão voltar.
- **Clima:** vem do Open-Meteo, que não pede chave nem dados pessoais.
- **Custo:** o plano gratuito do Firebase (Spark) e o GitHub Pages bastam.

## Passo a passo (uma vez só)

### 1. Firebase
1. Acesse console.firebase.google.com e crie um projeto chamado **central**. Pode desligar o Analytics.
2. **Authentication → Começar → Google → Ativar**.
3. **Firestore Database → Criar banco de dados**, em modo de produção, na região `southamerica-east1`.
4. Na aba **Regras** do Firestore, apague o que estiver lá, cole o conteúdo do arquivo `firestore.rules` e clique em **Publicar**.
5. Em **Configurações do projeto → Seus apps**, clique no ícone **Web (</>)** e registre o app com o nome "Seiva".
6. Copie os valores que aparecerem (apiKey, authDomain etc.) para o arquivo `firebase-config.js`.

### 2. GitHub Pages
1. No GitHub, crie um repositório **público** chamado `central`.
2. Clique em **Add file → Upload files** e arraste **todos os arquivos desta pasta**, incluindo a pasta `icons`.
3. Vá em **Settings → Pages → Deploy from a branch**, escolha `main` e `/ (root)` e salve.
4. Em 1 ou 2 minutos o app fica em `https://SEU-USUARIO.github.io/central/`.

### 3. Liberar o endereço no login
No Firebase, vá em **Authentication → Configurações → Domínios autorizados → Adicionar** e coloque `SEU-USUARIO.github.io`.

### 4. Trazer seus dados do claude.ai
1. Na Seiva do claude.ai, abra **Menu → Configurações → Cópia de segurança → Baixar**.
2. No app, entre com o Google e abra **Menu → Configurações → Cópia de segurança → Restaurar** com esse arquivo.
3. Depois disso, apague o arquivo baixado. Ele **nunca** deve ir para o GitHub.

### 5. Instalar
- **Android (Chrome):** abra o endereço, toque em ⋮ e depois em **Instalar app**. Ou use o botão **Instalar o app** que aparece no menu da Seiva.
- **Computador (Chrome ou Edge):** clique no ícone de instalar na barra de endereço.

## Atualizar o app
Para atualizar, troque o `index.html` pelo novo e mude o valor de `VERSION` no `sw.js`. Na próxima vez que o app abrir com internet, ele baixa a versão nova.

## O que ainda não funciona no app
- **Upload de arquivos em Documentos:** o Firebase Storage exige o plano pago. Todo o resto sincroniza normalmente.
