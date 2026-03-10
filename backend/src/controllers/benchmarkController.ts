import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { BenchmarkCategory, BenchmarkScope, Prisma } from '@prisma/client';
import { writeAuditLog } from '../middleware/audit';

// ─── Category metadata (labels for UI) ────────────────────────────────────────

const CATEGORY_META: Record<BenchmarkCategory, { label: string; icon: string; description: string }> = {
  FOOD_NUTRITION:       { label: 'Food & Nutrition',        icon: '🌽', description: 'Food basket, staple crop prices' },
  ACCOMMODATION:        { label: 'Accommodation',           icon: '🏠', description: 'Rent by region and housing type' },
  TRANSPORT:            { label: 'Transport',               icon: '🚌', description: 'Matatu, boda-boda, fuel costs' },
  EDUCATION:            { label: 'Education',               icon: '📚', description: 'School fees and levies' },
  HEALTHCARE_UTILITIES: { label: 'Healthcare & Utilities',  icon: '💊', description: 'Clinic, electricity, water costs' },
  CLOTHING_PERSONAL:    { label: 'Clothing & Personal',     icon: '👕', description: 'Clothing and toiletry costs' },
  CROP_INCOME:          { label: 'Crop Income',             icon: '🍃', description: 'Expected income per acre by crop' },
  LIVESTOCK_INCOME:     { label: 'Livestock Income',        icon: '🐄', description: 'Expected income from farm animals' },
  LABOUR_WAGES:         { label: 'Labour & Wages',          icon: '👷', description: 'Casual and permanent wage rates' },
  AGRICULTURAL_INPUTS:  { label: 'Agricultural Inputs',     icon: '🌱', description: 'Fertiliser, seed and input costs' },
};

// ─── Data Sources ──────────────────────────────────────────────────────────────

export const listSources = asyncHandler(async (_req: Request, res: Response) => {
  const sources = await prisma.dataSource.findMany({
    orderBy: { shortName: 'asc' },
    include: { _count: { select: { benchmarkValues: true } } },
  });
  res.json({ sources });
});

export const createSource = asyncHandler(async (req: Request, res: Response) => {
  const { name, shortName, url, description, dataTypes, updateFrequency } = req.body;
  const source = await prisma.dataSource.create({
    data: { name, shortName, url, description, dataTypes: dataTypes ?? [], updateFrequency },
  });
  if (req.user) writeAuditLog(req.user.sub, 'CREATE_BENCHMARK_SOURCE', 'data_sources', source.id, req).catch(() => undefined);
  res.status(201).json({ source });
});

export const updateSource = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, shortName, url, description, dataTypes, updateFrequency, isActive, lastCheckedAt } = req.body;
  const source = await prisma.dataSource.update({
    where: { id },
    data: { name, shortName, url, description, dataTypes, updateFrequency, isActive, lastCheckedAt },
  });
  if (req.user) writeAuditLog(req.user.sub, 'UPDATE_BENCHMARK_SOURCE', 'data_sources', source.id, req).catch(() => undefined);
  res.json({ source });
});

export const deleteSource = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.dataSource.update({ where: { id }, data: { isActive: false } });
  if (req.user) writeAuditLog(req.user.sub, 'DELETE_BENCHMARK_SOURCE', 'data_sources', id, req).catch(() => undefined);
  res.json({ message: 'Data source deactivated' });
});

// ─── Benchmark Items ───────────────────────────────────────────────────────────

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const { category, activeOnly } = req.query;
  const where: Prisma.BenchmarkItemWhereInput = {};
  if (category) where.category = category as BenchmarkCategory;
  if (activeOnly !== 'false') where.isActive = true;

  const items = await prisma.benchmarkItem.findMany({
    where,
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { values: true } } },
  });
  res.json({ items });
});

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const { category, name, description, unit, itemType, sortOrder } = req.body;
  const item = await prisma.benchmarkItem.create({
    data: { category, name, description, unit, itemType, sortOrder: sortOrder ?? 0 },
  });
  res.status(201).json({ item });
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { category, name, description, unit, itemType, sortOrder, isActive } = req.body;
  const item = await prisma.benchmarkItem.update({
    where: { id },
    data: { category, name, description, unit, itemType, sortOrder, isActive },
  });
  res.json({ item });
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.benchmarkItem.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Benchmark item deactivated' });
});

// ─── Benchmark Values ──────────────────────────────────────────────────────────

