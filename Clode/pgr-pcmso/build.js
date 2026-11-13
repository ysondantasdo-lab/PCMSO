// Gera dist/PGR-PCMSO.exe  (rode com:  npm run build)
// Para um .exe que MOSTRA a janela preta (útil para depurar):  npm run build:debug
const fs = require('fs');
const { execSync } = require('child_process');

const win = process.platform === 'win32';
const comConsole = process.argv.includes('--console');
const nome = win ? 'PGR-PCMSO.exe' : 'PGR-PCMSO';
const exe = 'dist/' + nome;

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');

// 1) Junta index.js + src/* + exceljs em um arquivo só
execSync('npx esbuild index.js --bundle --platform=node --target=node20 --outfile=dist/bundle.js', { stdio: 'inherit' });

// 2) Gera o "blob" que o Node embute no executável
execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' });

// 3) Copia o node.exe como base do programa
fs.copyFileSync(process.execPath, exe);

// 4) Injeta o programa dentro do exe
const mac = process.platform === 'darwin' ? ' --macho-segment-name NODE_SEA' : '';
execSync(`npx postject ${exe} NODE_SEA_BLOB dist/sea-prep.blob ` +
  `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2${mac}`, { stdio: 'inherit' });

// 5) Windows: troca o tipo do programa de "console" para "janela", para NÃO abrir a janela preta.
//    (campo Subsystem do cabeçalho PE: 3 = console, 2 = janela)
if (win && !comConsole) {
  const fd = fs.openSync(exe, 'r+');
  const b4 = Buffer.alloc(4);
  fs.readSync(fd, b4, 0, 4, 0x3c);
  const pe = b4.readUInt32LE(0);
  fs.readSync(fd, b4, 0, 4, pe);
  if (b4.toString('latin1') !== 'PE\0\0') throw new Error('Cabeçalho PE não encontrado.');
  const sub = Buffer.alloc(2);
  sub.writeUInt16LE(2);
  fs.writeSync(fd, sub, 0, 2, pe + 24 + 68);
  fs.closeSync(fd);
  console.log('Janela de console removida do .exe.');
}

console.log('\nPronto: ' + exe);
