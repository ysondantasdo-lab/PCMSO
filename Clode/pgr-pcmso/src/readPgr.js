const ExcelJS = require('exceljs');
const config = require('./config');
const { normalizar, textoCelula } = require('./util');

async function lerPlanilha(arquivoXlsx) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivoXlsx);

  // Pega a primeira aba da planilha (onde ficam os dados do PGR)
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error('Nenhuma aba encontrada na planilha.');
  }

  return extrair(ws);
}

function extrair(ws) {
  const linhas = [];
  const linhaInicial = config.linhaInicioDados || 5;
  let vazias = 0;

  for (let r = linhaInicial; r <= ws.rowCount && vazias < config.linhasVaziasParaParar; r++) {
    const row = ws.getRow(r);
    const reg = { linhaOriginal: r };
    let algum = false;

    for (const c of config.colunas) {
      // O ExcelJS permite passar a letra da coluna diretamente (ex: 'A', 'B', 'D')
      reg[c.chave] = textoCelula(row.getCell(c.coluna));
      if (reg[c.chave]) algum = true;
    }

    if (!algum) {
      vazias++;
      continue;
    }

    // Ignora linhas caso o cabeçalho se repita no meio da tabela
    const orgaoNorm = normalizar(reg.orgao);
    if (orgaoNorm.includes('ORGAO') || orgaoNorm.includes('OGAO')) continue;

    vazias = 0;
    linhas.push(reg);
  }

  if (linhas.length === 0) {
    throw new Error(`Nenhum dado encontrado na aba "${ws.name}" a partir da linha ${linhaInicial}.`);
  }

  return { aba: ws.name, linhaCabecalho: 2, linhas };
}

module.exports = { lerPlanilha };
