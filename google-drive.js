// ==========================================================================
// GOOGLE DRIVE — sincronização de backup cifrado na appDataFolder privada
// ==========================================================================

const GDRIVE_FILE_NAME = 'ortoanalytic_backup.json';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let gdriveTokenClient = null;
let gdriveAccessToken = null;
let gdriveFileId = localStorage.getItem('ortoanalytic_gdrive_file_id') || null;
let gdrivePassphraseSessao = ''; // guardada só em memória, nunca em localStorage

window.addEventListener('load', () => {
    const clientIdGuardado = localStorage.getItem('ortoanalytic_gdrive_clientid');
    if (clientIdGuardado) document.getElementById('gdrive-clientid').value = clientIdGuardado;

    const encriptarGuardado = localStorage.getItem('ortoanalytic_gdrive_encrypt') === 'true';
    document.getElementById('gdrive-encrypt').checked = encriptarGuardado;
    document.getElementById('gdrive-passphrase').style.display = encriptarGuardado ? 'inline-block' : 'none';

    atualizarUltimaSincronizacaoUI();
});

function atualizarUltimaSincronizacaoUI() {
    const ultima = localStorage.getItem('ortoanalytic_last_backup');
    const span = document.getElementById('gdrive-last-sync');
    if (!ultima) { span.innerText = ''; return; }
    const d = new Date(ultima);
    const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    span.innerText = `Último backup: ${dias === 0 ? 'hoje' : 'há ' + dias + ' dia(s)'}`;
}

function ligarGoogleDrive() {
    const clientId = document.getElementById('gdrive-clientid').value.trim();
    if (!clientId) { alert('Indique o Client ID OAuth do Google.'); return; }
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        alert('A biblioteca do Google ainda não carregou. Verifique a ligação à internet e tente novamente.');
        return;
    }
    localStorage.setItem('ortoanalytic_gdrive_clientid', clientId);

    gdriveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GDRIVE_SCOPE,
        callback: async (resp) => {
            if (resp.error) { document.getElementById('gdrive-status').innerText = 'Falha na autenticação: ' + resp.error; return; }
            gdriveAccessToken = resp.access_token;
            document.getElementById('gdrive-status').innerText = '✓ Ligado';
            document.getElementById('gdrive-sync-btn').style.display = 'inline-block';
            document.getElementById('gdrive-restore-btn').style.display = 'inline-block';
            document.getElementById('gdrive-connect-btn').innerText = 'Religar';

            const encriptar = document.getElementById('gdrive-encrypt').checked;
            localStorage.setItem('ortoanalytic_gdrive_encrypt', encriptar ? 'true' : 'false');
            if (encriptar) gdrivePassphraseSessao = document.getElementById('gdrive-passphrase').value;

            await sincronizarComDriveAgora();
        }
    });
    gdriveTokenClient.requestAccessToken({ prompt: '' });
}

async function deriveKeyGDrive(passphrase, saltBytes, uso) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: 150000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, [uso]);
}

function bytesParaBase64(bytes) {
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
}

async function encriptarPayloadGDrive(textoJSON, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKeyGDrive(passphrase, salt, 'encrypt');
    const dataBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(textoJSON));
    return JSON.stringify({
        encrypted: true,
        salt: bytesParaBase64(salt),
        iv: bytesParaBase64(iv),
        data: bytesParaBase64(new Uint8Array(dataBuf))
    });
}

async function encontrarFicheiroDrive() {
    const url = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=' + encodeURIComponent(`name='${GDRIVE_FILE_NAME}' and trashed=false`);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + gdriveAccessToken } });
    if (!r.ok) throw new Error('Falha ao procurar o ficheiro no Drive (' + r.status + ')');
    const data = await r.json();
    return (data.files && data.files[0]) || null;
}

