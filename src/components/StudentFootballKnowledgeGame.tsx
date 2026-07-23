import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, RotateCcw, Zap, Trophy, Target } from 'lucide-react';

// =========================================================================
// ⚽ ركلات المعرفة V3 - Penalty Challenge
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

type SpriteAnimationName =
  | 'player-idle' | 'player-run' | 'player-kick' | 'player-celebrate'
  | 'keeper-idle' | 'keeper-center-save' | 'keeper-dive-left' | 'keeper-dive-right' | 'keeper-recover';
type SpriteDefinition = { src: string; frames: number; fps: number; loop: boolean };
const FOOTBALL_SPRITES: Record<SpriteAnimationName, SpriteDefinition> = {
  'player-idle': { src: '/assets/games/football/player/idle.webp', frames: 4, fps: 5, loop: true },
  'player-run': { src: '/assets/games/football/player/run.webp', frames: 6, fps: 10, loop: true },
  'player-kick': { src: '/assets/games/football/player/kick.webp', frames: 6, fps: 12, loop: false },
  'player-celebrate': { src: '/assets/games/football/player/celebrate.webp', frames: 6, fps: 8, loop: true },
  'keeper-idle': { src: '/assets/games/football/keeper/idle.webp', frames: 4, fps: 5, loop: true },
  'keeper-center-save': { src: '/assets/games/football/keeper/center-save.webp', frames: 5, fps: 10, loop: false },
  'keeper-dive-left': { src: '/assets/games/football/keeper/dive-left.webp', frames: 6, fps: 12, loop: false },
  'keeper-dive-right': { src: '/assets/games/football/keeper/dive-right.webp', frames: 6, fps: 12, loop: false },
  'keeper-recover': { src: '/assets/games/football/keeper/recover.webp', frames: 4, fps: 8, loop: false }
};
const SPRITE_FRAME_SIZE = 256;

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
  const spriteImagesRef = useRef<Partial<Record<SpriteAnimationName, HTMLImageElement>>>({});
  const spriteLoadFailedRef = useRef(false);
  const stateStartedAtRef = useRef(0);
  const [spritesReady, setSpritesReady] = useState(false);

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
  const kickFlashRef = useRef(0);
  const grassBurstRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number }>>([]);
  const celebrationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    spriteLoadFailedRef.current = false;
    const entries = Object.entries(FOOTBALL_SPRITES) as Array<[SpriteAnimationName, SpriteDefinition]>;
    Promise.all(entries.map(([name, definition]) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        if (!cancelled) spriteImagesRef.current[name] = image;
        resolve();
      };
      image.onerror = () => reject(new Error(`تعذر تحميل Sprite: ${definition.src}`));
      image.src = definition.src;
    }))).then(() => {
      if (!cancelled) setSpritesReady(true);
    }).catch(error => {
      console.warn('Football sprites unavailable; Canvas fallback remains active.', error);
      spriteLoadFailedRef.current = true;
      if (!cancelled) setSpritesReady(false);
    });
    return () => { cancelled = true; };
  }, []);

  const canPlay = usableQuestions.length > 0;

  const syncGameState = (next: GameState) => {
    gameStateRef.current = next;
    stateStartedAtRef.current = performance.now();
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
    kickFlashRef.current = 0;
    grassBurstRef.current = [];
    celebrationRef.current = 0;
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
    kickFlashRef.current = ok ? 1 : 0.55;
    for(let i=0;i<(ok?20:10);i++) grassBurstRef.current.push({x:ball.x+(Math.random()-.5)*18,y:ball.y+9,vx:(Math.random()-.5)*7,vy:-2-Math.random()*5,life:22+Math.random()*14});
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
      celebrationRef.current = 75;
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

  const drawStadiumBackdrop = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current;
    const horizon = height * 0.30;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon + 90);
    sky.addColorStop(0, '#050b20'); sky.addColorStop(0.48, '#123b73'); sky.addColorStop(1, '#38a3c7');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon + 90);
    const light = (x: number, dir: number) => {
      ctx.save();
      const beam = ctx.createLinearGradient(x, 38, x + dir * width * .34, horizon + 130);
      beam.addColorStop(0, 'rgba(255,255,225,.24)'); beam.addColorStop(1, 'rgba(255,255,225,0)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x-22,44); ctx.lineTo(x+22,44); ctx.lineTo(x+dir*width*.36,horizon+135); ctx.lineTo(x+dir*width*.18,horizon+135); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#64748b'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(x,48); ctx.lineTo(x,horizon+4); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.shadowBlur=18; ctx.shadowColor='#fef9c3'; for(let i=-2;i<=2;i++) ctx.fillRect(x+i*9-3,30,7,11);
      ctx.restore();
    };
    light(40,1); light(width-40,-1);
    ctx.fillStyle='#0f2138'; ctx.fillRect(0,height*.09,width,height*.19);
    ctx.fillStyle='#173451'; ctx.fillRect(0,height*.145,width,height*.045);
    ctx.fillStyle='#091827'; ctx.fillRect(0,height*.235,width,height*.05);
    const colors=['#facc15','#38bdf8','#fb7185','#f8fafc','#4ade80'];
    for(let row=0;row<5;row++) for(let x=8;x<width;x+=16){ctx.globalAlpha=.72;ctx.fillStyle=colors[(Math.floor(x/16)+row)%colors.length];ctx.beginPath();ctx.arc(x+(row%2)*7,height*.115+row*22,3.1,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    ['RASED','LEARN','PLAY','WIN'].forEach((label,i)=>{const w=width/4,y=height*.278,g=ctx.createLinearGradient(i*w,y,(i+1)*w,y+31);g.addColorStop(0,i%2?'#0284c7':'#1d4ed8');g.addColorStop(1,i%2?'#0369a1':'#4338ca');ctx.fillStyle=g;ctx.fillRect(i*w,y,w,31);ctx.fillStyle='#fff';ctx.font='900 13px Tajawal, Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,i*w+w/2,y+15);});
  };
  const drawField = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current;
    drawStadiumBackdrop(ctx);
    const top=height*.255, grass=ctx.createLinearGradient(0,top,0,height);
    grass.addColorStop(0,'#32c86a');grass.addColorStop(.52,'#159447');grass.addColorStop(1,'#0b6d36');ctx.fillStyle=grass;ctx.fillRect(0,top,width,height-top);
    const stripe=Math.max(44,(height-top)/9);for(let y=top;y<height;y+=stripe){ctx.fillStyle=Math.floor((y-top)/stripe)%2===0?'rgba(255,255,255,.035)':'rgba(0,0,0,.055)';ctx.fillRect(0,y,width,stripe);}
    ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=1;for(let x=0;x<width;x+=20){ctx.beginPath();ctx.moveTo(width/2+(x-width/2)*.38,top);ctx.lineTo(x,height);ctx.stroke();}
    const spot=penaltySpot();ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(width/2,height*.70,clamp(width*.22,78,130),0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.roundRect(width*.12,top+8,width*.76,height*.255,18);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(spot.x,spot.y,6,0,Math.PI*2);ctx.fill();
    const v=ctx.createRadialGradient(width/2,height*.58,width*.15,width/2,height*.58,width*.72);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(2,20,10,.30)');ctx.fillStyle=v;ctx.fillRect(0,top,width,height-top);
  };
  const drawGoal = (ctx: CanvasRenderingContext2D) => {
    const goal=goalRect(), depth=clamp(goal.h*.20,20,34), pulse=netPulseRef.current*8;
    ctx.save();ctx.shadowBlur=20+netPulseRef.current*32;ctx.shadowColor=netPulseRef.current>.05?'#facc15':'rgba(2,6,23,.55)';
    ctx.fillStyle='rgba(2,6,23,.42)';drawRoundedRect(ctx,goal.x-18,goal.y+18,goal.w+36,goal.h+depth+18,24);ctx.fill();
    ctx.fillStyle='rgba(226,240,255,.16)';ctx.beginPath();ctx.moveTo(goal.x,goal.y);ctx.lineTo(goal.x+depth,goal.y-depth*.38);ctx.lineTo(goal.x+goal.w-depth,goal.y-depth*.38);ctx.lineTo(goal.x+goal.w,goal.y);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.10)';drawRoundedRect(ctx,goal.x,goal.y,goal.w,goal.h,18);ctx.fill();
    ctx.lineWidth=1.2;ctx.strokeStyle='rgba(255,255,255,.58)';for(let x=goal.x+14;x<goal.x+goal.w;x+=22){ctx.beginPath();ctx.moveTo(x,goal.y+7);ctx.lineTo(x+Math.sin((x+pulse)*.08)*pulse,goal.y+goal.h-3);ctx.stroke();}
    for(let y=goal.y+16;y<goal.y+goal.h;y+=18){ctx.beginPath();ctx.moveTo(goal.x+7,y);ctx.quadraticCurveTo(goal.x+goal.w/2,y+Math.sin(y*.08)*pulse,goal.x+goal.w-7,y);ctx.stroke();}
    ctx.strokeStyle='#fff';ctx.lineWidth=9;ctx.lineCap='round';drawRoundedRect(ctx,goal.x,goal.y,goal.w,goal.h,18);ctx.stroke();ctx.strokeStyle='rgba(186,230,253,.95)';ctx.lineWidth=2;drawRoundedRect(ctx,goal.x+4,goal.y+4,goal.w-8,goal.h-8,14);ctx.stroke();ctx.restore();
    if(netPulseRef.current>0)netPulseRef.current*=.87;
  };
  const drawAimZones = (ctx: CanvasRenderingContext2D) => {
    if(gameStateRef.current!=='aim')return;const goal=goalRect(),spot=penaltySpot(),pulse=(Math.sin(performance.now()/260)+1)/2,selected=selectedZoneRef.current;
    if(selected){const tx=goal.x+goal.w*selected.xRatio,ty=goal.y+goal.h*selected.yRatio,line=ctx.createLinearGradient(spot.x,spot.y,tx,ty);line.addColorStop(0,'rgba(250,204,21,.08)');line.addColorStop(1,'rgba(250,204,21,.78)');ctx.strokeStyle=line;ctx.lineWidth=3;ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(spot.x,spot.y);ctx.quadraticCurveTo((spot.x+tx)/2+18,(spot.y+ty)/2-40,tx,ty);ctx.stroke();ctx.setLineDash([]);}
    SHOT_ZONES.forEach((zone,index)=>{const x=goal.x+goal.w*zone.xRatio,y=goal.y+goal.h*zone.yRatio,active=selected?.id===zone.id,r=active?24+pulse*5:18+((pulse+index*.13)%1)*3,g=ctx.createRadialGradient(x,y,3,x,y,r+15);g.addColorStop(0,active?'rgba(250,204,21,.75)':'rgba(56,189,248,.55)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r+15,0,Math.PI*2);ctx.fill();ctx.fillStyle=active?'rgba(250,204,21,.34)':'rgba(15,23,42,.36)';ctx.strokeStyle=active?'#fde047':'#e0f2fe';ctx.lineWidth=active?4:2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=active?'#fff7ae':'rgba(255,255,255,.72)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r*.48,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-r*.75,y);ctx.lineTo(x+r*.75,y);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y-r*.75);ctx.lineTo(x,y+r*.75);ctx.stroke();});
  };
  const drawCanvasShooter = (ctx: CanvasRenderingContext2D, delta: number) => {
    const shooter=shooterRef.current,spot=penaltySpot();
    if(gameStateRef.current==='runup'){shooter.runProgress=clamp(shooter.runProgress+.035*(delta/16.67),0,1);shooter.x=shooter.startX+(spot.x-shooter.startX-10)*shooter.runProgress;shooter.y=shooter.startY+(spot.y+18-shooter.startY)*shooter.runProgress;shooter.legSwing=Math.sin(shooter.runProgress*Math.PI*5)*.7;if(shooter.runProgress>=1){shooter.kicking=true;shooter.legSwing=1;launchShot();}}
    const celebrate=celebrationRef.current>0;ctx.save();ctx.translate(shooter.x,shooter.y);
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,47,40,12,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#111827';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-9,25);ctx.lineTo(-19,49);ctx.moveTo(10,25);ctx.lineTo(23+shooter.legSwing*14,47-shooter.legSwing*11);ctx.stroke();
    ctx.strokeStyle='#f8fafc';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-24,51);ctx.lineTo(-8,51);ctx.moveTo(18+shooter.legSwing*14,50-shooter.legSwing*11);ctx.lineTo(36+shooter.legSwing*14,50-shooter.legSwing*11);ctx.stroke();
    ctx.fillStyle='#172554';drawRoundedRect(ctx,-22,21,44,19,7);ctx.fill();
    const shirt=ctx.createLinearGradient(-25,-28,25,30);shirt.addColorStop(0,'#fbbf24');shirt.addColorStop(.55,'#f97316');shirt.addColorStop(1,'#c2410c');ctx.fillStyle=shirt;drawRoundedRect(ctx,-25,-25,50,58,17);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle='#fee2b3';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-22,-6);ctx.lineTo(celebrate?-40:-43,celebrate?-38:12+shooter.legSwing*5);ctx.moveTo(22,-6);ctx.lineTo(celebrate?40:42,celebrate?-38:8-shooter.legSwing*6);ctx.stroke();
    ctx.fillStyle='#fde7c2';ctx.beginPath();ctx.arc(0,-44,19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1f2937';ctx.beginPath();ctx.arc(0,-52,16,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111827';ctx.beginPath();ctx.arc(-5,-45,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(5,-45,2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9a3412';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-39,5,.1,Math.PI-.1);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-17,-16);ctx.lineTo(17,-16);ctx.stroke();ctx.fillStyle='#fff7ed';ctx.font='900 18px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('10',0,4);ctx.restore();
    if(celebrationRef.current>0)celebrationRef.current=Math.max(0,celebrationRef.current-delta/16.67);
  };
  const drawCanvasKeeper = (ctx: CanvasRenderingContext2D, delta: number) => {
    const k=keeperRef.current,e=k.diving?.12:.06;k.x+=(k.targetX-k.x)*e*(delta/16.67);k.y+=(k.targetY-k.y)*e*(delta/16.67);ctx.save();ctx.translate(k.x,k.y);
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,38,46,12,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#dbeafe';ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-21,-9);ctx.lineTo(-53,k.diving?-25:10);ctx.moveTo(21,-9);ctx.lineTo(53,k.diving?-25:10);ctx.stroke();
    ctx.fillStyle='#fef08a';ctx.beginPath();ctx.arc(-54,k.diving?-25:10,9,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(54,k.diving?-25:10,9,0,Math.PI*2);ctx.fill();
    const kit=ctx.createLinearGradient(-26,-30,26,34);kit.addColorStop(0,'#38bdf8');kit.addColorStop(.6,'#0284c7');kit.addColorStop(1,'#075985');ctx.fillStyle=kit;drawRoundedRect(ctx,-26,-31,52,63,17);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.86)';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#fde7c2';ctx.beginPath();ctx.arc(0,-45,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#172033';ctx.beginPath();ctx.arc(0,-52,15,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#0f172a';ctx.beginPath();ctx.arc(-5,-46,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(5,-46,2,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#0f172a';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-12,27);ctx.lineTo(-29,51);ctx.moveTo(12,27);ctx.lineTo(29,51);ctx.stroke();ctx.fillStyle='#e0f2fe';ctx.font='900 16px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('1',0,2);ctx.restore();
  };
  const getSpriteFrame = (name: SpriteAnimationName, elapsedMs: number) => {
    const definition = FOOTBALL_SPRITES[name];
    const raw = Math.floor((elapsedMs / 1000) * definition.fps);
    return definition.loop ? raw % definition.frames : Math.min(definition.frames - 1, raw);
  };

  const drawSpriteFrame = (
    ctx: CanvasRenderingContext2D,
    name: SpriteAnimationName,
    frame: number,
    anchorX: number,
    anchorY: number,
    drawSize: number
  ) => {
    const image = spriteImagesRef.current[name];
    if (!image || !image.complete || image.naturalWidth <= 0) return false;
    ctx.drawImage(
      image,
      frame * SPRITE_FRAME_SIZE, 0, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE,
      anchorX - drawSize / 2, anchorY - drawSize, drawSize, drawSize
    );
    return true;
  };

  const drawShooter = (ctx: CanvasRenderingContext2D, delta: number) => {
    // تشغيل حساب الركضة وتوقيت إطلاق الكرة من منطق Visual V2 نفسه، مع إخفاء الرسم الهندسي.
    if (spritesReady) {
      ctx.save();
      ctx.globalAlpha = 0;
      drawCanvasShooter(ctx, delta);
      ctx.restore();
    } else {
      drawCanvasShooter(ctx, delta);
      return;
    }

    const shooter = shooterRef.current;
    const elapsed = Math.max(0, performance.now() - stateStartedAtRef.current);
    let animation: SpriteAnimationName = 'player-idle';
    if (gameStateRef.current === 'runup') animation = 'player-run';
    else if (gameStateRef.current === 'shooting') animation = 'player-kick';
    else if (gameStateRef.current === 'round_result' && answerWasCorrectRef.current) animation = 'player-celebrate';
    else if (gameStateRef.current === 'round_result') animation = 'player-kick';
    const frame = getSpriteFrame(animation, elapsed);
    const size = clamp(dimensionsRef.current.height * 0.185, 128, 174);
    if (!drawSpriteFrame(ctx, animation, frame, shooter.x, shooter.y + 58, size)) {
      drawCanvasShooter(ctx, 0);
    }
  };

  const drawKeeper = (ctx: CanvasRenderingContext2D, delta: number) => {
    // الإبقاء على إحداثيات الحارس ومدى التصدي من المنطق الأصلي.
    if (spritesReady) {
      ctx.save();
      ctx.globalAlpha = 0;
      drawCanvasKeeper(ctx, delta);
      ctx.restore();
    } else {
      drawCanvasKeeper(ctx, delta);
      return;
    }

    const keeper = keeperRef.current;
    const elapsed = Math.max(0, performance.now() - stateStartedAtRef.current);
    let animation: SpriteAnimationName = 'keeper-idle';
    if (keeper.diving) {
      const horizontalDelta = keeper.targetX - keeper.homeX;
      if (Math.abs(horizontalDelta) < 28) animation = 'keeper-center-save';
      else animation = horizontalDelta < 0 ? 'keeper-dive-left' : 'keeper-dive-right';
    }
    if (gameStateRef.current === 'round_result' && elapsed > 900 && !answerWasCorrectRef.current) {
      animation = 'keeper-recover';
    }
    const frame = getSpriteFrame(animation, elapsed);
    const size = clamp(dimensionsRef.current.height * 0.17, 116, 164);
    if (!drawSpriteFrame(ctx, animation, frame, keeper.x, keeper.y + 62, size)) {
      drawCanvasKeeper(ctx, 0);
    }
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

  const drawKickEffects = (ctx: CanvasRenderingContext2D, delta: number) => {
    if(kickFlashRef.current>.01){const b=ballRef.current,r=22+kickFlashRef.current*42,g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,r);g.addColorStop(0,`rgba(255,255,255,${.72*kickFlashRef.current})`);g.addColorStop(.35,`rgba(250,204,21,${.46*kickFlashRef.current})`);g.addColorStop(1,'rgba(250,204,21,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,r,0,Math.PI*2);ctx.fill();kickFlashRef.current*=Math.pow(.84,delta/16.67);}
    grassBurstRef.current.forEach(p=>{p.x+=p.vx*(delta/16.67);p.y+=p.vy*(delta/16.67);p.vy+=.2*(delta/16.67);p.life-=delta/16.67;ctx.globalAlpha=clamp(p.life/34,0,1);ctx.strokeStyle='#86efac';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.vx*1.8,p.y+7);ctx.stroke();});ctx.globalAlpha=1;grassBurstRef.current=grassBurstRef.current.filter(p=>p.life>0);
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
    drawKickEffects(ctx, delta);
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

      {gameState !== 'menu' && gameState !== 'finished' && (
        <div className="absolute top-[max(env(safe-area-inset-top),14px)] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-4 py-2 text-[11px] font-black text-white shadow-lg">
            الجولة {Math.min(questionIndex + 1, questionDeck.length)} / {questionDeck.length}
          </div>
        </div>
      )}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-sky-300/25 bg-slate-900/92 shadow-2xl p-7 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="text-6xl mb-3">⚽</div>
            <div className={`mx-auto mb-3 w-fit rounded-full px-3 py-1 text-[10px] font-black border ${spritesReady ? 'bg-emerald-400/10 border-emerald-300/25 text-emerald-200' : 'bg-slate-800 border-white/10 text-slate-300'}`}>
              {spritesReady ? 'الشخصيات الاحترافية جاهزة' : 'جارٍ تجهيز الشخصيات...'}
            </div>
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
        <div className="absolute right-3 top-[46%] -translate-y-1/2 z-30 pointer-events-none w-[112px] sm:w-[132px]">
          <div className="rounded-[1.4rem] bg-slate-950/74 backdrop-blur-md border border-yellow-300/35 px-3 py-4 text-center shadow-2xl flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-yellow-300/15 border border-yellow-300/30 flex items-center justify-center"><Target className="w-5 h-5 text-yellow-300" /></div>
            <p className="text-[11px] sm:text-xs font-black text-yellow-300 leading-5">اختر زاوية التسديد</p>
            <div className="w-8 h-px bg-white/15" />
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-200 leading-5">اضغط على إحدى دوائر المرمى</p>
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
        <div className="absolute right-3 top-[48%] -translate-y-1/2 z-30 pointer-events-none w-[150px]">
          <div className="rounded-3xl bg-black/68 backdrop-blur-md border border-white/10 p-3 text-center shadow-2xl">
            <p className="text-sm font-black text-white flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-300" />
              اللاعب ينفذ الركلة الآن...
            </p>
          </div>
        </div>
      )}

      {gameState === 'round_result' && feedback && (
        <div className="absolute right-3 top-[48%] -translate-y-1/2 z-30 pointer-events-none w-[150px]">
          <div className={`rounded-3xl backdrop-blur-md border p-4 text-center shadow-2xl ${feedback.type === 'goal' ? 'bg-green-500/20 border-green-300/30' : 'bg-red-500/20 border-red-300/30'}`}>
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
