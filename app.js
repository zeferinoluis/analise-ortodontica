// ==========================================================================
// ORTOANALYTIC PRO v7.0 - MOTOR DE PROJEÇÃO RIGIDA EM CANVAS COORDENADO
// ==========================================================================

let appState = {
    tipoEstudo: 'cefalometria',
    estudosImagens: {
        cefalometria: { pontos: { S: null, N: null, A: null, B: null, Pg: null, Me: null, Gn: null, Go: null, Or: null, Po: null, ENA: null, ENP: null, U1i: null, U1a: null, L1i: null, L1a: null }, escalaVisual: 1, scalePxPerMm: null, src: "", naturalWidth: 0, naturalHeight: 0 },
        facial: { pontos: { Tr: null, Na: null, Gl: null, Prn: null, Sn: null, Ls: null, Me: null, PgL: null, Zy_D: null, Zy_E: null, Ch_D: null, Ch_E: null }, escalaVisual: 1, scalePxPerMm: null, src: "", naturalWidth: 0, naturalHeight: 0 }
    },
    historicoConsultas: [],
    imagensPaciente: {},
    dadosModelosBackup: { sSup6: 45.5, sInf6: 35.2, sSup4: 32.0, sInf4: 24.0, dPm: 35.0, dM: 47.0, perimetro: 74.0, s10: 78.0 },
    modelosRegistados: false
};

let db;
let escalaVisual = 1;

const configuracaoPontos = {
    cefalometria: [
        { nome: 'Ponto Sela (S)', id: 'S' },
        { nome: 'Ponto Násio (N)', id: 'N' },
        { nome: 'Ponto A', id: 'A' },
        { nome: 'Ponto B', id: 'B' },
        { nome: 'Pogônio (Pg)', id: 'Pg' },
        { nome: 'Mentoniano (Me)', id: 'Me' },
        { nome: 'Gnátio (Gn)', id: 'Gn' },
        { nome: 'Gônio (Go)', id: 'Go' },
        { nome: 'Orbitário (Or)', id: 'Or' },
        { nome: 'Pório (Po)', id: 'Po' },
        { nome: 'Espinha Nasal Ant. (ENA)', id: 'ENA' },
        { nome: 'Espinha Nasal Post. (ENP)', id: 'ENP' },
        { nome: 'Incisivo Sup. — Borda (U1i)', id: 'U1i' },
        { nome: 'Incisivo Sup. — Ápice (U1a)', id: 'U1a' },
        { nome: 'Incisivo Inf. — Borda (L1i)', id: 'L1i' },
        { nome: 'Incisivo Inf. — Ápice (L1a)', id: 'L1a' }
    ],
    facial: [
        { nome: 'Trichion (Tr)', id: 'Tr' },
        { nome: 'Násio Facial (Na)', id: 'Na' },
        { nome: 'Glabela (Gl)', id: 'Gl' },
        { nome: 'Pronasal (Prn)', id: 'Prn' },
        { nome: 'Subnasal (Sn)', id: 'Sn' },
        { nome: 'Lábio Superior (Ls)', id: 'Ls' },
        { nome: 'Mento (Me)', id: 'Me' },
        { nome: 'Pogônio Mole (Pg\')', id: 'PgL' },
        { nome: 'Zigomático Direito (Zy D)', id: 'Zy_D' },
        { nome: 'Zigomático Esquerdo (Zy E)', id: 'Zy_E' },
        { nome: 'Comissura Labial Dir. (Ch D)', id: 'Ch_D' },
        { nome: 'Comissura Labial Esq. (Ch E)', id: 'Ch_E' }
    ]
};

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const img = document.getElementById('source-image');
const fileInput = document.getElementById('file-input');

document.getElementById('data-exame').valueAsDate = new Date();

// Inicialização estável IndexedDB
const request = indexedDB.open("OrtoAnalyticDB", 1);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("pacientes")) { db.createObjectStore("pacientes", { keyPath: "id" }); }
};
request.onsuccess = function(e) {
    db = e.target.result;
    document.getElementById('db-status').innerText = "✓ Base de Dados Ativa";
};
request.onerror = function() {
    document.getElementById('db-status').innerText = "✗ Base de dados indisponível";
    alert("Não foi possível abrir a base de dados local (o navegador pode estar em modo privado ou com o armazenamento bloqueado). A app funciona, mas Guardar/Carregar ficha local não estarão disponíveis. Use Exportar/Importar Ficheiro de Backup como alternativa.");
};

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

    if (appState.tipoEstudo === 'modelos') {
        pGrafico.style.display = 'none'; btnSalvarGrafico.style.display = 'none';
        viewportGrafico.style.display = 'none'; pModelos.style.display = 'block';
        tabelaHeader.innerHTML = '<tr><th>Análise de Modelo</th><th>Medido</th><th>Norma</th><th>Status</th></tr>';
        executarCalculosModelosPuros();
    } else {
        pGrafico.style.display = 'block'; btnSalvarGrafico.style.display = 'block';
        viewportGrafico.style.display = 'flex'; pModelos.style.display = 'none';
        tabelaHeader.innerHTML = '<tr><th>Parâmetro</th><th>Medido</th><th>Norma</th><th>Status</th></tr>';
        
        const lista = document.getElementById('lista-pontos-dinamica'); lista.innerHTML = '';
        configuracaoPontos[appState.tipoEstudo].forEach(p => {
            lista.innerHTML += `<button class="point-btn" id="pt-${p.id}" onclick="selectPoint('${p.id}')">${p.nome}</button>`;
        });

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

function selectPoint(pName) {
    appState.isCalibrating = false; appState.selectedPointName = pName;
    document.querySelectorAll('.point-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`pt-${pName}`).classList.add('active');
}

function startCalibration() {
    let cEstudo = appState.estudosImagens[appState.tipoEstudo];
    if (!cEstudo || !cEstudo.src) { alert('Carregue primeiro uma imagem antes de calibrar a régua.'); return; }
    appState.isCalibrating = true; appState.calibrationPoints = [];
    alert('Calibração: marque 2 pontos com 10mm reais de distância entre si.');
}

canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
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
            cEstudo.scalePxPerMm = (distPx / cEstudo.escalaVisual) / 10;
            appState.isCalibrating = false;
            redrawCanvas();
            alert('Régua calibrada!');
        }
        return;
    }
    if (appState.selectedPointName) {
        cEstudo.pontos[appState.selectedPointName] = { x: x / cEstudo.escalaVisual, y: y / cEstudo.escalaVisual };
        document.getElementById(`pt-${appState.selectedPointName}`).classList.remove('active');
        appState.selectedPointName = null; redrawCanvas();
    }
});

