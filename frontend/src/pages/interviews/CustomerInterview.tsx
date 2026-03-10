import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Mic, MicOff, ChevronLeft, ChevronRight, CheckCircle,
  Globe, Star, AlertTriangle, ClipboardList, Save,
} from 'lucide-react';
import { customerApi, interviewApi, getErrorMessage } from '../../services/api';
import { Customer, CustomerInterview, InterviewAnswer } from '../../types';
import { useAuthStore } from '../../store/authStore';
import {
  INTERVIEW_SECTIONS, SCORE_LABELS, RECOMMENDATION_LABELS, MAX_SCORE, RED_FLAGS,
} from '../../data/interviewQuestions';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type Lang = 'en' | 'sw';

// ── Score star buttons ────────────────────────────────────────────────────────

function ScoreStars({
  value, onChange, lang,
}: {
  value?: number;
  onChange: (v: number) => void;
  lang: Lang;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            value === n
              ? 'bg-primary-700 border-primary-700 text-white shadow-sm scale-105'
              : 'bg-white border-gray-200 text-gray-500 hover:border-primary-400 hover:text-primary-600'
          }`}
          title={SCORE_LABELS[String(n)]?.[lang]}
        >
          <Star className={`h-3 w-3 ${value === n ? 'fill-current' : ''}`} />
          {n} — {SCORE_LABELS[String(n)]?.[lang]}
        </button>
      ))}
    </div>
  );
}

// ── Mic button (voice input) ──────────────────────────────────────────────────

function MicButton({
  qId, activeQId, isSupported, isListening, interimText,
  onStart, onStop, lang,
}: {
  qId: string;
  activeQId: string | null;
  isSupported: boolean;
  isListening: boolean;
  interimText: string;
  onStart: (qId: string) => void;
  onStop: () => void;
  lang: Lang;
}) {
  if (!isSupported) return null;

  const isThisActive = activeQId === qId && isListening;
  const label = lang === 'sw' ? 'Rekodi jibu' : 'Record answer';
  const labelStop = lang === 'sw' ? 'Simamisha' : 'Stop';

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => isThisActive ? onStop() : onStart(qId)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          isThisActive
            ? 'bg-red-50 border-red-300 text-red-600 animate-pulse'
            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-primary-400'
        }`}
      >
        {isThisActive ? (
          <><MicOff className="h-3.5 w-3.5" /> {labelStop}</>
        ) : (
          <><Mic className="h-3.5 w-3.5" /> {label}</>
        )}
      </button>
      {isThisActive && interimText && (
        <p className="mt-1 text-xs text-gray-400 italic">
          {lang === 'sw' ? 'Inakusikia...' : 'Listening...'} {interimText}
        </p>
      )}
    </div>
  );
}

// ── Recommendation banner ─────────────────────────────────────────────────────

