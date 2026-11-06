import { Platform, Share } from 'react-native';

const cell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Saves a CSV file on the web, or opens the share sheet on a phone. Excel reads the Romanian letters (BOM). */
export async function saveCsv(fileName: string, rows: string[][]) {
  const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\n');
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await Share.share({ title: fileName, message: csv });
  }
}
