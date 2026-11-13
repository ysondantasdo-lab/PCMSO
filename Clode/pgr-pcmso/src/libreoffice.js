const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const config = require('./config');
const ui = require('./ui');

// Onde guardamos o caminho que a pessoa indicou manualmente (para perguntar só uma vez).
const ARQ_SALVO = path.join(process.env.APPDATA || os.homedir(), 'PGR-PCMSO', 'config.json');

function lerSalvo() {
  try { return JSON.parse(fs.readFileSync(ARQ_SALVO, 'utf8')).soffice || null; } catch { return null; }
}
function gravarSalvo(caminho) {
  try {
    fs.mkdirSync(path.dirname(ARQ_SALVO), { recursive: true });
    fs.writeFileSync(ARQ_SALVO, JSON.stringify({ soffice: caminho }));
  } catch {}
}

// Pergunta ao registro do Windows onde o LibreOffice foi instalado.
function doRegistro() {
  if (process.platform !== 'win32') return [];
  const consultas = [
    ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\soffice.exe', false],
    ['HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\soffice.exe', false],
    ['HKLM\\SOFTWARE\\LibreOffice\\UNO\\InstallPath', true],
    ['HKLM\\SOFTWARE\\WOW6432Node\\LibreOffice\\UNO\\InstallPath', true],
    ['HKCU\\SOFTWARE\\LibreOffice\\UNO\\InstallPath', true],
  ];
  const achados = [];
  for (const [chave, ehPasta] of consultas) {
    try {
      const saida = execFileSync('reg', ['query', chave, '/ve'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      const m = saida.match(/REG_SZ\s+(.+)/);
      if (m) achados.push(ehPasta ? path.join(m[1].trim(), 'soffice.exe') : m[1].trim());
    } catch {}
  }
  return achados;
}

// Procura pastas "LibreOffice*" nos locais de instalação comuns (cobre versões com número no nome).
function variasPastas() {
  const bases = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean);
  const achados = [];
  for (const b of bases) {
    try {
      for (const d of fs.readdirSync(b)) {
        if (/^LibreOffice/i.test(d)) achados.push(path.join(b, d, 'program', 'soffice.exe'));
      }
    } catch {}
  }
  return achados;
}

let cache = null;

function acharSoffice() {
  if (cache && fs.existsSync(cache)) return cache;
  const candidatos = [
    process.env.SOFFICE_PATH,
    config.caminhoSoffice,
    lerSalvo(),
    ...doRegistro(),
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ...variasPastas(),
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/snap/bin/libreoffice',
  ].filter(Boolean);
  cache = candidatos.find(p => fs.existsSync(p)) || null;
  if (cache) ui.log('LibreOffice:', cache);
  return cache;
}

// Se não achou sozinho, pede para a pessoa apontar o soffice.exe (e lembra para a próxima vez).
// Devolve o caminho ou null.
function pedirSoffice() {
  if (acharSoffice()) return cache;
  if (process.platform !== 'win32') return null;
  ui.aviso('Não consegui localizar o LibreOffice automaticamente.\n\n' +
    'Na próxima janela, selecione o arquivo "soffice.exe". Ele costuma ficar em:\n' +
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe');
  let escolhido = '';
  try { escolhido = ui.selecionarArquivo('Localize o soffice.exe do LibreOffice', 'soffice.exe|soffice.exe'); }
  catch (e) { ui.log('Seleção do soffice falhou:', e.message); }
  if (escolhido && fs.existsSync(escolhido)) {
    cache = escolhido;
    gravarSalvo(escolhido);
    return cache;
  }
  return null;
}

// Converte um arquivo com o LibreOffice (headless). Retorna o caminho gerado.
function converter(arquivo, formato, pastaSaida) {
  const soffice = acharSoffice();
  if (!soffice) throw new Error('LibreOffice (soffice) não encontrado.');
  fs.mkdirSync(pastaSaida, { recursive: true });
  // Perfil próprio: funciona mesmo com o Calc aberto.
  const perfil = pathToFileURL(path.join(os.tmpdir(), 'pgr-pcmso-lo-profile')).href;
  try {
    execFileSync(soffice, [
      `-env:UserInstallation=${perfil}`,
      '--headless', '--convert-to', formato, '--outdir', pastaSaida, arquivo,
    ], { stdio: 'pipe', timeout: 180000, windowsHide: true });
  } catch (e) {
    if (e.code === 'ETIMEDOUT') throw new Error('O LibreOffice demorou demais para converter a planilha. Feche o Calc e tente de novo.');
    throw new Error('O LibreOffice não conseguiu converter a planilha. Verifique se o arquivo abre normalmente no Calc.');
  }
  const gerado = path.join(pastaSaida, path.basename(arquivo, path.extname(arquivo)) + '.' + formato);
  if (!fs.existsSync(gerado)) throw new Error('A conversão pelo LibreOffice não gerou o arquivo esperado.');
  return gerado;
}

module.exports = { acharSoffice, pedirSoffice, converter };
