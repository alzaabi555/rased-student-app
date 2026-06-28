import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, RotateCcw, Zap, Trophy, Target } from 'lucide-react';

// =========================================================================
// ⚽ ركلات المعرفة V2 - Penalty Challenge
// -------------------------------------------------------------------------
// منطق اللعب الجديد:
// 1) اللاعب والكرة والحارس يظهرون داخل ملعب كرتوني.
// 2) الطالب يختار زاوية التسديد أولًا.
// 3) تظهر نافذة سؤال الحسم.
// 4) الإجابة الصحيحة = ركضة وتسديدة قوية نحو الزاوية المختارة.
// 5) الإجابة الخاطئة = تسديدة أضعف/أكثر توقعًا، والحارس غالبًا يصدها.
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

type GameState = 'menu' | 'aim' | 'question' | 'runup' | 'shooting' | 'round_result' | 'finished';
type FeedbackState = {
  type: 'correct' | 'wrong' | 'goal' | 'save';
  message: string;
  explanation?: string;
} | null;

type ShotZone = {
  id: string;
  label: string;
  xRatio: number;
  yRatio: number;
};

type BallState = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  moving: boolean;
  spin: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
};

type ShooterState = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  runProgress: number;
  kicking: boolean;
  legSwing: number;
};

type KeeperState = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  diving: boolean;
  reach: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
};

const MAX_LIVES = 3;
const ROUND_RESULT_MS = 1350;