function drawLine(p1, p2, color, targetCtx = ctx) { targetCtx.beginPath(); targetCtx.moveTo(p1.x, p1.y); targetCtx.lineTo(p2.x, p2.y); targetCtx.strokeStyle = color; targetCtx.lineWidth = 4; targetCtx.stroke(); }
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
function atualizarResultadosGraficosLimpos() { document.getElementById('results-tbody').innerHTML = `<tr><td colspan="4">Aguardando pontos...</td></tr>`; }

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
function linhaMedida(grupo, label, valor, unidade, normaCentro, tolerancia, textoExtra) {
    let ok = Math.abs(valor - normaCentro) <= tolerancia;
    let texto = textoExtra || (ok ? 'Normal' : 'Desvio');
    return { grupo, label, valor: valor.toFixed(1) + unidade, norma: normaCentro.toFixed(1) + unidade + ' ± ' + tolerancia, status: ok ? 'status-ok' : 'status-dev', texto };
}
function linhaSemCalibragem(grupo, label, normaCentro, unidade) {
    return { grupo, label, valor: '—', norma: normaCentro.toFixed(1) + unidade, status: 'status-dev', texto: 'Calibrar régua' };
}

// Calcula todas as linhas de resultado da cefalometria consoante a análise escolhida ('steiner'|'downs'|'tweed'|'todas')
function calcularResultadosCefalometricosCompleto(tipo) {
    const cEstudo = appState.estudosImagens.cefalometria;
    const p = cEstudo.pontos;
    const scale = cEstudo.scalePxPerMm;
    const linhas = [];

    // Bloco Geral — comum a todas as análises
    let sna = null, snb = null;
    if (p.S && p.N && p.A) sna = obterAngulo(p.S, p.N, p.A);
    if (p.S && p.N && p.B) snb = obterAngulo(p.S, p.N, p.B);
    if (sna !== null) linhas.push(linhaMedida('Geral', 'Ângulo SNA', sna, '°', 82, 2));
    if (snb !== null) linhas.push(linhaMedida('Geral', 'Ângulo SNB', snb, '°', 80, 2));
    if (sna !== null && snb !== null) {
        let anb = sna - snb;
        let classe = anb > 4 ? 'Classe II' : (anb < 0 ? 'Classe III' : 'Classe I');
        linhas.push(linhaMedida('Geral', 'Ângulo ANB', anb, '°', 2, 2, classe));
    }
    if (p.S && p.N) {
        if (scale) linhas.push(linhaMedida('Geral', 'Distância N-S', distanciaPontos(p.S, p.N) / scale, ' mm', 75, 4));
        else linhas.push(linhaSemCalibragem('Geral', 'Distância N-S', 75, ' mm'));
    }
    let interincisal = null;
    if (p.U1a && p.U1i && p.L1a && p.L1i) {
        interincisal = anguloEntreLinhas(p.U1a, p.U1i, p.L1a, p.L1i);
        linhas.push(linhaMedida('Geral', 'Ângulo Interincisal', interincisal, '°', 130, 6));
    }

    if (tipo === 'steiner' || tipo === 'todas') {
        if (p.S && p.N && p.Go && p.Gn) linhas.push(linhaMedida('Steiner', 'SN–GoGn (Plano Mandibular)', anguloEntreLinhas(p.S, p.N, p.Go, p.Gn), '°', 32, 5));
        if (p.U1a && p.U1i && p.N && p.A) linhas.push(linhaMedida('Steiner', 'U1–NA (angular)', anguloEntreLinhas(p.U1a, p.U1i, p.N, p.A), '°', 22, 2));
        if (p.U1i && p.N && p.A) { if (scale) linhas.push(linhaMedida('Steiner', 'U1–NA (linear)', distanciaPontoLinha(p.U1i, p.N, p.A) / scale, ' mm', 4, 2)); else linhas.push(linhaSemCalibragem('Steiner', 'U1–NA (linear)', 4, ' mm')); }
        if (p.L1a && p.L1i && p.N && p.B) linhas.push(linhaMedida('Steiner', 'L1–NB (angular)', anguloEntreLinhas(p.L1a, p.L1i, p.N, p.B), '°', 25, 2));
        if (p.L1i && p.N && p.B) { if (scale) linhas.push(linhaMedida('Steiner', 'L1–NB (linear)', distanciaPontoLinha(p.L1i, p.N, p.B) / scale, ' mm', 4, 2)); else linhas.push(linhaSemCalibragem('Steiner', 'L1–NB (linear)', 4, ' mm')); }
    }

    if (tipo === 'downs' || tipo === 'todas') {
        if (p.Or && p.Po && p.N && p.Pg) linhas.push(linhaMedida('Downs', 'Ângulo Facial (FH/N-Pg)', anguloEntreLinhas(p.Or, p.Po, p.N, p.Pg), '°', 87.8, 3.6));
        if (p.N && p.A && p.Pg) {
            let conv = 180 - obterAngulo(p.N, p.A, p.Pg);
            linhas.push(linhaMedida('Downs', 'Convexidade (N-A-Pg)', conv, '°', 0, 5.1, Math.abs(conv) <= 5.1 ? 'Normal' : (conv > 0 ? 'Perfil Convexo' : 'Perfil Côncavo')));
        }
        if (p.A && p.B && p.N && p.Pg) linhas.push(linhaMedida('Downs', 'Plano AB / N-Pg', anguloEntreLinhas(p.A, p.B, p.N, p.Pg), '°', 4.6, 3.7));
        if (p.Or && p.Po && p.Go && p.Gn) linhas.push(linhaMedida('Downs', 'Plano Mandibular / FH', anguloEntreLinhas(p.Or, p.Po, p.Go, p.Gn), '°', 21.9, 3.5));
        if (p.S && p.Gn && p.Or && p.Po) linhas.push(linhaMedida('Downs', 'Eixo Y (S-Gn / FH)', anguloEntreLinhas(p.S, p.Gn, p.Or, p.Po), '°', 59.4, 3.8));
    }

    if (tipo === 'tweed' || tipo === 'todas') {
        if (p.Or && p.Po && p.Go && p.Gn) linhas.push(linhaMedida('Tweed', 'FMA (Plano Mand. / FH)', anguloEntreLinhas(p.Or, p.Po, p.Go, p.Gn), '°', 25, 5));
        if (p.Or && p.Po && p.L1a && p.L1i) linhas.push(linhaMedida('Tweed', 'FMIA (FH / Incisivo Inf.)', anguloEntreLinhas(p.Or, p.Po, p.L1a, p.L1i), '°', 65, 5));
        if (p.Go && p.Gn && p.L1a && p.L1i) linhas.push(linhaMedida('Tweed', 'IMPA (Incisivo Inf. / Plano Mand.)', anguloEntreLinhas(p.Go, p.Gn, p.L1a, p.L1i), '°', 90, 5));
    }

    return linhas;
}

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

