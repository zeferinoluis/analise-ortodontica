// ==========================================================================
// FACIAL — cálculo da análise fotométrica facial em duas vistas independentes
//
//   facialFrente  → fotografia de frente: proporções verticais/horizontais,
//                   linha bipupilar e assimetrias entre lado direito e esquerdo.
//   facialPerfil  → fotografia de perfil: perfil mole e harmonia do terço
//                   inferior da face (ângulos nasolabial, mentolabial, etc.).
//
// Cada vista tem a sua própria tabela de resultados e o seu próprio relatório;
// o dossiê em PDF apresenta as duas análises, cada uma com a respetiva foto.
//
// Convenção de marcos: o sufixo _D corresponde ao lado DIREITO do paciente e
// _E ao lado ESQUERDO do paciente.
// ==========================================================================

const MENSAGEM_SEM_PONTOS_FRENTE = "Marque os marcos da fotografia de frente (pelo menos Trichion, Glabela, Subnasal e Mento para as proporções verticais).";
const MENSAGEM_SEM_PONTOS_PERFIL = "Marque os marcos da fotografia de perfil (Gl, Sn e Pg' para a convexidade; Prn, Cm/Columela e Ls para o ângulo nasolabial).";

// --------------------------------------------------------------------------
// VISTA DE FRENTE
// --------------------------------------------------------------------------
function calcularResultadosFaciaisFrente() {
    const pts = appState.estudosImagens.facialFrente.pontos;
    const linhas = [];

    // --- Proporções verticais (terços faciais) ---
    if (pts.Tr && pts.Gl && pts.Sn && pts.Me) {
        const tSup = Math.abs(pts.Gl.y - pts.Tr.y);
        const tMed = Math.abs(pts.Sn.y - pts.Gl.y);
        const tInf = Math.abs(pts.Me.y - pts.Sn.y);
        const total = tSup + tMed + tInf;
        if (total > 0) {
            const pSup = (tSup / total) * 100, pMed = (tMed / total) * 100, pInf = (tInf / total) * 100;
            linhas.push(linhaMedida('Proporções Verticais (Frente)', 'Terço Superior (Tr–Gl)', pSup, '%', 33.3, 3));
            linhas.push(linhaMedida('Proporções Verticais (Frente)', 'Terço Médio (Gl–Sn)', pMed, '%', 33.3, 3));
            linhas.push(linhaMedida('Proporções Verticais (Frente)', 'Terço Inferior (Sn–Me)', pInf, '%', 33.3, 3));
            // Relação entre o terço médio e o inferior (referência clínica ~1:1)
            const relacao = tInf ? tMed / tInf : 0;
            linhas.push(linhaMedida('Proporções Verticais (Frente)', 'Relação Terço Médio / Terço Inferior', relacao, '', 1, 0.1, Math.abs(relacao - 1) <= 0.1 ? 'Equilibrado' : (relacao > 1.1 ? 'Terço médio longo' : 'Terço inferior longo')));
        }
    }

    // --- Proporções horizontais ---
    if (pts.Zy_D && pts.Zy_E && pts.Ch_D && pts.Ch_E) {
        const largFacial = distanciaPontos(pts.Zy_D, pts.Zy_E);
        const largBucal = distanciaPontos(pts.Ch_D, pts.Ch_E);
        const ratio = largFacial ? (largBucal / largFacial) * 100 : 0;
        linhas.push(linhaMedida('Proporções Horizontais (Frente)', 'Largura Bucal / Largura Bizigomática', ratio, '%', 50.5, 5, Math.abs(ratio - 50.5) <= 5 ? 'Proporcional' : (ratio < 45.5 ? 'Boca estreita' : 'Boca larga')));
    }
    if (pts.Al_D && pts.Al_E && pts.Ch_D && pts.Ch_E) {
        const largNarinas = distanciaPontos(pts.Al_D, pts.Al_E);
        const largBucal = distanciaPontos(pts.Ch_D, pts.Ch_E);
        const ratio = largBucal ? (largNarinas / largBucal) * 100 : 0;
        linhas.push(linhaMedida('Proporções Horizontais (Frente)', 'Largura Interalar / Largura Bucal', ratio, '%', 71, 6, Math.abs(ratio - 71) <= 6 ? 'Proporcional' : (ratio < 65 ? 'Base nasal estreita' : 'Base nasal larga')));
    }
    if (pts.En_D && pts.En_E && pts.P_D && pts.P_E) {
        const distBipupilar = distanciaPontos(pts.P_D, pts.P_E);
        const distExternaOlhos = distanciaPontos(pts.En_D, pts.En_E);
        if (distBipupilar) {
            const ratio = distExternaOlhos / distBipupilar;
            linhas.push(linhaMedida('Proporções Horizontais (Frente)', 'Distância Externa dos Olhos / Bipupilar', ratio, '', 1.4, 0.15, 'Informativo'));
        }
    }

    // --- Linha bipupilar e simetria ---
    if (pts.P_D && pts.P_E) {
        const inclinacao = Math.atan2(pts.P_E.y - pts.P_D.y, pts.P_E.x - pts.P_D.x) * 180 / Math.PI;
        const desvio = Math.abs(inclinacao) <= 90 ? inclinacao : (inclinacao - 180 * Math.sign(inclinacao));
        linhas.push(linhaMedida('Linha Bipupilar e Simetria (Frente)', 'Inclinação da Linha Bipupilar (P D–P E)', desvio, '°', 0, 2, Math.abs(desvio) <= 2 ? 'Horizontal' : (desvio > 0 ? 'Lado esquerdo mais alto' : 'Lado direito mais alto')));
    }
    if (pts.Tr && pts.Me && pts.En_D && pts.En_E) {
        const linMediaX = (pts.Tr.x + pts.Me.x) / 2;
        const olhoDX = pts.P_D ? pts.P_D.x : pts.En_D.x;
        const olhoEX = pts.P_E ? pts.P_E.x : pts.En_E.x;
        const dD = Math.abs(olhoDX - linMediaX), dE = Math.abs(olhoEX - linMediaX);
        const maior = Math.max(dD, dE);
        if (maior > 0) {
            const assimetria = ((Math.max(dD, dE) - Math.min(dD, dE)) / maior) * 100;
            linhas.push(linhaMedida('Linha Bipupilar e Simetria (Frente)', 'Assimetria Ocular (linha média Tr–Me)', assimetria, '%', 0, 3, assimetria <= 3 ? 'Simétrico' : 'Assimetria — confirmar clinicamente'));
        }
    }
    if (pts.Tr && pts.Me && pts.Ch_D && pts.Ch_E) {
        const linMediaX = (pts.Tr.x + pts.Me.x) / 2;
        const dD = Math.abs(pts.Ch_D.x - linMediaX), dE = Math.abs(pts.Ch_E.x - linMediaX);
        const maior = Math.max(dD, dE);
        if (maior > 0) {
            const assimetria = ((Math.max(dD, dE) - Math.min(dD, dE)) / maior) * 100;
            linhas.push(linhaMedida('Linha Bipupilar e Simetria (Frente)', 'Assimetria da Comissura Labial', assimetria, '%', 0, 3, assimetria <= 3 ? 'Simétrico' : 'Assimetria — confirmar clinicamente'));
        }
    }
    if (pts.Tr && pts.Me && pts.Zy_D && pts.Zy_E) {
        const linMediaX = (pts.Tr.x + pts.Me.x) / 2;
        const dD = Math.abs(pts.Zy_D.x - linMediaX), dE = Math.abs(pts.Zy_E.x - linMediaX);
        const maior = Math.max(dD, dE);
        if (maior > 0) {
            const assimetria = ((Math.max(dD, dE) - Math.min(dD, dE)) / maior) * 100;
            linhas.push(linhaMedida('Linha Bipupilar e Simetria (Frente)', 'Assimetria Zigomática', assimetria, '%', 0, 3, assimetria <= 3 ? 'Simétrico' : 'Assimetria — confirmar clinicamente'));
        }
    }

    // --- Índice facial (depende da calibração da régua) ---
    const escalaFrente = appState.estudosImagens.facialFrente.scalePxPerMm;
    if (pts.Zy_D && pts.Zy_E && pts.Tr && pts.Me) {
        const larguraMm = distanciaPontos(pts.Zy_D, pts.Zy_E) / (escalaFrente || 1);
        const alturaMm = distanciaPontos(pts.Tr, pts.Me) / (escalaFrente || 1);
        if (escalaFrente) {
            linhas.push(linhaMedida('Proporções Verticais (Frente)', 'Índice Facial (Largura Bizigomática / Altura Tr–Me)', larguraMm / alturaMm, '', 0.88, 0.05));
        } else {
            linhas.push(linhaSemCalibragem('Proporções Verticais (Frente)', 'Índice Facial (Largura Bizigomática / Altura Tr–Me)', 0.88, ''));
        }
    }

    return linhas;
}

