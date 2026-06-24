import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Play,
  RotateCcw,
  Trophy,
  Heart,
  Volume2,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TimerReset,
  GripVertical,
  Zap
} from 'lucide-react';

// =========================================================================
// 📚 رتّب الأحداث - Sequence Order Game
// -------------------------------------------------------------------------
// مصمم حسب صيغة راصد المعلم الحالية:
// questionType: 'sequence'
// gameTypes: ['sequence']
// sequence: ['العنصر الأول', 'العنصر الثاني', 'العنصر الثالث']
// -------------------------------------------------------------------------
// ملاحظات تصميمية:
// - لا نعتمد على options لأن بياناتك تجعلها فارغة.
// - لا نعتمد على drag/drop فقط حتى لا تحدث مشاكل لمس في الجوال.
// - الترتيب يتم بأزرار أعلى/أسفل واضحة.
// - واجهة عالية التباين مثل النسخ المحسنة السابقة.
// =========================================================================

export interface SequenceOrderQuestion {
  id: string;
  subject?: string;
  unit?: string;
  lesson?: string;
  questionType?: 'sequence';
  question?: string;
  options?: string[];
  sequence?: string[];
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  active?: boolean;
}

export interface SequenceOrderResult {
  gameType: 'sequence_order';
  score: number;
  correct: number;
  wrong: number;
  completed: boolean;
  weakQuestionIds: string[];
  playedAt: string;
}

interface StudentSequenceOrderGameProps {
  questions: SequenceOrderQuestion[];
  studentId?: string;
  onClose: () => void;
  onComplete?: (result: SequenceOrderResult) => void;
}

type GameState = 'menu' | 'playing' | 'feedback' | 'finished';
type FeedbackState = {
  type: 'correct' | 'wrong';
  message: string;
  explanation?: string;
} | null;

type SequenceRound = {
  id: string;
  question: string;
  correctSequence: string[];
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
};

type SfxType = 'start' | 'correct' | 'wrong' | 'finish' | 'move';

const MAX_LIVES = 4;
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
      gain.gain.exponentialRampToValueAtTime(volume, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      oscillator.start(now + startOffset);
      oscillator.stop(now + startOffset + duration + 0.02);
    };

    if (type === 'correct') {
      tone(520, 880, 0.16, 'sine', 0.14);
      tone(760, 1040, 0.16, 'triangle', 0.09, 0.08);
    } else if (type === 'wrong') {
      tone(240, 130, 0.22, 'square', 0.11);
    } else if (type === 'start') {
      tone(360, 620, 0.16, 'triangle', 0.11);
    } else if (type === 'finish') {
      tone(440, 660, 0.16, 'sine', 0.11);
      tone(660, 990, 0.18, 'triangle', 0.09, 0.10);
    } else if (type === 'move') {
      tone(420, 500, 0.06, 'triangle', 0.045);
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

const buildRounds = (questions: SequenceOrderQuestion[]): SequenceRound[] => {
  return (Array.isArray(questions) ? questions : [])
    .filter(question => question && question.active !== false)
    .map((question, index) => {
      const correctSequence = (question.sequence || [])
        .map(item => cleanText(item))
        .filter(Boolean);

      return {
        id: question.id || `sequence_${index}`,
        question: cleanText(question.question) || 'رتّب العناصر التالية ترتيبًا صحيحًا',
        correctSequence,
        explanation: question.explanation,
        difficulty: question.difficulty
      };
    })
    .filter(round => round.correctSequence.length >= 2);
};

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => cleanText(value) === cleanText(b[index]));
};

