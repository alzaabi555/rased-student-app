import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Trophy,
  HelpCircle,
  Heart,
  XCircle,
  RotateCcw,
  Flag,
  Gauge,
  Play,
  Car,
  Zap,
  ArrowLeft,
  ArrowRight,
  Sparkles
} from 'lucide-react';

// =========================================================================
// 🏎️ طريق المعرفة - سباق معرفي احترافي Canvas 2D
// -------------------------------------------------------------------------
// مبني على منهج السباق الذي أرسلته:
// - طريق متحرك حقيقي.
// - قيادة يمين/يسار.
// - سيارات منافسة ومرور.
// - تصادمات ودخان وشرر.
// - هدف تجاوز سيارات قبل بوابة السؤال.
// - بوابة معرفية توقف السباق مؤقتًا.
// - إجابة صحيحة = تيربو.
// - إجابة خاطئة = ضرر للمحرك وخسارة محاولة.
// =========================================================================

export interface KnowledgeRaceQuestion {
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

export interface KnowledgeRaceResult {
  gameType: 'knowledge_race';
  score: number;
  correct: number;
  wrong: number;
  overtakes: number;
  completed: boolean;
  weakQuestionIds: string[];
  playedAt: string;
}

interface StudentKnowledgeRaceGameProps {
  questions: KnowledgeRaceQuestion[];
  studentId?: string;
  onClose: () => void;
  onComplete?: (result: KnowledgeRaceResult) => void;
}

type GameState = 'menu' | 'playing' | 'quiz' | 'gameover' | 'victory';
type FeedbackState = {
  type: 'correct' | 'wrong';
  message: string;
  explanation?: string;
} | null;

type KeysState = {
  left: boolean;
  right: boolean;
  brake: boolean;
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

type SkidMark = {
  x: number;
  y: number;
  life: number;
};

type TrafficCar = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lane: number;
  speed: number;
  color: string;
  passed: boolean;
  wobbleSeed: number;
};

type GateState = {
  y: number;
  active: boolean;
  opening: number;
};

type PlayerState = {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  maxSpeed: number;
  turnSpeed: number;
  angle: number;
  boostTimer: number;
  smokeTimer: number;
};

const LANES = 3;
const BASE_ROAD_WIDTH = 460;
const MAX_LIVES = 3;
const INITIAL_TARGET_OVERTAKES = 4;
const MAX_TARGET_OVERTAKES = 10;

const TRAFFIC_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#f8fafc', '#06b6d4'];

const normalizeQuestions = (questions: KnowledgeRaceQuestion[]) => {
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const getTodayKey = () => new Date().toLocaleDateString('en-CA');

const makeId = () => Math.random().toString(36).slice(2, 10);

const StudentKnowledgeRaceGame: React.FC<StudentKnowledgeRaceGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const completedRef = useRef(false);

  const usableQuestions = useMemo(() => normalizeQuestions(questions), [questions]);
  const questionDeck = useMemo(() => shuffleArray(usableQuestions), [usableQuestions]);

  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [speedDisplay, setSpeedDisplay] = useState(0);
  const [overtakes, setOvertakes] = useState(0);
  const [targetOvertakes, setTargetOvertakes] = useState(INITIAL_TARGET_OVERTAKES);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<KnowledgeRaceQuestion | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);

  const stateRef = useRef<GameState>('menu');
  const scoreRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const overtakesRef = useRef(0);
  const targetOvertakesRef = useRef(INITIAL_TARGET_OVERTAKES);
  const currentQuestionIndexRef = useRef(0);
  const weakQuestionIdsRef = useRef<string[]>([]);

  const dimensionsRef = useRef({ width: 800, height: 900, roadWidth: BASE_ROAD_WIDTH });
  const keysRef = useRef<KeysState>({ left: false, right: false, brake: false });
  const particlesRef = useRef<Particle[]>([]);
  const skidMarksRef = useRef<SkidMark[]>([]);
  const trafficRef = useRef<TrafficCar[]>([]);
  const gateRef = useRef<GateState | null>(null);
  const trafficTimerRef = useRef(0);
  const distanceRef = useRef(0);
  const shakeRef = useRef(0);