async function enviarParaDrive(conteudoTexto) {
    const boundary = '-------ortoanalytic' + Date.now();
    const metadata = gdriveFileId ? {} : { name: GDRIVE_FILE_NAME, parents: ['appDataFolder'] };
    const corpo =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${conteudoTexto}\r\n` +
        `--${boundary}--`;

    const url = gdriveFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${gdriveFileId}?uploadType=multipart&fields=id,headRevisionId`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,headRevisionId`;

    const r = await fetch(url, {
        method: gdriveFileId ? 'PATCH' : 'POST',
        headers: { Authorization: 'Bearer ' + gdriveAccessToken, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: corpo
    });
    if (!r.ok) throw new Error('Falha ao enviar o backup para o Drive (' + r.status + ')');
    return r.json();
}

async function marcarRevisaoPermanente(fileId, revisionId) {
    if (!revisionId) return;
    try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + gdriveAccessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ keepForever: true })
        });
    } catch (e) { /* não crítico: a versão fica na cache normal do Drive mesmo que isto falhe */ }
}

// ==========================================================================
// RESTAURO A PARTIR DO GOOGLE DRIVE — descarrega o backup completo (todos os
// pacientes), desencripta se necessário, mostra uma lista para escolha e
// grava o paciente selecionado na BD local deste dispositivo.
// Espelha o mesmo esquema de desencriptação usado no recovery.html.
// ==========================================================================

let ultimoBackupPacientesDrive = [];
let ultimoFileIdRestauroDrive = null;

async function deriveKeyGDriveDecrypt(passphrase, saltB64) {
    const enc = new TextEncoder();
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decriptarPayloadGDrive(payload, passphrase) {
    const key = await deriveKeyGDriveDecrypt(passphrase, payload.salt);
    const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plainBuf);
}

// Lista as revisões marcadas como permanentes (keepForever) — cada sincronização bem-sucedida cria uma.
// É isto que permite recuperar um estado anterior mesmo depois de uma sincronização ter sobrescrito o atual.
async function listarRevisoesDrive(fileId) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime,keepForever)`, { headers: { Authorization: 'Bearer ' + gdriveAccessToken } });
    if (!r.ok) throw new Error('Falha ao listar versões (' + r.status + ')');
    const data = await r.json();
    let revs = (data.revisions || []).filter(x => x.keepForever);
    revs.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    return revs;
}

function popularSeletorVersoesDrive(revs) {
    const sel = document.getElementById('gdrive-restore-versao');
    sel.innerHTML = '<option value="">Versão atual (mais recente)</option>';
    revs.forEach(rv => {
        const d = new Date(rv.modifiedTime);
        const opt = document.createElement('option');
        opt.value = rv.id;
        opt.textContent = d.toLocaleDateString('pt-PT') + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        sel.appendChild(opt);
    });
}

// Descarrega e desencripta (se necessário) o conteúdo do ficheiro — versão atual ou uma revisão específica
async function carregarConteudoDriveERenderizar(fileId, revisionId) {
    const url = revisionId
        ? `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`
        : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + gdriveAccessToken } });
    if (!r.ok) throw new Error('Falha ao transferir esta versão (' + r.status + ')');
    let texto = await r.text();
    let payload = JSON.parse(texto);

    if (payload && payload.encrypted === true) {
        let pass = gdrivePassphraseSessao || document.getElementById('gdrive-passphrase').value;
        if (!pass) pass = prompt('Este backup está encriptado. Introduza a palavra-passe de encriptação:') || '';
        if (!pass) return;
        texto = await decriptarPayloadGDrive(payload, pass);
        payload = JSON.parse(texto);
        gdrivePassphraseSessao = pass;
    }

    if (!payload || !Array.isArray(payload.pacientes)) throw new Error('Backup sem lista de pacientes reconhecível.');
    mostrarListaRestauroDrive(payload.pacientes);
}

async function restaurarDoDriveAbrirLista() {
    if (!gdriveAccessToken) { alert('Ligue-se primeiro ao Google Drive.'); return; }
    const statusEl = document.getElementById('gdrive-status');
    try {
        statusEl.innerText = 'A procurar backups...';
        const file = await encontrarFicheiroDrive();
        if (!file) { alert('Não foi encontrado nenhum backup nesta conta Google.'); statusEl.innerText = '✓ Ligado'; return; }
        ultimoFileIdRestauroDrive = file.id;

        const revs = await listarRevisoesDrive(file.id);
        popularSeletorVersoesDrive(revs);

        await carregarConteudoDriveERenderizar(file.id, null);
        statusEl.innerText = '✓ Ligado';
    } catch (err) {
        statusEl.innerText = '✓ Ligado (falhou o restauro)';
        alert('Erro ao restaurar do Google Drive: ' + err.message);
    }
}

