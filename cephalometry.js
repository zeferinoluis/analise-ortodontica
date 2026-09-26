// ==========================================================================
// CEPHALOMETRY — cálculo das análises Steiner / Downs / Tweed
//
// CONVENÇÕES GEOMÉTRICAS (corrigidas nesta versão)
// ------------------------------------------------
// 1) As "linhas" da cefalometria são segmentos com direção anatómica (ex.: eixo
//    do incisivo, do bordo incisal para o ápice), não retas infinitas. Medir o
//    ângulo entre retas-suporte (0–180°, forma aguda) devolve o SUPLEMENTO do
//    valor clínico sempre que o dente está inclinado para o lado oposto ao da
//    norma. Era a causa de IMPA, FMIA, U1–NA e L1–NB saírem trocados (p. ex. um
//    incisivo vestibularizado a dar ~75° em vez de ~105°).
//    Aqui a mesma medição é sempre devolvida no intervalo 0–180° que contém a
//    norma publicada — ver anguloComNorma() em utils.js.
// 2) O ângulo interincisal usa a convenção clássica (eixo U1 vs eixo L1): um
//    incisivo vestibularizado dá > 90°, um retroinclinado dá < 90°; norma 130°.
// 3) Cada análise usa o seu plano de referência clássico:
//      Steiner → plano SN (SN–GoGn, U1–NA, L1–NB, interincisal)
//      Downs   → plano de Frankfort (Or–Po): ângulo facial, convexidade,
//                plano AB, plano mandibular/FH e eixo Y
//      Tweed   → plano mandibular + FH (FMA, FMIA, IMPA), com FMA = FMIA + IMPA
// 4) A app assume coordenadas com y a crescer para baixo (canvas do browser). Se
//    a imagem for carregada com y invertido, o interincisal aparece invertido
//    (~50° em vez de ~130°) — ver aviso no resultado.
// ==========================================================================

// Ângulo entre duas retas-suporte (0–180°, forma aguda). Só para planos/linhas
// em que a direção não tem significado anatómico.
function anguloEntreLinhasSeguro(a1, a2, b1, b2) {
    if (!a1 || !a2 || !b1 || !b2) return null;
    return anguloEntreLinhas(a1, a2, b1, b2);
}

// FMIA (Tweed) — ângulo entre o plano de Frankfort e o eixo do incisivo inferior.
// É derivado de FMA e IMPA pela identidade do triângulo de Tweed
// (FMA + FMIA + IMPA = 180°), em vez de medido de forma independente: o IMPA é
// medido com direção anatómica (anguloImpa) e o FMIA fica assim coerente com ele.
// Devolve null se faltar algum dos ângulos necessários.
function anguloFmia(fma, impa) {
    if (fma === null || impa === null) return null;
    return 180 - fma - impa;
}

// Ângulo do eixo Y (Downs): linha S–Gn medida em relação ao plano de Frankfort.
// É o ângulo agudo entre as duas linhas-suporte (norma 59,4°), pelo que não
// depende do sentido com que Or e Po foram marcados.
function anguloEixoY(S, Gn, Or, Po) {
    if (!S || !Gn || !Or || !Po) return null;
    const bruto = anguloEntreLinhas(S, Gn, Or, Po);
    return bruto <= 90 ? bruto : 180 - bruto;
}

// Ângulo interincisal, na convenção clínica (norma 130°).
// É o suplemento do ângulo agudo entre os dois eixos incisivos (ápice → bordo
// incisal): incisivos convergentes (caso habitual) dão ~130°, incisivos paralelos
// no mesmo sentido do plano palatino dão ~180°. Esta definição é a única
// compatível com o triângulo de Tweed (FMA + FMIA + IMPA = 180°).
function anguloInterincisal(U1a, U1i, L1a, L1i) {
    const agudo = anguloEntreLinhasSeguro(U1a, U1i, L1a, L1i);
    if (agudo === null) return null;
    return 180 - agudo;
}