function RecommendationBanner({
  scorePercent, recommendation, lang,
}: {
  scorePercent: number;
  recommendation: string;
  lang: Lang;
}) {
  const cfg = RECOMMENDATION_LABELS[recommendation];
  if (!cfg) return null;
  const colorMap: Record<string, string> = {
    green:  'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    red:    'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[cfg.color] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">{cfg[lang]}</p>
          <p className="text-xs mt-0.5 opacity-70">{scorePercent.toFixed(1)}% of maximum score</p>
        </div>
        <div className="text-2xl font-bold">{scorePercent.toFixed(0)}%</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerInterviewPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [lang, setLang]       = useState<Lang>('en');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, InterviewAnswer>>({});
  const [loNotes, setLoNotes] = useState('');
  const [activeQId, setActiveQId] = useState<string | null>(null);
  const [error, setError]     = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customer', customerId],
    queryFn:  () => customerApi.get(customerId!),
  });

  // Load existing DRAFT for this LO (if any) and pre-populate answers
  const { data: interviewList } = useQuery<CustomerInterview[]>({
    queryKey: ['interviews', customerId],
    queryFn:  () => interviewApi.list(customerId!),
    enabled:  !!customerId,
  });
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (draftLoaded.current || !interviewList || !user) return;
    const draft = interviewList.find(i => i.status === 'DRAFT' && i.conductedById === user.id);
    if (draft) {
      setAnswers(draft.answers as Record<string, InterviewAnswer>);
      setLoNotes(draft.loNotes ?? '');
      setLang((draft.language as Lang) ?? 'en');
      draftLoaded.current = true;
    }
  }, [interviewList, user]);

  // ── Speech recognition ────────────────────────────────────────────────────
  const handleFinalTranscript = useCallback((text: string) => {
    if (!activeQId) return;
    setAnswers(prev => ({
      ...prev,
      [activeQId]: {
        ...prev[activeQId],
        notes: ((prev[activeQId]?.notes ?? '') + ' ' + text).trim(),
      },
    }));
    setActiveQId(null);
  }, [activeQId]);

  const { isSupported, isListening, interimText, startListening, stopListening } =
    useSpeechRecognition(handleFinalTranscript);

  const handleStartMic = (qId: string) => {
    setActiveQId(qId);
    startListening(lang === 'sw' ? 'sw-KE' : 'en-KE');
  };
  const handleStopMic = () => {
    stopListening();
    setActiveQId(null);
  };

  // ── Answer management ─────────────────────────────────────────────────────
  const setScore = (qId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], score } }));
  };
  const setNotes = (qId: string, notes: string) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], notes } }));
  };

  // ── Live scoring ──────────────────────────────────────────────────────────
  const computedScore = (() => {
    let total = 0;
    let max   = 0;
    for (const section of INTERVIEW_SECTIONS) {
      for (const q of section.questions) {
        const s = answers[q.id]?.score;
        if (s !== undefined) total += s * section.weight;
        max += 5 * section.weight;
      }
    }
    const pct = max > 0 ? (total / max) * 100 : 0;
    let rec: string = 'DECLINE';
    if (pct >= 85) rec = 'APPROVE';
    else if (pct >= 70) rec = 'APPROVE_WITH_CONDITIONS';
    else if (pct >= 50) rec = 'FURTHER_EVALUATION';
    return { total, max: MAX_SCORE, pct, rec };
  })();

  // Answered question count
  const answeredCount = Object.values(answers).filter(a => a.score !== undefined).length;
  const totalQuestions = INTERVIEW_SECTIONS.reduce((s, sec) => s + sec.questions.length, 0);

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (status: 'DRAFT' | 'COMPLETED') =>
      interviewApi.save(customerId!, { language: lang, answers, loNotes, status }),
    onSuccess: (_, status) => {
      if (status === 'COMPLETED') navigate(`/customers/${customerId}`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const currentSection = INTERVIEW_SECTIONS[sectionIdx];
  const isLastSection  = sectionIdx === INTERVIEW_SECTIONS.length - 1;

  if (isLoading) return <LoadingSpinner />;
  if (!customer) return <div className="text-center py-12 text-gray-400">Customer not found</div>;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <Link to={`/customers/${customerId}`} className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-1">
            <ChevronLeft className="h-3.5 w-3.5" />
            {customer.firstName} {customer.lastName}
          </Link>
          <h1 className="page-title">
            {lang === 'en' ? 'Pre-Screening Interview' : 'Mahojiano ya Awali'}
          </h1>
        </div>

        {/* Language toggle */}
        <button
          type="button"
          onClick={() => setLang(l => l === 'en' ? 'sw' : 'en')}
          className="btn-secondary flex items-center gap-2"
          title="Switch language / Badilisha lugha"
        >
          <Globe className="h-4 w-4" />
          {lang === 'en' ? 'Swahili' : 'English'}
        </button>
      </div>

      {/* Speech recognition notice */}
      {isSupported && (
        <div className="mb-4 flex items-start gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
          <Mic className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          {lang === 'en'
            ? 'Voice input available — tap the mic icon next to any question to transcribe the customer\'s answer'
            : 'Uingizaji wa sauti unapatikana — gonga aikoni ya maikrofoni karibu na swali lolote kutafsiri jibu la mteja'}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all"
            style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {answeredCount}/{totalQuestions} {lang === 'en' ? 'scored' : 'aliyopata alama'}
        </span>
        {answeredCount > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            computedScore.pct >= 70 ? 'bg-green-100 text-green-700' :
            computedScore.pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {computedScore.pct.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {INTERVIEW_SECTIONS.map((sec, i) => {
          const sectionAnswered = sec.questions.filter(q => answers[q.id]?.score !== undefined).length;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSectionIdx(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors relative ${
                i === sectionIdx
                  ? 'bg-primary-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {i + 1}. {sec[lang].title.split(' ')[0]}
              {sectionAnswered > 0 && sectionAnswered < sec.questions.length && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full" />
              )}
              {sectionAnswered === sec.questions.length && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowSummary(true)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {lang === 'en' ? 'Summary' : 'Muhtasari'}
        </button>
      </div>

      {/* Current section */}
      {!showSummary && (
        <div className="form-section">
          <h2 className="section-title">
            {lang === 'en'
              ? `Section ${sectionIdx + 1}: ${currentSection.en.title}`
              : `Sehemu ${sectionIdx + 1}: ${currentSection.sw.title}`}
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {lang === 'en' ? `Weight: ×${currentSection.weight}` : `Uzito: ×${currentSection.weight}`}
            </span>
          </h2>

          <div className="space-y-6">
            {currentSection.questions.map((q, _qi) => {
              const ans = answers[q.id] ?? {};
              return (
                <div key={q.id} className={`rounded-xl border p-4 transition-colors ${
                  ans.score !== undefined ? 'border-primary-100 bg-primary-50/30' : 'border-gray-200 bg-white'
                }`}>
                  {/* Question number + text */}
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">
                      {currentSection.questions.indexOf(q) + 1 +
                       INTERVIEW_SECTIONS.slice(0, sectionIdx).reduce((s, sec) => s + sec.questions.length, 0)}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {q[lang].question}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 italic">
                        {lang === 'en' ? 'Purpose: ' : 'Madhumuni: '}{q[lang].purpose}
                      </p>
                    </div>
                  </div>

                  {/* Score buttons */}
                  <ScoreStars
                    value={ans.score}
                    onChange={v => setScore(q.id, v)}
                    lang={lang}
                  />

                  {/* Notes area */}
                  <div className="mt-3 relative">
                    <textarea
                      className="input w-full resize-none text-sm"
                      rows={activeQId === q.id && isListening ? 3 : 2}
                      placeholder={lang === 'en'
                        ? 'Notes on this answer (or transcribed speech)…'
                        : 'Maelezo ya jibu hili (au maneno yaliyotafsiriwa)…'}
                      value={ans.notes ?? ''}
                      onChange={e => setNotes(q.id, e.target.value)}
                    />
                    <MicButton
                      qId={q.id}
                      activeQId={activeQId}
                      isSupported={isSupported}
                      isListening={isListening}
                      interimText={interimText}
                      onStart={handleStartMic}
                      onStop={handleStopMic}
                      lang={lang}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section nav */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => setSectionIdx(s => Math.max(0, s - 1))}
              disabled={sectionIdx === 0}
              className="btn-secondary disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              {lang === 'en' ? 'Previous' : 'Iliyotangulia'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate('DRAFT')}
                disabled={saveMutation.isPending}
                className="btn-secondary flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                {lang === 'en' ? 'Save Draft' : 'Hifadhi Rasimu'}
              </button>

              {isLastSection ? (
                <button
                  type="button"
                  onClick={() => setShowSummary(true)}
                  className="btn-primary flex items-center gap-1.5"
                >
                  {lang === 'en' ? 'Review & Submit' : 'Kagua na Wasilisha'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSectionIdx(s => Math.min(INTERVIEW_SECTIONS.length - 1, s + 1))}
                  className="btn-primary flex items-center gap-1.5"
                >
                  {lang === 'en' ? 'Next Section' : 'Sehemu Inayofuata'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Summary / Submission screen ─────────────────────────────────────── */}
      {showSummary && (
        <div className="space-y-5">
          {/* Score banner */}
          <div className="form-section">
            <h2 className="section-title">
              {lang === 'en' ? 'Interview Summary & Score' : 'Muhtasari wa Mahojiano na Alama'}
            </h2>

            <RecommendationBanner
              scorePercent={computedScore.pct}
              recommendation={computedScore.rec}
              lang={lang}
            />

            {/* Per-section score breakdown */}
            <div className="mt-4 space-y-2">
              {INTERVIEW_SECTIONS.map(sec => {
                const earned  = sec.questions.reduce((s, q) => s + ((answers[q.id]?.score ?? 0) * sec.weight), 0);
                const maxSec  = sec.questions.length * 5 * sec.weight;
                const pct     = maxSec > 0 ? (earned / maxSec) * 100 : 0;
                const missed  = sec.questions.filter(q => answers[q.id]?.score === undefined).length;
                return (
                  <div key={sec.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">
                        {sec[lang].title}
                        {missed > 0 && <span className="ml-1.5 text-yellow-500">({missed} unanswered)</span>}
                      </span>
                      <span className="font-bold">{earned}/{maxSec}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Red flag guidance */}
          <div className="form-section">
            <h2 className="section-title flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              {lang === 'en' ? 'Red Flags to Consider' : 'Dalili za Onyo za Kuzingatia'}
            </h2>
            <div className="space-y-1.5">
              {Object.values(RED_FLAGS).map((flag, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-600 p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  {flag[lang]}
                </div>
              ))}
            </div>
          </div>

          {/* LO immediate thoughts */}
          <div className="form-section">
            <h2 className="section-title">
              {lang === 'en'
                ? "Loan Officer's Immediate Impressions"
                : 'Mawazo ya Haraka ya Afisa wa Mikopo'}
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              {lang === 'en'
                ? 'Record your overall impression of the customer: character, demeanour, consistency of answers, and any concerns or positive observations.'
                : 'Rekodi hisia yako ya jumla kuhusu mteja: tabia, mwenendo, uthabiti wa majibu, na wasiwasi au uchunguzi mzuri wowote.'}
            </p>
            <textarea
              className="input w-full"
              rows={6}
              placeholder={lang === 'en'
                ? 'Your observations, gut feeling, and recommendation rationale…'
                : 'Uchunguzi wako, hisia zako, na sababu za mapendekezo…'}
              value={loNotes}
              onChange={e => setLoNotes(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="btn-secondary"
            >
              <ChevronLeft className="h-4 w-4" />
              {lang === 'en' ? 'Back to Interview' : 'Rudi kwa Mahojiano'}
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate('DRAFT')}
              disabled={saveMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {lang === 'en' ? 'Save Draft' : 'Hifadhi Rasimu'}
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate('COMPLETED')}
              disabled={saveMutation.isPending || answeredCount === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {saveMutation.isPending
                ? (lang === 'en' ? 'Submitting…' : 'Inawasilisha…')
                : (lang === 'en' ? 'Submit Interview' : 'Wasilisha Mahojiano')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
