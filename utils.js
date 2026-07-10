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
