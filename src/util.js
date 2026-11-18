// Texto "limpo" para comparar: sem acento, maiúsculo, sem espaços duplicados.
function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

// Converte o valor de uma célula do ExcelJS em texto simples.
function textoCelula(cell) {
  let v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString('pt-BR');
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) v = v.richText.map(t => t.text).join('');
    else if (v.result !== undefined) v = v.result;
    else if (v.text !== undefined) v = v.text;
    else if (v.error) v = '';
    else v = String(v);
  }
  return String(v).replace(/\r/g, '').trim();
}

module.exports = { normalizar, textoCelula };