// Chamado quando o clínico muda o seletor de versão dentro do modal — recarrega a lista de pacientes dessa revisão
async function mudarVersaoRestauroDrive() {
    if (!ultimoFileIdRestauroDrive) return;
    const revisionId = document.getElementById('gdrive-restore-versao').value || null;
    const corpo = document.getElementById('gdrive-restore-lista');
    corpo.innerHTML = '<p style="color:#64748b; font-size:0.9rem;">A carregar esta versão...</p>';
    try {
        await carregarConteudoDriveERenderizar(ultimoFileIdRestauroDrive, revisionId);
    } catch (err) {
        alert('Erro ao carregar esta versão: ' + err.message);
        corpo.innerHTML = '';
    }
}

function mostrarListaRestauroDrive(pacientes) {
    ultimoBackupPacientesDrive = pacientes;
    const modal = document.getElementById('gdrive-restore-modal');
    const corpo = document.getElementById('gdrive-restore-lista');
    const filtro = document.getElementById('gdrive-restore-filtro');
    filtro.value = '';
    corpo.innerHTML = '';

    if (!pacientes.length) {
        corpo.innerHTML = '<p style="color:#64748b; font-size:0.9rem;">Nenhuma ficha encontrada nesta versão do backup. Experimente escolher uma versão mais antiga acima, se existir.</p>';
    } else {
        pacientes.forEach((pac, idx) => {
            const linha = document.createElement('div');
            linha.dataset.termo = `${pac.id || ''} ${pac.nome || ''}`.toLowerCase();
            linha.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px; padding:9px 4px; border-bottom:1px solid #e2e8f0;';
            const info = document.createElement('span');
            info.innerHTML = `<strong>${escaparHTML(pac.id || '—')}</strong> — ${escaparHTML(pac.nome || '(sem nome)')} <span style="color:#94a3b8; font-size:0.8em;">${escaparHTML(pac.nascimento || '')}</span>`;
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.style.cssText = 'width:auto; margin:0; background:#16a34a; color:white; border:none; flex-shrink:0;';
            btn.textContent = 'Restaurar aqui';
            btn.onclick = () => restaurarPacienteDoDrive(idx);
            linha.appendChild(info);
            linha.appendChild(btn);
            corpo.appendChild(linha);
        });
    }
    modal.style.display = 'flex';
}

function filtrarListaRestauroDrive() {
    const termo = document.getElementById('gdrive-restore-filtro').value.trim().toLowerCase();
    document.querySelectorAll('#gdrive-restore-lista > div').forEach(div => {
        div.style.display = (!termo || (div.dataset.termo || '').includes(termo)) ? 'flex' : 'none';
    });
}

function fecharModalRestauroDrive() {
    document.getElementById('gdrive-restore-modal').style.display = 'none';
}

function restaurarPacienteDoDrive(indice) {
    const pac = ultimoBackupPacientesDrive[indice];
    if (!pac) return;
    if (!confirm(`Restaurar a ficha de "${pac.nome || pac.id}" para este dispositivo?\n\nIsto substitui os dados atualmente no ecrã pelos dados do backup, e grava/atualiza o ID "${pac.id}" na base de dados local deste dispositivo.`)) return;

    try {
        document.getElementById('paciente-nome').value = pac.nome || '';
        document.getElementById('paciente-id').value = pac.id || '';
        document.getElementById('paciente-nascimento').value = pac.nascimento || '';
        document.getElementById('indicacoes-gerais').value = pac.indicacoes || '';
        document.getElementById('anomalias-obs').value = pac.obs || '';

        appState = normalizarAppState(JSON.parse(pac.appStateBackup));
        configureModelosInputs(appState.dadosModelosBackup);

        document.querySelectorAll('.preview').forEach(div => div.style.backgroundImage = 'none');
        for (let key in (appState.imagensPaciente || {})) {
            let pBox = document.getElementById(`prev-${key}`);
            if (pBox) pBox.style.backgroundImage = `url(${appState.imagensPaciente[key]})`;
        }

        reiniciarHistoricoUndo();
        atualizarInterfaceEstudo();
        if (typeof renderHistorico === 'function') renderHistorico();

        gravarPacoteDiretoNaBD(pac).then(() => {
            document.getElementById('db-status').innerText = '✓ Sincronizado';
            fecharModalRestauroDrive();
            alert('Ficha restaurada e guardada neste dispositivo!');
        }).catch(err => {
            fecharModalRestauroDrive();
            alert('A ficha foi restaurada no ecrã, mas falhou ao gravar na base de dados local: ' + err.message);
        });
    } catch (err) {
        alert('Erro ao aplicar a ficha restaurada: ' + err.message);
    }
}

