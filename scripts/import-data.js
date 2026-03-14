require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PRICELIST_CSV = path.resolve(__dirname, '..', 'MARCH 11,2026(Pricelist).csv');
const YEAR1_XLSX = 'C:\\Users\\Justin\\Downloads\\YEAR 1 HISTORICAL SALES DATA.xlsx';
const YEAR2_XLSX = 'C:\\Users\\Justin\\Downloads\\YEAR-2-HISTORICAL-SALES-DATA.xlsx';

// ---------------------------------------------------------------------------
// 1. Parse pricelist CSV -> { brandCode, retailPrice, cartonSize }
// ---------------------------------------------------------------------------
function parsePricelist() {
  const raw = fs.readFileSync(PRICELIST_CSV, 'utf-8');
  const lines = raw.split('\n');
  const products = [];

  // Find the header row (contains "BRAND CODE")
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('BRAND CODE')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) { console.error('Could not find header row'); process.exit(1); }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with quoted fields
    const cols = parseCSVLine(line);
    const seqNo = cols[0]?.trim();
    const brandCode = cols[1]?.trim();
    const retailPriceStr = cols[4]?.trim().replace(/,/g, '');
    const cartonStr = cols[8]?.trim().replace(/,/g, '');

    if (!brandCode || !seqNo || isNaN(Number(seqNo))) continue;

    const retailPrice = parseFloat(retailPriceStr);
    const cartonSize = parseFloat(cartonStr);

    if (isNaN(retailPrice) || retailPrice <= 0) continue;

    products.push({
      name: brandCode,
      price: retailPrice,
      cartonSize: isNaN(cartonSize) || cartonSize <= 0 ? null : Math.round(cartonSize),
    });
  }

  return products;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// 2. Insert products into Supabase
