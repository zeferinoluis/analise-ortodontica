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

async function sincronizarComDriveAgora(silencioso) {
    if (!gdriveAccessToken) { if (!silencioso) alert('Ligue-se primeiro ao Google Drive.'); return; }
    try {
        document.getElementById('gdrive-status').innerText = 'A sincronizar...';
        const pacientes = await obterTodosPacientes();
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
