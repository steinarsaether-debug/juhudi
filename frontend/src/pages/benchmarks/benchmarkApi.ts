import { api } from '../../services/api';

export type BenchmarkCategory =
  | 'FOOD_NUTRITION' | 'ACCOMMODATION' | 'TRANSPORT' | 'EDUCATION'
  | 'HEALTHCARE_UTILITIES' | 'CLOTHING_PERSONAL' | 'CROP_INCOME'
  | 'LIVESTOCK_INCOME' | 'LABOUR_WAGES' | 'AGRICULTURAL_INPUTS';

export type BenchmarkScope = 'NATIONAL' | 'REGION' | 'COUNTY';
export type BenchmarkItemType =
  | 'MONTHLY_EXPENSE' | 'ANNUAL_EXPENSE' | 'INCOME_PER_UNIT'
  | 'MONTHLY_INCOME' | 'PRICE_PER_UNIT' | 'WAGE_RATE';

export interface DataSource {
  id: string;
  name: string;
  shortName: string;
  url: string;
  description?: string;
  dataTypes: string[];
  updateFrequency?: string;
  lastCheckedAt?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { benchmarkValues: number };
}

export interface BenchmarkItem {
  id: string;
  category: BenchmarkCategory;
  name: string;
  description?: string;
  unit: string;
  itemType: BenchmarkItemType;
  sortOrder: number;
  isActive: boolean;
  _count?: { values: number };
}

export interface BenchmarkValue {
  id: string;
  itemId: string;
  item: BenchmarkItem;
  sourceId: string;
  source: { id: string; shortName: string; name: string; url: string };
  scope: BenchmarkScope;
  county?: string;
  region?: string;
  valueLow: number;
  valueMid: number;
  valueHigh: number;
  referenceYear: number;
  validFrom: string;
  validTo?: string;
  notes?: string;
  assumptions?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CategoryMeta {
  key: BenchmarkCategory;
  label: string;
  icon: string;
  description: string;
  itemCount: number;
}

// ─── Sources ──────────────────────────────────────────────────────────────────
export const fetchSources = () =>
  api.get<{ sources: DataSource[] }>('/benchmarks/sources').then((r) => r.data.sources);

export const createSource = (data: Partial<DataSource>) =>
  api.post<{ source: DataSource }>('/benchmarks/sources', data).then((r) => r.data.source);

export const updateSource = (id: string, data: Partial<DataSource>) =>
  api.put<{ source: DataSource }>(`/benchmarks/sources/${id}`, data).then((r) => r.data.source);

// ─── Items ────────────────────────────────────────────────────────────────────
export const fetchItems = (category?: BenchmarkCategory) =>
  api.get<{ items: BenchmarkItem[] }>('/benchmarks/items', { params: { category } }).then((r) => r.data.items);

export const createItem = (data: Partial<BenchmarkItem>) =>
  api.post<{ item: BenchmarkItem }>('/benchmarks/items', data).then((r) => r.data.item);

export const updateItem = (id: string, data: Partial<BenchmarkItem>) =>
  api.put<{ item: BenchmarkItem }>(`/benchmarks/items/${id}`, data).then((r) => r.data.item);

// ─── Values ───────────────────────────────────────────────────────────────────
export const fetchValues = (params: {
  category?: BenchmarkCategory;
  itemId?: string;
  county?: string;
  region?: string;
  scope?: BenchmarkScope;
  year?: number;
}) =>
  api.get<{ values: BenchmarkValue[] }>('/benchmarks/values', { params }).then((r) => r.data.values);

export const createValue = (data: Partial<BenchmarkValue> & { itemId: string; sourceId: string }) =>
  api.post<{ value: BenchmarkValue }>('/benchmarks/values', data).then((r) => r.data.value);

export const updateValue = (id: string, data: Partial<BenchmarkValue>) =>
  api.put<{ value: BenchmarkValue }>(`/benchmarks/values/${id}`, data).then((r) => r.data.value);

export const deleteValue = (id: string) =>
  api.delete(`/benchmarks/values/${id}`);

// ─── Categories ───────────────────────────────────────────────────────────────
export const fetchCategories = () =>
  api.get<{ categories: CategoryMeta[] }>('/benchmarks/categories').then((r) => r.data.categories);

// ─── Lookup ───────────────────────────────────────────────────────────────────
export const lookupBenchmarks = (params: { category?: BenchmarkCategory; county?: string; region?: string }) =>
  api
    .get<{ county: string | null; region: string | null; totalValues: number; grouped: Record<string, BenchmarkValue[]>; allValues: BenchmarkValue[] }>(
      '/benchmarks/lookup', { params }
    )
    .then((r) => r.data);