async function sincronizarComDriveAgora(silencioso) {
    if (!gdriveAccessToken) { if (!silencioso) alert('Ligue-se primeiro ao Google Drive.'); return; }
    try {
        document.getElementById('gdrive-status').innerText = 'A sincronizar...';
        const pacientes = await obterTodosPacientes();

        // Salvaguarda crítica: nunca substituir um backup remoto já existente por uma lista vazia.
        // Isto acontece tipicamente quando a base de dados local foi apagada/limpa neste dispositivo
        // (ex: "remover dados do site" no browser) mas o Drive já ligado ainda tem fichas guardadas.
        if (pacientes.length === 0) {
            if (!gdriveFileId) {
                const existente = await encontrarFicheiroDrive();
                if (existente) { gdriveFileId = existente.id; localStorage.setItem('ortoanalytic_gdrive_file_id', gdriveFileId); }
            }
            if (gdriveFileId) {
                document.getElementById('gdrive-status').innerText = '✓ Ligado';
                if (!silencioso) alert('A base de dados local deste dispositivo está vazia, mas já existe um backup no Google Drive com fichas guardadas. Por segurança, a sincronização foi cancelada para não o apagar.\n\nSe pretende recuperar essas fichas para este dispositivo, use "Restaurar do Google Drive". Se realmente pretende esvaziar o backup remoto, isso tem de ser feito manualmente.');
                return;
            }
        }

        const payload = { pacientes, exportadoEm: new Date().toISOString(), origem: 'OrtoAnalytic Pro v7.0' };
        let conteudoTexto = JSON.stringify(payload);

        const encriptar = document.getElementById('gdrive-encrypt').checked;
        if (encriptar) {
            const passphrase = gdrivePassphraseSessao || document.getElementById('gdrive-passphrase').value;
            if (!passphrase) {
                document.getElementById('gdrive-status').innerText = '✓ Ligado';
                if (!silencioso) alert('Indique a palavra-passe de encriptação antes de sincronizar.');
                return;
            }
            gdrivePassphraseSessao = passphrase;
            conteudoTexto = await encriptarPayloadGDrive(conteudoTexto, passphrase);
        }

        if (!gdriveFileId) {
            const existente = await encontrarFicheiroDrive();
            if (existente) { gdriveFileId = existente.id; localStorage.setItem('ortoanalytic_gdrive_file_id', gdriveFileId); }
        }

        const resultado = await enviarParaDrive(conteudoTexto);
        if (resultado.id) { gdriveFileId = resultado.id; localStorage.setItem('ortoanalytic_gdrive_file_id', gdriveFileId); }
        await marcarRevisaoPermanente(gdriveFileId, resultado.headRevisionId);

        const agora = new Date().toISOString();
        localStorage.setItem('ortoanalytic_last_backup', agora);
        localStorage.setItem('ortoanalytic_gdrive_last_sync_time', agora);
        document.getElementById('gdrive-status').innerText = '✓ Ligado';
        atualizarUltimaSincronizacaoUI();
        if (!silencioso) alert('Backup sincronizado com o Google Drive (' + pacientes.length + ' ficha(s)).');
    } catch (err) {
        document.getElementById('gdrive-status').innerText = '✓ Ligado (falhou última sincronização)';
        if (!silencioso) alert('Erro ao sincronizar com o Google Drive: ' + err.message);
    }
}
