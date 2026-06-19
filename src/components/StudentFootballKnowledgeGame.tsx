import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Trophy,
  Goal,
  Play,
  RotateCcw,
  Heart,
  Star,
  Zap
} from 'lucide-react';

// =========================================================================
// ⚽ ركلات المعرفة - لعبة ركلات جزاء تعليمية احترافية Canvas 2D
// -------------------------------------------------------------------------
// الفكرة:
// - يظهر سؤال قبل كل ركلة.
// - يختار الطالب الإجابة.
// - الإجابة الصحيحة تفتح التصويب.
// - يختار الطالب زاوية التسديد.
// - إذا كانت الإجابة صحيحة: تسديدة قوية واحتمال هدف مرتفع.
// - إذا كانت الإجابة خاطئة: الحارس يصد الكرة غالبًا وتُسجل كنقطة ضعف.
// =========================================================================

export interface FootballKnowledgeQuestion {
  id: string;
  subject?: string;
  unit?: string;
  lesson?: string;
  questionType?: 'multiple_choice' | 'true_false';
  question: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  active?: boolean;
}

export interface FootballKnowledgeResult {
  gameType: 'football_quiz';
  score: number;
  goals: number;
  saves: number;
  correct: number;
  wrong: number;
  completed: boolean;
  weakQuestionIds: string[];
  playedAt: string;
}

interface StudentFootballKnowledgeGameProps {
  questions: FootballKnowledgeQuestion[];
  studentId?: string;
  onClose: () => void;
  onComplete?: (result: FootballKnowledgeResult) => void;
}

type GameState = 'menu' | 'question' | 'aim' | 'shooting' | 'result' | 'finished';
type FeedbackState = {
  type: 'correct' | 'wrong' | 'goal' | 'save';
  message: string;
  explanation?: string;
} | null;

type BallState = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  moving: boolean;
  trail: Array<{ x: number; y: number; alpha: number }>;
};

type KeeperState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  diving: boolean;
};

type ShotZone = {
  id: string;
  label: string;
  xRatio: number;
  yRatio: number;
};

const SHOT_ZONES: ShotZone[] = [
  { id: 'top_left', label: 'يسار أعلى', xRatio: 0.24, yRatio: 0.34 },
  { id: 'top_center', label: 'وسط أعلى', xRatio: 0.50, yRatio: 0.30 },
  { id: 'top_right', label: 'يمين أعلى', xRatio: 0.76, yRatio: 0.34 },
  { id: 'bottom_left', label: 'يسار أسفل', xRatio: 0.25, yRatio: 0.62 },
  { id: 'bottom_center', label: 'وسط أسفل', xRatio: 0.50, yRatio: 0.64 },
  { id: 'bottom_right', label: 'يمين أسفل', xRatio: 0.75, yRatio: 0.62 }
];