function calcularCefalometriaAvancada() {
    const seletor = document.getElementById('tipo-analise-cefalo');
    const tipo = seletor ? seletor.value : 'steiner';
    const linhas = calcularResultadosCefalometricosCompleto(tipo);
    document.getElementById('results-tbody').innerHTML = renderizarTabelaResultados(linhas);
}

// Calcula todas as linhas de resultado da análise facial (terços, perfil mole, proporções horizontais)
function calcularResultadosFaciaisCompleto() {
    const pts = appState.estudosImagens.facial.pontos;
    const linhas = [];

    if (pts.Tr && pts.Na && pts.Sn && pts.Me) {
        let tSup = Math.abs(pts.Na.y - pts.Tr.y), tMed = Math.abs(pts.Sn.y - pts.Na.y), tInf = Math.abs(pts.Me.y - pts.Sn.y);
        let total = tSup + tMed + tInf;
        linhas.push(linhaMedida('Terços Verticais', 'Terço Superior', (tSup/total)*100, '%', 33.3, 3));
        linhas.push(linhaMedida('Terços Verticais', 'Terço Médio', (tMed/total)*100, '%', 33.3, 3));
        linhas.push(linhaMedida('Terços Verticais', 'Terço Inferior', (tInf/total)*100, '%', 33.3, 3));
    }
    if (pts.Prn && pts.Sn && pts.Ls) {
        let nasolabial = obterAngulo(pts.Prn, pts.Sn, pts.Ls);
        let ok = nasolabial >= 90 && nasolabial <= 110;
        linhas.push({ grupo: 'Perfil Mole', label: 'Ângulo Nasolabial', valor: nasolabial.toFixed(1)+'°', norma: '90° – 110°', status: ok?'status-ok':'status-dev', texto: ok?'Normal':(nasolabial<90?'Fechado':'Aberto') });
    }
    if (pts.Gl && pts.Sn && pts.PgL) {
        let convexidade = 180 - obterAngulo(pts.Gl, pts.Sn, pts.PgL);
        linhas.push(linhaMedida('Perfil Mole', 'Convexidade Facial (Gl-Sn-Pg\')', convexidade, '°', 12, 4, Math.abs(convexidade-12)<=4?'Normal':(convexidade>16?'Perfil Convexo':'Perfil Côncavo')));
    }
    if (pts.Zy_D && pts.Zy_E && pts.Ch_D && pts.Ch_E) {
        let largFacial = distanciaPontos(pts.Zy_D, pts.Zy_E);
        let largBucal = distanciaPontos(pts.Ch_D, pts.Ch_E);
        let ratio = largFacial ? (largBucal/largFacial)*100 : 0;
        linhas.push({ grupo: 'Proporções Horizontais', label: 'Largura Bucal / Largura Bizigomática', valor: ratio.toFixed(1)+'%', norma: 'Valor de referência (sem norma rígida)', status: '', texto: 'Informativo' });
    }
    return linhas;
}

function calcularAnaliseFacial() {
    const linhas = calcularResultadosFaciaisCompleto();
    document.getElementById('results-tbody').innerHTML = renderizarTabelaResultados(linhas, 'Marque os pontos faciais.');
}

function configureModelosInputs(m) {
    if(!m) return;
    const ids = ['m-sup6', 'm-inf6', 'm-sup4', 'm-inf4', 'm-distpm', 'm-distm', 'm-perimetro', 'm-soma10'];
    const keys = ['sSup6', 'sInf6', 'sSup4', 'sInf4', 'dPm', 'dM', 'perimetro', 's10'];
    ids.forEach((id, idx) => {
        let el = document.getElementById(id);
        if(el) el.value = m[keys[idx]] || el.value;
    });
}

