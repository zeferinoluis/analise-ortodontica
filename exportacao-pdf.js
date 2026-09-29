// ==========================================================================
// EXPORTAÇÃO PDF — geração do dossiê clínico completo (html2pdf/html2canvas)
// ==========================================================================

// Clona a tabela do histórico e remove a última coluna (Ações — Editar/Apagar), que só faz
// sentido no ecrã; o PDF nunca deve mostrar botões interativos.
function obterHtmlHistoricoParaPDF() {
    const original = document.getElementById('table-evolution');
    const clone = original.cloneNode(true);
    clone.querySelectorAll('tr').forEach(tr => {
        const ultima = tr.lastElementChild;
        if (ultima) ultima.remove();
    });
    return clone.outerHTML;
}

function renderizarTabelaResultadosPDF(linhas) {
    if (!linhas || linhas.length === 0) {
        return `<tr><td colspan="4" style="padding:6px; border:1px solid #cbd5e1; text-align:center;">Análise não executada (pontos insuficientes).</td></tr>`;
    }
    let html = ''; let grupoAtual = null;
    const cor = { 'status-ok': '#16a34a', 'status-dev': '#dc2626', '': '#475569' };
    linhas.forEach(l => {
        if (l.grupo !== grupoAtual) {
            grupoAtual = l.grupo;
            html += `<tr><td colspan="4" style="padding:5px 6px; border:1px solid #cbd5e1; background:#eef2f7; font-weight:bold; color:#0284c7;">${grupoAtual}</td></tr>`;
        }
        html += `<tr><td style="padding:6px; border:1px solid #cbd5e1;">${l.label}</td><td style="padding:6px; border:1px solid #cbd5e1;">${l.valor}</td><td style="padding:6px; border:1px solid #cbd5e1;">${l.norma}</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${cor[l.status]||'#475569'};">${l.texto}</td></tr>`;
    });
    return html;
}

// Desenha no contexto virtual as linhas do estudo pedido (cefalometria / facialFrente / facialPerfil)
function desenharLinhasEstudoNoCtx(cEstudo, chaveEstudo, vCtx) {
    const p = cEstudo.pontos;
    const lin = (a, b, cor) => { if (p[a] && p[b]) drawLine({ x: p[a].x, y: p[a].y }, { x: p[b].x, y: p[b].y }, cor, vCtx); };

    if (chaveEstudo === 'cefalometria') {
        lin('S', 'N', '#0284c7'); lin('N', 'A', '#16a34a'); lin('N', 'B', '#e11d48');
        lin('Go', 'Gn', '#ea580c'); lin('Or', 'Po', '#7c3aed');
        lin('U1a', 'U1i', '#0891b2'); lin('L1a', 'L1i', '#0891b2');
    } else if (chaveEstudo === 'facialFrente') {
        // Linha média vertical e planos horizontais (proporções e simetria)
        lin('Tr', 'Gl', '#0284c7'); lin('Gl', 'Sn', '#0284c7'); lin('Sn', 'Me', '#0284c7');
        lin('P_D', 'P_E', '#7c3aed'); lin('En_D', 'En_E', '#94a3b8');
        lin('Zy_D', 'Zy_E', '#ea580c'); lin('Ch_D', 'Ch_E', '#e11d48'); lin('Al_D', 'Al_E', '#16a34a');
    } else if (chaveEstudo === 'facialPerfil') {
        // Perfil mole e linha de referência Gl–Pg'
        lin('Tr', 'Gl', '#0284c7'); lin('Gl', 'Na', '#0284c7'); lin('Na', 'Prn', '#0284c7');
        lin('Prn', 'Cm', '#16a34a'); lin('Cm', 'Sn', '#16a34a');
        lin('Sn', 'Ls', '#e11d48'); lin('Ls', 'Li', '#e11d48'); lin('Li', 'Bs', '#e11d48');
        lin('Bs', 'PgL', '#e11d48'); lin('PgL', 'Me', '#e11d48');
        lin('Me', 'C', '#94a3b8'); lin('Gl', 'PgL', '#7c3aed');
    }
}

