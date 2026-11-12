// Ajustes do programa. Mexa aqui se a planilha mudar de formato.
module.exports = {
  // Cabeçalhos a serem lidos (o programa procura pelo TEXTO do cabeçalho,
  // então não depende da letra da coluna). Ordem = ordem das colunas na saída.
  colunas: [
    { chave: 'orgao',     cabecalho: 'ÓRGÃO / SECRETARIA',          titulo: 'ÓRGÃO / SECRETARIA',          largura: 16 },
    { chave: 'setor',     cabecalho: 'SETOR/LOTAÇÃO',              titulo: 'SETOR/LOTAÇÃO',               largura: 28 },
    { chave: 'cargo',     cabecalho: 'CARGO/FUNÇÃO',               titulo: 'CARGO/FUNÇÃO',                largura: 32 },
    { chave: 'descricao', cabecalho: 'DESCRIÇÃO CARGO/FUNÇÃO',     titulo: 'DESCRIÇÃO CARGO/FUNÇÃO',      largura: 50 },
    { chave: 'agente',    cabecalho: 'AGENTES / RISCOS AMBIENTAIS', titulo: 'AGENTES / RISCOS AMBIENTAIS', largura: 22 },
    { chave: 'fator',     cabecalho: 'FATOR DE RISCO AMBIENTAL',   titulo: 'FATOR DE RISCO AMBIENTAL',    largura: 40 },
    { chave: 'fonte',     cabecalho: 'FONTE GERADORA',             titulo: 'FONTE GERADORA',              largura: 24 },
    { chave: 'danos',     cabecalho: 'DANOS A SAUDE',              titulo: 'DANOS À SAÚDE',               largura: 40 },
    { chave: 'exposicao', cabecalho: 'TIPO DE EXPOSIÇÃO',          titulo: 'TIPO DE EXPOSIÇÃO',           largura: 16 },
  ],

  // Critério do Grupo Homogêneo: linhas com os mesmos valores nestas colunas.
  // Pedido original: agente (coluna I) + tipo de exposição (coluna N).
  // Se quiser separar também por fator de risco (ex.: ruído x calor), use:
  //   ['agente', 'exposicao', 'fator']
  chavesGH: ['agente', 'exposicao'],

  // Linhas "AUSÊNCIA DE FATORES DE RISCO" não entram em GH; vão para outra aba.
  prefixoSemRisco: 'AUSENCIA',

  // Para a leitura de .ods/.xls o programa usa o LibreOffice para converter.
  // Se ele não for encontrado automaticamente, coloque o caminho aqui:
  caminhoSoffice: null, // ex.: 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'

  // Também salvar uma cópia .ods (formato nativo do Calc)?
  gerarOds: true,

  // Fim dos dados: para de ler após tantas linhas vazias seguidas.
  linhasVaziasParaParar: 60,
};
