import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface ExtractionResult {
  text: string;
  isImage: boolean;
  base64?: string;
  mimeType?: SupportedImageMime;
}

/**
 * Extracts plain text (or base64 for images) from a decrypted file path.
 * Never throws — returns a fallback message on error.
 */
export async function extractDocumentContent(
  filePath: string,
  mimeType: string,
): Promise<ExtractionResult> {
  try {
    if (mimeType.startsWith('image/')) {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const validMime: SupportedImageMime = (
        ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as string[]
      ).includes(mimeType)
        ? (mimeType as SupportedImageMime)
        : 'image/jpeg';
      return { text: '', isImage: true, base64, mimeType: validMime };
    }

    if (mimeType === 'application/pdf') {
      const buffer = fs.readFileSync(filePath);
      const result = await pdfParse(buffer);
      return { text: result.text.trim(), isImage: false };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return { text: result.value.trim(), isImage: false };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      const workbook = XLSX.readFile(filePath);
      const lines: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        lines.push(`=== Sheet: ${sheetName} ===`);
        lines.push(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]));
      }
      return { text: lines.join('\n').trim(), isImage: false };
    }

    if (mimeType === 'text/csv' || mimeType === 'text/plain') {
      const text = fs.readFileSync(filePath, 'utf8');
      return { text: text.trim(), isImage: false };
    }

    // Fallback: attempt plain text read
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      return { text: text.trim(), isImage: false };
    } catch {
      return { text: '[Binary file — content not extractable as text]', isImage: false };
    }
  } catch (err) {
    return {
      text: `[Extraction failed: ${err instanceof Error ? err.message : String(err)}]`,
      isImage: false,
    };
  }
}
