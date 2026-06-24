import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Play,
  RotateCcw,
  Trophy,
  Heart,
  Link2,
  Sparkles,
  Volume2,
  CheckCircle2,
  XCircle,
  Puzzle,
  Zap,
  Layers3,
  AlertTriangle
} from 'lucide-react';

// =========================================================================
// 🧩 طابق المفهوم - Match Cards Game
// -------------------------------------------------------------------------
// لعبة مطابقة تعليمية عالية التباين:
// - الطالب يختار مفهومًا من العمود الأول.
// - ثم يختار التعريف المناسب من العمود الثاني.
// - المطابقة الصحيحة تغلق الزوج وتمنح نقاطًا.
// - المطابقة الخاطئة تخصم محاولة وتعرض تغذية راجعة واضحة.
// - تدعم البيانات بصيغتين:
//   1) question.pairs = [{ term, definition }]
//   2) كل سؤال يمثل زوجًا: question = المفهوم، correctAnswerText أو options[correctAnswerIndex] = التعريف
// =========================================================================

export interface MatchPairInput {
  term: string;
  definition: string;
}

export interface MatchCardsQuestion {
  id: string;
  subject?: string;
  unit?: string;
  lesson?: string;
  questionType?: 'matching' | 'multiple_choice' | 'true_false';
  question?: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  active?: boolean;
  pairs?: MatchPairInput[];
}

export interface MatchCardsResult {
  gameType: 'match_cards';
  score: number;
  matched: number;
  wrong: number;
  completed: boolean;
  weakQuestionIds: string[];
  playedAt: string;
}

interface StudentMatchCardsGameProps {
  questions: MatchCardsQuestion[];
  studentId?: string;
  onClose: () => void;
  onComplete?: (result: MatchCardsResult) => void;
}

type GameState = 'menu' | 'playing' | 'finished';
type FeedbackState = {
  type: 'correct' | 'wrong' | 'complete';
  message: string;
  detail?: string;
} | null;

type MatchCardSide = 'term' | 'definition';

type MatchPair = {
  id: string;
  sourceQuestionId: string;
  term: string;
  definition: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
};

type MatchCard = {
  id: string;
  pairId: string;
  side: MatchCardSide;
  text: string;
};

type SfxType = 'start' | 'correct' | 'wrong' | 'finish';

const MAX_LIVES = 5;
const getTodayKey = () => new Date().toLocaleDateString('en-CA');

const cleanText = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

const playSfx = (type: SfxType, enabled = true) => {
  if (!enabled) return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    const audioCtx = new AudioContextClass();
    const now = audioCtx.currentTime;

    const tone = (
      frequencyA: number,
      frequencyB: number,
      duration: number,
      oscillatorType: OscillatorType,
      volume: number,
      startOffset = 0
    ) => {
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.type = oscillatorType;
      oscillator.frequency.setValueAtTime(frequencyA, now + startOffset);
      oscillator.frequency.exponentialRampToValueAtTime(frequencyB, now + startOffset + duration * 0.72);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(volume, now + startOffset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      oscillator.start(now + startOffset);
      oscillator.stop(now + startOffset + duration + 0.02);
    };

    if (type === 'correct') {
      tone(520, 860, 0.15, 'sine', 0.14);
      tone(700, 980, 0.14, 'triangle', 0.09, 0.08);
    } else if (type === 'wrong') {
      tone(240, 130, 0.22, 'square', 0.11);
    } else if (type === 'start') {
      tone(360, 620, 0.16, 'triangle', 0.11);
    } else if (type === 'finish') {
      tone(440, 660, 0.16, 'sine', 0.11);
      tone(660, 990, 0.18, 'triangle', 0.09, 0.1);
    }
  } catch {
    // تجاهل منع الصوت من المتصفح.
  }
};

