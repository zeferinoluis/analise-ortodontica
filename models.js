// ==========================================================================
// MODELS — cálculo da análise de modelos de gesso (Bolton, Korkhaus, etc.)
// ==========================================================================

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
