export interface PriceListItem {
  product_name: string;
  withdrawal_price: number;
  retail_price: number;
  carton_size: number | null;
}

export type PriceListMap = Record<string, PriceListItem>;

export async function parsePricelist(): Promise<PriceListMap> {
  try {
    const response = await fetch('/assets/pricelist.csv');
    if (!response.ok) throw new Error('Failed to fetch pricelist');

    const csv = await response.text();
    const lines = csv.split('\n');
    const map: PriceListMap = {};

    // Skip header rows (first 7 rows)
    for (let i = 7; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line
      const columns = parseCSVLine(line);
      if (columns.length < 9) continue;

      // Columns: SEQ NO., BRAND CODE (product_name), DESCRIPTION (empty), WITHDRAWAL PRICE, RETAIL PRICE, _, _, _, _, CARTON CONVERSION
      const productName = columns[1]?.trim(); // Product name is in column 1 (BRAND CODE)
      const withdrawalPriceStr = columns[3]?.trim();
      const retailPriceStr = columns[4]?.trim();
      const cartonSizeStr = columns[8]?.trim(); // Carton is in column 8

      if (!productName || !withdrawalPriceStr || !retailPriceStr) continue;

      // Parse numbers, handling "-" for missing values
      const withdrawalPrice = parsePrice(withdrawalPriceStr);
      const retailPrice = parsePrice(retailPriceStr);
      const cartonSize = parseFloat(cartonSizeStr) || null;

      if (withdrawalPrice === null || retailPrice === null) continue;

      map[productName] = {
        product_name: productName,
        withdrawal_price: withdrawalPrice,
        retail_price: retailPrice,
        carton_size: cartonSize,
      };
    }

    return map;
  } catch (error) {
    console.error('Error parsing pricelist:', error);
    return {};
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parsePrice(priceStr: string): number | null {
  if (!priceStr || priceStr === '-' || priceStr.trim() === '') {
    return null;
  }

  // Remove currency symbols and spaces
  const cleaned = priceStr.replace(/[$,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? null : parsed;
}

// Cache the pricelist
let pricelistCache: PriceListMap | null = null;
let pricelistLoadingPromise: Promise<PriceListMap> | null = null;

export async function getPricelist(): Promise<PriceListMap> {
  if (pricelistCache) return pricelistCache;

  if (pricelistLoadingPromise) {
    return pricelistLoadingPromise;
  }

  pricelistLoadingPromise = parsePricelist().then((result) => {
    pricelistCache = result;
    pricelistLoadingPromise = null;
    return result;
  });

  return pricelistLoadingPromise;
}
