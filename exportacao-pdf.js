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

            if (chaveEstudo === 'cefalometria') {
                if(p.S && p.N) drawLine({x:p.S.x,y:p.S.y},{x:p.N.x,y:p.N.y},'#0284c7',vCtx);
                if(p.N && p.A) drawLine({x:p.N.x,y:p.N.y},{x:p.A.x,y:p.A.y},'#16a34a',vCtx);
                if(p.N && p.B) drawLine({x:p.N.x,y:p.N.y},{x:p.B.x,y:p.B.y},'#e11d48',vCtx);
                if(p.Go && p.Gn) drawLine({x:p.Go.x,y:p.Go.y},{x:p.Gn.x,y:p.Gn.y},'#ea580c',vCtx);
                if(p.Or && p.Po) drawLine({x:p.Or.x,y:p.Or.y},{x:p.Po.x,y:p.Po.y},'#7c3aed',vCtx);
                if(p.U1a && p.U1i) drawLine({x:p.U1a.x,y:p.U1a.y},{x:p.U1i.x,y:p.U1i.y},'#0891b2',vCtx);
                if(p.L1a && p.L1i) drawLine({x:p.L1a.x,y:p.L1a.y},{x:p.L1i.x,y:p.L1i.y},'#0891b2',vCtx);
            } else if (chaveEstudo === 'facial') {
                if(p.Tr && p.Na) drawLine({x:p.Tr.x,y:p.Tr.y},{x:p.Na.x,y:p.Na.y},'#0284c7',vCtx);
                if(p.Na && p.Sn) drawLine({x:p.Na.x,y:p.Na.y},{x:p.Sn.x,y:p.Sn.y},'#16a34a',vCtx);
                if(p.Sn && p.Me) drawLine({x:p.Sn.x,y:p.Sn.y},{x:p.Me.x,y:p.Me.y},'#e11d48',vCtx);
                if(p.Prn && p.Sn) drawLine({x:p.Prn.x,y:p.Prn.y},{x:p.Sn.x,y:p.Sn.y},'#0891b2',vCtx);
                if(p.Sn && p.Ls) drawLine({x:p.Sn.x,y:p.Sn.y},{x:p.Ls.x,y:p.Ls.y},'#0891b2',vCtx);
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
    let cefaloImgData = await gerarCanvasVirtualFundidoAsync('cefalometria');
    let facialImgData = await gerarCanvasVirtualFundidoAsync('facial');

    const nomeSafe = escaparHTML(nome);
    const codSafe = escaparHTML(cod);
    const indicacoesSafe = escaparHTML(document.getElementById('indicacoes-gerais').value);
    const anomaliasSafe = escaparHTML(document.getElementById('anomalias-obs').value);

    let m = appState.dadosModelosBackup;
    let boltonAnt = (m.sInf6 / m.sSup6) * 100;
    let korkhausEsp = (m.sSup4 * 100) / 81;
    let ashley = (m.dPm / m.s10) * 100;
    let discEspaco = m.perimetro - m.s10;

    const tipoAnaliseSelect = document.getElementById('tipo-analise-cefalo');
    const tipoAnaliseAtual = tipoAnaliseSelect ? tipoAnaliseSelect.value : 'steiner';
    const nomesAnalise = { steiner: 'Steiner', downs: 'Downs', tweed: 'Tweed', todas: 'Todas as Análises' };
    let linhasCefalo = calcularResultadosCefalometricosCompleto(tipoAnaliseAtual);
    let linhasFaciais = calcularResultadosFaciaisCompleto();

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
        </div>
    `;

    // Estados clínicos calculados com a MESMA lógica do ecrã (nunca texto fixo)
    const stBolton = Math.abs(boltonAnt - 77.2) <= 1.6;
    const stKorkhaus = !(m.dPm < korkhausEsp);
    const stAshley = !(ashley < 43);
    const stEspaco = !(discEspaco < 0);
    const corOK = '#16a34a', corDev = '#dc2626';

    let blocoModelos;
    if (appState.modelosRegistados) {
        blocoModelos = `
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:20px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Métrica / Parâmetro</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Computado</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Norma de Referência</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Status Clínico</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">Bolton Anterior</td><td style="padding:6px; border:1px solid #cbd5e1;">${boltonAnt.toFixed(1)}%</td><td style="padding:6px; border:1px solid #cbd5e1;">77.2% ± 1.6%</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${stBolton?corOK:corDev};">${stBolton?'Normal':'Discrepância de Massa Dentária'}</td></tr>
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">Korkhaus (Largura Alvo)</td><td style="padding:6px; border:1px solid #cbd5e1;">${korkhausEsp.toFixed(1)} mm</td><td style="padding:6px; border:1px solid #cbd5e1;">Real PM: ${m.dPm}mm</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${stKorkhaus?corOK:corDev};">${stKorkhaus?'OK':'Atresia'}</td></tr>
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">Ashley Howe (Índice Basal)</td><td style="padding:6px; border:1px solid #cbd5e1;">${ashley.toFixed(1)}%</td><td style="padding:6px; border:1px solid #cbd5e1;">43.0%</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${stAshley?corOK:corDev};">${stAshley?'OK':'Estreitamento'}</td></tr>
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">TSALD / Careys / Nance</td><td style="padding:6px; border:1px solid #cbd5e1;">${discEspaco.toFixed(1)} mm</td><td style="padding:6px; border:1px solid #cbd5e1;">0.0 mm</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${stEspaco?corOK:corDev};">${stEspaco?'Sobra de Espaço':'Apinhamento'}</td></tr>
                </tbody>
            </table>`;
    } else {
        blocoModelos = `<p style="font-size:9.5pt; background:#f8fafc; padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin-bottom:20px;">Análise de modelos não registada para este paciente. (Para incluir, preencha os dados na Análise Digital → Análise de Modelos e prima "Guardar Modelos".)</p>`;
    }

    pdfHtml += `
        <div style="page-break-before: always; page-break-inside: avoid !important;">
            <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px;">${++secNum}. Análise Quantitativa de Modelos de Estudo</h3>
            ${blocoModelos}

            <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px; margin-top:25px;">${++secNum}. Resultados da Análise Facial</h3>
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:15px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Parâmetro</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Medido</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Norma</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Status</th>
                    </tr>
                </thead>
                <tbody>${renderizarTabelaResultadosPDF(linhasFaciais)}</tbody>
            </table>
            
            <p style="font-size:9.5pt; background:#f8fafc; padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin:0; margin-top:15px;"><strong>Conclusões & Anomalias Detetadas:</strong><br>${anomaliasSafe || 'Sem notas adicionais inseridas.'}</p>
        </div>
    `;

    // PÁGINA DEDICADA EXCLUSIVA PARA A CEFALOMETRIA
    if (cefaloImgData) {
        let dimC = await obterDimensoesImagem(cefaloImgData);
        let estiloC = estiloImgSeguro(dimC.w, dimC.h);
        pdfHtml += `
            <div style="page-break-before: always; page-break-inside: avoid; width:100%; display:block;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; text-align:left; margin-bottom:10px;">${++secNum}. Cefalometria Radiográfica Computadorizada</h3>
                <span style="color:#475569; font-size:9.5pt; display:block; margin-bottom:10px; text-align:left;">Camada de vetores sagitais em píxeis absolutos nativos da telerradiografia.</span>
                <img src="${cefaloImgData}" style="${estiloC} border:1px solid #cbd5e1; border-radius:4px;">
            </div>
        `;
    }

    // PÁGINA DEDICADA EXCLUSIVA PARA A FOTOMETRIA FACIAL
    if (facialImgData) {
        let dimF = await obterDimensoesImagem(facialImgData);
        let estiloF = estiloImgSeguro(dimF.w, dimF.h);
        pdfHtml += `
            <div style="page-break-before: always; page-break-inside: avoid; width:100%; display:block;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; text-align:left; margin-bottom:10px;">${++secNum}. Traçado Fotométrico Facial</h3>
                <span style="color:#475569; font-size:9.5pt; display:block; margin-bottom:10px; text-align:left;">Marcos e proporções faciais mapeados digitalmente.</span>
                <img src="${facialImgData}" style="${estiloF} border:1px solid #cbd5e1; border-radius:4px;">
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
