// Janelas do Windows (caixas de mensagem, barra "Processando", seleção de arquivo).
// Tudo é feito pelo PowerShell que já vem no Windows — nada para instalar.
// Se o PowerShell estiver bloqueado, as caixas de mensagem usam o VBScript como plano B.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');

const TITULO = 'PGR → PCMSO';
const win = process.platform === 'win32';

// ---------- registro de eventos ----------
// No .exe não há janela de console, então o "log" vai para um arquivo em %TEMP%.
// Para ver na tela durante o desenvolvimento: defina PGR_DEBUG=1 ou rode pelo terminal.
const ARQUIVO_LOG = path.join(os.tmpdir(), 'pgr-pcmso.log');
function log(...partes) {
  const linha = partes.map(String).join(' ');
  try { fs.appendFileSync(ARQUIVO_LOG, new Date().toISOString() + '  ' + linha + '\n'); } catch {}
  try { if ((process.stdout && process.stdout.isTTY) || process.env.PGR_DEBUG) console.log(linha); } catch {}
}
function reiniciarLog() { try { fs.writeFileSync(ARQUIVO_LOG, ''); } catch {} }

// ---------- PowerShell ----------
const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
// Texto seguro para dentro do script (sem problemas com aspas, acentos ou quebras de linha).
const txt = s => `[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(s)}'))`;

// $o = janela "dona" invisível e sempre-por-cima: faz as caixas aparecerem NA FRENTE de tudo.
const PS_BASE = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$o = New-Object System.Windows.Forms.Form
$o.TopMost = $true
`;

const ARGS_PS = ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-EncodedCommand'];
const codificar = script => Buffer.from(script, 'utf16le').toString('base64');

// Executa e devolve o texto de saída. LANÇA ERRO se o PowerShell falhar/estiver bloqueado.
function powershell(script) {
  const out = execFileSync('powershell.exe', [...ARGS_PS, codificar(PS_BASE + script)],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return out.replace(/[\r\n]+$/, '').trim();
}

// ---------- caixas de mensagem ----------
function caixaVbs(texto, titulo, botoes, icone) {
  const iconeN = { Information: 64, Warning: 48, Error: 16, Question: 32 }[icone] || 64;
  const botoesN = botoes === 'YesNo' ? 4 : 0;
  const esc = s => String(s).replace(/"/g, '""');
  const linhas = ['m = ""', ...String(texto).split(/\r?\n/).map(l => `m = m & "${esc(l)}" & vbCrLf`),
    `WScript.Quit MsgBox(m, ${iconeN + botoesN + 4096}, "${esc(titulo)}")`]; // 4096 = sempre na frente
  const arq = path.join(os.tmpdir(), 'pgr-pcmso-msg.vbs');
  fs.writeFileSync(arq, '\ufeff' + linhas.join('\r\n') + '\r\n', 'utf16le');
  const r = spawnSync('wscript.exe', [arq], { stdio: 'ignore' });
  if (r.error) throw r.error;
  return r.status === 6 ? 'Yes' : r.status === 7 ? 'No' : 'OK';
}

// botoes: 'OK' | 'YesNo'   icone: 'Information' | 'Warning' | 'Error' | 'Question'
// Devolve 'OK', 'Yes' ou 'No'.
function caixa(texto, { titulo = TITULO, botoes = 'OK', icone = 'Information' } = {}) {
  log('[caixa]', texto.replace(/\n+/g, ' | '));
  if (!win) return botoes === 'YesNo' ? 'No' : 'OK';
  try {
    const r = powershell(`[System.Windows.Forms.MessageBox]::Show($o, ${txt(texto)}, ${txt(titulo)}, '${botoes}', '${icone}')`);
    return r || (botoes === 'YesNo' ? 'No' : 'OK');
  } catch (e) { log('PowerShell falhou na caixa:', e.message); }
  try { return caixaVbs(texto, titulo, botoes, icone); }
  catch (e) { log('VBScript falhou na caixa:', e.message); }
  return botoes === 'YesNo' ? 'No' : 'OK';
}
const info = t => caixa(t, { icone: 'Information' });
const aviso = t => caixa(t, { icone: 'Warning' });
const erro = t => caixa(t, { icone: 'Error', titulo: TITULO + ' — Erro' });
const perguntar = t => caixa(t, { botoes: 'YesNo', icone: 'Question' }) === 'Yes';

// ---------- janela "Processando..." ----------
// Janela pequena, sem botões, que fica aberta enquanto o programa trabalha.
function abrirProcessando(texto) {
  if (!win) { log(texto); return { fechar() {} }; }
  const script = PS_BASE + `
$f = New-Object System.Windows.Forms.Form
$f.Text = ${txt(TITULO)}
$f.ClientSize = New-Object System.Drawing.Size(400, 90)
$f.StartPosition = 'CenterScreen'
$f.FormBorderStyle = 'FixedDialog'
$f.ControlBox = $false
$f.TopMost = $true
$l = New-Object System.Windows.Forms.Label
$l.Text = ${txt(texto)}
$l.Location = New-Object System.Drawing.Point(15, 14)
$l.Size = New-Object System.Drawing.Size(370, 24)
$p = New-Object System.Windows.Forms.ProgressBar
$p.Style = 'Marquee'
$p.Location = New-Object System.Drawing.Point(15, 48)
$p.Size = New-Object System.Drawing.Size(370, 20)
$f.Controls.Add($l)
$f.Controls.Add($p)
[System.Windows.Forms.Application]::Run($f)
`;
  let filho = null;
  try {
    filho = spawn('powershell.exe', [...ARGS_PS, codificar(script)], { stdio: 'ignore' });
    filho.on('error', () => {});
  } catch (e) { log('Janela "Processando" não abriu:', e.message); }
  return { fechar() { try { if (filho) filho.kill(); } catch {} } };
}

// ---------- seleção de arquivos ----------
// Devolve o caminho, ou '' se a pessoa cancelou. LANÇA ERRO se a janela não puder abrir.
function selecionarArquivo(titulo, filtro) {
  return powershell(`
$f = New-Object System.Windows.Forms.OpenFileDialog
$f.Title = ${txt(titulo)}
$f.Filter = ${txt(filtro)}
if ($f.ShowDialog($o) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }`);
}

// Abre um arquivo com o programa padrão do Windows (o Calc, no caso da .ods).
function abrirArquivo(arquivo) {
  if (!win) return;
  try { powershell(`Start-Process -FilePath ${txt(arquivo)}`); }
  catch (e) { log('Não foi possível abrir o arquivo:', e.message); }
}

module.exports = {
  win, log, reiniciarLog, ARQUIVO_LOG,
  caixa, info, aviso, erro, perguntar,
  abrirProcessando, selecionarArquivo, abrirArquivo,
};
