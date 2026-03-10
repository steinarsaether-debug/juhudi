/**
 * Seed script: Kenyan market benchmark data
 *
 * All figures are sourced from official Kenyan government statistics and
 * reputable agricultural research institutions. Sources and reference years
 * are stored in the database for transparency and traceability.
 *
 * Key Sources:
 * - KNBS   Kenya National Bureau of Statistics       https://www.knbs.or.ke
 * - KTDA   Kenya Tea Development Agency              https://ktdateas.com
 * - KILIMO Ministry of Agriculture & Livestock Dev.  https://www.kilimo.go.ke
 * - LABOUR Kenya Ministry of Labour                  https://www.labour.go.ke
 * - TRFK   Tea Research Foundation of Kenya          https://teaboard.or.ke
 * - NKPCU  New Kenya Planters Cooperative Union      https://www.newkpcuplc.go.ke
 * - FSD    FSD Kenya / FinAccess Survey              https://fsdkenya.org
 * - USDA   USDA FAS Nairobi Kenya reports            https://apps.fas.usda.gov
 */

import { PrismaClient, BenchmarkCategory, BenchmarkScope, BenchmarkItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding benchmark data...\n');

  // ─── Data Sources ────────────────────────────────────────────────────────────

  const sources = await Promise.all([
    prisma.dataSource.upsert({
      where: { shortName: 'KNBS' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'Kenya National Bureau of Statistics',
        shortName: 'KNBS',
        url: 'https://www.knbs.or.ke',
        description:
          'Official government statistics including Economic Survey, CPI, Agricultural Production Reports, and Housing Survey. Primary source for cost-of-living, food prices, and agricultural statistics.',
        dataTypes: ['FOOD_NUTRITION', 'ACCOMMODATION', 'TRANSPORT', 'CROP_INCOME', 'LABOUR_WAGES'],
        updateFrequency: 'ANNUAL',
        lastCheckedAt: new Date('2025-01-01'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'KTDA' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'Kenya Tea Development Agency',
        shortName: 'KTDA',
        url: 'https://ktdateas.com',
        description:
          'Manages 66 tea factories serving 560,000+ smallholder farmers across 17 counties. Sets and publishes monthly green leaf payment rates. Primary source for tea income data.',
        dataTypes: ['CROP_INCOME', 'AGRICULTURAL_INPUTS'],
        updateFrequency: 'MONTHLY',
        lastCheckedAt: new Date('2026-02-01'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'KILIMO' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'Ministry of Agriculture & Livestock Development',
        shortName: 'KILIMO',
        url: 'https://www.kilimo.go.ke',
        description:
          'National Agriculture Production Reports, Dairy Master Plan, crop statistics by county. Source for maize yields, dairy sector data and agricultural inputs.',
        dataTypes: ['CROP_INCOME', 'LIVESTOCK_INCOME', 'AGRICULTURAL_INPUTS'],
        updateFrequency: 'ANNUAL',
        lastCheckedAt: new Date('2025-01-01'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'LABOUR' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'Kenya Ministry of Labour & Social Protection',
        shortName: 'LABOUR',
        url: 'https://www.labour.go.ke',
        description:
          'Regulation of Wages (Agricultural Industry) Order and Regulation of Wages (General) Amendment Order 2024. Legally mandated minimum wages by sector and region.',
        dataTypes: ['LABOUR_WAGES'],
        updateFrequency: 'ANNUAL',
        lastCheckedAt: new Date('2024-10-09'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'TRFK' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'Tea Research Foundation of Kenya',
        shortName: 'TRFK',
        url: 'https://teaboard.or.ke',
        description:
          "Tea Growers Handbook (5th edition) and research publications on tea yields, agronomic practices, and input requirements for Kenya's smallholder tea sector.",
        dataTypes: ['CROP_INCOME', 'AGRICULTURAL_INPUTS'],
        updateFrequency: 'IRREGULAR',
        lastCheckedAt: new Date('2024-01-01'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'NKPCU' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'New Kenya Planters Cooperative Union',
        shortName: 'NKPCU',
        url: 'https://www.newkpcuplc.go.ke',
        description:
          'Coffee auction prices from the Nairobi Coffee Exchange, smallholder payout data, cooperative society earnings. Primary source for coffee income benchmarks.',
        dataTypes: ['CROP_INCOME'],
        updateFrequency: 'MONTHLY',
        lastCheckedAt: new Date('2025-01-01'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'USDA-FAS' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'USDA Foreign Agricultural Service (Kenya)',
        shortName: 'USDA-FAS',
        url: 'https://apps.fas.usda.gov',
        description:
          'GAIN Reports: Kenya Grain and Feed Annual, Overview of Kenya Dairy Industry. Used for corroborating crop production statistics and farm-gate price data.',
        dataTypes: ['CROP_INCOME', 'LIVESTOCK_INCOME'],
        updateFrequency: 'ANNUAL',
        lastCheckedAt: new Date('2024-06-01'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'FSD' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'FSD Kenya / FinAccess Household Survey',
        shortName: 'FSD',
        url: 'https://fsdkenya.org',
        description:
          '2024 FinAccess Household Survey (CBK/KNBS/FSD Kenya). Household income, expenditure, financial inclusion, and cost-of-living data across Kenya.',
        dataTypes: ['FOOD_NUTRITION', 'ACCOMMODATION', 'EDUCATION', 'HEALTHCARE_UTILITIES'],
        updateFrequency: 'TRIENNIAL',
        lastCheckedAt: new Date('2024-12-03'),
        isActive: true,
      },
    }),
    prisma.dataSource.upsert({
      where: { shortName: 'MoE' },
      update: { lastCheckedAt: new Date() },
      create: {
        name: 'Ministry of Education Kenya',
        shortName: 'MoE',
        url: 'https://education.go.ke',
        description:
          'Official secondary school fee structures and capitation guidelines published by the Cabinet Secretary for Education. Gazette notices on boarding and levies.',
        dataTypes: ['EDUCATION'],
        updateFrequency: 'ANNUAL',
        lastCheckedAt: new Date('2024-01-01'),
        isActive: true,
      },
    }),
  ]);

  const [knbs, ktda, kilimo, labour, trfk, nkpcu, usdaFas, fsd, moe] = sources;

  console.log(`✅ Seeded ${sources.length} data sources`);

  // ─── Benchmark Items ──────────────────────────────────────────────────────────

  type ItemSpec = {
    category: BenchmarkCategory;
    name: string;
    description: string;
    unit: string;
    itemType: BenchmarkItemType;
    sortOrder: number;
  };

  const itemSpecs: ItemSpec[] = [
    // ── CROP INCOME ─────────────────────────────────────────────────────────────
    { category: 'CROP_INCOME', name: 'Tea — green leaf (no fertiliser)', description: 'Smallholder tea farm income, unfertilised, KTDA-managed factory', unit: 'KES/acre/year', itemType: 'INCOME_PER_UNIT', sortOrder: 1 },
    { category: 'CROP_INCOME', name: 'Tea — green leaf (with fertiliser)', description: 'Smallholder tea farm income, recommended fertiliser application', unit: 'KES/acre/year', itemType: 'INCOME_PER_UNIT', sortOrder: 2 },
    { category: 'CROP_INCOME', name: 'Tea — green leaf price (West of Rift)', description: 'Monthly KTDA factory payment rate per kg of green leaf, West of Rift factories', unit: 'KES/kg', itemType: 'PRICE_PER_UNIT', sortOrder: 3 },
    { category: 'CROP_INCOME', name: 'Tea — green leaf price (East of Rift)', description: 'Monthly KTDA factory payment rate per kg of green leaf, East of Rift factories', unit: 'KES/kg', itemType: 'PRICE_PER_UNIT', sortOrder: 4 },
    { category: 'CROP_INCOME', name: 'Maize — income per acre (small-scale)', description: 'Smallholder maize income per acre, rainfed, 2 seasons per year', unit: 'KES/acre/year', itemType: 'INCOME_PER_UNIT', sortOrder: 5 },
    { category: 'CROP_INCOME', name: 'Maize — farm gate price (90kg bag)', description: 'Market/NCPB farm gate price per 90 kg bag of dry maize', unit: 'KES/bag', itemType: 'PRICE_PER_UNIT', sortOrder: 6 },
    { category: 'CROP_INCOME', name: 'Coffee — income per acre (smallholder)', description: 'Arabica coffee income per acre, sold through cooperative, central highlands', unit: 'KES/acre/year', itemType: 'INCOME_PER_UNIT', sortOrder: 7 },
    { category: 'CROP_INCOME', name: 'French beans — income per acre', description: 'Export horticulture (French beans) income per acre, contract farming', unit: 'KES/acre/year', itemType: 'INCOME_PER_UNIT', sortOrder: 8 },
    { category: 'CROP_INCOME', name: 'Tomatoes — income per acre', description: 'Fresh tomatoes, local market, open-field cultivation', unit: 'KES/acre/year', itemType: 'INCOME_PER_UNIT', sortOrder: 9 },

    // ── LIVESTOCK INCOME ─────────────────────────────────────────────────────────
    { category: 'LIVESTOCK_INCOME', name: 'Dairy — grade cow (zero-grazing)', description: 'Monthly gross income from one grade dairy cow under zero-grazing management', unit: 'KES/cow/month', itemType: 'INCOME_PER_UNIT', sortOrder: 1 },
    { category: 'LIVESTOCK_INCOME', name: 'Dairy — local zebu (extensive)', description: 'Monthly gross income from one local zebu cow, extensive management', unit: 'KES/cow/month', itemType: 'INCOME_PER_UNIT', sortOrder: 2 },
    { category: 'LIVESTOCK_INCOME', name: 'Dairy — milk price (cooperative)', description: 'Farm gate milk price paid by dairy cooperatives / New KCC', unit: 'KES/litre', itemType: 'PRICE_PER_UNIT', sortOrder: 3 },
    { category: 'LIVESTOCK_INCOME', name: 'Dairy — milk price (informal market)', description: 'Direct sale price to neighbours / local traders', unit: 'KES/litre', itemType: 'PRICE_PER_UNIT', sortOrder: 4 },
    { category: 'LIVESTOCK_INCOME', name: 'Goats — income per head', description: 'Annual net income per goat (meat sales and kids)', unit: 'KES/goat/year', itemType: 'INCOME_PER_UNIT', sortOrder: 5 },
    { category: 'LIVESTOCK_INCOME', name: 'Poultry (local chicken) — income per bird', description: 'Annual income per indigenous chicken (eggs + bird sales)', unit: 'KES/bird/year', itemType: 'INCOME_PER_UNIT', sortOrder: 6 },

    // ── AGRICULTURAL INPUTS ──────────────────────────────────────────────────────
    { category: 'AGRICULTURAL_INPUTS', name: 'Maize — input cost per acre', description: 'Seed, DAP/NPK fertiliser, herbicide, labour for 1 acre of maize', unit: 'KES/acre/season', itemType: 'ANNUAL_EXPENSE', sortOrder: 1 },
    { category: 'AGRICULTURAL_INPUTS', name: 'Tea — annual input cost per acre', description: 'Fertiliser (CAN/NPK), pruning, recommended agronomic inputs for tea', unit: 'KES/acre/year', itemType: 'ANNUAL_EXPENSE', sortOrder: 2 },
    { category: 'AGRICULTURAL_INPUTS', name: 'DAP fertiliser (50 kg bag)', description: 'Market price for 50 kg bag of DAP fertiliser', unit: 'KES/bag', itemType: 'PRICE_PER_UNIT', sortOrder: 3 },
    { category: 'AGRICULTURAL_INPUTS', name: 'CAN fertiliser (50 kg bag)', description: 'Market price for 50 kg bag of CAN (Calcium Ammonium Nitrate)', unit: 'KES/bag', itemType: 'PRICE_PER_UNIT', sortOrder: 4 },

    // ── LABOUR & WAGES ───────────────────────────────────────────────────────────
    { category: 'LABOUR_WAGES', name: 'Agricultural casual labour — rural', description: 'Minimum statutory daily wage for casual farm labour in rural areas (Wages Order 2024)', unit: 'KES/day', itemType: 'WAGE_RATE', sortOrder: 1 },
    { category: 'LABOUR_WAGES', name: 'Agricultural casual labour — market rate', description: 'Actual market rate paid for casual farm labour (above statutory minimum)', unit: 'KES/day', itemType: 'WAGE_RATE', sortOrder: 2 },
    { category: 'LABOUR_WAGES', name: 'Permanent farm worker — rural monthly', description: 'Monthly wage for permanent agricultural employee in rural area (statutory minimum)', unit: 'KES/month', itemType: 'MONTHLY_INCOME', sortOrder: 3 },
    { category: 'LABOUR_WAGES', name: 'Boda-boda rider — monthly income', description: 'Net monthly income for a boda-boda (motorcycle taxi) rider, rural Kenya', unit: 'KES/month', itemType: 'MONTHLY_INCOME', sortOrder: 4 },

    // ── FOOD & NUTRITION ─────────────────────────────────────────────────────────
    { category: 'FOOD_NUTRITION', name: 'Monthly food basket (rural household)', description: 'Estimated monthly food expenditure for a rural household of 5 (KNBS KIHBS)', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 1 },
    { category: 'FOOD_NUTRITION', name: 'Monthly food basket (urban household)', description: 'Estimated monthly food expenditure for an urban household of 5 (KNBS KIHBS)', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 2 },
    { category: 'FOOD_NUTRITION', name: 'Maize flour (2 kg packet)', description: 'Retail price of 2 kg packet of unga (maize flour)', unit: 'KES/2kg', itemType: 'PRICE_PER_UNIT', sortOrder: 3 },
    { category: 'FOOD_NUTRITION', name: 'Cooking oil (1 litre)', description: 'Retail price per litre of cooking oil', unit: 'KES/litre', itemType: 'PRICE_PER_UNIT', sortOrder: 4 },

    // ── ACCOMMODATION ────────────────────────────────────────────────────────────
    { category: 'ACCOMMODATION', name: 'Monthly rent — 1 bedroom (rural)', description: 'Typical monthly rent for a 1-bedroom house in a rural/peri-urban area', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 1 },
    { category: 'ACCOMMODATION', name: 'Monthly rent — 1 bedroom (county town)', description: 'Typical monthly rent for a 1-bedroom house in a county headquarters town', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 2 },
    { category: 'ACCOMMODATION', name: 'Monthly rent — 1 bedroom (Nairobi)', description: 'Typical monthly rent for a 1-bedroom house in Nairobi estates', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 3 },

    // ── TRANSPORT ────────────────────────────────────────────────────────────────
    { category: 'TRANSPORT', name: 'Monthly transport (rural commuter)', description: 'Monthly boda-boda and matatu cost for a rural resident with regular market trips', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 1 },
    { category: 'TRANSPORT', name: 'Monthly transport (urban commuter)', description: 'Monthly matatu cost for an urban commuter (daily work trips)', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 2 },
    { category: 'TRANSPORT', name: 'Matatu fare — short route (urban)', description: 'Single matatu trip within an urban area (up to 10 km)', unit: 'KES/trip', itemType: 'PRICE_PER_UNIT', sortOrder: 3 },

    // ── EDUCATION ────────────────────────────────────────────────────────────────
    { category: 'EDUCATION', name: 'Primary school — annual levies', description: 'Annual school levies for public primary school (FPE, but additional levies allowed)', unit: 'KES/year/child', itemType: 'ANNUAL_EXPENSE', sortOrder: 1 },
    { category: 'EDUCATION', name: 'Day secondary — annual cost', description: 'Annual cost for a public day secondary school (government capitation covers tuition)', unit: 'KES/year/child', itemType: 'ANNUAL_EXPENSE', sortOrder: 2 },
    { category: 'EDUCATION', name: 'Boarding secondary — annual (county school)', description: 'Annual boarding fees for a public county/extra-county boarding secondary school (2024)', unit: 'KES/year/child', itemType: 'ANNUAL_EXPENSE', sortOrder: 3 },
    { category: 'EDUCATION', name: 'Boarding secondary — annual (national school)', description: 'Annual boarding fees for a public national boarding secondary school (2024)', unit: 'KES/year/child', itemType: 'ANNUAL_EXPENSE', sortOrder: 4 },

    // ── HEALTHCARE & UTILITIES ───────────────────────────────────────────────────
    { category: 'HEALTHCARE_UTILITIES', name: 'Monthly health expenditure (rural)', description: 'Average monthly OOP health expenditure per household in rural Kenya', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 1 },
    { category: 'HEALTHCARE_UTILITIES', name: 'Monthly electricity (rural homestead)', description: 'Average monthly KPLC prepaid electricity cost for a rural household', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 2 },
    { category: 'HEALTHCARE_UTILITIES', name: 'Monthly water cost (no piped water)', description: 'Monthly cost of fetching/buying water for households without piped connection', unit: 'KES/month', itemType: 'MONTHLY_EXPENSE', sortOrder: 3 },
  ];

  let itemCount = 0;
  const itemMap: Record<string, string> = {};

  for (const spec of itemSpecs) {
    const item = await prisma.benchmarkItem.upsert({
      where: { category_name: { category: spec.category, name: spec.name } },
      update: { description: spec.description, unit: spec.unit, itemType: spec.itemType, sortOrder: spec.sortOrder },
      create: spec,
    });
    itemMap[spec.name] = item.id;
    itemCount++;
  }

  console.log(`✅ Seeded ${itemCount} benchmark items`);

  // ─── Benchmark Values ─────────────────────────────────────────────────────────
  // Each value has: low/mid/high range, reference year, geographic scope, source, notes

  type ValueSpec = {
    itemName: string;
    sourceShortName: string;
    scope: BenchmarkScope;
    county?: string;
    region?: string;
    valueLow: number;
    valueMid: number;
    valueHigh: number;
    referenceYear: number;
    validFrom: Date;
    notes: string;
    assumptions?: string;
  };

  const sourceMap: Record<string, string> = {
    KNBS: knbs.id, KTDA: ktda.id, KILIMO: kilimo.id,
    LABOUR: labour.id, TRFK: trfk.id, NKPCU: nkpcu.id,
    'USDA-FAS': usdaFas.id, FSD: fsd.id, MoE: moe.id,
  };

  const valueSpecs: ValueSpec[] = [

    // ── TEA INCOME ───────────────────────────────────────────────────────────────
    // Green leaf yield: TRFK data; unfertilised smallholder ~5,000–7,000 kg/acre/year
    // Price (Jan 2024): KTDA West of Rift KES 20→24; East KES 21→25. Feb 2026: West KES 26, East KES 30+
    {
      itemName: 'Tea — green leaf (no fertiliser)',
      sourceShortName: 'TRFK',
      scope: 'REGION', region: 'RIFT VALLEY',
      valueLow: 90_000, valueMid: 130_000, valueHigh: 168_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Unfertilised smallholder yield ~5,000–7,000 kg green leaf/acre/year × KES 20–24/kg (KTDA West of Rift 2024 rate)',
      assumptions: 'No fertiliser, KTDA factory, West of Rift counties (Kericho, Bomet, Kisii, Nyamira)',
    },
    {
      itemName: 'Tea — green leaf (no fertiliser)',
      sourceShortName: 'TRFK',
      scope: 'REGION', region: 'CENTRAL HIGHLANDS',
      valueLow: 105_000, valueMid: 150_000, valueHigh: 192_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Unfertilised smallholder yield ~5,000–7,000 kg/acre/year × KES 21–25/kg (KTDA East of Rift 2024 rate)',
      assumptions: 'No fertiliser, KTDA factory, East of Rift counties (Kirinyaga, Nyeri, Murang\'a, Embu, Meru)',
    },
    {
      itemName: 'Tea — green leaf (with fertiliser)',
      sourceShortName: 'KTDA',
      scope: 'NATIONAL',
      valueLow: 190_000, valueMid: 240_000, valueHigh: 283_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Standard management, recommended fertiliser — KTDA/Kibosfarm data 2024. Top-performing farmers achieve KES 283k/acre.',
      assumptions: 'CAN/NPK fertiliser applied, good husbandry, KTDA-managed factory',
    },
    {
      itemName: 'Tea — green leaf price (West of Rift)',
      sourceShortName: 'KTDA',
      scope: 'NATIONAL',
      valueLow: 24, valueMid: 26, valueHigh: 28,
      referenceYear: 2026, validFrom: new Date('2026-02-01'),
      notes: 'KTDA revised factory board rates Feb 2026: West of Rift minimum KES 26/kg. Previously KES 20–24 (Jan 2024).',
      assumptions: 'KTDA-managed factories in Kericho, Bomet, Kisii, Nyamira, Nandi',
    },
    {
      itemName: 'Tea — green leaf price (East of Rift)',
      sourceShortName: 'KTDA',
      scope: 'NATIONAL',
      valueLow: 28, valueMid: 30, valueHigh: 33,
      referenceYear: 2026, validFrom: new Date('2026-02-01'),
      notes: 'KTDA revised factory board rates Feb 2026: East of Rift minimum KES 30/kg. Previously KES 21–25 (Jan 2024).',
      assumptions: 'KTDA-managed factories in Kirinyaga, Nyeri, Murang\'a, Embu, Meru, Kiambu',
    },

    // ── MAIZE ────────────────────────────────────────────────────────────────────
    // KNBS National Agriculture Production Report 2024: avg yield 18.5 bags/ha = ~7.5 bags/acre
    // Good management: 20–25 bags/acre. Farm gate: KES 3,443–3,600/90kg bag (2024).
    // Two seasons/year typical in high-potential zones.
    {
      itemName: 'Maize — income per acre (small-scale)',
      sourceShortName: 'KNBS',
      scope: 'REGION', region: 'RIFT VALLEY',
      valueLow: 20_000, valueMid: 52_000, valueHigh: 90_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Low = 1 poor season (6 bags × KES 3,443); Mid = 2 good seasons (15 bags/acre × KES 3,443 × 1 season); High = top management 2 seasons.',
      assumptions: 'Rainfed, 90kg bag @ KES 3,443 farm gate (2024). Rift Valley (Uasin Gishu, Trans Nzoia, Nakuru).',
    },
    {
      itemName: 'Maize — income per acre (small-scale)',
      sourceShortName: 'KNBS',
      scope: 'REGION', region: 'WESTERN',
      valueLow: 15_000, valueMid: 40_000, valueHigh: 75_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Western Kenya smallholder yields typically lower than Rift Valley due to soil constraints.',
      assumptions: 'Rainfed, Bungoma, Kakamega, Busia counties. Two seasons but uneven.',
    },
    {
      itemName: 'Maize — farm gate price (90kg bag)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 3_200, valueMid: 3_443, valueHigh: 3_600,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS National Agriculture Production Report 2024. NCPB target: KES 3,500; millers offered up to KES 3,600.',
      assumptions: 'Dry maize, 90 kg bag, farm gate price 2024',
    },

    // ── COFFEE ───────────────────────────────────────────────────────────────────
    // Smallholder: ~KES 150k–300k/acre. Half-acre = KES 96k (agronomist data).
    // Estate/well-managed can reach KES 500k–800k.
    {
      itemName: 'Coffee — income per acre (smallholder)',
      sourceShortName: 'NKPCU',
      scope: 'REGION', region: 'CENTRAL HIGHLANDS',
      valueLow: 100_000, valueMid: 192_000, valueHigh: 400_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Victor Munene (Mutira FCS agronomist): 0.5 acre = KES 96k/year → KES 192k/acre. Well-managed can reach KES 300k–800k/acre.',
      assumptions: 'Arabica coffee, sold through cooperative society, Central Highlands (Kirinyaga, Nyeri, Kiambu, Murang\'a)',
    },

    // ── HORTICULTURE ─────────────────────────────────────────────────────────────
    {
      itemName: 'French beans — income per acre',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 80_000, valueMid: 150_000, valueHigh: 250_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Export French beans, contract farming with exporter. 2–3 harvests/year. Excludes input costs (~KES 40k/acre).',
      assumptions: 'Export-grade, contract with outgrower scheme; Kenya highland regions',
    },
    {
      itemName: 'Tomatoes — income per acre',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 60_000, valueMid: 120_000, valueHigh: 200_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Local market tomatoes, open-field. Price volatility significant. Net after inputs (KES 30–50k/acre).',
      assumptions: 'Rainfed or supplemental irrigation, sold at local market',
    },

    // ── LIVESTOCK ────────────────────────────────────────────────────────────────
    // Dairy: grade cow 15–25 litres/day; New KCC price KES 50/litre from March 2024.
    // Gross: 20L × 30days × KES 45 = KES 27,000/month. Net after feed ~KES 8k–15k/month.
    {
      itemName: 'Dairy — grade cow (zero-grazing)',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 10_000, valueMid: 20_000, valueHigh: 30_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Gross income: 15–25L/day × 30 × KES 45–50/L. Net after feed (KES 10–18k/month). New KCC raised to KES 50/L March 2024.',
      assumptions: 'Friesian/crossbred grade cow, zero-grazing, cooperative or New KCC market',
    },
    {
      itemName: 'Dairy — local zebu (extensive)',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 1_800, valueMid: 3_500, valueHigh: 6_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Local zebu cow: 2–4 litres/day on average. Sold informally at KES 35–45/litre.',
      assumptions: 'Local zebu/Boran, free-range, informal market',
    },
    {
      itemName: 'Dairy — milk price (cooperative)',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 40, valueMid: 50, valueHigh: 55,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'New KCC raised farm gate price to KES 50/litre from March 1, 2024 (from KES 45). Cooperative range KES 40–55.',
      assumptions: 'Formal cooperative or New KCC. Informal traders may pay KES 35–45.',
    },
    {
      itemName: 'Dairy — milk price (informal market)',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 35, valueMid: 45, valueHigh: 55,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Direct sale to neighbours or local traders. Typically KES 35–50/litre.',
      assumptions: 'Informal milk trader, cash payment, no pasteurisation',
    },
    {
      itemName: 'Goats — income per head',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 3_000, valueMid: 6_000, valueHigh: 12_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Estimated annual income from goat-keeping: kid sales + meat sales. Varies by breed (local vs. improved).',
      assumptions: 'Local breed, extensive management, rural market',
    },
    {
      itemName: 'Poultry (local chicken) — income per bird',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 500, valueMid: 900, valueHigh: 1_500,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Annual gross income per indigenous chicken (egg sales + live bird sale). Market price KES 500–1,200 per bird.',
      assumptions: 'Indigenous chicken, free-range, rural market sales',
    },

    // ── AGRICULTURAL INPUTS ──────────────────────────────────────────────────────
    {
      itemName: 'Maize — input cost per acre',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 10_000, valueMid: 30_000, valueHigh: 54_550,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Farmworx Kenya 2025: full cost KES 54,550/acre (certified seed, DAP, CAN, herbicide, labour). Minimal = seed + basic labour.',
      assumptions: 'One season. Government subsidised fertiliser at KES 3,500/bag (50 kg DAP) if eligible.',
    },
    {
      itemName: 'Tea — annual input cost per acre',
      sourceShortName: 'TRFK',
      scope: 'NATIONAL',
      valueLow: 8_000, valueMid: 20_000, valueHigh: 35_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Annual fertiliser (CAN/NPK) + pruning + basic inputs for one acre of smallholder tea. Varies by management intensity.',
      assumptions: 'KTDA-registered farmer, recommended agronomic package',
    },
    {
      itemName: 'DAP fertiliser (50 kg bag)',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 3_500, valueMid: 5_500, valueHigh: 7_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Government-subsidised price KES 3,500/50kg bag; open market KES 5,000–7,000 in 2024. Subsidy targeted at Western/Rift Valley.',
      assumptions: 'Per 50 kg bag. DAP (Di-Ammonium Phosphate).',
    },
    {
      itemName: 'CAN fertiliser (50 kg bag)',
      sourceShortName: 'KILIMO',
      scope: 'NATIONAL',
      valueLow: 2_800, valueMid: 4_500, valueHigh: 6_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Calcium Ammonium Nitrate (CAN) — widely used for tea top-dressing. Market price 2024.',
      assumptions: 'Per 50 kg bag, agro-dealer price',
    },

    // ── LABOUR & WAGES ───────────────────────────────────────────────────────────
    // Legal Notice 163 of 2024 (Reg of Wages Agricultural Industry Amendment Order 2024)
    // Rural general worker: KES 7,997/month → ~KES 267/day (30-day month)
    // Urban: KES 16,113/month → ~KES 537/day. Agricultural sector lower.
    {
      itemName: 'Agricultural casual labour — rural',
      sourceShortName: 'LABOUR',
      scope: 'NATIONAL',
      valueLow: 267, valueMid: 350, valueHigh: 500,
      referenceYear: 2024, validFrom: new Date('2024-11-01'),
      notes: 'Statutory minimum: Rural worker KES 7,997/month ÷ 30 = KES 267/day (Regulation of Wages Gen Amendment Order 2024, LN 164).',
      assumptions: 'Agricultural casual day worker, rural area. Actual market rate often KES 350–500/day.',
    },
    {
      itemName: 'Agricultural casual labour — market rate',
      sourceShortName: 'LABOUR',
      scope: 'NATIONAL',
      valueLow: 350, valueMid: 500, valueHigh: 700,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Actual market rate for casual farm labour typically exceeds statutory minimum. Harvesting/planting peak: KES 500–700/day.',
      assumptions: 'Agricultural seasonal/casual labour, rural areas. Living wage estimated at KES 35,518/month.',
    },
    {
      itemName: 'Permanent farm worker — rural monthly',
      sourceShortName: 'LABOUR',
      scope: 'NATIONAL',
      valueLow: 7_997, valueMid: 12_000, valueHigh: 18_000,
      referenceYear: 2024, validFrom: new Date('2024-11-01'),
      notes: 'Statutory minimum KES 7,997.33/month for rural agricultural worker (LN 163/2024, effective Nov 2024).',
      assumptions: 'Full-time permanent farm employee, rural area',
    },
    {
      itemName: 'Boda-boda rider — monthly income',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 10_000, valueMid: 18_000, valueHigh: 30_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Net income after fuel and maintenance. Rural boda-boda significantly less than urban.',
      assumptions: 'Motorcycle taxi rider, rural/peri-urban. Own motorcycle (financed) or hired.',
    },

    // ── FOOD & NUTRITION ─────────────────────────────────────────────────────────
    {
      itemName: 'Monthly food basket (rural household)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 5_000, valueMid: 8_000, valueHigh: 14_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS KIHBS estimate for rural household of 5. Includes maize, beans, vegetables, cooking oil, sugar. Subsistence farming reduces cash spend.',
      assumptions: 'Household of 5, rural area, partial subsistence from farm',
    },
    {
      itemName: 'Monthly food basket (urban household)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 10_000, valueMid: 16_000, valueHigh: 25_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS CPI food basket 2024. Urban household fully dependent on purchased food.',
      assumptions: 'Household of 5, urban area, no subsistence farming',
    },
    {
      itemName: 'Maize flour (2 kg packet)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 130, valueMid: 160, valueHigh: 200,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS CPI monthly commodity prices. Prices eased in 2024 due to improved maize harvest.',
      assumptions: 'Retail price, 2 kg unga (supermarket or local shop)',
    },
    {
      itemName: 'Cooking oil (1 litre)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 200, valueMid: 270, valueHigh: 350,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS CPI 2024 price monitoring.',
      assumptions: 'Retail, 1 litre cooking oil',
    },

    // ── ACCOMMODATION ────────────────────────────────────────────────────────────
    {
      itemName: 'Monthly rent — 1 bedroom (rural)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 2_500, valueMid: 5_000, valueHigh: 9_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS 2023/24 Kenya Housing Survey. Rural 1-bedroom stone/iron sheet house in village setting.',
      assumptions: 'Rural area, stone/mud walls, corrugated iron roof, no piped water',
    },
    {
      itemName: 'Monthly rent — 1 bedroom (county town)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 5_000, valueMid: 10_000, valueHigh: 18_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'County headquarters towns (Nakuru, Kisumu, Eldoret, Mombasa secondary areas). KNBS Housing Survey 2024.',
      assumptions: 'County town, basic amenities, 1-bedroom permanent structure',
    },
    {
      itemName: 'Monthly rent — 1 bedroom (Nairobi)',
      sourceShortName: 'KNBS',
      scope: 'COUNTY', county: 'Nairobi',
      valueLow: 12_000, valueMid: 22_000, valueHigh: 45_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Nairobi: Embakasi/Eastlands KES 12k–20k; Westlands/Kilimani KES 30k–60k. KNBS Housing Survey 2024.',
      assumptions: 'Nairobi city, 1-bedroom apartment',
    },

    // ── TRANSPORT ────────────────────────────────────────────────────────────────
    {
      itemName: 'Monthly transport (rural commuter)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 1_500, valueMid: 3_000, valueHigh: 6_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS CPI transport component. Rural commuter: boda-boda + occasional matatu for market/town trips.',
      assumptions: 'Rural resident, 2–3 market trips/week by boda-boda',
    },
    {
      itemName: 'Monthly transport (urban commuter)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 3_000, valueMid: 5_000, valueHigh: 9_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS CPI. Urban matatu 2×daily commute @ KES 100–150/trip × 22 working days = KES 4,400–6,600/month.',
      assumptions: 'Urban worker, daily matatu commute, 22 working days/month',
    },
    {
      itemName: 'Matatu fare — short route (urban)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 50, valueMid: 100, valueHigh: 150,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KNBS CPI transport monitoring. Short route urban matatu fare. Mombasa–Nairobi long-distance: KES 1,300–1,500.',
      assumptions: 'Urban matatu, single trip up to 10 km, peak hour rates higher',
    },

    // ── EDUCATION ────────────────────────────────────────────────────────────────
    {
      itemName: 'Primary school — annual levies',
      sourceShortName: 'MoE',
      scope: 'NATIONAL',
      valueLow: 2_000, valueMid: 8_000, valueHigh: 20_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Government FPE capitation covers tuition. Schools may levy for uniform, activity fees, etc. Varies widely by school.',
      assumptions: 'Public primary school, 1 child. Government capitation: KES 1,420/child/term.',
    },
    {
      itemName: 'Day secondary — annual cost',
      sourceShortName: 'MoE',
      scope: 'NATIONAL',
      valueLow: 5_000, valueMid: 12_000, valueHigh: 25_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'FDSE: government capitation KES 22,244/year covers tuition. Parents pay levies (uniforms, activities, M&I). Day schools = zero tuition.',
      assumptions: 'Public day secondary, 1 child. Includes approved levies only.',
    },
    {
      itemName: 'Boarding secondary — annual (county school)',
      sourceShortName: 'MoE',
      scope: 'NATIONAL',
      valueLow: 35_000, valueMid: 40_535, valueHigh: 45_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Ministry of Education 2024 gazette: county/extra-county boarding schools capped at KES 40,535/year. Excludes uniforms.',
      assumptions: 'Public boarding school, county/extra-county category, 1 child per year',
    },
    {
      itemName: 'Boarding secondary — annual (national school)',
      sourceShortName: 'MoE',
      scope: 'NATIONAL',
      valueLow: 45_000, valueMid: 53_554, valueHigh: 58_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Ministry of Education 2024: national boarding school cap KES 53,554/year. 2026 new structure unifies at KES 53,554.',
      assumptions: 'Public national boarding school, 1 child per year',
    },

    // ── HEALTHCARE & UTILITIES ───────────────────────────────────────────────────
    {
      itemName: 'Monthly health expenditure (rural)',
      sourceShortName: 'FSD',
      scope: 'NATIONAL',
      valueLow: 500, valueMid: 1_500, valueHigh: 4_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'FinAccess 2024 / KNBS KIHBS. Includes OPD visits, pharmacy, NHIF co-pays. Excludes major illness (emergency).',
      assumptions: 'Rural household of 5, NHIF cover assumed, NHIF abolished/SHIF transition 2024',
    },
    {
      itemName: 'Monthly electricity (rural homestead)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 200, valueMid: 500, valueHigh: 1_200,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'KPLC prepaid tokens. Rural households on last-mile connections use limited power (lights, phone charging, small TV).',
      assumptions: 'KPLC Last Mile connection, low-use rural household',
    },
    {
      itemName: 'Monthly water cost (no piped water)',
      sourceShortName: 'KNBS',
      scope: 'NATIONAL',
      valueLow: 0, valueMid: 500, valueHigh: 2_000,
      referenceYear: 2024, validFrom: new Date('2024-01-01'),
      notes: 'Households collecting from river or communal borehole: KES 0 direct cost. Water kiosks: KES 5–20 per 20L jerrycan.',
      assumptions: 'No piped water connection. 0 if using river/borehole; higher if buying from vendor.',
    },
  ];

  let valueCount = 0;
  for (const spec of valueSpecs) {
    const itemId = itemMap[spec.itemName];
    if (!itemId) {
      console.warn(`⚠️  Item not found: "${spec.itemName}" — skipping value`);
      continue;
    }
    const sourceId = sourceMap[spec.sourceShortName];
    if (!sourceId) {
      console.warn(`⚠️  Source not found: "${spec.sourceShortName}" — skipping value`);
      continue;
    }

    // Check if a value already exists for this item+scope+county+region+year combination
    const existing = await prisma.benchmarkValue.findFirst({
      where: {
        itemId,
        scope: spec.scope,
        county: spec.county ?? null,
        region: spec.region ?? null,
        referenceYear: spec.referenceYear,
      },
    });

    if (existing) {
      await prisma.benchmarkValue.update({
        where: { id: existing.id },
        data: {
          sourceId,
          valueLow: spec.valueLow, valueMid: spec.valueMid, valueHigh: spec.valueHigh,
          notes: spec.notes, assumptions: spec.assumptions ?? null,
          validFrom: spec.validFrom, validTo: null, isActive: true,
        },
      });
    } else {
      await prisma.benchmarkValue.create({
        data: {
          itemId, sourceId,
          scope: spec.scope, county: spec.county ?? null, region: spec.region ?? null,
          valueLow: spec.valueLow, valueMid: spec.valueMid, valueHigh: spec.valueHigh,
          referenceYear: spec.referenceYear,
          validFrom: spec.validFrom, validTo: null,
          notes: spec.notes, assumptions: spec.assumptions ?? null,
          isActive: true,
        },
      });
    }
    valueCount++;
  }

  console.log(`✅ Seeded ${valueCount} benchmark values`);
  console.log('\n🎉 Benchmark seeding complete!\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