function executarCalculosModelosPuros() {
    let sSup6 = parseFloat(document.getElementById('m-sup6').value) || 45.5; let sInf6 = parseFloat(document.getElementById('m-inf6').value) || 35.2;
    let sSup4 = parseFloat(document.getElementById('m-sup4').value) || 32.0; let sInf4 = parseFloat(document.getElementById('m-inf4').value) || 24.0;
    let dPm = parseFloat(document.getElementById('m-distpm').value) || 35.0; let dM = parseFloat(document.getElementById('m-distm').value) || 47.0;
    let perimetro = parseFloat(document.getElementById('m-perimetro').value) || 74.0; let s10 = parseFloat(document.getElementById('m-soma10').value) || 78.0;

    let boltonAnt = (sInf6 / sSup6) * 100; let korkhausEsp = (sSup4 * 100) / 81; let ashley = (dPm / s10) * 100; let discEspaco = perimetro - s10;

    appState.dadosModelosBackup = { sSup6, sInf6, sSup4, sInf4, dPm, dM, perimetro, s10 };

    document.getElementById('results-tbody').innerHTML = `
        <tr><td><strong>Bolton Anterior</strong></td><td>${boltonAnt.toFixed(1)}%</td><td>77.2%</td><td class="${Math.abs(boltonAnt-77.2)<=1.6?'status-ok':'status-dev'}">Massa Dentária</td></tr>
        <tr><td><strong>Korkhaus (Largura Alvo)</strong></td><td>${korkhausEsp.toFixed(1)} mm</td><td>Real: ${dPm}mm</td><td class="${dPm<korkhausEsp?'status-dev':'status-ok'}">${dPm<korkhausEsp?'Atresia':'OK'}</td></tr>
        <tr><td><strong>Ashley Howe (Índice Basal)</strong></td><td>${ashley.toFixed(1)}%</td><td>43.0%</td><td class="${ashley<43?'status-dev':'status-ok'}">${ashley<43?'Estreitamento':'OK'}</td></tr>
        <tr><td><strong>TSALD / Careys / Nance</strong></td><td>${discEspaco.toFixed(1)} mm</td><td>0.0 mm</td><td class="${discEspaco<0?'status-dev':'status-ok'}">${discEspaco<0?'Apinhamento':'Sobra'}</td></tr>
    `;
}

function processarEGuardarModelos() {
    executarCalculosModelosPuros();
    appState.modelosRegistados = true;
    appState.historicoConsultas.push({ data: document.getElementById('data-exame').value, tipo: 'MODELOS', resumo: `Bolton: ${((appState.dadosModelosBackup.sInf6/appState.dadosModelosBackup.sSup6)*100).toFixed(1)}%`, obs: document.getElementById('anomalias-obs').value });
    alert('Modelos registados!');
}

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
    appState.historicoConsultas.forEach(h => { tbody.innerHTML += `<tr><td><strong>${escaparHTML(h.data)}</strong></td><td>${escaparHTML(h.tipo)}</td><td>${escaparHTML(h.resumo)}</td><td>${escaparHTML(h.obs) || 'Sem anomalias.'}</td></tr>`; });
}

function resetarBaseDeDados() {
    const conf1 = confirm("Isto apaga TODOS os pacientes guardados localmente (IndexedDB) e limpa a ficha atual, de forma irreversível. Continuar?");
    if (!conf1) return;
    const conf2 = confirm("Confirma novamente: quer mesmo apagar tudo e começar do zero?");
    if (!conf2) return;

    const finalizarReset = function() {
        appState = {
            tipoEstudo: 'cefalometria',
            estudosImagens: {
                cefalometria: { pontos: { S: null, N: null, A: null, B: null, Pg: null, Me: null, Gn: null, Go: null, Or: null, Po: null, ENA: null, ENP: null, U1i: null, U1a: null, L1i: null, L1a: null }, escalaVisual: 1, scalePxPerMm: null, src: "", naturalWidth: 0, naturalHeight: 0 },
                facial: { pontos: { Tr: null, Na: null, Gl: null, Prn: null, Sn: null, Ls: null, Me: null, PgL: null, Zy_D: null, Zy_E: null, Ch_D: null, Ch_E: null }, escalaVisual: 1, scalePxPerMm: null, src: "", naturalWidth: 0, naturalHeight: 0 }
            },
            historicoConsultas: [],
            imagensPaciente: {},
            dadosModelosBackup: { sSup6: 45.5, sInf6: 35.2, sSup4: 32.0, sInf4: 24.0, dPm: 35.0, dM: 47.0, perimetro: 74.0, s10: 78.0 },
            modelosRegistados: false
        };
        document.getElementById('paciente-nome').value = '';
        document.getElementById('paciente-id').value = '';
        document.getElementById('paciente-nascimento').value = '';
        document.getElementById('indicacoes-gerais').value = '';
        document.getElementById('anomalias-obs').value = '';
        document.querySelectorAll('.preview').forEach(div => div.style.backgroundImage = 'none');
        document.querySelectorAll('.media-card input[type="file"]').forEach(inp => inp.value = '');
        configureModelosInputs(appState.dadosModelosBackup);
        atualizarInterfaceEstudo();
        renderHistorico();
        alert("Base de dados apagada e ficha reiniciada. A app está pronta para uma instalação limpa.");
    };

    if (db) {
        try {
            db.close();
            const req = indexedDB.deleteDatabase("OrtoAnalyticDB");
            req.onsuccess = function() { db = undefined; finalizarReset(); reabrirBD(); };
            req.onerror = function() { alert("Não foi possível apagar a base de dados local."); };
            req.onblocked = function() { alert("A base de dados ainda está a ser usada noutra aba. Feche as outras abas desta app e tente novamente."); };
        } catch (err) { alert("Erro ao apagar a base de dados: " + err.message); }
    } else {
        finalizarReset();
    }
}