  const playerRef = useRef<PlayerState>({
    x: 400,
    y: 700,
    w: 44,
    h: 86,
    speed: 0,
    maxSpeed: 24,
    turnSpeed: 0,
    angle: 0,
    boostTimer: 0,
    smokeTimer: 0
  });

  const canPlay = usableQuestions.length > 0;
  const currentProgress = Math.min(currentQuestionIndex, questionDeck.length);
  const totalRounds = Math.max(1, questionDeck.length);

  const syncState = (next: GameState) => {
    stateRef.current = next;
    setGameState(next);
  };

  const updateScore = (next: number) => {
    scoreRef.current = next;
    setScore(next);
  };

  const updateLives = (next: number) => {
    livesRef.current = next;
    setLives(next);
  };

  const updateOvertakes = (next: number) => {
    overtakesRef.current = next;
    setOvertakes(next);
  };

  const updateTargetOvertakes = (next: number) => {
    targetOvertakesRef.current = next;
    setTargetOvertakes(next);
  };

  const updateQuestionIndex = (next: number) => {
    currentQuestionIndexRef.current = next;
    setCurrentQuestionIndex(next);
  };

  const updateWeakIds = (next: string[]) => {
    weakQuestionIdsRef.current = next;
    setWeakQuestionIds(next);
  };

  const roadLeft = () => dimensionsRef.current.width / 2 - dimensionsRef.current.roadWidth / 2;
  const roadRight = () => dimensionsRef.current.width / 2 + dimensionsRef.current.roadWidth / 2;
  const laneWidth = () => dimensionsRef.current.roadWidth / LANES;
  const laneCenter = (lane: number) => roadLeft() + laneWidth() / 2 + lane * laneWidth();

  const createParticle = (x: number, y: number, color: string, size: number, vx: number, vy: number, life: number) => {
    particlesRef.current.push({ x, y, color, size, vx, vy, life, maxLife: life });
  };

  const createExhaust = (x: number, y: number, color = '#94a3b8', size = 6) => {
    for (let i = 0; i < 2; i++) {
      createParticle(
        x + (Math.random() - 0.5) * 12,
        y,
        color,
        size + Math.random() * 3,
        (Math.random() - 0.5) * 2,
        5 + Math.random() * 2,
        22
      );
    }
  };

  const createDust = (x: number, y: number, color = '#4ade80') => {
    for (let i = 0; i < 4; i++) {
      createParticle(
        x,
        y,
        color,
        7 + Math.random() * 5,
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 4,
        26
      );
    }
  };

  const createSparks = (x: number, y: number) => {
    for (let i = 0; i < 18; i++) {
      createParticle(
        x,
        y,
        '#fbbf24',
        3 + Math.random() * 3,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        16
      );
    }
  };

  const createSkidMark = (x: number, y: number) => {
    skidMarksRef.current.push({ x, y, life: 120 });
  };

  const triggerShake = (amount: number) => {
    shakeRef.current = Math.max(shakeRef.current, amount);
  };

  const spawnTraffic = () => {
    if (gateRef.current) return;

    trafficTimerRef.current--;
    if (trafficTimerRef.current > 0) return;

    const lane = Math.floor(Math.random() * LANES);
    const speed = 7 + Math.random() * 9;
    const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
    const newCar: TrafficCar = {
      id: makeId(),
      x: laneCenter(lane),
      y: -140,
      w: 42,
      h: 85,
      lane,
      speed,
      color,
      passed: false,
      wobbleSeed: Math.random() * 1000
    };

    const canSpawn = trafficRef.current.every(car => Math.abs(car.x - newCar.x) > 52 || car.y > 120);
    if (canSpawn) {
      trafficRef.current.push(newCar);
      trafficTimerRef.current = 36 + Math.floor(Math.random() * 54);
    } else {
      trafficTimerRef.current = 12;
    }
  };

  const pickQuestion = () => {
    if (questionDeck.length === 0) return null;
    return questionDeck[currentQuestionIndexRef.current % questionDeck.length];
  };

  const triggerQuiz = () => {
    const player = playerRef.current;
    player.speed = 0;
    player.turnSpeed = 0;

    const question = pickQuestion();
    if (!question) {
      finishRace(true);
      return;
    }

    setCurrentQuestion(question);
    setFeedback(null);
    syncState('quiz');
  };

