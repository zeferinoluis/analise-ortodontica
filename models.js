// ==========================================================================
// MODELS — análise quantitativa de modelos de estudo
//
// CORREÇÕES DESTA VERSÃO
// ----------------------
// 1) ÍNDICE DE BOLTON: antes era calculado como soma dos 6 anteriores INFERIORES
//    a dividir pelos 6 anteriores SUPERIORES — que é a proporção TOTAL, não a
//    anterior. Agora existem as duas, cada uma com a sua norma:
//      Bolton anterior = S4inf / S4sup × 100  (norma 77,2% ± 1,6)
//      Bolton total    = S6inf / S6sup × 100  (norma 91,3% ± 1,9)
// 2) KORKHAUS: estava a usar 100/81 (sobre a soma dos 4 incisivos) num campo
//    com a soma dos 6 anteriores. Agora usa a soma dos 4 incisivos superiores:
//      Largura inter-pré-molar prevista = S4sup × 100/80  (norma 33–35 mm aos 8 anos)
//      Largura inter-molar prevista     = S4sup × 100/64
//    e há também o índice de PONT (mesma base), para comparar com a largura real.
// 3) O perímetro do arco agora é o escolhido pelo clínico, não uma constante
//    fixa: deixou de ser sempre 74 mm. 4) Entrar 0 num campo deixou de ser
//    substituído pelo valor por omissão. 5) Valores incoerentes (discrepância
//    de mais de 25 mm, dentes maiores do que o arco, somas fora do plausível)
//    são assinalados em vez de produzirem um resultado silenciosamente errado.
// ==========================================================================

// Valores por omissão (dentição permanente, referências clínicas habituais)
const MODELOS_POR_OMISSAO = {
    sSup4: 32.0, sInf4: 24.0,   // soma mesio-distal dos 4 incisivos (mm)
    sSup6: 45.5, sInf6: 35.2,   // soma dos 6 anteriores (mm)
    dPmSup: 35.0, dMSup: 47.0,  // largura inter-pré-molar / inter-molar superior (mm)
    dPmInf: 34.0, dMInf: 46.0,  // as mesmas, na arcada inferior
    perimetroSup: 76.0, perimetroInf: 72.0, // perímetro de arco disponível (mm)
    s10sup: 78.0, s10inf: 76.0  // soma mesio-distal dos 10 dentes presentes (mm)
};

// Normas dos índices (as mesmas usadas no ecrã, no PDF e na interpretação)
const NORMAS_MODELOS = {
    boltonAnterior: 77.2, boltonAnteriorTol: 1.6,
    boltonTotal: 91.3, boltonTotalTol: 1.9,
    korkhausPmFator: 100 / 80, korkhausPFator: 100 / 64, // fatores de Pont / Korkhaus
    korkhausPmMin: 33, korkhausPmMax: 35,               // largura inter-pré-molar prevista (8 anos)
    ashleyMin: 43, ashleyMax: 45,                       // índice basal (Howes)
    pontPmFator: 100 / 80, pontMFator: 100 / 64,
    somaLimiteSuperior: 10, somaLimiteInferior: 8,      // coerência arco vs. dentes
    discrepanciaSuspeita: 25                            // acima disto, provável erro de leitura/medida
};

