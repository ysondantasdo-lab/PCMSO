const { execFileSync } = require('child_process');
const readline = require('readline');

const FILTRO = 'Planilhas (*.xlsx;*.xlsm;*.ods;*.xls)|*.xlsx;*.xlsm;*.ods;*.xls|Todos os arquivos (*.*)|*.*';

function tentar(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.replace(/[\r\n]+$/, '').trim() || null;
  } catch { return null; }
}

function janelaWindows() {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$f = New-Object System.Windows.Forms.OpenFileDialog
$f.Title = 'Selecione a planilha do PGR'
$f.Filter = '${FILTRO}'
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }`;
  const b64 = Buffer.from(script, 'utf16le').toString('base64');
  return tentar('powershell', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64]);
}

function janelaMac() {
  return tentar('osascript', ['-e', 'POSIX path of (choose file with prompt "Selecione a planilha do PGR")']);
}

function janelaLinux() {
  return tentar('zenity', ['--file-selection', '--title=Selecione a planilha do PGR'])
      || tentar('kdialog', ['--getopenfilename', '.', '*.xlsx *.xlsm *.ods *.xls']);
}

function perguntarNoTerminal() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Digite o caminho completo da planilha do PGR: ', r => {
      rl.close();
      resolve(r.trim().replace(/^["']|["']$/g, '') || null);
    });
  });
}

async function escolherArquivo() {
  let arq = null;
  if (process.platform === 'win32') arq = janelaWindows();
  else if (process.platform === 'darwin') arq = janelaMac();
  else arq = janelaLinux();
  return arq || perguntarNoTerminal();
}

module.exports = { escolherArquivo };
