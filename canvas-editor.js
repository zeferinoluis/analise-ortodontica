// ==========================================================================
// CANVAS EDITOR — colocação, arraste e remoção de marcos anatómicos,
// calibração da régua, tooltip de descrição e desenho do traçado no canvas.
// ==========================================================================

function mostrarDescricaoPonto(id) {
    const el = document.getElementById('descricao-ponto-ativo');
    if (!el) return;
    const cfg = (configuracaoPontos[appState.tipoEstudo] || []).find(p => p.id === id);
    if (!cfg) { el.innerHTML = 'Selecione ou passe o rato sobre um marco para ver a descrição.'; return; }
    el.innerHTML = `<strong>${cfg.nome}</strong><br>${cfg.desc || 'Sem descrição disponível.'}`;
}

function restaurarDescricaoPontoAtivo() {
    if (appState.selectedPointName) mostrarDescricaoPonto(appState.selectedPointName);
    else mostrarDescricaoPonto(null);
}

function renderizarListaPontosDinamica() {
    if (appState.tipoEstudo === 'modelos') return;
    const cEstudo = appState.estudosImagens[appState.tipoEstudo];
    const lista = document.getElementById('lista-pontos-dinamica');
    if (!lista) return;
    lista.innerHTML = '';
    configuracaoPontos[appState.tipoEstudo].forEach(p => {
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
    const cEstudo = appState.estudosImagens[appState.tipoEstudo];
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
    let cEstudo = appState.estudosImagens[appState.tipoEstudo];
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
    let cEstudo = appState.estudosImagens[appState.tipoEstudo];

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
    const cEstudo = appState.estudosImagens[appState.tipoEstudo];
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
    const cEstudo = appState.estudosImagens[appState.tipoEstudo];
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
        const cfg = (configuracaoPontos[appState.tipoEstudo] || []).find(p => p.id === idProximo);
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
        const pilha = historicoEstados[appState.tipoEstudo];
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
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let cEstudo = appState.estudosImagens[appState.tipoEstudo];
    
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
        const v = (k) => pts[k] ? { x: pts[k].x*cEstudo.escalaVisual, y: pts[k].y*cEstudo.escalaVisual } : null;
        if(pts.S && pts.N) drawLine(v('S'), v('N'), '#0284c7');
        if(pts.N && pts.A) drawLine(v('N'), v('A'), '#16a34a');
        if(pts.N && pts.B) drawLine(v('N'), v('B'), '#e11d48');
        if(pts.Go && pts.Gn) drawLine(v('Go'), v('Gn'), '#ea580c');
        if(pts.Or && pts.Po) drawLine(v('Or'), v('Po'), '#7c3aed');
        if(pts.U1a && pts.U1i) drawLine(v('U1a'), v('U1i'), '#0891b2');
        if(pts.L1a && pts.L1i) drawLine(v('L1a'), v('L1i'), '#0891b2');
        calcularCefalometriaAvancada();
    } else if (appState.tipoEstudo === 'facial') { calcularAnaliseFacial(); }
}

// Constrói uma linha de resultado padronizada {grupo, label, valor, norma, status, texto}
