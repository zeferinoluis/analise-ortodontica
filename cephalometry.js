// ==========================================================================
// CEPHALOMETRY — cálculo das análises Steiner / Downs / Tweed
// ==========================================================================

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

function calcularCefalometriaAvancada() {
    const seletor = document.getElementById('tipo-analise-cefalo');
    const tipo = seletor ? seletor.value : 'steiner';
    const linhas = calcularResultadosCefalometricosCompleto(tipo);
    document.getElementById('results-tbody').innerHTML = renderizarTabelaResultados(linhas);
}

// Calcula todas as linhas de resultado da análise facial (terços, perfil mole, proporções horizontais)
