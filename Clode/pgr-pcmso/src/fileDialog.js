const { execFileSync } = require('child_process');
const readline = require('readline');
const ui = require('./ui');

const FILTRO = 'Planilhas (*.xlsx;*.xlsm;*.ods;*.xls)|*.xlsx;*.xlsm;*.ods;*.xls|Todos os arquivos (*.*)|*.*';

function tentar(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.replace(/[\r\n]+$/, '').trim() || null;
  } catch { return null; }
}

function janelaMac() {
  return tentar('osascript', ['-e', 'POSIX path of (choose file with prompt "Selecione a planilha do PGR")']);
}

function janelaLinux() {
  return tentar('zenity', ['--file-selection', '--title=Selecione a planilha do PGR'])
      || tentar('kdialog', ['--getopenfilename', '.', '*.xlsx *.xlsm *.ods *.xls']);
}

// Só usado no desenvolvimento (terminal). No .exe não existe terminal.
function perguntarNoTerminal() {
  if (!process.stdin || !process.stdin.isTTY) return Promise.resolve(null);
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Digite o caminho completo da planilha do PGR: ', r => {
      rl.close();
      resolve(r.trim().replace(/^["']|["']$/g, '') || null);
    });
  });
}

// Devolve o caminho escolhido, ou null se a pessoa cancelou.
// No Windows, LANÇA ERRO se a janela não puder ser aberta (ex.: PowerShell bloqueado).
async function escolherArquivo() {
  if (process.platform === 'win32') return ui.selecionarArquivo('Selecione a planilha do PGR', FILTRO) || null;
  const arq = process.platform === 'darwin' ? janelaMac() : janelaLinux();
  return arq || perguntarNoTerminal();
}

module.exports = { escolherArquivo };
