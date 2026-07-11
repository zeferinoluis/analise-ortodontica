// ==========================================================================
// UI — navegação por separadores, módulo clínico ativo, upload de imagens
// e registo de traçados/anomalias no histórico do paciente.
// ==========================================================================

document.getElementById('data-exame').valueAsDate = new Date();
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');
    if (tabId === 'historico') renderHistorico();
}

function atualizarInterfaceEstudo() {
    appState.tipoEstudo = document.getElementById('tipo-estudo').value;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pGrafico = document.getElementById('painel-grafico-controlos');
    const pModelos = document.getElementById('painel-modelos-controlos');
    const viewportGrafico = document.getElementById('viewport-grafico');
    const btnSalvarGrafico = document.getElementById('btn-salvar-grafico');
    const tabelaHeader = document.getElementById('table-header-dinamico');

    atualizarBotoesUndoRedo();
    atualizarRotuloInterpretacaoSugerida();

    if (appState.tipoEstudo === 'modelos') {
        pGrafico.style.display = 'none'; btnSalvarGrafico.style.display = 'none';
        viewportGrafico.style.display = 'none'; pModelos.style.display = 'block';
        tabelaHeader.innerHTML = '<tr><th>Análise de Modelo</th><th>Medido</th><th>Norma</th><th>Status</th></tr>';
        executarCalculosModelosPuros();
    } else {
        pGrafico.style.display = 'block'; btnSalvarGrafico.style.display = 'block';
        viewportGrafico.style.display = 'flex'; pModelos.style.display = 'none';
        tabelaHeader.innerHTML = '<tr><th>Parâmetro</th><th>Medido</th><th>Norma</th><th>Status</th></tr>';
        
        renderizarListaPontosDinamica();
        restaurarDescricaoPontoAtivo();

        const grupoAnalise = document.getElementById('grupo-tipo-analise-cefalo');
        if (grupoAnalise) grupoAnalise.style.display = (appState.tipoEstudo === 'cefalometria') ? 'block' : 'none';

        let cEstudo = appState.estudosImagens[appState.tipoEstudo];
        if (cEstudo.src) {
            img.src = cEstudo.src;
            img.onload = function() {
                img.style.display = 'block';
                img.style.width = (img.naturalWidth * cEstudo.escalaVisual) + 'px';
                img.style.height = (img.naturalHeight * cEstudo.escalaVisual) + 'px';
                canvas.width = img.naturalWidth * cEstudo.escalaVisual;
                canvas.height = img.naturalHeight * cEstudo.escalaVisual;
                redrawCanvas();
            }
        } else { img.style.display = 'none'; atualizarResultadosGraficosLimpos(); }
    }
}

function previewMedia(inputId) {
    const inputEl = document.getElementById(inputId);
    const file = inputEl.files[0];
    if (!file) return;
    inputEl.value = '';
    const reader = new FileReader();
    reader.onload = function(event) {
        let tempImg = new Image(); tempImg.src = event.target.result;
        tempImg.onload = function() {
            let compCanvas = document.createElement('canvas');
            let maxDim = 1600; let w = tempImg.width; let h = tempImg.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = (h * maxDim) / w; w = maxDim; } else { w = (w * maxDim) / h; h = maxDim; }
            }
            compCanvas.width = w; compCanvas.height = h;
            compCanvas.getContext('2d').drawImage(tempImg, 0, 0, w, h);
            let base64 = compCanvas.toDataURL('image/jpeg', 0.82);
            document.getElementById(`prev-${inputId}`).style.backgroundImage = `url(${base64})`;
            appState.imagensPaciente[inputId] = base64;
        }
    };
    reader.readAsDataURL(file);
}

fileInput.addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        let cEstudo = appState.estudosImagens[appState.tipoEstudo];
        cEstudo.src = event.target.result; img.src = event.target.result;
        img.onload = function() {
            img.style.display = 'block';
            cEstudo.naturalWidth = img.naturalWidth; cEstudo.naturalHeight = img.naturalHeight;
            const largMax = document.getElementById('viewport-grafico').clientWidth - 30;
            const altMax = document.getElementById('viewport-grafico').clientHeight - 30;
            cEstudo.escalaVisual = Math.min(largMax / img.naturalWidth, altMax / img.naturalHeight, 1);
            img.style.width = (img.naturalWidth * cEstudo.escalaVisual) + 'px';
            img.style.height = (img.naturalHeight * cEstudo.escalaVisual) + 'px';
            canvas.width = img.naturalWidth * cEstudo.escalaVisual; canvas.height = img.naturalHeight * cEstudo.escalaVisual;
            redrawCanvas();
        }
    }
    reader.readAsDataURL(e.target.files[0]);
});

