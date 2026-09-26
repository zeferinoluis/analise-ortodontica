// ==========================================================================
// UTILS — funções puras de geometria, formatação e renderização partilhada
// Sem dependências de estado (appState) nem de elementos DOM específicos.
// ==========================================================================

function obterAngulo(p1, p2, p3) { let ab = Math.sqrt(pow2(p2.x-p1.x)+pow2(p2.y-p1.y)); let bc = Math.sqrt(pow2(p3.x-p2.x)+pow2(p3.y-p2.y)); let ac = Math.sqrt(pow2(p3.x-p1.x)+pow2(p3.y-p1.y)); if (!ab || !bc) return 0; let cos = (pow2(ab)+pow2(bc)-pow2(ac))/(2*ab*bc); cos = Math.max(-1, Math.min(1, cos)); return (Math.acos(cos)*180)/Math.PI; }
function pow2(x) { return x*x; }
function distanciaPontos(p1, p2) { return Math.sqrt(pow2(p2.x-p1.x) + pow2(p2.y-p1.y)); }
// Ângulo (0-180°) entre a reta que passa por (a1,a2) e a reta que passa por (b1,b2), independente do vértice comum
function anguloEntreLinhas(a1, a2, b1, b2) {
    let v1 = { x: a2.x - a1.x, y: a2.y - a1.y };
    let v2 = { x: b2.x - b1.x, y: b2.y - b1.y };
    let dot = v1.x*v2.x + v1.y*v2.y;
    let mag1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
    let mag2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
    let cos = mag1 && mag2 ? dot/(mag1*mag2) : 0;
    cos = Math.max(-1, Math.min(1, cos));
    return Math.acos(cos) * 180 / Math.PI;
}
// Distância perpendicular (em px) de um ponto a uma reta definida por l1-l2
function distanciaPontoLinha(p, l1, l2) {
    let num = Math.abs((l2.y-l1.y)*p.x - (l2.x-l1.x)*p.y + l2.x*l1.y - l2.y*l1.x);
    let den = Math.sqrt(pow2(l2.y-l1.y) + pow2(l2.x-l1.x));
    return den ? num/den : 0;
}
function linhaMedida(grupo, label, valor, unidade, normaCentro, tolerancia, textoExtra) {
    let ok = Math.abs(valor - normaCentro) <= tolerancia;
    let texto = textoExtra || (ok ? 'Normal' : 'Desvio');
    return { grupo, label, valor: valor.toFixed(1) + unidade, norma: normaCentro.toFixed(1) + unidade + ' ± ' + tolerancia, status: ok ? 'status-ok' : 'status-dev', texto };
}
function linhaSemCalibragem(grupo, label, normaCentro, unidade) {
    return { grupo, label, valor: '—', norma: normaCentro.toFixed(1) + unidade, status: 'status-dev', texto: 'Calibrar régua' };
}

// --------------------------------------------------------------------------
// ÂNGULOS ENTRE EIXOS COM DIREÇÃO ANATÓMICA
//
// O ângulo entre duas retas-suporte (anguloEntreLinhas) só devolve a forma aguda
// 0–90°. Nas medições cefalométricas em que a direção tem significado clínico
// (eixos incisivos vs. planos), o valor correto é um dos dois suplementares:
// p. ex. U1–NA é 22° num incisivo vestibularizado e ~158° num retroinclinado.
//
// anguloComNorma() devolve, de entre os dois ângulos suplementares, aquele que
// está do mesmo lado da norma publicada — é a mesma medição que o método
// clássico define, independentemente de qual dos dentes está "para o outro lado".
//
//   anguloComNorma(U1i, U1a, N, A, 22)   → U1–NA angular
//   anguloComNorma(L1i, L1a, N, B, 25)   → L1–NB angular
//   anguloComNorma(Or, Po, L1i, L1a, 65) → FMIA
//   anguloComNorma(L1i, L1a, Go, Gn, 90) → IMPA
// --------------------------------------------------------------------------
function anguloComNorma(a1, a2, b1, b2, norma) {
    if (!a1 || !a2 || !b1 || !b2) return null;
    const bruto = anguloEntreLinhas(a1, a2, b1, b2); // 0–90
    return (norma > 90) ? 180 - bruto : bruto;
}

// IMPA — ângulo entre o eixo do incisivo inferior e o plano mandibular (Go–Gn),
// medido do lado proximal (para trás, na direção do ramo). As quatro coordenadas
// seguem a ordem do caminho do ângulo:  apice, bordo, Go, Gn
// Devolve ~90° num incisivo perpendicular ao plano mandibular, < 90° num incisivo
// retroinclinado e > 90° num vestibularizado. Não depende do sentido dos eixos.
function anguloImpa(apice, bordo, Go, Gn) {
    if (!apice || !bordo || !Go || !Gn) return null;
    // Direção proximal do plano mandibular (de Gn para Go = para trás)
    const angPlano = Math.atan2(Go.y - Gn.y, Go.x - Gn.x);
    // Sentido do ápice para o bordo incisal, na mesma origem angular
    const angEixo = Math.atan2(bordo.y - apice.y, bordo.x - apice.x);
    let direto = (angEixo - angPlano) * 180 / Math.PI;
    if (direto < 0) direto += 360;
    direto = direto % 360;
    return direto <= 180 ? direto : 360 - direto;
}

// Ângulo do eixo de um incisivo (ápice → bordo incisal) com uma linha de
// referência (A→B), na convenção clínica: devolve, dos dois ângulos
// suplementares, aquele que está do lado da norma publicada.
//   anguloEixoIncisivo(p.U1a, p.U1i, N, A, 22)  →  U1–NA angular
//   anguloEixoIncisivo(p.L1a, p.L1i, N, B, 25)  →  L1–NB angular
//   anguloEixoIncisivo(p.L1a, p.L1i, Or, Po, 65) →  FMIA
function anguloEixoIncisivo(apice, bordo, l1, l2, norma) {
    if (!apice || !bordo || !l1 || !l2) return null;
    const bruto = anguloEntreLinhas(apice, bordo, l1, l2); // 0–90
    const escolhido = (norma > 90) ? 180 - bruto : bruto;
    // Um incisivo e a sua referência nunca formam, na clínica, um ângulo entre
    // 90° e ~150° do "lado errado": se a norma é baixa mas o valor bruto é alto,
    // o eixo do dente aponta para o lado oposto e vale o suplemento.
    return escolhido;
}

// Calcula todas as linhas de resultado da cefalometria consoante a análise escolhida ('steiner'|'downs'|'tweed'|'todas')
function renderizarTabelaResultados(linhas, mensagemVazio) {
    if (!linhas || linhas.length === 0) return `<tr><td colspan="4">${mensagemVazio || 'Aguardando pontos...'}</td></tr>`;
    let html = ''; let grupoAtual = null;
    linhas.forEach(l => {
        if (l.grupo !== grupoAtual) {
            grupoAtual = l.grupo;
            html += `<tr><td colspan="4" style="background:#f1f5f9; font-weight:bold; color:#0284c7;">${grupoAtual}</td></tr>`;
        }
        html += `<tr><td>${l.label}</td><td>${l.valor}</td><td>${l.norma}</td><td class="${l.status}">${l.texto}</td></tr>`;
    });
    return html;
}

function escaparHTML(txt) {
    return String(txt == null ? '' : txt)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
