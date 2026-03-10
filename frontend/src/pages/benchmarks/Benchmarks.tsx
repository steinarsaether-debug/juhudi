import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Database, List, Search, Plus, ExternalLink,
  RefreshCw, Edit2, Trash2, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import {
  fetchCategories, fetchSources, fetchValues, fetchItems,
  createValue, updateValue, deleteValue, createSource, updateSource,
  CategoryMeta, DataSource, BenchmarkItem, BenchmarkValue, BenchmarkCategory, BenchmarkScope,
} from './benchmarkApi';
import { useAuthStore } from '../../store/authStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa','Murang\'a','Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta',
  'Tana River','Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga',
  'Wajir','West Pokot',
];

const REGIONS = [
  'CENTRAL HIGHLANDS', 'RIFT VALLEY', 'WESTERN', 'NYANZA',
  'COAST', 'EASTERN', 'NORTH EASTERN', 'NAIROBI METRO',
];

const SCOPE_BADGES: Record<string, string> = {
  NATIONAL: 'bg-blue-100 text-blue-700',
  REGION:   'bg-purple-100 text-purple-700',
  COUNTY:   'bg-green-100 text-green-700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtKES(n: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'lookup' | 'values' | 'sources';

export default function Benchmarks() {
  const [tab, setTab] = useState<Tab>('overview');
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Market Benchmarks</h1>
            <p className="text-sm text-gray-500">
              Verified income & cost-of-living data from KNBS, KTDA, Ministry of Agriculture and other official Kenyan sources
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {([
            { key: 'overview', label: 'Overview', icon: BarChart2 },
            { key: 'lookup',   label: 'Lookup',   icon: Search },
            { key: 'values',   label: 'Values',   icon: List },
            ...(isAdmin ? [{ key: 'sources', label: 'Data Sources', icon: Database }] : []),
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'lookup'   && <LookupTab />}
        {tab === 'values'   && <ValuesTab isAdmin={isAdmin} />}
        {tab === 'sources'  && <SourcesTab />}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories().then(setCategories).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const incomeCategories = categories.filter((c) =>
    ['CROP_INCOME', 'LIVESTOCK_INCOME', 'LABOUR_WAGES'].includes(c.key)
  );
  const expenseCategories = categories.filter((c) =>
    ['FOOD_NUTRITION', 'ACCOMMODATION', 'TRANSPORT', 'EDUCATION', 'HEALTHCARE_UTILITIES', 'CLOTHING_PERSONAL', 'AGRICULTURAL_INPUTS'].includes(c.key)
  );

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold">Independent verification benchmarks</p>
          <p className="mt-1">
            All values are sourced from official Kenyan government statistics (KNBS, Ministry of Agriculture,
            Ministry of Labour) and reputable agricultural research bodies (KTDA, TRFK, NKPCU). Use these ranges
            to verify and cross-check income and expense figures stated by loan applicants.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Income categories */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Income Sources</h2>
          <div className="space-y-3">
            {incomeCategories.map((c) => (
              <CategoryCard key={c.key} category={c} />
            ))}
          </div>
        </div>

        {/* Expense categories */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Household & Business Expenses</h2>
          <div className="space-y-3">
            {expenseCategories.map((c) => (
              <CategoryCard key={c.key} category={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: CategoryMeta }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<BenchmarkItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const toggle = async () => {
    if (!expanded && items.length === 0) {
      setLoadingItems(true);
      fetchItems(category.key).then(setItems).finally(() => setLoadingItems(false));
    }
    setExpanded(!expanded);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{category.icon}</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{category.label}</p>
            <p className="text-xs text-gray-500">{category.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            {category.itemCount} items
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          {loadingItems ? (
            <p className="text-xs text-gray-500 py-2">Loading...</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-gray-400 font-mono">{item.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Lookup Tab ───────────────────────────────────────────────────────────────

function LookupTab() {
  const [county, setCounty] = useState('');
  const [category, setCategory] = useState<BenchmarkCategory | ''>('');
  const [values, setValues] = useState<BenchmarkValue[]>([]);
  const [grouped, setGrouped] = useState<Record<string, BenchmarkValue[]>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const res = await (category
        ? fetchValues({ county: county || undefined, category: category as BenchmarkCategory })
        : fetchValues({ county: county || undefined }));
      // Group by category
      const g: Record<string, BenchmarkValue[]> = {};
      for (const v of res) {
        const cat = v.item.category;
        if (!g[cat]) g[cat] = [];
        g[cat].push(v);
      }
      setGrouped(g);
      setValues(res);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    FOOD_NUTRITION: '🌽 Food & Nutrition', ACCOMMODATION: '🏠 Accommodation',
    TRANSPORT: '🚌 Transport', EDUCATION: '📚 Education',
    HEALTHCARE_UTILITIES: '💊 Healthcare & Utilities', CLOTHING_PERSONAL: '👕 Clothing & Personal',
    CROP_INCOME: '🍃 Crop Income', LIVESTOCK_INCOME: '🐄 Livestock Income',
    LABOUR_WAGES: '👷 Labour & Wages', AGRICULTURAL_INPUTS: '🌱 Agricultural Inputs',
  };

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Filter benchmarks by location</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">County (optional)</label>
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— National average —</option>
              {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category (optional)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BenchmarkCategory | '')}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— All categories —</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button
            onClick={search}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Show Benchmarks'}
          </button>
        </div>
        {county && (
          <p className="mt-2 text-xs text-blue-600">
            Showing: county-specific values for <strong>{county}</strong> first, then regional, then national averages.
          </p>
        )}
      </div>

      {/* Results */}
      {searched && values.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">No benchmark values found for this filter.</div>
      )}

      {Object.entries(grouped).map(([cat, catValues]) => (
        <div key={cat} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">{CATEGORY_LABELS[cat] ?? cat}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {catValues.map((v) => (
              <LookupRow key={v.id} value={v} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LookupRow({ value: v }: { value: BenchmarkValue }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">{v.item.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SCOPE_BADGES[v.scope]}`}>
              {v.scope === 'COUNTY' ? v.county : v.scope === 'REGION' ? v.region : 'National'}
            </span>
          </div>
          {v.notes && <p className="text-xs text-gray-500 mb-1 leading-relaxed">{v.notes}</p>}
          {v.assumptions && (
            <p className="text-xs text-amber-600 italic">⚠ {v.assumptions}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-gray-400 mb-1">{v.item.unit} · {v.referenceYear}</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-500">{fmtKES(v.valueLow)}</span>
            <span className="text-sm font-bold text-gray-900">{fmtKES(v.valueMid)}</span>
            <span className="text-xs text-green-600">{fmtKES(v.valueHigh)}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">low · typical · high</div>
          <a
            href={v.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 justify-end mt-1"
          >
            {v.source.shortName} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Values Tab ───────────────────────────────────────────────────────────────

function ValuesTab({ isAdmin }: { isAdmin: boolean }) {
  const [values, setValues] = useState<BenchmarkValue[]>([]);
  const [items, setItems] = useState<BenchmarkItem[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<BenchmarkCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editingValue, setEditingValue] = useState<BenchmarkValue | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, i, s] = await Promise.all([
        fetchValues({ category: filterCategory || undefined }),
        fetchItems(),
        fetchSources(),
      ]);
      setValues(v); setItems(i); setSources(s);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this benchmark value?')) return;
    await deleteValue(id);
    setValues((prev) => prev.filter((v) => v.id !== id));
  };

  const CATEGORY_LABELS: Record<string, string> = {
    FOOD_NUTRITION: 'Food & Nutrition', ACCOMMODATION: 'Accommodation',
    TRANSPORT: 'Transport', EDUCATION: 'Education',
    HEALTHCARE_UTILITIES: 'Healthcare & Utilities', CLOTHING_PERSONAL: 'Clothing & Personal',
    CROP_INCOME: 'Crop Income', LIVESTOCK_INCOME: 'Livestock Income',
    LABOUR_WAGES: 'Labour & Wages', AGRICULTURAL_INPUTS: 'Agricultural Inputs',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as BenchmarkCategory | '')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button onClick={load} className="p-1.5 rounded text-gray-500 hover:bg-gray-100">
            <RefreshCw className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-500">{values.length} values</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingValue(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Add Value
          </button>
        )}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Item</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Scope</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Low</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Typical</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">High</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Unit / Year</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Source</th>
                {isAdmin && <th className="px-4 py-2.5 text-xs font-semibold text-gray-600"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {values.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="font-medium text-gray-900 text-xs">{v.item.name}</p>
                      <p className="text-xs text-gray-400">{CATEGORY_LABELS[v.item.category]}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SCOPE_BADGES[v.scope]}`}>
                      {v.scope === 'COUNTY' ? v.county : v.scope === 'REGION' ? v.region?.split(' ').slice(0, 2).join(' ') : 'National'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-red-500 font-mono">{fmtKES(v.valueLow)}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-900 font-mono">{fmtKES(v.valueMid)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-green-600 font-mono">{fmtKES(v.valueHigh)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    <div>{v.item.unit}</div>
                    <div className="text-gray-400">{v.referenceYear}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={v.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      {v.source.shortName} <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingValue(v); setShowForm(true); }}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {values.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">No benchmark values found.</div>
          )}
        </div>
      )}

      {showForm && (
        <ValueFormModal
          value={editingValue}
          items={items}
          sources={sources}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Value Form Modal ─────────────────────────────────────────────────────────

function ValueFormModal({
  value, items, sources, onClose, onSaved,
}: {
  value: BenchmarkValue | null;
  items: BenchmarkItem[];
  sources: DataSource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    itemId: value?.itemId ?? '',
    sourceId: value?.sourceId ?? '',
    scope: value?.scope ?? 'NATIONAL',
    county: value?.county ?? '',
    region: value?.region ?? '',
    valueLow: String(value?.valueLow ?? ''),
    valueMid: String(value?.valueMid ?? ''),
    valueHigh: String(value?.valueHigh ?? ''),
    referenceYear: String(value?.referenceYear ?? new Date().getFullYear()),
    validFrom: value?.validFrom ? value.validFrom.slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: value?.notes ?? '',
    assumptions: value?.assumptions ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        itemId: form.itemId, sourceId: form.sourceId,
        scope: form.scope as BenchmarkScope,
        county: form.scope === 'COUNTY' ? form.county : undefined,
        region: form.scope === 'REGION' ? form.region : undefined,
        valueLow: parseFloat(form.valueLow),
        valueMid: parseFloat(form.valueMid),
        valueHigh: parseFloat(form.valueHigh),
        referenceYear: parseInt(form.referenceYear),
        validFrom: form.validFrom,
        notes: form.notes || null,
        assumptions: form.assumptions || null,
      };
      if (value) {
        await updateValue(value.id, payload as Partial<BenchmarkValue>);
      } else {
        await createValue(payload as Parameters<typeof createValue>[0]);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {value ? 'Edit Benchmark Value' : 'Add Benchmark Value'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">Benchmark Item *</label>
              <select required value={form.itemId} onChange={(e) => set('itemId', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="">Select item...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.category.replace(/_/g, ' ')} — {i.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">Data Source *</label>
              <select required value={form.sourceId} onChange={(e) => set('sourceId', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="">Select source...</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.shortName} — {s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Geographic Scope *</label>
              <select value={form.scope} onChange={(e) => set('scope', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="NATIONAL">National</option>
                <option value="REGION">Region</option>
                <option value="COUNTY">County</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Reference Year *</label>
              <input type="number" required min={2020} max={2030} value={form.referenceYear}
                onChange={(e) => set('referenceYear', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>

            {form.scope === 'COUNTY' && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">County *</label>
                <select required value={form.county} onChange={(e) => set('county', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                  <option value="">Select county...</option>
                  {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {form.scope === 'REGION' && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Region *</label>
                <select required value={form.region} onChange={(e) => set('region', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                  <option value="">Select region...</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600">Low Value (KES) *</label>
              <input type="number" required step="any" value={form.valueLow} onChange={(e) => set('valueLow', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Typical / Mid Value (KES) *</label>
              <input type="number" required step="any" value={form.valueMid} onChange={(e) => set('valueMid', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">High Value (KES) *</label>
              <input type="number" required step="any" value={form.valueHigh} onChange={(e) => set('valueHigh', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Valid From *</label>
              <input type="date" required value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">Notes / Source Detail</label>
              <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)}
                placeholder="e.g. KTDA payment rates, East of Rift, January 2024"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">Assumptions</label>
              <textarea rows={2} value={form.assumptions} onChange={(e) => set('assumptions', e.target.value)}
                placeholder="e.g. Grade cow, zero-grazing, cooperative market"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : value ? 'Update Value' : 'Add Value'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sources Tab ──────────────────────────────────────────────────────────────

function SourcesTab() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchSources().then(setSources).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Official data sources used to populate benchmark values
        </h2>
        <div className="flex gap-2">
          <button onClick={load} className="p-1.5 rounded text-gray-500 hover:bg-gray-100">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setEditingSource(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Add Source
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((s) => (
            <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                      {s.shortName}
                    </span>
                    {!s.isActive && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">{s.name}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingSource(s); setShowForm(true); }}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {s.description && (
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">{s.description}</p>
              )}

              <div className="flex flex-wrap gap-1.5 mb-2">
                {s.dataTypes.map((t) => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Visit source <ExternalLink className="h-3 w-3" />
                </a>
                <div className="text-xs text-gray-400">
                  {s.updateFrequency && <span>{s.updateFrequency}</span>}
                  {s._count?.benchmarkValues != null && (
                    <span className="ml-2">{s._count.benchmarkValues} values</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SourceFormModal
          source={editingSource}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Source Form Modal ────────────────────────────────────────────────────────

function SourceFormModal({
  source, onClose, onSaved,
}: {
  source: DataSource | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: source?.name ?? '',
    shortName: source?.shortName ?? '',
    url: source?.url ?? '',
    description: source?.description ?? '',
    updateFrequency: source?.updateFrequency ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (source) {
        await updateSource(source.id, form);
      } else {
        await createSource(form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {source ? 'Edit Data Source' : 'Add Data Source'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">Full Name *</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Short Name / Acronym *</label>
              <input required value={form.shortName} onChange={(e) => set('shortName', e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Update Frequency</label>
              <select value={form.updateFrequency} onChange={(e) => set('updateFrequency', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="">Unknown</option>
                <option>MONTHLY</option>
                <option>QUARTERLY</option>
                <option>ANNUAL</option>
                <option>TRIENNIAL</option>
                <option>IRREGULAR</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">URL *</label>
              <input required type="url" value={form.url} onChange={(e) => set('url', e.target.value)}
                placeholder="https://www.knbs.or.ke"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : source ? 'Update Source' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  );
}
