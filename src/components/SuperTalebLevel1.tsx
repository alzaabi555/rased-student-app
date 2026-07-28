import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SuperTalebQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
}

export interface SuperTalebResult {
  gameType: 'super_taleb';
  score: number;
  pointsEarned: number;
  coins: number;
  knowledgeStars: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalQuestions: number;
  weakQuestionIds: string[];
  level: 1;
  completed: boolean;
  playedAt: string;
}

interface Props {
  questions: SuperTalebQuestion[];
  onComplete: (result: SuperTalebResult) => void;
  onClose: () => void;
}

type GameState = 'menu' | 'playing' | 'question' | 'won' | 'gameover';
type Rect = { x: number; y: number; w: number; h: number };
type Platform = Rect & { kind: 'ground' | 'stone' | 'wood' | 'moving'; vx?: number; minX?: number; maxX?: number };
type Coin = { x: number; y: number; collected: boolean };
type Box = Rect & { questionIndex: number; opened: boolean; active: boolean };
type EnemyKind = 'worksheet' | 'report';
type Enemy = Rect & { kind: EnemyKind; vx: number; minX: number; maxX: number; alive: boolean; hp: number; hitFlash: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type PencilShot = { x:number; y:number; vx:number; life:number; facing:number }; 

const WORLD_W = 5200;
const GROUND_Y = 650;
const PLAYER_W = 54;
const PLAYER_H = 78;
const GRAVITY = 2300;
const MOVE_SPEED = 330;
const RUN_SPEED = 440;
const JUMP_SPEED = 840;

const fallbackQuestions: SuperTalebQuestion[] = [
  { id: 'st-1', question: 'ما عاصمة سلطنة عُمان؟', options: ['صحار', 'مسقط', 'نزوى', 'صلالة'], correctAnswer: 1 },
  { id: 'st-2', question: 'كم عدد أيام الأسبوع؟', options: ['خمسة', 'ستة', 'سبعة', 'ثمانية'], correctAnswer: 2 },
  { id: 'st-3', question: 'أي كلمة تعبّر عن المعرفة؟', options: ['كتاب', 'طريق', 'باب', 'شجرة'], correctAnswer: 0 },
  { id: 'st-4', question: 'ما ناتج 6 + 4؟', options: ['8', '9', '10', '11'], correctAnswer: 2 },
  { id: 'st-5', question: 'العلم العُماني يحتوي على اللون الأخضر.', options: ['صحيح', 'خطأ'], correctAnswer: 0 },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const createLevel = (questionCount: number) => {
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: 875, h: 180, kind: 'ground' },
    { x: 940, y: GROUND_Y, w: 695, h: 180, kind: 'ground' },
    { x: 1720, y: GROUND_Y, w: 750, h: 180, kind: 'ground' },
    { x: 2560, y: GROUND_Y, w: 610, h: 180, kind: 'ground' },
    { x: 3260, y: GROUND_Y, w: 805, h: 180, kind: 'ground' },
    { x: 4140, y: GROUND_Y, w: 1060, h: 180, kind: 'ground' },
    { x: 330, y: 515, w: 150, h: 28, kind: 'stone' },
    { x: 535, y: 470, w: 145, h: 28, kind: 'stone' },
    { x: 775, y: 500, w: 120, h: 25, kind: 'moving', vx: 70, minX: 730, maxX: 870 },
    { x: 1120, y: 500, w: 170, h: 28, kind: 'stone' },
    { x: 1370, y: 465, w: 135, h: 28, kind: 'stone' },
    { x: 1840, y: 500, w: 180, h: 28, kind: 'wood' },
    { x: 2085, y: 455, w: 135, h: 28, kind: 'stone' },
    { x: 2670, y: 485, w: 155, h: 28, kind: 'stone' },
    { x: 2885, y: 455, w: 150, h: 28, kind: 'moving', vx: 85, minX: 2800, maxX: 3000 },
    { x: 3370, y: 500, w: 175, h: 28, kind: 'stone' },
    { x: 3630, y: 455, w: 150, h: 28, kind: 'stone' },
    { x: 4210, y: 500, w: 165, h: 28, kind: 'wood' },
    { x: 4470, y: 465, w: 150, h: 28, kind: 'stone' },
  ];

  const coinPoints = [
    [180, 575], [255, 575], [365, 455], [445, 455], [565, 375], [645, 375], [800, 445],
    [1020, 575], [1110, 440], [1190, 440], [1405, 360], [1480, 360], [1775, 575], [1870, 440],
    [1960, 440], [2115, 350], [2200, 350], [2610, 575], [2710, 425], [2895, 335], [2980, 335],
    [3320, 575], [3400, 445], [3500, 445], [3665, 345], [3750, 345], [4170, 575], [4250, 440],
    [4520, 355], [4600, 355], [4780, 575], [4880, 575],
  ];
  const coins: Coin[] = coinPoints.map(([x, y]) => ({ x, y, collected: false }));

  const qPositions = [620, 1260, 2180, 3010, 3900, 4580, 4860, 5060];
  const boxes: Box[] = Array.from({ length: Math.min(Math.max(questionCount, 5), 8) }, (_, i) => ({
    x: qPositions[i], y: i % 2 === 0 ? 360 : 515, w: 58, h: 58, questionIndex: i, opened: false, active: false,
  }));

  const enemies: Enemy[] = [
    { x: 720, y: GROUND_Y - 64, w: 54, h: 64, kind: 'worksheet', vx: 60, minX: 680, maxX: 820, alive: true, hp: 1, hitFlash: 0 },
    { x: 1490, y: GROUND_Y - 66, w: 58, h: 66, kind: 'worksheet', vx: -70, minX: 1320, maxX: 1530, alive: true, hp: 1, hitFlash: 0 },
    { x: 2300, y: GROUND_Y - 74, w: 64, h: 74, kind: 'report', vx: 58, minX: 2220, maxX: 2390, alive: true, hp: 2, hitFlash: 0 },
    { x: 3100, y: GROUND_Y - 66, w: 58, h: 66, kind: 'worksheet', vx: -75, minX: 3020, maxX: 3190, alive: true, hp: 1, hitFlash: 0 },
    { x: 3940, y: GROUND_Y - 74, w: 64, h: 74, kind: 'report', vx: 64, minX: 3820, maxX: 3990, alive: true, hp: 2, hitFlash: 0 },
  ];
  return { platforms, coins, boxes, enemies };
};

