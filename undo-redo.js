// ==========================================================================
// UNDO/REDO — histórico de estados do traçado, por estudo ativo
// (cefalometria / facialFrente / facialPerfil). Atalhos: Ctrl+Z / Ctrl+Y.
// ==========================================================================

// Cada vista da fotometria facial tem a sua própria pilha de undo — trocar de
// vista não mistura nem apaga o histórico da outra.
let historicoEstados = { cefalometria: [], facialFrente: [], facialPerfil: [] };
let estadosRefazer = { cefalometria: [], facialFrente: [], facialPerfil: [] };
const LIMITE_HISTORICO_UNDO = 40;

function snapshotEstudoAtual() {
    const cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    return { pontos: JSON.parse(JSON.stringify(cEstudo.pontos)), scalePxPerMm: cEstudo.scalePxPerMm };
}

function guardarEstadoParaUndo() {
    const chave = chaveEstudoAtual();
    if (chave === 'modelos') return;
    const pilha = historicoEstados[chave];
    pilha.push(snapshotEstudoAtual());
    if (pilha.length > LIMITE_HISTORICO_UNDO) pilha.shift();
    estadosRefazer[chave] = [];
    atualizarBotoesUndoRedo();
}

function reiniciarHistoricoUndo() {
    historicoEstados = { cefalometria: [], facialFrente: [], facialPerfil: [] };
    estadosRefazer = { cefalometria: [], facialFrente: [], facialPerfil: [] };
    atualizarBotoesUndoRedo();
}

function aplicarSnapshot(snap) {
    const cEstudo = appState.estudosImagens[chaveEstudoAtual()];
    cEstudo.pontos = snap.pontos;
    cEstudo.scalePxPerMm = snap.scalePxPerMm;
    redrawCanvas();
    renderizarListaPontosDinamica();
    restaurarDescricaoPontoAtivo();
}

function desfazer() {
    const chave = chaveEstudoAtual();
    if (chave === 'modelos') return;
    const pilha = historicoEstados[chave];
    if (!pilha.length) return;
    estadosRefazer[chave].push(snapshotEstudoAtual());
    aplicarSnapshot(pilha.pop());
    atualizarBotoesUndoRedo();
}

function refazer() {
    const chave = chaveEstudoAtual();
    if (chave === 'modelos') return;
    const pilha = estadosRefazer[chave];
    if (!pilha.length) return;
    historicoEstados[chave].push(snapshotEstudoAtual());
    aplicarSnapshot(pilha.pop());
    atualizarBotoesUndoRedo();
}

function atualizarBotoesUndoRedo() {
    const bUndo = document.getElementById('btn-desfazer');
    const bRedo = document.getElementById('btn-refazer');
    const chave = chaveEstudoAtual();
    const semHistorico = chave === 'modelos' || !historicoEstados[chave] || !estadosRefazer[chave];
    if (bUndo) bUndo.disabled = semHistorico || historicoEstados[chave].length === 0;
    if (bRedo) bRedo.disabled = semHistorico || estadosRefazer[chave].length === 0;
}

document.addEventListener('keydown', function(e) {
    const tagAtiva = document.activeElement ? document.activeElement.tagName : '';
    if (tagAtiva === 'INPUT' || tagAtiva === 'TEXTAREA' || tagAtiva === 'SELECT') return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const tecla = e.key.toLowerCase();
    if (tecla === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); }
    else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) { e.preventDefault(); refazer(); }
});

// ---------------------------------------------------------------------
// DESCRIÇÃO DOS MARCOS ANATÓMICOS — painel lateral + tooltip no canvas
// ---------------------------------------------------------------------