const MAX_LIVES = 3;
const getTodayKey = () => new Date().toLocaleDateString('en-CA');
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeQuestions = (questions: FootballKnowledgeQuestion[]) => {
  return (Array.isArray(questions) ? questions : []).filter(q => {
    if (!q || q.active === false) return false;
    if (!q.question) return false;
    if (q.questionType === 'true_false') return true;
    const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
    const hasAnswer = typeof q.correctAnswerIndex === 'number';
    return hasOptions && hasAnswer;
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

const StudentFootballKnowledgeGame: React.FC<StudentFootballKnowledgeGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const usableQuestions = useMemo(() => normalizeQuestions(questions), [questions]);
  const questionDeck = useMemo(() => shuffleArray(usableQuestions), [usableQuestions]);

  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [goals, setGoals] = useState(0);
  const [saves, setSaves] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<FootballKnowledgeQuestion | null>(null);
  const [answerWasCorrect, setAnswerWasCorrect] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<ShotZone | null>(null);

  const dimensionsRef = useRef({ width: 800, height: 900 });
  const ballRef = useRef<BallState>({ x: 400, y: 760, r: 13, vx: 0, vy: 0, moving: false, trail: [] });
  const keeperRef = useRef<KeeperState>({ x: 400, y: 270, targetX: 400, targetY: 270, diving: false });
  const netPulseRef = useRef(0);
  const shakeRef = useRef(0);
  const completedRef = useRef(false);

  const canPlay = usableQuestions.length > 0;

  const pickQuestion = (index = questionIndex) => {
    if (questionDeck.length === 0) return null;
    return questionDeck[index % questionDeck.length];
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(420, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dimensionsRef.current = { width, height };
    resetBallAndKeeper(false);
  };

  const goalRect = () => {
    const { width, height } = dimensionsRef.current;
    const goalW = clamp(width * 0.76, 260, 520);
    const goalH = clamp(height * 0.22, 100, 170);
    const x = (width - goalW) / 2;
    const y = clamp(height * 0.12, 64, 110);
    return { x, y, w: goalW, h: goalH };
  };

  const ballStart = () => {
    const { width, height } = dimensionsRef.current;
    return { x: width / 2, y: height - clamp(height * 0.16, 110, 150) };
  };

  const resetBallAndKeeper = (keepZone = true) => {
    const { width } = dimensionsRef.current;
    const start = ballStart();
    const goal = goalRect();

    ballRef.current = {
      x: start.x,
      y: start.y,
      r: 13,
      vx: 0,
      vy: 0,
      moving: false,
      trail: []
    };

    keeperRef.current = {
      x: width / 2,
      y: goal.y + goal.h * 0.58,
      targetX: width / 2,
      targetY: goal.y + goal.h * 0.58,
      diving: false
    };

    netPulseRef.current = 0;
    shakeRef.current = 0;
    if (!keepZone) setSelectedZone(null);
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const finishGame = (completed: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;
    setGameState('finished');

    const result: FootballKnowledgeResult = {
      gameType: 'football_quiz',
      score,
      goals,
      saves,
      correct,
      wrong,
      completed,
      weakQuestionIds,
      playedAt: new Date().toISOString()
    };

    try {
      const key = `rased_student_game_stats_${studentId || 'default'}`;
      const oldStats = JSON.parse(localStorage.getItem(key) || '{}');
      const attempts = Number(oldStats.footballAttempts || 0) + 1;
      const bestScore = Math.max(Number(oldStats.footballBestScore || 0), result.score);

      localStorage.setItem(
        key,
        JSON.stringify({
          ...oldStats,
          footballBestScore: bestScore,
          footballLastScore: result.score,
          footballAttempts: attempts,
          lastPlayedDate: getTodayKey(),
          lastGameType: 'football_quiz'
        })
      );

      const resultKey = `rased_game_results_${studentId || 'default'}`;
      const oldResults = JSON.parse(localStorage.getItem(resultKey) || '[]');
      oldResults.unshift(result);
      localStorage.setItem(resultKey, JSON.stringify(oldResults.slice(0, 30)));
    } catch (error) {
      console.error('Failed to save football knowledge result', error);
    }

    onComplete?.(result);
  };

  const startGame = () => {
    if (!canPlay) return;
    completedRef.current = false;
    setScore(0);
    setGoals(0);
    setSaves(0);
    setCorrect(0);
    setWrong(0);
    setLives(MAX_LIVES);
    setQuestionIndex(0);
    setWeakQuestionIds([]);
    setFeedback(null);
    setSelectedZone(null);
    resetBallAndKeeper(false);
    const first = pickQuestion(0);
    setCurrentQuestion(first);
    setGameState('question');
  };

  const nextRound = () => {
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setFeedback(null);
    setSelectedZone(null);
    resetBallAndKeeper(false);

    if (nextIndex >= questionDeck.length || lives <= 0) {
      finishGame(nextIndex >= questionDeck.length && lives > 0);
      return;
    }

    setCurrentQuestion(pickQuestion(nextIndex));
    setGameState('question');
  };

  const handleAnswer = (answerIndex: number) => {
    if (!currentQuestion || feedback) return;

    const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
    const ok = answerIndex === correctIndex;
    setAnswerWasCorrect(ok);

    if (ok) {
      setCorrect(prev => prev + 1);
      setScore(prev => prev + 120);
      setFeedback({
        type: 'correct',
        message: 'إجابة صحيحة! اختر زاوية التسديد الآن.',
        explanation: currentQuestion.explanation
      });
      window.setTimeout(() => {
        setFeedback(null);
        setGameState('aim');
      }, 850);
      return;
    }

    setWrong(prev => prev + 1);
    setLives(prev => Math.max(0, prev - 1));
    setWeakQuestionIds(prev => Array.from(new Set([...prev, currentQuestion.id])));
    setFeedback({
      type: 'wrong',
      message: 'إجابة خاطئة! ستسدد ركلة ضعيفة والحارس مستعد.',
      explanation: currentQuestion.explanation
    });

    window.setTimeout(() => {
      setFeedback(null);
      setGameState('aim');
    }, 1050);
  };

  const shootToZone = (zone: ShotZone) => {
    if (gameState !== 'aim') return;

    const goal = goalRect();
    const ball = ballRef.current;
    const targetX = goal.x + goal.w * zone.xRatio;
    const targetY = goal.y + goal.h * zone.yRatio;

    setSelectedZone(zone);
    setGameState('shooting');

    const dx = targetX - ball.x;
    const dy = targetY - ball.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const speed = answerWasCorrect ? 22 : 16;

    ball.vx = (dx / distance) * speed;
    ball.vy = (dy / distance) * speed;
    ball.moving = true;

    const keeperGuess = answerWasCorrect
      ? SHOT_ZONES[Math.floor(Math.random() * SHOT_ZONES.length)]
      : zone;

    keeperRef.current.targetX = goal.x + goal.w * keeperGuess.xRatio;
    keeperRef.current.targetY = goal.y + goal.h * keeperGuess.yRatio;
    keeperRef.current.diving = true;
  };

  const resolveShot = (goalScored: boolean) => {
    const wasCorrect = answerWasCorrect;
    ballRef.current.moving = false;

    if (goalScored) {
      netPulseRef.current = 1;
      setGoals(prev => prev + 1);
      setScore(prev => prev + (wasCorrect ? 180 : 80));
      setFeedback({ type: 'goal', message: wasCorrect ? 'هدف رائع! تسديدة معرفية قوية.' : 'هدف بصعوبة رغم الإجابة الخاطئة.' });
    } else {
      shakeRef.current = 8;
      setSaves(prev => prev + 1);
      setFeedback({ type: 'save', message: 'الحارس تصدى للكرة! حاول في الركلة القادمة.' });
    }

    setGameState('result');
    window.setTimeout(nextRound, 1500);
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const drawField = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current;
    const grass = ctx.createLinearGradient(0, 0, 0, height);
    grass.addColorStop(0, '#16a34a');
    grass.addColorStop(1, '#166534');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < height; y += 52) {
      ctx.fillStyle = y % 104 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
      ctx.fillRect(0, y, width, 52);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.66, clamp(width * 0.21, 70, 125), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(width / 2, ballStart().y + 4, 6, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawGoal = (ctx: CanvasRenderingContext2D) => {
    const goal = goalRect();

    ctx.save();
    ctx.shadowBlur = netPulseRef.current * 28;
    ctx.shadowColor = '#facc15';

    ctx.fillStyle = 'rgba(15,23,42,0.34)';
    drawRoundedRect(ctx, goal.x - 12, goal.y + 12, goal.w + 24, goal.h + 22, 18);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    drawRoundedRect(ctx, goal.x, goal.y, goal.w, goal.h, 18);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    drawRoundedRect(ctx, goal.x, goal.y, goal.w, goal.h, 18);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    for (let x = goal.x + 20; x < goal.x + goal.w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, goal.y + 7);
      ctx.lineTo(x - 20, goal.y + goal.h - 4);
      ctx.stroke();
    }
    for (let y = goal.y + 18; y < goal.y + goal.h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(goal.x + 8, y);
      ctx.lineTo(goal.x + goal.w - 8, y);
      ctx.stroke();
    }

    ctx.restore();

    if (netPulseRef.current > 0) netPulseRef.current *= 0.88;
  };

  const drawKeeper = (ctx: CanvasRenderingContext2D, delta: number) => {
    const keeper = keeperRef.current;
    const easing = keeper.diving ? 0.09 : 0.06;
    keeper.x += (keeper.targetX - keeper.x) * easing * (delta / 16.67);
    keeper.y += (keeper.targetY - keeper.y) * easing * (delta / 16.67);

    ctx.save();
    ctx.translate(keeper.x, keeper.y);

    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 34, 42, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0ea5e9';
    drawRoundedRect(ctx, -24, -30, 48, 58, 16);
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(0, -42, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, -10);
    ctx.lineTo(-48, keeper.diving ? -28 : 8);
    ctx.moveTo(22, -10);
    ctx.lineTo(48, keeper.diving ? -28 : 8);
    ctx.stroke();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-12, 24);
    ctx.lineTo(-26, 48);
    ctx.moveTo(12, 24);
    ctx.lineTo(26, 48);
    ctx.stroke();

    ctx.restore();
  };

  const drawBall = (ctx: CanvasRenderingContext2D, delta: number) => {
    const ball = ballRef.current;
    const keeper = keeperRef.current;
    const goal = goalRect();

    if (ball.moving) {
      ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 0.8 });
      ball.trail = ball.trail.slice(0, 10).map(p => ({ ...p, alpha: p.alpha * 0.78 }));
      ball.x += ball.vx * (delta / 16.67);
      ball.y += ball.vy * (delta / 16.67);
      ball.r = Math.max(8, ball.r * 0.992);

      const keeperDistance = Math.hypot(ball.x - keeper.x, ball.y - keeper.y);
      const reachedGoal = ball.y <= goal.y + goal.h * 0.72;
      const inGoal = ball.x > goal.x + 10 && ball.x < goal.x + goal.w - 10 && ball.y > goal.y && ball.y < goal.y + goal.h;
      const saved = keeperDistance < 42 && ball.y < goal.y + goal.h + 28;

      if (saved) {
        resolveShot(false);
      } else if (reachedGoal) {
        resolveShot(inGoal);
      }
    }

    ball.trail.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(p.x, p.y, ball.r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(4, 12, ball.r * 1.3, ball.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(0, 0, ball.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * ball.r * 0.35, Math.sin(a) * ball.r * 0.35);
      ctx.lineTo(Math.cos(a) * ball.r * 0.92, Math.sin(a) * ball.r * 0.92);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawAimZones = (ctx: CanvasRenderingContext2D) => {
    if (gameState !== 'aim') return;

    const goal = goalRect();
    SHOT_ZONES.forEach(zone => {
      const x = goal.x + goal.w * zone.xRatio;
      const y = goal.y + goal.h * zone.yRatio;
      const active = selectedZone?.id === zone.id;

      ctx.fillStyle = active ? 'rgba(250,204,21,0.32)' : 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = active ? '#facc15' : 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  };

  const drawFrame = (delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensionsRef.current;
    const sx = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
    const sy = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
    if (shakeRef.current > 0) shakeRef.current *= 0.82;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(sx, sy);
    drawField(ctx);
    drawGoal(ctx);
    drawAimZones(ctx);
    drawKeeper(ctx, delta);
    drawBall(ctx, delta);
    ctx.restore();
  };

  useEffect(() => {
    const loop = (time: number) => {
      const last = lastFrameRef.current || time;
      const delta = clamp(time - last, 0, 34);
      lastFrameRef.current = time;
      drawFrame(delta);
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, selectedZone, feedback]);

  const questionOptions = currentQuestion?.questionType === 'true_false'
    ? ['صح', 'خطأ']
    : currentQuestion?.options || [];

  const handleCanvasClick = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'aim') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const goal = goalRect();

    const nearest = SHOT_ZONES.reduce((best, zone) => {
      const zx = goal.x + goal.w * zone.xRatio;
      const zy = goal.y + goal.h * zone.yRatio;
      const d = Math.hypot(x - zx, y - zy);
      return d < best.distance ? { zone, distance: d } : best;
    }, { zone: SHOT_ZONES[0], distance: Number.POSITIVE_INFINITY });

    shootToZone(nearest.zone);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950 text-white overflow-hidden" dir="rtl">
      <div ref={wrapperRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasClick}
          className="block w-full h-full touch-none"
        />
      </div>

      <div className="absolute top-[max(env(safe-area-inset-top),14px)] left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-2 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg">
            ⚽ <span className="text-yellow-300">{goals}</span>
          </div>
          <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-2 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg">
            🏆 <span className="text-yellow-300">{score}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-2 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg">
            ❤️ <span className="text-red-400">{lives}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 text-white flex items-center justify-center active:scale-95 shadow-lg"
            aria-label="إغلاق اللعبة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {gameState === 'menu' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-sky-300/25 bg-slate-900/92 shadow-2xl p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-6xl mb-3">⚽</div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-l from-sky-300 to-emerald-400 mb-2">ركلات المعرفة</h1>
            <p className="text-sm font-bold text-slate-300 leading-6 mb-6">
              أجب عن السؤال، اختر زاوية التسديد، وسجل أكبر عدد من الأهداف.
            </p>
            {!canPlay ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm font-bold text-slate-300">
                بانتظار أسئلة ركلات المعرفة من المعلم.
              </div>
            ) : (
              <button
                type="button"
                onClick={startGame}
                className="w-full h-14 rounded-2xl bg-gradient-to-l from-sky-400 to-emerald-500 text-white font-black text-lg shadow-[0_14px_28px_rgba(14,165,233,0.35)] active:scale-95 flex items-center justify-center gap-2"
              >
                <Play className="w-6 h-6" />
                ابدأ الركلات
              </button>
            )}
          </div>
        </div>
      )}

      {gameState === 'question' && currentQuestion && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-sky-300/30 bg-slate-900/92 shadow-2xl p-5 sm:p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-sky-300 text-2xl sm:text-3xl font-black mb-3">🧠 سؤال قبل التسديد</div>
            <h2 className="text-lg sm:text-2xl font-black text-white leading-8 mb-5">{currentQuestion.question}</h2>

            <div className="grid grid-cols-1 gap-3">
              {questionOptions.map((option, index) => {
                const answered = Boolean(feedback);
                const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
                const isCorrectOption = answered && index === correctIndex;
                const isWrongOption = answered && feedback?.type === 'wrong' && index !== correctIndex;
                return (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    disabled={answered}
                    onClick={() => handleAnswer(index)}
                    className={`w-full rounded-2xl border p-3 text-start font-black transition-all active:scale-[0.99] disabled:opacity-90 ${
                      isCorrectOption
                        ? 'bg-green-400/20 border-green-400 text-white'
                        : isWrongOption
                          ? 'bg-red-400/10 border-red-400/40 text-white'
                          : 'bg-white/5 border-white/10 text-white hover:bg-sky-400/15 hover:border-sky-300'
                    }`}
                  >
                    <span className="inline-flex w-8 h-8 rounded-full bg-slate-800 items-center justify-center text-sky-300 ml-3">{index + 1}</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className={`mt-4 rounded-2xl border p-3 ${feedback.type === 'correct' ? 'bg-green-400/10 border-green-400/30' : 'bg-red-400/10 border-red-400/30'}`}>
                <p className={`text-base sm:text-xl font-black ${feedback.type === 'correct' ? 'text-green-300' : 'text-red-300'}`}>{feedback.message}</p>
                {feedback.explanation && <p className="mt-1 text-xs font-bold text-slate-300 leading-5">{feedback.explanation}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {gameState === 'aim' && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+96px)] left-3 right-3 z-30 pointer-events-none">
          <div className="max-w-md mx-auto rounded-3xl bg-black/55 backdrop-blur-md border border-white/10 p-3 text-center shadow-2xl">
            <p className="text-sm font-black text-white flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-300" />
              اختر مكان التسديد داخل المرمى
            </p>
            <p className="text-[10px] font-bold text-slate-300 mt-1">
              اضغط على إحدى الدوائر المضيئة داخل المرمى.
            </p>
          </div>
        </div>
      )}

      {(gameState === 'result' || gameState === 'shooting') && feedback && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+96px)] left-3 right-3 z-30 pointer-events-none">
          <div className={`max-w-md mx-auto rounded-3xl backdrop-blur-md border p-4 text-center shadow-2xl ${feedback.type === 'goal' ? 'bg-green-500/20 border-green-300/30' : 'bg-red-500/20 border-red-300/30'}`}>
            <p className="text-lg font-black text-white">{feedback.message}</p>
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/92 shadow-2xl p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-6xl mb-3">🏆</div>
            <h2 className="text-4xl font-black mb-3 text-yellow-300">انتهت الركلات</h2>
            <p className="text-sm font-bold text-slate-300 leading-6 mb-5">
              سجلت {goals} هدف، وتصدى الحارس لـ {saves} ركلة. نتيجتك {score} نقطة.
            </p>
            <button
              type="button"
              onClick={startGame}
              className="w-full h-14 rounded-2xl bg-gradient-to-l from-sky-400 to-emerald-500 text-white font-black text-lg shadow-[0_14px_28px_rgba(14,165,233,0.35)] active:scale-95 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-6 h-6" />
              جولة جديدة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentFootballKnowledgeGame;
