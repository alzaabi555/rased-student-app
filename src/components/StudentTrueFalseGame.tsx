import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  CheckCircle2,
  Play,
  RotateCcw,
  Trophy,
  Heart,
  Timer,
  Zap,
  ShieldCheck,
  ShieldX,
  Flame,
  Sparkles,
  Volume2,
  AlertTriangle
} from 'lucide-react';

// =========================================================================
// ✅❌ صح أم خطأ V2 - Visual + Audio
// -------------------------------------------------------------------------
// نسخة محسّنة بصريًا وصوتيًا:
// - خلفية Game-like عالية التباين.
// - بطاقات سؤال أوضح بدون قص النص.
// - تغذية راجعة واضحة جدًا مع تفسير مقروء.
// - مؤثرات صوتية مدمجة Web Audio API بدون ملفات خارجية.
// - تصميم مناسب للجوال مع مراعاة القائمة السفلية.
// =========================================================================

export interface TrueFalseQuestion {
  id: string;
  subject?: string;
  unit?: string;
  lesson?: string;
  questionType?: 'true_false';
  question: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  active?: boolean;
}

export interface TrueFalseResult {
  gameType: 'true_false';
  score: number;
  correct: number;
  wrong: number;
  maxStreak: number;
  completed: boolean;
  weakQuestionIds: string[];
  playedAt: string;
}

interface StudentTrueFalseGameProps {
  questions: TrueFalseQuestion[];
  studentId?: string;
  onClose: () => void;
  onComplete?: (result: TrueFalseResult) => void;
}

type GameState = 'menu' | 'playing' | 'feedback' | 'finished';
type FeedbackState = {
  type: 'correct' | 'wrong' | 'timeout';
  message: string;
  explanation?: string;
} | null;

type SfxType = 'correct' | 'wrong' | 'timeout' | 'start' | 'finish';

const MAX_LIVES = 3;
const QUESTION_SECONDS = 18;
const getTodayKey = () => new Date().toLocaleDateString('en-CA');

const normalizeQuestions = (questions: TrueFalseQuestion[]) => {
  return (Array.isArray(questions) ? questions : []).filter(q => {
    if (!q || q.active === false) return false;
    if (!q.question) return false;
    return q.questionType === 'true_false' || typeof q.correctAnswerIndex === 'number';
  });
};

const shuffleArray = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

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
      tone(520, 880, 0.16, 'sine', 0.15);
      tone(760, 1040, 0.16, 'triangle', 0.10, 0.08);
    } else if (type === 'wrong') {
      tone(230, 125, 0.22, 'square', 0.12);
    } else if (type === 'timeout') {
      tone(320, 160, 0.16, 'sawtooth', 0.10);
      tone(180, 95, 0.18, 'square', 0.10, 0.12);
    } else if (type === 'start') {
      tone(360, 620, 0.16, 'triangle', 0.12);
    } else if (type === 'finish') {
      tone(440, 660, 0.16, 'sine', 0.12);
      tone(660, 990, 0.18, 'triangle', 0.10, 0.10);
    }
  } catch {
    // بعض المتصفحات تمنع الصوت إذا لم يكن بعد تفاعل مباشر؛ يتم تجاهل الخطأ.
  }
};