// Campos editáveis do painel: id no HTML ↔ chave em dadosModelosBackup
const CAMPOS_MODELOS = [
    { id: 'm-sup4', chave: 'sSup4', rotulo: 'Soma 4 Incisivos Superiores' },
    { id: 'm-inf4', chave: 'sInf4', rotulo: 'Soma 4 Incisivos Inferiores' },
    { id: 'm-sup6', chave: 'sSup6', rotulo: 'Soma 6 Anteriores Superiores' },
    { id: 'm-inf6', chave: 'sInf6', rotulo: 'Soma 6 Anteriores Inferiores' },
    { id: 'm-distpm-sup', chave: 'dPmSup', rotulo: 'Largura Inter-Pré-Molar Superior' },
    { id: 'm-distm-sup', chave: 'dMSup', rotulo: 'Largura Inter-Molar Superior' },
    { id: 'm-distpm-inf', chave: 'dPmInf', rotulo: 'Largura Inter-Pré-Molar Inferior' },
    { id: 'm-distm-inf', chave: 'dMInf', rotulo: 'Largura Inter-Molar Inferior' },
    { id: 'm-perimetro-sup', chave: 'perimetroSup', rotulo: 'Perímetro de Arco Superior Disponível' },
    { id: 'm-perimetro-inf', chave: 'perimetroInf', rotulo: 'Perímetro de Arco Inferior Disponível' },
    { id: 'm-soma10-sup', chave: 's10sup', rotulo: 'Soma Mesiostial 10 Dentes (superior)' },
    { id: 'm-soma10-inf', chave: 's10inf', rotulo: 'Soma Mesiostial 10 Dentes (inferior)' }
];

// Leva os valores guardados para os campos do painel (sem inventar valores em falta)
function configureModelosInputs(m) {
    const dados = Object.assign({}, MODELOS_POR_OMISSAO, migrarModelosLegado(m));
    CAMPOS_MODELOS.forEach(campo => {
        const el = document.getElementById(campo.id);
        if (el && dados[campo.chave] !== undefined && dados[campo.chave] !== null) el.value = dados[campo.chave];
    });
}

// Fichas antigas: dPm/dM/perimetro/s10 passam a ter versões superior e inferior.
// O perímetro antigo (74 mm) era superior por omissão; assinala-se o que foi assumido.
function migrarModelosLegado(m) {
    if (!m || typeof m !== 'object') return {};
    const novo = Object.assign({}, m);
    if (novo.dPm !== undefined && novo.dPmSup === undefined) novo.dPmSup = novo.dPm;
    if (novo.dM !== undefined && novo.dMSup === undefined) novo.dMSup = novo.dM;
    if (novo.perimetro !== undefined && novo.perimetroSup === undefined) novo.perimetroSup = novo.perimetro;
    if (novo.s10 !== undefined && novo.s10sup === undefined) novo.s10sup = novo.s10;
    delete novo.dPm; delete novo.dM; delete novo.perimetro; delete novo.s10;
    return novo;
}

// Lê o painel; devolve os valores numéricos e a lista de campos que não são números válidos
function lerDadosModelos() {
    const bruto = {};
    const invalidos = [];
    CAMPOS_MODELOS.forEach(campo => {
        const el = document.getElementById(campo.id);
        const texto = el && el.value !== undefined && el.value !== null ? String(el.value).trim() : '';
        const num = texto === '' ? NaN : parseFloat(texto);
        if (isNaN(num) || num < 0) {
            invalidos.push(campo.rotulo);
            bruto[campo.chave] = MODELOS_POR_OMISSAO[campo.chave];
        } else {
            bruto[campo.chave] = num;
        }
        if (el) el.style.borderColor = (isNaN(num) || num < 0) ? '#dc2626' : '';
    });
    return { dados: bruto, invalidos };
}