  const finishRace = (won: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;

    syncState(won ? 'victory' : 'gameover');
    setCurrentQuestion(null);
    setFeedback(null);

    const result: KnowledgeRaceResult = {
      gameType: 'knowledge_race',
      score: scoreRef.current,
      correct: currentQuestionIndexRef.current - weakQuestionIdsRef.current.length,
      wrong: weakQuestionIdsRef.current.length,
      overtakes: overtakesRef.current,
      completed: won,
      weakQuestionIds: weakQuestionIdsRef.current,
      playedAt: new Date().toISOString()
    };

    try {
      const key = `rased_student_game_stats_${studentId || 'default'}`;
      const oldStats = JSON.parse(localStorage.getItem(key) || '{}');
      const attempts = Number(oldStats.knowledgeRaceAttempts || 0) + 1;
      const bestScore = Math.max(Number(oldStats.knowledgeRaceBestScore || 0), result.score);

      localStorage.setItem(
        key,
        JSON.stringify({
          ...oldStats,
          knowledgeRaceBestScore: bestScore,
          knowledgeRaceLastScore: result.score,
          knowledgeRaceAttempts: attempts,
          lastPlayedDate: getTodayKey(),
          lastGameType: 'knowledge_race'
        })
      );

      const resultKey = `rased_game_results_${studentId || 'default'}`;
      const oldResults = JSON.parse(localStorage.getItem(resultKey) || '[]');
      oldResults.unshift(result);
      localStorage.setItem(resultKey, JSON.stringify(oldResults.slice(0, 30)));
    } catch (error) {
      console.error('Failed to save knowledge race result', error);
    }

    onComplete?.(result);
  };

  const handleAnswer = (answerIndex: number) => {
    const question = currentQuestion;
    if (!question || feedback) return;

    const correctIndex = question.correctAnswerIndex ?? 0;
    const isCorrect = answerIndex === correctIndex;

    if (isCorrect) {
      setFeedback({
        type: 'correct',
        message: '✨ إجابة صحيحة! تيربو مُفعّل!',
        explanation: question.explanation
      });

      updateScore(scoreRef.current + 220);
      playerRef.current.boostTimer = 210;
      createSparks(playerRef.current.x, playerRef.current.y + 20);

      window.setTimeout(() => {
        const nextIndex = currentQuestionIndexRef.current + 1;
        updateQuestionIndex(nextIndex);
        gateRef.current = null;
        updateOvertakes(0);
        updateTargetOvertakes(clamp(INITIAL_TARGET_OVERTAKES + nextIndex * 2, INITIAL_TARGET_OVERTAKES, MAX_TARGET_OVERTAKES));
        setCurrentQuestion(null);
        setFeedback(null);

        if (nextIndex >= questionDeck.length) {
          finishRace(true);
        } else {
          syncState('playing');
        }
      }, 1450);

      return;
    }

    setFeedback({
      type: 'wrong',
      message: '❌ إجابة خاطئة! ضرر في المحرك.',
      explanation: question.explanation
    });

    const nextLives = livesRef.current - 1;
    updateLives(nextLives);
    playerRef.current.smokeTimer = 190;
    triggerShake(9);

    updateWeakIds(Array.from(new Set([...weakQuestionIdsRef.current, question.id])));

    window.setTimeout(() => {
      const nextIndex = currentQuestionIndexRef.current + 1;
      updateQuestionIndex(nextIndex);
      gateRef.current = null;
      updateOvertakes(0);
      updateTargetOvertakes(clamp(INITIAL_TARGET_OVERTAKES + nextIndex * 2, INITIAL_TARGET_OVERTAKES, MAX_TARGET_OVERTAKES));
      setCurrentQuestion(null);
      setFeedback(null);

      if (nextLives <= 0) {
        finishRace(false);
      } else if (nextIndex >= questionDeck.length) {
        finishRace(true);
      } else {
        syncState('playing');
      }
    }, 1900);
  };