// --------------------------------------------------------------------------
// VISTA DE PERFIL
// --------------------------------------------------------------------------
function calcularResultadosFaciaisPerfil() {
    const pts = appState.estudosImagens.facialPerfil.pontos;
    const linhas = [];

    // --- Perfil mole ---
    const pontoColumela = pts.Cm || pts.Prn;
    if (pontoColumela && pts.Sn && pts.Ls) {
        const nasolabial = obterAngulo(pontoColumela, pts.Sn, pts.Ls);
        const ok = nasolabial >= 90 && nasolabial <= 110;
        linhas.push({ grupo: 'Perfil Mole (Perfil)', label: 'Ângulo Nasolabial', valor: nasolabial.toFixed(1) + '°', norma: '90° – 110°', status: ok ? 'status-ok' : 'status-dev', texto: ok ? 'Normal' : (nasolabial < 90 ? 'Fechado' : 'Aberto') });
    }
    if (pts.Gl && pts.Sn && pts.PgL) {
        const convexidade = 180 - obterAngulo(pts.Gl, pts.Sn, pts.PgL);
        linhas.push(linhaMedida('Perfil Mole (Perfil)', "Convexidade Facial (Gl–Sn–Pg')", convexidade, '°', 12, 4, Math.abs(convexidade - 12) <= 4 ? 'Perfil reto' : (convexidade > 16 ? 'Perfil convexo' : 'Perfil côncavo')));
    }
    if (pts.Gl && pts.Prn && pts.PgL) {
        const convexidadeNasal = 180 - obterAngulo(pts.Gl, pts.Prn, pts.PgL);
        linhas.push(linhaMedida('Perfil Mole (Perfil)', "Convexidade Nasal (Gl–Prn–Pg')", convexidadeNasal, '°', 12, 6, 'Informativo'));
    }

    // --- Terço inferior e harmonia labial ---
    if (pts.Sn && pts.Ls && pts.Li) {
        const anguloLabial = obterAngulo(pts.Ls, pts.Sn, pts.Li);
        linhas.push(linhaMedida('Terço Inferior e Harmonia Labial (Perfil)', 'Ângulo do Arco Labial (Sn)', anguloLabial, '°', 95, 15, 'Informativo'));
    }
    if (pts.Li && pts.PgL && pts.C && pts.Go) {
        const anguloCervicomental = 180 - obterAngulo(pts.Li, pts.PgL, pts.C, pts.Go);
        linhas.push(linhaMedida('Terço Inferior e Harmonia Labial (Perfil)', 'Ângulo Cervicomental', anguloCervicomental, '°', 110, 15, 'Informativo'));
    }
    if (pts.Li && pts.Bs && pts.PgL) {
        const mentolabial = obterAngulo(pts.Li, pts.Bs, pts.PgL);
        linhas.push(linhaMedida('Terço Inferior e Harmonia Labial (Perfil)', 'Ângulo Mentolabial (Li–Bs–Pg\')', mentolabial, '°', 130, 15, 'Informativo'));
    }
    if (pts.Sn && pts.Ls && pts.PgL) {
        const anguloLsnPg = obterAngulo(pts.Sn, pts.Ls, pts.PgL);
        linhas.push(linhaMedida('Terço Inferior e Harmonia Labial (Perfil)', "Ângulo do Lábio Superior (Sn–Ls–Pg')", anguloLsnPg, '°', 90, 15, 'Informativo'));
    }
    if (pts.Gl && pts.PgL && pts.Sn && pts.Ls) {
        // Posição sagital do lábio superior: à frente ou atrás da linha Gl–Pg'
        const dir = { x: pts.PgL.x - pts.Gl.x, y: pts.PgL.y - pts.Gl.y };
        const norma = Math.hypot(dir.x, dir.y);
        if (norma) {
            const cruz = ((pts.Ls.x - pts.Gl.x) * dir.y - (pts.Ls.y - pts.Gl.y) * dir.x) / norma;
            linhas.push(linhaMedida('Terço Inferior e Harmonia Labial (Perfil)', "Lábio Superior vs. Linha Gl–Pg'", Math.abs(cruz), 'px', 0, 0, Math.abs(cruz) <= 2 ? "Sobre a linha Gl–Pg'" : (cruz > 0 ? 'Lábio anteriorizado' : 'Lábio retruído')));
            const escala = appState.estudosImagens.facialPerfil.scalePxPerMm;
            if (escala) {
                const desvioMm = Math.abs(cruz) / escala;
                linhas.push(linhaMedida('Terço Inferior e Harmonia Labial (Perfil)', "Lábio Superior vs. Linha Gl–Pg' (mm)", desvioMm, ' mm', 0, 2, desvioMm <= 2 ? 'Próximo da linha' : (cruz > 0 ? 'Anteriorizado' : 'Retruído')));
            }
        }
    }

    // --- Proporções faciais no perfil ---
    if (pts.Tr && pts.Gl && pts.Sn && pts.Me) {
        const tSup = Math.abs(pts.Gl.y - pts.Tr.y), tMed = Math.abs(pts.Sn.y - pts.Gl.y), tInf = Math.abs(pts.Me.y - pts.Sn.y);
        const total = tSup + tMed + tInf;
        if (total > 0) {
            linhas.push(linhaMedida('Proporções Faciais (Perfil)', 'Terço Superior (Tr–Gl)', (tSup / total) * 100, '%', 33.3, 3));
            linhas.push(linhaMedida('Proporções Faciais (Perfil)', 'Terço Médio (Gl–Sn)', (tMed / total) * 100, '%', 33.3, 3));
            linhas.push(linhaMedida('Proporções Faciais (Perfil)', 'Terço Inferior (Sn–Me)', (tInf / total) * 100, '%', 33.3, 3));
        }
    }

    return linhas;
}