// --------------------------------------------------------------------------
// CÁLCULO — devolve todas as métricas, o estado de cada uma e os avisos
// --------------------------------------------------------------------------
function calcularMetricasModelos(dados) {
    const d = Object.assign({}, MODELOS_POR_OMISSAO, dados || {});
    const divisivel = (a, b) => (b ? a / b : null);

    // Índices de Bolton (proporção de massa dentária)
    const boltonAnterior = divisivel(d.sInf4 * 100, d.sSup4);
    const boltonTotal = divisivel(d.sInf6 * 100, d.sSup6);

    // Korkhaus / Pont: largura prevista a partir da soma dos 4 incisivos superiores
    const korkhausPm = d.sSup4 * NORMAS_MODELOS.korkhausPmFator;
    const korkhausM = d.sSup4 * NORMAS_MODELOS.korkhausPFator;
    const pontPmInf = d.sInf4 * NORMAS_MODELOS.pontPmFator;
    const pontMInf = d.sInf4 * NORMAS_MODELOS.pontMFator;

    // Índice basal de Howes: perímetro do arco disponível a dividir pela soma
    // mesiostial dos dentes presentes, em percentagem da metade dessa soma:
    //   Howes = (perímetro ÷ soma dos dentes) × 50      (norma 43–45%)
    // O quociente simples perímetro/soma só é interpretável como índice de Howes
    // desta forma; a proporção direta dentes/perímetro é o seu recíproco.
    const ashleySup = divisivel(d.perimetroSup * 50, d.s10sup);
    const ashleyInf = divisivel(d.perimetroInf * 50, d.s10inf);

    // Discrepância de espaço por arcada
    const discrepanciaSup = d.perimetroSup - d.s10sup;
    const discrepanciaInf = d.perimetroInf - d.s10inf;

    // Avaliações de coerência
    const avisos = [];
    if (boltonAnterior !== null && Math.abs(boltonAnterior - NORMAS_MODELOS.boltonAnterior) > NORMAS_MODELOS.boltonAnteriorTol) {
        avisos.push(`Bolton anterior ${boltonAnterior.toFixed(1)}% (norma ${NORMAS_MODELOS.boltonAnterior}% ± ${NORMAS_MODELOS.boltonAnteriorTol}) — discrepância de massa dentária: ${boltonAnterior > NORMAS_MODELOS.boltonAnterior ? 'dentes inferiores grandes para os superiores' : 'dentes superiores grandes para os inferiores'}.`);
    }
    if (boltonTotal !== null && Math.abs(boltonTotal - NORMAS_MODELOS.boltonTotal) > NORMAS_MODELOS.boltonTotalTol) {
        avisos.push(`Bolton total ${boltonTotal.toFixed(1)}% (norma ${NORMAS_MODELOS.boltonTotal}% ± ${NORMAS_MODELOS.boltonTotalTol}) — discrepância de massa dentária em toda a arcada.`);
    }
    [[discrepanciaSup, 'superior'], [discrepanciaInf, 'inferior']].forEach(([disc, nome]) => {
        if (Math.abs(disc) > NORMAS_MODELOS.discrepanciaSuspeita) avisos.push(`Discrepância de espaço ${nome} de ${disc.toFixed(1)} mm é implausível — confirme o perímetro e/ou a soma mesiostial (as duas medições devem terminar no mesmo dente).`);
    });
    if (d.s10sup > d.perimetroSup && d.s10inf > d.perimetroInf) {
        avisos.push('A soma dos dentes excede o perímetro nas duas arcadas — sem espaço disponível; confirmar se as medições cobrem os mesmos dentes.');
    }
    [[ashleySup, 'superior'], [ashleyInf, 'inferior']].forEach(([h, nome]) => {
        if (h !== null && h < NORMAS_MODELOS.ashleyMin) avisos.push(`Índice de Howes ${nome} ${h.toFixed(1)}% (norma ${NORMAS_MODELOS.ashleyMin}–${NORMAS_MODELOS.ashleyMax}%) — arco apertado para os dentes presentes, compatível com apinhamento.`);
    });
    const faixa = (v, min, max) => v >= min && v <= max;
    if (!faixa(d.sSup4, 20, 42) || !faixa(d.sInf4, 15, 32)) avisos.push('Soma dos incisivos fora da faixa habitual (superior 20–42 mm, inferior 15–32 mm) — confirmar as medições.');
    if (!faixa(d.sSup6, 32, 52) || !faixa(d.sInf6, 26, 40)) avisos.push('Soma dos 6 anteriores fora da faixa habitual — confirmar as medições.');

    return {
        dados: d,
        boltonAnterior, boltonTotal,
        korkhausPm, korkhausM, pontPmInf, pontMInf,
        ashleySup, ashleyInf,
        discrepanciaSup, discrepanciaInf,
        avisos
    };
}

