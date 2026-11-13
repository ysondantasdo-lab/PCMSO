const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./src/config');
const ui = require('./src/ui');
const { escolherArquivo } = require('./src/fileDialog');
const { acharSoffice, pedirSoffice, converter } = require('./src/libreoffice');
const { lerPlanilha } = require('./src/readPgr');
const { agrupar } = require('./src/grouping');
const { gerarPlanilha } = require('./src/writeWorkbook');

const EXT_PLANILHA = ['.xlsx', '.xlsm', '.ods', '.xls'];

// Arquivo passado ao programa: arrastado sobre o .exe, ou "Abrir com", ou linha de comando.
function arquivoDosArgumentos() {
  return process.argv.slice(1).find(a => EXT_PLANILHA.includes(path.extname(a).toLowerCase()) && fs.existsSync(a)) || null;
}

function mensagemAmigavel(e) {
  if (e && ['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) {
    return 'Não consegui salvar o resultado.\n\nSe a planilha de resultado estiver aberta no Calc, feche-a e tente novamente. ' +
           'Verifique também se você tem permissão para gravar na pasta da planilha.';
  }
  return (e && e.message) || String(e);
}

async function main() {
  ui.reiniciarLog();

  // 1) Arquivo: arrastado sobre o programa ou escolhido na janela
  let entrada = arquivoDosArgumentos();
  if (!entrada) {
    try {
      entrada = await escolherArquivo();
    } catch (e) {
      ui.log('Janela de seleção falhou:', e.message);
      ui.erro('Não consegui abrir a janela de seleção de arquivo.\n\n' +
              'Alternativa: arraste a planilha do PGR e solte em cima do ícone deste programa.');
      return 1;
    }
    if (!entrada) return 0; // cancelou: encerra sem barulho
  }
  if (!fs.existsSync(entrada)) throw new Error('Arquivo não encontrado: ' + entrada);
  ui.log('Arquivo:', entrada);

  // 2) .ods/.xls precisam do LibreOffice para virar .xlsx; garante que ele foi localizado
  const ext = path.extname(entrada).toLowerCase();
  const precisaConverter = ext !== '.xlsx' && ext !== '.xlsm';
  if (precisaConverter && !pedirSoffice()) {
    throw new Error('Esta planilha precisa ser convertida pelo LibreOffice, mas ele não foi encontrado.\n\n' +
                    'Dica: abra a planilha no Calc, use "Salvar como" .xlsx e escolha o arquivo salvo.');
  }

  const processando = ui.abrirProcessando('Processando a planilha... aguarde.');
  let r, saida, ods = null, tmp = null;
  try {
    let xlsx = entrada;
    if (precisaConverter) {
      ui.log('Convertendo para .xlsx com o LibreOffice...');
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pgr-'));
      xlsx = converter(entrada, 'xlsx', tmp);
    }

    // 3) Ler (mescladas já resolvidas) e agrupar
    const lido = await lerPlanilha(xlsx);
    ui.log(`Aba "${lido.aba}": ${lido.linhas.length} linhas de dados.`);
    r = agrupar(lido.linhas);

    // 4) Gerar saída na mesma pasta do arquivo original
    const base = path.basename(entrada, path.extname(entrada));
    saida = path.join(path.dirname(entrada), `${base}_GH_PCMSO.xlsx`);
    await gerarPlanilha(r, saida);

    // 5) Cópia .ods (formato nativo do Calc), se o LibreOffice estiver disponível
    if (config.gerarOds && acharSoffice()) {
      try { ods = converter(saida, 'ods', path.dirname(saida)); }
      catch (e) { ui.log('Não foi possível gerar a cópia .ods:', e.message); }
    }
  } finally {
    processando.fechar();
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
  }

  r.resumo.forEach(g => ui.log(`${g.gh}  ${g.agente} | ${g.exposicao} -> ${g.nLinhas} linhas, ${g.cargos.length} cargos`));
  r.avisos.forEach(a => ui.log('AVISO:', a));

  // 6) Resultado
  const MAX_AVISOS = 8;
  let msg = 'Concluído!\n\n' +
    `Grupos homogêneos (GH): ${r.resumo.length}\n` +
    `Linhas com risco: ${r.comRisco.length}   |   Sem fator de risco: ${r.semRisco.length}   |   Para revisar: ${r.revisar.length}\n\n` +
    'Arquivo gerado:\n' + (ods || saida) + (ods ? '\n(uma cópia em .xlsx também foi salva na mesma pasta)' : '');
  if (r.avisos.length) {
    msg += `\n\nAtenção — ${r.avisos.length} aviso(s):\n` + r.avisos.slice(0, MAX_AVISOS).map(a => '• ' + a).join('\n');
    if (r.avisos.length > MAX_AVISOS) msg += `\n• ...e mais ${r.avisos.length - MAX_AVISOS}.`;
  }
  msg += '\n\nDeseja abrir a planilha agora?';
  if (ui.perguntar(msg)) ui.abrirArquivo(ods || saida);
  return 0;
}

main()
  .then(codigo => process.exit(codigo || 0))
  .catch(e => {
    ui.log('ERRO:', e && e.stack || e);
    ui.erro('Ocorreu um problema ao processar a planilha.\n\n' + mensagemAmigavel(e));
    process.exit(1);
  });
