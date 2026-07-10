// ==========================================================================
// FACIAL — cálculo da análise fotométrica facial
// ==========================================================================

function calcularResultadosFaciaisCompleto() {
    const pts = appState.estudosImagens.facial.pontos;
    const linhas = [];

    if (pts.Tr && pts.Na && pts.Sn && pts.Me) {
        let tSup = Math.abs(pts.Na.y - pts.Tr.y), tMed = Math.abs(pts.Sn.y - pts.Na.y), tInf = Math.abs(pts.Me.y - pts.Sn.y);
        let total = tSup + tMed + tInf;
        linhas.push(linhaMedida('Terços Verticais', 'Terço Superior', (tSup/total)*100, '%', 33.3, 3));
        linhas.push(linhaMedida('Terços Verticais', 'Terço Médio', (tMed/total)*100, '%', 33.3, 3));
        linhas.push(linhaMedida('Terços Verticais', 'Terço Inferior', (tInf/total)*100, '%', 33.3, 3));
    }
    if (pts.Prn && pts.Sn && pts.Ls) {
        let nasolabial = obterAngulo(pts.Prn, pts.Sn, pts.Ls);
        let ok = nasolabial >= 90 && nasolabial <= 110;
        linhas.push({ grupo: 'Perfil Mole', label: 'Ângulo Nasolabial', valor: nasolabial.toFixed(1)+'°', norma: '90° – 110°', status: ok?'status-ok':'status-dev', texto: ok?'Normal':(nasolabial<90?'Fechado':'Aberto') });
    }
    if (pts.Gl && pts.Sn && pts.PgL) {
        let convexidade = 180 - obterAngulo(pts.Gl, pts.Sn, pts.PgL);
        linhas.push(linhaMedida('Perfil Mole', 'Convexidade Facial (Gl-Sn-Pg\')', convexidade, '°', 12, 4, Math.abs(convexidade-12)<=4?'Normal':(convexidade>16?'Perfil Convexo':'Perfil Côncavo')));
    }
    if (pts.Zy_D && pts.Zy_E && pts.Ch_D && pts.Ch_E) {
        let largFacial = distanciaPontos(pts.Zy_D, pts.Zy_E);
        let largBucal = distanciaPontos(pts.Ch_D, pts.Ch_E);
        let ratio = largFacial ? (largBucal/largFacial)*100 : 0;
        linhas.push({ grupo: 'Proporções Horizontais', label: 'Largura Bucal / Largura Bizigomática', valor: ratio.toFixed(1)+'%', norma: 'Valor de referência (sem norma rígida)', status: '', texto: 'Informativo' });
    }
    return linhas;
}

function calcularAnaliseFacial() {
    const linhas = calcularResultadosFaciaisCompleto();
    document.getElementById('results-tbody').innerHTML = renderizarTabelaResultados(linhas, 'Marque os pontos faciais.');
}
