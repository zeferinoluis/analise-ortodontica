// ==========================================================================
// INTERPRETAÇÃO CLÍNICA AUTOMÁTICA — gera um texto de síntese a partir dos
// valores efetivamente medidos (cefalometria, facial, modelos), usando as
// MESMAS normas e limiares já definidos em cephalometry.js / facial.js /
// models.js. É sempre uma SUGESTÃO para revisão do clínico, nunca um
// diagnóstico definitivo nem texto fixo — se não houver pontos/calibração
// suficientes, a frase correspondente é simplesmente omitida.
// ==========================================================================

function interpretarClasseEsqueletica(sna, snb, anb) {
    let t = `Relação sagital maxilomandibular: SNA ${sna.toFixed(1)}°, SNB ${snb.toFixed(1)}°, ANB ${anb.toFixed(1)}°. `;
    if (anb > 4) {
        t += `Valores compatíveis com Classe II esquelética. `;
        const maxilaProtruida = sna > 84;
        const mandibulaRetruida = snb < 78;
        if (maxilaProtruida && !mandibulaRetruida) t += `O desvio parece dever-se sobretudo a uma maxila relativamente anteriorizada, sem retrusão mandibular marcada. `;
        else if (mandibulaRetruida && !maxilaProtruida) t += `O desvio parece dever-se sobretudo a uma mandíbula relativamente retruída. `;
        else if (maxilaProtruida && mandibulaRetruida) t += `Contribuem tanto a posição maxilar anteriorizada como a retrusão mandibular. `;
    } else if (anb < 0) {
        t += `Valores compatíveis com Classe III esquelética. `;
    } else {
        t += `Relação sagital dentro dos valores de referência (Classe I esquelética). `;
    }
    return t;
}

function interpretarPadraoVertical(snGoGn) {
    if (snGoGn == null || isNaN(snGoGn)) return '';
    let t = `Padrão vertical (SN–GoGn): ${snGoGn.toFixed(1)}°. `;
    if (snGoGn > 37) t += `Acima da norma — tendência hiperdivergente. `;
    else if (snGoGn < 27) t += `Abaixo da norma — tendência hipodivergente. `;
    else t += `Dentro da norma — padrão mesofacial, sem tendência marcada de hiper ou hipodivergência. `;
    return t;
}

function interpretarIncisivosSuperiores(angular, linear) {
    if (angular == null || isNaN(angular)) return '';
    let t = `Incisivo superior (U1–NA): ${angular.toFixed(1)}° / ${linear.toFixed(1)} mm. `;
    if (angular < 20 || linear < 2) t += `Sugere retroinclinação e/ou pouca protrusão dos incisivos superiores. `;
    else if (angular > 24 || linear > 6) t += `Sugere proinclinação e/ou protrusão dos incisivos superiores. `;
    else t += `Dentro dos valores de referência. `;
    return t;
}

function interpretarIncisivosInferiores(angular, linear) {
    if (linear == null || isNaN(linear)) return '';
    let t = `Incisivo inferior (L1–NB): ${linear.toFixed(1)} mm linear`;
    t += (angular != null && !isNaN(angular)) ? ` (${angular.toFixed(1)}° angular — confirmar manualmente este valor, o método clássico de Steiner mede o ângulo do lado oposto ao aqui calculado). ` : `. `;
    if (linear > 6) t += `Sugere protrusão/inclinação vestibular dos incisivos inferiores, com possível componente de compensação dentária. `;
    else if (linear < 2) t += `Sugere retroinclinação dos incisivos inferiores. `;
    else t += `Dentro dos valores de referência. `;
    return t;
}

function interpretarAnguloInterincisal(valor) {
    if (valor == null || isNaN(valor)) return '';
    let t = `Ângulo interincisal: ${valor.toFixed(1)}°. `;
    if (valor < 124) t += `Diminuído — incisivos relativamente mais proinclinados/"abertos" entre si. `;
    else if (valor > 136) t += `Aumentado — incisivos relativamente mais verticalizados entre si. `;
    else t += `Dentro dos valores de referência. `;
    return t;
}

function interpretarPerfilFacial(nasolabial, convexidade) {
    let partes = [];
    if (nasolabial != null && !isNaN(nasolabial)) {
        let t = `Ângulo nasolabial: ${nasolabial.toFixed(1)}°. `;
        if (nasolabial > 110) t += `Aumentado — compatível com retroinclinação dos incisivos superiores e/ou pouco suporte labial superior. `;
        else if (nasolabial < 90) t += `Diminuído — compatível com proinclinação dos incisivos superiores. `;
        else t += `Dentro dos valores de referência. `;
        partes.push(t);
    }
    if (convexidade != null && !isNaN(convexidade)) {
        let t = `Convexidade facial (Gl-Sn-Pg'): ${convexidade.toFixed(1)}°. `;
        if (Math.abs(convexidade - 12) > 4) t += convexidade > 16 ? `Perfil convexo. ` : `Perfil côncavo — se este resultado não parecer condizer com a fotografia ou com o ANB calculado, convém confirmar manualmente os pontos Gl, Sn e Pg'. `;
        else t += `Perfil reto, dentro da norma. `;
        partes.push(t);
    }
    return partes.join('');
}

