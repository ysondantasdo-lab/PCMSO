const config = require('./config');
const { normalizar } = require('./util');

// Compara sem acento/maiúscula e ignora plural final do AGENTE
// (QUÍMICO = QUÍMICOS, ESPORÁDICA = ESPORADICA).
function parteDaChave(chave, valor) {
  let n = normalizar(valor);
  if (!n) return '(NAO INFORMADO)';
  if (chave === 'agente') n = n.replace(/S$/, '');
  return n;
}

// Entre as grafias de um mesmo valor, mostra a mais "correta": com acento primeiro, depois a mais frequente.
function melhorGrafia(contagem) {
  return [...contagem.entries()]
    .sort((a, b) => (temAcento(b[0]) - temAcento(a[0])) || (b[1] - a[1]))[0][0];
}
const temAcento = s => (s !== normalizar(s).toLowerCase() && /[À-ÿ]/.test(s) ? 1 : 0);

function unicos(linhas, chave) {
  const vistos = new Map();
  for (const l of linhas) {
    const v = l[chave];
    if (!v) continue;
    const k = normalizar(v);
    if (!vistos.has(k)) vistos.set(k, v);
  }
  return [...vistos.values()];
}

function agrupar(linhas) {
  const comRisco = [], semRisco = [], revisar = [], avisos = [];

  for (const l of linhas) {
    const ag = normalizar(l.agente);
    if (!ag) revisar.push(l);                                   // sem agente informado
    else if (ag.startsWith(config.prefixoSemRisco)) semRisco.push(l);
    else comRisco.push(l);
  }

  // Cria os GH na ordem em que aparecem.
  const grupos = new Map();
  for (const l of comRisco) {
    const chave = config.chavesGH.map(k => parteDaChave(k, l[k])).join(' || ');
    if (!grupos.has(chave)) grupos.set(chave, { numero: grupos.size + 1, linhas: [] });
    const g = grupos.get(chave);
    g.linhas.push(l);
    l.gh = 'GH' + String(g.numero).padStart(2, '0');
    l.ghNumero = g.numero;
    if (!l.exposicao) avisos.push(`Linha ${l.linhaOriginal}: tem risco (${l.agente}) mas o TIPO DE EXPOSIÇÃO está vazio.`);
  }
  revisar.forEach(l => avisos.push(`Linha ${l.linhaOriginal}: AGENTES / RISCOS AMBIENTAIS vazio — enviada para a aba "Revisar".`));

  comRisco.sort((a, b) => a.ghNumero - b.ghNumero || a.linhaOriginal - b.linhaOriginal);

  const resumo = [...grupos.values()].map(g => {
    const cont = campo => g.linhas.reduce((m, l) => m.set(l[campo], (m.get(l[campo]) || 0) + 1), new Map());
    return {
      gh: 'GH' + String(g.numero).padStart(2, '0'),
      ghNumero: g.numero,
      agente: melhorGrafia(cont('agente')),
      exposicao: g.linhas.some(l => l.exposicao) ? melhorGrafia(cont('exposicao')) : '(não informado)',
      nLinhas: g.linhas.length,
      cargos: unicos(g.linhas, 'cargo'),
      fatores: unicos(g.linhas, 'fator'),
      danos: unicos(g.linhas, 'danos'),
    };
  });

  return { comRisco, semRisco, revisar, resumo, avisos };
}

module.exports = { agrupar };