function reabrirBD() {
    const request = indexedDB.open("OrtoAnalyticDB", 1);
    request.onupgradeneeded = function(e) {
        db = e.target.result;
        if (!db.objectStoreNames.contains("pacientes")) { db.createObjectStore("pacientes", { keyPath: "id" }); }
    };
    request.onsuccess = function(e) {
        db = e.target.result;
        document.getElementById('db-status').innerText = "✓ Base de Dados Ativa";
    };
}

// Estrutura por omissão do appState — usada para fundir backups antigos sem campos novos
function appStatePorOmissao() {
    return {
        tipoEstudo: 'cefalometria',
        estudosImagens: {
            cefalometria: { pontos: { S: null, N: null, A: null, B: null, Pg: null, Me: null, Gn: null, Go: null, Or: null, Po: null, ENA: null, ENP: null, U1i: null, U1a: null, L1i: null, L1a: null }, escalaVisual: 1, scalePxPerMm: null, src: "", naturalWidth: 0, naturalHeight: 0 },
            facial: { pontos: { Tr: null, Na: null, Gl: null, Prn: null, Sn: null, Ls: null, Me: null, PgL: null, Zy_D: null, Zy_E: null, Ch_D: null, Ch_E: null }, escalaVisual: 1, scalePxPerMm: null, src: "", naturalWidth: 0, naturalHeight: 0 }
        },
        historicoConsultas: [],
        imagensPaciente: {},
        dadosModelosBackup: { sSup6: 45.5, sInf6: 35.2, sSup4: 32.0, sInf4: 24.0, dPm: 35.0, dM: 47.0, perimetro: 74.0, s10: 78.0 },
        modelosRegistados: false
    };
}

// Funde um appState carregado (BD ou backup) com a estrutura atual — backups antigos não rebentam a app
function normalizarAppState(carregado) {
    const base = appStatePorOmissao();
    if (!carregado || typeof carregado !== 'object') return base;
    const resultado = base;
    resultado.tipoEstudo = ['cefalometria','facial','modelos'].includes(carregado.tipoEstudo) ? carregado.tipoEstudo : 'cefalometria';
    resultado.historicoConsultas = Array.isArray(carregado.historicoConsultas) ? carregado.historicoConsultas : [];
    resultado.imagensPaciente = (carregado.imagensPaciente && typeof carregado.imagensPaciente === 'object') ? carregado.imagensPaciente : {};
    resultado.dadosModelosBackup = Object.assign(resultado.dadosModelosBackup, carregado.dadosModelosBackup || {});
    resultado.modelosRegistados = carregado.modelosRegistados === true;
    ['cefalometria','facial'].forEach(k => {
        const src = carregado.estudosImagens && carregado.estudosImagens[k];
        if (src && typeof src === 'object') {
            resultado.estudosImagens[k].pontos = Object.assign(resultado.estudosImagens[k].pontos, src.pontos || {});
            resultado.estudosImagens[k].escalaVisual = src.escalaVisual || 1;
            resultado.estudosImagens[k].scalePxPerMm = src.scalePxPerMm || null;
            resultado.estudosImagens[k].src = src.src || "";
            resultado.estudosImagens[k].naturalWidth = src.naturalWidth || 0;
            resultado.estudosImagens[k].naturalHeight = src.naturalHeight || 0;
        }
    });
    return resultado;
}

