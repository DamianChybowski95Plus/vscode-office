import { inferSchema, initParser } from 'udsv';
import * as XLSX from 'xlsx/dist/xlsx.mini.min.js';

interface SheetInfo {
    name: string;
    rows: any[];
}

export interface ExcelData {
    maxCols: number;
    sheets: SheetInfo[];
}

export function readCSV(buffer: ArrayBuffer): ExcelData {
    const csvStr = new TextDecoder("utf-8").decode(buffer);
    let maxCols = 26;
    let schema = inferSchema(csvStr, { header: () => [] });
    const rows = initParser(schema).stringArrs(csvStr).map(row => {
        return row.reduce((colMap, column, j) => {
            colMap[String.fromCharCode(65 + j)] = column
            if (j > maxCols) maxCols = j;
            return colMap
        }, {});
    });
    return {
        maxCols,
        sheets: [{ name: "Sheet1", rows }]
    }
}

export function readXLSX(buffer: ArrayBuffer): ExcelData {
    const wb = XLSX.read(buffer, { type: "array" })
    const sheets: SheetInfo[] = [];
    let maxCols = 26;
    wb.SheetNames.forEach(name => {
        const sheet = { name, rows: [] };
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { raw: false, header: 1 });
        sheet.rows = rows.map((row: any) => {
            return row.reduce((colMap, column, j) => {
                colMap[String.fromCharCode(65 + j)] = column
                if (j > maxCols) maxCols = j;
                return colMap
            }, {});
        })
        sheets.push(sheet);
    });
    return { sheets, maxCols };
}