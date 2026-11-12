const { execFileSync } = require('child_process');

// tipo: 'Information' | 'Warning' | 'Error' | 'Question'; botoes: 'OK' | 'YesNo'
function caixa(titulo, texto, tipo = 'Information', botoes = 'OK') {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dono = New-Object System.Windows.Forms.Form -Property @{TopMost = $true}
$r = [System.Windows.Forms.MessageBox]::Show($dono, $env:PGR_TEXTO, $env:PGR_TITULO, '${botoes}', '${tipo}')
Write-Output $r`;
  const b64 = Buffer.from(script, 'utf16le').toString('base64');
  try {
    return execFileSync('powershell',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, PGR_TEXTO: texto, PGR_TITULO: titulo } }).trim();
  } catch { return null; }
}

module.exports = {
  info:  (t, x) => caixa(t, x, 'Information'),
  erro:  (t, x) => caixa(t, x, 'Error'),
  aviso: (t, x) => caixa(t, x, 'Warning'),
  sim:   (t, x) => caixa(t, x, 'Question', 'YesNo') === 'Yes',
};