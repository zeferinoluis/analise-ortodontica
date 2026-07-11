// ==========================================================================
// DATABASE — IndexedDB local (gravar/carregar fichas) e backup manual .json
// ==========================================================================

let db;
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
        reiniciarHistoricoUndo();
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
function gravarPacienteNaBD() {
    if (!db) return alert("Base de dados ainda não está pronta. Aguarde um instante e tente novamente.");
    const idPac = document.getElementById('paciente-id').value;
    if (!idPac) return alert("Insira o ID do processo.");
    let pacote = { id: idPac, nome: document.getElementById('paciente-nome').value, nascimento: document.getElementById('paciente-nascimento').value, indicacoes: document.getElementById('indicacoes-gerais').value, obs: document.getElementById('anomalias-obs').value, appStateBackup: JSON.stringify(appState) };
    try {
        const transaction = db.transaction(["pacientes"], "readwrite");
        transaction.objectStore("pacientes").put(pacote);
        transaction.oncomplete = function() {
            document.getElementById('db-status').innerText = "✓ Sincronizado";
            alert("Ficha sincronizada!");
            // Se já houver ligação ativa ao Google Drive, sincroniza em segundo plano (sem bloquear nem exigir confirmação)
            if (gdriveAccessToken) sincronizarComDriveAgora(true);
        };
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
                reiniciarHistoricoUndo();
                atualizarInterfaceEstudo(); alert("Dados restaurados!");
            } catch (err) { alert("Registo encontrado mas corrompido: " + err.message); }
        };
        req.onerror = function() { alert("Erro ao consultar a base de dados local."); };
    } catch (err) { alert("Erro ao carregar: " + err.message); }
}

// Grava um pacote {id, nome, nascimento, indicacoes, obs, appStateBackup} diretamente na BD local,
// sem depender dos campos do formulário nem dos alertas de gravarPacienteNaBD() — usada pelo restauro do Drive.
function gravarPacoteDiretoNaBD(pacote) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de dados local ainda não está pronta. Aguarde um instante e tente novamente.'));
        if (!pacote || !pacote.id) return reject(new Error('Pacote inválido: falta o ID do processo.'));
        try {
            const transaction = db.transaction(["pacientes"], "readwrite");
            transaction.objectStore("pacientes").put(pacote);
            transaction.oncomplete = function() { resolve(); };
            transaction.onerror = function() { reject(new Error('Erro ao guardar na base de dados local.')); };
        } catch (err) { reject(err); }
    });
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
            reiniciarHistoricoUndo();
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
function obterTodosPacientes() {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de dados local ainda não está pronta.'));
        try {
            const req = db.transaction(['pacientes'], 'readonly').objectStore('pacientes').getAll();
            req.onsuccess = (e) => resolve(e.target.result || []);
            req.onerror = () => reject(new Error('Falha ao ler os pacientes da base de dados local.'));
        } catch (err) { reject(err); }
    });
}
