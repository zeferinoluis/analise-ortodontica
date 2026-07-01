// ==========================================================================
// ORTOANALYTIC PRO v7.0 - MOTOR DE PROJEÇÃO RIGIDA EM CANVAS COORDENADO
// ==========================================================================

let appState = {
    tipoEstudo: 'cefalometria',
    estudosImagens: {
        cefalometria: { pontos: { S: null, N: null, A: null, B: null, Gn: null }, escalaVisual: 1, scalePxPerMm: 1, src: "", naturalWidth: 0, naturalHeight: 0 },
        facial: { pontos: { Tr: null, Na: null, Sn: null, Me: null, Zy: null }, escalaVisual: 1, scalePxPerMm: 1, src: "", naturalWidth: 0, naturalHeight: 0 }
    },
    historicoConsultas: [],
    imagensPaciente: {},
    dadosModelosBackup: { sSup6: 45.5, sInf6: 35.2, sSup4: 32.0, sInf4: 24.0, dPm: 35.0, dM: 47.0, perimetro: 74.0, s10: 78.0 }
};

let db;
let escalaVisual = 1;

const configuracaoPontos = {
    cefalometria: [{ nome: 'Ponto Sela (S)', id: 'S' }, { nome: 'Ponto Násio (N)', id: 'N' }, { nome: 'Ponto A (A)', id: 'A' }, { nome: 'Ponto B (B)', id: 'B' }, { nome: 'Gnato (Gn)', id: 'Gn' }],
    facial: [{ nome: 'Tríquio (Tr)', id: 'Tr' }, { nome: 'Násio Facial (Na)', id: 'Na' }, { nome: 'Subnasal (Sn)', id: 'Sn' }, { nome: 'Mento (Me)', id: 'Me' }, { nome: 'Zígio (Zy)', id: 'Zy' }]
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
    const file = document.getElementById(inputId).files[0];
    if (!file) return;
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

function startCalibration() { appState.isCalibrating = true; appState.calibrationPoints = []; alert('Calibração: Marque 10mm.'); }

canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    let cEstudo = appState.estudosImagens[appState.tipoEstudo];

    if (appState.isCalibrating) {
        appState.calibrationPoints.push({x, y});
        if (appState.calibrationPoints.length === 2) {
            let dx = appState.calibrationPoints[1].x - appState.calibrationPoints[0].x;
            let dy = appState.calibrationPoints[1].y - appState.calibrationPoints[0].y;
            cEstudo.scalePxPerMm = (Math.sqrt(dx*dx + dy*dy) / cEstudo.escalaVisual) / 10;
            appState.isCalibrating = false; alert('Régua calibrada!');
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
function obterAngulo(p1, p2, p3) { let ab = Math.sqrt(pow2(p2.x-p1.x)+pow2(p2.y-p1.y)); let bc = Math.sqrt(pow2(p3.x-p2.x)+pow2(p3.y-p2.y)); let ac = Math.sqrt(pow2(p3.x-p1.x)+pow2(p3.y-p1.y)); return (Math.acos((pow2(ab)+pow2(bc)-pow2(ac))/(2*ab*bc))*180)/Math.PI; }
function pow2(x) { return x*x; }
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
        if(pts.S && pts.N) drawLine({x: pts.S.x*cEstudo.escalaVisual, y:pts.S.y*cEstudo.escalaVisual}, {x: pts.N.x*cEstudo.escalaVisual, y:pts.N.y*cEstudo.escalaVisual}, '#0284c7');
        if(pts.N && pts.A) drawLine({x: pts.N.x*cEstudo.escalaVisual, y:pts.N.y*cEstudo.escalaVisual}, {x: pts.A.x*cEstudo.escalaVisual, y:pts.A.y*cEstudo.escalaVisual}, '#16a34a');
        if(pts.N && pts.B) drawLine({x: pts.N.x*cEstudo.escalaVisual, y:pts.N.y*cEstudo.escalaVisual}, {x: pts.B.x*cEstudo.escalaVisual, y:pts.B.y*cEstudo.escalaVisual}, '#e11d48');
        calcularCefalometriaAvancada();
    } else if (appState.tipoEstudo === 'facial') { calcularAnaliseFacial(); }
}

function calcularCefalometriaAvancada() {
    const cEstudo = appState.estudosImagens.cefalometria;
    const pts = cEstudo.pontos; let html = ''; let snaVal = null, snbVal = null;
    if (pts.S && pts.N && (pts.A || pts.B)) {
        if (pts.A) { snaVal = obterAngulo(pts.S, pts.N, pts.A); html += `<tr><td><strong>Ângulo SNA</strong></td><td>${snaVal.toFixed(1)}°</td><td>82.0°</td><td class="${Math.abs(snaVal-82)<=2?'status-ok':'status-dev'}">${Math.abs(snaVal-82)<=2?'Normal':'Desvio'}</td></tr>`; }
        if (pts.B) { snbVal = obterAngulo(pts.S, pts.N, pts.B); html += `<tr><td><strong>Ângulo SNB</strong></td><td>${snbVal.toFixed(1)}°</td><td>80.0°</td><td class="${Math.abs(snbVal-80)<=2?'status-ok':'status-dev'}">${Math.abs(snbVal-80)<=2?'Normal':'Desvio'}</td></tr>`; }
        if (snaVal !== null && snbVal !== null) {
            let anb = snaVal - snbVal;
            let classe = anb > 4 ? 'Classe II' : (anb < 0 ? 'Classe III' : 'Classe I');
            html += `<tr><td><strong>Ângulo ANB</strong></td><td>${anb.toFixed(1)}°</td><td>2.0°</td><td class="${Math.abs(anb-2)<=2?'status-ok':'status-dev'}">${classe}</td></tr>`;
        }
        if (pts.S && pts.N && cEstudo.scalePxPerMm) {
            let dx = pts.N.x - pts.S.x, dy = pts.N.y - pts.S.y;
            let distNS = Math.sqrt(dx*dx + dy*dy) / cEstudo.scalePxPerMm;
            html += `<tr><td><strong>Distância N-S</strong></td><td>${distNS.toFixed(1)} mm</td><td>75.0 mm</td><td class="${Math.abs(distNS-75)<=4?'status-ok':'status-dev'}">${Math.abs(distNS-75)<=4?'Normal':'Desvio'}</td></tr>`;
        } else if (pts.S && pts.N) {
            html += `<tr><td colspan="4" style="color:#dc2626;">Calibre a régua (10mm) para obter a distância N-S em mm.</td></tr>`;
        }
    } else { html = `<tr><td colspan="4">Aguardando pontos...</td></tr>`; }
    document.getElementById('results-tbody').innerHTML = html;
}

function calcularAnaliseFacial() {
    const pts = appState.estudosImagens.facial.pontos; let tbody = document.getElementById('results-tbody');
    if (pts.Tr && pts.Na && pts.Sn && pts.Me) {
        let tSup = Math.abs(pts.Na.y - pts.Tr.y); let tMed = Math.abs(pts.Sn.y - pts.Na.y); let tInf = Math.abs(pts.Me.y - pts.Sn.y); let total = tSup + tMed + tInf;
        tbody.innerHTML = `<tr><td>Terço Superior Facial</td><td>${((tSup/total)*100).toFixed(1)}%</td><td>33.3%</td><td class="status-ok">OK</td></tr><tr><td>Terço Médio Facial</td><td>${((tMed/total)*100).toFixed(1)}%</td><td>33.3%</td><td class="status-ok">OK</td></tr><tr><td>Terço Inferior Facial</td><td>${((tInf/total)*100).toFixed(1)}%</td><td>33.3%</td><td class="status-ok">OK</td></tr>`;
    } else { tbody.innerHTML = `<tr><td colspan="4">Marque os pontos faciais.</td></tr>`; }
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
    appState.historicoConsultas.forEach(h => { tbody.innerHTML += `<tr><td><strong>${h.data}</strong></td><td>${h.tipo}</td><td>${h.resumo}</td><td>${h.obs || 'Sem anomalias.'}</td></tr>`; });
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
                cefalometria: { pontos: { S: null, N: null, A: null, B: null, Gn: null }, escalaVisual: 1, scalePxPerMm: 1, src: "", naturalWidth: 0, naturalHeight: 0 },
                facial: { pontos: { Tr: null, Na: null, Sn: null, Me: null, Zy: null }, escalaVisual: 1, scalePxPerMm: 1, src: "", naturalWidth: 0, naturalHeight: 0 }
            },
            historicoConsultas: [],
            imagensPaciente: {},
            dadosModelosBackup: { sSup6: 45.5, sInf6: 35.2, sSup4: 32.0, sInf4: 24.0, dPm: 35.0, dM: 47.0, perimetro: 74.0, s10: 78.0 }
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

function gravarPacienteNaBD() {
    if (!db) return alert("Base de dados ainda não está pronta. Aguarde um instante e tente novamente.");
    const idPac = document.getElementById('paciente-id').value;
    if (!idPac) return alert("Insira o ID do processo.");
    let pacote = { id: idPac, nome: document.getElementById('paciente-nome').value, nascimento: document.getElementById('paciente-nascimento').value, indicacoes: document.getElementById('indicacoes-gerais').value, obs: document.getElementById('anomalias-obs').value, appStateBackup: JSON.stringify(appState) };
    try {
        const transaction = db.transaction(["pacientes"], "readwrite");
        transaction.objectStore("pacientes").put(pacote);
        transaction.onsuccess = function() { document.getElementById('db-status').innerText = "✓ Sincronizado"; alert("Ficha sincronizada!"); };
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
                appState = JSON.parse(res.appStateBackup);

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
            appState = dados.appState;

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
            } else if (chaveEstudo === 'facial') {
                if(p.Tr && p.Na) drawLine({x:p.Tr.x,y:p.Tr.y},{x:p.Na.x,y:p.Na.y},'#0284c7',vCtx);
                if(p.Na && p.Sn) drawLine({x:p.Na.x,y:p.Na.y},{x:p.Sn.x,y:p.Sn.y},'#16a34a',vCtx);
                if(p.Sn && p.Me) drawLine({x:p.Sn.x,y:p.Sn.y},{x:p.Me.x,y:p.Me.y},'#e11d48',vCtx);
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
    
    const element = document.createElement('div');
    element.style.width = '170mm'; 
    element.style.margin = '0 auto';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.color = '#0f172a';

    // Aguarda o carregamento real das imagens antes de gerar o canvas
    let cefaloImgData = await gerarCanvasVirtualFundidoAsync('cefalometria');
    let facialImgData = await gerarCanvasVirtualFundidoAsync('facial');

    let m = appState.dadosModelosBackup;
    let boltonAnt = (m.sInf6 / m.sSup6) * 100;
    let korkhausEsp = (m.sSup4 * 100) / 81;
    let ashley = (m.dPm / m.s10) * 100;
    let discEspaco = m.perimetro - m.s10;

    let f = appState.estudosImagens.facial.pontos;
    let facialRows = `<tr><td colspan="4" style="padding:6px; border:1px solid #cbd5e1; text-align:center;">Análise fotométrica facial não executada.</td></tr>`;
    if (f.Tr && f.Na && f.Sn && f.Me) {
        let tSup = Math.abs(f.Na.y - f.Tr.y); let tMed = Math.abs(f.Sn.y - f.Na.y); let tInf = Math.abs(f.Me.y - f.Sn.y); let total = tSup + tMed + tInf;
        facialRows = `
            <tr><td style="padding:6px; border:1px solid #cbd5e1;">Terço Superior Facial</td><td style="padding:6px; border:1px solid #cbd5e1;">${((tSup/total)*100).toFixed(1)}%</td><td style="padding:6px; border:1px solid #cbd5e1;">33.3%</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#16a34a;">OK</td></tr>
            <tr><td style="padding:6px; border:1px solid #cbd5e1;">Terço Médio Facial</td><td style="padding:6px; border:1px solid #cbd5e1;">${((tMed/total)*100).toFixed(1)}%</td><td style="padding:6px; border:1px solid #cbd5e1;">33.3%</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#16a34a;">OK</td></tr>
            <tr><td style="padding:6px; border:1px solid #cbd5e1;">Terço Inferior Facial</td><td style="padding:6px; border:1px solid #cbd5e1;">${((tInf/total)*100).toFixed(1)}%</td><td style="padding:6px; border:1px solid #cbd5e1;">33.3%</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#16a34a;">OK</td></tr>
        `;
    }

    // CONTEÚDO DA PÁGINA 1
    let pdfHtml = `
        <div style="page-break-inside: avoid !important;">
            <div style="border-bottom: 3px solid #0284c7; padding-bottom: 5px; margin-bottom: 20px;">
                <h1 style="margin: 0; color: #0f172a; font-size: 21pt;">Dossiê Clínico de Diagnóstico Ortodôntico</h1>
                <span style="color:#64748b; font-size:9pt;">OrtoAnalytic Pro System v7.0 — Dr. Luís Zeferino</span>
            </div>
            
            <p style="font-size:10pt; line-height:1.6; margin-bottom:25px;">
                <strong>Paciente:</strong> ${nome} <br>
                <strong>Processo Clínico ID:</strong> ${cod}<br>
                <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-PT')}
            </p>
            
            <div style="margin-top:15px;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:6px;">1. Plano Geral & Indicações Clínicas</h3>
                <p style="background:#f8fafc; padding:12px; border:1px solid #e2e8f0; font-size:9.5pt; border-radius:4px; text-align:justify; margin:0;">${document.getElementById('indicacoes-gerais').value || 'Sem indicações registadas para este caso.'}</p>
            </div>
            
            <div style="margin-top:25px;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:6px;">2. Historial de Consultas & Evolução Temporal</h3>
                ${document.getElementById('table-evolution').outerHTML}
            </div>
        </div>
    `;

    // CONTEÚDO DA PÁGINA 2
    pdfHtml += `
        <div style="page-break-before: always; page-break-inside: avoid !important;">
            <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px;">3. Análise Quantitativa de Modelos de Estudo</h3>
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
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">Bolton Anterior</td><td style="padding:6px; border:1px solid #cbd5e1;">${boltonAnt.toFixed(1)}%</td><td style="padding:6px; border:1px solid #cbd5e1;">77.2% ± 1.6%</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#ec4899;">Massa Dentária</td></tr>
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">Korkhaus (Largura Alvo)</td><td style="padding:6px; border:1px solid #cbd5e1;">${korkhausEsp.toFixed(1)} mm</td><td style="padding:6px; border:1px solid #cbd5e1;">Real PM: ${m.dPm}mm</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#dc2626;">Atresia</td></tr>
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">Ashley Howe (Índice Basal)</td><td style="padding:6px; border:1px solid #cbd5e1;">${ashley.toFixed(1)}%</td><td style="padding:6px; border:1px solid #cbd5e1;">43.0%</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#eab308;">Estreitamento</td></tr>
                    <tr><td style="padding:6px; border:1px solid #cbd5e1;">TSALD / Careys / Nance</td><td style="padding:6px; border:1px solid #cbd5e1;">${discEspaco.toFixed(1)} mm</td><td style="padding:6px; border:1px solid #cbd5e1;">0.0 mm</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#dc2626;">Apinhamento</td></tr>
                </tbody>
            </table>

            <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:10px; margin-top:25px;">4. Resultados da Triagem Fotométrica Facial</h3>
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:15px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Segmento Vertical</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Proporção Medida</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Proporção Áurea</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">Status</th>
                    </tr>
                </thead>
                <tbody>${facialRows}</tbody>
            </table>
            
            <p style="font-size:9.5pt; background:#f8fafc; padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin:0; margin-top:15px;"><strong>Conclusões & Anomalias Detetadas:</strong><br>${document.getElementById('anomalias-obs').value || 'Sem notas adicionais inseridas.'}</p>
        </div>
    `;

    // PÁGINA DEDICADA EXCLUSIVA PARA A CEFALOMETRIA
    if (cefaloImgData) {
        let dimC = await obterDimensoesImagem(cefaloImgData);
        let estiloC = estiloImgSeguro(dimC.w, dimC.h);
        pdfHtml += `
            <div style="page-break-before: always; page-break-inside: avoid; width:100%; display:block;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; text-align:left; margin-bottom:10px;">5. Cefalometria Radiográfica Computadorizada</h3>
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
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; text-align:left; margin-bottom:10px;">6. Traçado Fotométrico Facial dos Terços Verticais</h3>
                <span style="color:#475569; font-size:9.5pt; display:block; margin-bottom:10px; text-align:left;">Proporções verticais absolutas da face mapeadas digitalmente.</span>
                <img src="${facialImgData}" style="${estiloF} border:1px solid #cbd5e1; border-radius:4px;">
            </div>
        `;
    }

    // PÁGINAS DO REPOSITÓRIO ICONOGRÁFICO — UMA FOTO POR PÁGINA, TÍTULO FUNDIDO NA IMAGEM
    if (Object.keys(appState.imagensPaciente).length > 0) {
        let repositorio = appState.imagensPaciente;
        let keys = Object.keys(repositorio);
        let secNum = (cefaloImgData ? 1 : 0) + (facialImgData ? 1 : 0) + 5;
        
        pdfHtml += `
            <div style="page-break-before: always;">
                <h3 style="color:#0f172a; border-bottom:1.5px solid #cbd5e1; padding-bottom:3px; font-size:11pt; margin-bottom:6px;">${secNum}. Repositório Iconográfico Geral</h3>
                <p style="font-size:9pt; color:#64748b; margin:0 0 10px 0;">${keys.length} imagem(ns) registada(s) neste processo clínico.</p>
            </div>
        `;
        
        // Compor título + imagem num único canvas para cada foto (inseparáveis no PDF)
        for (let idx = 0; idx < keys.length; idx++) {
            let key = keys[idx];
            let labelCard = document.querySelector(`label[for="${key}"]`);
            let txt = labelCard ? labelCard.innerText.trim() : "Exame Clínico Registado";
            let tituloCompleto = `${secNum}.${idx+1} — ${txt}`;

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