const StudentSequenceOrderGame: React.FC<StudentSequenceOrderGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const rounds = useMemo(() => buildRounds(questions), [questions]);
  const roundDeck = useMemo(() => shuffleArray(rounds), [rounds]);

  const completedRef = useRef(false);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const weakIdsRef = useRef<string[]>([]);

  const [gameState, setGameState] = useState<GameState>('menu');
  const [roundIndex, setRoundIndex] = useState(0);
  const [currentOrder, setCurrentOrder] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wrongFlash, setWrongFlash] = useState(false);

  const canPlay = roundDeck.length > 0;
  const currentRound = roundDeck[roundIndex] || null;
  const progress = roundDeck.length > 0 ? Math.round((roundIndex / roundDeck.length) * 100) : 0;

  const saveResult = (completed: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;

    const result: SequenceOrderResult = {
      gameType: 'sequence_order',
      score: scoreRef.current,
      correct: correctRef.current,
      wrong: wrongRef.current,
      completed,
      weakQuestionIds: weakIdsRef.current,
      playedAt: new Date().toISOString()
    };

    try {
      const key = `rased_student_game_stats_${studentId || 'default'}`;
      const oldStats = JSON.parse(localStorage.getItem(key) || '{}');
      const attempts = Number(oldStats.sequenceOrderAttempts || 0) + 1;
      const bestScore = Math.max(Number(oldStats.sequenceOrderBestScore || 0), result.score);

      localStorage.setItem(
        key,
        JSON.stringify({
          ...oldStats,
          sequenceOrderBestScore: bestScore,
          sequenceOrderLastScore: result.score,
          sequenceOrderAttempts: attempts,
          lastPlayedDate: getTodayKey(),
          lastGameType: 'sequence_order'
        })
      );

      const resultKey = `rased_game_results_${studentId || 'default'}`;
      const oldResults = JSON.parse(localStorage.getItem(resultKey) || '[]');
      oldResults.unshift(result);
      localStorage.setItem(resultKey, JSON.stringify(oldResults.slice(0, 30)));
    } catch (error) {
      console.error('Failed to save sequence order result', error);
    }

    onComplete?.(result);
  };

  const finishGame = (completed: boolean) => {
    playSfx('finish', soundEnabled);
    setGameState('finished');
    saveResult(completed);
  };

  const loadRound = (index: number) => {
    const round = roundDeck[index];
    if (!round) return;

    let shuffled = shuffleArray(round.correctSequence);
    // إذا عاد الخلط بنفس الترتيب، نعكسه حتى يشعر الطالب بوجود تحدٍ.
    if (arraysEqual(shuffled, round.correctSequence) && shuffled.length > 1) {
      shuffled = [...shuffled].reverse();
    }

    setCurrentOrder(shuffled);
    setFeedback(null);
    setWrongFlash(false);
  };

  const startGame = () => {
    if (!canPlay) return;
    completedRef.current = false;
    scoreRef.current = 0;
    correctRef.current = 0;
    wrongRef.current = 0;
    weakIdsRef.current = [];

    setRoundIndex(0);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setLives(MAX_LIVES);
    setFeedback(null);
    setWeakQuestionIds([]);
    playSfx('start', soundEnabled);
    setGameState('playing');
    loadRound(0);
  };

  const resetGame = () => {
    completedRef.current = false;
    scoreRef.current = 0;
    correctRef.current = 0;
    wrongRef.current = 0;
    weakIdsRef.current = [];

    setGameState('menu');
    setRoundIndex(0);
    setCurrentOrder([]);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setLives(MAX_LIVES);
    setFeedback(null);
    setWeakQuestionIds([]);
    setWrongFlash(false);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    if (gameState !== 'playing') return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= currentOrder.length) return;

    const copy = [...currentOrder];
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
    setCurrentOrder(copy);
    setWrongFlash(false);
    playSfx('move', soundEnabled);
  };

  const goNextRound = (nextLives = lives) => {
    window.setTimeout(() => {
      setFeedback(null);
      setWrongFlash(false);

      if (nextLives <= 0) {
        finishGame(false);
        return;
      }

      const nextRoundIndex = roundIndex + 1;
      if (nextRoundIndex >= roundDeck.length) {
        setRoundIndex(nextRoundIndex);
        finishGame(true);
        return;
      }

      setRoundIndex(nextRoundIndex);
      loadRound(nextRoundIndex);
      setGameState('playing');
    }, 1250);
  };

  const checkAnswer = () => {
    if (!currentRound || gameState !== 'playing') return;
    const ok = arraysEqual(currentOrder, currentRound.correctSequence);

    if (ok) {
      const difficultyBonus = currentRound.difficulty === 'hard' ? 60 : currentRound.difficulty === 'medium' ? 35 : 15;
      const gained = 160 + difficultyBonus + Math.max(0, lives) * 12;
      const nextScore = scoreRef.current + gained;
      const nextCorrect = correctRef.current + 1;

      scoreRef.current = nextScore;
      correctRef.current = nextCorrect;
      setScore(nextScore);
      setCorrect(nextCorrect);
      setFeedback({
        type: 'correct',
        message: `ترتيب صحيح! +${gained} نقطة`,
        explanation: currentRound.explanation
      });
      playSfx('correct', soundEnabled);
      setGameState('feedback');
      goNextRound(lives);
      return;
    }

    const nextWrong = wrongRef.current + 1;
    const nextLives = lives - 1;
    const nextWeakIds = Array.from(new Set([...weakIdsRef.current, currentRound.id]));

    wrongRef.current = nextWrong;
    weakIdsRef.current = nextWeakIds;
    setWrong(nextWrong);
    setLives(nextLives);
    setWeakQuestionIds(nextWeakIds);
    setWrongFlash(true);
    setFeedback({
      type: 'wrong',
      message: 'الترتيب غير صحيح. حاول ملاحظة تسلسل الأحداث من الأول إلى الأخير.',
      explanation: currentRound.explanation
    });
    playSfx('wrong', soundEnabled);
    setGameState('feedback');
    goNextRound(nextLives);
  };

  const revealCorrectOrder = () => {
    if (!currentRound || gameState !== 'playing') return;
    setCurrentOrder(currentRound.correctSequence);
    setWrongFlash(false);
    playSfx('move', soundEnabled);
  };

  return (
    <div className="fixed inset-0 z-[2147483647] text-white overflow-hidden font-['Tajawal']" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#a78bfa_0%,transparent_30%),radial-gradient(circle_at_bottom_left,#38bdf8_0%,transparent_30%),linear-gradient(135deg,#0f172a_0%,#312e81_46%,#082f49_100%)]" />
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
          <div className="w-11 h-11 rounded-2xl bg-slate-950/60 border border-white/15 backdrop-blur-xl flex items-center justify-center text-violet-200 shadow-[0_16px_36px_rgba(0,0,0,0.30)]">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black truncate drop-shadow-sm">رتّب الأحداث</h1>
            <p className="text-[10px] font-bold text-slate-200/90 truncate">رتّب العناصر من الأول إلى الأخير 📚</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`w-10 h-10 rounded-2xl border backdrop-blur-xl flex items-center justify-center active:scale-95 shadow-[0_16px_36px_rgba(0,0,0,0.26)] ${soundEnabled ? 'bg-sky-500/20 border-sky-200/30 text-sky-100' : 'bg-slate-950/55 border-white/15 text-slate-300'}`}
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
        <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-center py-4">
          {gameState === 'menu' && (
            <section className="rounded-[2rem] border border-white/15 bg-slate-950/72 backdrop-blur-xl p-6 text-center shadow-[0_28px_70px_rgba(0,0,0,0.40)] relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-violet-300 via-sky-300 to-emerald-300" />
              <div className="mx-auto w-20 h-20 rounded-[2rem] bg-gradient-to-br from-violet-300 to-sky-400 flex items-center justify-center shadow-[0_20px_42px_rgba(125,92,255,0.32)] mb-4">
                <Zap className="w-10 h-10 text-slate-950" />
              </div>
              <h2 className="text-3xl font-black mb-2">تحدي ترتيب الأحداث</h2>
              <p className="text-sm font-bold text-slate-200 leading-7 mb-5">
                اقرأ السؤال، ثم رتّب البطاقات باستخدام أزرار أعلى وأسفل. بعد ذلك اضغط تحقق.
              </p>

              {!canPlay ? (
                <div className="rounded-2xl bg-yellow-400/15 border border-yellow-300/30 p-4 text-sm font-bold text-yellow-100 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  تحتاج اللعبة إلى سؤال يحتوي على sequence بعنصرين على الأقل.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full h-14 rounded-2xl bg-gradient-to-l from-violet-300 to-sky-400 text-slate-950 font-black text-lg shadow-[0_18px_40px_rgba(125,92,255,0.30)] active:scale-95 flex items-center justify-center gap-2"
                >
                  <Play className="w-6 h-6" />
                  ابدأ الترتيب
                </button>
              )}
            </section>
          )}

          {(gameState === 'playing' || gameState === 'feedback') && currentRound && (
            <section className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
                  <p className="text-[9px] font-black text-slate-100 mb-1">النقاط</p>
                  <p className="text-lg font-black text-yellow-300 drop-shadow">{score}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-xl p-2.5 text-center shadow-[0_14px_32px_rgba(0,0,0,0.35)]">
                  <p className="text-[9px] font-black text-slate-100 mb-1">صحيح</p>
                  <p className="text-lg font-black text-emerald-300 drop-shadow">{correct}</p>
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
                <div className="h-full bg-gradient-to-l from-violet-300 to-sky-300 transition-all duration-300" style={{ width: `${Math.max(4, progress)}%` }} />
              </div>

              <div className="rounded-[2rem] bg-slate-950/72 backdrop-blur-xl border border-white/15 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-violet-400/10 blur-3xl" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[10px] font-black text-slate-100 mb-4">
                    <TimerReset className="w-3.5 h-3.5 text-sky-200" />
                    السؤال {Math.min(roundIndex + 1, roundDeck.length)} من {roundDeck.length}
                  </div>
                  <h2 className="text-[clamp(1rem,4.4vw,1.42rem)] font-black leading-[1.9] text-white break-words whitespace-pre-wrap max-h-[24dvh] overflow-y-auto px-1 custom-scrollbar" dir="rtl">
                    {currentRound.question}
                  </h2>
                </div>
              </div>

              <div className={`rounded-[1.8rem] bg-slate-950/62 border ${wrongFlash ? 'border-red-300/70' : 'border-violet-200/20'} backdrop-blur-xl p-3 shadow-[0_22px_54px_rgba(0,0,0,0.34)] transition-colors`}>
                <div className="flex items-center justify-between px-2 mb-3">
                  <h3 className="text-sm font-black text-violet-100 flex items-center gap-2"><GripVertical className="w-4 h-4" />الترتيب الحالي</h3>
                  <button
                    type="button"
                    disabled={gameState !== 'playing'}
                    onClick={revealCorrectOrder}
                    className="text-[10px] font-black text-sky-100 bg-sky-400/15 border border-sky-200/25 rounded-full px-3 py-1 active:scale-95 disabled:opacity-50"
                  >
                    عرض الترتيب
                  </button>
                </div>

                <div className="space-y-2.5">
                  {currentOrder.map((item, index) => (
                    <div
                      key={`${item}_${index}`}
                      className="relative rounded-[1.35rem] border border-white/15 bg-gradient-to-br from-violet-500/24 to-slate-950/72 p-3.5 shadow-[0_16px_34px_rgba(0,0,0,0.28)] overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/16" />
                      <div className="relative z-10 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-950/55 border border-white/15 flex items-center justify-center shrink-0 font-black text-sky-100">
                          {index + 1}
                        </div>
                        <p className="flex-1 text-[clamp(0.82rem,3.4vw,1rem)] font-black leading-7 text-white break-words whitespace-pre-wrap text-start">
                          {item}
                        </p>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={gameState !== 'playing' || index === 0}
                            onClick={() => moveItem(index, -1)}
                            className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center active:scale-95 disabled:opacity-35"
                            aria-label="رفع العنصر"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={gameState !== 'playing' || index === currentOrder.length - 1}
                            onClick={() => moveItem(index, 1)}
                            className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center active:scale-95 disabled:opacity-35"
                            aria-label="إنزال العنصر"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {feedback && (
                <div className={`rounded-3xl border p-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)] ${feedback.type === 'correct' ? 'bg-emerald-950/85 border-emerald-300/50' : 'bg-red-950/85 border-red-300/50'}`}>
                  <p className={`text-base font-black mb-2 ${feedback.type === 'correct' ? 'text-emerald-200' : 'text-red-200'}`}>{feedback.message}</p>
                  {feedback.explanation && (
                    <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                      <p className="text-[12px] font-bold text-white leading-7 break-words whitespace-pre-wrap">{feedback.explanation}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={gameState !== 'playing'}
                onClick={checkAnswer}
                className="w-full h-14 rounded-2xl bg-gradient-to-l from-violet-300 to-sky-400 text-slate-950 font-black text-lg shadow-[0_18px_40px_rgba(125,92,255,0.30)] active:scale-95 disabled:opacity-55 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-6 h-6" />
                تحقق من الترتيب
              </button>
            </section>
          )}

          {gameState === 'finished' && (
            <section className="rounded-[2rem] border border-white/15 bg-slate-950/72 backdrop-blur-xl p-6 text-center shadow-[0_28px_70px_rgba(0,0,0,0.40)] relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-yellow-300 via-violet-300 to-sky-300" />
              <Trophy className="w-16 h-16 mx-auto text-yellow-200 mb-3 drop-shadow" />
              <h2 className="text-3xl font-black mb-2">انتهى التحدي</h2>
              <p className="text-sm font-bold text-slate-200 leading-7 mb-5">
                نتيجتك {score} نقطة. إجابات صحيحة {correct}، وأخطاء {wrong}.
              </p>
              <button
                type="button"
                onClick={resetGame}
                className="w-full h-14 rounded-2xl bg-gradient-to-l from-violet-300 to-sky-400 text-slate-950 font-black text-lg shadow-[0_18px_40px_rgba(125,92,255,0.30)] active:scale-95 flex items-center justify-center gap-2"
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

export default StudentSequenceOrderGame;
