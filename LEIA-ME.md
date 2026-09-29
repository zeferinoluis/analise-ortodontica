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

### Dossiê PDF: fim dos cortes a meio das análises e conclusões
- **Causa**: o dossiê era rasterizado num único canvas e o html2pdf fatiava-o de N em N pixels. As quebras caíam a meio de linhas de texto e de linhas de tabela, pelo que análises e conclusões saíam truncadas (a última linha de cada página aparecia cortada e continuava cortada na página seguinte).
- **Correção**: o dossiê passou a ser construído em **blocos**, medido no browser e distribuído por páginas A4 de altura fixa. As quebras caem sempre entre blocos inteiros — nunca a meio de um parágrafo, de uma linha de tabela ou de uma conclusão. Cada página é depois rasterizada e escrita diretamente no PDF pelo jsPDF.
- **Conclusões e observações longas** deixaram de ser um bloco único: são repartidas em troços pequenos (sem partir palavras nem separar números das unidades) e cada troço é paginável.
- **Histórico de consultas** passou de uma tabela larga (que colapsava no PDF) para blocos por consulta, com data, tipo e resumo sempre visíveis.
- **Imagens**: as dimensões das fotografias e do esquema das arcadas são resolvidas antes da medição e fixadas em píxeis. Antes, as imagens ainda a carregar mediam 0×0 (a imagem desaparecia) e o esquema das larguras era desenhado 1,4x maior do que a folha, ficando cortado à direita.
- **Texto já com entidades HTML** (dados gravados por versões antigas, com `&#39;`) é desconvertido antes de voltar a ser escapado, para o PDF não mostrar `&#39;` em vez do apóstrofo.
- Verificado em 11 páginas de um caso completo (cefalometria, modelos, facial frente/perfil, conclusões, 4 imagens e repositório): nenhuma página termina com conteúdo encostado ao limite inferior da folha.

- Cálculo do **ângulo ANB** (SNA − SNB) e classificação esquelética (Classe I/II/III), que faltava.
- Cálculo da **distância N-S em mm**, usando a escala real da calibração da régua (antes a calibração era feita mas nunca aplicada a nenhuma medida). Valor por omissão da escala corrigido de `1` para `null`, para não simular calibração falsa.
- Proteções contra falhas: gravar/carregar ficha antes da base de dados local estar pronta, e importação de backup `.json` inválido ou corrompido (agora mostra aviso em vez de rebentar a app).
- **Botão de Reset Total** (instalação limpa): apaga o IndexedDB e reinicia a ficha, com dupla confirmação.
- **Três análises cefalométricas selecionáveis** (Steiner, Downs, Tweed, ou "Todas as Análises"), com 16 marcos anatómicos disponíveis (S, N, A, B, Pg, Me, Gn, Go, Or, Po, ENA, ENP, U1/L1 borda+ápice). Inclui SNA, SNB, ANB, N-S, ângulo interincisal (comuns), SN-GoGn, U1-NA, L1-NB (Steiner), Ângulo Facial, Convexidade, Plano AB, Plano Mandibular/FH, Eixo Y (Downs), FMA, FMIA, IMPA (Tweed).
- **Análise facial mais completa**: mantém os terços verticais, acrescenta ângulo nasolabial, convexidade facial do perfil mole, e proporção largura bucal/facial — com 12 marcos anatómicos faciais. (Nesta versão passou a estar dividida em frente e perfil — ver secção seguinte.)
- O dossiê PDF agora inclui a tabela cefalométrica completa da análise escolhida e a tabela facial completa (antes só tinha os terços verticais), com numeração de secções calculada automaticamente.
- `manifest.json` com ícones **locais** (192, 512, e uma versão *maskable* para Android), `scope` e `id` — necessários para o PWABuilder gerar um pacote Android válido.
- `service-worker.js` guarda também em cache o `manifest.json` e os ícones. A versão de cache (`CACHE_NAME`) é agora **`ortoanalytic-cache-v13-15`** e deve ser sempre incrementada quando os ficheiros da app mudarem, para os clientes instalados (PWA/APK) substituírem a cache antiga.
- Layout e estilos (`styles.css`) mantidos sem alterações.