// Mantida por compatibilidade: devolve o relatório da vista de perfil (era a antiga análise única)
function calcularResultadosFaciaisCompleto() {
    return calcularResultadosFaciaisPerfil();
}

// Devolve as duas análises de uma só vez — usado pelo PDF e pela interpretação clínica
function calcularRelatorioFacialCompleto() {
    return {
        frente: calcularResultadosFaciaisFrente(),
        perfil: calcularResultadosFaciaisPerfil()
    };
}

// --------------------------------------------------------------------------
// RENDERIZAÇÃO NO ECRÃ — as duas tabelas, cada uma com o seu título
// --------------------------------------------------------------------------
function renderizarBlocoFacial(titulo, subtitulo, chave, linhas, mensagemVazio) {
    const temImagem = !!(appState.estudosImagens[chave] && appState.estudosImagens[chave].src);
    let html = `<div style="background:#e0f2fe; color:#0369a1; font-weight:bold; padding:7px 9px; border-radius:4px; margin-bottom:6px; font-size:0.82rem;">${titulo}<div style="font-weight:normal; color:#475569; font-size:0.72rem; margin-top:2px;">${subtitulo}</div></div>`;
    if (!temImagem && (!linhas || linhas.length === 0)) {
        html += `<div style="font-size:0.78rem; color:#94a3b8; padding:6px 2px 4px;">Sem fotografia carregada para esta vista.</div>`;
    }
    html += `<table style="margin-bottom:18px;"><tbody>${renderizarTabelaResultados(linhas, mensagemVazio)}</tbody></table>`;
    return html;
}

function calcularAnaliseFacial() {
    const frente = calcularResultadosFaciaisFrente();
    const perfil = calcularResultadosFaciaisPerfil();
    const escalaFrente = appState.estudosImagens.facialFrente.scalePxPerMm ? 'Régua calibrada' : 'Régua não calibrada';
    const escalaPerfil = appState.estudosImagens.facialPerfil.scalePxPerMm ? 'Régua calibrada' : 'Régua não calibrada';

    document.getElementById('results-tbody').innerHTML =
        renderizarBlocoFacial('ANÁLISE FACIAL — FOTO DE FRENTE', `Proporções verticais/horizontais e simetria. ${escalaFrente}.`, 'facialFrente', frente, MENSAGEM_SEM_PONTOS_FRENTE) +
        renderizarBlocoFacial('ANÁLISE FACIAL — FOTO DE PERFIL', `Perfil mole e harmonia do terço inferior. ${escalaPerfil}.`, 'facialPerfil', perfil, MENSAGEM_SEM_PONTOS_PERFIL);
}
