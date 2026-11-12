const ExcelJS = require('exceljs');
const config = require('./config');
const { normalizar, textoCelula } = require('./util');

// Procura, nas primeiras linhas de uma aba, a linha que contém todos os cabeçalhos.
function localizarCabecalho(ws) {
  const alvo = Object.fromEntries(config.colunas.map(c => [c.chave, normalizar(c.cabecalho)]));
  let melhor = { linha: 0, cols: {} };
  for (let r = 1; r <= 15; r++) {
    const cols = {};
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, n) => {
      const t = normalizar(textoCelula(cell));
      for (const k of Object.keys(alvo)) if (t === alvo[k] && cols[k] === undefined) cols[k] = n;
    });
    if (Object.keys(cols).length > Object.keys(melhor.cols).length) melhor = { linha: r, cols };
  }
  const faltando = config.colunas.filter(c => melhor.cols[c.chave] === undefined).map(c => c.cabecalho);
  return { ...melhor, faltando };
}

// Lê o arquivo .xlsx. O ExcelJS já devolve, para células mescladas, o valor da
// célula principal em TODAS as linhas cobertas pela mesclagem — é isso que
// "desmescla" cargo/riscos automaticamente.
async function lerPlanilha(arquivoXlsx) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivoXlsx);

  let ultimoErro = 'Nenhuma aba encontrada.';
  for (const ws of wb.worksheets) {
    const loc = localizarCabecalho(ws);
    if (loc.faltando.length) {
      ultimoErro = `Aba "${ws.name}": faltam os cabeçalhos: ${loc.faltando.join(', ')}`;
      continue;
    }
    return extrair(ws, loc);
  }
  throw new Error('Não encontrei a aba com os cabeçalhos do PGR. ' + ultimoErro);
}

function extrair(ws, loc) {
  const linhas = [];
  const tituloOrgao = normalizar(config.colunas[0].cabecalho);
  let vazias = 0;

  for (let r = loc.linha + 1; r <= ws.rowCount && vazias < config.linhasVaziasParaParar; r++) {
    const row = ws.getRow(r);
    const reg = { linhaOriginal: r };
    let algum = false;
    for (const c of config.colunas) {
      reg[c.chave] = textoCelula(row.getCell(loc.cols[c.chave]));
      if (reg[c.chave]) algum = true;
    }
    if (!algum) { vazias++; continue; }
    // linhas do sub-cabeçalho (cabeçalho mesclado se repete nelas)
    if (normalizar(reg.orgao) === tituloOrgao) continue;
    vazias = 0;
    linhas.push(reg);
  }
  return { aba: ws.name, linhaCabecalho: loc.linha, linhas };
}

module.exports = { lerPlanilha };
