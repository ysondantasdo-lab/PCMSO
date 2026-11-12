const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const config = require('./config');

function acharSoffice() {
  const candidatos = [
    process.env.SOFFICE_PATH,
    config.caminhoSoffice,
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/snap/bin/libreoffice',
  ].filter(Boolean);
  return candidatos.find(p => fs.existsSync(p)) || null;
}

// Converte um arquivo com o LibreOffice (headless). Retorna o caminho gerado.
function converter(arquivo, formato, pastaSaida) {
  const soffice = acharSoffice();
  if (!soffice) throw new Error('LibreOffice (soffice) não encontrado. Informe o caminho em src/config.js (caminhoSoffice).');
  fs.mkdirSync(pastaSaida, { recursive: true });
  // Perfil próprio: funciona mesmo com o Calc aberto.
  const perfil = pathToFileURL(path.join(os.tmpdir(), 'pgr-pcmso-lo-profile')).href;
  execFileSync(soffice, [
    `-env:UserInstallation=${perfil}`,
    '--headless', '--convert-to', formato, '--outdir', pastaSaida, arquivo,
  ], { stdio: 'pipe', timeout: 180000 });
  const gerado = path.join(pastaSaida, path.basename(arquivo, path.extname(arquivo)) + '.' + formato);
  if (!fs.existsSync(gerado)) throw new Error('A conversão pelo LibreOffice não gerou o arquivo esperado.');
  return gerado;
}

module.exports = { acharSoffice, converter };
