import { Product, DokanVendor, StoreConfig } from '../types';

export interface CsvExportResult {
  filename: string;
  count: number;
}

/**
 * Escapes a cell value for standard CSV compliance (RFC 4180).
 */
const escapeCsvCell = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value);
  // If the value contains comma, quotes, or newlines, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return `"${stringValue}"`;
};

/**
 * Exports the filtered product list for the logged-in vendor to a CSV file for offline audits.
 */
export const exportProductsToCsv = (
  products: Product[],
  vendor: DokanVendor,
  config: StoreConfig
): CsvExportResult => {
  const headers = [
    'ID Producto',
    'Nombre del Producto',
    'SKU',
    'Categoría',
    `Precio Venta (${config.currencySymbol})`,
    `Precio Regular (${config.currencySymbol})`,
    `Precio Rebajado (${config.currencySymbol})`,
    'Cantidad en Stock',
    'Estado de Stock',
    'Gestiona Inventario',
    'Estado de Sincronización',
    'Etiquetas',
    'ID Vendedor',
    'Tienda / Negocio',
    'Email Vendedor',
    'URL Imagen',
    'Fecha de Auditoría',
  ];

  const exportDate = new Date().toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const rows = products.map((p) => [
    escapeCsvCell(p.id),
    escapeCsvCell(p.name),
    escapeCsvCell(p.sku),
    escapeCsvCell(p.category),
    escapeCsvCell(p.price.toFixed(2)),
    escapeCsvCell(p.regularPrice.toFixed(2)),
    escapeCsvCell(p.salePrice !== undefined ? p.salePrice.toFixed(2) : ''),
    escapeCsvCell(p.stockQuantity),
    escapeCsvCell(p.stockStatus === 'instock' && p.stockQuantity > 0 ? 'En Stock' : 'Agotado'),
    escapeCsvCell(p.manageStock ? 'Sí' : 'No'),
    escapeCsvCell(p.isModifiedLocally ? 'Cambio Local Pendiente' : 'Sincronizado'),
    escapeCsvCell((p.tags || []).join(', ')),
    escapeCsvCell(vendor.id),
    escapeCsvCell(vendor.storeName),
    escapeCsvCell(vendor.email),
    escapeCsvCell(p.imageUrl),
    escapeCsvCell(exportDate),
  ]);

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility with accents and international characters
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Generate safe filename with store name and current date/time
  const storeSlug = vendor.storeName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const timeStamp = now.toTimeString().slice(0, 5).replace(':', '');
  const filename = `merqba_fa_auditoria_${storeSlug}_${dateStamp}_${timeStamp}.csv`;

  // Trigger browser file download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    filename,
    count: products.length,
  };
};
