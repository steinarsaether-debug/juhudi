/**
 * FieldHub – landing page for field loan officer tools.
 * Houses navigation to FarmSurvey, HealthAssessment,
 * and offline quick-capture shortcuts.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Leaf, Camera, Wifi, WifiOff, ChevronLeft } from 'lucide-react';
import { customerApi } from '../../services/api';
import { Customer } from '../../types';
import FarmSurvey from './FarmSurvey';
import HealthAssessment from './HealthAssessment';

type Tab = 'overview' | 'survey' | 'health';

export default function FieldHub() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [online] = useState(navigator.onLine);

  const { data: customer } = useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
    enabled: !!id,
  });

  const tabs = [
    { key: 'overview' as Tab, label: 'Overview', icon: Camera },
    { key: 'survey'   as Tab, label: 'Farm Survey', icon: MapPin },
    { key: 'health'   as Tab, label: 'Health AI', icon: Leaf },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {id && (
              <Link to={`/customers/${id}`} className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            )}
            <h1 className="page-title">Field Tools</h1>
          </div>
          {customer && (
            <p className="text-sm text-gray-500">
              {customer.firstName} {customer.lastName} &bull; {customer.county}
            </p>
          )}
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${online ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4">
          {/* Status cards */}
          <div className="card p-5">
            <h2 className="section-title mb-4">Field Activities</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTab('survey')}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50 p-4 hover:border-primary-400 transition-colors"
              >
                <MapPin className="h-8 w-8 text-primary-700" />
                <span className="text-sm font-medium text-primary-800">GPS Farm Survey</span>
                <span className="text-xs text-primary-600 text-center">Walk the boundary to measure acreage</span>
              </button>
              <button
                onClick={() => setTab('health')}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-green-200 bg-green-50 p-4 hover:border-green-400 transition-colors"
              >
                <Leaf className="h-8 w-8 text-green-700" />
                <span className="text-sm font-medium text-green-800">AI Health Check</span>
                <span className="text-xs text-green-600 text-center">Photo analysis for crops & animals</span>
              </button>
            </div>
          </div>

          {/* Offline tips */}
          {!online && (
            <div className="card p-4 bg-yellow-50 border-yellow-200">
              <h3 className="font-semibold text-sm text-yellow-800 mb-2">Offline Mode Active</h3>
              <ul className="text-xs text-yellow-700 space-y-1">
                <li>• Farm surveys are saved locally and sync when you reconnect</li>
                <li>• AI Health Assessment requires internet connection</li>
                <li>• Photos are stored offline and attached on next sync</li>
              </ul>
            </div>
          )}

          {/* Link back to onboarding */}
          {id && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Related Actions</h3>
              <div className="space-y-2">
                <Link to={`/customers/${id}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100">
                  <span>Customer Profile</span>
                  <ChevronLeft className="h-4 w-4 rotate-180 text-gray-400" />
                </Link>
                <Link to={`/customers/${id}/score`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100">
                  <span>Credit Scoring</span>
                  <ChevronLeft className="h-4 w-4 rotate-180 text-gray-400" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'survey' && (
        <FarmSurvey
          customerId={id}
          onSave={(acres, perimM, _waypoints) => {
            // Could navigate or show a success message
            console.log(`Survey saved: ${acres.toFixed(2)} acres, ${Math.round(perimM)}m perimeter`);
          }}
        />
      )}

      {tab === 'health' && (
        <HealthAssessment county={customer?.county} />
      )}
    </div>
  );
}
