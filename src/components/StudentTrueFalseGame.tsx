import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Trophy,
  Heart,
  Timer,
  Zap,
  Sparkles,
  ShieldCheck,
  ShieldX
} from 'lucide-react';

// =========================================================================
// ✅❌ صح أم خطأ - True / False Challenge
// -------------------------------------------------------------------------
// لعبة بطاقات سريعة:
// - تظهر عبارة تعليمية.
// - الطالب يختار صح أو خطأ.
// - الإجابة الصحيحة تعطي نقاط وسلسلة Streak.
// - الإجابة الخاطئة تخصم محاولة وتُسجل كنقطة ضعف.
// - مؤقت اختياري لكل سؤال لزيادة الحماس.
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

  const canPlay = usableQuestions.length > 0;
  const currentQuestion = questionDeck[questionIndex] || null;
  const progress = questionDeck.length > 0 ? Math.round((questionIndex / questionDeck.length) * 100) : 0;

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
      score,
      correct,
      wrong,
      maxStreak,
      completed,
      weakQuestionIds,
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
    setGameState('finished');
    saveResult(completed);
  };

  const startQuestionTimer = () => {
    clearTimer();
    setTimeLeft(QUESTION_SECONDS);

    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearTimer();
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startGame = () => {
    if (!canPlay) return;
    completedRef.current = false;
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
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState === 'playing') {
      startQuestionTimer();
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, questionIndex]);

  const goNext = (nextLives = lives) => {
    clearTimer();
    window.setTimeout(() => {
      setFeedback(null);
      setLastAnswer(null);

      if (nextLives <= 0) {
        finishGame(false);
        return;
      }

      const nextIndex = questionIndex + 1;
      if (nextIndex >= questionDeck.length) {
        setQuestionIndex(nextIndex);
        finishGame(true);
        return;
      }

      setQuestionIndex(nextIndex);
      setGameState('playing');
    }, 1050);
  };

  const handleTimeout = () => {
    if (gameState !== 'playing' || !currentQuestion) return;
    const nextWrong = wrong + 1;
    const nextLives = lives - 1;

    setWrong(nextWrong);
    setLives(nextLives);
    setStreak(0);
    setWeakQuestionIds(prev => Array.from(new Set([...prev, currentQuestion.id])));
    setFeedback({
      type: 'timeout',
      message: 'انتهى الوقت! اعتُبرت الإجابة خاطئة.',
      explanation: currentQuestion.explanation
    });
    setGameState('feedback');
    goNext(nextLives);
  };

  const handleAnswer = (answerIndex: number) => {
    if (gameState !== 'playing' || !currentQuestion) return;
    clearTimer();

    const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
    const isCorrect = answerIndex === correctIndex;
    setLastAnswer(answerIndex);

    if (isCorrect) {
      const nextStreak = streak + 1;
      const difficultyBonus = currentQuestion.difficulty === 'hard' ? 40 : currentQuestion.difficulty === 'medium' ? 25 : 10;
      const timeBonus = Math.max(0, timeLeft) * 3;
      const streakBonus = Math.min(nextStreak * 12, 72);
      const gained = 100 + difficultyBonus + timeBonus + streakBonus;

      setScore(prev => prev + gained);
      setCorrect(prev => prev + 1);
      setStreak(nextStreak);
      setMaxStreak(prev => Math.max(prev, nextStreak));
      setFeedback({
        type: 'correct',
        message: `إجابة صحيحة! +${gained} نقطة`,
        explanation: currentQuestion.explanation
      });
      setGameState('feedback');
      goNext(lives);
      return;
    }

    const nextLives = lives - 1;
    setWrong(prev => prev + 1);
    setLives(nextLives);
    setStreak(0);
    setWeakQuestionIds(prev => Array.from(new Set([...prev, currentQuestion.id])));
    setFeedback({
      type: 'wrong',
      message: 'إجابة غير صحيحة، اقرأ التفسير وحاول في السؤال القادم.',
      explanation: currentQuestion.explanation
    });
    setGameState('feedback');
    goNext(nextLives);
  };

  const resetGame = () => {
    clearTimer();
    completedRef.current = false;
    setGameState('menu');
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
    const base = 'relative overflow-hidden rounded-[1.7rem] border p-5 min-h-[116px] flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl';

    if (gameState === 'feedback' && currentQuestion) {
      const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
      if (index === correctIndex) {
        return `${base} bg-emerald-500/20 border-emerald-300 text-white ring-4 ring-emerald-300/10`;
      }
      if (lastAnswer === index) {
        return `${base} bg-red-500/20 border-red-300 text-white ring-4 ring-red-300/10`;
      }
    }

    return index === 0
      ? `${base} bg-emerald-500/15 border-emerald-300/35 hover:bg-emerald-500/25 text-white`
      : `${base} bg-red-500/15 border-red-300/35 hover:bg-red-500/25 text-white`;
  };

  const timeColor = timeLeft <= 5 ? 'text-red-300' : timeLeft <= 10 ? 'text-yellow-300' : 'text-sky-300';

  return (
    <div className="fixed inset-0 z-[2147483647] bg-slate-950 text-white overflow-hidden" dir="rtl">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-red-500/10 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 20px 20px, white 1px, transparent 0)', backgroundSize: '38px 38px' }} />

      <header className="relative z-20 pt-[max(env(safe-area-inset-top),14px)] px-4 pb-3 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-emerald-300 shadow-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black truncate">صح أم خطأ</h1>
            <p className="text-[10px] font-bold text-slate-300 truncate">تحدي سريع لتثبيت المعلومة ✅❌</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 shadow-xl"
          aria-label="إغلاق اللعبة"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <main className="relative z-10 h-[calc(100dvh-78px)] overflow-y-auto overscroll-contain custom-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom)+122px)]">
        <div className="max-w-xl mx-auto min-h-full flex flex-col justify-center py-4">
          {gameState === 'menu' && (
            <section className="rounded-[2rem] border border-white/10 bg-white/10 backdrop-blur-xl p-6 text-center shadow-2xl">
              <div className="mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center shadow-2xl mb-4">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black mb-2">تحدي صح أم خطأ</h2>
              <p className="text-sm font-bold text-slate-300 leading-7 mb-5">
                أجب بسرعة قبل انتهاء الوقت. الإجابات الصحيحة المتتالية تمنحك نقاطًا إضافية.
              </p>

              {!canPlay ? (
                <div className="rounded-2xl bg-yellow-400/10 border border-yellow-300/20 p-4 text-sm font-bold text-yellow-100">
                  بانتظار أسئلة صح أم خطأ من المعلم.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full h-14 rounded-2xl bg-gradient-to-l from-emerald-400 to-sky-500 text-white font-black text-lg shadow-[0_16px_32px_rgba(16,185,129,0.28)] active:scale-95 flex items-center justify-center gap-2"
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
                <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 text-center shadow-lg">
                  <p className="text-[8px] font-bold text-slate-300">النقاط</p>
                  <p className="text-base font-black text-yellow-300">{score}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 text-center shadow-lg">
                  <p className="text-[8px] font-bold text-slate-300">السلسلة</p>
                  <p className="text-base font-black text-emerald-300">{streak}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 text-center shadow-lg">
                  <p className="text-[8px] font-bold text-slate-300">الوقت</p>
                  <p className={`text-base font-black ${timeColor}`}>{timeLeft}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 text-center shadow-lg">
                  <p className="text-[8px] font-bold text-slate-300">محاولات</p>
                  <p className="text-base font-black text-red-300 flex items-center justify-center gap-1"><Heart className="w-4 h-4" />{lives}</p>
                </div>
              </div>

              <div className="rounded-full bg-white/10 border border-white/10 h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-l from-emerald-400 to-sky-400 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>

              <div className="rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/10 p-5 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/40 border border-white/10 px-3 py-1 text-[10px] font-black text-slate-200 mb-4">
                    <Timer className="w-3.5 h-3.5 text-sky-300" />
                    السؤال {Math.min(questionIndex + 1, questionDeck.length)} من {questionDeck.length}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black leading-9 text-white">
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
                  <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10" />
                  <ShieldCheck className="relative w-10 h-10 text-emerald-200" />
                  <span className="relative text-2xl font-black">صح</span>
                </button>

                <button
                  type="button"
                  disabled={gameState !== 'playing'}
                  onClick={() => handleAnswer(1)}
                  className={optionClass(1)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10" />
                  <ShieldX className="relative w-10 h-10 text-red-200" />
                  <span className="relative text-2xl font-black">خطأ</span>
                </button>
              </div>

              {feedback && (
                <div className={`rounded-3xl border p-4 shadow-2xl ${feedback.type === 'correct' ? 'bg-emerald-500/15 border-emerald-300/30' : 'bg-red-500/15 border-red-300/30'}`}>
                  <p className={`text-base font-black mb-1 ${feedback.type === 'correct' ? 'text-emerald-200' : 'text-red-200'}`}>{feedback.message}</p>
                  {feedback.explanation && <p className="text-xs font-bold text-slate-300 leading-6">{feedback.explanation}</p>}
                </div>
              )}
            </section>
          )}

          {gameState === 'finished' && (
            <section className="rounded-[2rem] border border-white/10 bg-white/10 backdrop-blur-xl p-6 text-center shadow-2xl">
              <Trophy className="w-16 h-16 mx-auto text-yellow-300 mb-3" />
              <h2 className="text-3xl font-black mb-2">انتهى التحدي</h2>
              <p className="text-sm font-bold text-slate-300 leading-7 mb-5">
                نتيجتك {score} نقطة. إجابات صحيحة {correct}، وإجابات خاطئة {wrong}. أفضل سلسلة {maxStreak}.
              </p>
              <button
                type="button"
                onClick={resetGame}
                className="w-full h-14 rounded-2xl bg-gradient-to-l from-emerald-400 to-sky-500 text-white font-black text-lg shadow-[0_16px_32px_rgba(16,185,129,0.28)] active:scale-95 flex items-center justify-center gap-2"
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