// --------------------------------------------------------------------------
// APRESENTAÇÃO NO ECRÃ
// --------------------------------------------------------------------------
function linhaBolton(rotulo, valor, norma, tol) {
    const ok = valor !== null && Math.abs(valor - norma) <= tol;
    const texto = valor === null ? 'Dados insuficientes' : (ok ? 'Normal' : (valor > norma ? 'Inferior grande p/ superior' : 'Superior grande p/ inferior'));
    return { grupo: 'Massa Dentária (Bolton)', label: rotulo, valor: valor === null ? '—' : valor.toFixed(1) + '%', norma: norma.toFixed(1) + '% ± ' + tol, status: valor === null ? 'status-dev' : (ok ? 'status-ok' : 'status-dev'), texto };
}

function calcularResultadosModelos() {
    const { dados, invalidos } = lerDadosModelos();
    const r = calcularMetricasModelos(dados);
    const d = r.dados;
    const linhas = [];

    linhas.push(linhaBolton('Bolton Anterior (S4inf / S4sup)', r.boltonAnterior, NORMAS_MODELOS.boltonAnterior, NORMAS_MODELOS.boltonAnteriorTol));
    linhas.push(linhaBolton('Bolton Total (S6inf / S6sup)', r.boltonTotal, NORMAS_MODELOS.boltonTotal, NORMAS_MODELOS.boltonTotalTol));

    const linhaTransversal = (grupo, label, previsto, real, minNorma, unidade) => {
        const desvio = real - previsto;
        const ok = Math.abs(desvio) <= 4; // tolerância prática de ±4 mm no confronto previsto/real
        return { grupo, label, valor: real.toFixed(1) + unidade, norma: previsto.toFixed(1) + unidade + ' previsto', status: ok ? 'status-ok' : 'status-dev', texto: ok ? 'Concordante' : (desvio < 0 ? 'Atresia ' + Math.abs(desvio).toFixed(1) + unidade : 'Excesso ' + desvio.toFixed(1) + unidade) };
    };
    linhas.push({ grupo: 'Transversal (Korkhaus / Pont)', label: '— Korkhaus, a partir dos 4 incisivos superiores —', valor: '', norma: '', status: '', texto: '' });
    linhas.push(linhaTransversal('Transversal (Korkhaus / Pont)', 'Inter-Pré-Molar Superior (real vs. previsto)', r.korkhausPm, d.dPmSup, NORMAS_MODELOS.korkhausPmMin, ' mm'));
    linhas.push(linhaTransversal('Transversal (Korkhaus / Pont)', 'Inter-Molar Superior (real vs. previsto)', r.korkhausM, d.dMSup, null, ' mm'));
    linhas.push({ grupo: 'Transversal (Korkhaus / Pont)', label: '— Pont, a partir dos 4 incisivos inferiores —', valor: '', norma: '', status: '', texto: '' });
    linhas.push(linhaTransversal('Transversal (Korkhaus / Pont)', 'Inter-Pré-Molar Inferior (real vs. previsto)', r.pontPmInf, d.dPmInf, null, ' mm'));
    linhas.push(linhaTransversal('Transversal (Korkhaus / Pont)', 'Inter-Molar Inferior (real vs. previsto)', r.pontMInf, d.dMInf, null, ' mm'));
    const pmPrevistoOk = r.korkhausPm >= NORMAS_MODELOS.korkhausPmMin && r.korkhausPm <= NORMAS_MODELOS.korkhausPmMax;
    linhas.push({ grupo: 'Transversal (Korkhaus / Pont)', label: 'Largura Inter-Pré-Molar Prevista (Korkhaus)', valor: r.korkhausPm.toFixed(1) + ' mm', norma: NORMAS_MODELOS.korkhausPmMin + '–' + NORMAS_MODELOS.korkhausPmMax + ' mm (8 anos)', status: pmPrevistoOk ? 'status-ok' : 'status-dev', texto: pmPrevistoOk ? 'Dentro do previsto' : 'Fora do previsto para a idade' });

    const linhaHowes = (rotulo, valor) => {
        const dentro = valor !== null && valor >= NORMAS_MODELOS.ashleyMin && valor <= NORMAS_MODELOS.ashleyMax;
        const texto = valor === null ? 'Dados insuficientes'
            : dentro ? 'Normal'
            : (valor < 40 ? 'Dentes grandes para o arco — apinhamento provável'
            : (valor < NORMAS_MODELOS.ashleyMin ? 'Estreitamento ligeiro' : 'Arco amplo para os dentes presentes'));
        return { grupo: 'Relação Dentes / Arco (Howes)', label: rotulo, valor: valor === null ? '—' : valor.toFixed(1) + '%', norma: NORMAS_MODELOS.ashleyMin + '% – ' + NORMAS_MODELOS.ashleyMax + '%', status: valor === null ? 'status-dev' : (dentro ? 'status-ok' : 'status-dev'), texto };
    };
    linhas.push(linhaHowes('Howes: (perímetro / soma 10 dentes) × 50 — superior', r.ashleySup));
    linhas.push(linhaHowes('Howes: (perímetro / soma 10 dentes) × 50 — inferior', r.ashleyInf));

    const linhaDiscrepancia = (rotulo, valor) => ({ grupo: 'Discrepância de Espaço', label: rotulo, valor: valor.toFixed(1) + ' mm', norma: '0.0 mm', status: Math.abs(valor) <= 2 ? 'status-ok' : 'status-dev', texto: Math.abs(valor) <= 2 ? 'Equilibrado' : (valor < 0 ? 'Apinhamento' : 'Espaço sobrando') });
    linhas.push(linhaDiscrepancia('Perímetro do Arco − Soma Mesiostial (superior)', r.discrepanciaSup));
    linhas.push(linhaDiscrepancia('Perímetro do Arco − Soma Mesiostial (inferior)', r.discrepanciaInf));

    return { linhas, invalidos, avisos: r.avisos };
}