// --------------------------------------------------------------------------
// CÁLCULO PRINCIPAL
// --------------------------------------------------------------------------
function calcularResultadosCefalometricosCompleto(tipo) {
    const cEstudo = appState.estudosImagens.cefalometria;
    const p = cEstudo.pontos;
    const scale = cEstudo.scalePxPerMm;
    const linhas = [];
    const tem = (...ids) => ids.every(id => !!p[id]);

    // ---------------------------------------------------------------- Geral
    let sna = null, snb = null;
    if (tem('S', 'N', 'A')) sna = obterAngulo(p.S, p.N, p.A);
    if (tem('S', 'N', 'B')) snb = obterAngulo(p.S, p.N, p.B);
    if (sna !== null) linhas.push(linhaMedida('Geral', 'Ângulo SNA', sna, '°', 82, 2));
    if (snb !== null) linhas.push(linhaMedida('Geral', 'Ângulo SNB', snb, '°', 80, 2));
    if (sna !== null && snb !== null) {
        const anb = sna - snb;
        const classe = anb > 4 ? 'Classe II' : (anb < 0 ? 'Classe III' : 'Classe I');
        linhas.push(linhaMedida('Geral', 'Ângulo ANB', anb, '°', 2, 2, classe));
    }
    if (tem('S', 'N')) {
        if (scale) linhas.push(linhaMedida('Geral', 'Distância N-S', distanciaPontos(p.S, p.N) / scale, 'mm', 75, 4));
        else linhas.push(linhaSemCalibragem('Geral', 'Distância N-S', 75, 'mm'));
    }
    // Altura facial posterior/anterior (Jarabak) — leitura simples do padrão vertical
    if (tem('S', 'Go', 'N', 'Me')) {
        const afh = distanciaPontos(p.N, p.Me);
        if (afh) linhas.push(linhaMedida('Geral', 'Proporção Alt. Facial Post./Ant. (S-Go / N-Me)', distanciaPontos(p.S, p.Go) / afh, '', 0.65, 0.05, 'Informativo'));
    }
    if (tem('U1a', 'U1i', 'L1a', 'L1i')) {
        const interincisal = anguloInterincisal(p.U1a, p.U1i, p.L1a, p.L1i);
        const suspeito = interincisal < 90;
        linhas.push({
            grupo: 'Geral',
            label: 'Ângulo Interincisal',
            valor: interincisal.toFixed(1) + '°',
            norma: '130.0° ± 6',
            status: Math.abs(interincisal - 130) <= 6 ? 'status-ok' : 'status-dev',
            texto: Math.abs(interincisal - 130) <= 6 ? 'Normal' : (suspeito ? 'Aberto — confirmar orientação da imagem (y invertido?)' : 'Fechado/vestibularizado')
        });
    }

    // -------------------------------------------------------------- Steiner
    if (tipo === 'steiner' || tipo === 'todas') {
        linhas.push({ grupo: 'Steiner (plano SN)', label: '— Referência: plano SN —', valor: '', norma: '', status: '', texto: '' });
        const snGoGn = tem('S', 'N', 'Go', 'Gn') ? anguloEntreLinhas(p.S, p.N, p.Go, p.Gn) : null;
        if (snGoGn !== null) linhas.push(linhaMedida('Steiner (plano SN)', 'SN–GoGn (Plano Mandibular)', snGoGn, '°', 32, 5));

        const u1naAng = tem('U1a', 'U1i', 'N', 'A') ? anguloComNorma(p.U1i, p.U1a, p.N, p.A, 22) : null;
        if (u1naAng !== null) linhas.push(linhaMedida('Steiner (plano SN)', 'U1–NA (angular)', u1naAng, '°', 22, 2, 'Magnitude — a direção lê-se no U1–NA linear'));
        if (tem('U1i', 'N', 'A')) {
            if (scale) linhas.push(linhaMedida('Steiner (plano SN)', 'U1–NA (linear)', distanciaPontoLinha(p.U1i, p.N, p.A) / scale, 'mm', 4, 2));
            else linhas.push(linhaSemCalibragem('Steiner (plano SN)', 'U1–NA (linear)', 4, 'mm'));
        }
        const l1nbAng = tem('L1a', 'L1i', 'N', 'B') ? anguloComNorma(p.L1i, p.L1a, p.N, p.B, 25) : null;
        if (l1nbAng !== null) linhas.push(linhaMedida('Steiner (plano SN)', 'L1–NB (angular)', l1nbAng, '°', 25, 2, 'Magnitude — a direção lê-se no L1–NB linear'));
        if (tem('L1i', 'N', 'B')) {
            if (scale) linhas.push(linhaMedida('Steiner (plano SN)', 'L1–NB (linear)', distanciaPontoLinha(p.L1i, p.N, p.B) / scale, 'mm', 4, 2));
            else linhas.push(linhaSemCalibragem('Steiner (plano SN)', 'L1–NB (linear)', 4, 'mm'));
        }
    }

    // --------------------------------------------------------------- Downs
    if (tipo === 'downs' || tipo === 'todas') {
        linhas.push({ grupo: 'Downs (plano de Frankfort)', label: '— Referência: plano FH (Or–Po) —', valor: '', norma: '', status: '', texto: '' });
        const angFacial = tem('Or', 'Po', 'N', 'Pg') ? anguloEntreLinhas(p.Or, p.Po, p.N, p.Pg) : null;
        if (angFacial !== null) linhas.push(linhaMedida('Downs (plano de Frankfort)', 'Ângulo Facial (FH / N-Pg)', angFacial, '°', 87.8, 3.6));
        if (tem('N', 'A', 'Pg')) {
            const conv = 180 - obterAngulo(p.N, p.A, p.Pg);
            linhas.push({ grupo: 'Downs (plano de Frankfort)', label: 'Convexidade (N-A-Pg)', valor: conv.toFixed(1) + '°', norma: '0.0° ± 5.1', status: Math.abs(conv) <= 5.1 ? 'status-ok' : 'status-dev', texto: Math.abs(conv) <= 5.1 ? 'Reto' : (conv > 0 ? 'Perfil Convexo' : 'Perfil Côncavo') });
        }
        if (tem('A', 'B', 'N', 'Pg')) linhas.push(linhaMedida('Downs (plano de Frankfort)', 'Plano AB / N-Pg', anguloEntreLinhas(p.A, p.B, p.N, p.Pg), '°', 4.6, 3.7));
        if (tem('Or', 'Po', 'Go', 'Gn')) linhas.push(linhaMedida('Downs (plano de Frankfort)', 'Plano Mandibular / FH', anguloEntreLinhas(p.Or, p.Po, p.Go, p.Gn), '°', 21.9, 3.5));
        const eixoY = tem('S', 'Gn', 'Or', 'Po') ? anguloEixoY(p.S, p.Gn, p.Or, p.Po) : null;
        if (eixoY !== null) linhas.push(linhaMedida('Downs (plano de Frankfort)', 'Eixo Y (S-Gn / FH)', eixoY, '°', 59.4, 3.8));
    }

    // --------------------------------------------------------------- Tweed
    if (tipo === 'tweed' || tipo === 'todas') {
        linhas.push({ grupo: 'Tweed (FH + plano mandibular)', label: '— Referência: FH + plano mandibular —', valor: '', norma: '', status: '', texto: '' });
        // Mandibular plane = Go–Gn. Nestes pontos a reta-suporte é a mesma, pelo que
        // uma única medição serve de FMA; FMA = FMIA + IMPA (triângulo de Tweed).
        const fma = tem('Or', 'Po', 'Go', 'Gn') ? anguloEntreLinhas(p.Or, p.Po, p.Go, p.Gn) : null;
        if (fma !== null) linhas.push(linhaMedida('Tweed (FH + plano mandibular)', 'FMA (FH / Plano Mandibular)', fma, '°', 25, 5, Math.abs(fma - 25) <= 5 ? 'Normodivergente' : (fma > 30 ? 'Hiperdivergente' : 'Hipodivergente')));
        const impa = tem('Go', 'Gn', 'L1i', 'L1a') ? anguloImpa(p.L1a, p.L1i, p.Go, p.Gn) : null;
        if (impa !== null) linhas.push(linhaMedida('Tweed (FH + plano mandibular)', 'IMPA (Incisivo Inf. / Plano Mandibular)', impa, '°', 90, 5, impa > 95 ? 'Vestibularizado' : (impa < 85 ? 'Retroinclinado' : 'Normal')));
        const fmia = anguloFmia(fma, impa);
        if (fmia !== null) linhas.push(linhaMedida('Tweed (FH + plano mandibular)', 'FMIA (FH / Incisivo Inferior)', fmia, '°', 65, 5));
        if (fma !== null && fmia !== null && impa !== null) {
            linhas.push({ grupo: 'Tweed (FH + plano mandibular)', label: 'Controlo: FMA + FMIA + IMPA', valor: (fma + fmia + impa).toFixed(1) + '°', norma: '180.0°', status: 'status-ok', texto: 'Triângulo de Tweed fechado por construção' });
        }
    }

    return linhas;
}

function calcularCefalometriaAvancada() {
    const seletor = document.getElementById('tipo-analise-cefalo');
    const tipo = seletor ? seletor.value : 'steiner';
    const linhas = calcularResultadosCefalometricosCompleto(tipo);
    document.getElementById('results-tbody').innerHTML = renderizarTabelaResultados(linhas);
}
