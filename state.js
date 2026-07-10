// ==========================================================================
// STATE — estado global da aplicação, configuração dos marcos anatómicos
// e referências aos elementos DOM partilhados por vários módulos.
// Tem de carregar antes de qualquer outro módulo (exceto utils.js).
// ==========================================================================

let appState = {
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

let escalaVisual = 1;

const configuracaoPontos = {
    cefalometria: [
        { nome: 'Ponto Sela (S)', id: 'S', desc: 'Centro geométrico da sela turca — marco craniano de referência para os ângulos SNA e SNB.' },
        { nome: 'Ponto Násio (N)', id: 'N', desc: 'Ponto mais anterior da sutura frontonasal, no plano sagital médio.' },
        { nome: 'Ponto A', id: 'A', desc: 'Ponto de maior concavidade do contorno anterior da maxila, entre a espinha nasal anterior e o rebordo alveolar.' },
        { nome: 'Ponto B', id: 'B', desc: 'Ponto de maior concavidade do contorno anterior da mandíbula, entre o rebordo alveolar e o pogônio.' },
        { nome: 'Pogônio (Pg)', id: 'Pg', desc: 'Ponto mais anterior do contorno ósseo do mento, no plano sagital médio.' },
        { nome: 'Mentoniano (Me)', id: 'Me', desc: 'Ponto mais inferior do contorno da sínfise mandibular.' },
        { nome: 'Gnátio (Gn)', id: 'Gn', desc: 'Ponto médio entre Pogônio e Mentoniano, no contorno anterior do mento.' },
        { nome: 'Gônio (Go)', id: 'Go', desc: 'Ponto mais posterior e inferior do ângulo da mandíbula, na bissetriz entre o ramo e o corpo mandibular.' },
        { nome: 'Orbitário (Or)', id: 'Or', desc: 'Ponto mais inferior da margem infraorbitária.' },
        { nome: 'Pório (Po)', id: 'Po', desc: 'Ponto mais superior do meato acústico externo (habitualmente marcado na oliva do cefalostato).' },
        { nome: 'Espinha Nasal Ant. (ENA)', id: 'ENA', desc: 'Ápice ósseo da espinha nasal anterior, limite anterior do pavimento das fossas nasais.' },
        { nome: 'Espinha Nasal Post. (ENP)', id: 'ENP', desc: 'Ponto mais posterior do palato duro, limite posterior do pavimento nasal.' },
        { nome: 'Incisivo Sup. — Borda (U1i)', id: 'U1i', desc: 'Borda incisal do incisivo central superior mais proeminente.' },
        { nome: 'Incisivo Sup. — Ápice (U1a)', id: 'U1a', desc: 'Ápice radicular do incisivo central superior mais proeminente.' },
        { nome: 'Incisivo Inf. — Borda (L1i)', id: 'L1i', desc: 'Borda incisal do incisivo central inferior mais proeminente.' },
        { nome: 'Incisivo Inf. — Ápice (L1a)', id: 'L1a', desc: 'Ápice radicular do incisivo central inferior mais proeminente.' }
    ],
    facial: [
        { nome: 'Trichion (Tr)', id: 'Tr', desc: 'Linha de implantação do cabelo na testa, no plano sagital médio.' },
        { nome: 'Násio Facial (Na)', id: 'Na', desc: 'Ponto de maior concavidade da raiz nasal, em tecidos moles.' },
        { nome: 'Glabela (Gl)', id: 'Gl', desc: 'Ponto mais proeminente da testa, ao nível das sobrancelhas.' },
        { nome: 'Pronasal (Prn)', id: 'Prn', desc: 'Ponto mais anterior/proeminente da ponta do nariz.' },
        { nome: 'Subnasal (Sn)', id: 'Sn', desc: 'Ponto onde a columela nasal se une ao lábio superior.' },
        { nome: 'Lábio Superior (Ls)', id: 'Ls', desc: 'Ponto mais anterior da margem (vermelhão) do lábio superior.' },
        { nome: 'Mento (Me)', id: 'Me', desc: 'Ponto mais inferior do contorno mole do queixo.' },
        { nome: 'Pogônio Mole (Pg\')', id: 'PgL', desc: 'Ponto mais anterior do contorno mole do queixo.' },
        { nome: 'Zigomático Direito (Zy D)', id: 'Zy_D', desc: 'Ponto mais lateral do contorno do arco zigomático, lado direito do paciente.' },
        { nome: 'Zigomático Esquerdo (Zy E)', id: 'Zy_E', desc: 'Ponto mais lateral do contorno do arco zigomático, lado esquerdo do paciente.' },
        { nome: 'Comissura Labial Dir. (Ch D)', id: 'Ch_D', desc: 'Canto da boca, lado direito do paciente.' },
        { nome: 'Comissura Labial Esq. (Ch E)', id: 'Ch_E', desc: 'Canto da boca, lado esquerdo do paciente.' }
    ]
};

// ---------------------------------------------------------------------
// UNDO / REDO — histórico de estados por tipo de estudo (cefalometria/facial)
// ---------------------------------------------------------------------
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const img = document.getElementById('source-image');
const fileInput = document.getElementById('file-input');
function appStatePorOmissao() {
    return {
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
}

// Funde um appState carregado (BD ou backup) com a estrutura atual — backups antigos não rebentam a app
function normalizarAppState(carregado) {
    const base = appStatePorOmissao();
    if (!carregado || typeof carregado !== 'object') return base;
    const resultado = base;
    resultado.tipoEstudo = ['cefalometria','facial','modelos'].includes(carregado.tipoEstudo) ? carregado.tipoEstudo : 'cefalometria';
    resultado.historicoConsultas = Array.isArray(carregado.historicoConsultas) ? carregado.historicoConsultas : [];
    resultado.imagensPaciente = (carregado.imagensPaciente && typeof carregado.imagensPaciente === 'object') ? carregado.imagensPaciente : {};
    resultado.dadosModelosBackup = Object.assign(resultado.dadosModelosBackup, carregado.dadosModelosBackup || {});
    resultado.modelosRegistados = carregado.modelosRegistados === true;
    ['cefalometria','facial'].forEach(k => {
        const src = carregado.estudosImagens && carregado.estudosImagens[k];
        if (src && typeof src === 'object') {
            resultado.estudosImagens[k].pontos = Object.assign(resultado.estudosImagens[k].pontos, src.pontos || {});
            resultado.estudosImagens[k].escalaVisual = src.escalaVisual || 1;
            resultado.estudosImagens[k].scalePxPerMm = src.scalePxPerMm || null;
            resultado.estudosImagens[k].src = src.src || "";
            resultado.estudosImagens[k].naturalWidth = src.naturalWidth || 0;
            resultado.estudosImagens[k].naturalHeight = src.naturalHeight || 0;
        }
    });
    return resultado;
}

// Escapa texto livre antes de o injetar em HTML (PDF) — evita que "<" num nome parta a renderização