const shuffleArray = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildPairs = (questions: MatchCardsQuestion[]): MatchPair[] => {
  const pairs: MatchPair[] = [];

  (Array.isArray(questions) ? questions : []).forEach((question, questionIndex) => {
    if (!question || question.active === false) return;

    if (Array.isArray(question.pairs) && question.pairs.length > 0) {
      question.pairs.forEach((pair, pairIndex) => {
        const term = cleanText(pair.term);
        const definition = cleanText(pair.definition);
        if (!term || !definition) return;

        pairs.push({
          id: `${question.id || `q_${questionIndex}`}_pair_${pairIndex}`,
          sourceQuestionId: question.id || `q_${questionIndex}`,
          term,
          definition,
          explanation: question.explanation,
          difficulty: question.difficulty
        });
      });
      return;
    }

    const term = cleanText(question.question);
    const definitionFromCorrectText = cleanText(question.correctAnswerText);
    const definitionFromOptions = typeof question.correctAnswerIndex === 'number'
      ? cleanText(question.options?.[question.correctAnswerIndex])
      : '';
    const definition = definitionFromCorrectText || definitionFromOptions;

    if (!term || !definition) return;

    pairs.push({
      id: question.id || `q_${questionIndex}`,
      sourceQuestionId: question.id || `q_${questionIndex}`,
      term,
      definition,
      explanation: question.explanation,
      difficulty: question.difficulty
    });
  });

  const unique = new Map<string, MatchPair>();
  pairs.forEach(pair => {
    const key = `${pair.term}__${pair.definition}`;
    if (!unique.has(key)) unique.set(key, pair);
  });

  return Array.from(unique.values()).slice(0, 10);
};

