import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Lock, RotateCcw, ChevronRight, Info,
} from 'lucide-react';
import { configApi, getErrorMessage } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  dataType: 'NUMBER' | 'PERCENTAGE' | 'AMOUNT_KES' | 'DAYS' | 'MONTHS' | 'RATIO' | 'BOOLEAN' | 'SCORE_POINTS';
  category: string;
  label: string;
  description?: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  isEditable: boolean;
  updatedAt: string;
  updatedBy?: { firstName: string; lastName: string } | null;
  defaultValue?: string;
}

interface ConfigListResponse {
  grouped: Record<string, ConfigItem[]>;
  categories: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(value: string, dataType: ConfigItem['dataType'], unit?: string): string {
  if (dataType === 'PERCENTAGE') return `${value}%`;
  if (dataType === 'AMOUNT_KES') return `KES ${Number(value).toLocaleString()}`;
  if (dataType === 'BOOLEAN') return value === 'true' ? 'Yes' : 'No';
  if (unit) return `${value} ${unit}`;
  return value;
}

function isModified(item: ConfigItem): boolean {
  if (!item.defaultValue) return false;
  return item.value !== item.defaultValue;
}

function inputTypeForDataType(dataType: ConfigItem['dataType']): string {
  if (dataType === 'BOOLEAN') return 'checkbox';
  return 'text';
}

function validateValue(value: string, item: ConfigItem): string | null {
  if (
    item.dataType === 'NUMBER' ||
    item.dataType === 'PERCENTAGE' ||
    item.dataType === 'AMOUNT_KES' ||
    item.dataType === 'DAYS' ||
    item.dataType === 'MONTHS' ||
    item.dataType === 'RATIO' ||
    item.dataType === 'SCORE_POINTS'
  ) {
    const num = Number(value);
    if (isNaN(num)) return 'Must be a number';
    if (item.minValue !== undefined && num < item.minValue) return `Minimum is ${item.minValue}`;
    if (item.maxValue !== undefined && num > item.maxValue) return `Maximum is ${item.maxValue}`;
  }
  return null;
}

// ─── Inline edit cell ────────────────────────────────────────────────────────

interface EditCellProps {
  item: ConfigItem;
  onSave: (key: string, value: string) => Promise<void>;
}

function EditCell({ item, onSave }: EditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (!item.isEditable) return;
    setDraft(item.value);
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function commit() {
    if (draft === item.value) { setEditing(false); return; }
    const validationError = validateValue(draft, item);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    try {
      await onSave(item.key, draft);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(item.value); setError(null); }
  }

  if (item.dataType === 'BOOLEAN' && item.isEditable) {
    return (
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.value === 'true'}
            onChange={async (e) => {
              const newVal = e.target.checked ? 'true' : 'false';
              setSaving(true);
              try { await onSave(item.key, newVal); } catch (err) { alert(getErrorMessage(err)); }
              finally { setSaving(false); }
            }}
            disabled={saving}
            className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">{item.value === 'true' ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>
    );
  }

