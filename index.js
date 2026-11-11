import ExcelJS from 'exceljs';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import open from 'open';
import path from 'path';

// Configura o leitor de perguntas no terminal
const rl = readline.createInterface({ input, output });

async function processarPlanilha() {
  try {
    // 1. Solicita o caminho do arquivo ao usuário
    let caminhoArquivo = await rl.question('Arraste a planilha Excel para cá ou digite o caminho completo: ');
    
    // Limpa aspas caso o usuário arraste o arquivo para o terminal
    caminhoArquivo = caminhoArquivo.trim().replace(/^["']|["']$/g, '');

    console.log('\nLendo a planilha...');
    const workbookEntrada = new ExcelJS.Workbook();
    await workbookEntrada.xlsx.readFile(caminhoArquivo);

    // Pega a primeira aba da planilha
    const abaEntrada = workbookEntrada.getWorksheet(1);

    // 2. Pega o texto da célula A5
    const textoCelulaA5 = abaEntrada.getCell('A5').text || 'SemTitulo';
    // Remove caracteres inválidos para nome de arquivo (como / \ : * ? " < > |)
    const nomeLimpoA5 = textoCelulaA5.replace(/[\\/:*?"<>|]/g, '_').trim();

    // 3. Ler, Organizar e Agrupar os dados
    // Exemplo: supondo que os dados comecem na linha 7 (Coluna A = Categoria, Coluna B = Valor)
    const dadosAgrupados = {};

    abaEntrada.eachRow((row, rowNumber) => {
      if (rowNumber >= 7) { // Ajuste este número para a linha onde sua tabela começa
        const categoria = row.getCell(1).text.trim(); // Coluna A
        const valor = Number(row.getCell(2).value) || 0; // Coluna B

        if (categoria) {
          if (!dadosAgrupados[categoria]) {
            dadosAgrupados[categoria] = 0;
          }
          dadosAgrupados[categoria] += valor;
        }
      }
    });

    // 4. Criar a nova planilha de saída
    const workbookSaida = new ExcelJS.Workbook();
    const abaSaida = workbookSaida.addWorksheet('Dados Agrupados');

    // Cabeçalho da nova planilha
    abaSaida.addRow(['Categoria (Agrupada)', 'Total Somado']);

    // Ordena alfabeticamente e insere na nova planilha
    const categoriasOrdenadas = Object.keys(dadosAgrupados).sort();
    for (const cat of categoriasOrdenadas) {
      abaSaida.addRow([cat, dadosAgrupados[cat]]);
    }

    // 5. Formatar a data de hoje (DD-MM-AAAA)
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const dataFormatada = `${dia}-${mes}-${ano}`;

    // Monta o nome final e salva na mesma pasta da planilha original
    const pastaDestino = path.dirname(caminhoArquivo);
    const nomeArquivoSaida = `${dataFormatada}_${nomeLimpoA5}.xlsx`;
    const caminhoCompletoSaida = path.join(pastaDestino, nomeArquivoSaida);

    await workbookSaida.xlsx.writeFile(caminhoCompletoSaida);
    console.log(`\nSucesso! Arquivo salvo em:\n${caminhoCompletoSaida}`);

    // 6. Abre o arquivo no programa padrão do sistema (LibreOffice Calc)
    console.log('Abrindo no LibreOffice Calc...');
    await open(caminhoCompletoSaida);

  } catch (erro) {
    console.error('\nOcorreu um erro:', erro.message);
  } finally {
    rl.close();
  }
}

processarPlanilha();
