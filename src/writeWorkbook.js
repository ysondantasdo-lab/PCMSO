const ExcelJS = require('exceljs');
const config = require('./config');

// Verde, amarelo e vermelho primeiro (como no exemplo); depois cores bem separadas.
const BASE = ['A9D08E', 'FFE699', 'F4A6A6', '9DC3E6', 'F8CBAD', 'CDB4F0', '8FE3E3', 'FFB3DE',
              'D4E157', 'C8A27C', 'AEB6FF', 'FFCC80'];

function hslParaHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function corDoGH(numero) {
  const i = numero - 1;
  if (i < BASE.length) return BASE[i];
  const j = i - BASE.length;                       // cores extras: ângulo áureo + brilho alternado
  return hslParaHex((j * 137.508 + 20) % 360, 70, [74, 66, 80][j % 3]);
}

const BORDA = { style: 'thin', color: { argb: 'FF8C8C8C' } };
const BORDAS = { top: BORDA, left: BORDA, bottom: BORDA, right: BORDA };
const preenchimento = hex => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });

function cabecalho(ws, titulos, larguras) {
  ws.columns = titulos.map((t, i) => ({ header: t, width: larguras[i] }));
  const row = ws.getRow(1);
  row.height = 32;
  row.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = preenchimento('1F3864');
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = BORDAS;
  });
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: titulos.length } };
}

function estilizarLinha(row, hex) {
  row.eachCell({ includeEmpty: true }, c => {
    if (hex) c.fill = preenchimento(hex);
    c.border = BORDAS;
    c.alignment = { vertical: 'top', wrapText: true };
  });
}

async function gerarPlanilha({ comRisco, semRisco, revisar, resumo }, destino) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PGR para PCMSO';
  const cols = config.colunas;

  // 1) Dados por GH
  const ws1 = wb.addWorksheet('GH - PCMSO');
  cabecalho(ws1, ['GH', ...cols.map(c => c.titulo), 'LINHA NA PLANILHA ORIGINAL'],
                  [8, ...cols.map(c => c.largura), 14]);
  for (const l of comRisco) {
    const row = ws1.addRow([l.gh, ...cols.map(c => l[c.chave]), l.linhaOriginal]);
    estilizarLinha(row, corDoGH(l.ghNumero));
    row.getCell(1).font = { bold: true };
    row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
  }

  // 2) Resumo por GH
  const ws2 = wb.addWorksheet('Resumo dos GH');
  cabecalho(ws2, ['GH', 'AGENTE', 'TIPO DE EXPOSIÇÃO', 'Nº DE LINHAS', 'Nº DE CARGOS',
                  'CARGOS/FUNÇÕES EXPOSTOS', 'FATORES DE RISCO', 'DANOS À SAÚDE'],
                 [8, 22, 20, 10, 10, 50, 50, 50]);
  for (const g of resumo) {
    const row = ws2.addRow([g.gh, g.agente, g.exposicao, g.nLinhas, g.cargos.length,
      g.cargos.join('\n'), g.fatores.join('\n'), g.danos.join('\n')]);
    estilizarLinha(row, corDoGH(g.ghNumero));
    row.getCell(1).font = { bold: true };
  }

  // 3) Sem fator de risco / 4) Revisar
  const extra = (nome, linhas) => {
    const ws = wb.addWorksheet(nome);
    cabecalho(ws, [...cols.map(c => c.titulo), 'LINHA NA PLANILHA ORIGINAL'],
                  [...cols.map(c => c.largura), 14]);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    for (const l of linhas) estilizarLinha(ws.addRow([...cols.map(c => l[c.chave]), l.linhaOriginal]), null);
  };
  if (semRisco.length) extra('Sem fator de risco', semRisco);
  if (revisar.length) extra('Revisar', revisar);

  await wb.xlsx.writeFile(destino);
}

module.exports = { gerarPlanilha };
