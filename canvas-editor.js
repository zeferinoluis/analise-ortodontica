// ==========================================================================
// CANVAS EDITOR — colocação, arraste e remoção de marcos anatómicos,
// calibração da régua, tooltip de descrição e desenho do traçado no canvas.
// ==========================================================================

function mostrarDescricaoPonto(id) {
    const el = document.getElementById('descricao-ponto-ativo');
    if (!el) return;
    const cfg = (configuracaoPontos[chaveEstudoAtual()] || []).find(p => p.id === id);
    if (!cfg) { el.innerHTML = 'Selecione ou passe o rato sobre um marco para ver a descrição.'; return; }
    el.innerHTML = `<strong>${cfg.nome}</strong><br>${cfg.desc || 'Sem descrição disponível.'}`;
}

function restaurarDescricaoPontoAtivo() {
    if (appState.selectedPointName) mostrarDescricaoPonto(appState.selectedPointName);
    else mostrarDescricaoPonto(null);
}

function renderizarListaPontosDinamica() {
    if (appState.tipoEstudo === 'modelos') return;
    const cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    const lista = document.getElementById('lista-pontos-dinamica');
    if (!lista) return;
    lista.innerHTML = '';
    (configuracaoPontos[chaveEstudoAtual()] || []).forEach(p => {
        const colocado = !!(cEstudo && cEstudo.pontos[p.id]);
        const linha = document.createElement('div');
        linha.className = 'ponto-linha';
        const btn = document.createElement('button');
        btn.className = 'point-btn' + (appState.selectedPointName === p.id ? ' active' : '');
        btn.id = `pt-${p.id}`;
        btn.textContent = p.nome;
        btn.onclick = () => selectPoint(p.id);
        btn.onmouseenter = () => mostrarDescricaoPonto(p.id);
        btn.onmouseleave = () => restaurarDescricaoPontoAtivo();
        linha.appendChild(btn);
        if (colocado) {
            const del = document.createElement('button');
            del.className = 'point-del-btn';
            del.title = 'Apagar este ponto';
            del.textContent = '×';
            del.onclick = (e) => { e.stopPropagation(); apagarPonto(p.id); };
            linha.appendChild(del);
        }
        lista.appendChild(linha);
    });
}

function apagarPonto(id) {
    const cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    if (!cEstudo || !cEstudo.pontos[id]) return;
    guardarEstadoParaUndo();
    cEstudo.pontos[id] = null;
    if (appState.selectedPointName === id) appState.selectedPointName = null;
    redrawCanvas();
    renderizarListaPontosDinamica();
    restaurarDescricaoPontoAtivo();
}

