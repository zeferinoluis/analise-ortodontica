// ==========================================================================
// EXPORTAÇÃO PDF — geração do dossiê clínico completo (html2pdf/html2canvas)
// ==========================================================================

// Alguns textos do dossiê (por exemplo o resumo da interpretação automática
// guardada no histórico) já chegam com entidades HTML de uma escrita anterior.
// É preciso desfazê-las antes de voltar a escapar, senão o PDF mostra "&#39;".
function textoSimplesParaPDF(txt) {
    return String(txt == null ? '' : txt)
        .replace(/&#0*39;/g, "'")
        .replace(/&#0*34;/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

// Cores do status clínico, partilhadas pelas tabelas de resultados do dossiê.
const COR_STATUS_PDF = { 'status-ok': '#16a34a', 'status-dev': '#dc2626', '': '#475569' };

// Linhas de uma tabela de resultados (parâmetro, medido, norma, status), já com
// os sub-cabeçalhos de cada grupo.
function renderizarTabelaResultadosPDF(linhas) {
    if (!linhas || linhas.length === 0) {
        return `<tr><td colspan="4" style="padding:6px; border:1px solid #cbd5e1; text-align:center;">Análise não executada (pontos insuficientes).</td></tr>`;
    }
    let html = ''; let grupoAtual = null;
    linhas.forEach(l => {
        if (l.grupo !== grupoAtual) {
            grupoAtual = l.grupo;
            html += `<tr><td colspan="4" style="padding:5px 6px; border:1px solid #cbd5e1; background:#eef2f7; font-weight:bold; color:#0284c7;">${escaparHTML(grupoAtual)}</td></tr>`;
        }
        html += `<tr><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.label)}</td><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.valor) || '—'}</td><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.norma) || '—'}</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${COR_STATUS_PDF[l.status] || '#475569'};">${escaparHTML(l.texto) || '—'}</td></tr>`;
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

// Rasteriza o esquema das arcadas (SVG) para JPG, para entrar no dossier.
// O html2canvas é irregular com SVG: mesmo com largura em píxeis definida por CSS
// (e com escala 1), desenha a imagem SVG na largura nativa do viewBox (1240 px),
// ficando cortada à direita dentro da folha. Por isso o esquema é rasterizado
// aqui, para um formato de mapa de bits que o html2canvas desenha à escala
// correta. As dimensões finais (px) ficam guardadas para dimensionar a <img>.
const ESQUEMA_ARCADAS_PX = { largura: 1300, altura: 839 }; // 1300/839 ≈ 1240/800

function gerarImagemDiagramaArcadas() {
    return new Promise((resolve) => {
        try {
            let svg = svgDiagramaArcadas();
            if (!svg) return resolve(null);
            // O SVG do ecrã não traz width/height em px (senão reservava 800px de
            // altura no painel); para rasterizar é preciso dá-las explicitamente.
            svg = svg.replace(/<svg /, '<svg width="1240" height="800" ');
            const LARG = ESQUEMA_ARCADAS_PX.largura;
            const ALT = ESQUEMA_ARCADAS_PX.altura;
            const img = new Image();
            img.onload = function() {
                try {
                    const c = document.createElement('canvas');
                    c.width = LARG;
                    c.height = ALT;
                    const ctx2 = c.getContext('2d');
                    if (!ctx2) return resolve(null);
                    ctx2.fillStyle = '#ffffff';
                    ctx2.fillRect(0, 0, c.width, c.height);
                    // O SVG tem 1240x800 unidades: escala para preencher o canvas
                    ctx2.drawImage(img, 0, 0, LARG, ALT);
                    resolve(c.toDataURL('image/jpeg', 0.95));
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

// --------------------------------------------------------------------------
// GEOMETRIA DO DOSSIÊ — A4 com margens fixas (as mesmas do jsPDF, mais abaixo).
// Todas as medidas em milímetros, convertidas para píxeis CSS à razão padrão
// de 96 ppp, que é a que o browser (e o html2canvas) usa a 100% de zoom.
// --------------------------------------------------------------------------
const PDF_GEOM = (function () {
    const LARGURA = 210, ALTURA = 297, MARGEM = 12;
    const MM_PX = 96 / 25.4;
    const conteudoLarg = (LARGURA - 2 * MARGEM) * MM_PX;   // ≈ 703 px
    const conteudoAlt = (ALTURA - 2 * MARGEM) * MM_PX;     // ≈ 1032 px
    // Duas folgas evitam que o arredondamento do html2pdf empurre um bloco
    // para uma página extra: uma no limite útil e outra na largura das imagens.
    return { LARGURA, ALTURA, MARGEM, MM_PX, conteudoLarg, conteudoAlt, limiteAlt: conteudoAlt - 4 };
})();

// Largura máxima (mm) pedida a uma imagem para que nunca seja cortada na
// horizontal — independentemente do dpi interno usado por quem gera o PDF.
const PDF_LARG_IMG_MM = 172;

// Devolve <img style="..."> que caiba SEMPRE na área útil, seja qual for a
// dimensão nativa do ficheiro: o browser resolve a proporção, não uma
// constante de px-por-mm que pode não corresponder à escala final.
function estiloImagemPDF(alturaMaxMm) {
    const limite = (alturaMaxMm || PDF_GEOM.conteudoAlt / PDF_GEOM.MM_PX).toFixed(1);
    return `max-width:${PDF_LARG_IMG_MM}mm; max-height:${limite}mm; width:auto; height:auto; display:block; margin:0 auto; object-fit:contain;`;
}

// ==========================================================================
// RENDERIZADOR INTEGRAL DA VERSÃO 7.1 — PAGINAÇÃO PRÓPRIA, SEM CORTES
//
// Porque mudou: até à 7.0 o dossiê era rasterizado num único canvas e o
// html2pdf fatiava-o de N em N pixels. As quebras caíam a meio de linhas de
// texto e de linhas de tabela (análises e conclusões saíam truncadas) e a
// sobreposição de estilos do ecrã ainda colapsava tabelas.
//
// Agora: o conteúdo é construído em blocos, medido no browser e distribuído
// por páginas A4 de altura fixa. As quebras só caem entre blocos inteiros,
// pelo que nenhuma análise, linha de tabela ou conclusão fica cortada.
// ==========================================================================
async function exportarDossierClinicoCompletoPDF() {
    const nome = document.getElementById('paciente-nome').value;
    const cod = document.getElementById('paciente-id').value;

    // Se uma exportação anterior tiver ficado a meio (erro, cancelamento), remove
    // os restos do DOM para que esta geração comece sempre do zero.
    document.querySelectorAll('[data-pdf-pagina], [data-pdf-medicao]').forEach(n => n.remove());

    const elemento = document.createElement('div');
    elemento.setAttribute('data-pdf-pagina', '1');
    elemento.style.cssText = `width:${PDF_GEOM.conteudoLarg}px; max-width:${PDF_GEOM.conteudoLarg}px; margin:0 auto; font-family:Arial, Helvetica, sans-serif; color:#0f172a; background:#ffffff;`;

    // ---------------------------------------------------------------- imagens
    let cefaloImgData = await gerarCanvasVirtualFundidoAsync('cefalometria');
    let facialFrenteImgData = await gerarCanvasVirtualFundidoAsync('facialFrente');
    let facialPerfilImgData = await gerarCanvasVirtualFundidoAsync('facialPerfil');

    const nomeSafe = escaparHTML(nome);
    const codSafe = escaparHTML(cod);
    const indicacoesSafe = escaparHTML(textoSimplesParaPDF(document.getElementById('indicacoes-gerais').value));
    const anomaliasSafe = escaparHTML(textoSimplesParaPDF(document.getElementById('anomalias-obs').value));

    // Métricas de modelos: mesma função usada no ecrã (nunca fórmulas duplicadas)
    const resultadosModelos = calcularResultadosModelos();
    const desenhoArcadas = appState.modelosRegistados ? await gerarImagemDiagramaArcadas() : null;

    const tipoAnaliseSelect = document.getElementById('tipo-analise-cefalo');
    const tipoAnaliseAtual = tipoAnaliseSelect ? tipoAnaliseSelect.value : 'steiner';
    const nomesAnalise = { steiner: 'Steiner', downs: 'Downs', tweed: 'Tweed', todas: 'Todas as Análises' };
    let linhasCefalo = calcularResultadosCefalometricosCompleto(tipoAnaliseAtual);
    let relatorioFacial = calcularRelatorioFacialCompleto();

    // ------------------------------------------------------------ numeração
    let secNum = 0;
    const numSecao = () => ++secNum;

    // ------------------------------------------------------------ históricos
    // O histórico é apresentado em blocos e não numa tabela: cada consulta tem
    // um cabeçalho (data, tipo, métricas) e as observações repartidas em troços
    // pequenos. Assim uma interpretação longa atravessa páginas sem que nenhuma
    // linha seja cortada, e cada troço é uma unidade que a paginação pode mover.
    const LIMITE_CHUNK_OBS = 420;   // caracteres por troço de observações
    const MAX_LINHAS_CHUNK = 6;     // ~6 linhas de texto por troço, a 8,5pt

    // Reparte um texto comprido por troços pequenos sem partir palavras e sem
    // separar números das unidades ("40,0 mm" nunca fica dividido). Junta até
    // LIMITE_CHUNK_OBS caracteres ou MAX_LINHAS_CHUNK linhas explícitas.
    function repartirTextoEmTrocos(texto, limite, maxLinhas) {
        const paragrafos = String(texto || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        const trocos = [];
        (paragrafos.length ? paragrafos : ['—']).forEach(par => {
            const linhas = par.split('\n');
            linhas.forEach(linha => {
                const palavras = linha.split(/\s+/).filter(Boolean);
                let atual = '';
                let contagem = 0;
                palavras.forEach(pal => {
                    const junto = atual ? atual + ' ' + pal : pal;
                    if (atual && (junto.length > limite || contagem + 1 > maxLinhas)) {
                        trocos.push(atual); atual = pal; contagem = 1;
                    } else {
                        atual = junto; contagem++;
                    }
                });
                if (atual) trocos.push(atual);
            });
        });
        return trocos.length ? trocos : ['—'];
    }

    function blocoHistoricoPDF() {
        const registos = (appState.historicoConsultas || []);
        const corpo = registos.map(h => {
            const data = escaparHTML(textoSimplesParaPDF(h.data) || '—');
            const tipo = escaparHTML(textoSimplesParaPDF(h.tipo) || '—');
            const resumo = escaparHTML(textoSimplesParaPDF(h.resumo) || '—');
            const trocos = repartirTextoEmTrocos(h.obs, LIMITE_CHUNK_OBS, MAX_LINHAS_CHUNK);
            const obs = trocos.map((t, i) => {
                const extra = i < trocos.length - 1 ? 'border-bottom:none;' : '';
                return `<div style="padding:6px 8px; border:1px solid #cbd5e1; border-top:none; font-size:8.5pt; ${extra}">${escaparHTML(t).replace(/\n/g, '<br>')}</div>`;
            }).join('');
            return `<tr>
                <td style="padding:6px 8px; border:1px solid #cbd5e1; border-bottom:none; background:#f1f5f9; font-size:8.5pt; vertical-align:top;"><strong>${data}</strong> &nbsp;·&nbsp; ${tipo}</td>
            </tr>
            <tr><td style="padding:6px 8px; border:1px solid #cbd5e1; border-top:none; border-bottom:none; font-size:8.5pt; color:#334155;">${resumo}</td></tr>
            <tr><td style="padding:0; border:none;">${obs}</td></tr>`;
        }).join('');

        if (!corpo) {
            return `<p style="font-size:9.5pt; background:#f8fafc; padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin:0;">Sem registos de consultas neste processo.</p>`;
        }
        return `<table style="width:100%; border-collapse:collapse; table-layout:fixed;"><tbody>${corpo}</tbody></table>`;
    }

    // ---------------------------------------------------- tabelas de resultados
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
            html += `<tr><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.label)}</td><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.valor) || '—'}</td><td style="padding:6px; border:1px solid #cbd5e1;">${escaparHTML(l.norma) || '—'}</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:${COR_STATUS_PDF[l.status] || '#475569'};">${escaparHTML(l.texto) || '—'}</td></tr>`;
        });
        return html;
    }

    function cabecalhoTabelaPDF(colunas) {
        const th = `style="padding:6px; border:1px solid #cbd5e1; text-align:left;"`;
        return `<thead><tr style="background:#f1f5f9;">${colunas.map(c => `<th ${th}>${c}</th>`).join('')}</tr></thead>`;
    }

    // Bloco de resultados faciais de uma vista (cabeçalho + tabela), reutilizado para frente e perfil
    function blocoResultadosFacialPDF(titulo, subtitulo, linhas) {
        return `
            <h4 style="color:#0284c7; font-size:10pt; margin:0 0 4px 0;">${titulo}</h4>
            <p style="font-size:8.5pt; color:#64748b; margin:0 0 6px 0;">${subtitulo}</p>
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; table-layout:fixed;">
                ${cabecalhoTabelaPDF(['Parâmetro', 'Medido', 'Norma', 'Status'])}
                <tbody>${renderizarTabelaResultadosPDF(linhas)}</tbody>
            </table>`;
    }

    // ------------------------------------------------------------ blocos lógicos
    // Cada bloco é indivisível: é a unidade que a paginação pode mover de página,
    // por isso nenhum parágrafo, tabela ou imagem é cortado a meio.
    const blocos = [];
    const bloco = (secao, html, alturaMaxMm, dimensoes) => { blocos.push({ secao: secao || null, html: html, alturaMaxMm: alturaMaxMm || null, dimensoes: dimensoes || null }); };
    const grupo = (secao, blocosDoGrupo) => {
        blocosDoGrupo.forEach(b => blocos.push({ secao: secao, html: b.html, alturaMaxMm: b.alturaMaxMm || null, dimensoes: b.dimensoes || null }));
    };

    const titulo = (texto) => `<h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin:0;">${texto}</h3>`;
    const paragrafo = (html, extra) => `<p style="font-size:9.5pt; line-height:1.5; margin:0; ${extra || ''}">${html}</p>`;
    const aviso = (html, corFundo, corBorda, corTexto) => `<p style="font-size:9pt; background:${corFundo}; border:1px solid ${corBorda}; color:${corTexto}; padding:8px 10px; border-radius:4px; margin:0;">${html}</p>`;

    // CAIXA DE CONCLUSÕES — parte-se em parágrafos para poder atravessar páginas
    // sem nunca cortar uma linha a meio
    function blocosConclusoes(texto, secao) {
        const partes = String(texto || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        const lista = partes.length ? partes : ['Sem notas adicionais inseridas.'];
        lista.forEach((p, i) => {
            const abertura = i === 0
                ? '<strong style="display:block; margin-bottom:4px;">Conclusões &amp; Anomalias Detetadas:</strong>'
                : '';
            bloco(secao, `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-top:${i ? 'none' : '1px solid #e2e8f0'}; border-radius:${i === 0 ? '4px 4px 0 0' : (i === lista.length - 1 ? '0 0 4px 4px' : '0')}; padding:10px 12px;">
                ${abertura}${paragrafo(escaparHTML(p).replace(/\n/g, '<br>'), 'text-align:justify;')}
            </div>`);
        });
    }

    // =============================== 1 e 2. FICHA + HISTÓRICO ===============================
    bloco(null, titulo(`Dossiê Clínico de Diagnóstico Ortodôntico`) +
        `<span style="color:#64748b; font-size:9pt;">OrtoAnalytic Pro System v7.0 — Dr. Luís Zeferino</span>` +
        `<p style="font-size:10pt; line-height:1.6; margin:12px 0 0 0;">
            <strong>Paciente:</strong> ${nomeSafe} <br>
            <strong>Processo Clínico ID:</strong> ${codSafe}<br>
            <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-PT')}
        </p>`, 0);

    const secPlano = numSecao();
    grupo(secPlano, [
        { html: titulo(`${secPlano}. Plano Geral & Indicações Clínicas`) },
        { html: paragrafo(indicacoesSafe || 'Sem indicações registadas para este caso.', 'background:#f8fafc; padding:12px; border:1px solid #e2e8f0; border-radius:4px; text-align:justify;') },
    ]);

    const secHistorico = numSecao();
    grupo(secHistorico, [
        { html: titulo(`${secHistorico}. Historial de Consultas & Evolução Temporal`) },
        { html: blocoHistoricoPDF() },
    ]);

    // =============================== 3. CEFALOMETRIA ===============================
    const secCefalo = numSecao();
    const notaConvencoes = paragrafo(
        `<strong>Convenções de medição:</strong> cada análise usa o seu plano de referência clássico — Steiner: plano SN; Downs: plano de Frankfort (Or–Po); Tweed: FH com plano mandibular (Go–Gn), onde FMA = FMIA + IMPA.
        As medições angulares dos incisivos seguem a convenção clínica sobre o eixo do dente (bordo incisal → ápice): U1–NA, L1–NB e IMPA são devolvidos no intervalo 0–180° que contém a norma publicada (U1–NA 22°, L1–NB 25°, IMPA 90°).
        As medidas lineares (N-S, U1–NA e L1–NB lineares) exigem a calibração da régua; sem calibração aparecem assinaladas como tal.`,
        'font-size:8.5pt; color:#64748b; text-align:justify;');
    grupo(secCefalo, [
        { html: titulo(`${secCefalo}. Análise Cefalométrica — ${nomesAnalise[tipoAnaliseAtual] || tipoAnaliseAtual}`) },
        { html: `<table style="width:100%; border-collapse:collapse; font-size:9.5pt; table-layout:fixed;">
                ${cabecalhoTabelaPDF(['Parâmetro', 'Medido', 'Norma', 'Status'])}
                <tbody>${renderizarTabelaResultadosPDF(linhasCefalo)}</tbody>
            </table>` },
        { html: notaConvencoes },
    ]);

    // =============================== 4. MODELOS ===============================
    const secModelos = numSecao();
    const blocosModelos = [{ html: titulo(`${secModelos}. Análise Quantitativa de Modelos de Estudo`) }];
    if (appState.modelosRegistados) {
        if (resultadosModelos.avisos.length) {
            blocosModelos.push({ html: aviso(`<strong>Verificar antes de concluir:</strong><br>${resultadosModelos.avisos.map(a => '• ' + escaparHTML(a)).join('<br>')}`, '#fffbeb', '#fde68a', '#92400e') });
        }
        blocosModelos.push({ html: `<table style="width:100%; border-collapse:collapse; font-size:9.5pt; table-layout:fixed;">
                ${cabecalhoTabelaPDF(['Métrica / Parâmetro', 'Computado', 'Norma de Referência', 'Status Clínico'])}
                <tbody>${linhasModelosParaPDF(resultadosModelos.linhas)}</tbody>
            </table>` });
    } else {
        blocosModelos.push({ html: paragrafo('Análise de modelos não registada para este paciente. (Para incluir, preencha os dados na Análise Digital → Análise de Modelos e prima "Guardar Modelos".)', 'background:#f8fafc; padding:10px; border:1px solid #e2e8f0; border-radius:4px;') });
    }
    grupo(secModelos, blocosModelos);

    // =============================== 5. FACIAL ===============================
    const secFacial = numSecao();
    grupo(secFacial, [
        { html: titulo(`${secFacial}. Resultados da Análise Fotométrica Facial (Frente e Perfil)`) },
        { html: blocoResultadosFacialPDF('Vista de FRENTE — proporções e simetria', 'Terços verticais, proporções horizontais, linha bipupilar e assimetrias entre lado direito e esquerdo.', relatorioFacial.frente) },
        { html: blocoResultadosFacialPDF('Vista de PERFIL — perfil mole e terço inferior', 'Ângulos nasolabial, mentolabial e cervicomental, convexidade facial e posição do lábio superior.', relatorioFacial.perfil) },
    ]);

    // =============================== 6. CONCLUSÕES ===============================
    const secConclusoes = numSecao();
    grupo(secConclusoes, [{ html: titulo(`${secConclusoes}. Conclusões & Anomalias Detetadas`) }]);
    blocosConclusoes(anomaliasSafe, secConclusoes);

    // =============================== 7. ESQUEMA DAS LARGURAS ===============================
    if (desenhoArcadas) {
        const secEsquema = numSecao();
        grupo(secEsquema, [
            { html: titulo(`${secEsquema}. Esquema das Larguras Transversais`) },
            { html: paragrafo('Contorno de cada arco com as larguras inter-pré-molar e inter-molar medidas (linha cheia) e previstas por Korkhaus (arcada superior) e pelo índice de Pont (arcada inferior), a tracejado. Esquema proporcional às larguras introduzidas.', 'font-size:9.5pt; color:#475569;') },
            { html: `<img src="${desenhoArcadas}" style="display:block; margin:0 auto; object-fit:contain; border:1px solid #cbd5e1; border-radius:4px;">`, alturaMaxMm: 200, dimensoes: ESQUEMA_ARCADAS_PX },
        ]);
    }

    // =============================== 8+. IMAGENS (UMA POR PÁGINA) ===============================
    if (cefaloImgData) {
        const secCefaloImg = numSecao();
        grupo(secCefaloImg, [
            { html: titulo(`${secCefaloImg}. Cefalometria Radiográfica Computadorizada`) },
            { html: paragrafo('Camada de vetores sagitais em píxeis absolutos nativos da telerradiografia, com os planos de referência usados nas medições (SN, Frankfort, plano mandibular, NA/NB e eixos incisivos).', 'font-size:9.5pt; color:#475569;') },
            { html: `<img src="${cefaloImgData}" style="${estiloImagemPDF(228)} border:1px solid #cbd5e1; border-radius:4px;">`, alturaMaxMm: 228 },
        ]);
    }

    const paginasFacial = [
        { dados: facialFrenteImgData, titulo: 'Traçado Fotométrico Facial — Vista de Frente', nota: 'Marcos da linha média, planos horizontais (bipupilar, bizigomático, bucal e interalar) e proporções faciais.' },
        { dados: facialPerfilImgData, titulo: 'Traçado Fotométrico Facial — Vista de Perfil', nota: 'Sequência do perfil mole e linha de referência Gl–Pg\'.' }
    ];
    for (const pagina of paginasFacial) {
        if (!pagina.dados) continue;
        const secFacialImg = numSecao();
        grupo(secFacialImg, [
            { html: titulo(`${secFacialImg}. ${pagina.titulo}`) },
            { html: paragrafo(pagina.nota, 'font-size:9.5pt; color:#475569;') },
            { html: `<img src="${pagina.dados}" style="${estiloImagemPDF(236)} border:1px solid #cbd5e1; border-radius:4px;">`, alturaMaxMm: 236 },
        ]);
    }

    if (Object.keys(appState.imagensPaciente).length > 0) {
        const repositorio = appState.imagensPaciente;
        const keys = Object.keys(repositorio);
        const secRepositorio = numSecao();
        grupo(secRepositorio, [
            { html: titulo(`${secRepositorio}. Repositório Iconográfico Geral`) },
            { html: paragrafo(`${keys.length} imagem(ns) registada(s) neste processo clínico.`, 'font-size:9pt; color:#64748b;') },
        ]);
        for (let idx = 0; idx < keys.length; idx++) {
            const key = keys[idx];
            const labelCard = document.querySelector(`label[for="${key}"]`);
            const txt = labelCard ? labelCard.innerText.trim() : 'Exame Clínico Registado';
            const tituloCompleto = `${secRepositorio}.${idx + 1} — ${txt}`;
            // Título e foto compõem um único canvas (inseparáveis no PDF)
            const imgComposta = await gerarImagemComTitulo(repositorio[key], tituloCompleto);
            bloco(secRepositorio, `<div style="text-align:center;"><img src="${imgComposta}" style="${estiloImagemPDF(252)}"></div>`, 252);
        }
    }

    if (!blocos.length) return;

    // ------------------------------------------------------------------
    // Medição: o conteúdo é montado fora do ecrã com a MESMA largura que terá
    // no PDF e cada bloco recebe 12 px de espaço antes de si (padding, que não
    // colapsa como as margens). Esta medição é a única fonte de verdade das
    // alturas, pelo que continua correta mesmo com estilos do ecrã diferentes.
    // ------------------------------------------------------------------
    const host = document.createElement('div');
    host.setAttribute('data-pdf-medicao', '1');
    host.style.cssText = `position:fixed; left:-10000px; top:0; width:${PDF_GEOM.conteudoLarg}px; max-width:${PDF_GEOM.conteudoLarg}px; z-index:-1; pointer-events:none; background:#ffffff;`;

    const embalagem = document.createElement('div');
    embalagem.style.cssText = `width:${PDF_GEOM.conteudoLarg}px; font-family:Arial, Helvetica, sans-serif; color:#0f172a; background:#ffffff;`;
    host.appendChild(embalagem);
    document.body.appendChild(host);

    // As imagens têm de estar DESCODIFICADAS antes da medição: uma <img> ainda
    // por carregar mede 0×0 e colapsaria o bloco (era o que fazia desaparecer as
    // fotografias e o esquema das arcadas do dossiê).
    // Uma entrada POR BLOCO (null quando o bloco não tem imagem): os índices têm
    // de ficar alinhados com `blocos`, senão a imagem de um bloco seria
    // dimensionada com as medidas de outro (era o que deixava o esquema das
    // arcadas com a largura errada, cortado à direita).
    const imagensBloco = [];
    for (const b of blocos) {
        const m = String(b.html).match(/<img[^>]*\ssrc="([^"]*)"/i);
        imagensBloco.push(m ? { src: m[1], natural: await obterDimensoesImagem(m[1]) } : null);
    }

    // Dimensiona a <img> de um bloco pelo espaço útil da folha, a partir das
    // dimensões nativas já conhecidas (sem depender de a imagem estar carregada).
    const dimensionarImagemDoBloco = (raiz, dimensoes, alturaMaxMm, fixas) => {
        const im = raiz.querySelector('img');
        if (!im || !dimensoes || !dimensoes.w || !dimensoes.h) return;
        const larguraMaxMm = Math.min(PDF_LARG_IMG_MM, PDF_GEOM.conteudoLarg / PDF_GEOM.MM_PX);
        const alturaMax = Math.min(alturaMaxMm || PDF_GEOM.conteudoAlt / PDF_GEOM.MM_PX, PDF_GEOM.conteudoAlt / PDF_GEOM.MM_PX);
        let larg, alt;
        if (fixas && fixas.largura && fixas.altura) {
            // Dimensões já resolvidas (esquema das arcadas rasterizado): usar tal e qual
            larg = fixas.largura / PDF_GEOM.MM_PX;
            alt = fixas.altura / PDF_GEOM.MM_PX;
            if (larg > larguraMaxMm) { const f = larguraMaxMm / larg; larg *= f; alt *= f; }
            if (alt > alturaMax) { const f = alturaMax / alt; larg *= f; alt *= f; }
        } else {
            larg = larguraMaxMm;
            alt = larg * (dimensoes.h / dimensoes.w);
            if (alt > alturaMax) { alt = alturaMax; larg = alt * (dimensoes.w / dimensoes.h); }
        }
        // Em PÍXEIS e não em mm: o html2canvas captura a página num documento
        // clonado, onde as unidades absolutas (mm) são convertidas com outro
        // fator de escala e a imagem saía 1,4x maior, cortada à direita.
        im.style.width = `${Math.round(larg * PDF_GEOM.MM_PX)}px`;
        im.style.height = `${Math.round(alt * PDF_GEOM.MM_PX)}px`;
        im.style.maxWidth = '100%';
        im.style.maxHeight = '';
        im.style.display = 'block';
        im.style.margin = '0 auto';
        im.style.objectFit = 'contain';
    };

    const blocosDOM = [];
    blocos.forEach((b, idx) => {
        const d = document.createElement('div');
        d.setAttribute('data-pdf-bloco', '1');
        d.style.cssText = 'padding-top:12px;';
        if (b.alturaMaxMm) {
            d.style.overflow = 'hidden';
            d.style.maxHeight = `${Math.round(b.alturaMaxMm * PDF_GEOM.MM_PX)}px`;
        }
        d.innerHTML = b.html;
        const info = imagensBloco[idx];
        if (info) dimensionarImagemDoBloco(d, info.natural, b.alturaMaxMm, b.dimensoes);
        if (b.secao) d.setAttribute('data-pdf-secao', String(b.secao));
        // As imagens já estão carregadas (vêm de data URLs): basta pedir ao
        // browser que as mantenha resolvidas durante a medição e a captura.
        d.querySelectorAll('img').forEach(im => { im.decoding = 'sync'; });
        embalagem.appendChild(d);
        blocosDOM.push(d);
    });

    const topoHost = host.getBoundingClientRect().top;
    const medidas = blocosDOM.map((d, i) => {
        const r = d.getBoundingClientRect();
        return {
            topo: r.top - topoHost,
            base: r.bottom - topoHost,
            altura: r.height,
            secao: blocos[i].secao,
            html: blocos[i].html,
            alturaMaxMm: blocos[i].alturaMaxMm,
            dimensoes: blocos[i].dimensoes,
        };
    });

    // --------------------------------------------------------- paginação
    // Preenche cada folha com os blocos inteiros que couberem. A quebra cai
    // sempre no espaço entre blocos; um bloco maior do que a folha (caso raro
    // de uma tabela gigantesca) fica sozinho numa página e é cortado no limite.
    const LIMITE = PDF_GEOM.limiteAlt;
    const paginas = [];
    let cursor = 0;
    while (cursor < medidas.length) {
        const topo = medidas[cursor].topo;
        const limiteFolha = topo + LIMITE;
        let fim = cursor;
        while (fim + 1 < medidas.length && medidas[fim + 1].base <= limiteFolha) fim++;
        if (medidas[fim].base > limiteFolha) {
            // Nem o primeiro bloco cabe: fica sozinho na folha
            fim = cursor;
            paginas.push({ inicio: cursor, fim: cursor + 1, inicioCss: topo, limite: Math.min(medidas[cursor].base, limiteFolha) });
        } else {
            paginas.push({ inicio: cursor, fim: fim + 1, inicioCss: topo, limite: Math.min(medidas[fim].base, limiteFolha) });
        }
        cursor = fim + 1;
    }

    // ------------------------------------------------- construção das páginas
    // Os blocos JÁ MEDIDOS são movidos (não recriados) para as folhas: mantêm
    // exatamente a geometria medida, incluindo as imagens já carregadas (um
    // innerHTML obrigaria o browser a voltar a descodificá-las).
    elemento.style.position = 'fixed';
    elemento.style.left = '-10000px';
    elemento.style.top = '0';
    elemento.style.zIndex = '-1';
    elemento.innerHTML = '';
    document.body.appendChild(elemento);

    const paginasDOM = paginas.map(p => {
        const d = document.createElement('div');
        d.className = 'pdf-pagina';
        d.style.cssText = `width:${PDF_GEOM.conteudoLarg}px; height:${Math.round(PDF_GEOM.conteudoAlt)}px; box-sizing:border-box; background:#ffffff; overflow:hidden;`;
        for (let i = p.inicio; i < p.fim; i++) d.appendChild(blocosDOM[i]);
        elemento.appendChild(d);
        return d;
    });

    host.remove();

    // ------------------------------------------------------------------
    // Captura: cada folha é desenhada no seu próprio canvas e cortada no
    // `limite` calculado, que cai SEMPRE entre blocos — nunca a meio de uma
    // linha de texto ou de uma linha de tabela.
    // ------------------------------------------------------------------
    const FATOR = 2; // igual ao scale do html2canvas

    async function capturarPaginaCanvas(paginaEl, alturaCss) {
        const canvas = await html2canvas(paginaEl, {
            scale: FATOR,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: Math.ceil(PDF_GEOM.conteudoLarg),
            windowWidth: Math.ceil(PDF_GEOM.conteudoLarg),
        });
        const alt = Math.max(1, Math.min(canvas.height, Math.ceil(alturaCss * FATOR)));
        const destino = document.createElement('canvas');
        destino.width = canvas.width;
        destino.height = alt;
        const ctx = destino.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, destino.width, destino.height);
        ctx.drawImage(canvas, 0, 0, canvas.width, alt, 0, 0, canvas.width, alt);
        return destino.toDataURL('image/jpeg', 0.92);
    }

    const imagensPaginas = [];
    for (let i = 0; i < paginas.length; i++) {
        const p = paginas[i];
        const alturaCss = Math.max(1, p.limite - p.inicioCss);
        imagensPaginas.push(await capturarPaginaCanvas(paginasDOM[i], alturaCss));
    }
    elemento.remove();

    // ------------------------------------------------------------- escrita do PDF
    const larguraMm = PDF_GEOM.LARGURA;
    const alturaMm = PDF_GEOM.ALTURA;
    const larguraUtilMm = larguraMm - 2 * PDF_GEOM.MARGEM;
    const alturaUtilMm = alturaMm - 2 * PDF_GEOM.MARGEM;
    const ficheiro = `Dossie_Ortodontico_Final_${cod}`.replace(/[^\w.\-]+/g, '_') + '.pdf';

    if (!window.html2pdf) return;
    // O html2pdf é usado apenas como fábrica do jsPDF (a paginação e o desenho
    // das páginas são feitos aqui); precisa na mesma de um elemento de origem.
    const fonte = document.createElement('div');
    fonte.setAttribute('data-pdf-fonte', '1');
    fonte.style.display = 'none';
    document.body.appendChild(fonte);
    const trabalhador = html2pdf().set({ jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(fonte).toPdf();
    const doc = await trabalhador.get('pdf');
    fonte.remove();

    for (let i = 0; i < imagensPaginas.length; i++) {
        const p = paginas[i];
        const alturaCss = Math.max(1, p.limite - p.inicioCss);
        const alturaMmImg = Math.min(alturaUtilMm, alturaCss / PDF_GEOM.MM_PX);
        if (i > 0) doc.addPage();
        doc.addImage(imagensPaginas[i], 'JPEG', PDF_GEOM.MARGEM, PDF_GEOM.MARGEM, larguraUtilMm, alturaMmImg, undefined, 'FAST');
    }
    doc.save(ficheiro);
}

// ==========================================================================
// SINCRONIZAÇÃO COM GOOGLE DRIVE (appDataFolder) — backup de todos os pacientes
// Espelha o mesmo mecanismo usado pelo recovery.html: mesmo nome de ficheiro,
// mesmo esquema de encriptação (PBKDF2 150000 + AES-GCM 256), para que o
// recovery.html consiga sempre ler o que aqui é escrito.
// ==========================================================================