// Escapa texto livre antes de o injetar em HTML (PDF) — evita que "<" num nome parta a renderização
function escaparHTML(txt) {
    return String(txt == null ? '' : txt)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function gravarPacienteNaBD() {
    if (!db) return alert("Base de dados ainda não está pronta. Aguarde um instante e tente novamente.");
    const idPac = document.getElementById('paciente-id').value;
    if (!idPac) return alert("Insira o ID do processo.");
    let pacote = { id: idPac, nome: document.getElementById('paciente-nome').value, nascimento: document.getElementById('paciente-nascimento').value, indicacoes: document.getElementById('indicacoes-gerais').value, obs: document.getElementById('anomalias-obs').value, appStateBackup: JSON.stringify(appState) };
    try {
        const transaction = db.transaction(["pacientes"], "readwrite");
        transaction.objectStore("pacientes").put(pacote);
        transaction.oncomplete = function() { document.getElementById('db-status').innerText = "✓ Sincronizado"; alert("Ficha sincronizada!"); gdriveAutoSyncAgendar(); };
        transaction.onerror = function() { alert("Erro ao guardar na base de dados local."); };
    } catch (err) { alert("Erro ao guardar: " + err.message); }
}

function carregarPacienteDaBD() {
    if (!db) return alert("Base de dados ainda não está pronta. Aguarde um instante e tente novamente.");
    const idPac = document.getElementById('paciente-id').value;
    if (!idPac) return alert("Insira o ID do processo.");
    try {
        const req = db.transaction(["pacientes"], "readonly").objectStore("pacientes").get(idPac);
        req.onsuccess = function(e) {
            let res = e.target.result; if (!res) return alert("Registo ausente.");
            try {
                document.getElementById('paciente-nome').value = res.nome; document.getElementById('paciente-nascimento').value = res.nascimento; document.getElementById('indicacoes-gerais').value = res.indicacoes; document.getElementById('anomalias-obs').value = res.obs;
                appState = normalizarAppState(JSON.parse(res.appStateBackup));

                configureModelosInputs(appState.dadosModelosBackup);
                document.querySelectorAll('.preview').forEach(div => div.style.backgroundImage = 'none');
                for (let key in appState.imagensPaciente) {
                    let pBox = document.getElementById(`prev-${key}`); if (pBox) pBox.style.backgroundImage = `url(${appState.imagensPaciente[key]})`;
                }
                atualizarInterfaceEstudo(); alert("Dados restaurados!");
            } catch (err) { alert("Registo encontrado mas corrompido: " + err.message); }
        };
        req.onerror = function() { alert("Erro ao consultar a base de dados local."); };
    } catch (err) { alert("Erro ao carregar: " + err.message); }
}

function exportarBackupJSON() {
    const idPac = document.getElementById('paciente-id').value || "Backup";
    let jsonString = JSON.stringify({ nome: document.getElementById('paciente-nome').value, id: idPac, nascimento: document.getElementById('paciente-nascimento').value, indicacoes: document.getElementById('indicacoes-gerais').value, obs: document.getElementById('anomalias-obs').value, appState: appState });
    let blob = new Blob([jsonString], { type: "application/json" });
    let link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `OrtoPro_v7_Backup_${idPac}.json`; link.click();
}

function importarBackupJSON(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        let dados;
        try { dados = JSON.parse(e.target.result); }
        catch (err) { alert("Ficheiro de backup inválido: não é um JSON válido."); event.target.value = ''; return; }

        if (!dados || typeof dados !== 'object' || !dados.appState) {
            alert("Ficheiro de backup inválido: estrutura inesperada.");
            event.target.value = ''; return;
        }
        try {
            document.getElementById('paciente-id').value = dados.id || ''; document.getElementById('paciente-nome').value = dados.nome || ''; document.getElementById('paciente-nascimento').value = dados.nascimento || ''; document.getElementById('indicacoes-gerais').value = dados.indicacoes || ''; document.getElementById('anomalias-obs').value = dados.obs || '';
            appState = normalizarAppState(dados.appState);

            configureModelosInputs(appState.dadosModelosBackup);
            document.querySelectorAll('.preview').forEach(div => div.style.backgroundImage = 'none');
            for (let key in (appState.imagensPaciente || {})) {
                let pBox = document.getElementById(`prev-${key}`); if (pBox) pBox.style.backgroundImage = `url(${appState.imagensPaciente[key]})`;
            }
            atualizarInterfaceEstudo(); alert("Cópia de segurança restaurada!");
        } catch (err) {
            alert("Erro ao aplicar o backup: " + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = function() { alert("Não foi possível ler o ficheiro."); };
    reader.readAsText(file);
}

// Renderiza as linhas de resultado (mesmo formato usado no ecrã) como tabela HTML para o PDF impresso
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
                ${document.getElementById('table-evolution').outerHTML}
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

/* ══════════════════════════════════════════════════════════════════════════
   Sincronização com o Google Drive (appDataFolder) — OrtoAnalytic Pro
   Mesma arquitetura da app Galimplant: OAuth (Google Identity Services),
   ficheiro único no appDataFolder, encriptação AES-GCM opcional (PBKDF2),
   sincronização automática ao gravar e versões diárias fixadas (keepForever).
   O backup abrange TODAS as fichas guardadas no IndexedDB.
   ══════════════════════════════════════════════════════════════════════════ */

const GDRIVE_FILE_NAME = 'ortoanalytic_backup.json';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
// Chaves de localStorage com prefixo próprio — evita conflitos com outras
// apps alojadas no mesmo domínio (github.io)
const LS_CLIENTID  = 'ortoanalytic_gdrive_clientid';
const LS_AUTOSYNC  = 'ortoanalytic_gdrive_autosync';
const LS_ENCRYPT   = 'ortoanalytic_gdrive_encrypt';
const LS_LASTSYNC  = 'ortoanalytic_gdrive_lastsync';
const LS_LASTPIN   = 'ortoanalytic_gdrive_lastpin';

let gdriveTokenClient = null;
let gdriveAccessToken = null;
let gdriveTokenExpira = 0;
let gdrivePassphrase = null;
let gdriveAutoSyncTimer = null;

function updateGDriveStatusUI(msg) {
    const el = document.getElementById('gdrive-status');
    if (el) el.innerText = msg;
}

function gdriveInicializarUI() {
    const saved = localStorage.getItem(LS_CLIENTID);
    if (saved) { const inp = document.getElementById('gdriveClientId'); if (inp) inp.value = saved; }
    const auto = document.getElementById('gdriveAutoSync');
    if (auto) auto.checked = localStorage.getItem(LS_AUTOSYNC) === '1';
    const enc = document.getElementById('gdriveEncrypt');
    if (enc) enc.checked = localStorage.getItem(LS_ENCRYPT) === '1';
}
window.addEventListener('load', gdriveInicializarUI);

function connectGDrive() {
    const inp = document.getElementById('gdriveClientId');
    const clientId = (inp ? inp.value : '').trim();
    if (!clientId) { alert('Indique o Client ID OAuth do Google (o mesmo usado na Galimplant serve, porque o domínio é o mesmo).'); return; }
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        alert('A biblioteca do Google ainda não carregou. Verifique a ligação à internet e tente novamente.');
        return;
    }
    localStorage.setItem(LS_CLIENTID, clientId);
    updateGDriveStatusUI('A abrir a janela de autorização do Google...');
    gdriveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GDRIVE_SCOPE,
        error_callback: (err) => {
            const tipo = (err && err.type) || 'desconhecido';
            if (tipo === 'popup_failed_to_open') {
                updateGDriveStatusUI('O popup de autenticação foi bloqueado. Autorize popups para este site e tente novamente.');
                alert('O navegador bloqueou a janela de autenticação da Google.\n\nAutorize popups para este site (ícone na barra de endereço) e clique novamente em "Ligar ao Google Drive".');
            } else if (tipo === 'popup_closed') {
                updateGDriveStatusUI('Autenticação cancelada (janela fechada).');
            } else {
                updateGDriveStatusUI('Falha na autenticação: ' + tipo);
            }
        },
        callback: (resp) => {
            if (resp.error) { updateGDriveStatusUI('Falha na autenticação: ' + resp.error + (resp.error_description ? ' — ' + resp.error_description : '')); return; }
            gdriveAccessToken = resp.access_token;
            gdriveTokenExpira = Date.now() + (parseInt(resp.expires_in || 3500) - 60) * 1000;
            updateGDriveStatusUI('✓ Ligado ao Google Drive.');
            document.getElementById('gdrive-setup').style.display = 'none';
            document.getElementById('gdrive-options').style.display = 'block';
            ['gdrive-sync-btn','gdrive-pull-btn'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = 'inline-block'; });
            const c = document.getElementById('gdrive-connect-btn'); if (c) c.innerText = 'Renovar ligação';
        }
    });
    gdriveTokenClient.requestAccessToken({ prompt: 'consent' });
}