// ---------------------------------------------------------------------------
async function insertProducts(products) {
  console.log(`\nInserting ${products.length} products...`);

  // Check if products already exist
  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
  if (count > 0) {
    console.log(`Products table already has ${count} rows. Skipping product insert.`);
    console.log('  (Clear products table first if you want to re-import)');
    return;
  }

  // Generate SKUs
  const rows = products.map((p, i) => ({
    name: p.name,
    price: p.price,
    carton_size: p.cartonSize,
    sku: `SKU-${String(i + 1).padStart(4, '0')}`,
    stock_quantity: 0,
  }));

  // Batch insert (Supabase limit is ~1000 per request)
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
    } else {
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} products)`);
    }
  }

  console.log('Products import done.');
}

// ---------------------------------------------------------------------------
// 3. Fuzzy matching
// ---------------------------------------------------------------------------

// Extract size suffix like "100G", "1kg", "500ml", "3.8L", "12x1kg", "3+1"
function extractSize(name) {
  // Normalize
  const n = name.trim().toUpperCase();

  // Match patterns like: 100G, 1KG, 500ML, 3.8L, 12X1KG, 24OZ, 3060G, etc.
  // Also match pack patterns: 3+1, 2+1, 9+3, X4, X 96, 12's
  const sizePatterns = [
    /(\d+\.?\d*\s*X\s*\d+\.?\d*\s*(?:KG|G|ML|L|LTR|LTRS|OZ))\s*$/i,
    /(\d+\.?\d*\s*(?:KG|G|ML|L|LTR|LTRS|OZ|GL)\.?)\s*$/i,
    /(\d+\+\d+)\s*$/i,
    /(\d+\.?\d*\s*(?:KG|G|ML|L|LTR|LTRS|OZ|GL)\.?)/i,
    /(X\s*\d+)\s*$/i,
    /(\d+'S)\s*$/i,
  ];

  for (const pat of sizePatterns) {
    const m = n.match(pat);
    if (m) {
      const size = m[1].replace(/\s+/g, '').toUpperCase();
      const base = n.slice(0, m.index).trim();
      return { base, size };
    }
  }

  return { base: n, size: '' };
}

// Normalize a product name for comparison
function normalize(name) {
  return name
    .toUpperCase()
    .replace(/[_\-.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Similarity score (0-1)
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Match a sales product name to a DB product
function findBestMatch(salesName, dbProducts) {
  const normSales = normalize(salesName);
  const salesParts = extractSize(normSales);

  let bestMatch = null;
  let bestScore = 0;

  for (const dbProd of dbProducts) {
    const normDb = normalize(dbProd.name);
    const dbParts = extractSize(normDb);

    // Sizes must match (or both be empty)
    const salesSize = salesParts.size.replace(/\s/g, '');
    const dbSize = dbParts.size.replace(/\s/g, '');

    if (salesSize !== dbSize) continue;

    // Compare base names
    const score = similarity(salesParts.base, dbParts.base);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = dbProd;
    }
  }

  return { match: bestMatch, score: bestScore };
}

// ---------------------------------------------------------------------------
// 4. Parse XLSX files
// ---------------------------------------------------------------------------
function parseXlsx(filePath) {
  console.log(`\nParsing ${path.basename(filePath)}...`);
  const workbook = XLSX.readFile(filePath);
  const allWeeks = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find the header row with dates (look for "PRODUCTS" in first cell)
    let headerRowIdx = -1;
    let productsColIdx = -1;

    for (let r = 0; r < Math.min(json.length, 10); r++) {
      const row = json[r];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c]).trim().toUpperCase();
        if (cell === 'PRODUCTS' || cell === 'PRODUCT') {
          headerRowIdx = r;
          productsColIdx = c;
          break;
        }
      }
      if (headerRowIdx >= 0) break;
    }

    if (headerRowIdx < 0) {
      console.log(`  Skipping sheet "${sheetName}" - no PRODUCTS header found`);
      continue;
    }

    // The date row is typically one row below the "WEEK X" label
    // Dates are in the same row as PRODUCTS or the row below
    const dateRow = json[headerRowIdx + 1] || json[headerRowIdx];
    const headerRow = json[headerRowIdx];

    // Find date columns - they should have date-like values
    const dateColumns = [];
    for (let c = productsColIdx + 1; c < headerRow.length; c++) {
      const cellAbove = headerRow[c]; // might be in the header row
      const cellBelow = dateRow ? dateRow[c] : null;

      // Check if this column header looks like "TOTAL" - skip it
      const headerStr = String(cellAbove || '').trim().toUpperCase();
      if (headerStr.includes('TOTAL')) break;

      // Try to parse a date from either row
      let dateVal = tryParseDate(cellAbove) || tryParseDate(cellBelow);
      if (dateVal) {
        dateColumns.push({ colIdx: c, date: dateVal });
      } else if (headerStr && !headerStr.includes('WEEK') && c > productsColIdx) {
        // Might be a date in Excel serial format
        const serialDate = tryParseExcelDate(cellAbove);
        if (serialDate) {
          dateColumns.push({ colIdx: c, date: serialDate });
        }
      }
    }

    if (dateColumns.length === 0) {
      // Try a different approach - use the row below headerRow for dates
      const altDateRow = json[headerRowIdx + 1];
      if (altDateRow) {
        for (let c = productsColIdx + 1; c < altDateRow.length; c++) {
          const val = altDateRow[c];
          const headerStr = String(headerRow[c] || '').trim().toUpperCase();
          if (headerStr.includes('TOTAL')) break;

          let dateVal = tryParseDate(val) || tryParseExcelDate(val);
          if (dateVal) {
            dateColumns.push({ colIdx: c, date: dateVal });
          }
        }
      }
    }

    if (dateColumns.length === 0) {
      console.log(`  Skipping sheet "${sheetName}" - no date columns found`);
      continue;
    }

    // Determine which row the product data starts (row after dates row)
    const dataStartRow = headerRowIdx + (dateRow === headerRow ? 1 : 2);

    // Parse product rows
    const weekData = { sheet: sheetName, days: [] };

    // Initialize days
    for (const dc of dateColumns) {
      weekData.days.push({ date: dc.date, colIdx: dc.colIdx, products: {} });
    }

    for (let r = dataStartRow; r < json.length; r++) {
      const row = json[r];
      const productName = String(row[productsColIdx] || '').trim();
      if (!productName) continue;

      for (let d = 0; d < dateColumns.length; d++) {
        const val = row[dateColumns[d].colIdx];
        const units = parseInt(String(val).trim(), 10);
        weekData.days[d].products[productName] = isNaN(units) ? 0 : units;
      }
    }

    allWeeks.push(weekData);
  }

  console.log(`  Parsed ${allWeeks.length} weeks`);
  return allWeeks;
}

function tryParseDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  // Try parsing common date formats: "8-Dec-25", "08-Dec-25", etc.
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    return formatDate(d);
  }
  return null;
}

function tryParseExcelDate(val) {
  if (typeof val === 'number' && val > 40000 && val < 60000) {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  return null;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 5. Detect no-duty days
// ---------------------------------------------------------------------------
function isNoDutyDay(dayData) {
  const values = Object.values(dayData.products);
  if (values.length === 0) return true;
  return values.every(v => v === 0);
}

// ---------------------------------------------------------------------------
// 6. Build match map + import sales data
// ---------------------------------------------------------------------------
async function importSalesData(allWeeks, dbProducts) {
  // Collect all unique product names from sales data
  const allSalesNames = new Set();
  for (const week of allWeeks) {
    for (const day of week.days) {
      for (const name of Object.keys(day.products)) {
        allSalesNames.add(name);
      }
    }
  }

  console.log(`\nFound ${allSalesNames.size} unique product names in sales data`);
  console.log(`Matching against ${dbProducts.length} products in DB...\n`);

  // Build match map
  const matchMap = new Map(); // salesName -> { dbProduct, score }
  const exactMatches = [];
  const fuzzyMatches = [];
  const noMatches = [];

  for (const salesName of allSalesNames) {
    // Try exact match first (normalized)
    const normSales = normalize(salesName);
    const exactMatch = dbProducts.find(p => normalize(p.name) === normSales);

    if (exactMatch) {
      matchMap.set(salesName, { dbProduct: exactMatch, score: 1.0 });
      exactMatches.push({ salesName, dbName: exactMatch.name, score: 1.0 });
      continue;
    }

    // Fuzzy match
    const { match, score } = findBestMatch(salesName, dbProducts);

    if (match && score >= 0.7) {
      matchMap.set(salesName, { dbProduct: match, score });
      fuzzyMatches.push({ salesName, dbName: match.name, score });
    } else {
      noMatches.push({ salesName, bestMatch: match?.name || 'NONE', score });
    }
  }

  // Print match report
  console.log('=== MATCH REPORT ===\n');
  console.log(`Exact matches: ${exactMatches.length}`);
  console.log(`Fuzzy matches: ${fuzzyMatches.length}`);
  console.log(`Unmatched:     ${noMatches.length}`);

  if (fuzzyMatches.length > 0) {
    console.log('\n--- Fuzzy Matches (review these) ---');
    fuzzyMatches
      .sort((a, b) => a.score - b.score)
      .forEach(m => {
        console.log(`  "${m.salesName}" -> "${m.dbName}" (${(m.score * 100).toFixed(0)}%)`);
      });
  }

  if (noMatches.length > 0) {
    console.log('\n--- Unmatched Products (will be SKIPPED) ---');
    noMatches.forEach(m => {
      console.log(`  "${m.salesName}" best: "${m.bestMatch}" (${(m.score * 100).toFixed(0)}%)`);
    });
  }

  // Write report to file
  const reportPath = path.resolve(__dirname, 'match-report.txt');
  const reportLines = [
    'PRODUCT MATCH REPORT',
    `Generated: ${new Date().toISOString()}`,
    `Exact: ${exactMatches.length}, Fuzzy: ${fuzzyMatches.length}, Unmatched: ${noMatches.length}`,
    '',
    '--- EXACT MATCHES ---',
    ...exactMatches.map(m => `"${m.salesName}" -> "${m.dbName}"`),
    '',
    '--- FUZZY MATCHES ---',
    ...fuzzyMatches.sort((a, b) => a.score - b.score).map(m =>
      `"${m.salesName}" -> "${m.dbName}" (${(m.score * 100).toFixed(0)}%)`
    ),
    '',
    '--- UNMATCHED ---',
    ...noMatches.map(m => `"${m.salesName}" best: "${m.bestMatch}" (${(m.score * 100).toFixed(0)}%)`),
  ];
  fs.writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`\nFull report saved to: ${reportPath}`);

  // Insert daily_sales data
  console.log('\nInserting daily sales data...');
  let totalInserted = 0;
  let totalSkipped = 0;
  let noDutyDays = 0;

  const batchRows = [];

  for (const week of allWeeks) {
    for (const day of week.days) {
      const isDuty = !isNoDutyDay(day);
      if (!isDuty) { noDutyDays++; }

      for (const [salesName, units] of Object.entries(day.products)) {
        const matchInfo = matchMap.get(salesName);
        if (!matchInfo) { totalSkipped++; continue; }

        batchRows.push({
          product_id: matchInfo.dbProduct.id,
          sale_date: day.date,
          units_sold: units,
          is_duty_day: isDuty,
        });
      }
    }
  }

  console.log(`  Total rows to insert: ${batchRows.length}`);
  console.log(`  No-duty days detected: ${noDutyDays}`);
  console.log(`  Skipped (unmatched): ${totalSkipped}`);

  // Deduplicate - if same product_id + sale_date appears multiple times, sum units
  const deduped = new Map();
  for (const row of batchRows) {
    const key = `${row.product_id}|${row.sale_date}`;
    if (deduped.has(key)) {
      const existing = deduped.get(key);
      existing.units_sold += row.units_sold;
    } else {
      deduped.set(key, { ...row });
    }
  }

  const finalRows = Array.from(deduped.values());
  console.log(`  After dedup: ${finalRows.length} unique rows`);

  // Batch upsert
  const batchSize = 500;
  for (let i = 0; i < finalRows.length; i += batchSize) {
    const batch = finalRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('daily_sales')
      .upsert(batch, { onConflict: 'product_id,sale_date' });

    if (error) {
      console.error(`  Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
    } else {
      totalInserted += batch.length;
      if ((i / batchSize + 1) % 10 === 0 || i + batchSize >= finalRows.length) {
        console.log(`  Inserted ${Math.min(i + batchSize, finalRows.length)}/${finalRows.length} rows`);
      }
    }
  }

  console.log(`\nDone! Inserted ${totalInserted} daily_sales rows.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== POS Historical Data Import ===\n');

  // Step 1: Parse pricelist
  console.log('Step 1: Parsing pricelist...');
  const pricelistProducts = parsePricelist();
  console.log(`  Found ${pricelistProducts.length} products in pricelist`);

  // Step 2: Insert products
  console.log('\nStep 2: Importing products to DB...');
  await insertProducts(pricelistProducts);

  // Step 3: Fetch products from DB (to get IDs)
  console.log('\nStep 3: Fetching products from DB...');
  const { data: dbProducts, error: fetchErr } = await supabase
    .from('products')
    .select('id, name')
    .order('name');
  if (fetchErr) { console.error('Failed to fetch products:', fetchErr.message); process.exit(1); }
  console.log(`  Got ${dbProducts.length} products from DB`);

  // Step 4: Parse XLSX files
  console.log('\nStep 4: Parsing XLSX sales data...');
  let allWeeks = [];

  if (fs.existsSync(YEAR1_XLSX)) {
    const y1 = parseXlsx(YEAR1_XLSX);
    allWeeks.push(...y1);
  } else {
    console.log(`  Year 1 file not found: ${YEAR1_XLSX}`);
  }

  if (fs.existsSync(YEAR2_XLSX)) {
    const y2 = parseXlsx(YEAR2_XLSX);
    allWeeks.push(...y2);
  } else {
    console.log(`  Year 2 file not found: ${YEAR2_XLSX}`);
  }

  console.log(`\nTotal weeks parsed: ${allWeeks.length}`);
  const totalDays = allWeeks.reduce((sum, w) => sum + w.days.length, 0);
  console.log(`Total days: ${totalDays}`);

  // Step 5: Match and import sales data
  await importSalesData(allWeeks, dbProducts);

  console.log('\n=== Import Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
