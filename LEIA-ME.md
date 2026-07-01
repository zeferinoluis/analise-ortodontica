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
- Cálculo da **distância N-S em mm**, usando a escala real da calibração da régua (antes a calibração era feita mas nunca aplicada a nenhuma medida).
- Proteções contra falhas: gravar/carregar ficha antes da base de dados local estar pronta, e importação de backup `.json` inválido ou corrompido (agora mostra aviso em vez de rebentar a app).
- `manifest.json` com ícones **locais** (192, 512, e uma versão *maskable* para Android), `scope` e `id` — necessários para o PWABuilder gerar um pacote Android válido.
- `service-worker.js` agora também guarda em cache o `manifest.json` e os ícones, e a versão de cache foi incrementada.
- Layout, estilos (`styles.css`) e toda a lógica clínica existente mantidos sem alterações.

## Nota importante (RGPD / dados clínicos)
Os dados dos pacientes (fotos, radiografias, nome) continuam a ficar guardados **apenas no dispositivo** (IndexedDB) e o backup exportado é um `.json` sem encriptação. Isto é aceitável para uso pessoal/local, mas se a app for partilhada com outros profissionais ou dispositivos, vale a pena considerar encriptar o backup ou restringir o acesso ao ficheiro exportado.