const SHOT_ZONES: ShotZone[] = [
  { id: 'top_left', label: 'يسار أعلى', xRatio: 0.22, yRatio: 0.30 },
  { id: 'top_center', label: 'وسط أعلى', xRatio: 0.50, yRatio: 0.26 },
  { id: 'top_right', label: 'يمين أعلى', xRatio: 0.78, yRatio: 0.30 },
  { id: 'bottom_left', label: 'يسار أسفل', xRatio: 0.24, yRatio: 0.67 },
  { id: 'bottom_center', label: 'وسط أسفل', xRatio: 0.50, yRatio: 0.70 },
  { id: 'bottom_right', label: 'يمين أسفل', xRatio: 0.76, yRatio: 0.67 }
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const getTodayKey = () => new Date().toLocaleDateString('en-CA');

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
  const lastFrameRef = useRef(0);

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
  const [selectedZone, setSelectedZone] = useState<ShotZone | null>(null);
  const [answerWasCorrect, setAnswerWasCorrect] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);

  const gameStateRef = useRef<GameState>('menu');
  const answerWasCorrectRef = useRef(false);
  const selectedZoneRef = useRef<ShotZone | null>(null);
  const completedRef = useRef(false);
  const resolvingShotRef = useRef(false);

  const dimensionsRef = useRef({ width: 800, height: 900 });
  const ballRef = useRef<BallState>({ x: 400, y: 720, r: 13, vx: 0, vy: 0, moving: false, spin: 0, trail: [] });
  const shooterRef = useRef<ShooterState>({ x: 400, y: 790, startX: 400, startY: 790, runProgress: 0, kicking: false, legSwing: 0 });
  const keeperRef = useRef<KeeperState>({ x: 400, y: 260, homeX: 400, homeY: 260, targetX: 400, targetY: 260, diving: false, reach: 46 });
  const particlesRef = useRef<Particle[]>([]);
  const netPulseRef = useRef(0);
  const shakeRef = useRef(0);

  const canPlay = usableQuestions.length > 0;

  const syncGameState = (next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
  };

  const goalRect = () => {
    const { width, height } = dimensionsRef.current;
    const goalW = clamp(width * 0.80, 280, 570);
    const goalH = clamp(height * 0.24, 118, 190);
    const x = (width - goalW) / 2;
    const y = clamp(height * 0.10, 58, 92);
    return { x, y, w: goalW, h: goalH };
  };

  const penaltySpot = () => {
    const { width, height } = dimensionsRef.current;
    return {
      x: width / 2,
      y: height - clamp(height * 0.20, 132, 168)
    };
  };

  const resetActors = () => {
    const spot = penaltySpot();
    const goal = goalRect();
    const shooterStartY = spot.y + 76;

    ballRef.current = {
      x: spot.x,
      y: spot.y,
      r: 14,
      vx: 0,
      vy: 0,
      moving: false,
      spin: 0,
      trail: []
    };

    shooterRef.current = {
      x: spot.x - 26,
      y: shooterStartY,
      startX: spot.x - 26,
      startY: shooterStartY,
      runProgress: 0,
      kicking: false,
      legSwing: 0
    };

    keeperRef.current = {
      x: goal.x + goal.w / 2,
      y: goal.y + goal.h * 0.62,
      homeX: goal.x + goal.w / 2,
      homeY: goal.y + goal.h * 0.62,
      targetX: goal.x + goal.w / 2,
      targetY: goal.y + goal.h * 0.62,
      diving: false,
      reach: clamp(goal.w * 0.12, 42, 62)
    };

    particlesRef.current = [];
    netPulseRef.current = 0;
    shakeRef.current = 0;
    resolvingShotRef.current = false;
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(430, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dimensionsRef.current = { width, height };
    resetActors();
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const pickQuestion = (index = questionIndex) => {
    if (questionDeck.length === 0) return null;
    return questionDeck[index % questionDeck.length];
  };

  const createParticle = (x: number, y: number, color: string, size: number, vx: number, vy: number, life: number) => {
    particlesRef.current.push({ x, y, color, size, vx, vy, life, maxLife: life });
  };

  const createBurst = (x: number, y: number, color = '#facc15', count = 24) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      createParticle(x, y, color, 3 + Math.random() * 5, Math.cos(angle) * speed, Math.sin(angle) * speed, 28 + Math.random() * 18);
    }
  };

  const finishGame = (completed: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;
    syncGameState('finished');

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
    selectedZoneRef.current = null;
    setCurrentQuestion(pickQuestion(0));
    resetActors();
    syncGameState('aim');
  };

  const nextRound = () => {
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setFeedback(null);
    setSelectedZone(null);
    selectedZoneRef.current = null;
    answerWasCorrectRef.current = false;
    setAnswerWasCorrect(false);
    resetActors();

    if (nextIndex >= questionDeck.length || lives <= 0) {
      finishGame(nextIndex >= questionDeck.length && lives > 0);
      return;
    }

    setCurrentQuestion(pickQuestion(nextIndex));
    syncGameState('aim');
  };

  const selectZone = (zone: ShotZone) => {
    if (gameStateRef.current !== 'aim') return;
    selectedZoneRef.current = zone;
    setSelectedZone(zone);
    setFeedback(null);
    syncGameState('question');
  };

  const handleAnswer = (answerIndex: number) => {
    if (!currentQuestion || feedback || !selectedZoneRef.current) return;

    const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
    const ok = answerIndex === correctIndex;
    answerWasCorrectRef.current = ok;
    setAnswerWasCorrect(ok);

    if (ok) {
      setCorrect(prev => prev + 1);
      setScore(prev => prev + 10);
      setFeedback({
        type: 'correct',
        message: 'إجابة صحيحة! اللاعب يستعد لتسديدة قوية.',
        explanation: currentQuestion.explanation
      });
    } else {
      setWrong(prev => prev + 1);
      setLives(prev => Math.max(0, prev - 1));
      setWeakQuestionIds(prev => Array.from(new Set([...prev, currentQuestion.id])));
      setFeedback({
        type: 'wrong',
        message: 'إجابة خاطئة! التسديدة ستصبح أضعف والحارس قرأ الاتجاه.',
        explanation: currentQuestion.explanation
      });
    }

    window.setTimeout(() => {
      setFeedback(null);
      syncGameState('runup');
    }, ok ? 850 : 1050);
  };

  const launchShot = () => {
    const zone = selectedZoneRef.current;
    if (!zone) return;

    const goal = goalRect();
    const ball = ballRef.current;
    const targetX = goal.x + goal.w * zone.xRatio;
    const targetY = goal.y + goal.h * zone.yRatio;
    const ok = answerWasCorrectRef.current;

    const dx = targetX - ball.x;
    const dy = targetY - ball.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const speed = ok ? 25 : 17;

    ball.vx = (dx / distance) * speed;
    ball.vy = (dy / distance) * speed;
    ball.moving = true;

    const keeperZone = ok
  ? SHOT_ZONES.find(z => z.id !== zone.id) || SHOT_ZONES[0]
  : zone;

    keeperRef.current.targetX = goal.x + goal.w * keeperZone.xRatio;
keeperRef.current.targetY = goal.y + goal.h * keeperZone.yRatio;

// إذا كانت الإجابة خاطئة، نوسّع مدى الحارس حتى يكون التصدي مضمونًا ومنطقيًا بصريًا.
keeperRef.current.reach = ok
  ? clamp(goal.w * 0.12, 42, 62)
  : clamp(goal.w * 0.18, 58, 86);

keeperRef.current.diving = true;

    createBurst(ball.x, ball.y, ok ? '#facc15' : '#94a3b8', ok ? 18 : 8);
    syncGameState('shooting');
  };

 const resolveShot = (goalScored: boolean) => {
    if (resolvingShotRef.current) return;
    resolvingShotRef.current = true;

    const ok = answerWasCorrectRef.current;

    // قاعدة تربوية:
    // الإجابة الخاطئة لا تتحول إلى هدف أبدًا.
    // حتى لو دخلت الكرة بصريًا في المرمى، النتيجة تكون تصدي.
    const finalGoalScored = ok;
    ballRef.current.moving = false;

    if (finalGoalScored) {
      netPulseRef.current = 1;
      setGoals(prev => prev + 1);
      
      // 👇 تم حذف إضافة الـ 220 نقطة من هنا، لأن الـ 10 نقاط تم إضافتها مسبقاً في دالة handleAnswer
      
      setFeedback({
        type: 'goal',
        message: 'هدف! تسديدة معرفية قوية هزّت الشباك.'
      });
      createBurst(ballRef.current.x, ballRef.current.y, '#facc15', 34);
    } else {
      shakeRef.current = 8;
      setSaves(prev => prev + 1);
      setFeedback({
        type: 'save',
        message: ok
          ? 'الحارس تصدى ببراعة!'
          : 'الحارس قرأ التسديدة لأن الإجابة كانت خاطئة.'
      });
      createBurst(ballRef.current.x, ballRef.current.y, '#38bdf8', ok ? 24 : 32);
    }

    syncGameState('round_result');
    window.setTimeout(nextRound, ROUND_RESULT_MS);
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
    grass.addColorStop(0, '#22c55e');
    grass.addColorStop(1, '#166534');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < height; y += 50) {
      ctx.fillStyle = y % 100 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, y, width, 50);
    }

    const spot = penaltySpot();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.68, clamp(width * 0.22, 78, 130), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 7, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawGoal = (ctx: CanvasRenderingContext2D) => {
    const goal = goalRect();

    ctx.save();
    ctx.shadowBlur = netPulseRef.current * 32;
    ctx.shadowColor = '#facc15';

    ctx.fillStyle = 'rgba(15,23,42,0.34)';
    drawRoundedRect(ctx, goal.x - 14, goal.y + 15, goal.w + 28, goal.h + 26, 20);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    drawRoundedRect(ctx, goal.x, goal.y, goal.w, goal.h, 18);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    drawRoundedRect(ctx, goal.x, goal.y, goal.w, goal.h, 18);
    ctx.stroke();

    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    for (let x = goal.x + 18; x < goal.x + goal.w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, goal.y + 7);
      ctx.lineTo(x - 22, goal.y + goal.h - 4);
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

  const drawAimZones = (ctx: CanvasRenderingContext2D) => {
    if (gameStateRef.current !== 'aim') return;
    const goal = goalRect();

    SHOT_ZONES.forEach(zone => {
      const x = goal.x + goal.w * zone.xRatio;
      const y = goal.y + goal.h * zone.yRatio;
      const active = selectedZone?.id === zone.id;

      ctx.fillStyle = active ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = active ? '#facc15' : 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(15,23,42,0.62)';
      ctx.font = '900 10px Tajawal, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎯', x, y);
    });
  };

  const drawShooter = (ctx: CanvasRenderingContext2D, delta: number) => {
    const shooter = shooterRef.current;
    const spot = penaltySpot();

    if (gameStateRef.current === 'runup') {
      shooter.runProgress = clamp(shooter.runProgress + 0.035 * (delta / 16.67), 0, 1);
      shooter.x = shooter.startX + (spot.x - shooter.startX - 10) * shooter.runProgress;
      shooter.y = shooter.startY + (spot.y + 18 - shooter.startY) * shooter.runProgress;
      shooter.legSwing = Math.sin(shooter.runProgress * Math.PI * 5) * 0.7;

      if (shooter.runProgress >= 1) {
        shooter.kicking = true;
        shooter.legSwing = 1;
        launchShot();
      }
    }

    ctx.save();
    ctx.translate(shooter.x, shooter.y);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 45, 38, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs behind/body
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, 22);
    ctx.lineTo(-18, 48);
    ctx.moveTo(10, 22);
    ctx.lineTo(22 + shooter.legSwing * 13, 46 - shooter.legSwing * 10);
    ctx.stroke();

    // shoes
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-22, 50);
    ctx.lineTo(-9, 50);
    ctx.moveTo(18 + shooter.legSwing * 13, 49 - shooter.legSwing * 10);
    ctx.lineTo(34 + shooter.legSwing * 13, 49 - shooter.legSwing * 10);
    ctx.stroke();

    // body
    const shirt = ctx.createLinearGradient(-24, -26, 24, 28);
    shirt.addColorStop(0, '#f59e0b');
    shirt.addColorStop(1, '#ea580c');
    ctx.fillStyle = shirt;
    drawRoundedRect(ctx, -24, -24, 48, 56, 17);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // arms
    ctx.strokeStyle = '#fee2b3';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-22, -6);
    ctx.lineTo(-43, 12 + shooter.legSwing * 5);
    ctx.moveTo(22, -6);
    ctx.lineTo(42, 8 - shooter.legSwing * 6);
    ctx.stroke();

    // head
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -43, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // hair/cap simple
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(0, -51, 15, Math.PI, Math.PI * 2);
    ctx.fill();

    // number
    ctx.fillStyle = '#fff7ed';
    ctx.font = '900 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('10', 0, 4);

    ctx.restore();
  };

  const drawKeeper = (ctx: CanvasRenderingContext2D, delta: number) => {
    const keeper = keeperRef.current;
    const easing = keeper.diving ? 0.12 : 0.06;
    keeper.x += (keeper.targetX - keeper.x) * easing * (delta / 16.67);
    keeper.y += (keeper.targetY - keeper.y) * easing * (delta / 16.67);

    ctx.save();
    ctx.translate(keeper.x, keeper.y);

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 36, 44, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // arms first for diving silhouette
    ctx.strokeStyle = '#dbeafe';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(-52, keeper.diving ? -24 : 10);
    ctx.moveTo(20, -10);
    ctx.lineTo(52, keeper.diving ? -24 : 10);
    ctx.stroke();

    const kit = ctx.createLinearGradient(-25, -28, 25, 32);
    kit.addColorStop(0, '#0ea5e9');
    kit.addColorStop(1, '#0369a1');
    ctx.fillStyle = kit;
    drawRoundedRect(ctx, -25, -30, 50, 60, 17);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(0, -44, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-12, 26);
    ctx.lineTo(-28, 50);
    ctx.moveTo(12, 26);
    ctx.lineTo(28, 50);
    ctx.stroke();

    ctx.restore();
  };

  const drawBall = (ctx: CanvasRenderingContext2D, delta: number) => {
    const ball = ballRef.current;
    const keeper = keeperRef.current;
    const goal = goalRect();

    if (ball.moving) {
      ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 0.8 });
      ball.trail = ball.trail.slice(0, 12).map(p => ({ ...p, alpha: p.alpha * 0.80 }));
      ball.x += ball.vx * (delta / 16.67);
      ball.y += ball.vy * (delta / 16.67);
      ball.r = Math.max(8, ball.r * 0.991);
      ball.spin += 0.35 * (delta / 16.67);

      const keeperDistance = Math.hypot(ball.x - keeper.x, ball.y - keeper.y);
      const reachedGoal = ball.y <= goal.y + goal.h * 0.72;
      const inGoal = ball.x > goal.x + 12 && ball.x < goal.x + goal.w - 12 && ball.y > goal.y && ball.y < goal.y + goal.h;
      const saved = keeperDistance < keeper.reach && ball.y < goal.y + goal.h + 34;

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
      ctx.arc(p.x, p.y, ball.r * 0.82, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.spin);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(5, 13, ball.r * 1.25, ball.r * 0.45, 0, 0, Math.PI * 2);
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
    ctx.arc(0, 0, ball.r * 0.34, 0, Math.PI * 2);
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

  const drawParticles = (ctx: CanvasRenderingContext2D, delta: number) => {
    particlesRef.current.forEach(p => {
      p.x += p.vx * (delta / 16.67);
      p.y += p.vy * (delta / 16.67);
      p.vy += 0.12 * (delta / 16.67);
      p.life -= delta / 16.67;
      p.size *= 0.965;
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    particlesRef.current = particlesRef.current.filter(p => p.life > 0 && p.size > 0.4);
  };

  const drawFrame = (delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensionsRef.current;
    const sx = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
    const sy = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
    if (shakeRef.current > 0) shakeRef.current *= 0.84;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(sx, sy);
    drawField(ctx);
    drawGoal(ctx);
    drawAimZones(ctx);
    drawKeeper(ctx, delta);
    drawShooter(ctx, delta);
    drawBall(ctx, delta);
    drawParticles(ctx, delta);
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

  const handleCanvasClick = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'aim') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const goal = goalRect();

    const nearest = SHOT_ZONES.reduce(
      (best, zone) => {
        const zx = goal.x + goal.w * zone.xRatio;
        const zy = goal.y + goal.h * zone.yRatio;
        const d = Math.hypot(x - zx, y - zy);
        return d < best.distance ? { zone, distance: d } : best;
      },
      { zone: SHOT_ZONES[0], distance: Number.POSITIVE_INFINITY }
    );

    selectZone(nearest.zone);
  };

  const questionOptions = currentQuestion?.questionType === 'true_false'
    ? ['صح', 'خطأ']
    : currentQuestion?.options || [];

  return (
    <div className="fixed inset-0 z-[2147483647] bg-slate-950 text-white overflow-hidden" dir="rtl">
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
              اختر زاوية التسديد، أجب عن سؤال الحسم، ثم شاهد اللاعب ينفذ الركلة.
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

      {gameState === 'aim' && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+96px)] left-3 right-3 z-30 pointer-events-none">
          <div className="max-w-md mx-auto rounded-3xl bg-black/55 backdrop-blur-md border border-white/10 p-3 text-center shadow-2xl">
            <p className="text-sm font-black text-white flex items-center justify-center gap-2">
              <Target className="w-4 h-4 text-yellow-300" />
              اختر زاوية التسديد أولًا
            </p>
            <p className="text-[10px] font-bold text-slate-300 mt-1">
              اضغط على إحدى دوائر الهدف داخل المرمى، ثم سيظهر سؤال الحسم.
            </p>
          </div>
        </div>
      )}

      {gameState === 'question' && currentQuestion && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-sky-300/30 bg-slate-900/92 shadow-2xl p-5 sm:p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-sky-300 text-2xl sm:text-3xl font-black mb-3">⚡ سؤال الحسم قبل التسديد</div>
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

      {(gameState === 'runup' || gameState === 'shooting') && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+96px)] left-3 right-3 z-30 pointer-events-none">
          <div className="max-w-md mx-auto rounded-3xl bg-black/55 backdrop-blur-md border border-white/10 p-3 text-center shadow-2xl">
            <p className="text-sm font-black text-white flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-300" />
              اللاعب ينفذ الركلة الآن...
            </p>
          </div>
        </div>
      )}

      {gameState === 'round_result' && feedback && (
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