// Mantida por compatibilidade com chamadas antigas
function executarCalculosModelosPuros() {
    renderizarResultadosModelos();
}

function renderizarResultadosModelos() {
    const { linhas, invalidos, avisos } = calcularResultadosModelos();
    let html = renderizarTabelaResultados(linhas, 'Preencha os dados dos modelos.');
    if (invalidos.length) {
        html += `<tr><td colspan="4" style="background:#fef2f2; color:#b91c1c; font-size:0.8rem;">Campos por preencher ou inválidos (assinalados a vermelho): ${escaparHTML(invalidos.join(', '))}. Foi usado o valor de referência por omissão.</td></tr>`;
    }
    if (avisos.length) {
        html += `<tr><td colspan="4" style="background:#fffbeb; color:#92400e; font-size:0.8rem;"><strong>Verificar antes de concluir:</strong><br>${avisos.map(a => '• ' + escaparHTML(a)).join('<br>')}</td></tr>`;
    }
    document.getElementById('results-tbody').innerHTML = html;
}

// Guarda os dados dos modelos no estado (e usa-os como base dos cálculos seguintes)
function processarEGuardarModelos() {
    const { dados, invalidos } = lerDadosModelos();
    if (invalidos.length) {
        if (!confirm(`Há campos inválidos ou por preencher:\n\n• ${invalidos.join('\n• ')}\n\nGuardar na mesma? (os cálculos usam os valores de referência por omissão nesses campos)`)) return;
    }
    const r = calcularMetricasModelos(dados);
    appState.dadosModelosBackup = r.dados;
    appState.modelosRegistados = true;
    renderizarResultadosModelos();
    const resumo = `Bolton ant. ${r.boltonAnterior !== null ? r.boltonAnterior.toFixed(1) + '%' : '—'} | Bolton total ${r.boltonTotal !== null ? r.boltonTotal.toFixed(1) + '%' : '—'} | Disc. espaço sup. ${r.discrepanciaSup.toFixed(1)} mm / inf. ${r.discrepanciaInf.toFixed(1)} mm`;
    appState.historicoConsultas.push({ data: document.getElementById('data-exame').value, tipo: 'MODELOS', resumo: resumo, obs: document.getElementById('anomalias-obs').value });
    alert(r.avisos.length ? 'Modelos registados! Atenção aos avisos de coerência na tabela de resultados.' : 'Modelos registados!');
}