// Devolve um token válido ou null (pedindo renovação silenciosa/interativa quando expirado)
function gdriveToken() {
    if (gdriveAccessToken && Date.now() < gdriveTokenExpira) return gdriveAccessToken;
    if (gdriveTokenClient) { gdriveTokenClient.requestAccessToken({ prompt: '' }); }
    return null;
}

async function gdriveFindFile(token) {
    const url = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=' +
        encodeURIComponent(`name='${GDRIVE_FILE_NAME}' and trashed=false`);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) { gdriveAccessToken = null; throw new Error('Sessão expirada — clique em "Renovar ligação" e repita.'); }
    if (!r.ok) throw new Error('Falha ao procurar o ficheiro (' + r.status + ')');
    const data = await r.json();
    return (data.files && data.files[0]) || null;
}

async function gdriveCreateFile(token) {
    const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,modifiedTime', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: GDRIVE_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' })
    });
    if (!r.ok) throw new Error('Falha ao criar o ficheiro (' + r.status + ')');
    return r.json();
}

// --- Leitura/escrita de TODAS as fichas do IndexedDB ---
function lerTodosPacientes() {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de dados local não está pronta.'));
        const req = db.transaction(['pacientes'], 'readonly').objectStore('pacientes').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(new Error('Falha ao ler a base de dados local.'));
    });
}

function gravarTodosPacientes(lista) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de dados local não está pronta.'));
        const tx = db.transaction(['pacientes'], 'readwrite');
        const store = tx.objectStore('pacientes');
        store.clear();
        (lista || []).forEach(p => { if (p && p.id) store.put(p); });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new Error('Falha ao gravar na base de dados local.'));
    });
}

// --- Encriptação opcional (AES-GCM, chave derivada por PBKDF2 — formato igual ao da Galimplant) ---
async function gdriveDerivarChave(passphrase, salt, usos) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, usos);
}
async function gdriveEncriptar(texto, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await gdriveDerivarChave(passphrase, salt, ['encrypt']);
    const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(texto));
    const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    return JSON.stringify({ encrypted: true, salt: b64(salt), iv: b64(iv), data: b64(cifrado) });
}
async function gdriveDesencriptar(payload, passphrase) {
    const deB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const key = await gdriveDerivarChave(passphrase, deB64(payload.salt), ['decrypt']);
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(payload.iv) }, key, deB64(payload.data));
    return new TextDecoder().decode(plano);
}

function toggleGDriveEncrypt(checked) {
    if (checked) {
        const pass = window.prompt('Palavra-passe de encriptação dos dados na nuvem (use a mesma em todos os dispositivos):');
        if (!pass) { document.getElementById('gdriveEncrypt').checked = false; return; }
        gdrivePassphrase = pass;
        localStorage.setItem(LS_ENCRYPT, '1');
        alert('Encriptação ativada — o próximo envio já vai encriptado.');
    } else {
        gdrivePassphrase = null;
        localStorage.setItem(LS_ENCRYPT, '0');
    }
}

function setGDriveAutoSync(checked) {
    localStorage.setItem(LS_AUTOSYNC, checked ? '1' : '0');
}

// Chamado por gravarPacienteNaBD() quando a sincronização automática está ligada
function gdriveAutoSyncAgendar() {
    if (localStorage.getItem(LS_AUTOSYNC) !== '1' || !gdriveAccessToken) return;
    clearTimeout(gdriveAutoSyncTimer);
    gdriveAutoSyncTimer = setTimeout(() => gdrivePush(true), 2000);
}