  if (!item.isEditable) {
    return (
      <div className="flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
        <span className="text-sm text-gray-500 font-mono">{formatValue(item.value, item.dataType, item.unit)}</span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type={inputTypeForDataType(item.dataType)}
            value={draft}
            onChange={e => { setDraft(e.target.value); setError(null); }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={`input text-sm font-mono w-36 py-1 ${error ? 'border-red-400 focus:ring-red-300' : ''}`}
            placeholder={item.value}
          />
          {item.unit && <span className="text-xs text-gray-400">{item.unit}</span>}
          {saving && <span className="text-xs text-gray-400 animate-pulse">saving…</span>}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {item.minValue !== undefined || item.maxValue !== undefined ? (
          <p className="text-xs text-gray-400">
            Range: {item.minValue ?? '—'} – {item.maxValue ?? '—'}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      title="Click to edit"
      className={`group flex items-center gap-1.5 rounded px-2 py-1 -ml-2 hover:bg-primary-50 text-left transition-colors ${
        isModified(item) ? 'bg-yellow-50' : ''
      }`}
    >
      <span className={`text-sm font-mono ${isModified(item) ? 'text-yellow-800' : 'text-gray-800'}`}>
        {formatValue(item.value, item.dataType, item.unit)}
      </span>
      {isModified(item) && (
        <span className="text-xs bg-yellow-200 text-yellow-700 px-1 rounded">modified</span>
      )}
      <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SystemConfigPage() {
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery<ConfigListResponse>({
    queryKey: ['systemConfig'],
    queryFn: () => configApi.list(),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      configApi.update(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['systemConfig'] });
    },
    onError: (err) => {
      alert(`Failed to save: ${getErrorMessage(err)}`);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (key: string) => configApi.reset(key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['systemConfig'] });
      alert('Value reset to default.');
    },
    onError: (err) => {
      alert(`Failed to reset: ${getErrorMessage(err)}`);
    },
  });

  async function handleSave(key: string, value: string): Promise<void> {
    await updateMutation.mutateAsync({ key, value });
  }

  const categories = data?.categories ?? [];
  const activeCategory = selectedCategory ?? categories[0] ?? null;
  const grouped = data?.grouped ?? {};

  const rawItems: ConfigItem[] = activeCategory ? (grouped[activeCategory] ?? []) : [];
  const filteredItems = search.trim()
    ? rawItems.filter(
        item =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.key.toLowerCase().includes(search.toLowerCase()) ||
          (item.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : rawItems;

  const countForCategory = (cat: string) => (grouped[cat] ?? []).length;

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">System Configuration</h1>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">System Configuration</h1>
        </div>
        <div className="card p-8 text-center text-red-500">Failed to load configuration.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage scoring constants, thresholds, and system-wide parameters.
          </p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* ── Left sidebar: categories ── */}
        <nav className="flex-shrink-0 w-56">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Categories</p>
            </div>
            <ul className="divide-y divide-gray-50">
              {categories.map(cat => {
                const isActive = cat === activeCategory;
                return (
                  <li key={cat}>
                    <button
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span
                          className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
                            isActive
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {countForCategory(cat)}
                        </span>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary-500" />}
                      </div>
                    </button>
                  </li>
                );
              })}
              {categories.length === 0 && (
                <li className="px-4 py-6 text-sm text-gray-400 text-center">No categories</li>
              )}
            </ul>
          </div>
        </nav>

        {/* ── Right panel: config table ── */}
        <div className="flex-1 min-w-0">
          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="input pl-9 w-full"
              placeholder={`Search in ${activeCategory ?? 'configs'}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          {activeCategory ? (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">{activeCategory}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {filteredItems.length} parameter{filteredItems.length !== 1 ? 's' : ''}
                    {search && ` matching "${search}"`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded bg-yellow-200 border border-yellow-400" />
                    Modified from default
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Read-only
                  </span>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">
                      Parameter
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Value
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                      Range
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">
                      Last Updated
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">
                      Reset
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map(item => (
                    <tr key={item.key} className="hover:bg-gray-50/60 group">
                      {/* Label + description */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="flex items-start gap-1.5">
                          <div>
                            <p className="font-medium text-gray-900">{item.label}</p>
                            <p className="text-xs font-mono text-gray-400 mt-0.5">{item.key}</p>
                          </div>
                          {item.description && (
                            <span
                              title={item.description}
                              className="mt-0.5 flex-shrink-0 cursor-help text-gray-300 hover:text-gray-500 transition-colors"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Editable value cell */}
                      <td className="px-5 py-3.5 align-top">
                        <EditCell item={item} onSave={handleSave} />
                      </td>

                      {/* Min / max range */}
                      <td className="px-5 py-3.5 align-top hidden lg:table-cell">
                        {(item.minValue !== undefined || item.maxValue !== undefined) ? (
                          <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                            {item.minValue ?? '—'} – {item.maxValue ?? '—'}
                            {item.unit ? ` ${item.unit}` : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Updated at / by */}
                      <td className="px-5 py-3.5 align-top hidden xl:table-cell">
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                          {item.updatedAt
                            ? new Date(item.updatedAt).toLocaleDateString('en-KE', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                          {item.updatedBy && (
                            <p className="text-gray-300 mt-0.5">
                              {item.updatedBy.firstName} {item.updatedBy.lastName}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Reset button */}
                      <td className="px-5 py-3.5 align-top">
                        {item.isEditable ? (
                          <button
                            title="Reset to default value"
                            onClick={() => {
                              if (
                                confirm(
                                  `Reset "${item.label}" to its default value?\n\nThis cannot be undone.`,
                                )
                              ) {
                                resetMutation.mutate(item.key);
                              }
                            }}
                            disabled={resetMutation.isPending}
                            className="p-1.5 rounded text-gray-300 hover:text-orange-500 hover:bg-orange-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span />
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                        {search ? `No parameters matching "${search}"` : 'No parameters in this category'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-12 text-center text-gray-400">
              Select a category from the left panel to view its parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
