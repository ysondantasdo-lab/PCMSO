const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./src/config');
const { escolherArquivo } = require('./src/fileDialog');
//const { acharSoffice, converter } = require('./src/libreoffice');
const { lerPlanilha } = require('./src/readPgr');
const { agrupar } = require('./src/grouping');
const { gerarPlanilha } = require('./src/writeWorkbook');
const { odsParaXlsx } = require('./src/readOds');

async function main() {
  // 1) Arquivo: argumento da linha de comando ou janela de seleção
  const entrada = process.argv[2] || await escolherArquivo();
  if (!entrada) return console.log('Nenhum arquivo selecionado. Encerrando.');
  if (!fs.existsSync(entrada)) throw new Error('Arquivo não encontrado: ' + entrada);
  console.log('Arquivo:', entrada);

const ext = path.extname(entrada).toLowerCase();
let xlsx = entrada;
if (ext === '.ods') {
  xlsx = await odsParaXlsx(entrada, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pgr-')), 'conv.xlsx'));
} else if (ext !== '.xlsx' && ext !== '.xlsm') {
  throw new Error('Formato não suportado. Abra no Excel/Calc e salve como .xlsx ou .ods.');
}

  // 3) Ler (mescladas já resolvidas) e agrupar
  console.log('Lendo a planilha...');
  const lido = await lerPlanilha(xlsx);
  console.log(`Aba "${lido.aba}": ${lido.linhas.length} linhas de dados.`);
  const r = agrupar(lido.linhas);

  // 4) Gerar saída na mesma pasta do arquivo original
  const base = path.basename(entrada, path.extname(entrada));
  const saida = path.join(path.dirname(entrada), `${base}_GH_PCMSO.xlsx`);
  await gerarPlanilha(r, saida);

  console.log('\n=== Resultado ===');
  console.log(`Grupos homogêneos: ${r.resumo.length}`);
  r.resumo.forEach(g => console.log(`  ${g.gh}  ${g.agente} | ${g.exposicao}  ->  ${g.nLinhas} linhas, ${g.cargos.length} cargos`));
  console.log(`Sem fator de risco: ${r.semRisco.length} linhas | Para revisar: ${r.revisar.length} linhas`);
  r.avisos.forEach(a => console.log('  AVISO:', a));
  console.log('Arquivo gerado:', saida);

 
}

main().catch(e => { console.error('\nERRO:', e.message); process.exit(1); });
