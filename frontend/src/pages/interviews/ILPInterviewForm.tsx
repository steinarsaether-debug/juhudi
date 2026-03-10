import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, CheckCircle, Save, AlertTriangle, User, Briefcase,
} from 'lucide-react';
import { customerApi, interviewApi, getErrorMessage } from '../../services/api';
import { getSections, SEGMENT_LABELS, ILPSection } from '../../data/ilpInterviewQuestions';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Segment = 'FARMER' | 'LANDLORD' | 'SHOP_OWNER';

// ── Answer input renderers ────────────────────────────────────────────────────

function QuestionInput({
  q, value, onChange,
}: {
  q: ILPSection['questions'][number];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  if (q.type === 'number') {
    return (
      <input
        type="number"
        value={(value as number) ?? ''}
        min={q.min}
        max={q.max}
        onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        className={base}
        placeholder="Enter number"
      />
    );
  }

  if (q.type === 'text') {
    return (
      <input
        type="text"
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value)}
        className={base}
        placeholder={q.placeholder ?? 'Enter text'}
      />
    );
  }

  if (q.type === 'textarea') {
    return (
      <textarea
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className={base}
        placeholder={q.placeholder ?? 'Enter details...'}
      />
    );
  }

  if (q.type === 'select') {
    return (
      <select
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value)}
        className={base + ' bg-white'}
      >
        <option value="">Select an option…</option>
        {q.options?.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (q.type === 'yesno' || q.type === 'yesno_detail') {
    const yesnoVal = (value as Record<string, unknown>)?.answer;
    const detailVal = (value as Record<string, unknown>)?.detail;

    return (
      <div className="space-y-2">
        <div className="flex gap-3">
          {['yes', 'no'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ answer: opt, detail: opt === 'yes' ? detailVal : undefined })}
              className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
                yesnoVal === opt
                  ? 'bg-primary-700 border-primary-700 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-primary-400'
              }`}
            >
              {opt === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
        {q.type === 'yesno_detail' && yesnoVal === 'yes' && (
          <input
            type="text"
            value={(detailVal as string) ?? ''}
            onChange={e => onChange({ answer: 'yes', detail: e.target.value })}
            className={base + ' mt-1'}
            placeholder={q.detailLabel ?? 'Provide details…'}
          />
        )}
      </div>
    );
  }

  return null;
}

// ── Section progress indicator ────────────────────────────────────────────────

function SectionNav({
  sections, currentIdx,
}: {
  sections: ILPSection[];
  currentIdx: number;
  answers?: Record<string, unknown>;
}) {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
      {sections.map((sec, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div
            key={sec.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
              active
                ? 'bg-primary-700 border-primary-700 text-white'
                : done
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            {done && <CheckCircle className="h-3 w-3" />}
            <span>{sec.id}. {sec.title}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ILPInterviewForm() {
  const { id: customerId, segment } = useParams<{ id: string; segment: string }>();
  const navigate = useNavigate();
  const seg = (segment?.toUpperCase() as Segment) ?? 'FARMER';

  const sections = getSections(seg);
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loNotes, setLoNotes] = useState('');
  const [saved, setSaved] = useState(false);

  // Fetch customer
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerApi.get(customerId!),
    enabled: !!customerId,
  });

  // Load existing interview (to resume drafts)
  const { data: existingInterview } = useQuery({
    queryKey: ['ilpInterview', customerId, seg],
    queryFn: () => interviewApi.getILP(customerId!, seg).catch(() => null),
    enabled: !!customerId,
  });

  useEffect(() => {
    if (existingInterview?.answers && Object.keys(answers).length === 0) {
      setAnswers(existingInterview.answers as Record<string, unknown>);
      setLoNotes(existingInterview.loNotes ?? '');
    }
  }, [existingInterview]);

  const mutation = useMutation({
    mutationFn: (status: 'DRAFT' | 'COMPLETED') =>
      interviewApi.saveILP(customerId!, seg, { answers, loNotes, status }),
    onSuccess: (_, status) => {
      setSaved(true);
      if (status === 'COMPLETED') {
        setTimeout(() => navigate(`/customers/${customerId}`), 1200);
      }
    },
  });

  const handleAnswer = (qId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleNext = async () => {
    await mutation.mutateAsync('DRAFT');
    if (currentSection < sections.length - 1) {
      setCurrentSection(s => s + 1);
      setSaved(false);
    }
  };

  const handleComplete = async () => {
    await mutation.mutateAsync('COMPLETED');
  };

  if (loadingCustomer) return <LoadingSpinner />;

  const sec = sections[currentSection];
  const isLastSection = currentSection === sections.length - 1;
  const segLabel = SEGMENT_LABELS[seg] ?? seg;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/customers/${customerId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Customer
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary-600" />
              ILP {segLabel} Interview
            </h1>
            {customer && (
              <p className="text-gray-500 mt-1 flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {customer.firstName} {customer.lastName} · {customer.county}
              </p>
            )}
          </div>
          <span className="px-3 py-1 bg-primary-50 border border-primary-200 text-primary-700 rounded-full text-sm font-medium">
            ILP · {segLabel}
          </span>
        </div>
      </div>

      {/* Section navigation */}
      <SectionNav sections={sections} currentIdx={currentSection} answers={answers} />

      {/* Section card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Section {sec.id}: {sec.title}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{sec.subtitle}</p>
        </div>

        <div className="space-y-6">
          {sec.questions.map((q, qi) => (
            <div key={q.id}>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">
                {qi + 1}. {q.label}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <QuestionInput
                q={q}
                value={answers[q.id]}
                onChange={v => handleAnswer(q.id, v)}
              />
            </div>
          ))}
        </div>

        {/* LO Notes on last section */}
        {isLastSection && (
          <div className="mt-6 pt-5 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              Loan Officer Notes (optional)
            </label>
            <textarea
              value={loNotes}
              onChange={e => setLoNotes(e.target.value)}
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Additional observations, context, or concerns…"
            />
          </div>
        )}

        {/* Error */}
        {mutation.isError && (
          <div className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {getErrorMessage(mutation.error)}
          </div>
        )}

        {/* Success flash */}
        {saved && !mutation.isError && (
          <div className="mt-4 flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle className="h-4 w-4" />
            {isLastSection ? 'Interview completed! Redirecting…' : 'Draft saved.'}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={currentSection === 0}
            onClick={() => setCurrentSection(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => mutation.mutate('DRAFT')}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              <Save className="h-4 w-4" />
              {mutation.isPending ? 'Saving…' : 'Save Draft'}
            </button>

            {isLastSection ? (
              <button
                type="button"
                onClick={handleComplete}
                disabled={mutation.isPending}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                {mutation.isPending ? 'Completing…' : 'Complete Interview'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={mutation.isPending}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-60"
              >
                {mutation.isPending ? 'Saving…' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress footer */}
      <div className="mt-4 text-center text-sm text-gray-400">
        Section {currentSection + 1} of {sections.length}
      </div>
    </div>
  );
}