## Nova funcionalidade: Fotométrica Facial em duas vistas (frente + perfil)
- Em **Análise Digital → Fotométrica Facial** existem agora dois botões, **Foto de Frente** e **Foto de Perfil**. Cada vista é um estudo independente, com a sua própria fotografia, calibração da régua, marcos anatómicos, histórico de desfazer/refazer e tabela de resultados — trocar de vista não apaga nada da outra.
- **Vista de Frente** (15 marcos): terços verticais (Tr, Gl, Sn, Me), relação terço médio/inferior, largura bucal/bizigomática, largura interalar/bucal, distância externa dos olhos/bipupilar, inclinação da linha bipupilar (P D–P E), assimetrias ocular, da comissura labial e zigomática (em % entre lado direito e esquerdo) e índice facial quando a régua está calibrada.
- **Vista de Perfil** (13 marcos, inclui Columela, Lábio Inferior, Sulco Mentolabial, Cervical e Gónio Mole): convexidade facial (Gl-Sn-Pg'), convexidade nasal, ângulo nasolabial (usa a **Columela** quando marcada), ângulo mentolabial, ângulo cervicomental, ângulo do arco labial e posição do lábio superior em relação à linha Gl-Pg' (em px e em mm, se a régua estiver calibrada).
- A área **Resultados Atuais** mostra as **duas análises em simultâneo**, cada uma com o seu cabeçalho e tabela, e a interpretação sugerida passa a descrever a vista de frente e a de perfil em blocos separados.
- O **dossiê PDF** ganhou uma secção "Resultados da Análise Fotométrica Facial (Frente e Perfil)" com as duas tabelas e **duas páginas de traçado**, uma por fotografia; o histórico de evolução registra, numa só entrada, o resumo das duas vistas.
- Fichas antigas (com um único estudo facial) continuam a abrir: os marcos e a fotografia existentes são copiados para as duas vistas, para que nenhum dado marcado se perca — basta apagar os marcos que não pertencem a cada vista.

## Nova funcionalidade: cefalometria e modelos corrigidos e aprofundados

### Cefalometria — correções de cálculo
- **Medições angulares com direção anatómica**: IMPA, FMIA, U1–NA, L1–NB e ângulo interincisal eram medidos como ângulo entre retas-suporte (0–90°), o que devolvia o **suplemento** do valor clínico sempre que o dente estava inclinado para o lado oposto ao da norma. Agora o IMPA é medido com direção (perpendicular ao plano mandibular = 90°, retroinclinado < 90°, vestibularizado > 90°) e o **FMIA é derivado** pela identidade de Tweed (FMA + FMIA + IMPA = 180°), pelo que os três ângulos são sempre coerentes entre si.
- **Ângulo interincisal** passou a usar a convenção clínica: incisivos convergentes ~130°, paralelos ~180°; abaixo de 90° o resultado é assinalado como suspeito (pode indicar pontos trocados).
- **Eixo Y (Downs)** passou a ser o ângulo agudo entre S–Gn e o plano FH (norma 59,4°), deixando de depender do sentido com que Or e Po foram marcados.
- **U1–NA e L1–NB angulares** passaram a ser devolvidos como magnitude (0–90°) com a indicação explícita de que a direção (protrusão/retrusão) se lê nas medidas **lineares** correspondentes — que exigem a calibração da régua e aparecem assinaladas quando ela não existe.
- **Planos de referência por análise**, agora indicados no ecrã e no PDF: Steiner → plano SN; Downs → plano de Frankfort (Or–Po); Tweed → FH + plano mandibular.
- Acrescentado o **controlo do triângulo de Tweed** (FMA + FMIA + IMPA = 180°) e a **proporção de alturas faciais posterior/anterior** (S-Go / N-Me).

### Esquema das arcadas na análise de modelos
- Como o módulo de modelos é preenchido por formulário (não tem canvas), foi acrescentado ao painel de resultados um **esquema gráfico das larguras transversais**, desenhado em SVG.
- Para cada arcada mostra o **contorno do arco** (segmento circular, com os incisivos na linha média e os molares nas extremidades) e, por baixo, as **quatro larguras**: inter-pré-molar e inter-molar medidas (linha cheia, na cor da arcada) e as previstas por **Korkhaus** (superior) e **Pont** (inferior), a tracejado. O esquema é proporcional às larguras introduzidas, para se ver de imediato onde falta ou sobra espaço transversal.
- Abaixo do esquema, a legenda indica a **diferença em mm** entre medido e previsto em cada uma das quatro medidas.
- O esquema entra também no **dossiê PDF**, em página própria, a seguir aos resultados de modelos. Como o html2canvas é irregular a desenhar SVG inline, o esquema é **rasterizado para PNG** (a 2x, para sair nítido) antes de ser embutido, com a proporção real preservada dentro da área útil do A4.

### Correções no esquema das arcadas e no dossiê PDF
- O SVG do esquema **não reserva mais 800 px de altura** no painel (o `height` em píxeis passou a ser dado apenas na rasterização): era isso que fazia o esquema aparecer com o dobro da altura e o cortava na aplicação.
- **Textos do esquema reposicionados**: o nome de cada arcada deixou de ficar cortado no topo (estava em `y = −26`) e os rótulos das larguras passaram a ficar **acima** das marcas das linhas de medida, em vez de lhes passarem por cima.
- **Títulos das secções do PDF com folga**: os títulos de página estavam encostados ao limite da folha (6 secções para 3 quebras de página), o que cortava o topo das letras; passaram a ter margem superior, as margens da folha aumentaram para 15/14 mm em cima/baixo e o modo de quebra deixou de usar `avoid-all` (que empurrava blocos para o topo exato da página).

### Linhas de referência na fotometria de perfil
- No traçado da fotografia de perfil passou a figurar uma **linha horizontal pela glabela** (base da convexidade facial e do ângulo nasolabial, que são medidos em relação à horizontal) e uma **linha vertical pelo subnasal** (referência de projeção labial) — ambas tracejadas, ambas opcionais em conjunto com os restantes planos.

### Planos de referência sobrepostos ao traçado
- Caixa **"Planos de referência"** no painel da Análise Digital (cefalometria), ligada por omissão; a escolha fica guardada na ficha do paciente.
- Desenha, estendidos para lá dos pontos que os definem e identificados por uma legenda no canto: **SN** (Sela–Násio), **plano de Frankfort** (Or–Po), **plano mandibular** (Go–Gn), **NA**, **NB**, **S–Gn** (eixo Y) e **N–Pg** (plano facial), mais os **eixos dos incisivos** (ápice–bordo) e a **perpendicular ao plano mandibular** no bordo incisal inferior — que é a linha a partir da qual o IMPA é contado (90° = incisivo perpendicular).
- Assinala no próprio traçado os valores de **SNA, SNB, SN-GeGn e IMPA**, para o clínico poder validar visualmente aquilo que a tabela apresenta.
- As linhas auxiliares (NA, NB, S–Gn, N–Pg e eixos) são tracejadas, para não competirem com o traçado dos pontos; só se desenha o que tem os pontos necessários marcados.
- Os planos entram também no **traçado do dossiê PDF** (linhas + legenda, sem os rótulos de valores, para não sobrecarregar a imagem).

### Análise de modelos — correções e novos índices
- **Índice de Bolton estava errado**: era calculado como soma dos 6 anteriores inferiores ÷ soma dos 6 superiores, que é a proporção *total*, e apresentado como Bolton anterior. Agora existem os dois, com as normas corretas: **Bolton anterior** (S4inf/S4sup, 77,2% ± 1,6) e **Bolton total** (S6inf/S6sup, 91,3% ± 1,9).
- **Korkhaus** usava a soma dos 6 anteriores com o fator dos 4 incisivos. Agora usa a **soma dos 4 incisivos superiores** (largura inter-pré-molar prevista = S4sup × 100/80; inter-molar = S4sup × 100/64) e foi acrescentado o **índice de Pont** para a arcada inferior (S4inf × 100/80 e 100/64), com confronto direto entre largura prevista e real.
- **Índice de Howes** passou a ser calculado na forma interpretável — perímetro do arco sobre a metade da soma dos 10 dentes (norma 43–45%) — em vez do quociente direto dentes/perímetro, que dava valores sem significado clínico.
- **Discrepância de espaço por arcada** (perímetro − soma mesiostial), agora com o **perímetro escolhido pelo clínico** (deixou de ser sempre 74 mm) e com aviso quando as duas medições não podem ser comparadas.
- Painel de entrada reorganizado por secções (dentição, larguras transversais, espaço disponível) com os campos que faltavam: **larguras e perímetros inferiores** e **soma mesiostial dos 10 dentes por arcada**.
- **Validações**: entrar `0` num campo deixou de ser substituído pelo valor por omissão; campos vazios ou negativos ficam assinalados a vermelho; discrepâncias implausíveis (> 25 mm) e somas fora do intervalo habitual geram avisos de "verificar antes de concluir", mostrados no ecrã e no PDF.
- A interpretação automática e o dossiê PDF passaram a usar **as mesmas funções de cálculo do ecrã** (sem fórmulas duplicadas), incluindo os avisos de coerência.

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