const StudentTrueFalseGame: React.FC<StudentTrueFalseGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const usableQuestions = useMemo(() => normalizeQuestions(questions), [questions]);
  const questionDeck = useMemo(() => shuffleArray(usableQuestions), [usableQuestions]);

  const timerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const gameStateRef = useRef<GameState>('menu');
  const questionIndexRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const maxStreakRef = useRef(0);
  const weakQuestionIdsRef = useRef<string[]>([]);

  const [gameState, setGameState] = useState<GameState>('menu');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);
  const [lastAnswer, setLastAnswer] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canPlay = usableQuestions.length > 0;
  const currentQuestion = questionDeck[questionIndex] || null;
  const progress = questionDeck.length > 0 ? Math.round((questionIndex / questionDeck.length) * 100) : 0;

  const syncGameState = (next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
  };

  const updateScore = (updater: number | ((prev: number) => number)) => {
    setScore(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      scoreRef.current = next;
      return next;
    });
  };

  const updateCorrect = (updater: number | ((prev: number) => number)) => {
    setCorrect(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      correctRef.current = next;
      return next;
    });
  };

  const updateWrong = (updater: number | ((prev: number) => number)) => {
    setWrong(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      wrongRef.current = next;
      return next;
    });
  };

  const updateLives = (updater: number | ((prev: number) => number)) => {
    setLives(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      livesRef.current = next;
      return next;
    });
  };

  const updateMaxStreak = (next: number) => {
    maxStreakRef.current = next;
    setMaxStreak(next);
  };

  const updateWeakIds = (next: string[]) => {
    weakQuestionIdsRef.current = next;
    setWeakQuestionIds(next);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const saveResult = (completed: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;

    const result: TrueFalseResult = {
      gameType: 'true_false',
      score: scoreRef.current,
      correct: correctRef.current,
      wrong: wrongRef.current,
      maxStreak: maxStreakRef.current,
      completed,
      weakQuestionIds: weakQuestionIdsRef.current,
      playedAt: new Date().toISOString()
    };

    try {
      const key = `rased_student_game_stats_${studentId || 'default'}`;
      const oldStats = JSON.parse(localStorage.getItem(key) || '{}');
      const attempts = Number(oldStats.trueFalseAttempts || 0) + 1;
      const bestScore = Math.max(Number(oldStats.trueFalseBestScore || 0), result.score);

      localStorage.setItem(
        key,
        JSON.stringify({
          ...oldStats,
          trueFalseBestScore: bestScore,
          trueFalseLastScore: result.score,
          trueFalseAttempts: attempts,
          lastPlayedDate: getTodayKey(),
          lastGameType: 'true_false'
        })
      );

      const resultKey = `rased_game_results_${studentId || 'default'}`;
      const oldResults = JSON.parse(localStorage.getItem(resultKey) || '[]');
      oldResults.unshift(result);
      localStorage.setItem(resultKey, JSON.stringify(oldResults.slice(0, 30)));
    } catch (error) {
      console.error('Failed to save true false result', error);
    }

    onComplete?.(result);
  };

  const finishGame = (completed: boolean) => {
    clearTimer();
    playSfx('finish', soundEnabled);
    syncGameState('finished');
    saveResult(completed);
  };

  const handleTimeout = () => {
    const activeQuestion = questionDeck[questionIndexRef.current];
    if (gameStateRef.current !== 'playing' || !activeQuestion) return;

    clearTimer();
    playSfx('timeout', soundEnabled);

    const nextWrong = wrongRef.current + 1;
    const nextLives = livesRef.current - 1;
    const nextWeakIds = Array.from(new Set([...weakQuestionIdsRef.current, activeQuestion.id]));

    updateWrong(nextWrong);
    updateLives(nextLives);
    setStreak(0);
    updateWeakIds(nextWeakIds);
    setFeedback({
      type: 'timeout',
      message: 'انتهى الوقت! اعتُبرت الإجابة خاطئة.',
      explanation: activeQuestion.explanation
    });
    syncGameState('feedback');
    goNext(nextLives);
  };

  const startQuestionTimer = () => {
    clearTimer();
    setTimeLeft(QUESTION_SECONDS);

    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startGame = () => {
    if (!canPlay) return;
    playSfx('start', soundEnabled);
    completedRef.current = false;
    questionIndexRef.current = 0;
    scoreRef.current = 0;
    correctRef.current = 0;
    wrongRef.current = 0;
    livesRef.current = MAX_LIVES;
    maxStreakRef.current = 0;
    weakQuestionIdsRef.current = [];

    setQuestionIndex(0);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setLives(MAX_LIVES);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(QUESTION_SECONDS);
    setFeedback(null);
    setWeakQuestionIds([]);
    setLastAnswer(null);
    syncGameState('playing');
  };

  useEffect(() => {
    if (gameState === 'playing') {
      startQuestionTimer();
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, questionIndex]);

  const goNext = (nextLives = livesRef.current) => {
    clearTimer();
    window.setTimeout(() => {
      setFeedback(null);
      setLastAnswer(null);

      if (nextLives <= 0) {
        finishGame(false);
        return;
      }

      const nextIndex = questionIndexRef.current + 1;
      if (nextIndex >= questionDeck.length) {
        questionIndexRef.current = nextIndex;
        setQuestionIndex(nextIndex);
        finishGame(true);
        return;
      }

      questionIndexRef.current = nextIndex;
      setQuestionIndex(nextIndex);
      syncGameState('playing');
    }, 1200);
  };

  const handleAnswer = (answerIndex: number) => {
    if (gameStateRef.current !== 'playing' || !currentQuestion) return;
    clearTimer();

    const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
    const isCorrect = answerIndex === correctIndex;
    setLastAnswer(answerIndex);

    if (isCorrect) {
      playSfx('correct', soundEnabled);

      const nextStreak = streak + 1;
      const difficultyBonus = currentQuestion.difficulty === 'hard' ? 40 : currentQuestion.difficulty === 'medium' ? 25 : 10;
      const timeBonus = Math.max(0, timeLeft) * 3;
      const streakBonus = Math.min(nextStreak * 12, 72);
      const gained = 100 + difficultyBonus + timeBonus + streakBonus;
      const nextMaxStreak = Math.max(maxStreakRef.current, nextStreak);

      updateScore(prev => prev + gained);
      updateCorrect(prev => prev + 1);
      setStreak(nextStreak);
      updateMaxStreak(nextMaxStreak);
      setFeedback({
        type: 'correct',
        message: `إجابة صحيحة! +${gained} نقطة`,
        explanation: currentQuestion.explanation
      });
      syncGameState('feedback');
      goNext(livesRef.current);
      return;
    }

    playSfx('wrong', soundEnabled);

    const nextLives = livesRef.current - 1;
    const nextWeakIds = Array.from(new Set([...weakQuestionIdsRef.current, currentQuestion.id]));

    updateWrong(prev => prev + 1);
    updateLives(nextLives);
    setStreak(0);
    updateWeakIds(nextWeakIds);
    setFeedback({
      type: 'wrong',
      message: 'إجابة غير صحيحة، اقرأ التفسير وحاول في السؤال القادم.',
      explanation: currentQuestion.explanation
    });
    syncGameState('feedback');
    goNext(nextLives);
  };

  const resetGame = () => {
    clearTimer();
    completedRef.current = false;
    questionIndexRef.current = 0;
    scoreRef.current = 0;
    correctRef.current = 0;
    wrongRef.current = 0;
    livesRef.current = MAX_LIVES;
    maxStreakRef.current = 0;
    weakQuestionIdsRef.current = [];

    syncGameState('menu');
    setQuestionIndex(0);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setLives(MAX_LIVES);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(QUESTION_SECONDS);
    setFeedback(null);
    setWeakQuestionIds([]);
    setLastAnswer(null);
  };

  const optionClass = (index: number) => {
    const base = 'relative overflow-hidden rounded-[1.7rem] border p-5 min-h-[112px] flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_18px_36px_rgba(0,0,0,0.28)] text-white disabled:cursor-not-allowed';

    if (gameState === 'feedback' && currentQuestion) {
      const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
      if (index === correctIndex) {
        return `${base} bg-gradient-to-br from-emerald-400/45 to-emerald-800/75 border-emerald-200/70 ring-4 ring-emerald-300/15`;
      }
      if (lastAnswer === index) {
        return `${base} bg-gradient-to-br from-rose-400/45 to-red-900/75 border-red-200/70 ring-4 ring-red-300/15`;
      }
    }

    return index === 0
      ? `${base} bg-gradient-to-br from-emerald-400/35 to-emerald-800/65 border-emerald-200/50 hover:from-emerald-400/50 hover:to-emerald-800/80`
      : `${base} bg-gradient-to-br from-rose-400/35 to-red-900/65 border-red-200/50 hover:from-rose-400/50 hover:to-red-900/80`;
  };

  const timeColor = timeLeft <= 5 ? 'text-red-200' : timeLeft <= 10 ? 'text-yellow-200' : 'text-sky-200';
  const timeBarColor = timeLeft <= 5 ? 'from-red-500 to-orange-400' : timeLeft <= 10 ? 'from-yellow-400 to-orange-400' : 'from-emerald-400 to-sky-400';

  return (
    <div className="fixed inset-0 z-[2147483647] text-white overflow-hidden font-['Tajawal']" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#10b981_0%,transparent_32%),radial-gradient(circle_at_bottom_left,#ef4444_0%,transparent_30%),linear-gradient(135deg,#0f172a_0%,#172554_45%,#064e3b_100%)]" />
      <div className="absolute inset-0 bg-black/10" />
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '34px 34px'
        }}
      />
      <div className="absolute top-20 right-8 w-48 h-48 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="absolute bottom-24 left-8 w-56 h-56 rounded-full bg-red-300/10 blur-3xl" />

      <header className="relative z-20 pt-[max(env(safe-area-inset-top),14px)] px-4 pb-3 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-slate-950/60 border border-white/15 backdrop-blur-xl flex items-center justify-center text-emerald-200 shadow-[0_16px_36px_rgba(0,0,0,0.30)]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black truncate drop-shadow-sm">صح أم خطأ</h1>
            <p className="text-[10px] font-bold text-slate-200/90 truncate">تحدي سريع لتثبيت المعلومة ✅❌</p>
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
        <div className="max-w-xl mx-auto min-h-full flex flex-col justify-center py-4">
          {gameState === 'menu' && (
            <section className="rounded-[2rem] border border-white/15 bg-slate-950/72 backdrop-blur-xl p-6 text-center shadow-[0_28px_70px_rgba(0,0,0,0.40)] relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-emerald-300 via-sky-300 to-red-300" />
              <div className="mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-emerald-300 to-sky-500 flex items-center justify-center shadow-[0_20px_42px_rgba(16,185,129,0.32)] mb-4">
                <Zap className="w-10 h-10 text-slate-950" />
              </div>
              <h2 className="text-3xl font-black mb-2">تحدي صح أم خطأ</h2>
              <p className="text-sm font-bold text-slate-200 leading-7 mb-5">
                أجب بسرعة قبل انتهاء الوقت. الإجابات الصحيحة المتتالية تمنحك نقاطًا إضافية.
              </p>

              {!canPlay ? (
                <div className="rounded-2xl bg-yellow-400/15 border border-yellow-300/30 p-4 text-sm font-bold text-yellow-100 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  بانتظار أسئلة صح أم خطأ من المعلم.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full h-14 rounded-2xl bg-gradient-to-l from-emerald-400 to-sky-500 text-slate-950 font-black text-xl shadow-[0_18px_40px_rgba(16,185,129,0.30)] active:scale-95 flex items-center justify-center gap-2"
                >
                  <Play className="w-6 h-6" />
                  ابدأ التحدي
                </button>
              )}
            </section>
          )}

          {(gameState === 'playing' || gameState === 'feedback') && currentQuestion && (
            <section className="space-y-4">
             <div className="grid grid-cols-4 gap-2">
  <div className="rounded-2xl bg-slate-950/90 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
    <p className="text-[9px] font-black text-slate-100 mb-1">
      النقاط
    </p>
    <p className="text-xl font-black text-yellow-300 drop-shadow">
      {score}
    </p>
  </div>

  <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
    <p className="text-[9px] font-black text-slate-100 mb-1">
      السلسلة
    </p>
    <p className="text-xl font-black text-emerald-300 drop-shadow flex items-center justify-center gap-1">
      <Flame className="w-4 h-4" />
      {streak}
    </p>
  </div>

  <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
    <p className="text-[9px] font-black text-slate-100 mb-1">
      الوقت
    </p>
    <p className={`text-xl font-black drop-shadow ${timeColor}`}>
      {timeLeft}
    </p>
  </div>

  <div className="rounded-2xl bg-slate-950/90 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
    <p className="text-[9px] font-black text-slate-100 mb-1">
      محاولات
    </p>
    <p className="text-xl font-black text-red-300 drop-shadow flex items-center justify-center gap-1">
      <Heart className="w-4 h-4" />
      {lives}
    </p>
  </div>
</div>

              <div className="rounded-full bg-slate-950/55 border border-white/15 h-3 overflow-hidden shadow-inner">
                <div className={`h-full bg-gradient-to-l ${timeBarColor} transition-all duration-300`} style={{ width: `${Math.max(4, (timeLeft / QUESTION_SECONDS) * 100)}%` }} />
              </div>

              <div className="rounded-full bg-slate-950/45 border border-white/10 h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-l from-emerald-300 to-sky-300 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>

              <div className="rounded-[2rem] bg-slate-950/72 backdrop-blur-xl border border-white/15 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[10px] font-black text-slate-100 mb-4">
                    <Timer className="w-3.5 h-3.5 text-sky-200" />
                    السؤال {Math.min(questionIndex + 1, questionDeck.length)} من {questionDeck.length}
                  </div>

                  <h2
                    className="text-[clamp(1.05rem,4.6vw,1.55rem)] font-black leading-[1.9] text-white break-words whitespace-pre-wrap max-h-[38dvh] overflow-y-auto px-1 custom-scrollbar"
                    dir="rtl"
                  >
                    {currentQuestion.question}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={gameState !== 'playing'}
                  onClick={() => handleAnswer(0)}
                  className={optionClass(0)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/18 via-transparent to-black/15" />
                  <ShieldCheck className="relative w-10 h-10 text-emerald-100 drop-shadow" />
                  <span className="relative text-2xl font-black drop-shadow">صح</span>
                </button>

                <button
                  type="button"
                  disabled={gameState !== 'playing'}
                  onClick={() => handleAnswer(1)}
                  className={optionClass(1)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/18 via-transparent to-black/15" />
                  <ShieldX className="relative w-10 h-10 text-red-100 drop-shadow" />
                  <span className="relative text-2xl font-black drop-shadow">خطأ</span>
                </button>
              </div>

              {feedback && (
                <div
                  className={`rounded-3xl border p-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)] ${
                    feedback.type === 'correct'
                      ? 'bg-emerald-950/85 border-emerald-300/50'
                      : 'bg-red-950/85 border-red-300/50'
                  }`}
                >
                  <p className={`text-base font-black mb-2 ${feedback.type === 'correct' ? 'text-emerald-200' : 'text-red-200'}`}>
                    {feedback.message}
                  </p>

                  {feedback.explanation && (
                    <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                      <p className="text-[12px] font-bold text-white leading-7 break-words whitespace-pre-wrap">
                        {feedback.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {gameState === 'finished' && (
            <section className="rounded-[2rem] border border-white/15 bg-slate-950/72 backdrop-blur-xl p-6 text-center shadow-[0_28px_70px_rgba(0,0,0,0.40)] relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-yellow-300 via-emerald-300 to-sky-300" />
              <Trophy className="w-16 h-16 mx-auto text-yellow-200 mb-3 drop-shadow" />
              <h2 className="text-3xl font-black mb-2">انتهى التحدي</h2>
              <p className="text-sm font-bold text-slate-200 leading-7 mb-5">
                نتيجتك {score} نقطة. إجابات صحيحة {correct}، وإجابات خاطئة {wrong}. أفضل سلسلة {maxStreak}.
              </p>
              <button
                type="button"
                onClick={resetGame}
                className="w-full h-14 rounded-2xl bg-gradient-to-l from-emerald-400 to-sky-500 text-slate-950 font-black text-xl shadow-[0_18px_40px_rgba(16,185,129,0.30)] active:scale-95 flex items-center justify-center gap-2"
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

export default StudentTrueFalseGame;
