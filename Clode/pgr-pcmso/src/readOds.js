// Leitor de .ods (Calc) sem LibreOffice: o .ods é um zip com um content.xml.
// Devolve { nome, grade } onde grade[linha][coluna] é texto, já com as células
// mescladas preenchidas (cada célula coberta recebe o valor da célula principal).
const fs = require('fs');
const JSZip = require('jszip');
const { SaxesParser } = require('saxes');

const LIMITE_REPETICAO = 200; // evita "expandir" milhares de linhas/colunas vazias

async function lerOds(arquivo) {
  const zip = await JSZip.loadAsync(fs.readFileSync(arquivo));
  const entrada = zip.file('content.xml');
  if (!entrada) throw new Error('Arquivo .ods inválido (sem content.xml).');
  const xml = await entrada.async('string');

  const abas = [];
  let aba = null, r = -1, c = 0, linhaTemConteudo = false;
  let celula = null, paragrafos = null, paragrafoAtual = null;
  let linhaRep = 1, linhaCelulas = null;

  const p = new SaxesParser({ xmlns: false });
  p.on('opentag', tag => {
    const a = tag.attributes;
    switch (tag.name) {
      case 'table:table':
        aba = { nome: a['table:name'], grade: [], mesclas: [] };
        abas.push(aba); r = -1; break;
      case 'table:table-row':
        r++; c = 0; linhaCelulas = []; linhaTemConteudo = false;
        linhaRep = parseInt(a['table:number-rows-repeated'] || '1', 10); break;
      case 'table:table-cell':
      case 'table:covered-table-cell':
        celula = {
          coberta: tag.name === 'table:covered-table-cell',
          rep: parseInt(a['table:number-columns-repeated'] || '1', 10),
          cs: parseInt(a['table:number-columns-spanned'] || '1', 10),
          rs: parseInt(a['table:number-rows-spanned'] || '1', 10),
        };
        paragrafos = []; break;
      case 'text:p': paragrafoAtual = ''; break;
      case 'text:s': if (paragrafoAtual !== null) paragrafoAtual += ' '.repeat(parseInt(a['text:c'] || '1', 10)); break;
      case 'text:tab': if (paragrafoAtual !== null) paragrafoAtual += '\t'; break;
      case 'text:line-break': if (paragrafoAtual !== null) paragrafoAtual += '\n'; break;
    }
  });
  p.on('text', t => { if (paragrafoAtual !== null) paragrafoAtual += t; });
  p.on('closetag', tag => {
    switch (tag.name) {
      case 'text:p': paragrafos.push(paragrafoAtual); paragrafoAtual = null; break;
      case 'table:table-cell':
      case 'table:covered-table-cell': {
        const texto = paragrafos.join('\n');
        if (texto) {
          linhaTemConteudo = true;
          for (let i = 0; i < Math.min(celula.rep, LIMITE_REPETICAO); i++) linhaCelulas[c + i] = texto;
        }
        if (!celula.coberta && (celula.cs > 1 || celula.rs > 1)) aba.mesclas.push({ r, c, cs: celula.cs, rs: celula.rs });
        c += celula.rep; celula = null; break;
      }
      case 'table:table-row': {
        const reps = linhaTemConteudo ? Math.min(linhaRep, LIMITE_REPETICAO) : 1;
        for (let i = 0; i < reps; i++) aba.grade[r + i] = linhaCelulas.slice();
        r += linhaRep - 1; break;                // pula as repetições (linhas vazias)
      }
    }
  });
  p.write(xml).close();

  // Preenche as áreas mescladas com o valor da célula principal.
  for (const ab of abas) {
    for (const m of ab.mesclas) {
      const v = (ab.grade[m.r] || [])[m.c];
      if (!v) continue;
      for (let i = m.r; i < m.r + m.rs; i++) {
        ab.grade[i] = ab.grade[i] || [];
        for (let j = m.c; j < m.c + m.cs; j++) if (ab.grade[i][j] === undefined) ab.grade[i][j] = v;
      }
    }
  }
  return abas;
}


// Converte o .ods em um .xlsx temporário (só valores, mescladas já preenchidas),
// para o restante do programa ler como sempre fez.
async function odsParaXlsx(arquivoOds, arquivoXlsx) {
  const ExcelJS = require('exceljs');
  const abas = await lerOds(arquivoOds);
  const wb = new ExcelJS.Workbook();
  for (const a of abas) {
    const ws = wb.addWorksheet(a.nome);
    a.grade.forEach((linha, i) => {
      (linha || []).forEach((v, j) => { if (v !== undefined && v !== '') ws.getCell(i + 1, j + 1).value = v; });
    });
  }
  await wb.xlsx.writeFile(arquivoXlsx);
  return arquivoXlsx;
}
module.exports = { lerOds, odsParaXlsx };