function atualizarResultadosGraficosLimpos() { document.getElementById('results-tbody').innerHTML = `<tr><td colspan="4">Aguardando pontos...</td></tr>`; }

function salvarAnaliseAtual() {
    let resumo = "Traçado geométrico arquivado.";
    let cEstudo = appState.estudosImagens.cefalometria.pontos;
    if (appState.tipoEstudo === 'cefalometria' && cEstudo.S && cEstudo.N) {
        let snaVal = cEstudo.A ? obterAngulo(cEstudo.S, cEstudo.N, cEstudo.A) : null;
        let snbVal = cEstudo.B ? obterAngulo(cEstudo.S, cEstudo.N, cEstudo.B) : null;
        let sna = snaVal !== null ? snaVal.toFixed(1) : '-';
        let snb = snbVal !== null ? snbVal.toFixed(1) : '-';
        let anb = (snaVal !== null && snbVal !== null) ? (snaVal - snbVal).toFixed(1) : '-';
        resumo = `SNA: ${sna}°, SNB: ${snb}°, ANB: ${anb}°`;
    }
    appState.historicoConsultas.push({ data: document.getElementById('data-exame').value, tipo: appState.tipoEstudo.toUpperCase(), resumo: resumo, obs: document.getElementById('anomalias-obs').value });
    alert('Traçado arquivado!');
}

function renderHistorico() {
    const tbody = document.getElementById('evolution-tbody'); tbody.innerHTML = '';
    appState.historicoConsultas.forEach((h, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${escaparHTML(h.data)}</strong></td><td>${escaparHTML(h.tipo)}</td><td>${escaparHTML(h.resumo)}</td><td>${escaparHTML(h.obs) || 'Sem observações registadas.'}</td>`;
        const tdAcoes = document.createElement('td');
        tdAcoes.style.whiteSpace = 'nowrap';
        const btnEditar = document.createElement('button');
        btnEditar.className = 'action-btn';
        btnEditar.style.cssText = 'width:auto; margin:0 4px 0 0; padding:0.35rem 0.6rem; font-size:0.78rem; display:inline-block;';
        btnEditar.textContent = 'Editar';
        btnEditar.onclick = () => editarObservacaoHistorico(idx);
        const btnApagar = document.createElement('button');
        btnApagar.className = 'action-btn';
        btnApagar.style.cssText = 'width:auto; margin:0; padding:0.35rem 0.6rem; font-size:0.78rem; display:inline-block; background:#fee2e2; border-color:var(--red); color:var(--red);';
        btnApagar.textContent = 'Apagar';
        btnApagar.onclick = () => apagarEntradaHistorico(idx);
        tdAcoes.appendChild(btnEditar);
        tdAcoes.appendChild(btnApagar);
        tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
    });
}

// Edita apenas o texto de observações de uma entrada já gravada no histórico (não recalcula métricas)
function editarObservacaoHistorico(idx) {
    const entrada = appState.historicoConsultas[idx];
    if (!entrada) return;
    const novoTexto = prompt('Editar observações clínicas desta entrada:', entrada.obs || '');
    if (novoTexto === null) return; // cancelado
    entrada.obs = novoTexto;
    renderHistorico();
    avisarGuardarAposEdicaoHistorico();
}

// Remove uma entrada do histórico de evolução (não afeta os pontos/traçados já colocados no canvas)
function apagarEntradaHistorico(idx) {
    const entrada = appState.historicoConsultas[idx];
    if (!entrada) return;
    if (!confirm(`Apagar esta entrada do histórico?\n\n${entrada.data} — ${entrada.tipo}\n\nEsta ação não pode ser desfeita depois de guardar a ficha.`)) return;
    appState.historicoConsultas.splice(idx, 1);
    renderHistorico();
    avisarGuardarAposEdicaoHistorico();
}

function avisarGuardarAposEdicaoHistorico() {
    alert('Alteração aplicada apenas neste ecrã. Para tornar a alteração permanente, vá a "Ficha & Documentação" e prima "Guardar Ficha Local" (e sincronize com o Drive, se aplicável).');
}