async function gdrivePush(silent) {
    try {
        const token = gdriveToken();
        if (!token) { if (!silent) alert('Ligue-se primeiro ao Google Drive.'); return; }
        updateGDriveStatusUI('A enviar...');

        let file = await gdriveFindFile(token);

        // Deteção de conflito: existe versão remota mais recente do que a última sincronizada aqui?
        const lastSync = localStorage.getItem(LS_LASTSYNC);
        if (file && lastSync && new Date(file.modifiedTime) > new Date(lastSync)) {
            const ok = confirm('⚠️ Existe uma versão mais recente na nuvem (provavelmente de outro dispositivo) que ainda não foi transferida para aqui.\n\nSe continuar, essa versão será SUBSTITUÍDA pelos dados deste dispositivo.\n\nRecomendado: cancele e use "Transferir da nuvem" primeiro.\n\nContinuar e substituir?');
            if (!ok) { updateGDriveStatusUI('Envio cancelado (conflito).'); return; }
        }

        const pacientes = await lerTodosPacientes();
        let corpo = JSON.stringify({ app: 'ortoanalytic', versao: 7, exportadoEm: new Date().toISOString(), pacientes });

        if (localStorage.getItem(LS_ENCRYPT) === '1') {
            if (!gdrivePassphrase) {
                gdrivePassphrase = window.prompt('Palavra-passe de encriptação dos dados na nuvem:');
                if (!gdrivePassphrase) { updateGDriveStatusUI('Envio cancelado (sem palavra-passe).'); return; }
            }
            corpo = await gdriveEncriptar(corpo, gdrivePassphrase);
        }

        if (!file) file = await gdriveCreateFile(token);

        // uploadType=media suporta ficheiros grandes (as fichas incluem fotos/radiografias em base64)
        const up = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&fields=id,modifiedTime`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: corpo
        });
        if (!up.ok) throw new Error('Falha no envio (' + up.status + ')');
        const meta = await up.json();
        localStorage.setItem(LS_LASTSYNC, meta.modifiedTime || new Date().toISOString());
        updateGDriveStatusUI('✓ Sincronizado às ' + new Date().toLocaleTimeString('pt-PT'));
        gdrivePinRevisaoDiaria(token, file.id).catch(() => {});
        if (!silent) alert('Backup enviado para o Google Drive.');
    } catch (e) {
        updateGDriveStatusUI('Erro ao sincronizar: ' + e.message);
        if (!silent) alert('Erro ao sincronizar: ' + e.message);
    }
}

// Fixa (keepForever) a última revisão, no máximo uma vez por dia — histórico diário recuperável
async function gdrivePinRevisaoDiaria(token, fileId) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(LS_LASTPIN) === hoje) return;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime)`, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return;
    const data = await r.json();
    const revs = (data.revisions || []);
    if (!revs.length) return;
    const ultima = revs[revs.length - 1];
    const p = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${ultima.id}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepForever: true })
    });
    if (p.ok) localStorage.setItem(LS_LASTPIN, hoje);
}

async function gdrivePull() {
    try {
        const token = gdriveToken();
        if (!token) { alert('Ligue-se primeiro ao Google Drive.'); return; }

        const file = await gdriveFindFile(token);
        if (!file) { alert('Ainda não existe nenhum backup nesta conta Google. Use "Enviar agora" primeiro.'); return; }

        if (!confirm('Transferir o backup da nuvem vai SUBSTITUIR todas as fichas guardadas neste dispositivo pelas da nuvem.\n\nContinuar?')) return;

        updateGDriveStatusUI('A transferir...');
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) throw new Error('Falha ao transferir (' + r.status + ')');
        let texto = await r.text();

        let dados;
        try { dados = JSON.parse(texto); } catch (e) { throw new Error('O conteúdo na nuvem não é JSON válido.'); }

        if (dados && dados.encrypted === true) {
            if (!gdrivePassphrase) {
                gdrivePassphrase = window.prompt('Este backup está encriptado. Palavra-passe:');
                if (!gdrivePassphrase) { updateGDriveStatusUI('Transferência cancelada.'); return; }
            }
            try {
                texto = await gdriveDesencriptar(dados, gdrivePassphrase);
                dados = JSON.parse(texto);
            } catch (e) {
                gdrivePassphrase = null;
                throw new Error('Palavra-passe incorreta — não foi possível desencriptar.');
            }
        }

        if (!dados || !Array.isArray(dados.pacientes)) throw new Error('Estrutura do backup inesperada.');

        await gravarTodosPacientes(dados.pacientes);
        localStorage.setItem(LS_LASTSYNC, file.modifiedTime || new Date().toISOString());
        updateGDriveStatusUI('✓ Sincronizado às ' + new Date().toLocaleTimeString('pt-PT'));

        // Se a ficha aberta no ecrã existir no backup, recarrega-a
        const idAtual = document.getElementById('paciente-id').value;
        const encontrada = idAtual ? dados.pacientes.find(p => p && p.id === idAtual) : null;
        alert('Backup restaurado: ' + dados.pacientes.length + ' ficha(s).' + (encontrada ? '\n\nA ficha aberta será recarregada da versão da nuvem.' : ''));
        if (encontrada) carregarFichaNoEcra(encontrada);
    } catch (e) {
        updateGDriveStatusUI('Erro: ' + e.message);
        alert('Erro ao transferir da nuvem: ' + e.message);
    }
}

// Aplica um pacote de ficha (formato do IndexedDB) ao ecrã — reutilizado pelo gdrivePull
function carregarFichaNoEcra(pacote) {
    try {
        document.getElementById('paciente-id').value = pacote.id || '';
        document.getElementById('paciente-nome').value = pacote.nome || '';
        document.getElementById('paciente-nascimento').value = pacote.nascimento || '';
        document.getElementById('indicacoes-gerais').value = pacote.indicacoes || '';
        document.getElementById('anomalias-obs').value = pacote.obs || '';
        let estado = null;
        try { estado = JSON.parse(pacote.appStateBackup || 'null'); } catch (e) {}
        appState = normalizarAppState(estado);
        configureModelosInputs(appState.dadosModelosBackup);
        document.querySelectorAll('.preview').forEach(div => div.style.backgroundImage = 'none');
        for (let key in (appState.imagensPaciente || {})) {
            let pBox = document.getElementById(`prev-${key}`); if (pBox) pBox.style.backgroundImage = `url(${appState.imagensPaciente[key]})`;
        }
        atualizarInterfaceEstudo();
    } catch (e) {
        alert('Ficha restaurada na base de dados, mas houve um problema a mostrá-la no ecrã: ' + e.message);
    }
}