// GERAÇÃO ASSÍNCRONA DO CANVAS VIRTUAL (aguarda o carregamento da imagem antes de desenhar)
function gerarCanvasVirtualFundidoAsync(chaveEstudo) {
    return new Promise((resolve) => {
        let dados = appState.estudosImagens[chaveEstudo];
        if (!dados || !dados.src) return resolve("");

        let vCanvas = document.createElement('canvas');
        let vCtx = vCanvas.getContext('2d');
        let nw = dados.naturalWidth || 1200;
        let nh = dados.naturalHeight || 900;
        vCanvas.width = nw;
        vCanvas.height = nh;

        let imgBase = new Image();
        imgBase.onload = function() {
            vCtx.drawImage(imgBase, 0, 0, nw, nh);
            vCtx.lineWidth = Math.max(4, nw / 240);
            let p = dados.pontos;

            desenharLinhasEstudoNoCtx(dados, chaveEstudo, vCtx);

            // Planos de referência cefalométricos (quando o clínico os tem ligados):
            // no PDF não se repetem os valores dos ângulos, só as linhas + legenda.
            if (chaveEstudo === 'cefalometria' && appState.mostrarPlanosReferencia) {
                desenharPlanosReferencia((k) => dados.pontos[k] ? { x: dados.pontos[k].x, y: dados.pontos[k].y } : null, dados, vCtx, false);
            }

            for (let k in p) {
                if (p[k]) {
                    vCtx.beginPath(); vCtx.arc(p[k].x, p[k].y, Math.max(6, nw/140), 0, 2*Math.PI);
                    vCtx.fillStyle = '#dc2626'; vCtx.fill();
                    vCtx.font = `bold ${Math.max(16, nw/45)}px sans-serif`;
                    vCtx.fillStyle = '#ffffff'; vCtx.strokeStyle = '#000000'; vCtx.lineWidth = 4;
                    vCtx.strokeText(k, p[k].x+20, p[k].y-5);
                    vCtx.fillText(k, p[k].x+20, p[k].y-5);
                }
            }
            resolve(vCanvas.toDataURL('image/jpeg', 0.92));
        };
        imgBase.onerror = function() { resolve(""); };
        imgBase.src = dados.src;
    });
}

// Rasteriza o esquema das arcadas (SVG) para PNG, para entrar no dossier.
// O html2pdf/html2canvas é irregular a desenhar SVG inline, por isso o SVG é
// desenhado num canvas fora do ecrã e entra no PDF como imagem normal.
function gerarImagemDiagramaArcadas() {
    return new Promise((resolve) => {
        try {
            const svg = svgDiagramaArcadas();
            if (!svg) return resolve(null);
            const ESCALA = 2;   // 2x para a imagem sair nítida no PDF
            const img = new Image();
            img.onload = function() {
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth || 1240;
                    c.height = img.naturalHeight || 800;
                    const ctx2 = c.getContext('2d');
                    if (!ctx2) return resolve(null);
                    ctx2.fillStyle = '#ffffff';
                    ctx2.fillRect(0, 0, c.width, c.height);
                    ctx2.scale(ESCALA, ESCALA);
                    ctx2.drawImage(img, 0, 0);
                    resolve(c.toDataURL('image/png'));
                } catch (e) { resolve(null); }
            };
            img.onerror = function() { resolve(null); };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        } catch (e) { resolve(null); }
    });
}

// Utilitário: converte uma imagem base64 para dimensões reais sem a inserir no DOM
function obterDimensoesImagem(src) {
    return new Promise((resolve) => {
        if (!src) return resolve({ w: 0, h: 0 });
        let i = new Image();
        i.onload = () => resolve({ w: i.naturalWidth, h: i.naturalHeight });
        i.onerror = () => resolve({ w: 0, h: 0 });
        i.src = src;
    });
}