function selectPoint(pName) {
    appState.isCalibrating = false; appState.selectedPointName = pName;
    document.querySelectorAll('.point-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`pt-${pName}`).classList.add('active');
    mostrarDescricaoPonto(pName);
}

function startCalibration() {
    let cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    if (!cEstudo || !cEstudo.src) { alert('Carregue primeiro uma imagem antes de calibrar a régua.'); return; }
    appState.isCalibrating = true; appState.calibrationPoints = [];
    alert('Calibração: marque 2 pontos com 10mm reais de distância entre si.');
}

canvas.style.touchAction = 'none';

function coordenadasCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// Devolve o id do ponto já colocado mais próximo de (x,y) em coordenadas de ecrã, dentro do raio de deteção
function encontrarPontoProximo(x, y, cEstudo) {
    const raioDeteccao = 16;
    let maisProximo = null, menorDist = raioDeteccao;
    for (let id in cEstudo.pontos) {
        const p = cEstudo.pontos[id];
        if (!p) continue;
        const vx = p.x * cEstudo.escalaVisual, vy = p.y * cEstudo.escalaVisual;
        const d = Math.hypot(vx - x, vy - y);
        if (d < menorDist) { menorDist = d; maisProximo = id; }
    }
    return maisProximo;
}

let arrastandoPonto = null;
let pontoArrastadoMoveu = false;
let ignorarProximoClique = false;

canvas.addEventListener('click', function(e) {
    // O navegador dispara sempre um 'click' sintético depois do pointerup, mesmo após um arraste.
    // Esta flag é ligada no pointerdown assim que se agarra um ponto existente, para o clique seguinte ser ignorado.
    if (ignorarProximoClique) { ignorarProximoClique = false; return; }
    const { x, y } = coordenadasCanvas(e);
    let cEstudo = appState.estudosImagens[chaveEstudoAtual()];

    if (appState.isCalibrating) {
        appState.calibrationPoints.push({x, y});
        // Marca visual do ponto de calibração
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#eab308'; ctx.fill();
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
        if (appState.calibrationPoints.length === 2) {
            let dx = appState.calibrationPoints[1].x - appState.calibrationPoints[0].x;
            let dy = appState.calibrationPoints[1].y - appState.calibrationPoints[0].y;
            let distPx = Math.sqrt(dx*dx + dy*dy);
            if (distPx < 5) {
                appState.isCalibrating = false; redrawCanvas();
                alert('Pontos demasiado próximos — calibração cancelada. Tente novamente.');
                return;
            }
            guardarEstadoParaUndo();
            cEstudo.scalePxPerMm = (distPx / cEstudo.escalaVisual) / 10;
            appState.isCalibrating = false;
            redrawCanvas();
            alert('Régua calibrada!');
        }
        return;
    }
    if (appState.selectedPointName) {
        guardarEstadoParaUndo();
        cEstudo.pontos[appState.selectedPointName] = { x: x / cEstudo.escalaVisual, y: y / cEstudo.escalaVisual };
        document.getElementById(`pt-${appState.selectedPointName}`).classList.remove('active');
        appState.selectedPointName = null; redrawCanvas();
        renderizarListaPontosDinamica();
        restaurarDescricaoPontoAtivo();
    }
});

// Arrastar (mover) um ponto já colocado — só ativo quando não se está a colocar um novo ponto nem a calibrar
canvas.addEventListener('pointerdown', function(e) {
    if (appState.isCalibrating || appState.selectedPointName) return;
    const { x, y } = coordenadasCanvas(e);
    const cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    if (!cEstudo) return;
    const idProximo = encontrarPontoProximo(x, y, cEstudo);
    if (!idProximo) return;
    guardarEstadoParaUndo();
    arrastandoPonto = idProximo;
    pontoArrastadoMoveu = false;
    ignorarProximoClique = true;
    canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', function(e) {
    const { x, y } = coordenadasCanvas(e);
    const cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    if (!cEstudo) return;

    if (arrastandoPonto) {
        cEstudo.pontos[arrastandoPonto] = { x: x / cEstudo.escalaVisual, y: y / cEstudo.escalaVisual };
        pontoArrastadoMoveu = true;
        redrawCanvas();
        return;
    }

    // Tooltip de descrição ao passar o rato sobre um ponto já colocado (só com rato — em toque usa-se o painel lateral)
    const tooltip = document.getElementById('canvas-point-tooltip');
    if (!tooltip || e.pointerType !== 'mouse' || appState.isCalibrating) return;
    const idProximo = encontrarPontoProximo(x, y, cEstudo);
    if (idProximo) {
        const cfg = (configuracaoPontos[chaveEstudoAtual()] || []).find(p => p.id === idProximo);
        tooltip.innerHTML = cfg ? `<strong>${cfg.nome}</strong><br>${cfg.desc || ''}` : '';
        tooltip.style.left = (x + 14) + 'px';
        tooltip.style.top = (y - 12) + 'px';
        tooltip.style.display = 'block';
        canvas.style.cursor = 'grab';
    } else {
        tooltip.style.display = 'none';
        canvas.style.cursor = appState.selectedPointName ? 'crosshair' : 'default';
    }
});

canvas.addEventListener('pointerup', function(e) {
    if (!arrastandoPonto) return;
    if (!pontoArrastadoMoveu) {
        // não houve movimento real — remove o snapshot de undo desnecessário
        const pilha = historicoEstados[chaveEstudoAtual()];
        if (pilha.length) pilha.pop();
        atualizarBotoesUndoRedo();
    } else {
        renderizarListaPontosDinamica();
    }
    arrastandoPonto = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
});

canvas.addEventListener('pointerleave', function() {
    const tooltip = document.getElementById('canvas-point-tooltip');
    if (tooltip) tooltip.style.display = 'none';
});

function drawLine(p1, p2, color, targetCtx = ctx) { targetCtx.beginPath(); targetCtx.moveTo(p1.x, p1.y); targetCtx.lineTo(p2.x, p2.y); targetCtx.strokeStyle = color; targetCtx.lineWidth = 4; targetCtx.stroke(); }

// ==========================================================================
// PLANOS DE REFERÊNCIA CEFALOMÉTRICOS — sobrepostos ao traçado para que o clínico
// veja exatamente as linhas a partir das quais cada ângulo é medido.
// Ativa-se/desativa-se com a caixa "Planos de referência" no painel lateral.
//   SN (azul)                    → base de Steiner (SNA, SNB, SN-GoGn)
//   Plano de Frankfort Or–Po (verde-azul) → base de Downs e Tweed
//   Plano mandibular Go–Gn (laranja)→ SN-GoGn, FMA, IMPA
//   Linha NA (verde) / NB (vermelha) → U1-NA / L1-NB (linhas de referência)
//   Eixo do incisivo (ciano tracejado) → U1-NA, L1-NB, FMIA, IMPA
//   Linha S-Gn (violeta tracejado) → eixo Y de Downs
//   Linha N-Pg (rosa tracejado)    → ângulo facial e convexidade
// ==========================================================================
const PLANOS_REFERENCIA = [
    { id: 'sn', rotulo: 'SN (Sela-Násio)', cor: '#0284c7', pontos: ['S', 'N'], tracejado: false },
    { id: 'fh', rotulo: 'Frankfort (Or-Po)', cor: '#0d9488', pontos: ['Or', 'Po'], tracejado: false },
    { id: 'mp', rotulo: 'Plano mandibular (Go-Gn)', cor: '#ea580c', pontos: ['Go', 'Gn'], tracejado: false },
    { id: 'na', rotulo: 'NA', cor: '#16a34a', pontos: ['N', 'A'], tracejado: true },
    { id: 'nb', rotulo: 'NB', cor: '#e11d48', pontos: ['N', 'B'], tracejado: true },
    { id: 'sgn', rotulo: 'S-Gn (eixo Y)', cor: '#7c3aed', pontos: ['S', 'Gn'], tracejado: true },
    { id: 'npg', rotulo: 'N-Pg (plano facial)', cor: '#db2777', pontos: ['N', 'Pg'], tracejado: true }
];

function alternarPlanosReferencia() {
    appState.mostrarPlanosReferencia = !appState.mostrarPlanosReferencia;
    const caixa = document.getElementById('chk-planos-referencia');
    if (caixa) caixa.checked = appState.mostrarPlanosReferencia;
    redrawCanvas();
}

// Estende a linha entre dois pontos para além de ambos (usado nos planos e eixos)
function estenderLinha(p1, p2, margem) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const norma = Math.hypot(dx, dy) || 1;
    const ux = dx / norma, uy = dy / norma;
    return [
        { x: p1.x - ux * margem, y: p1.y - uy * margem },
        { x: p2.x + ux * margem, y: p2.y + uy * margem }
    ];
}