  const resetGame = () => {
    completedRef.current = false;
    updateScore(0);
    updateLives(MAX_LIVES);
    updateQuestionIndex(0);
    updateWeakIds([]);
    updateOvertakes(0);
    updateTargetOvertakes(INITIAL_TARGET_OVERTAKES);
    setCurrentQuestion(null);
    setFeedback(null);
    setSpeedDisplay(0);
    distanceRef.current = 0;
    trafficRef.current = [];
    particlesRef.current = [];
    skidMarksRef.current = [];
    gateRef.current = null;
    trafficTimerRef.current = 0;
    shakeRef.current = 0;

    const { width, height } = dimensionsRef.current;
    playerRef.current = {
      x: width / 2,
      y: Math.max(280, height - 170),
      w: 44,
      h: 86,
      speed: 0,
      maxSpeed: 24,
      turnSpeed: 0,
      angle: 0,
      boostTimer: 0,
      smokeTimer: 0
    };
  };

  const startGame = () => {
    if (!canPlay) return;
    resetGame();
    syncState('playing');
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(320, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const roadWidth = clamp(width * 0.58, 300, BASE_ROAD_WIDTH);
    dimensionsRef.current = { width, height, roadWidth };

    const player = playerRef.current;
    player.y = Math.max(250, height - 170);
    player.x = clamp(player.x || width / 2, roadLeft() + player.w / 2 + 8, roadRight() - player.w / 2 - 8);
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft') keysRef.current.left = true;
      if (event.code === 'ArrowRight') keysRef.current.right = true;
      if (event.code === 'ArrowDown') keysRef.current.brake = true;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(event.code)) event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft') keysRef.current.left = false;
      if (event.code === 'ArrowRight') keysRef.current.right = false;
      if (event.code === 'ArrowDown') keysRef.current.brake = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
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

  const drawCar = (ctx: CanvasRenderingContext2D, car: PlayerState | TrafficCar, isPlayer = false) => {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate('angle' in car ? car.angle : 0);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(8, 17, car.w * 0.72, car.h * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.fillRect(-car.w / 2 - 3, -car.h / 2 + 12, 7, 18);
    ctx.fillRect(car.w / 2 - 4, -car.h / 2 + 12, 7, 18);
    ctx.fillRect(-car.w / 2 - 3, car.h / 2 - 30, 7, 18);
    ctx.fillRect(car.w / 2 - 4, car.h / 2 - 30, 7, 18);

    const baseColor = isPlayer ? '#f59e0b' : (car as TrafficCar).color;
    const gradient = ctx.createLinearGradient(0, -car.h / 2, 0, car.h / 2);
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(1, isPlayer ? '#b45309' : '#1e293b');

    ctx.fillStyle = gradient;
    roundedRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 12);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    roundedRect(ctx, -car.w / 2 + 7, -car.h / 4, car.w - 14, car.h / 2, 6);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundedRect(ctx, -car.w / 2 + 10, -car.h / 4 + 4, car.w - 20, 13, 5);
    ctx.fill();

    ctx.fillStyle = isPlayer ? '#fef08a' : '#cbd5e1';
    ctx.shadowBlur = isPlayer ? 12 : 6;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(-car.w / 2 + 5, -car.h / 2 + 3, 9, 5);
    ctx.fillRect(car.w / 2 - 14, -car.h / 2 + 3, 9, 5);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-car.w / 2 + 5, car.h / 2 - 5, 10, 4);
    ctx.fillRect(car.w / 2 - 15, car.h / 2 - 5, 10, 4);

    if (isPlayer) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, -2);
    }

    ctx.restore();
  };

  const renderCircuit = (ctx: CanvasRenderingContext2D) => {
    const { width, height, roadWidth } = dimensionsRef.current;
    const distance = distanceRef.current;

    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(width / 2 - roadWidth / 2, 0, roadWidth, height);

    const stripHeight = 48;
    const offset = distance % (stripHeight * 2);
    const curbWidth = 17;

    for (let y = -stripHeight * 2; y < height + stripHeight; y += stripHeight) {
      const drawY = y + offset;
      const isRed = Math.floor((drawY - offset) / stripHeight) % 2 === 0;
      ctx.fillStyle = isRed ? '#dc2626' : '#f8fafc';
      ctx.fillRect(width / 2 - roadWidth / 2 - curbWidth, drawY, curbWidth, stripHeight);
      ctx.fillRect(width / 2 + roadWidth / 2, drawY, curbWidth, stripHeight);
    }

    ctx.fillStyle = 'rgba(148,163,184,0.85)';
    ctx.fillRect(width / 2 - roadWidth / 2 - curbWidth - 95, 0, 14, height);
    ctx.fillRect(width / 2 + roadWidth / 2 + curbWidth + 81, 0, 14, height);

    const laneW = roadWidth / LANES;
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    for (let y = -100; y < height + 100; y += 80) {
      const drawY = y + (distance % 80);
      ctx.fillRect(width / 2 - roadWidth / 2 + laneW - 3, drawY, 6, 40);
      ctx.fillRect(width / 2 - roadWidth / 2 + laneW * 2 - 3, drawY, 6, 40);
    }

    if (playerRef.current.speed > 26) {
      ctx.strokeStyle = 'rgba(255,255,255,0.24)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const x = Math.random() * width;
        const len = 50 + Math.random() * 120;
        const y = Math.random() * height;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
      }
      ctx.stroke();
    }
  };

  const drawGate = (ctx: CanvasRenderingContext2D, gate: GateState) => {
    const { width, roadWidth } = dimensionsRef.current;
    if (!gate.active || gate.y < -100 || gate.y > dimensionsRef.current.height + 100) return;

    ctx.save();
    ctx.translate(width / 2, gate.y);

    ctx.shadowBlur = 20;
    ctx.shadowColor = '#38bdf8';
    ctx.fillStyle = 'rgba(56,189,248,0.55)';
    ctx.fillRect(-roadWidth / 2, 0, roadWidth, 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Tajawal, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('بوابة السؤال - استعد!', 0, 17);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-roadWidth / 2 - 30, -42, 50, 86);
    ctx.fillRect(roadWidth / 2 - 20, -42, 50, 86);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-roadWidth / 2 - 20, -30, 30, 60);
    ctx.fillRect(roadWidth / 2 - 10, -30, 30, 60);

    ctx.restore();
  };

  const updateGame = (delta: number) => {
    if (stateRef.current !== 'playing') return;

    const player = playerRef.current;
    const keys = keysRef.current;
    const frameScale = delta / 16.67;

    if (player.boostTimer > 0) {
      player.boostTimer -= frameScale;
      player.maxSpeed = 40;
      createExhaust(player.x, player.y + player.h / 2, '#38bdf8', 8);
    } else {
      player.maxSpeed = 24;
    }

    player.speed += 0.2 * frameScale;
    if (keys.brake) player.speed -= 0.5 * frameScale;
    player.speed = clamp(player.speed, 0, player.maxSpeed);

    const handling = Math.max(0.22, player.speed / Math.max(1, player.maxSpeed));
    if (keys.left) {
      player.turnSpeed -= 0.62 * handling * frameScale;
      player.angle = -0.13;
      if (player.speed > 12 && Math.random() > 0.55) createSkidMark(player.x + player.w / 2, player.y + player.h / 2);
    } else if (keys.right) {
      player.turnSpeed += 0.62 * handling * frameScale;
      player.angle = 0.13;
      if (player.speed > 12 && Math.random() > 0.55) createSkidMark(player.x - player.w / 2, player.y + player.h / 2);
    } else {
      player.turnSpeed *= Math.pow(0.82, frameScale);
      player.angle *= Math.pow(0.82, frameScale);
    }

    player.x += player.turnSpeed * frameScale;

    const leftBoundary = roadLeft() + player.w / 2 + 10;
    const rightBoundary = roadRight() - player.w / 2 - 10;
    if (player.x < leftBoundary) {
      player.x = leftBoundary;
      player.turnSpeed = 0;
      player.speed *= 0.86;
      createDust(player.x - player.w / 2, player.y + player.h / 2);
      triggerShake(2);
    }
    if (player.x > rightBoundary) {
      player.x = rightBoundary;
      player.turnSpeed = 0;
      player.speed *= 0.86;
      createDust(player.x + player.w / 2, player.y + player.h / 2);
      triggerShake(2);
    }

    if (player.speed > 8 && Math.random() > 0.65 && player.boostTimer <= 0) {
      createExhaust(player.x, player.y + player.h / 2 - 8, '#94a3b8');
    }

    if (player.smokeTimer > 0) {
      player.smokeTimer -= frameScale;
      player.speed *= 0.965;
      createExhaust(player.x, player.y - player.h / 2, '#0f172a', 12);
    }

    distanceRef.current += player.speed * frameScale;

    if (overtakesRef.current >= targetOvertakesRef.current && !gateRef.current) {
      gateRef.current = { y: -110, active: true, opening: 0 };
    }

    if (gateRef.current) {
      const gate = gateRef.current;
      gate.y += player.speed * frameScale;
      const distanceLeft = player.y - gate.y;
      if (gate.active && distanceLeft < 430 && distanceLeft > 0) {
        player.speed *= Math.pow(0.94, frameScale);
      }
      if (gate.active && gate.y > player.y - player.h / 2) {
        gate.active = false;
        triggerQuiz();
      }
    } else {
      spawnTraffic();
    }

    for (let i = trafficRef.current.length - 1; i >= 0; i--) {
      const car = trafficRef.current[i];
      car.y += (player.speed - car.speed) * frameScale;
      car.x += Math.sin(distanceRef.current * 0.01 + car.wobbleSeed) * 0.45 * frameScale;

      if (!car.passed && car.y > player.y + player.h) {
        car.passed = true;
        updateOvertakes(overtakesRef.current + 1);
        updateScore(scoreRef.current + 10);
      }

      const hit =
        player.x - player.w / 2 < car.x + car.w / 2 &&
        player.x + player.w / 2 > car.x - car.w / 2 &&
        player.y - player.h / 2 < car.y + car.h / 2 &&
        player.y + player.h / 2 > car.y - car.h / 2;

      if (hit) {
        player.speed *= 0.42;
        car.speed = Math.max(1, player.speed);
        car.y -= 14;
        triggerShake(12);
        createSparks(player.x, player.y - player.h / 2);
      }

      if (car.y > dimensionsRef.current.height + 180) {
        trafficRef.current.splice(i, 1);
      }
    }

    skidMarksRef.current.forEach(mark => {
      mark.y += player.speed * frameScale;
      mark.life -= frameScale;
    });
    skidMarksRef.current = skidMarksRef.current.filter(mark => mark.life > 0);

    particlesRef.current.forEach(p => {
      p.x += p.vx * frameScale;
      p.y += (p.vy + player.speed) * frameScale;
      p.life -= frameScale;
      p.size *= Math.pow(0.94, frameScale);
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0 && p.size > 0.3);

    setSpeedDisplay(Math.floor(player.speed * 11));
  };

  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensionsRef.current;
    const shake = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
    const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
    if (shakeRef.current > 0) shakeRef.current *= 0.82;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(shake, shakeY);

    renderCircuit(ctx);

    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    skidMarksRef.current.forEach(mark => {
      ctx.globalAlpha = clamp(mark.life / 120, 0, 1);
      ctx.beginPath();
      ctx.ellipse(mark.x, mark.y, 5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (gateRef.current) drawGate(ctx, gateRef.current);

    trafficRef.current.forEach(car => drawCar(ctx, car, false));
    drawCar(ctx, playerRef.current, true);

    particlesRef.current.forEach(p => {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  useEffect(() => {
    const loop = (time: number) => {
      const last = lastFrameRef.current || time;
      const delta = clamp(time - last, 0, 34);
      lastFrameRef.current = time;
      updateGame(delta);
      drawFrame();
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [questionDeck]);

  const questionOptions = currentQuestion?.questionType === 'true_false'
    ? ['صح', 'خطأ']
    : currentQuestion?.options || [];

  const speedColor = speedDisplay > 280 ? 'text-sky-400' : speedDisplay < 50 ? 'text-slate-300' : 'text-warning';

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950 text-white overflow-hidden" dir="rtl">
      <div ref={wrapperRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      <div className="absolute top-[max(env(safe-area-inset-top),14px)] left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-2 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg">
            🏆 <span className="text-yellow-300">{score}</span>
          </div>
          <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-2 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg">
            🎯 <span className={overtakes >= targetOvertakes ? 'text-green-400' : 'text-sky-300'}>{overtakes}/{targetOvertakes}</span>
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

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] right-4 z-20 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-black/70 backdrop-blur-md border-4 border-slate-700 flex flex-col items-center justify-center shadow-2xl pointer-events-none">
        <div className={`text-2xl sm:text-3xl font-black leading-none ${speedColor}`}>{speedDisplay}</div>
        <div className="text-[9px] font-bold text-slate-300">KM/H</div>
      </div>

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] left-4 z-20 flex gap-3">
        <button
          type="button"
          onPointerDown={() => { keysRef.current.left = true; }}
          onPointerUp={() => { keysRef.current.left = false; }}
          onPointerCancel={() => { keysRef.current.left = false; }}
          onPointerLeave={() => { keysRef.current.left = false; }}
          className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 text-white flex items-center justify-center active:scale-95 active:bg-white/25 shadow-xl"
          aria-label="يسار"
        >
          <ArrowRight className="w-7 h-7" />
        </button>
        <button
          type="button"
          onPointerDown={() => { keysRef.current.right = true; }}
          onPointerUp={() => { keysRef.current.right = false; }}
          onPointerCancel={() => { keysRef.current.right = false; }}
          onPointerLeave={() => { keysRef.current.right = false; }}
          className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 text-white flex items-center justify-center active:scale-95 active:bg-white/25 shadow-xl"
          aria-label="يمين"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>
      </div>

      {gameState === 'menu' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-warning/30 bg-slate-900/90 shadow-2xl p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-6xl mb-3">🏎️</div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-l from-amber-300 to-orange-500 mb-2">طريق المعرفة</h1>
            <p className="text-sm font-bold text-slate-300 leading-6 mb-6">
              سباق حقيقي: تجاوز السيارات، افتح بوابات الأسئلة، واستعمل التيربو لتصبح بطل الحلبة.
            </p>
            {!canPlay ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm font-bold text-slate-300">
                بانتظار أسئلة سباق المعرفة من المعلم.
              </div>
            ) : (
              <button
                type="button"
                onClick={startGame}
                className="w-full h-14 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-600 text-white font-black text-lg shadow-[0_14px_28px_rgba(245,158,11,0.35)] active:scale-95 flex items-center justify-center gap-2"
              >
                <Play className="w-6 h-6" />
                ابدأ السباق
              </button>
            )}
          </div>
        </div>
      )}

      {gameState === 'quiz' && currentQuestion && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-sky-300/30 bg-slate-900/92 shadow-2xl p-5 sm:p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-sky-300 text-2xl sm:text-3xl font-black mb-3">⚡ نقطة تفتيش معرفية ⚡</div>
            <h2 className="text-lg sm:text-2xl font-black text-white leading-8 mb-5">{currentQuestion.question}</h2>

            <div className="grid grid-cols-1 gap-3">
              {questionOptions.map((option, index) => {
                const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
                const answered = Boolean(feedback);
                const isCorrectOption = answered && index === correctIndex;
                const isWrongSelection = answered && feedback?.type === 'wrong' && index !== correctIndex;

                return (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    disabled={answered}
                    onClick={() => handleAnswer(index)}
                    className={`w-full rounded-2xl border p-3 text-start font-black transition-all active:scale-[0.99] disabled:opacity-90 ${
                      isCorrectOption
                        ? 'bg-green-400/20 border-green-400 text-white'
                        : isWrongSelection
                          ? 'bg-red-400/10 border-red-400/40 text-white'
                          : 'bg-white/5 border-white/10 text-white hover:bg-amber-400/15 hover:border-amber-300'
                    }`}
                  >
                    <span className="inline-flex w-8 h-8 rounded-full bg-slate-800 items-center justify-center text-amber-300 ml-3">{index + 1}</span>
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

      {(gameState === 'gameover' || gameState === 'victory') && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/92 shadow-2xl p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-6xl mb-3">{gameState === 'victory' ? '🏁' : '💥'}</div>
            <h2 className={`text-4xl font-black mb-3 ${gameState === 'victory' ? 'text-yellow-300' : 'text-red-400'}`}>
              {gameState === 'victory' ? 'بطل الحلبة!' : 'انتهى السباق'}
            </h2>
            <p className="text-sm font-bold text-slate-300 leading-6 mb-5">
              {gameState === 'victory'
                ? `أنهيت السباق وجمعت ${score} نقطة.`
                : 'فقدت جميع المحاولات. راجع الأسئلة ثم حاول مرة أخرى.'}
            </p>
            <button
              type="button"
              onClick={startGame}
              className="w-full h-14 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-600 text-white font-black text-lg shadow-[0_14px_28px_rgba(245,158,11,0.35)] active:scale-95 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-6 h-6" />
              سباق جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentKnowledgeRaceGame;