export default function SuperTalebLevel1({ questions, onComplete, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stateRef = useRef<GameState>('menu');
  const questionPool = useMemo(() => (questions?.length ? questions : fallbackQuestions), [questions]);
  const levelRef = useRef(createLevel(questionPool.length));
  const playerRef = useRef({ x: 105, y: GROUND_Y - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, grounded: false, facing: 1, invincible: 0, runFrame: 0, supportIndex: -1, landTimer: 0, checkpointX: 105, hazardCooldown: 0 });
  const inputRef = useRef({ left: false, right: false, jump: false, run: false });
  const cameraRef = useRef(0);
  const dimensionsForCameraRef = useRef(1);
  const environmentAssetsRef = useRef<Record<string, HTMLImageElement>>({});
  const environmentReadyRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const pencilShotsRef = useRef<PencilShot[]>([]);
  const pencilAmmoRef = useRef(0);
  const [pencilAmmo, setPencilAmmo] = useState(0);
  const answeredRef = useRef(new Set<number>());
  const weakRef = useRef<string[]>([]);
  const activeBoxRef = useRef<Box | null>(null);
  const answerLockedRef = useRef(false);
  const answerTimerRef = useRef<number | null>(null);
  const statsRef = useRef({ lives: 3, coins: 0, stars: 0, score: 0, correct: 0, wrong: 0 });

  const [gameState, setGameState] = useState<GameState>('menu');
  const [stats, setStats] = useState(statsRef.current);
  const [activeQuestion, setActiveQuestion] = useState<{ q: SuperTalebQuestion; index: number } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [runEnabled, setRunEnabled] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');

  const setStateSafe = useCallback((s: GameState) => { stateRef.current = s; setGameState(s); }, []);
  const syncStats = useCallback(() => setStats({ ...statsRef.current }), []);

  const spawnBurst = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) particlesRef.current.push({
      x, y, vx: (Math.random() - .5) * 280, vy: -80 - Math.random() * 250, life: .55 + Math.random() * .4,
      color, size: 3 + Math.random() * 6,
    });
  };

  const firePencil = useCallback(() => {
    if (stateRef.current !== 'playing' || pencilAmmoRef.current <= 0) return;
    const p = playerRef.current;
    pencilAmmoRef.current -= 3; setPencilAmmo(pencilAmmoRef.current);
    pencilShotsRef.current.push({ x:p.x+p.w/2+p.facing*28, y:p.y+p.h*.46, vx:p.facing*720, life:1.6, facing:p.facing });
    spawnBurst(p.x+p.w/2,p.y+p.h*.45,'#FDE047',5);
  }, []);

  const resetGame = useCallback(() => {
    if (answerTimerRef.current) { window.clearTimeout(answerTimerRef.current); answerTimerRef.current = null; }
    answerLockedRef.current = false;
    levelRef.current = createLevel(questionPool.length);
    playerRef.current = { x: 105, y: GROUND_Y - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, grounded: false, facing: 1, invincible: 0, runFrame: 0, supportIndex: -1, landTimer: 0, checkpointX: 105, hazardCooldown: 0 };
    cameraRef.current = 0;
    particlesRef.current = []; pencilShotsRef.current = []; pencilAmmoRef.current = 0; setPencilAmmo(0);
    answeredRef.current.clear(); weakRef.current = [];
    statsRef.current = { lives: 3, coins: 0, stars: 0, score: 0, correct: 0, wrong: 0 };
    inputRef.current = { left: false, right: false, jump: false, run: false };
    syncStats(); setActiveQuestion(null); setSelectedAnswer(null); setFeedback(null); setShowIntro(true); setRunEnabled(false); setStateSafe('playing');
  }, [questionPool.length, setStateSafe, syncStats]);

  const finish = useCallback((completed: boolean) => {
    if (stateRef.current === 'won' || stateRef.current === 'gameover') return;
    setStateSafe(completed ? 'won' : 'gameover');
    const s = statsRef.current;
    onComplete({
      gameType: 'super_taleb', score: s.correct * 10, pointsEarned: s.correct * 10, coins: s.coins, knowledgeStars: s.stars,
      correctAnswers: s.correct, wrongAnswers: s.wrong, totalQuestions: answeredRef.current.size,
      weakQuestionIds: [...weakRef.current], level: 1, completed, playedAt: new Date().toISOString(),
    });
  }, [onComplete, setStateSafe]);

  const openQuestion = useCallback((box: Box) => {
    if (box.opened || stateRef.current !== 'playing') return;
    const idx = box.questionIndex % questionPool.length;
    playerRef.current.vx = 0;
    inputRef.current = { left: false, right: false, jump: false, run: false };
    setRunEnabled(false);
    activeBoxRef.current = box;
    answerLockedRef.current = false;
    setActiveQuestion({ q: questionPool[idx], index: idx });
    setSelectedAnswer(null); setFeedback(null); setStateSafe('question');
  }, [questionPool, setStateSafe]);

  const getCorrectIndex = (q: SuperTalebQuestion) => {
    if (typeof q.correctAnswer === 'number') return q.correctAnswer;
    return Math.max(0, q.options.findIndex(o => String(o).trim() === String(q.correctAnswer).trim()));
  };

  const answer = (optionIndex: number) => {
    if (!activeQuestion || selectedAnswer !== null || answerLockedRef.current) return;
    answerLockedRef.current = true;
    const correct = optionIndex === getCorrectIndex(activeQuestion.q);
    setSelectedAnswer(optionIndex); setFeedback(correct ? 'correct' : 'wrong');
    answeredRef.current.add(activeQuestion.index);
    if (activeBoxRef.current) activeBoxRef.current.opened = true;
    if (correct) {
      statsRef.current.score += 10; statsRef.current.stars += 1; statsRef.current.correct += 1; pencilAmmoRef.current += 3; setPencilAmmo(pencilAmmoRef.current);
      if (activeBoxRef.current) spawnBurst(activeBoxRef.current.x + 29, activeBoxRef.current.y, '#FACC15', 18);
    } else {
      statsRef.current.wrong += 1;
      if (!weakRef.current.includes(activeQuestion.q.id)) weakRef.current.push(activeQuestion.q.id);
      if (activeBoxRef.current) spawnBurst(activeBoxRef.current.x + 29, activeBoxRef.current.y, '#EF4444', 10);
    }
    syncStats();
    if (answerTimerRef.current) window.clearTimeout(answerTimerRef.current);
    answerTimerRef.current = window.setTimeout(() => {
      setActiveQuestion(null); setSelectedAnswer(null); setFeedback(null); activeBoxRef.current = null;
      playerRef.current.vx = 0;
      playerRef.current.vy = 0;
      playerRef.current.invincible = Math.max(playerRef.current.invincible, 1.25);
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jump = false;
      inputRef.current.run = false;
      setRunEnabled(false);
      answerLockedRef.current = false;
      answerTimerRef.current = null;
      if (statsRef.current.lives <= 0) finish(false); else setStateSafe('playing');
    }, correct ? 720 : 980);
  };

  useEffect(() => {
    let cancelled = false;
    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        try { if ('decode' in image) await image.decode(); } catch {}
        if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image); else reject(new Error(`Invalid image: ${src}`));
      };
      image.onerror = () => reject(new Error(`Failed to load: ${src}`));
      image.src = src;
    });
    const assetPaths: Record<string, string> = {
      bgGate: '/assets/games/super-taleb/backgrounds/school-gate.webp',
      bgYard: '/assets/games/super-taleb/backgrounds/school-yard.webp',
      bgCorridor: '/assets/games/super-taleb/backgrounds/school-corridor.webp',
      bgClassroom: '/assets/games/super-taleb/backgrounds/classroom.webp',
      playerIdle: '/assets/games/super-taleb/player/idle.webp',
      playerWalk: '/assets/games/super-taleb/player/walk.webp',
      playerRun: '/assets/games/super-taleb/player/run.webp',
      playerJump: '/assets/games/super-taleb/player/jump.webp',
      playerFall: '/assets/games/super-taleb/player/fall.webp',
      playerLand: '/assets/games/super-taleb/player/land.webp',
      playerHit: '/assets/games/super-taleb/player/hit.webp',
      playerVictory: '/assets/games/super-taleb/player/victory.webp',
      groundA: '/assets/games/super-taleb/terrain/grass-long-a.webp',
      groundB: '/assets/games/super-taleb/terrain/grass-long-b.webp',
      groundC: '/assets/games/super-taleb/terrain/grass-long-c.webp',
      stoneGround: '/assets/games/super-taleb/terrain/stone-ground.webp',
      stoneLong: '/assets/games/super-taleb/terrain/stone-long.webp',
      grassMediumA: '/assets/games/super-taleb/terrain/grass-medium-a.webp',
      grassMediumB: '/assets/games/super-taleb/terrain/grass-medium-b.webp',
      grassSmall: '/assets/games/super-taleb/terrain/grass-small.webp',
      grassPlatform: '/assets/games/super-taleb/terrain/grass-platform.webp',
      woodBridge: '/assets/games/super-taleb/terrain/wood-bridge.webp',
      worksheet: '/assets/games/super-taleb/enemies/worksheet.webp',
      lateReport: '/assets/games/super-taleb/enemies/late-report.webp',
      coin: '/assets/games/super-taleb/items/knowledge-coin.webp',
      woodCrate: '/assets/games/super-taleb/items/wood-crate.webp',
      questionBox: '/assets/games/super-taleb/items/question-box.webp',
      knowledgeBook: '/assets/games/super-taleb/items/knowledge-book.webp',
      classroomDoor: '/assets/games/super-taleb/items/classroom-door.webp',
      finishFlag: '/assets/games/super-taleb/items/finish-flag.webp',
      guideSigns: '/assets/games/super-taleb/items/guide-signs.webp'
    };
    Promise.all(Object.entries(assetPaths).map(async ([key, path]) => [key, await loadImage(path)] as const)).then(entries => {
      if (cancelled) return;
      environmentAssetsRef.current = Object.fromEntries(entries);
      environmentReadyRef.current = true;
    }).catch(error => {
      console.warn('Super Taleb environment assets fallback to Canvas', error);
      environmentReadyRef.current = false;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const clearMovement = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jump = false;
      inputRef.current.run = false;
      setRunEnabled(false);
    };
    window.addEventListener('blur', clearMovement);
    document.addEventListener('visibilitychange', clearMovement);
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) inputRef.current.left = down;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) inputRef.current.right = down;
      if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) inputRef.current.jump = down;
      if (['Shift'].includes(e.key)) inputRef.current.run = down;
    };
    const kd = key(true), ku = key(false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', clearMovement); document.removeEventListener('visibilitychange', clearMovement); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect(); canvas.width = Math.max(1, Math.floor(r.width * dpr)); canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const handleViewportChange = () => {
      resize();
      setOrientation(window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');
    };
    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    };

    const drawBackground = (w: number, h: number, cam: number) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#38BDF8'); sky.addColorStop(.55, '#BAE6FD'); sky.addColorStop(1, '#F0FDF4');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      const assets = environmentAssetsRef.current;
      if (environmentReadyRef.current && assets.bgGate && assets.bgYard) {
        const drawCover = (image: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
          const scale = Math.max(dw / image.naturalWidth, dh / image.naturalHeight);
          const sw = dw / scale, sh = dh / scale;
          const sx = Math.max(0, (image.naturalWidth - sw) / 2);
          const sy = Math.max(0, image.naturalHeight - sh);
          ctx.drawImage(image, sx, sy, Math.min(sw, image.naturalWidth), Math.min(sh, image.naturalHeight), dx, dy, dw, dh);
        };
        const parallaxCam = cam * .30;
        const gateW = 1320;
        const drawFull = (image: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
          ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, dx, dy, dw, dh);
        };
        // The opening always uses the complete school-gate artwork rather than a cropped center section.
        drawFull(assets.bgGate, -parallaxCam, 0, gateW, h);
        const yardW = 1320;
        let yardX = gateW - parallaxCam - 20;
        while (yardX < w + yardW) {
          drawFull(cam > 3500 && assets.bgCorridor ? assets.bgCorridor : assets.bgYard, yardX, 0, yardW, h);
          yardX += yardW;
        }
        const shade = ctx.createLinearGradient(0, 0, 0, h);
        shade.addColorStop(0, 'rgba(7,21,47,.02)');
        shade.addColorStop(.72, 'rgba(7,21,47,.02)');
        shade.addColorStop(1, 'rgba(7,21,47,.08)');
        ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
      } else {
        // Visual fallback until the source images finish decoding.
        ctx.save(); ctx.translate(-(cam * .08) % 1000, 0); ctx.fillStyle = '#94A3B8';
        for (let i = -1; i < 4; i++) { const x = i * 700; ctx.beginPath(); ctx.moveTo(x, 330); ctx.lineTo(x + 170, 180); ctx.lineTo(x + 330, 330); ctx.lineTo(x + 510, 145); ctx.lineTo(x + 700, 330); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.save(); ctx.translate(-(cam * .22) % 1200, 0);
        for (let i = -1; i < 5; i++) {
          const x = i * 420; ctx.fillStyle = i % 2 ? '#E8C792' : '#F2D5A4'; roundRect(x, 255, 330, 250, 12); ctx.fill();
          ctx.fillStyle = '#0F4C81'; for (let c = 0; c < 4; c++) { roundRect(x + 30 + c * 70, 305, 42, 72, 12); ctx.fill(); }
        }
        ctx.restore();
      }

      // Exact runtime text: no ministry-restricted word is embedded in the image.
      if (cam < 520) {
        const sx = 120 - cam * .85; roundRect(sx, 115, 390, 92, 16); ctx.fillStyle = 'rgba(248,231,200,.96)'; ctx.fill(); ctx.strokeStyle = '#8B5E34'; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = '#0F172A'; ctx.textAlign = 'center'; ctx.font = '700 28px sans-serif'; ctx.fillText('مدرسة راصد للتعليم', sx + 195, 165);
        ctx.fillStyle = '#0B6FB8'; ctx.font = '700 18px sans-serif'; ctx.fillText('راصد', sx + 195, 192);
      }
    };
    const platformSurfaceY = (p: Platform, worldCenterX: number) => {
      if (p.kind !== 'wood') return p.y;
      const t = clamp((worldCenterX - p.x) / Math.max(1, p.w), 0, 1);
      // Suspension bridge deck: high at both ends and naturally lower in the center.
      return p.y + Math.sin(Math.PI * t) * 18;
    };

    const platformSlope = (p: Platform, worldCenterX: number) => {
      if (p.kind !== 'wood') return 0;
      const t = clamp((worldCenterX - p.x) / Math.max(1, p.w), 0, 1);
      return Math.atan((18 * Math.PI / Math.max(1, p.w)) * Math.cos(Math.PI * t));
    };

    const drawPlatform = (p: Platform, cam: number) => {
      const x = p.x - cam;
      if (x + p.w < -50 || x > canvas.clientWidth / Math.max(.45, dimensionsForCameraRef.current) + 50) return;
      const a = environmentAssetsRef.current;
      let image: HTMLImageElement | undefined;
      if (environmentReadyRef.current) {
        if (p.kind === 'wood') image = a.woodBridge;
        else if (p.kind === 'moving') image = a.grassMediumB || a.grassSmall;
        else if (p.kind === 'ground') image = p.w > 800 ? a.groundA : (p.w > 650 ? a.groundB : a.groundC);
        else if (p.w >= 165) image = a.stoneLong || a.grassMediumA;
        else if (p.w >= 145) image = a.grassMediumA || a.grassMediumB;
        else image = a.grassSmall || a.grassPlatform;
      }
      if (image) {
        if (p.kind === 'wood') {
          // The artwork deck is aligned to the same curved mathematical surface used by physics.
          ctx.drawImage(image, x, p.y - 30, p.w, 70);
        } else {
          const drawH = p.kind === 'ground' ? Math.max(150, p.h) : Math.max(58, p.h + 30);
          ctx.drawImage(image, x, p.y, p.w, drawH);
        }
      } else {
        ctx.fillStyle = p.kind === 'wood' || p.kind === 'moving' ? '#8B5A2B' : '#6B4423';
        roundRect(x, p.y, p.w, p.h, p.kind === 'ground' ? 3 : 8); ctx.fill();
      }
    };
    const drawCoin = (c: Coin, cam: number, time: number) => {
      if (c.collected) return;
      const x = c.x - cam, bob = Math.sin(time * 7 + c.x) * 3;
      const image = environmentAssetsRef.current.coin;
      if (environmentReadyRef.current && image) ctx.drawImage(image, x - 17, c.y - 17 + bob, 34, 34);
      else { ctx.fillStyle='#FACC15'; ctx.beginPath(); ctx.arc(x,c.y+bob,15,0,Math.PI*2);ctx.fill(); }
    };
    const drawQuestionBox = (b: Box, cam: number, time: number) => {
      const x = b.x - cam;
      if (x + b.w < 0 || x > canvas.clientWidth / Math.max(.45, dimensionsForCameraRef.current)) return;
      const bob = b.opened ? 0 : Math.sin(time * 3 + b.x) * 1;
      const image = b.opened ? environmentAssetsRef.current.woodCrate : environmentAssetsRef.current.questionBox;
      ctx.save(); ctx.translate(0, bob);
      if (environmentReadyRef.current && image) ctx.drawImage(image, x - 4, b.y - 4, b.w + 8, b.h + 8);
      else {
        roundRect(x, b.y, b.w, b.h, 10); ctx.fillStyle = b.opened ? '#64748B' : '#F59E0B'; ctx.fill();
        ctx.strokeStyle = b.opened ? '#94A3B8' : '#FEF3C7'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#FFF'; ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.opened ? '✓' : '?', x + b.w / 2, b.y + 40);
      }
      ctx.restore();
    };
    const drawEnemy = (e: Enemy, cam: number, time: number) => {
      if (!e.alive) return;
      const x=e.x-cam, bob=Math.sin(time*8+e.x)*2;
      const image=e.kind==='worksheet'?environmentAssetsRef.current.worksheet:environmentAssetsRef.current.lateReport;
      ctx.save();
      if (e.vx < 0) { ctx.translate(x + e.w, e.y + bob); ctx.scale(-1,1); }
      else ctx.translate(x, e.y + bob);
      if(e.hitFlash>0){ctx.globalAlpha=.72;}
      if(environmentReadyRef.current&&image)ctx.drawImage(image,-6,0,e.w+12,e.h);
      else{ctx.fillStyle=e.kind==='worksheet'?'#F7F0DF':'#5B21B6';roundRect(0,0,e.w,e.h,9);ctx.fill();}
      ctx.restore();
    };
    const playerAnimations: Record<string, { key: string; frames: number; fps: number; loop: boolean }> = {
      idle:{key:'playerIdle',frames:6,fps:5,loop:true}, walk:{key:'playerWalk',frames:7,fps:9,loop:true},
      run:{key:'playerRun',frames:7,fps:12,loop:true}, jump:{key:'playerJump',frames:7,fps:10,loop:false},
      fall:{key:'playerFall',frames:5,fps:7,loop:true}, land:{key:'playerLand',frames:5,fps:10,loop:false},
      hit:{key:'playerHit',frames:6,fps:10,loop:false}, victory:{key:'playerVictory',frames:6,fps:8,loop:false}
    };

    const drawPlayer = (p: typeof playerRef.current, cam: number, time: number) => {
      const x=p.x-cam;
      let state='idle';
      if(stateRef.current==='won') state='victory';
      else if(p.invincible>0 && !p.grounded) state='hit';
      else if(!p.grounded) state=p.vy<40?'jump':'fall';
      else if(p.landTimer>0) state='land';
      else if(Math.abs(p.vx)>RUN_SPEED*.72) state='run';
      else if(Math.abs(p.vx)>18) state='walk';
      const anim=playerAnimations[state], image=environmentAssetsRef.current[anim.key];
      ctx.save();
      // Feet are anchored exactly at the physics bottom edge, including the bridge curve.
      ctx.translate(x+p.w/2,p.y+p.h);
      if(p.facing<0)ctx.scale(-1,1);
      if(p.grounded && state!=='land')ctx.rotate(platformSlope(levelRef.current.platforms[p.supportIndex] || ({kind:'ground',x:0,y:0,w:1,h:1} as Platform),p.x+p.w/2)*.35);
      if(p.invincible>0&&Math.floor(p.invincible*14)%2===0)ctx.globalAlpha=.38;
      if(environmentReadyRef.current&&image){
        const raw=Math.floor(time*anim.fps);
        const frame=anim.loop?raw%anim.frames:Math.min(anim.frames-1,raw%anim.frames);
        const visualH=122, visualW=122;
        ctx.drawImage(image,frame*256,0,256,256,-visualW/2,-visualH*(228/256)+14,visualW,visualH);
      }else{
        ctx.fillStyle='#fff';roundRect(-p.w/2,-p.h,p.w,p.h,12);ctx.fill();
      }
      ctx.restore();
    };
    const drawGuideSigns = (cam:number) => {
      const img=environmentAssetsRef.current.guideSigns; if(!img)return;
      const spots=[980,2460,4060];
      for(const worldX of spots){const x=worldX-cam;if(x>-190&&x<canvas.clientWidth/Math.max(.45,dimensionsForCameraRef.current)+190)ctx.drawImage(img,x,GROUND_Y-152,178,112);}
    };

    const drawPencilShots = (cam:number) => {
      for(const shot of pencilShotsRef.current){
        const x=shot.x-cam,y=shot.y; ctx.save();ctx.translate(x,y);if(shot.facing<0)ctx.scale(-1,1);ctx.rotate(-.12);
        ctx.fillStyle='#F5D06F';roundRect(-18,-4,30,8,4);ctx.fill();ctx.fillStyle='#DC2626';ctx.fillRect(10,-4,8,8);ctx.fillStyle='#334155';ctx.beginPath();ctx.moveTo(-18,-4);ctx.lineTo(-27,0);ctx.lineTo(-18,4);ctx.closePath();ctx.fill();ctx.restore();
      }
    };

    const drawDoor = (cam: number) => {
      const x = 5060 - cam;
      if (x > canvas.clientWidth / Math.max(.45, dimensionsForCameraRef.current) + 180) return;
      const door = environmentAssetsRef.current.classroomDoor;
      if (environmentReadyRef.current && door) {
        ctx.drawImage(door, x - 30, GROUND_Y - 245, 190, 245);
      } else {
        roundRect(x, GROUND_Y - 205, 125, 205, 10); ctx.fillStyle = '#E8D2A5'; ctx.fill(); ctx.strokeStyle = '#8B5E34'; ctx.lineWidth = 5; ctx.stroke();
        roundRect(x + 25, GROUND_Y - 165, 76, 165, 12); ctx.fillStyle = '#183B56'; ctx.fill(); ctx.strokeStyle = '#8EC5E8'; ctx.stroke();
      }
      ctx.fillStyle = '#0F172A'; ctx.font = '700 19px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('الفصل الدراسي', x + 62, GROUND_Y - 272);
    };
    const update = (dt: number, w: number) => {
      if (stateRef.current !== 'playing' || showIntro) return;
      const p=playerRef.current, inp=inputRef.current; const speed=inp.run?RUN_SPEED:MOVE_SPEED;
      const movingLeft = inp.left && !inp.right;
      const movingRight = (inp.right && !inp.left) || (inp.run && !inp.left);
      p.vx = movingLeft ? -speed : movingRight ? speed : p.vx * .78; if(Math.abs(p.vx)<4)p.vx=0; if(p.vx)p.facing=Math.sign(p.vx);
      if(inp.jump&&p.grounded){p.vy=-JUMP_SPEED;p.grounded=false;p.supportIndex=-1;inp.jump=false;spawnBurst(p.x+p.w/2,p.y+p.h,'#F8FAFC',6);} p.vy+=GRAVITY*dt; p.invincible=Math.max(0,p.invincible-dt); p.hazardCooldown=Math.max(0,p.hazardCooldown-dt);
      const prevY=p.y, wasGrounded=p.grounded, previousSupport=p.supportIndex;
      p.landTimer=Math.max(0,p.landTimer-dt);
      p.x=clamp(p.x+p.vx*dt,0,WORLD_W-p.w); p.y+=p.vy*dt; p.grounded=false; p.supportIndex=-1;
      for(let i=0;i<levelRef.current.platforms.length;i++){
        const plat=levelRef.current.platforms[i];
        if(plat.kind==='moving'){
          plat.x+=(plat.vx||0)*dt;
          if(plat.x<(plat.minX||0)||plat.x+plat.w>(plat.maxX||WORLD_W)){plat.vx=-(plat.vx||0);plat.x=clamp(plat.x,plat.minX||0,(plat.maxX||WORLD_W)-plat.w);}
        }
        const centerX=p.x+p.w/2;
        const inside=centerX>plat.x+4&&centerX<plat.x+plat.w-4;
        if(!inside)continue;
        const surfaceY=platformSurfaceY(plat,centerX);
        const followedSupport=wasGrounded&&previousSupport===i&&p.vy>=0;
        const landed=p.vy>=0&&prevY+p.h<=surfaceY+14&&p.y+p.h>=surfaceY;
        if(followedSupport||landed){
          p.y=surfaceY-p.h; p.vy=0; p.grounded=true; p.supportIndex=i;
          if(landed&&!wasGrounded)p.landTimer=.20;
          if(plat.kind==='moving')p.x+=(plat.vx||0)*dt;
          break;
        }
      }
      // Save a safe checkpoint only while firmly standing on a broad ground section,
      // away from gaps and enemies. This prevents respawning inside the same hazard.
      if(p.grounded && p.supportIndex >= 0){
        const support=levelRef.current.platforms[p.supportIndex];
        if(support && support.kind==='ground'){
          const candidate=clamp(p.x, support.x+70, support.x+support.w-p.w-70);
          const farFromEnemy=levelRef.current.enemies.every(e=>!e.alive || Math.abs((e.x+e.w/2)-(candidate+p.w/2))>150);
          const roomAhead=candidate>support.x+55 && candidate+p.w<support.x+support.w-55;
          if(farFromEnemy && roomAhead) p.checkpointX=candidate;
        }
      }
      if(p.y>850 && p.hazardCooldown<=0){
        statsRef.current.lives--; syncStats();
        if(statsRef.current.lives<=0){finish(false);return;}
        p.x=clamp(p.checkpointX,70,WORLD_W-p.w-70); p.y=GROUND_Y-PLAYER_H;
        p.vx=0; p.vy=0; p.grounded=false; p.supportIndex=-1; p.landTimer=0;
        p.invincible=2.6; p.hazardCooldown=2.6;
        inputRef.current.left=false; inputRef.current.right=false; inputRef.current.jump=false; inputRef.current.run=false;
        setRunEnabled(false);
        cameraRef.current=clamp(p.x-Math.max(0,w/(dimensionsForCameraRef.current||1))*.28,0,WORLD_W);
      }
      for(const c of levelRef.current.coins){if(!c.collected&&overlap(p,{x:c.x-16,y:c.y-18,w:32,h:36})){c.collected=true;statsRef.current.coins++;spawnBurst(c.x,c.y,'#FACC15',8);syncStats();}}
      for(const b of levelRef.current.boxes){if(!b.opened&&overlap(p,b)){openQuestion(b);break;}}
      for(const e of levelRef.current.enemies){if(!e.alive)continue;e.x+=e.vx*dt;if(e.x<e.minX||e.x+e.w>e.maxX){e.vx*=-1;e.x=clamp(e.x,e.minX,e.maxX-e.w);}e.hitFlash=Math.max(0,e.hitFlash-dt);
        // Use compact body hitboxes rather than the full transparent sprite rectangles.
        // Contact is registered only when the visible bodies genuinely overlap.
        const playerHit:Rect={x:p.x+p.w*.25,y:p.y+p.h*.18,w:p.w*.50,h:p.h*.76};
        const enemyHit:Rect={x:e.x+e.w*.20,y:e.y+e.h*.20,w:e.w*.60,h:e.h*.72};
        if(overlap(playerHit,enemyHit)&&p.invincible<=0&&p.hazardCooldown<=0){
          const stomp=p.vy>140 && prevY+p.h<=e.y+e.h*.30;
          if(stomp){
            e.hp--; e.hitFlash=.2; p.vy=-520; p.grounded=false; p.supportIndex=-1;
            spawnBurst(e.x+e.w/2,e.y+10,'#F59E0B',12);
            if(e.hp<=0){e.alive=false;syncStats();}
          }else{
            statsRef.current.lives--; syncStats();
            if(statsRef.current.lives<=0){finish(false);return;}
            // Move the student to the opposite side with a guaranteed clearance gap.
            const fromLeft=(p.x+p.w/2)<(e.x+e.w/2);
            const separatedX=fromLeft ? e.x-p.w-46 : e.x+e.w+46;
            p.x=clamp(separatedX,20,WORLD_W-p.w-20);
            p.vx=fromLeft?-230:230; p.vy=-330; p.grounded=false; p.supportIndex=-1;
            p.invincible=2.4; p.hazardCooldown=2.4;
            inputRef.current.left=false; inputRef.current.right=false; inputRef.current.jump=false; inputRef.current.run=false;
            setRunEnabled(false);
          }
        }
      }
      for(const shot of pencilShotsRef.current){
        shot.x+=shot.vx*dt; shot.life-=dt;
        const shotBox:Rect={x:shot.x-18,y:shot.y-7,w:36,h:14};
        for(const e of levelRef.current.enemies){
          if(!e.alive)continue;
          const enemyHit:Rect={x:e.x+e.w*.16,y:e.y+e.h*.14,w:e.w*.68,h:e.h*.78};
          if(overlap(shotBox,enemyHit)){e.alive=false;shot.life=0;spawnBurst(e.x+e.w/2,e.y+e.h/2,'#FDE047',16);break;}
        }
      }
      pencilShotsRef.current=pencilShotsRef.current.filter(shot=>shot.life>0&&shot.x>0&&shot.x<WORLD_W);
      if(p.x>5000){finish(true);return;}
      const logicalW = w / (dimensionsForCameraRef.current || 1); const target=clamp(p.x-logicalW*.32,0,WORLD_W-logicalW);cameraRef.current+= (target-cameraRef.current)*Math.min(1,dt*6);
      for(const q of particlesRef.current){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=550*dt;q.life-=dt;}particlesRef.current=particlesRef.current.filter(q=>q.life>0);
    };

    const render = (timeMs: number) => {
      const w=canvas.clientWidth,h=canvas.clientHeight,t=timeMs/1000,cam=cameraRef.current;ctx.clearRect(0,0,w,h);
      ctx.save(); const portraitView = h > w;
      const sceneScale = portraitView ? clamp(h / 700, .86, 1.12) : clamp(h / 560, .80, 1.04);
      dimensionsForCameraRef.current = sceneScale;
      // Reserve a visible gameplay band below the collision surface; controls no longer hide the ground.
      const bottomClearance = portraitView ? 150 : 118;
      const sy = h - (GROUND_Y + bottomClearance) * sceneScale;
      ctx.translate(0, sy);
      ctx.scale(sceneScale, sceneScale);
      drawBackground(w / sceneScale, 760, cam);
      // Subtle depth beneath real gaps; no artificial walkable line is drawn.
      const groundPieces = levelRef.current.platforms.filter(p => p.kind === 'ground').sort((a,b) => a.x - b.x);
      for (let i = 0; i < groundPieces.length - 1; i++) {
        const left = groundPieces[i].x + groundPieces[i].w - cam;
        const right = groundPieces[i + 1].x - cam;
        if (right > left && right > -60 && left < w / sceneScale + 60) {
          const pit = ctx.createLinearGradient(0, GROUND_Y, 0, 760);
          pit.addColorStop(0, 'rgba(15,23,42,.18)'); pit.addColorStop(1, 'rgba(2,6,23,.78)');
          ctx.fillStyle = pit; ctx.fillRect(left, GROUND_Y, right - left, 110);
        }
      }
      for(const p of levelRef.current.platforms)drawPlatform(p,cam);
      drawGuideSigns(cam);
      drawDoor(cam);
      for(const c of levelRef.current.coins)drawCoin(c,cam,t);
      for(const b of levelRef.current.boxes)drawQuestionBox(b,cam,t);
      for(const e of levelRef.current.enemies)drawEnemy(e,cam,t);
      drawPlayer(playerRef.current,cam,t);
      drawPencilShots(cam);
      for(const q of particlesRef.current){ctx.globalAlpha=clamp(q.life*1.7,0,1);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x-cam,q.y,q.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;ctx.restore();
    };

    const loop=(ts:number)=>{const dt=Math.min(.033,(ts-lastRef.current)/1000||0);lastRef.current=ts;update(dt,canvas.clientWidth);render(ts);rafRef.current=requestAnimationFrame(loop);};rafRef.current=requestAnimationFrame(loop);
    return()=>{if(answerTimerRef.current)window.clearTimeout(answerTimerRef.current);window.removeEventListener('resize',handleViewportChange);window.removeEventListener('orientationchange',handleViewportChange);if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  }, [finish, openQuestion, showIntro, syncStats]);

  const touchButton=(key:keyof typeof inputRef.current)=>(down:boolean)=>()=>{inputRef.current[key]=down;};

  return <div dir="rtl" style={{position:'fixed',inset:0,zIndex:9999,background:'#07152F',fontFamily:'Tajawal, system-ui, sans-serif',overflow:'hidden',userSelect:'none'}}>
    <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block',touchAction:'none'}} />

    {gameState==='playing' && <>
      <div style={{position:'absolute',top:orientation==='landscape'?8:12,left:12,right:12,display:'flex',justifyContent:'space-between',alignItems:'center',pointerEvents:'none',transform:orientation==='landscape'?'scale(.92)':'none',transformOrigin:'top center'}}>
        <button onClick={onClose} style={{pointerEvents:'auto',width:46,height:46,borderRadius:16,border:'1px solid rgba(255,255,255,.35)',background:'rgba(7,21,47,.85)',color:'#fff',fontSize:23}}>×</button>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Hud text={`❤️ ${stats.lives}`} color="#EF4444" />
          <Hud text={`⭐ ${stats.stars}`} color="#FACC15" />
          <Hud text={`🪙 ${stats.coins}`} color="#F59E0B" />
          <Hud text={`النقاط ${stats.score}`} color="#38BDF8" />
        </div>
      </div>
      <div style={{position:'absolute',bottom:orientation==='landscape'?10:14,left:orientation==='landscape'?30:18,right:orientation==='landscape'?30:18,display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
        <div style={{display:'flex',gap:orientation==='landscape'?18:12,alignItems:'flex-end'}}>
          <button onClick={() => { const next = !runEnabled; setRunEnabled(next); inputRef.current.run = next; }} style={{width:orientation==='landscape'?74:64,height:orientation==='landscape'?74:64,borderRadius:24,border:runEnabled?'3px solid #FDE68A':'2px solid rgba(255,255,255,.55)',background:runEnabled?'linear-gradient(145deg,rgba(14,165,233,.92),rgba(3,105,161,.92))':'rgba(7,21,47,.68)',color:'#fff',fontSize:17,fontWeight:900,boxShadow:'0 10px 28px rgba(0,0,0,.28)'}}>{runEnabled?'إيقاف':'جري'}</button>
          {pencilAmmo>0 && <button onClick={firePencil} style={{width:orientation==='landscape'?74:64,height:orientation==='landscape'?74:64,borderRadius:24,border:'3px solid #FDE68A',background:'linear-gradient(145deg,#FACC15,#EA580C)',color:'#fff',fontSize:15,fontWeight:900}}>✏️ {pencilAmmo}</button>}
        </div>
        <div style={{display:'flex',gap:orientation==='landscape'?20:14,direction:'ltr'}}>
          <Control label="◀" large={orientation==='landscape'} onDown={touchButton('left')(true)} onUp={touchButton('left')(false)} />
          <Control label="▶" large={orientation==='landscape'} onDown={touchButton('right')(true)} onUp={touchButton('right')(false)} />
        </div>
        <Control label="قفز" large={orientation==='landscape'} accent onDown={touchButton('jump')(true)} onUp={touchButton('jump')(false)} />
      </div>
    </>}

    {gameState==='menu' && <Overlay><Card compact={orientation==='landscape'}>
      <div style={{fontSize:58}}>🎓</div><h1 style={title}>سوبر طالب</h1><p style={sub}>المرحلة الأولى: مدرسة راصد للتعليم</p>
      <p style={body}>تحرك واقفز، اجمع العملات ونجوم المعرفة، وافتح صناديق الأسئلة حتى تصل إلى الفصل الدراسي.</p>
      <button style={primary} onClick={resetGame}>ابدأ المرحلة</button><button style={secondary} onClick={onClose}>العودة</button>
    </Card></Overlay>}

    {gameState==='playing' && showIntro && <Overlay><Card compact={orientation==='landscape'}>
      <div style={{fontSize:50}}>🏫</div><h2 style={title}>مرحبًا بك يا سوبر طالب</h2><p style={body}>استخدم أزرار الحركة والقفز. امشِ فوق الأرض الحجرية والعشبية والجسور الخشبية، واقفز فوق الفجوات، ثم افتح صناديق المعرفة حتى تصل إلى باب الفصل.</p>
      <button style={primary} onClick={()=>setShowIntro(false)}>ابدأ الرحلة</button>
    </Card></Overlay>}

    {gameState==='question' && activeQuestion && <Overlay blur>
      <div style={{width:orientation==='landscape'?'min(560px,58vw)':'min(640px,92vw)',maxHeight:orientation==='landscape'?'70vh':'90vh',overflowY:'auto',background:'#fff',border:'3px solid #38BDF8',borderRadius:orientation==='landscape'?20:28,padding:orientation==='landscape'?12:24,boxShadow:'0 25px 80px rgba(0,0,0,.42)'}}>
        <div style={{color:'#0369A1',fontWeight:900,fontSize:18}}>⚡ صندوق المعرفة</div>
        <h2 style={{color:'#0F172A',fontSize:orientation==='landscape'?'clamp(17px,2vw,23px)':'clamp(22px,4vw,34px)',margin:orientation==='landscape'?'8px 0 12px':'14px 0 20px',lineHeight:1.5}}>{activeQuestion.q.question}</h2>
        <div style={{display:'grid',gap:11}}>{activeQuestion.q.options.map((o,i)=>{
          const correct=i===getCorrectIndex(activeQuestion.q); const chosen=selectedAnswer===i; let bg='#fff',border='#BAE6FD',color='#0F172A';
          if(selectedAnswer!==null&&correct){bg='#16A34A';border='#15803D';color='#fff';}else if(chosen){bg='#EF4444';border='#B91C1C';color='#fff';}
          return <button key={i} disabled={selectedAnswer!==null} onClick={()=>answer(i)} style={{display:'flex',gap:12,alignItems:'center',padding:orientation==='landscape'?'8px 12px':'15px 17px',borderRadius:16,border:`2px solid ${border}`,background:bg,color,fontSize:orientation==='landscape'?15:18,fontWeight:800,textAlign:'right'}}><span style={{width:34,height:34,borderRadius:10,display:'grid',placeItems:'center',background:chosen||correct?'rgba(255,255,255,.22)':'#E0F2FE'}}>{i+1}</span>{o}</button>
        })}</div>
        {feedback&&<div style={{marginTop:14,fontWeight:900,color:feedback==='correct'?'#15803D':'#B91C1C',fontSize:20}}>{feedback==='correct'?'أحسنت! حصلت على نجمة معرفة ⭐':'إجابة غير صحيحة — لم تُضف نقاطًا، وتستمر المغامرة' }</div>}
      </div>
    </Overlay>}

    {(gameState==='won'||gameState==='gameover')&&<Overlay><Card compact={orientation==='landscape'}>
      <div style={{fontSize:60}}>{gameState==='won'?'🏆':'🌟'}</div><h2 style={title}>{gameState==='won'?'اكتملت المرحلة الأولى':'انتهت المحاولات'}</h2>
      <p style={sub}>{gameState==='won'?'وصلت إلى الفصل الدراسي بنجاح':'أعد المرحلة واجمع مزيدًا من المعرفة'}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,margin:'20px 0'}}><Stat label="النقاط" value={stats.score}/><Stat label="العملات" value={stats.coins}/><Stat label="نجوم المعرفة" value={stats.stars}/><Stat label="الإجابات الصحيحة" value={stats.correct}/></div>
      <button style={primary} onClick={resetGame}>إعادة المرحلة</button><button style={secondary} onClick={onClose}>العودة إلى الألعاب</button>
    </Card></Overlay>}
  </div>;
}