// Alguns contextos 2D mínimos (ou ambientes de teste) não expõem save/restore;
// a proteção evita que uma falha aí impeça o desenho do resto do traçado.
function guardarEstadoCtx(c) { if (c && typeof c.save === 'function') c.save(); }
function restaurarEstadoCtx(c) { if (c && typeof c.restore === 'function') c.restore(); }
function usarTracejado(c, padrao) { if (c && typeof c.setLineDash === 'function') c.setLineDash(padrao); }
function molduraCtx(c, x, y, l, a) { if (c && typeof c.strokeRect === 'function') c.strokeRect(x, y, l, a); }
function larguraTextoCtx(c, texto, alternativa) {
    if (c && typeof c.measureText === 'function') { const m = c.measureText(texto); if (m && typeof m.width === 'number') return m.width; }
    return String(texto).length * alternativa;
}

function desenharLinhaGuia(p1, p2, cor, tracejado, largura, ctxAlvo) {
    const c = ctxAlvo || ctx;
    guardarEstadoCtx(c);
    c.beginPath();
    usarTracejado(c, tracejado ? [12, 8] : []);
    c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y);
    c.strokeStyle = cor; c.lineWidth = largura; c.stroke();
    restaurarEstadoCtx(c);
}

// Etiqueta com fundo claro, sempre dentro do canvas (para os planos ficarem identificáveis)
function desenharEtiqueta(texto, x, y, cor, ctxAlvo) {
    const c = ctxAlvo || ctx;
    guardarEstadoCtx(c);
    c.font = 'bold 15px sans-serif';
    const largura = larguraTextoCtx(c, texto, 8) + 10;
    const altura = 20;
    let px = x, py = y;
    if (px + largura > canvas.width) px = canvas.width - largura - 2;
    if (px < 2) px = 2;
    if (py - altura < 2) py = altura + 2;
    if (py > canvas.height - 2) py = canvas.height - 2;
    c.fillStyle = 'rgba(255,255,255,0.82)';
    c.fillRect(px, py - altura, largura, altura);
    c.fillStyle = cor;
    c.textBaseline = 'alphabetic';
    c.fillText(texto, px + 5, py - 5);
    restaurarEstadoCtx(c);
}

