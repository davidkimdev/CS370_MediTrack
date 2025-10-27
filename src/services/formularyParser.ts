import * as XLSX from 'xlsx';
import { ImportedMedicationRow } from '../components/BulkImportDialog';

/**
 * Parse a formulary file (Excel or Word) and extract medication data
 */
export async function parseFormularyFile(file: File): Promise<ImportedMedicationRow[]> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  if (fileExtension === 'xlsx' || fileExtension === 'xls') {
    return parseExcelFile(file);
  } else if (fileExtension === 'docx' || fileExtension === 'doc') {
    return parseWordFile(file);
  }

  throw new Error('Unsupported file format. Please upload .xlsx, .xls, .docx, or .doc file.');
}

/**
 * Parse Excel file (.xlsx, .xls)
 * Expected columns: Name, Strength, Quantity, Lot Number (optional), Expiration Date (optional)
 */
async function parseExcelFile(file: File): Promise<ImportedMedicationRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Get first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];

        // Convert to JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Parse rows
        const results = parseFormularyRows(jsonData);
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Parse Word document (.docx, .doc)
 * Extracts tables and converts to medication rows
 */
async function parseWordFile(file: File): Promise<ImportedMedicationRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;

        // Lazy-load Mammoth browser build to parse DOCX in the client
        let mammothMod: any;
        try {
          // Prefer the browser bundle to avoid Node-specific shims
          mammothMod = await import('mammoth/mammoth.browser.js');
        } catch (_) {
          // Fallback: try main entry if browser bundle path is unavailable
          mammothMod = await import('mammoth');
        }
        const mammoth: any = mammothMod?.default ?? mammothMod;

        // Extract raw text and convert to table
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;

        // Parse text into rows (assuming tab or comma separated)
        const lines: string[] = text.split('\n').filter((line: string) => line.trim().length > 0);
        const rows: string[][] = lines.map((line: string) => {
          // Try to split by tab first, then by multiple spaces
          const parts = line.includes('\t')
            ? line.split('\t')
            : line.split(/\s{2,}/);
          return parts.map((p: string) => p.trim());
        });

        const results = parseFormularyRows(rows);
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse Word document: ${error}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse formulary rows from 2D array
 * Expected format:
 * - Row 0: Headers (optional) - will skip if contains "name", "strength", "quantity"
 * - Row 1+: [Name, Strength, Quantity, Lot Number?, Expiration Date?]
 */
function parseFormularyRows(rows: any[][]): ImportedMedicationRow[] {
  if (rows.length === 0) {
    return [];
  }

  let startIndex = 0;

  // Check if first row is a header (contains keywords like "name", "strength", "quantity")
  const firstRow = rows[0].map((cell: any) => String(cell).toLowerCase());
  const hasHeader = firstRow.some((cell: string) =>
    cell.includes('name') || cell.includes('strength') || cell.includes('quantity')
  );

  if (hasHeader) {
    startIndex = 1; // Skip header row
  }

  const results: ImportedMedicationRow[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (!row || row.length === 0 || !row[0]) {
      continue;
    }

    const name = String(row[0] || '').trim();
    const strength = String(row[1] || '').trim();
    const quantityStr = String(row[2] || '').trim();
    const lotNumber = row[3] ? String(row[3]).trim() : undefined;
    const expirationDate = row[4] ? String(row[4]).trim() : undefined;

    // Skip if name or strength is empty
    if (!name || !strength) {
      continue;
    }

    // Parse quantity - handle various formats
    const quantity = parseQuantity(quantityStr);
    if (quantity === null) {
      results.push({
        name,
        strength,
        quantity: 0,
        lotNumber,
        expirationDate,
        status: 'error',
        message: `Invalid quantity: "${quantityStr}"`,
      });
      continue;
    }

    // Validate expiration date format if provided
    let validatedExpDate = expirationDate;
    if (expirationDate) {
      validatedExpDate = normalizeExpirationDate(expirationDate);
    }

    // Determine status
    let status: 'valid' | 'warning' | 'error' = 'valid';
    let message: string | undefined;

    if (!lotNumber || !expirationDate) {
      status = 'warning';
      const missing: string[] = [];
      if (!lotNumber) missing.push('lot number');
      if (!expirationDate) missing.push('expiration date');
      message = `Missing ${missing.join(' and ')}`;
    }

    results.push({
      name,
      strength,
      quantity,
      lotNumber,
      expirationDate: validatedExpDate,
      status,
      message,
    });
  }

  return results;
}

/**
 * Parse quantity from various formats:
 * - "30" => 30
 * - "90 tabs" => 90
 * - "Dispense on-site" => 0 (special case)
 * - "x" => 0 (placeholder)
 */
function parseQuantity(quantityStr: string): number | null {
  if (!quantityStr) return null;

  const lower = quantityStr.toLowerCase().trim();

  // Handle special cases
  if (lower === 'x' || lower === 'n/a' || lower === 'dispense on-site' || lower === 'dispense on site') {
    return 0;
  }

  // Extract first number from string
  const match = quantityStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Normalize expiration date to YYYY-MM-DD format
 * Handles various formats:
 * - "2/24" => "2024-02-01"
 * - "12/2025" => "2025-12-01"
 * - "2025-12-31" => "2025-12-31"
 * - "Dec 2025" => "2025-12-01"
 */
function normalizeExpirationDate(dateStr: string): string {
  if (!dateStr) return '';

  dateStr = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Format: "2/24" or "12/24" (month/year short)
  const shortMatch = dateStr.match(/^(\d{1,2})\/(\d{2})$/);
  if (shortMatch) {
    const month = shortMatch[1].padStart(2, '0');
    const year = `20${shortMatch[2]}`;
    return `${year}-${month}-01`;
  }

  // Format: "2/2024" or "12/2025" (month/year full)
  const longMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
  if (longMatch) {
    const month = longMatch[1].padStart(2, '0');
    const year = longMatch[2];
    return `${year}-${month}-01`;
  }

  // Format: "Dec 2025" or "December 2025"
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthMatch = dateStr.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthMatch) {
    const monthStr = monthMatch[1].toLowerCase().substring(0, 3);
    const monthIndex = monthNames.indexOf(monthStr);
    if (monthIndex !== -1) {
      const month = String(monthIndex + 1).padStart(2, '0');
      const year = monthMatch[2];
      return `${year}-${month}-01`;
    }
  }

  // If we can't parse it, return as-is (will be flagged as warning)
  return dateStr;
}