function Hud({text,color}:{text:string;color:string}){return <div style={{padding:'9px 13px',borderRadius:14,background:'rgba(7,21,47,.84)',border:`1px solid ${color}88`,color:'#fff',fontWeight:900,fontSize:15,boxShadow:'0 8px 25px rgba(0,0,0,.18)'}}>{text}</div>}
function Control({label,accent,large,onDown,onUp}:{label:string;accent?:boolean;large?:boolean;onDown:()=>void;onUp:()=>void}){return <button onPointerDown={e=>{e.preventDefault();onDown()}} onPointerUp={e=>{e.preventDefault();onUp()}} onPointerCancel={onUp} onPointerLeave={onUp} style={{width:large?74:64,height:large?74:64,borderRadius:24,border:'2px solid rgba(255,255,255,.55)',background:accent?'linear-gradient(145deg,rgba(245,158,11,.92),rgba(234,88,12,.92))':'rgba(7,21,47,.68)',color:'#fff',fontSize:label.length>1?16:27,fontWeight:900,boxShadow:'0 10px 28px rgba(0,0,0,.28)',touchAction:'none'}}>{label}</button>}
function Overlay({children,blur}:{children:React.ReactNode;blur?:boolean}){return <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:18,background:'rgba(2,12,32,.64)',backdropFilter:blur?'blur(5px)':'blur(2px)',overflow:'auto'}}>{children}</div>}
function Card({children,compact=false}:{children:React.ReactNode;compact?:boolean}){return <div style={{width:compact?'min(480px,54vw)':'min(560px,92vw)',maxHeight:compact?'68vh':'90vh',overflowY:'auto',textAlign:'center',padding:compact?'12px 18px':'30px 26px',borderRadius:30,background:'linear-gradient(145deg,rgba(7,28,60,.98),rgba(10,54,91,.97))',border:'2px solid rgba(56,189,248,.65)',boxShadow:'0 30px 90px rgba(0,0,0,.53)',color:'#fff'}}>{children}</div>}
function Stat({label,value}:{label:string;value:number}){return <div style={{padding:14,borderRadius:16,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.16)'}}><div style={{fontSize:24,fontWeight:950,color:'#FACC15'}}>{value}</div><div style={{fontSize:14,color:'#D7E7F6'}}>{label}</div></div>}
const title:React.CSSProperties={margin:'8px 0',fontSize:'clamp(30px,6vw,48px)',fontWeight:950,color:'#F8FAFC'};
const sub:React.CSSProperties={margin:'5px 0 12px',color:'#38BDF8',fontSize:19,fontWeight:900};
const body:React.CSSProperties={color:'#D7E7F6',fontSize:17,lineHeight:1.75,margin:'12px auto 22px',maxWidth:460};
const primary:React.CSSProperties={width:'100%',padding:'15px 20px',border:0,borderRadius:17,background:'linear-gradient(135deg,#F59E0B,#EA580C)',color:'#fff',fontSize:19,fontWeight:950,boxShadow:'0 12px 30px rgba(234,88,12,.3)',marginTop:8};
const secondary:React.CSSProperties={width:'100%',padding:'13px 20px',border:'1px solid rgba(255,255,255,.24)',borderRadius:17,background:'rgba(255,255,255,.06)',color:'#fff',fontSize:16,fontWeight:800,marginTop:10};