const StudentMatchCardsGame: React.FC<StudentMatchCardsGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const allPairs = useMemo(() => buildPairs(questions), [questions]);
  const gamePairs = useMemo(() => shuffleArray(allPairs).slice(0, Math.min(8, allPairs.length)), [allPairs]);

  const initialTerms = useMemo<MatchCard[]>(() => {
    return shuffleArray(
      gamePairs.map(pair => ({
        id: `${pair.id}_term`,
        pairId: pair.id,
        side: 'term' as MatchCardSide,
        text: pair.term
      }))
    );
  }, [gamePairs]);

  const initialDefinitions = useMemo<MatchCard[]>(() => {
    return shuffleArray(
      gamePairs.map(pair => ({
        id: `${pair.id}_definition`,
        pairId: pair.id,
        side: 'definition' as MatchCardSide,
        text: pair.definition
      }))
    );
  }, [gamePairs]);

  const completedRef = useRef(false);
  const scoreRef = useRef(0);
  const matchedRef = useRef(0);
  const wrongRef = useRef(0);
  const weakIdsRef = useRef<string[]>([]);

  const [gameState, setGameState] = useState<GameState>('menu');
  const [terms, setTerms] = useState<MatchCard[]>(initialTerms);
  const [definitions, setDefinitions] = useState<MatchCard[]>(initialDefinitions);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [wrongFlashIds, setWrongFlashIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [matched, setMatched] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canPlay = gamePairs.length >= 2;
  const progress = gamePairs.length > 0 ? Math.round((matchedPairIds.length / gamePairs.length) * 100) : 0;

  const resetRoundState = () => {
    setSelectedTermId(null);
    setSelectedDefinitionId(null);
    setWrongFlashIds([]);
  };

  const syncScore = (next: number) => {
    scoreRef.current = next;
    setScore(next);
  };

  const syncMatched = (next: number) => {
    matchedRef.current = next;
    setMatched(next);
  };

  const syncWrong = (next: number) => {
    wrongRef.current = next;
    setWrong(next);
  };

  const syncWeakIds = (next: string[]) => {
    weakIdsRef.current = next;
    setWeakQuestionIds(next);
  };

  const saveResult = (completed: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;

    const result: MatchCardsResult = {
      gameType: 'match_cards',
      score: scoreRef.current,
      matched: matchedRef.current,
      wrong: wrongRef.current,
      completed,
      weakQuestionIds: weakIdsRef.current,
      playedAt: new Date().toISOString()
    };

    try {
      const key = `rased_student_game_stats_${studentId || 'default'}`;
      const oldStats = JSON.parse(localStorage.getItem(key) || '{}');
      const attempts = Number(oldStats.matchCardsAttempts || 0) + 1;
      const bestScore = Math.max(Number(oldStats.matchCardsBestScore || 0), result.score);

      localStorage.setItem(
        key,
        JSON.stringify({
          ...oldStats,
          matchCardsBestScore: bestScore,
          matchCardsLastScore: result.score,
          matchCardsAttempts: attempts,
          lastPlayedDate: getTodayKey(),
          lastGameType: 'match_cards'
        })
      );

      const resultKey = `rased_game_results_${studentId || 'default'}`;
      const oldResults = JSON.parse(localStorage.getItem(resultKey) || '[]');
      oldResults.unshift(result);
      localStorage.setItem(resultKey, JSON.stringify(oldResults.slice(0, 30)));
    } catch (error) {
      console.error('Failed to save match cards result', error);
    }

    onComplete?.(result);
  };

  const finishGame = (completed: boolean) => {
    playSfx('finish', soundEnabled);
    setGameState('finished');
    saveResult(completed);
  };

  const startGame = () => {
    if (!canPlay) return;
    completedRef.current = false;
    scoreRef.current = 0;
    matchedRef.current = 0;
    wrongRef.current = 0;
    weakIdsRef.current = [];
    setTerms(shuffleArray(initialTerms));
    setDefinitions(shuffleArray(initialDefinitions));
    setMatchedPairIds([]);
    setScore(0);
    setMatched(0);
    setWrong(0);
    setLives(MAX_LIVES);
    setFeedback(null);
    setWeakQuestionIds([]);
    resetRoundState();
    playSfx('start', soundEnabled);
    setGameState('playing');
  };

  const resetGame = () => {
    completedRef.current = false;
    setGameState('menu');
    setMatchedPairIds([]);
    setScore(0);
    setMatched(0);
    setWrong(0);
    setLives(MAX_LIVES);
    setFeedback(null);
    setWeakQuestionIds([]);
    resetRoundState();
    scoreRef.current = 0;
    matchedRef.current = 0;
    wrongRef.current = 0;
    weakIdsRef.current = [];
  };

  const getPair = (pairId: string) => gamePairs.find(pair => pair.id === pairId);
  const isMatched = (pairId: string) => matchedPairIds.includes(pairId);

  const resolveSelection = (termId: string, definitionId: string) => {
    const termCard = terms.find(card => card.id === termId);
    const definitionCard = definitions.find(card => card.id === definitionId);
    if (!termCard || !definitionCard) return;

    if (termCard.pairId === definitionCard.pairId) {
      const pair = getPair(termCard.pairId);
      const difficultyBonus = pair?.difficulty === 'hard' ? 40 : pair?.difficulty === 'medium' ? 25 : 10;
      const gained = 120 + difficultyBonus;
      const nextScore = scoreRef.current + gained;
      const nextMatched = matchedRef.current + 1;
      const nextMatchedIds = Array.from(new Set([...matchedPairIds, termCard.pairId]));

      playSfx('correct', soundEnabled);
      syncScore(nextScore);
      syncMatched(nextMatched);
      setMatchedPairIds(nextMatchedIds);
      setFeedback({
        type: 'correct',
        message: `مطابقة صحيحة! +${gained} نقطة`,
        detail: pair?.explanation || `${termCard.text} ← ${definitionCard.text}`
      });
      resetRoundState();

      window.setTimeout(() => {
        setFeedback(null);
        if (nextMatchedIds.length >= gamePairs.length) {
          finishGame(true);
        }
      }, 1000);
      return;
    }

    const wrongPair = getPair(termCard.pairId);
    const nextWrong = wrongRef.current + 1;
    const nextLives = lives - 1;
    const nextWeakIds = Array.from(new Set([...weakIdsRef.current, wrongPair?.sourceQuestionId || termCard.pairId]));

    playSfx('wrong', soundEnabled);
    syncWrong(nextWrong);
    setLives(nextLives);
    syncWeakIds(nextWeakIds);
    setWrongFlashIds([termId, definitionId]);
    setFeedback({
      type: 'wrong',
      message: 'ليست مطابقة صحيحة. حاول ربط المفهوم بالتعريف الأنسب.',
      detail: wrongPair?.explanation
    });

    window.setTimeout(() => {
      resetRoundState();
      setFeedback(null);
      if (nextLives <= 0) {
        finishGame(false);
      }
    }, 1000);
  };

  const handleCardClick = (card: MatchCard) => {
    if (gameState !== 'playing' || isMatched(card.pairId)) return;

    if (card.side === 'term') {
      setSelectedTermId(card.id);
      if (selectedDefinitionId) {
        resolveSelection(card.id, selectedDefinitionId);
      }
      return;
    }

    setSelectedDefinitionId(card.id);
    if (selectedTermId) {
      resolveSelection(selectedTermId, card.id);
    }
  };

  const cardClass = (card: MatchCard) => {
    const selected = card.id === selectedTermId || card.id === selectedDefinitionId;
    const matchedCard = isMatched(card.pairId);
    const wrongCard = wrongFlashIds.includes(card.id);
    const sideTone = card.side === 'term'
      ? 'from-sky-500/24 to-indigo-900/68 border-sky-200/35'
      : 'from-emerald-500/24 to-teal-900/68 border-emerald-200/35';

    const base = 'relative w-full min-h-[96px] rounded-[1.35rem] border p-3.5 text-start transition-all active:scale-[0.985] shadow-[0_16px_34px_rgba(0,0,0,0.28)] overflow-hidden';

    if (matchedCard) {
      return `${base} bg-gradient-to-br from-emerald-400/45 to-emerald-900/80 border-emerald-200/70 opacity-80`;
    }

    if (wrongCard) {
      return `${base} bg-gradient-to-br from-red-400/45 to-red-950/85 border-red-200/70 animate-pulse`;
    }

    if (selected) {
      return `${base} bg-gradient-to-br from-yellow-300/45 to-orange-900/75 border-yellow-200/80 ring-4 ring-yellow-300/15`;
    }

    return `${base} bg-gradient-to-br ${sideTone} hover:brightness-110`;
  };

  const renderCard = (card: MatchCard, index: number) => {
    const matchedCard = isMatched(card.pairId);
    return (
      <button
        key={card.id}
        type="button"
        disabled={matchedCard || gameState !== 'playing'}
        onClick={() => handleCardClick(card)}
        className={cardClass(card)}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/14 via-transparent to-black/18" />
        <div className="relative z-10 flex items-start gap-2">
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 font-black text-xs ${matchedCard ? 'bg-emerald-300 text-slate-950 border-emerald-100' : 'bg-slate-950/45 text-white border-white/15'}`}>
            {matchedCard ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
          </div>
          <p className="text-[clamp(0.78rem,3.3vw,0.96rem)] font-black leading-6 text-white break-words whitespace-pre-wrap">
            {card.text}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[2147483647] text-white overflow-hidden font-['Tajawal']" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#38bdf8_0%,transparent_30%),radial-gradient(circle_at_bottom_left,#10b981_0%,transparent_30%),linear-gradient(135deg,#0f172a_0%,#172554_48%,#042f2e_100%)]" />
      <div className="absolute inset-0 bg-black/10" />
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '34px 34px'
        }}
      />

      <header className="relative z-20 pt-[max(env(safe-area-inset-top),14px)] px-4 pb-3 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-slate-950/60 border border-white/15 backdrop-blur-xl flex items-center justify-center text-sky-200 shadow-[0_16px_36px_rgba(0,0,0,0.30)]">
            <Puzzle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black truncate drop-shadow-sm">طابق المفهوم</h1>
            <p className="text-[10px] font-bold text-slate-200/90 truncate">اربط المفهوم بالتعريف الصحيح 🧩</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`w-10 h-10 rounded-2xl border backdrop-blur-xl flex items-center justify-center active:scale-95 shadow-[0_16px_36px_rgba(0,0,0,0.26)] ${soundEnabled ? 'bg-emerald-500/20 border-emerald-200/30 text-emerald-100' : 'bg-slate-950/55 border-white/15 text-slate-300'}`}
            aria-label="تشغيل أو إيقاف الصوت"
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-950/60 border border-white/15 backdrop-blur-xl flex items-center justify-center active:scale-95 shadow-[0_16px_36px_rgba(0,0,0,0.30)]"
            aria-label="إغلاق اللعبة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="relative z-10 h-[calc(100dvh-78px)] overflow-y-auto overscroll-contain custom-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom)+122px)]">
        <div className="max-w-5xl mx-auto min-h-full flex flex-col justify-center py-4">
          {gameState === 'menu' && (
            <section className="max-w-xl mx-auto w-full rounded-[2rem] border border-white/15 bg-slate-950/72 backdrop-blur-xl p-6 text-center shadow-[0_28px_70px_rgba(0,0,0,0.40)] relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-sky-300 via-emerald-300 to-yellow-300" />
              <div className="mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-sky-300 to-emerald-400 flex items-center justify-center shadow-[0_20px_42px_rgba(56,189,248,0.32)] mb-4">
                <Layers3 className="w-10 h-10 text-slate-950" />
              </div>
              <h2 className="text-3xl font-black mb-2">تحدي طابق المفهوم</h2>
              <p className="text-sm font-bold text-slate-200 leading-7 mb-5">
                اختر مفهومًا من العمود الأول ثم اختر تعريفه الصحيح من العمود الثاني. البطاقات المتطابقة ستُقفل تلقائيًا.
              </p>

              {!canPlay ? (
                <div className="rounded-2xl bg-yellow-400/15 border border-yellow-300/30 p-4 text-sm font-bold text-yellow-100 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  تحتاج اللعبة إلى زوجين على الأقل من المفاهيم والتعريفات.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full h-14 rounded-2xl bg-gradient-to-l from-sky-400 to-emerald-400 text-slate-950 font-black text-lg shadow-[0_18px_40px_rgba(56,189,248,0.30)] active:scale-95 flex items-center justify-center gap-2"
                >
                  <Play className="w-6 h-6" />
                  ابدأ المطابقة
                </button>
              )}
            </section>
          )}

          {gameState === 'playing' && (
            <section className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
                  <p className="text-[9px] font-black text-slate-100 mb-1">النقاط</p>
                  <p className="text-lg font-black text-yellow-300 drop-shadow">{score}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
                  <p className="text-[9px] font-black text-slate-100 mb-1">مطابقة</p>
                  <p className="text-lg font-black text-emerald-300 drop-shadow">{matched}/{gamePairs.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
                  <p className="text-[9px] font-black text-slate-100 mb-1">خطأ</p>
                  <p className="text-lg font-black text-red-300 drop-shadow">{wrong}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
                  <p className="text-[9px] font-black text-slate-100 mb-1">محاولات</p>
                  <p className="text-lg font-black text-red-300 drop-shadow flex items-center justify-center gap-1"><Heart className="w-4 h-4" />{lives}</p>
                </div>
              </div>

              <div className="rounded-full bg-slate-950/45 border border-white/10 h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-l from-emerald-300 to-sky-300 transition-all duration-300" style={{ width: `${Math.max(4, progress)}%` }} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-[1.8rem] bg-slate-950/62 border border-sky-200/20 backdrop-blur-xl p-3 shadow-[0_22px_54px_rgba(0,0,0,0.34)]">
                  <div className="flex items-center justify-between px-2 mb-3">
                    <h3 className="text-sm font-black text-sky-100 flex items-center gap-2"><Sparkles className="w-4 h-4" />المفاهيم</h3>
                    <span className="text-[10px] font-black text-slate-300">اختر بطاقة</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {terms.map((card, index) => renderCard(card, index))}
                  </div>
                </div>

                <div className="rounded-[1.8rem] bg-slate-950/62 border border-emerald-200/20 backdrop-blur-xl p-3 shadow-[0_22px_54px_rgba(0,0,0,0.34)]">
                  <div className="flex items-center justify-between px-2 mb-3">
                    <h3 className="text-sm font-black text-emerald-100 flex items-center gap-2"><Link2 className="w-4 h-4" />التعريفات</h3>
                    <span className="text-[10px] font-black text-slate-300">ثم اختر المطابقة</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {definitions.map((card, index) => renderCard(card, index))}
                  </div>
                </div>
              </div>

              {feedback && (
                <div className={`rounded-3xl border p-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)] ${feedback.type === 'correct' ? 'bg-emerald-950/85 border-emerald-300/50' : 'bg-red-950/85 border-red-300/50'}`}>
                  <p className={`text-base font-black mb-2 ${feedback.type === 'correct' ? 'text-emerald-200' : 'text-red-200'}`}>{feedback.message}</p>
                  {feedback.detail && (
                    <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                      <p className="text-[12px] font-bold text-white leading-7 break-words whitespace-pre-wrap">{feedback.detail}</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {gameState === 'finished' && (
            <section className="max-w-xl mx-auto w-full rounded-[2rem] border border-white/15 bg-slate-950/72 backdrop-blur-xl p-6 text-center shadow-[0_28px_70px_rgba(0,0,0,0.40)] relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-yellow-300 via-emerald-300 to-sky-300" />
              <Trophy className="w-16 h-16 mx-auto text-yellow-200 mb-3 drop-shadow" />
              <h2 className="text-3xl font-black mb-2">انتهت المطابقة</h2>
              <p className="text-sm font-bold text-slate-200 leading-7 mb-5">
                طابقت {matched} من {gamePairs.length} أزواج، وأخطأت {wrong} مرة. نتيجتك {score} نقطة.
              </p>
              <button
                type="button"
                onClick={resetGame}
                className="w-full h-14 rounded-2xl bg-gradient-to-l from-sky-400 to-emerald-400 text-slate-950 font-black text-lg shadow-[0_18px_40px_rgba(56,189,248,0.30)] active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-6 h-6" />
                جولة جديدة
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentMatchCardsGame;