export const listValues = asyncHandler(async (req: Request, res: Response) => {
  const { category, itemId, county, region, scope, year, activeOnly } = req.query;

  const where: Prisma.BenchmarkValueWhereInput = {};
  if (activeOnly !== 'false') where.isActive = true;
  if (itemId) where.itemId = itemId as string;
  if (county) where.county = { contains: county as string, mode: 'insensitive' };
  if (region) where.region = { contains: region as string, mode: 'insensitive' };
  if (scope) where.scope = scope as BenchmarkScope;
  if (year) where.referenceYear = parseInt(year as string);
  if (category) where.item = { category: category as BenchmarkCategory };

  // Only current values by default
  where.OR = [{ validTo: null }, { validTo: { gte: new Date() } }];

  const values = await prisma.benchmarkValue.findMany({
    where,
    orderBy: [{ referenceYear: 'desc' }, { item: { category: 'asc' } }],
    include: {
      item: true,
      source: { select: { id: true, shortName: true, name: true, url: true } },
    },
  });

  res.json({ values });
});

export const createValue = asyncHandler(async (req: Request, res: Response) => {
  const {
    itemId, sourceId, scope, county, region,
    valueLow, valueMid, valueHigh,
    referenceYear, validFrom, validTo,
    notes, assumptions,
  } = req.body;

  const userId = (req as any).user?.id;

  const value = await prisma.benchmarkValue.create({
    data: {
      itemId, sourceId, scope, county, region,
      valueLow, valueMid, valueHigh,
      referenceYear,
      validFrom: new Date(validFrom),
      validTo: validTo ? new Date(validTo) : null,
      notes, assumptions,
      createdById: userId,
    },
    include: {
      item: true,
      source: { select: { id: true, shortName: true, name: true, url: true } },
    },
  });

  res.status(201).json({ value });
});

export const updateValue = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    sourceId, scope, county, region,
    valueLow, valueMid, valueHigh,
    referenceYear, validFrom, validTo,
    notes, assumptions, isActive,
  } = req.body;

  const value = await prisma.benchmarkValue.update({
    where: { id },
    data: {
      sourceId, scope, county, region,
      valueLow, valueMid, valueHigh,
      referenceYear,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo !== undefined ? (validTo ? new Date(validTo) : null) : undefined,
      notes, assumptions, isActive,
    },
    include: {
      item: true,
      source: { select: { id: true, shortName: true, name: true, url: true } },
    },
  });
  res.json({ value });
});

export const deleteValue = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.benchmarkValue.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Benchmark value deactivated' });
});

// ─── Lookup (for loan officers) ────────────────────────────────────────────────
// Returns best matching values: county-specific first, then regional, then national

export const lookup = asyncHandler(async (req: Request, res: Response) => {
  const { category, county, region } = req.query;

  const baseWhere: Prisma.BenchmarkValueWhereInput = {
    isActive: true,
    OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    ...(category ? { item: { category: category as BenchmarkCategory, isActive: true } } : {}),
  };

  // Fetch all matching, stratified by scope
  const [countyValues, regionValues, nationalValues] = await Promise.all([
    county
      ? prisma.benchmarkValue.findMany({
          where: { ...baseWhere, scope: 'COUNTY', county: { equals: county as string, mode: 'insensitive' } },
          include: { item: true, source: { select: { id: true, shortName: true, url: true } } },
          orderBy: { referenceYear: 'desc' },
        })
      : [],
    region
      ? prisma.benchmarkValue.findMany({
          where: { ...baseWhere, scope: 'REGION', region: { contains: region as string, mode: 'insensitive' } },
          include: { item: true, source: { select: { id: true, shortName: true, url: true } } },
          orderBy: { referenceYear: 'desc' },
        })
      : [],
    prisma.benchmarkValue.findMany({
      where: { ...baseWhere, scope: 'NATIONAL' },
      include: { item: true, source: { select: { id: true, shortName: true, url: true } } },
      orderBy: { referenceYear: 'desc' },
    }),
  ]);

  // Merge: prefer county > region > national, deduplicate by itemId
  const seen = new Set<string>();
  const allValues = [...countyValues, ...regionValues, ...nationalValues];
  type BvWithIncludes = (typeof allValues)[number];
  const merged: BvWithIncludes[] = [];

  for (const val of allValues) {
    if (!seen.has(val.itemId)) {
      seen.add(val.itemId);
      merged.push(val);
    }
  }

  // Group by category for easier rendering
  const grouped: Record<string, BvWithIncludes[]> = {};
  for (const val of merged) {
    const cat = val.item.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(val);
  }

  res.json({
    county: county ?? null,
    region: region ?? null,
    totalValues: merged.length,
    grouped,
    allValues: merged,
  });
});

// ─── Categories list ───────────────────────────────────────────────────────────

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const counts = await prisma.benchmarkItem.groupBy({
    by: ['category'],
    _count: { id: true },
    where: { isActive: true },
  });

  const categories = Object.entries(CATEGORY_META).map(([key, meta]) => ({
    key,
    ...meta,
    itemCount: counts.find((c) => c.category === key)?._count.id ?? 0,
  }));

  res.json({ categories });
});
