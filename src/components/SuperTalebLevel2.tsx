import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SuperTalebLevelComponentProps,
  SuperTalebLevelResult,
  SuperTalebQuestion,
} from './SuperTalebCampaign';

type StationId = 'social' | 'arabic' | 'english' | 'science' | 'math';
type Motion = { left: boolean; right: boolean; jump: boolean; run: boolean };
type Player = {
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  grounded: boolean; facing: 1 | -1; lives: number; invulnerableUntil: number;
};
type Platform = { x: number; y: number; w: number; h: number; kind: 'floor'|'desk'|'books'|'ruler' };
type Station = { id: StationId; x: number; y: number; title: string; color: string; active: boolean };
type Hazard = { id: string; x: number; y: number; w: number; h: number; minX: number; maxX: number; vx: number; alive: boolean; kind: 'eraser'|'paper'|'bag' };
type Projectile = { x: number; y: number; vx: number; alive: boolean };

const WORLD_W = 6800;
const WORLD_H = 720;
const GROUND_Y = 590;
const POINTS_PER_CORRECT = 10;

const FALLBACK_QUESTIONS: SuperTalebQuestion[] = [
  { id: 'l2-fallback-1', question: 'ما عاصمة سلطنة عُمان؟', options: ['مسقط', 'صلالة', 'صحار', 'نزوى'], correctAnswerIndex: 0 },
  { id: 'l2-fallback-2', question: 'أي أداة تُستخدم لقياس الزمن؟', options: ['الساعة', 'المسطرة', 'الميزان', 'المجهر'], correctAnswerIndex: 0 },
  { id: 'l2-fallback-3', question: 'ناتج 6 × 4 يساوي:', options: ['20', '22', '24', '26'], correctAnswerIndex: 2 },
];

function questionText(q: SuperTalebQuestion): string { return String(q.question || q.text || 'اختر الإجابة الصحيحة'); }
function answerIndex(q: SuperTalebQuestion): number {
  if (Number.isInteger(q.correctAnswerIndex)) return Number(q.correctAnswerIndex);
  const opts = Array.isArray(q.options) ? q.options : [];
  const byText = opts.findIndex((option) => String(option) === String(q.correctAnswerText || ''));
  return Math.max(0, byText);
}
function stationIndex(id: StationId): number { return ({ social: 0, arabic: 1, english: 2, science: 3, math: 4 } as Record<StationId, number>)[id]; }

