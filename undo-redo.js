// ==========================================================================
// UNDO/REDO — histórico de estados do traçado, por tipo de estudo
// (cefalometria / facial). Atalhos: Ctrl+Z / Ctrl+Y.
// ==========================================================================

let historicoEstados = { cefalometria: [], facial: [] };
let estadosRefazer = { cefalometria: [], facial: [] };
const LIMITE_HISTORICO_UNDO = 40;

function snapshotEstudoAtual() {
    const cEstudo = appState.estudosImagens[appState.tipoEstudo];
    return { pontos: JSON.parse(JSON.stringify(cEstudo.pontos)), scalePxPerMm: cEstudo.scalePxPerMm };
}

function guardarEstadoParaUndo() {
    if (appState.tipoEstudo === 'modelos') return;
    const pilha = historicoEstados[appState.tipoEstudo];
    pilha.push(snapshotEstudoAtual());
    if (pilha.length > LIMITE_HISTORICO_UNDO) pilha.shift();
    estadosRefazer[appState.tipoEstudo] = [];
    atualizarBotoesUndoRedo();
}

function reiniciarHistoricoUndo() {
    historicoEstados = { cefalometria: [], facial: [] };
    estadosRefazer = { cefalometria: [], facial: [] };
    atualizarBotoesUndoRedo();
}

function aplicarSnapshot(snap) {
    const cEstudo = appState.estudosImagens[appState.tipoEstudo];
    cEstudo.pontos = snap.pontos;
    cEstudo.scalePxPerMm = snap.scalePxPerMm;
    redrawCanvas();
    renderizarListaPontosDinamica();
    restaurarDescricaoPontoAtivo();
}

function desfazer() {
    if (appState.tipoEstudo === 'modelos') return;
    const pilha = historicoEstados[appState.tipoEstudo];
    if (!pilha.length) return;
    estadosRefazer[appState.tipoEstudo].push(snapshotEstudoAtual());
    aplicarSnapshot(pilha.pop());
    atualizarBotoesUndoRedo();
}

function refazer() {
    if (appState.tipoEstudo === 'modelos') return;
    const pilha = estadosRefazer[appState.tipoEstudo];
    if (!pilha.length) return;
    historicoEstados[appState.tipoEstudo].push(snapshotEstudoAtual());
    aplicarSnapshot(pilha.pop());
    atualizarBotoesUndoRedo();
}

function atualizarBotoesUndoRedo() {
    const bUndo = document.getElementById('btn-desfazer');
    const bRedo = document.getElementById('btn-refazer');
    const semHistorico = appState.tipoEstudo === 'modelos';
    if (bUndo) bUndo.disabled = semHistorico || historicoEstados[appState.tipoEstudo].length === 0;
    if (bRedo) bRedo.disabled = semHistorico || estadosRefazer[appState.tipoEstudo].length === 0;
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