function desenharLegendaPlanos(linhas, ctxAlvo) {
    const c = ctxAlvo || ctx;
    const itens = linhas.filter(l => l.disponivel);
    if (!itens.length) return;
    const largura = 300, alturaLinha = 20, altura = itens.length * alturaLinha + 12;
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillRect(6, 6, largura, altura);
    c.strokeStyle = '#94a3b8'; c.lineWidth = 1;
    molduraCtx(c, 6, 6, largura, altura);
    c.font = 'bold 13px sans-serif';
    itens.forEach((item, i) => {
        const y = 6 + 12 + i * alturaLinha;
        c.beginPath();
        usarTracejado(c, item.tracejado ? [6, 4] : []);
        c.moveTo(14, y); c.lineTo(52, y);
        c.strokeStyle = item.cor; c.lineWidth = 4; c.stroke();
        usarTracejado(c, []);
        c.fillStyle = '#0f172a';
        c.fillText(item.rotulo, 60, y + 5);
    });
    restaurarEstadoCtx(c);
}

// Desenha, no contexto indicado, os planos/eixos e os arcos dos ângulos principais.
// Usado tanto no canvas do ecrã como no canvas virtual do PDF.
function desenharPlanosReferencia(v, cEstudo, ctxAlvo, comRotulos) {
    const rotular = comRotulos !== false;
    const c = ctxAlvo || ctx;
    const pts = cEstudo.pontos;
    const temTodos = (...ids) => ids.every(id => !!pts[id]);
    const L = (k) => v(k);

    // 1) Planos e linhas de referência, estendidos para lá dos pontos que os definem
    const linhas = PLANOS_REFERENCIA.map(plano => Object.assign({}, plano, {
        disponivel: temTodos.apply(null, plano.pontos),
        a: temTodos.apply(null, plano.pontos) ? L(plano.pontos[0]) : null,
        b: temTodos.apply(null, plano.pontos) ? L(plano.pontos[1]) : null
    }));
    linhas.forEach(l => {
        if (!l.disponivel) return;
        const [a, b] = estenderLinha(l.a, l.b, 45);
        desenharLinhaGuia(a, b, l.cor, l.tracejado, 2.5, c);
    });

    // 2) Eixos dos incisivos, estendidos em ambos os sentidos
    ['U1', 'L1'].forEach(pref => {
        if (!temTodos(pref + 'a', pref + 'i')) return;
        const [a, b] = estenderLinha(L(pref + 'a'), L(pref + 'i'), 40);
        desenharLinhaGuia(a, b, '#0891b2', true, 3, c);
    });

    // 3) Arcos dos ângulos principais (com o valor medido por perto)
    const arcoAngulo = (vertice, p1, p2, raio, cor, rotulo) => {
        const a1 = Math.atan2(p1.y - vertice.y, p1.x - vertice.x);
        const a2 = Math.atan2(p2.y - vertice.y, p2.x - vertice.x);
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        guardarEstadoCtx(c);
        c.beginPath();
        c.arc(vertice.x, vertice.y, raio, a1, a1 + delta, delta < 0);
        c.strokeStyle = cor; c.lineWidth = 3; c.stroke();
        restaurarEstadoCtx(c);
        const meio = a1 + delta / 2;
        desenharEtiqueta(rotulo, vertice.x + Math.cos(meio) * (raio + 10) - 18, vertice.y + Math.sin(meio) * (raio + 10) + 6, cor, c);
    };

    if (rotular) {
    if (temTodos('S', 'N', 'A')) arcoAngulo(L('N'), L('S'), L('A'), 62, '#0284c7', 'SNA ' + obterAngulo(pts.S, pts.N, pts.A).toFixed(1) + '°');
    if (temTodos('S', 'N', 'B')) arcoAngulo(L('N'), L('S'), L('B'), 78, '#e11d48', 'SNB ' + obterAngulo(pts.S, pts.N, pts.B).toFixed(1) + '°');
    if (temTodos('S', 'N', 'Go', 'Gn')) {
        arcoAngulo(L('Go'), L('S'), L('Gn'), 60, '#ea580c', 'SN-GoGn ' + anguloEntreLinhas(pts.S, pts.N, pts.Go, pts.Gn).toFixed(1) + '°');
    }
    if (temTodos('Go', 'Gn', 'L1i', 'L1a')) {
        const impa = anguloImpa(pts.L1a, pts.L1i, pts.Go, pts.Gn);
        if (impa !== null) arcoAngulo(L('L1i'), L('Go'), L('L1a'), 52, '#0f766e', 'IMPA ' + impa.toFixed(1) + '°');
    }
    }

    // 4) Perpendicular ao plano mandibular no bordo incisal inferior:
    //    é a partir dela que o IMPA é contado (90° = incisivo perpendicular)
    if (temTodos('Go', 'Gn', 'L1i')) {
        const angPlano = Math.atan2(pts.Gn.y - pts.Go.y, pts.Gn.x - pts.Go.x);
        const perp = { x: pts.L1i.x + Math.cos(angPlano - Math.PI / 2) * 60, y: pts.L1i.y + Math.sin(angPlano - Math.PI / 2) * 60 };
        desenharLinhaGuia({ x: pts.L1i.x * cEstudo.escalaVisual, y: pts.L1i.y * cEstudo.escalaVisual },
            { x: perp.x * cEstudo.escalaVisual, y: perp.y * cEstudo.escalaVisual },
            '#0f766e', true, 2, c);
    }

    // 5) Legenda das linhas desenhadas
    desenharLegendaPlanos(linhas, c);
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    const v = (k) => cEstudo.pontos[k] ? { x: cEstudo.pontos[k].x*cEstudo.escalaVisual, y: cEstudo.pontos[k].y*cEstudo.escalaVisual } : null;

    // Os planos de referência são desenhados primeiro, para ficarem por baixo dos
    // marcos e das linhas do traçado (e não esconderem os pontos anatómicos).
    if (appState.tipoEstudo === 'cefalometria' && appState.mostrarPlanosReferencia) {
        desenharPlanosReferencia(v, cEstudo, ctx);
    }

    for (let p in cEstudo.pontos) {
        if (cEstudo.pontos[p]) {
            let vx = cEstudo.pontos[p].x * cEstudo.escalaVisual;
            let vy = cEstudo.pontos[p].y * cEstudo.escalaVisual;
            ctx.beginPath(); ctx.arc(vx, vy, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#dc2626'; ctx.fill();
            ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#0f172a';
            ctx.fillText(p, vx + 8, vy - 5);
        }
    }
    if (appState.tipoEstudo === 'cefalometria') {
        let pts = cEstudo.pontos;
        if(pts.S && pts.N) drawLine(v('S'), v('N'), '#0284c7');
        if(pts.N && pts.A) drawLine(v('N'), v('A'), '#16a34a');
        if(pts.N && pts.B) drawLine(v('N'), v('B'), '#e11d48');
        if(pts.Go && pts.Gn) drawLine(v('Go'), v('Gn'), '#ea580c');
        if(pts.Or && pts.Po) drawLine(v('Or'), v('Po'), '#7c3aed');
        if(pts.U1a && pts.U1i) drawLine(v('U1a'), v('U1i'), '#0891b2');
        if(pts.L1a && pts.L1i) drawLine(v('L1a'), v('L1i'), '#0891b2');
        calcularCefalometriaAvancada();
    } else if (appState.tipoEstudo === 'facial') {
        const pts = cEstudo.pontos;
        if (chaveEstudoAtual() === 'facialFrente') {
            // Linha média vertical e proporções horizontais da vista de frente
            if (pts.Tr && pts.Gl) drawLine(v('Tr'), v('Gl'), '#0284c7');
            if (pts.Gl && pts.Sn) drawLine(v('Gl'), v('Sn'), '#0284c7');
            if (pts.Sn && pts.Me) drawLine(v('Sn'), v('Me'), '#0284c7');
            if (pts.P_D && pts.P_E) drawLine(v('P_D'), v('P_E'), '#7c3aed');
            if (pts.En_D && pts.En_E) drawLine(v('En_D'), v('En_E'), '#94a3b8');
            if (pts.Zy_D && pts.Zy_E) drawLine(v('Zy_D'), v('Zy_E'), '#ea580c');
            if (pts.Ch_D && pts.Ch_E) drawLine(v('Ch_D'), v('Ch_E'), '#e11d48');
            if (pts.Al_D && pts.Al_E) drawLine(v('Al_D'), v('Al_E'), '#16a34a');
        } else {
            // Sequência do perfil mole e linha Gl–Pg'
            if (pts.Tr && pts.Gl) drawLine(v('Tr'), v('Gl'), '#0284c7');
            if (pts.Gl && pts.Na) drawLine(v('Gl'), v('Na'), '#0284c7');
            if (pts.Na && pts.Prn) drawLine(v('Na'), v('Prn'), '#0284c7');
            if (pts.Prn && pts.Cm) drawLine(v('Prn'), v('Cm'), '#16a34a');
            if (pts.Cm && pts.Sn) drawLine(v('Cm'), v('Sn'), '#16a34a');
            if (pts.Sn && pts.Ls) drawLine(v('Sn'), v('Ls'), '#e11d48');
            if (pts.Ls && pts.Li) drawLine(v('Ls'), v('Li'), '#e11d48');
            if (pts.Li && pts.Bs) drawLine(v('Li'), v('Bs'), '#e11d48');
            if (pts.Bs && pts.PgL) drawLine(v('Bs'), v('PgL'), '#e11d48');
            if (pts.PgL && pts.Me) drawLine(v('PgL'), v('Me'), '#e11d48');
            if (pts.Me && pts.C) drawLine(v('Me'), v('C'), '#94a3b8');
            if (pts.Gl && pts.PgL) drawLine(v('Gl'), v('PgL'), '#7c3aed');

            // Linhas de referência da análise do perfil mole: horizontal pela glabela
            // (base do ângulo nasolabial e da convexidade, que são medidos em relação
            // à horizontal) e vertical pelo subnasal (referência de projeção labial).
            if (pts.Gl) {
                const gl = v('Gl');
                desenharLinhaGuia({ x: 0, y: gl.y }, { x: canvas.width, y: gl.y }, '#0ea5e9', true, 2, ctx);
            }
            if (pts.Sn) {
                const sn = v('Sn');
                desenharLinhaGuia({ x: sn.x, y: 0 }, { x: sn.x, y: canvas.height }, '#94a3b8', true, 2, ctx);
            }
        }
        calcularAnaliseFacial();
    }
}

// Constrói uma linha de resultado padronizada {grupo, label, valor, norma, status, texto}
