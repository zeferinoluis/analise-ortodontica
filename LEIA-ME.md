# OrtoAnalytic Pro v7.0 — PWA pronta para GitHub Pages + PWABuilder

## 1. Publicar no GitHub Pages
1. Cria um repositório novo (ex: `ortoanalytic-pro`) e envia todos os ficheiros desta pasta (`index.html`, `app.js`, `styles.css`, `manifest.json`, `service-worker.js`, `icons/`).
2. No repositório: **Settings → Pages → Branch: main → / (root) → Save**.
3. Espera 1-2 minutos. O site fica disponível em:
   `https://<teu-utilizador>.github.io/ortoanalytic-pro/`
4. Abre esse URL no telemóvel Android (Chrome) — deve aparecer a opção "Adicionar ao ecrã principal" (instalação PWA), já a funcionar offline.

## 2. Gerar o APK/AAB com o PWABuilder
1. Vai a **https://www.pwabuilder.com**.
2. Cola o URL do GitHub Pages e clica **Start**.
3. Confirma que o relatório mostra o manifest e o service worker como ✅ válidos.
4. Escolhe **Android** → gera o pacote (APK para teste direto no telemóvel, ou AAB para publicar na Play Store).
5. Instala o APK no telemóvel (pode ser preciso ativar "Instalar de fontes desconhecidas" nas definições) ou submete o AAB à Play Console se quiseres publicar.

## O que foi corrigido/adicionado nesta versão
- Cálculo do **ângulo ANB** (SNA − SNB) e classificação esquelética (Classe I/II/III), que faltava.
- Cálculo da **distância N-S em mm**, usando a escala real da calibração da régua (antes a calibração era feita mas nunca aplicada a nenhuma medida). Valor por omissão da escala corrigido de `1` para `null`, para não simular calibração falsa.
- Proteções contra falhas: gravar/carregar ficha antes da base de dados local estar pronta, e importação de backup `.json` inválido ou corrompido (agora mostra aviso em vez de rebentar a app).
- **Botão de Reset Total** (instalação limpa): apaga o IndexedDB e reinicia a ficha, com dupla confirmação.
- **Três análises cefalométricas selecionáveis** (Steiner, Downs, Tweed, ou "Todas as Análises"), com 16 marcos anatómicos disponíveis (S, N, A, B, Pg, Me, Gn, Go, Or, Po, ENA, ENP, U1/L1 borda+ápice). Inclui SNA, SNB, ANB, N-S, ângulo interincisal (comuns), SN-GoGn, U1-NA, L1-NB (Steiner), Ângulo Facial, Convexidade, Plano AB, Plano Mandibular/FH, Eixo Y (Downs), FMA, FMIA, IMPA (Tweed).
- **Análise facial mais completa**: mantém os terços verticais, acrescenta ângulo nasolabial, convexidade facial do perfil mole, e proporção largura bucal/facial — com 12 marcos anatómicos faciais.
- O dossiê PDF agora inclui a tabela cefalométrica completa da análise escolhida e a tabela facial completa (antes só tinha os terços verticais), com numeração de secções calculada automaticamente.
- `manifest.json` com ícones **locais** (192, 512, e uma versão *maskable* para Android), `scope` e `id` — necessários para o PWABuilder gerar um pacote Android válido.
- `service-worker.js` agora também guarda em cache o `manifest.json` e os ícones, e a versão de cache foi incrementada.
- Layout e estilos (`styles.css`) mantidos sem alterações.

## Nota sobre as normas cefalométricas/faciais
Os valores de referência (Steiner 1953, Downs 1948, Tweed 1954, e proporções faciais clássicas) são os habitualmente citados em bibliografia ortodôntica-padrão. Servem como apoio de triagem — a interpretação clínica final é sempre do profissional responsável.

## Nova funcionalidade: Sincronização com Google Drive
- Painel "Sincronização (Google Drive)" no separador "Ficha & Documentação", junto ao painel de Base de Dados Local.
- Usa o mesmo Client ID OAuth que já configuraste (Google Cloud Console → OAuth consent + credenciais tipo "Web application", com o domínio `zeferinoluis.github.io` autorizado).
- O backup é guardado na pasta privada `appDataFolder` da conta Google (invisível no Drive normal do utilizador, só acessível por esta app e pelo `recovery.html`).
- Sincronização automática em segundo plano sempre que gravas uma ficha localmente, desde que já estejas ligado.
- Opção de encriptar o backup (PBKDF2 + AES-GCM 256) com uma palavra-passe à escolha — se ativada, é a mesma palavra-passe pedida no `recovery.html` para restaurar.
- `recovery.html` já está preparado para ler este backup (procura o ficheiro `ortoanalytic_backup.json` na `appDataFolder`, com histórico de versões).

## Nota importante (RGPD / dados clínicos)
Os dados dos pacientes (fotos, radiografias, nome) ficam guardados **no dispositivo** (IndexedDB) e, se ativares a sincronização, também na `appDataFolder` privada da tua conta Google — nunca partilhada nem visível a terceiros através do Drive normal. Recomenda-se ativar a encriptação se a conta Google usada não for de uso estritamente pessoal/profissional. O ficheiro exportado manualmente (Exportar Ficheiro de Backup) continua a ser um `.json` sem encriptação, por ser apenas a ficha atualmente aberta — evita partilhar esse ficheiro sem cuidado.
