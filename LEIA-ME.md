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
- **Análise facial mais completa**: mantém os terços verticais, acrescenta ângulo nasolabial, convexidade facial do perfil mole, e proporção largura bucal/facial — com 12 marcos anatómicos faciais. (Nesta versão passou a estar dividida em frente e perfil — ver secção seguinte.)
- O dossiê PDF agora inclui a tabela cefalométrica completa da análise escolhida e a tabela facial completa (antes só tinha os terços verticais), com numeração de secções calculada automaticamente.
- `manifest.json` com ícones **locais** (192, 512, e uma versão *maskable* para Android), `scope` e `id` — necessários para o PWABuilder gerar um pacote Android válido.
- `service-worker.js` agora também guarda em cache o `manifest.json` e os ícones, e a versão de cache foi incrementada.
- Layout e estilos (`styles.css`) mantidos sem alterações.

## Nova funcionalidade: Fotométrica Facial em duas vistas (frente + perfil)
- Em **Análise Digital → Fotométrica Facial** existem agora dois botões, **Foto de Frente** e **Foto de Perfil**. Cada vista é um estudo independente, com a sua própria fotografia, calibração da régua, marcos anatómicos, histórico de desfazer/refazer e tabela de resultados — trocar de vista não apaga nada da outra.
- **Vista de Frente** (15 marcos): terços verticais (Tr, Gl, Sn, Me), relação terço médio/inferior, largura bucal/bizigomática, largura interalar/bucal, distância externa dos olhos/bipupilar, inclinação da linha bipupilar (P D–P E), assimetrias ocular, da comissura labial e zigomática (em % entre lado direito e esquerdo) e índice facial quando a régua está calibrada.
- **Vista de Perfil** (13 marcos, inclui Columela, Lábio Inferior, Sulco Mentolabial, Cervical e Gónio Mole): convexidade facial (Gl-Sn-Pg'), convexidade nasal, ângulo nasolabial (usa a **Columela** quando marcada), ângulo mentolabial, ângulo cervicomental, ângulo do arco labial e posição do lábio superior em relação à linha Gl-Pg' (em px e em mm, se a régua estiver calibrada).
- A área **Resultados Atuais** mostra as **duas análises em simultâneo**, cada uma com o seu cabeçalho e tabela, e a interpretação sugerida passa a descrever a vista de frente e a de perfil em blocos separados.
- O **dossiê PDF** ganhou uma secção "Resultados da Análise Fotométrica Facial (Frente e Perfil)" com as duas tabelas e **duas páginas de traçado**, uma por fotografia; o histórico de evolução registra, numa só entrada, o resumo das duas vistas.
- Fichas antigas (com um único estudo facial) continuam a abrir: os marcos e a fotografia existentes são copiados para as duas vistas, para que nenhum dado marcado se perca — basta apagar os marcos que não pertencem a cada vista.

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
