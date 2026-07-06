const mammoth = require('mammoth');
const xlsx = require('xlsx');

async function docxToHtml(filePath) {
  try {
    const result = await mammoth.convertToHtml({ path: filePath });
    return { success: true, html: result.value };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function docToHtml(filePath) {
  try {
    const fs = require('fs');
    const iconv = require('iconv-lite');
    const buffer = fs.readFileSync(filePath);

    let text = '';
    try {
      text = await extractTextUsingMammoth(filePath);
    } catch {}

    if (!text) {
      text = extractTextFromDocBuffer(buffer);
    }

    if (!text) {
      text = extractTextFromDocOle(buffer);
    }

    if (!text) {
      text = iconv.decode(buffer, 'gbk').replace(/\x00/g, '').trim();
    }

    if (!text) {
      return { success: false, error: '无法提取文档内容' };
    }

    const html = `<div class="doc-preview whitespace-pre-wrap break-all text-sm leading-relaxed">${escapeHtml(text)}</div>`;
    return { success: true, html };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function extractTextUsingMammoth(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  } catch {
    return '';
  }
}

function extractTextFromDocBuffer(buffer) {
  try {
    const iconv = require('iconv-lite');
    const textChunks = [];
    let i = 0;

    while (i < buffer.length) {
      if (buffer[i] === 0x0d && buffer[i + 1] === 0x0a) {
        textChunks.push('\n');
        i += 2;
      } else if (buffer[i] === 0x0d || buffer[i] === 0x0a) {
        textChunks.push('\n');
        i++;
      } else if (buffer[i] !== 0x00) {
        if (buffer[i] >= 0x80 && buffer[i + 1] && buffer[i + 1] !== 0x00) {
          textChunks.push(String.fromCharCode(((buffer[i] & 0xFF) << 8) | (buffer[i + 1] & 0xFF)));
          i += 2;
        } else {
          textChunks.push(String.fromCharCode(buffer[i] & 0xFF));
          i++;
        }
      } else {
        i++;
      }
    }

    let text = textChunks.join('').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    if (!hasChinese && text.length < 10) {
      text = iconv.decode(buffer, 'gbk').replace(/\x00/g, '').trim();
    }

    return text;
  } catch {
    return '';
  }
}

function extractTextFromDocOle(buffer) {
  try {
    const ole = require('ole-doc');
    const doc = ole(buffer);
    const text = doc.getText();
    return text ? text.trim() : '';
  } catch {
    return '';
  }
}

async function xlsxToHtml(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    let html = '<div class="xlsx-preview">';

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      html += `<h4 class="xlsx-sheet-title">${escapeHtml(sheetName)}</h4>`;
      html += '<table class="xlsx-table">';

      jsonData.forEach((row) => {
        html += '<tr>';
        row.forEach((cell) => {
          if (cell == null) {
            html += '<td class="xlsx-empty-cell"></td>';
          } else {
            html += `<td>${escapeHtml(String(cell))}</td>`;
          }
        });
        html += '</tr>';
      });

      html += '</table>';
    }

    html += '</div>';
    return { success: true, html };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { docxToHtml, docToHtml, xlsxToHtml };