function interpretarTransversalModelos(korkhausEsp, dPm, ashley, discEspaco, boltonAnt) {
    let partes = [];
    if (dPm < korkhausEsp) partes.push(`Korkhaus sugere atresia maxilar (largura inter-pré-molar ${dPm}mm inferior ao alvo de ${korkhausEsp.toFixed(1)}mm). `);
    if (ashley < 43) partes.push(`Índice de Ashley Howe (${ashley.toFixed(1)}%) sugere estreitamento da base apical. `);
    if (discEspaco < 0) partes.push(`Discrepância de espaço negativa (${discEspaco.toFixed(1)} mm) — sugere apinhamento. `);
    else if (discEspaco > 2) partes.push(`Discrepância de espaço positiva (${discEspaco.toFixed(1)} mm) — sugere espaçamento/diastemas. `);
    if (Math.abs(boltonAnt - 77.2) > 1.6) partes.push(`Índice de Bolton anterior (${boltonAnt.toFixed(1)}%) fora da norma — sugere discrepância de massa dentária, a considerar no acabamento. `);
    if (!partes.length) return `Análise de modelos dentro dos valores de referência, sem discrepâncias transversais ou de espaço relevantes. `;
    return partes.join('');
}

// Constrói o texto de síntese — 'escopo' limita o texto ao módulo ativo:
// 'cefalometria' | 'facial' | 'modelos' | 'todas' (combinado, usado por defeito se omitido)
function gerarInterpretacaoAutomatica(escopo) {
    escopo = escopo || 'todas';
    const partes = [];

    if (escopo === 'cefalometria' || escopo === 'todas') {
        const p = appState.estudosImagens.cefalometria.pontos;
        const scale = appState.estudosImagens.cefalometria.scalePxPerMm;

        let sna = null, snb = null;
        if (p.S && p.N && p.A) sna = obterAngulo(p.S, p.N, p.A);
        if (p.S && p.N && p.B) snb = obterAngulo(p.S, p.N, p.B);
        if (sna !== null && snb !== null) partes.push(interpretarClasseEsqueletica(sna, snb, sna - snb));

        if (p.S && p.N && p.Go && p.Gn) partes.push(interpretarPadraoVertical(anguloEntreLinhas(p.S, p.N, p.Go, p.Gn)));

        if (scale) {
            if (p.U1a && p.U1i && p.N && p.A) partes.push(interpretarIncisivosSuperiores(anguloEntreLinhas(p.U1a, p.U1i, p.N, p.A), distanciaPontoLinha(p.U1i, p.N, p.A) / scale));
            if (p.L1a && p.L1i && p.N && p.B) partes.push(interpretarIncisivosInferiores(anguloEntreLinhas(p.L1a, p.L1i, p.N, p.B), distanciaPontoLinha(p.L1i, p.N, p.B) / scale));
        }

        if (p.U1a && p.U1i && p.L1a && p.L1i) partes.push(interpretarAnguloInterincisal(anguloEntreLinhas(p.U1a, p.U1i, p.L1a, p.L1i)));
    }

    if (escopo === 'facial' || escopo === 'todas') {
        const pf = appState.estudosImagens.facial.pontos;
        let nasolabial = null, convexidade = null;
        if (pf.Prn && pf.Sn && pf.Ls) nasolabial = obterAngulo(pf.Prn, pf.Sn, pf.Ls);
        if (pf.Gl && pf.Sn && pf.PgL) convexidade = 180 - obterAngulo(pf.Gl, pf.Sn, pf.PgL);
        const blocoFacial = interpretarPerfilFacial(nasolabial, convexidade);
        if (blocoFacial) partes.push(blocoFacial);
    }

    if ((escopo === 'modelos' || escopo === 'todas') && appState.modelosRegistados) {
        const m = appState.dadosModelosBackup;
        const boltonAnt = (m.sInf6 / m.sSup6) * 100;
        const korkhausEsp = (m.sSup4 * 100) / 81;
        const ashley = (m.dPm / m.s10) * 100;
        const discEspaco = m.perimetro - m.s10;
        partes.push(interpretarTransversalModelos(korkhausEsp, m.dPm, ashley, discEspaco, boltonAnt));
    }

    if (!partes.length) {
        const mensagensVazio = {
            cefalometria: 'Dados insuficientes para gerar uma interpretação cefalométrica (marque mais pontos e/ou calibre a régua).',
            facial: 'Dados insuficientes para gerar uma interpretação facial (marque os pontos do perfil mole: Prn, Sn, Ls, Gl, Pg\').',
            modelos: 'Ainda não há modelos registados — prima "Guardar Modelos" após preencher os valores.',
            todas: 'Dados insuficientes para gerar uma interpretação automática (marque mais pontos anatómicos e/ou calibre a régua).'
        };
        return mensagensVazio[escopo] || mensagensVazio.todas;
    }

    return partes.filter(Boolean).join('\n\n') +
        '\n\n[Texto gerado automaticamente a partir dos valores medidos nesta ficha — sugestão de apoio à decisão, sujeita a validação clínica, exame intraoral, relação molar/canina e radiografia panorâmica antes de qualquer decisão terapêutica.]';
}

// Atualiza o rótulo do botão "Gerar Interpretação Sugerida" para indicar a que módulo se aplica
function atualizarRotuloInterpretacaoSugerida() {
    const btn = document.getElementById('btn-interpretacao-sugerida');
    if (!btn) return;
    const nomes = { cefalometria: 'Cefalometria', facial: 'Análise Facial', modelos: 'Modelos' };
    btn.textContent = `Gerar Interpretação Sugerida (${nomes[appState.tipoEstudo] || ''})`;
}

// Preenche o campo de observações com a interpretação automática, limitada ao módulo clínico ativo
// (Cefalometria / Facial / Modelos), pedindo confirmação se já houver texto escrito
function preencherInterpretacaoAutomatica() {
    const campo = document.getElementById('anomalias-obs');
    if (!campo) return;
    if (campo.value.trim() && !confirm('O campo de observações já tem texto. Substituir pela interpretação sugerida automaticamente?')) return;
    campo.value = gerarInterpretacaoAutomatica(appState.tipoEstudo);
}