const SuperTalebLevel2: React.FC<SuperTalebLevelComponentProps> = ({
  questions,
  savedLevelState,
  onProgress,
  onComplete,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());
  const motionRef = useRef<Motion>({ left: false, right: false, jump: false, run: false });
  const playerRef = useRef<Player>({ x: 120, y: GROUND_Y - 82, vx: 0, vy: 0, w: 48, h: 82, grounded: true, facing: 1, lives: 3, invulnerableUntil: 0 });
  const cameraRef = useRef(0);
  const assetsRef = useRef<Record<string, HTMLImageElement>>({});
  const assetsReadyRef = useRef(false);
  const projectilesRef = useRef<Projectile[]>([]);
  const answerLockedRef = useRef(false);
  const completionSentRef = useRef(false);
  const safeXRef = useRef(120);

  const usableQuestions = useMemo(() => (questions.length ? questions : FALLBACK_QUESTIONS), [questions]);
  const initialActivated = (savedLevelState?.activatedStations as StationId[] | undefined) || [];
  const initialAnswered = (savedLevelState?.answeredQuestionIds as string[] | undefined) || [];
  const initialCorrect = (savedLevelState?.correctQuestionIds as string[] | undefined) || [];
  const initialWeak = (savedLevelState?.weakQuestionIds as string[] | undefined) || [];

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(Number(savedLevelState?.score || 0));
  const [pencilAmmo, setPencilAmmo] = useState(Number(savedLevelState?.pencilAmmo || 0));
  const [activatedStations, setActivatedStations] = useState<StationId[]>(initialActivated);
  const [answeredIds, setAnsweredIds] = useState<string[]>(initialAnswered);
  const [correctIds, setCorrectIds] = useState<string[]>(initialCorrect);
  const [weakIds, setWeakIds] = useState<string[]>(initialWeak);
  const [activeStation, setActiveStation] = useState<StationId | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<SuperTalebQuestion | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [message, setMessage] = useState('شغّل محطات الدراسات الاجتماعية واللغة العربية واللغة الإنجليزية والعلوم والرياضيات');
  const [showMessage, setShowMessage] = useState(true);
  const [orientation, setOrientation] = useState<'portrait'|'landscape'>(() => window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  const [lives, setLives] = useState(3);
  const [runEnabled, setRunEnabled] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const stationsRef = useRef<Station[]>([
    { id: 'social', x: 980, y: 466, title: 'الدراسات الاجتماعية', color: '#d97706', active: initialActivated.includes('social') },
    { id: 'arabic', x: 2180, y: 466, title: 'اللغة العربية', color: '#059669', active: initialActivated.includes('arabic') },
    { id: 'english', x: 3400, y: 466, title: 'اللغة الإنجليزية', color: '#2563eb', active: initialActivated.includes('english') },
    { id: 'science', x: 4660, y: 466, title: 'العلوم', color: '#0891b2', active: initialActivated.includes('science') },
    { id: 'math', x: 5860, y: 466, title: 'الرياضيات', color: '#7c3aed', active: initialActivated.includes('math') },
  ]);

  const platformsRef = useRef<Platform[]>([
    // مقاطع أرضية منفصلة: فجوات متوسطة 70–90 وحدة، قابلة للقفز دون جري إلزامي.
    { x: 0, y: GROUND_Y, w: 820, h: 130, kind: 'floor' },
    { x: 868, y: GROUND_Y, w: 820, h: 130, kind: 'floor' },
    { x: 1758, y: GROUND_Y, w: 760, h: 130, kind: 'floor' },
    { x: 2608, y: GROUND_Y, w: 790, h: 130, kind: 'floor' },
    { x: 3478, y: GROUND_Y, w: 800, h: 130, kind: 'floor' },
    { x: 4368, y: GROUND_Y, w: 800, h: 130, kind: 'floor' },
    { x: 5250, y: GROUND_Y, w: 760, h: 130, kind: 'floor' },
    { x: 6098, y: GROUND_Y, w: 670, h: 130, kind: 'floor' },
    { x: 420, y: 505, w: 220, h: 36, kind: 'desk' },
    { x: 690, y: 458, w: 150, h: 30, kind: 'books' },
    { x: 1160, y: 500, w: 245, h: 36, kind: 'desk' },
    { x: 1475, y: 448, w: 170, h: 30, kind: 'ruler' },
    { x: 1940, y: 505, w: 230, h: 34, kind: 'desk' },
    { x: 2215, y: 452, w: 175, h: 30, kind: 'books' },
    { x: 2780, y: 500, w: 230, h: 34, kind: 'ruler' },
    { x: 3070, y: 440, w: 180, h: 32, kind: 'books' },
    { x: 3650, y: 505, w: 225, h: 36, kind: 'desk' },
    { x: 3935, y: 455, w: 180, h: 30, kind: 'ruler' },
    { x: 4525, y: 500, w: 235, h: 36, kind: 'desk' },
    { x: 4820, y: 440, w: 175, h: 32, kind: 'books' },
    { x: 5415, y: 500, w: 220, h: 36, kind: 'ruler' },
    { x: 5690, y: 450, w: 170, h: 30, kind: 'books' },
    { x: 6250, y: 500, w: 230, h: 36, kind: 'desk' },
  ]);

  const hazardsRef = useRef<Hazard[]>([
    { id: 'eraser-1', x: 610, y: GROUND_Y - 42, w: 58, h: 42, minX: 520, maxX: 760, vx: 62, alive: true, kind: 'eraser' },
    { id: 'paper-1', x: 1320, y: GROUND_Y - 70, w: 58, h: 70, minX: 1120, maxX: 1580, vx: 76, alive: true, kind: 'paper' },
    { id: 'bag-1', x: 2010, y: GROUND_Y - 58, w: 64, h: 58, minX: 1980, maxX: 2160, vx: 0, alive: true, kind: 'bag' },
    { id: 'eraser-2', x: 2920, y: GROUND_Y - 42, w: 58, h: 42, minX: 2760, maxX: 3300, vx: 84, alive: true, kind: 'eraser' },
    { id: 'paper-2', x: 3760, y: GROUND_Y - 82, w: 62, h: 75, minX: 3560, maxX: 4120, vx: 88, alive: true, kind: 'paper' },
    { id: 'bag-2', x: 4690, y: GROUND_Y - 58, w: 64, h: 58, minX: 4630, maxX: 4820, vx: 0, alive: true, kind: 'bag' },
    { id: 'eraser-3', x: 5540, y: GROUND_Y - 42, w: 58, h: 42, minX: 5360, maxX: 5910, vx: 92, alive: true, kind: 'eraser' },
    { id: 'paper-3', x: 6300, y: GROUND_Y - 76, w: 60, h: 72, minX: 6150, maxX: 6650, vx: 90, alive: true, kind: 'paper' },
  ]);

  const persist = useCallback((patch: Record<string, unknown> = {}) => {
    onProgress?.({
      activatedStations,
      answeredQuestionIds: answeredIds,
      correctQuestionIds: correctIds,
      weakQuestionIds: weakIds,
      score,
      pencilAmmo,
      lives,
      playerX: playerRef.current.x,
      ...patch,
    });
  }, [activatedStations, answeredIds, correctIds, weakIds, score, pencilAmmo, lives, onProgress]);

  useEffect(() => { persist(); }, [persist]);
  useEffect(() => {
    setShowMessage(true);
    const timer = window.setTimeout(() => setShowMessage(false), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    let cancelled = false;
    const paths: Record<string,string> = {
      background:'/assets/games/super-taleb/level-2/backgrounds/smart-classroom.webp',
      socialStation:'/assets/games/super-taleb/level-2/stations/social-station.webp',
      scienceStation:'/assets/games/super-taleb/level-2/stations/science-station.webp',
      arabicStation:'/assets/games/super-taleb/level-2/stations/social-station.webp',
      englishStation:'/assets/games/super-taleb/level-2/stations/math-station.webp',
      mathStation:'/assets/games/super-taleb/level-2/stations/math-station.webp',
      socialKey:'/assets/games/super-taleb/level-2/items/social-key.webp',
      scienceKey:'/assets/games/super-taleb/level-2/items/science-key.webp',
      arabicKey:'/assets/games/super-taleb/level-2/items/social-key.webp',
      englishKey:'/assets/games/super-taleb/level-2/items/math-key.webp',
      mathKey:'/assets/games/super-taleb/level-2/items/math-key.webp',
      boardLocked:'/assets/games/super-taleb/level-2/items/smart-board-locked.webp',
      boardActive:'/assets/games/super-taleb/level-2/items/smart-board-active.webp',
      exitDoor:'/assets/games/super-taleb/level-2/items/classroom-exit.webp',
      floorLong:'/assets/games/super-taleb/level-2/terrain/floor-long.webp',
      floorShort:'/assets/games/super-taleb/level-2/terrain/floor-short.webp',
      desk:'/assets/games/super-taleb/level-2/terrain/desk-platform.webp',
      books:'/assets/games/super-taleb/level-2/terrain/book-stack-platform.webp',
      ruler:'/assets/games/super-taleb/level-2/terrain/ruler-platform.webp',
      movingBook:'/assets/games/super-taleb/level-2/terrain/moving-book-platform.webp',
      bookshelf:'/assets/games/super-taleb/level-2/terrain/bookshelf-platform.webp',
      eraser:'/assets/games/super-taleb/level-2/enemies/eraser.webp',
      paper:'/assets/games/super-taleb/level-2/enemies/flying-paper.webp',
      bag:'/assets/games/super-taleb/level-2/enemies/school-bag.webp',
      playerIdle:'/assets/games/super-taleb/player/idle.webp',
      playerWalk:'/assets/games/super-taleb/player/walk.webp',
      playerRun:'/assets/games/super-taleb/player/run.webp',
      playerJump:'/assets/games/super-taleb/player/jump.webp',
      playerFall:'/assets/games/super-taleb/player/fall.webp'
    };
    Promise.allSettled(Object.entries(paths).map(([key,src])=>new Promise<[string,HTMLImageElement]>((resolve,reject)=>{
      const image=new Image();
      image.onload=async()=>{ try { await image.decode?.(); } catch {} resolve([key,image]); };
      image.onerror=()=>reject(new Error(`Failed to load ${src}`));
      image.src=src;
    }))).then(results=>{
      if(cancelled) return;
      const entries=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
      assetsRef.current=Object.fromEntries(entries);
      assetsReadyRef.current=entries.length>0;
    });
    return()=>{cancelled=true;};
  },[]);

  useEffect(() => {
    const handleResize = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('orientationchange', handleResize); };
  }, []);

  const clearMotion = useCallback(() => { motionRef.current = { left: false, right: false, jump: false, run: false }; playerRef.current.vx = 0; setRunEnabled(false); }, []);

  const openStationQuestion = useCallback((station: Station) => {
    if (station.active || activeQuestion) return;
    clearMotion();
    const index = stationIndex(station.id);
    const unanswered = usableQuestions.filter((q) => !answeredIds.includes(String(q.id)));
    const selected = unanswered[0];
    // إذا كان عدد أسئلة اليوم أقل من المحطات، تعمل المحطة المتبقية كمنصة تقدم دون تكرار سؤال.
    if (!selected || index >= usableQuestions.length) {
      const nextActivated = Array.from(new Set([...activatedStations, station.id])) as StationId[];
      setActivatedStations(nextActivated);
      stationsRef.current.forEach((item) => { if (item.id === station.id) item.active = true; });
      setMessage(`تم تشغيل محطة ${station.title} — تابع إلى المحطة التالية`);
      persist({ activatedStations: nextActivated });
      return;
    }
    setActiveStation(station.id);
    setActiveQuestion(selected);
    answerLockedRef.current = false;
  }, [activeQuestion, activatedStations, answeredIds, clearMotion, persist, usableQuestions]);

  const handleAnswer = useCallback((choice: number) => {
    if (!activeQuestion || !activeStation || answerLockedRef.current) return;
    answerLockedRef.current = true;
    const id = String(activeQuestion.id);
    const correct = choice === answerIndex(activeQuestion);
    const nextAnswered = Array.from(new Set([...answeredIds, id]));
    const nextCorrect = correct ? Array.from(new Set([...correctIds, id])) : correctIds;
    const nextWeak = correct ? weakIds : Array.from(new Set([...weakIds, id]));
    const nextScore = score + (correct ? POINTS_PER_CORRECT : 0);
    const nextAmmo = pencilAmmo + (correct ? 1 : 0);

    setAnsweredIds(nextAnswered); setCorrectIds(nextCorrect); setWeakIds(nextWeak);
    setScore(nextScore); setPencilAmmo(nextAmmo);
    setFeedback({ correct, text: correct ? 'إجابة صحيحة! +10 نقاط وطلقة قلم' : 'إجابة غير صحيحة — تستمر المغامرة دون خصم قلب' });

    window.setTimeout(() => {
      const nextActivated = Array.from(new Set([...activatedStations, activeStation])) as StationId[];
      setActivatedStations(nextActivated);
      stationsRef.current.forEach((station) => { if (station.id === activeStation) station.active = true; });
      setMessage(`تم تشغيل محطة ${stationsRef.current.find((s) => s.id === activeStation)?.title || ''}`);
      setActiveQuestion(null); setActiveStation(null); setFeedback(null);
      persist({ activatedStations: nextActivated, answeredQuestionIds: nextAnswered, correctQuestionIds: nextCorrect, weakQuestionIds: nextWeak, score: nextScore, pencilAmmo: nextAmmo });
    }, 850);
  }, [activeQuestion, activeStation, activatedStations, answeredIds, correctIds, weakIds, score, pencilAmmo, persist]);

  const shootPencil = useCallback(() => {
    if (pencilAmmo <= 0 || activeQuestion || !started || finished) return;
    const p = playerRef.current;
    projectilesRef.current.push({ x: p.x + (p.facing === 1 ? p.w : -10), y: p.y + 35, vx: p.facing * 620, alive: true });
    setPencilAmmo((value) => Math.max(0, value - 1));
  }, [pencilAmmo, activeQuestion, started, finished]);

  const finishLevel = useCallback(() => {
    if (completionSentRef.current) return;
    completionSentRef.current = true;
    setFinished(true); clearMotion();
    const result: SuperTalebLevelResult = {
      score: correctIds.length * POINTS_PER_CORRECT,
      pointsEarned: correctIds.length * POINTS_PER_CORRECT,
      correct: correctIds.length,
      wrong: weakIds.length,
      correctAnswers: correctIds.length,
      wrongAnswers: weakIds.length,
      completed: true,
      weakQuestionIds: weakIds,
      answeredQuestionIds: answeredIds,
      correctQuestionIds: correctIds,
      pencilAmmo,
      activatedStations,
      keysCollected: activatedStations.length,
    };
    onComplete(result);
  }, [activatedStations, answeredIds, clearMotion, correctIds, onComplete, pencilAmmo, weakIds]);

  const damagePlayer = useCallback((sourceX: number) => {
    const now = performance.now(); const p = playerRef.current;
    if (now < p.invulnerableUntil) return;
    p.invulnerableUntil = now + 2200;
    p.x = Math.max(80, safeXRef.current); p.y = GROUND_Y - p.h; p.vx = sourceX > p.x ? -80 : 80; p.vy = -180;
    const nextLives = Math.max(0, p.lives - 1); p.lives = nextLives; setLives(nextLives); clearMotion();
    if (nextLives <= 0) {
      p.vx = 0; p.vy = 0;
      setGameOver(true);
      setMessage('انتهت المحاولة — أعد المرحلة من البداية');
    }
  }, [clearMotion]);

  const restartAttempt = useCallback(() => {
    const p = playerRef.current;
    p.x = 120; p.y = GROUND_Y - p.h; p.vx = 0; p.vy = 0; p.grounded = true;
    p.lives = 3; p.invulnerableUntil = performance.now() + 1800;
    safeXRef.current = 120; cameraRef.current = 0;
    hazardsRef.current.forEach((hazard) => { hazard.alive = true; });
    projectilesRef.current = [];
    setLives(3); setGameOver(false); setRunEnabled(false);
    motionRef.current = { left:false, right:false, jump:false, run:false };
    setMessage('بدأت محاولة جديدة من أول فصل راصد الذكي');
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') motionRef.current.left = true;
      if (event.key === 'ArrowRight' || event.key === 'd') motionRef.current.right = true;
      if (event.key === 'ArrowUp' || event.key === ' ' || event.key === 'w') motionRef.current.jump = true;
      if (event.key === 'Shift') motionRef.current.run = true;
      if (event.key === 'f') shootPencil();
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') motionRef.current.left = false;
      if (event.key === 'ArrowRight' || event.key === 'd') motionRef.current.right = false;
      if (event.key === 'ArrowUp' || event.key === ' ' || event.key === 'w') motionRef.current.jump = false;
      if (event.key === 'Shift') motionRef.current.run = false;
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [shootPencil]);

  useEffect(() => {
    if (!started || activeQuestion || finished || gameOver) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);

    const overlap = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

    const loop = (time: number) => {
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0); lastTimeRef.current = time;
      const p = playerRef.current; const motion = motionRef.current;
      const speed = motion.run ? 390 : 195;
      const axis = (motion.right ? 1 : 0) - (motion.left ? 1 : 0);
      p.vx += (axis * speed - p.vx) * Math.min(1, dt * 12);
      if (axis) p.facing = axis > 0 ? 1 : -1;
      if (motion.jump && p.grounded) { p.vy = -505; p.grounded = false; motion.jump = false; }
      p.vy += 1250 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.x = Math.max(0, Math.min(WORLD_W - p.w, p.x));

      const previousBottom = p.y + p.h - p.vy * dt; p.grounded = false;
      platformsRef.current.forEach((platform) => {
        if (p.x + p.w * 0.8 > platform.x && p.x + p.w * 0.2 < platform.x + platform.w && previousBottom <= platform.y + 12 && p.y + p.h >= platform.y && p.vy >= 0) {
          p.y = platform.y - p.h; p.vy = 0; p.grounded = true;
          if (platform.kind === 'floor' && p.x > safeXRef.current + 180) safeXRef.current = p.x;
        }
      });
      if (p.y > WORLD_H + 100) damagePlayer(p.x);

      hazardsRef.current.forEach((hazard) => {
        if (!hazard.alive) return;
        hazard.x += hazard.vx * dt;
        if (hazard.x <= hazard.minX || hazard.x >= hazard.maxX) hazard.vx *= -1;
        const body = { x: p.x + 10, y: p.y + 14, w: p.w - 20, h: p.h - 18 };
        const target = { x: hazard.x + 9, y: hazard.y + 8, w: hazard.w - 18, h: hazard.h - 10 };
        if (overlap(body, target)) damagePlayer(hazard.x);
      });

      projectilesRef.current.forEach((shot) => {
        if (!shot.alive) return; shot.x += shot.vx * dt;
        hazardsRef.current.forEach((hazard) => { if (hazard.alive && overlap({x:shot.x,y:shot.y,w:24,h:8}, hazard)) { hazard.alive = false; shot.alive = false; } });
        if (shot.x < cameraRef.current - 100 || shot.x > cameraRef.current + 1700) shot.alive = false;
      });
      projectilesRef.current = projectilesRef.current.filter((shot) => shot.alive);

      stationsRef.current.forEach((station) => {
        if (!station.active && Math.abs((p.x+p.w/2) - station.x) < 72 && p.y + p.h > station.y - 20) openStationQuestion(station);
      });

      if (p.x > 6380) {
        if (activatedStations.length === 5) finishLevel();
        else { p.x = 6320; setMessage(`فعّل المحطات المتبقية: ${5 - activatedStations.length}`); }
      }

      const viewW = canvas.clientWidth; const viewH = canvas.clientHeight;
      const portraitView = viewH > viewW;
      // نفس منطق المرحلة الأولى: الوضع الأفقي يعرض مساحة أوسع بدل تكبير العالم.
      const sceneScale = portraitView
        ? Math.max(0.86, Math.min(1.12, viewH / 700))
        : Math.max(0.80, Math.min(1.04, viewH / 560));
      const bottomClearance = portraitView ? 150 : 118;
      const sceneOffsetY = viewH - (GROUND_Y + bottomClearance) * sceneScale;
      const visibleWorldW = viewW / sceneScale;
      cameraRef.current += (
        Math.max(0, Math.min(WORLD_W - visibleWorldW, p.x - visibleWorldW * 0.32)) - cameraRef.current
      ) * Math.min(1, dt * 6);
      const camera = cameraRef.current;

      const bg = ctx.createLinearGradient(0, 0, 0, viewH); bg.addColorStop(0, '#dff4ff'); bg.addColorStop(1, '#f8e7bd'); ctx.fillStyle = bg; ctx.fillRect(0,0,viewW,viewH);
      const assets=assetsRef.current;
      if(assetsReadyRef.current&&assets.background){
        const bgImage=assets.background;
        const segmentW=1360;
        for(let bx=-(camera*.16)%segmentW-segmentW;bx<viewW+segmentW;bx+=segmentW){ctx.drawImage(bgImage,bx,0,segmentW,Math.max(viewH,690));}
      }
      ctx.save(); ctx.translate(0, sceneOffsetY); ctx.scale(sceneScale, sceneScale); ctx.translate(-camera, 0);
      // إظهار الفجوات الحقيقية بعمق واضح دون إضافة سطح اصطدام وهمي.
      const groundPieces = platformsRef.current.filter(platform => platform.kind === 'floor').sort((a,b) => a.x-b.x);
      for(let index=0; index<groundPieces.length-1; index++){
        const left=groundPieces[index].x+groundPieces[index].w;
        const right=groundPieces[index+1].x;
        if(right<=left) continue;
        const pit=ctx.createLinearGradient(0,GROUND_Y-5,0,GROUND_Y+145);
        pit.addColorStop(0,'rgba(15,23,42,.42)'); pit.addColorStop(1,'rgba(2,6,23,.96)');
        ctx.fillStyle=pit; ctx.fillRect(left,GROUND_Y-4,right-left,170);
        ctx.strokeStyle='rgba(251,191,36,.78)'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(left,GROUND_Y);ctx.lineTo(left+9,GROUND_Y+14);ctx.moveTo(right,GROUND_Y);ctx.lineTo(right-9,GROUND_Y+14);ctx.stroke();
      }
      if(!assetsReadyRef.current){
        ctx.fillStyle = '#f4dfb3'; ctx.fillRect(0, 90, WORLD_W, 500);
        for (let x = 250; x < WORLD_W; x += 640) { ctx.fillStyle = '#bfe8ff'; ctx.fillRect(x, 155, 250, 145); ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = 12; ctx.strokeRect(x,155,250,145); }
      }

      platformsRef.current.forEach((platform) => {
        let image:HTMLImageElement|undefined;
        if(assetsReadyRef.current){
          image=platform.kind==='floor'?(platform.w>900?assets.floorLong:assets.floorShort):platform.kind==='desk'?assets.desk:platform.kind==='books'?assets.books:assets.ruler;
        }
        if(image){
          // أعلى الصورة يساوي platform.y، وهو سطح التصادم نفسه.
          const drawH=platform.kind==='floor'?Math.max(138,platform.h):Math.max(52,platform.h+22);
          ctx.drawImage(image,platform.x,platform.y,platform.w,drawH);
          return;
        }
        if(platform.kind==='floor'){
          const floorGradient=ctx.createLinearGradient(0,platform.y,0,platform.y+platform.h);
          floorGradient.addColorStop(0,'#e7bc7c');floorGradient.addColorStop(.18,'#b87940');floorGradient.addColorStop(1,'#5b3520');
          ctx.fillStyle=floorGradient;ctx.fillRect(platform.x,platform.y,platform.w,platform.h);
          ctx.fillStyle='#f7d49a';ctx.fillRect(platform.x,platform.y,platform.w,10);
        }else{
          ctx.fillStyle=platform.kind==='ruler'?'#facc15':platform.kind==='books'?'#2563eb':'#8b5a2b';
          ctx.fillRect(platform.x,platform.y,platform.w,Math.max(42,platform.h));
        }
      });

      stationsRef.current.forEach((station) => {
        const image=station.id==='social'?assets.socialStation:station.id==='arabic'?assets.arabicStation:station.id==='english'?assets.englishStation:station.id==='science'?assets.scienceStation:assets.mathStation;
        const keyImage=station.id==='social'?assets.socialKey:station.id==='arabic'?assets.arabicKey:station.id==='english'?assets.englishKey:station.id==='science'?assets.scienceKey:assets.mathKey;
        if(assetsReadyRef.current&&image){
          ctx.save();ctx.globalAlpha=station.active?1:.88;ctx.drawImage(image,station.x-76,station.y-120,152,120);ctx.restore();
          if(station.id==='arabic'||station.id==='english'){
            ctx.save();ctx.fillStyle=station.color;ctx.beginPath();ctx.roundRect(station.x-57,station.y-61,114,32,12);ctx.fill();ctx.fillStyle='white';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillText(station.id==='arabic'?'اللغة العربية':'English',station.x,station.y-40);ctx.restore();
          }
          if(station.active&&keyImage)ctx.drawImage(keyImage,station.x-23,station.y-166,46,74);
        }else{
          ctx.save();ctx.translate(station.x, station.y);ctx.fillStyle=station.active?'#22c55e':station.color;ctx.fillRect(-44,-72,88,72);ctx.restore();
        }
      });

      hazardsRef.current.forEach((hazard) => {
        if(!hazard.alive)return;
        const image=hazard.kind==='eraser'?assets.eraser:hazard.kind==='paper'?assets.paper:assets.bag;
        ctx.save();ctx.translate(hazard.x,hazard.y);
        if(hazard.vx<0){ctx.translate(hazard.w,0);ctx.scale(-1,1);}
        if(assetsReadyRef.current&&image){
          const ratio=Math.min(hazard.w/image.naturalWidth,hazard.h/image.naturalHeight);
          const drawW=image.naturalWidth*ratio, drawH=image.naturalHeight*ratio;
          ctx.drawImage(image,(hazard.w-drawW)/2,hazard.h-drawH,drawW,drawH);
        }else{
          ctx.fillStyle=hazard.kind==='eraser'?'#f472b6':hazard.kind==='paper'?'#f8fafc':'#7c2d12';
          ctx.fillRect(0,0,hazard.w,hazard.h);
        }
        ctx.restore();
      });
      projectilesRef.current.forEach((shot)=>{ctx.fillStyle='#facc15';ctx.fillRect(shot.x,shot.y,28,7);ctx.fillStyle='#ec4899';ctx.beginPath();ctx.moveTo(shot.x+28,shot.y);ctx.lineTo(shot.x+36,shot.y+3.5);ctx.lineTo(shot.x+28,shot.y+7);ctx.fill();});

      // السبورة الذكية النهائية
      const boardImage=activatedStations.length===5?assets.boardActive:assets.boardLocked;
      if(assetsReadyRef.current&&boardImage)ctx.drawImage(boardImage,6480,255,285,235);else{ctx.fillStyle=activatedStations.length===5?'#0ea5e9':'#334155';ctx.fillRect(6490,260,270,230);}
      if(activatedStations.length===5&&assets.exitDoor)ctx.drawImage(assets.exitDoor,6680,350,105,240);

      const blink = performance.now() < p.invulnerableUntil && Math.floor(performance.now()/100)%2===0;
      if(!blink){
        let image=assets.playerIdle,frames=6,fps=5;
        if(!p.grounded){image=p.vy<0?assets.playerJump:assets.playerFall;frames=p.vy<0?7:5;fps=8;}
        else if(Math.abs(p.vx)>220){image=assets.playerRun;frames=7;fps=12;}
        else if(Math.abs(p.vx)>20){image=assets.playerWalk;frames=7;fps=9;}
        ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h);ctx.scale(p.facing,1);
        if(assetsReadyRef.current&&image){const frame=Math.floor(time/1000*fps)%frames;ctx.drawImage(image,frame*256,0,256,256,-58,-116,116,116);}
        else{ctx.fillStyle='#fff';ctx.fillRect(-18,-78,36,78);}ctx.restore();
      }
      ctx.restore();

      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { observer.disconnect(); if(frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [started, activeQuestion, finished, gameOver, activatedStations.length, correctIds.length, pencilAmmo, score, lives, damagePlayer, finishLevel, openStationQuestion, message]);

  const press = (key: keyof Motion, value: boolean) => { motionRef.current[key] = value; };
  const touchButton = (key:keyof Motion) => (down:boolean) => () => press(key,down);

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-slate-950" dir="rtl">
      <canvas ref={canvasRef} className="h-full w-full" />
      {started && !finished && !gameOver && (
        <div style={{position:'absolute',top:orientation==='landscape'?8:12,left:12,right:12,display:'flex',justifyContent:'space-between',alignItems:'center',pointerEvents:'none',transform:orientation==='landscape'?'scale(.92)':'none',transformOrigin:'top center',zIndex:12}}>
          <button type="button" onClick={onClose} style={{pointerEvents:'auto',width:46,height:46,borderRadius:16,border:'1px solid rgba(255,255,255,.35)',background:'rgba(7,21,47,.85)',color:'#fff',fontSize:23,fontWeight:900}}>×</button>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <Level2Hud text={`❤️ ${lives}`} color="#EF4444" />
            <Level2Hud text={`⭐ ${correctIds.length}`} color="#FACC15" />
            <Level2Hud text={`✏️ ${pencilAmmo}`} color="#22D3EE" />
            <Level2Hud text={`النقاط ${score}`} color="#38BDF8" />
          </div>
        </div>
      )}
      {started && !activeQuestion && !finished && !gameOver && showMessage && (
        <div style={{position:'absolute',top:orientation==='landscape'?72:82,left:'50%',transform:'translateX(-50%)',maxWidth:orientation==='landscape'?'60vw':'88vw',padding:orientation==='landscape'?'8px 16px':'10px 14px',borderRadius:16,background:'rgba(248,250,252,.92)',border:'1px solid rgba(56,189,248,.35)',boxShadow:'0 8px 24px rgba(0,0,0,.15)',color:'#0f172a',fontWeight:800,fontSize:orientation==='landscape'?14:15,textAlign:'center',zIndex:11,pointerEvents:'none'}}>{message}</div>
      )}
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-sky-300/40 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <div className="text-6xl">📚</div><h2 className="mt-2 text-3xl font-black">فصل راصد الذكي</h2>
            <p className="mt-3 leading-7 text-slate-300">شغّل محطات الدراسات الاجتماعية واللغة العربية واللغة الإنجليزية والعلوم والرياضيات، ثم افتح السبورة الذكية.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3"><div className="rounded-xl bg-amber-500/20 p-3">🗺️ الدراسات الاجتماعية</div><div className="rounded-xl bg-emerald-500/20 p-3">ض اللغة العربية</div><div className="rounded-xl bg-blue-500/20 p-3">A اللغة الإنجليزية</div><div className="rounded-xl bg-cyan-500/20 p-3">🔬 العلوم</div><div className="rounded-xl bg-violet-500/20 p-3">➗ الرياضيات</div></div>
            <button onClick={()=>setStarted(true)} className="mt-6 rounded-2xl bg-sky-400 px-8 py-3 font-black text-slate-950">ابدأ المرحلة الثانية</button>
          </div>
        </div>
      )}
      {activeQuestion && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-sky-300 bg-white p-5 text-right shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">محطة {stationsRef.current.find(s=>s.id===activeStation)?.title}</span><span className="text-sm font-bold text-slate-500">سؤال المعرفة</span></div>
            <h3 className="mb-5 text-xl font-black leading-8 text-slate-900">{questionText(activeQuestion)}</h3>
            <div className="grid gap-3">{(activeQuestion.options || []).map((option,index)=><button key={index} disabled={Boolean(feedback)} onClick={()=>handleAnswer(index)} className="rounded-2xl border-2 border-sky-200 bg-white p-4 text-right font-bold text-slate-800 shadow-sm disabled:opacity-80">{index+1}. {option}</button>)}</div>
            {feedback && <div className={`mt-4 rounded-2xl p-4 text-center font-black ${feedback.correct?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{feedback.text}</div>}
          </div>
        </div>
      )}
      {started && !activeQuestion && !finished && !gameOver && (
        <div style={{position:'absolute',bottom:orientation==='landscape'?10:14,left:orientation==='landscape'?30:18,right:orientation==='landscape'?30:18,display:'flex',justifyContent:'space-between',alignItems:'flex-end',pointerEvents:'none',zIndex:12}}>
          <div style={{display:'flex',gap:orientation==='landscape'?24:18,direction:'ltr',pointerEvents:'auto'}}>
            <Level2Control label="◀" large={orientation==='landscape'} onDown={touchButton('left')(true)} onUp={touchButton('left')(false)} />
            <Level2Control label="▶" large={orientation==='landscape'} onDown={touchButton('right')(true)} onUp={touchButton('right')(false)} />
          </div>
          <div style={{display:'flex',gap:orientation==='landscape'?18:12,alignItems:'flex-end',direction:'ltr',pointerEvents:'auto'}}>
            {pencilAmmo > 0 && <button type="button" onClick={shootPencil} style={{width:orientation==='landscape'?74:64,height:orientation==='landscape'?74:64,borderRadius:24,border:'3px solid #A5F3FC',background:'linear-gradient(145deg,#0891B2,#0E7490)',color:'#fff',fontSize:15,fontWeight:900,touchAction:'none',boxShadow:'0 10px 28px rgba(0,0,0,.28)'}}>✏️ {pencilAmmo}</button>}
            <button type="button" onClick={()=>{const next=!runEnabled;setRunEnabled(next);motionRef.current.run=next;}} style={{width:orientation==='landscape'?74:64,height:orientation==='landscape'?74:64,borderRadius:24,border:runEnabled?'3px solid #FDE68A':'2px solid rgba(255,255,255,.55)',background:runEnabled?'linear-gradient(145deg,rgba(14,165,233,.92),rgba(3,105,161,.92))':'rgba(7,21,47,.68)',color:'#fff',fontSize:17,fontWeight:900,boxShadow:'0 10px 28px rgba(0,0,0,.28)',touchAction:'none'}}>{runEnabled?'إيقاف':'جري'}</button>
            <Level2Control label="قفز" large={orientation==='landscape'} accent onDown={touchButton('jump')(true)} onUp={touchButton('jump')(false)} />
          </div>
        </div>
      )}
      {gameOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-rose-300 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <div className="text-6xl">❤️‍🩹</div>
            <h2 className="mt-3 text-2xl font-black">انتهت المحاولة</h2>
            <p className="mt-3 leading-7 text-slate-300">خسرت القلوب الثلاثة. ستعود الحركة من بداية المرحلة، مع بقاء نتائج الأسئلة التعليمية محفوظة.</p>
            <button type="button" onClick={restartAttempt} className="mt-5 w-full rounded-2xl bg-rose-400 py-3 font-black text-slate-950">إعادة المرحلة من البداية</button>
          </div>
        </div>
      )}
      {finished && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-amber-300 bg-slate-900 p-6 text-center text-white"><div className="text-6xl">🖥️</div><h2 className="mt-2 text-2xl font-black">تم تشغيل فصل راصد الذكي</h2><p className="mt-3 text-slate-300">شغّلت المحطات الخمس وجمعت مفاتيح المعرفة وفتحت السبورة الذكية.</p><div className="my-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-800 p-3"><b className="text-amber-300">{score}</b><small className="block">النقاط</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-emerald-300">{correctIds.length}</b><small className="block">صحيح</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-sky-300">5</b><small className="block">المفاتيح</small></div></div><button onClick={onClose} className="w-full rounded-2xl bg-amber-400 py-3 font-black text-slate-950">متابعة الرحلة</button></div></div>
      )}
    </div>
  );
};

function Level2Hud({text,color}:{text:string;color:string}){
  return <div style={{padding:'9px 13px',borderRadius:14,background:'rgba(7,21,47,.84)',border:`1px solid ${color}88`,color:'#fff',fontWeight:900,fontSize:15,boxShadow:'0 8px 25px rgba(0,0,0,.18)'}}>{text}</div>;
}
function Level2Control({label,accent,large,onDown,onUp}:{label:string;accent?:boolean;large?:boolean;onDown:()=>void;onUp:()=>void}){
  return <button type="button" onContextMenu={event=>event.preventDefault()} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture?.(event.pointerId);onDown();}} onPointerUp={event=>{event.preventDefault();if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture?.(event.pointerId);onUp();}} onPointerCancel={onUp} onLostPointerCapture={onUp} style={{width:large?74:64,height:large?74:64,borderRadius:24,border:'2px solid rgba(255,255,255,.55)',background:accent?'linear-gradient(145deg,rgba(245,158,11,.92),rgba(234,88,12,.92))':'rgba(7,21,47,.68)',color:'#fff',fontSize:label.length>1?16:27,fontWeight:900,boxShadow:'0 10px 28px rgba(0,0,0,.28)',touchAction:'none',WebkitUserSelect:'none',userSelect:'none'}}>{label}</button>;
}

export default SuperTalebLevel2;