// Gera uma imagem base64 com o título gravado no topo (título e foto são inseparáveis no PDF)
function gerarImagemComTitulo(src, titulo) {
    return new Promise((resolve) => {
        if (!src) return resolve("");
        let img = new Image();
        img.onload = function() {
            const BAR_H = Math.round(img.naturalHeight * 0.062); // ~6% da altura da imagem
            const FONT_SIZE = Math.round(BAR_H * 0.52);
            const PAD = Math.round(BAR_H * 0.22);

            let c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight + BAR_H;
            let ctx2 = c.getContext('2d');

            // Barra de cabeçalho
            ctx2.fillStyle = '#f8fafc';
            ctx2.fillRect(0, 0, c.width, BAR_H);

            // Linha azul inferior da barra
            ctx2.fillStyle = '#0284c7';
            ctx2.fillRect(0, BAR_H - 3, c.width, 3);

            // Texto do título
            ctx2.font = `bold ${FONT_SIZE}px Arial, sans-serif`;
            ctx2.fillStyle = '#0f172a';
            ctx2.fillText(titulo, PAD * 2, BAR_H - PAD - 2);

            // Imagem abaixo da barra
            ctx2.drawImage(img, 0, BAR_H, img.naturalWidth, img.naturalHeight);

            resolve(c.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
}

// Calcula o style de uma <img> para que caiba sempre dentro da área útil do A4
// sem nunca ser cortada, preservando proporção
function estiloImgSeguro(nw, nh, areaLargMm = 170, areaAltMm = 233) {
    // A4 com margens de 12mm: área útil ≈ 186×267mm; imagem deve caber em ~170×233mm (com título)
    // html2pdf usa scale:2, então 1mm ≈ 3.78px
    const PX_POR_MM = 3.78;
    const maxW = areaLargMm * PX_POR_MM;
    const maxH = areaAltMm * PX_POR_MM;

    if (!nw || !nh) return 'width:100%; height:auto; display:block; margin:0 auto;';

    const ratio = nw / nh;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }

    return `width:${Math.round(w)}px; height:${Math.round(h)}px; display:block; margin:0 auto; object-fit:contain;`;
}

// ==========================================================================
// RENDERIZADOR INTEGRAL DA VERSÃO 7.0 (SISTEMA FLUIDO EM BLOCOS VERTICAIS)
// ==========================================================================
async function exportarDossierClinicoCompletoPDF() {
    const nome = document.getElementById('paciente-nome').value;
    const cod = document.getElementById('paciente-id').value;
    let secNum = 0; // contador de secções — evita numeração manual frágil

    const element = document.createElement('div');
    element.style.width = '170mm'; 
    element.style.margin = '0 auto';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.color = '#0f172a';

    // Aguarda o carregamento real das imagens antes de gerar o canvas
    // (a fotometria facial tem duas vistas independentes: frente e perfil)
    let cefaloImgData = await gerarCanvasVirtualFundidoAsync('cefalometria');
    let facialFrenteImgData = await gerarCanvasVirtualFundidoAsync('facialFrente');
    let facialPerfilImgData = await gerarCanvasVirtualFundidoAsync('facialPerfil');

    const nomeSafe = escaparHTML(nome);
    const codSafe = escaparHTML(cod);
    const indicacoesSafe = escaparHTML(document.getElementById('indicacoes-gerais').value);
    const anomaliasSafe = escaparHTML(document.getElementById('anomalias-obs').value);

    // Métricas de modelos: mesma função usada no ecrã (nunca fórmulas duplicadas)
    const resultadosModelos = calcularResultadosModelos();
    const desenhoArcadas = appState.modelosRegistados ? await gerarImagemDiagramaArcadas() : null;

    const tipoAnaliseSelect = document.getElementById('tipo-analise-cefalo');
    const tipoAnaliseAtual = tipoAnaliseSelect ? tipoAnaliseSelect.value : 'steiner';
    const nomesAnalise = { steiner: 'Steiner', downs: 'Downs', tweed: 'Tweed', todas: 'Todas as Análises' };
    let linhasCefalo = calcularResultadosCefalometricosCompleto(tipoAnaliseAtual);
    let relatorioFacial = calcularRelatorioFacialCompleto();

    // CONTEÚDO DA PÁGINA 1
    let pdfHtml = `
        <div style="page-break-inside: avoid !important;">
            <div style="border-bottom: 3px solid #0284c7; padding-bottom: 5px; margin-bottom: 20px;">
                <h1 style="margin: 0; color: #0f172a; font-size: 21pt;">Dossiê Clínico de Diagnóstico Ortodôntico</h1>
                <span style="color:#64748b; font-size:9pt;">OrtoAnalytic Pro System v7.0 — Dr. Luís Zeferino</span>
            </div>
            
            <p style="font-size:10pt; line-height:1.6; margin-bottom:25px;">
                <strong>Paciente:</strong> ${nomeSafe} <br>
                <strong>Processo Clínico ID:</strong> ${codSafe}<br>
                <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-PT')}
            </p>
            
            <div style="margin-top:15px;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:6px;">${++secNum}. Plano Geral & Indicações Clínicas</h3>
                <p style="background:#f8fafc; padding:12px; border:1px solid #e2e8f0; font-size:9.5pt; border-radius:4px; text-align:justify; margin:0;">${indicacoesSafe || 'Sem indicações registadas para este caso.'}</p>
            </div>
            
            <div style="margin-top:25px;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:6px;">${++secNum}. Historial de Consultas & Evolução Temporal</h3>
                ${obterHtmlHistoricoParaPDF()}
            </div>
        </div>
    `;

    // CONTEÚDO DA PÁGINA 2 — CEFALOMETRIA + MODELOS + FACIAL
    pdfHtml += `
        <div style="page-break-before: always; page-break-inside: avoid !important;">
            <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px;">${++secNum}. Análise Cefalométrica — ${nomesAnalise[tipoAnaliseAtual] || tipoAnaliseAtual}</h3>
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:20px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Parâmetro</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Medido</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Norma</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Status</th>
                    </tr>
                </thead>
                <tbody>${renderizarTabelaResultadosPDF(linhasCefalo)}</tbody>
            </table>
            <p style="font-size:8.5pt; color:#64748b; margin:0 0 18px 0; line-height:1.5;">
                <strong>Convenções de medição:</strong> cada análise usa o seu plano de referência clássico — Steiner: plano SN; Downs: plano de Frankfort (Or–Po); Tweed: FH com plano mandibular (Go–Gn), onde FMA = FMIA + IMPA.
                As medições angulares dos incisivos seguem a convenção clínica sobre o eixo do dente (bordo incisal → ápice): U1–NA, L1–NB e IMPA são devolvidos no intervalo 0–180° que contém a norma publicada (U1–NA 22°, L1–NB 25°, IMPA 90°).
                As medidas lineares (N-S, U1–NA e L1–NB lineares) exigem a calibração da régua; sem calibração aparecem assinaladas como tal.
            </p>
        </div>
    `;

    // Bloco de modelos gerado a partir das MESMAS linhas do ecrã (Bolton ant./total,
    // Korkhaus e Pont, Howes e discrepância de espaço por arcada), com os avisos de coerência.
    const corOK = '#16a34a', corDev = '#dc2626';
    const corLinha = { 'status-ok': corOK, 'status-dev': corDev, '': '#475569' };

    function linhasModelosParaPDF(linhas) {
        let html = ''; let grupoAtual = null;
        linhas.forEach(l => {
            if (l.label.indexOf('—') === 0) {
                html += `<tr><td colspan="4" style="padding:5px 6px; border:1px solid #cbd5e1; background:#f8fafc; color:#64748b; font-style:italic;">${escaparHTML(l.label.replace(/—/g, '').trim())}</td></tr>`;
                grupoAtual = l.grupo;
                return;
            }
            if (l.grupo !== grupoAtual) {
                grupoAtual = l.grupo;
                html += `<tr><td colspan="4" style="padding:5px 6px; border:1px solid #cbd5e1; background:#eef2f7; font-weight:bold; color:#0284c7;">${escaparHTML(grupoAtual)}</td></tr>`;
            }
            html += `<tr><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.label)}</td><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.valor) || '—'}</td><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.norma) || '—'}</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${corLinha[l.status] || '#475569'};">${escaparHTML(l.texto) || '—'}</td></tr>`;
        });
        return html;
    }

    let blocoModelos;
    if (appState.modelosRegistados) {
        const avisosModelos = resultadosModelos.avisos.length
            ? `<p style="font-size:9pt; background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:8px 10px; border-radius:4px; margin:0 0 10px 0;"><strong>Verificar antes de concluir:</strong><br>${resultadosModelos.avisos.map(a => '• ' + escaparHTML(a)).join('<br>')}</p>`
            : '';
        blocoModelos = avisosModelos + `
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:20px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Métrica / Parâmetro</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Computado</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Norma de Referência</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Status Clínico</th>
                    </tr>
                </thead>
                <tbody>${linhasModelosParaPDF(resultadosModelos.linhas)}</tbody>
            </table>`;
    } else {
        blocoModelos = `<p style="font-size:9.5pt; background:#f8fafc; padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin-bottom:20px;">Análise de modelos não registada para este paciente. (Para incluir, preencha os dados na Análise Digital → Análise de Modelos e prima "Guardar Modelos".)</p>`;
    }

    // PÁGINA DO ESQUEMA DAS LARGURAS TRANSVERSAIS (a seguir aos resultados de modelos)
    let blocoDiagrama = '';
    if (desenhoArcadas) {
        // Dimensões REAIS da imagem rasterizada (2x), para o cálculo do estilo
        // usar a proporção verdadeira do esquema
        const dimD = await obterDimensoesImagem(desenhoArcadas);
        const estiloD = estiloImgSeguro(dimD.w, dimD.h, 176, 210);
        blocoDiagrama = `
            <div style="page-break-before: always; page-break-inside: avoid; width:100%; display:block;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px;">${++secNum}. Esquema das Larguras Transversais</h3>
                <span style="color:#475569; font-size:9.5pt; display:block; margin-bottom:10px; text-align:left;">Contorno de cada arco com as larguras inter-pré-molar e inter-molar medidas (linha cheia) e previstas por Korkhaus (arcada superior) e pelo índice de Pont (arcada inferior), a tracejado. Esquema proporcional às larguras introduzidas.</span>
                <img src="${desenhoArcadas}" style="${estiloD} border:1px solid #cbd5e1; border-radius:4px;">
            </div>
        `;
    }

    // Bloco de resultados faciais de uma vista (cabeçalho + tabela), reutilizado para frente e perfil
    function blocoResultadosFacialPDF(titulo, subtitulo, linhas) {
        return `
            <h4 style="color:#0284c7; font-size:10pt; margin:0 0 4px 0;">${titulo}</h4>
            <p style="font-size:8.5pt; color:#64748b; margin:0 0 6px 0;">${subtitulo}</p>
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:15px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Parâmetro</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Medido</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Norma</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Status</th>
                    </tr>
                </thead>
                <tbody>${renderizarTabelaResultadosPDF(linhas)}</tbody>
            </table>`;
    }

    pdfHtml += `
        <div style="page-break-before: always; page-break-inside: avoid !important;">
            <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px;">${++secNum}. Análise Quantitativa de Modelos de Estudo</h3>
            ${blocoModelos}

            <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px; margin-top:25px;">${++secNum}. Resultados da Análise Fotométrica Facial (Frente e Perfil)</h3>
            ${blocoResultadosFacialPDF('Vista de FRENTE — proporções e simetria', 'Terços verticais, proporções horizontais, linha bipupilar e assimetrias entre lado direito e esquerdo.', relatorioFacial.frente)}
            <div style="page-break-inside: avoid !important;">
                ${blocoResultadosFacialPDF('Vista de PERFIL — perfil mole e terço inferior', 'Ângulos nasolabial, mentolabial e cervicomental, convexidade facial e posição do lábio superior.', relatorioFacial.perfil)}
            </div>
            <p style="font-size:9.5pt; background:#f8fafc; padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin:0; margin-top:15px;"><strong>Conclusões & Anomalias Detetadas:</strong><br>${anomaliasSafe || 'Sem notas adicionais inseridas.'}</p>
        </div>
    `;

    pdfHtml += blocoDiagrama;

    // PÁGINA DEDICADA EXCLUSIVA PARA A CEFALOMETRIA
    if (cefaloImgData) {
        let dimC = await obterDimensoesImagem(cefaloImgData);
        let estiloC = estiloImgSeguro(dimC.w, dimC.h);
        pdfHtml += `
            <div style="page-break-before: always; page-break-inside: avoid; width:100%; display:block;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; text-align:left; margin-bottom:10px;">${++secNum}. Cefalometria Radiográfica Computadorizada</h3>
                <span style="color:#475569; font-size:9.5pt; display:block; margin-bottom:10px; text-align:left;">Camada de vetores sagitais em píxeis absolutos nativos da telerradiografia, com os planos de referência usados nas medições (SN, Frankfort, plano mandibular, NA/NB e eixos incisivos).</span>
                <img src="${cefaloImgData}" style="${estiloC} border:1px solid #cbd5e1; border-radius:4px;">
            </div>
        `;
    }

    // PÁGINAS DEDICADAS À FOTOMETRIA FACIAL — UMA POR VISTA (FRENTE / PERFIL)
    const paginasFacial = [
        { dados: facialFrenteImgData, titulo: 'Traçado Fotométrico Facial — Vista de Frente', nota: 'Marcos da linha média, planos horizontais (bipupilar, bizigomático, bucal e interalar) e proporções faciais.' },
        { dados: facialPerfilImgData, titulo: 'Traçado Fotométrico Facial — Vista de Perfil', nota: 'Sequência do perfil mole e linha de referência Gl–Pg\'.' }
    ];
    for (const pagina of paginasFacial) {
        if (!pagina.dados) continue;
        let dimF = await obterDimensoesImagem(pagina.dados);
        let estiloF = estiloImgSeguro(dimF.w, dimF.h);
        pdfHtml += `
            <div style="page-break-before: always; page-break-inside: avoid; width:100%; display:block;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; text-align:left; margin-bottom:10px;">${++secNum}. ${pagina.titulo}</h3>
                <span style="color:#475569; font-size:9.5pt; display:block; margin-bottom:10px; text-align:left;">${pagina.nota}</span>
                <img src="${pagina.dados}" style="${estiloF} border:1px solid #cbd5e1; border-radius:4px;">
            </div>
        `;
    }

    // PÁGINAS DO REPOSITÓRIO ICONOGRÁFICO — UMA FOTO POR PÁGINA, TÍTULO FUNDIDO NA IMAGEM
    if (Object.keys(appState.imagensPaciente).length > 0) {
        let repositorio = appState.imagensPaciente;
        let keys = Object.keys(repositorio);
        secNum++;
        let secRepositorio = secNum;
        
        pdfHtml += `
            <div style="page-break-before: always;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:6px;">${secRepositorio}. Repositório Iconográfico Geral</h3>
                <p style="font-size:9pt; color:#64748b; margin:0 0 10px 0;">${keys.length} imagem(ns) registada(s) neste processo clínico.</p>
            </div>
        `;
        
        // Compor título + imagem num único canvas para cada foto (inseparáveis no PDF)
        for (let idx = 0; idx < keys.length; idx++) {
            let key = keys[idx];
            let labelCard = document.querySelector(`label[for="${key}"]`);
            let txt = labelCard ? labelCard.innerText.trim() : "Exame Clínico Registado";
            let tituloCompleto = `${secRepositorio}.${idx+1} — ${txt}`;

            // Gera imagem composta (barra de título + foto num único base64)
            let imgComposta = await gerarImagemComTitulo(repositorio[key], tituloCompleto);
            let dim = await obterDimensoesImagem(imgComposta);
            // Para a imagem composta usar toda a área útil da página (sem reserva para título — já está dentro)
            let estiloFoto = estiloImgSeguro(dim.w, dim.h, 170, 243);

            pdfHtml += `
                <div style="page-break-before: always; page-break-inside: avoid; width:100%; box-sizing:border-box; padding:0; margin:0; text-align:center;">
                    <img src="${imgComposta}" style="${estiloFoto}">
                </div>
            `;
        }
    }

    element.innerHTML = pdfHtml;

    // Configurações para A4 sem cortes de imagem
    const opt = {
        margin: [12, 12, 12, 12], 
        filename: `Dossie_Ortodontico_Final_${cod}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            scrollY: 0, 
            logging: false,
            allowTaint: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
}

// ==========================================================================
// SINCRONIZAÇÃO COM GOOGLE DRIVE (appDataFolder) — backup de todos os pacientes
// Espelha o mesmo mecanismo usado pelo recovery.html: mesmo nome de ficheiro,
// mesmo esquema de encriptação (PBKDF2 150000 + AES-GCM 256), para que o
// recovery.html consiga sempre ler o que aqui é escrito.
// ==========================================================================
