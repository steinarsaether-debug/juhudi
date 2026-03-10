import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, PlusCircle, Edit2, ToggleLeft, ToggleRight, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { adminApi, weatherApi, getErrorMessage } from '../../services/api';
import { AdminBranch } from '../../types';
import type { BranchWeatherResponse } from '../../components/weather/weatherTypes';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 65) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function BranchWeather({ w }: { w: BranchWeatherResponse }) {
  const critical = w.alerts.filter(a => a.level === 'CRITICAL');
  const warnings  = w.alerts.filter(a => a.level === 'WARNING');
  const advisories = w.alerts.filter(a => a.level === 'ADVISORY');
  return (
    <div className="border-t border-gray-50 pt-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <span className="text-base">{weatherEmoji(w.today.weatherCode)}</span>
          <span className="font-semibold">{w.today.tempMax}°C</span>
          <span className="text-xs text-gray-400">/ {w.today.tempMin}°C</span>
          <span className="text-xs text-gray-400 ml-1">{w.today.description}</span>
        </div>
        <span className="text-xs text-gray-300">{w.today.precipProbability}% rain</span>
      </div>
      {w.alerts.length > 0 ? (
        <div className="space-y-1">
          {critical.length > 0 && critical.slice(0, 2).map((a, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span><span className="font-semibold">{a.title}</span> — {a.body}</span>
            </div>
          ))}
          {warnings.length > 0 && warnings.slice(0, critical.length >= 2 ? 0 : 2 - critical.length).map((a, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-orange-700 bg-orange-50 rounded-lg px-2 py-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span><span className="font-semibold">{a.title}</span> — {a.body}</span>
            </div>
          ))}
          {advisories.length > 0 && critical.length === 0 && warnings.length === 0 && advisories.slice(0, 1).map((a, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-700 bg-yellow-50 rounded-lg px-2 py-1.5">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span><span className="font-semibold">{a.title}</span> — {a.body}</span>
            </div>
          ))}
          {(critical.length + warnings.length + advisories.length) > 2 && (
            <p className="text-xs text-gray-400 pl-1">+{w.alerts.length - 2} more alert{w.alerts.length - 2 > 1 ? 's' : ''}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-green-600">No weather alerts</p>
      )}
    </div>
  );
}

const EMPTY_FORM = { name: '', code: '', county: '', address: '' };

export default function AdminBranches() {
  const qc = useQueryClient();
  const [showModal, setShowModal]   = useState(false);
  const [editBranch, setEditBranch] = useState<AdminBranch | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [formError, setFormError]   = useState('');

  const { data: branches, isLoading } = useQuery<AdminBranch[]>({
    queryKey: ['adminBranches'],
    queryFn:  () => adminApi.listBranches(),
    staleTime: 30_000,
  });

  const { data: allWeather } = useQuery<BranchWeatherResponse[]>({
    queryKey: ['weather', 'all'],
    queryFn: weatherApi.getAllBranchWeather,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  });
  const weatherByBranch = new Map((allWeather ?? []).map(w => [w.branchId, w]));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['adminBranches'] });

  const saveMutation = useMutation({
    mutationFn: (f: typeof EMPTY_FORM) => editBranch
      ? adminApi.updateBranch(editBranch.id, { name: f.name, county: f.county, address: f.address })
      : adminApi.createBranch(f),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleBranchActive(id),
    onSuccess: () => invalidate(),
    onError: (err) => alert(getErrorMessage(err)),
  });

  function openCreate() {
    setEditBranch(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setShowModal(true);
  }
  function openEdit(b: AdminBranch) {
    setEditBranch(b);
    setForm({ name: b.name, code: b.code, county: b.county, address: b.address });
    setFormError('');
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setFormError(''); }

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Branch Management</h1>
        <button className="btn-primary" onClick={openCreate}>
          <PlusCircle className="h-4 w-4" /> Add Branch
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(branches ?? []).map(b => (
            <div key={b.id} className={`card p-5 ${!b.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{b.name}</p>
                    <p className="text-xs font-mono text-gray-500">{b.code}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {b.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <dl className="text-sm space-y-1 mb-4">
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-16">County</dt>
                  <dd className="text-gray-700 font-medium">{b.county}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-16">Address</dt>
                  <dd className="text-gray-700">{b.address}</dd>
                </div>
              </dl>

              <div className="flex gap-3 text-sm mb-4">
                <div className="flex-1 rounded-lg bg-gray-50 p-2.5 text-center">
                  <p className="font-bold text-gray-900">{b._count?.users ?? 0}</p>
                  <p className="text-xs text-gray-500">Active Users</p>
                </div>
                <div className="flex-1 rounded-lg bg-gray-50 p-2.5 text-center">
                  <p className="font-bold text-gray-900">{b._count?.customers ?? 0}</p>
                  <p className="text-xs text-gray-500">Customers</p>
                </div>
              </div>

              {weatherByBranch.get(b.id) && (
                <BranchWeather w={weatherByBranch.get(b.id)!} />
              )}

              <div className="flex gap-2 mt-4">
                <button
                  className="btn-secondary flex-1 text-xs"
                  onClick={() => openEdit(b)}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  className={`btn-secondary flex-1 text-xs ${b.isActive ? 'hover:text-red-600' : 'hover:text-green-600'}`}
                  onClick={() => {
                    if (confirm(`${b.isActive ? 'Deactivate' : 'Activate'} branch "${b.name}"?`))
                      toggleMutation.mutate(b.id);
                  }}
                >
                  {b.isActive
                    ? <><ToggleRight className="h-3.5 w-3.5" /> Deactivate</>
                    : <><ToggleLeft className="h-3.5 w-3.5" /> Activate</>
                  }
                </button>
              </div>
            </div>
          ))}
          {!branches?.length && !isLoading && (
            <div className="col-span-3 py-12 text-center text-gray-400">No branches found</div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">{editBranch ? 'Edit Branch' : 'Add New Branch'}</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch Name *</label>
                <input className="input w-full" placeholder="e.g. Nakuru Main" value={form.name} onChange={f('name')} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Branch Code * {editBranch && <span className="text-gray-400">(cannot be changed)</span>}
                </label>
                <input
                  className="input w-full font-mono uppercase"
                  placeholder="e.g. NKR"
                  value={form.code}
                  disabled={!!editBranch}
                  onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">County *</label>
                <input className="input w-full" placeholder="e.g. Nakuru" value={form.county} onChange={f('county')} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Physical Address *</label>
                <input className="input w-full" placeholder="Street / building / town" value={form.address} onChange={f('address')} />
              </div>
              {formError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5" /> {formError}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
              <button
                className="btn-primary flex-1"
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : (editBranch ? 'Save Changes' : 'Create Branch')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
