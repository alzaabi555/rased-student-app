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
  const [orientation, setOrientation] = useState<'portrait'|'landscape'>(() => window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  const [lives, setLives] = useState(3);

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
    { x: 900, y: GROUND_Y, w: 820, h: 130, kind: 'floor' },
    { x: 1800, y: GROUND_Y, w: 760, h: 130, kind: 'floor' },
    { x: 2645, y: GROUND_Y, w: 790, h: 130, kind: 'floor' },
    { x: 3515, y: GROUND_Y, w: 800, h: 130, kind: 'floor' },
    { x: 4400, y: GROUND_Y, w: 800, h: 130, kind: 'floor' },
    { x: 5285, y: GROUND_Y, w: 760, h: 130, kind: 'floor' },
    { x: 6130, y: GROUND_Y, w: 670, h: 130, kind: 'floor' },
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
    Promise.all(Object.entries(paths).map(([key,src])=>new Promise<[string,HTMLImageElement]>((resolve,reject)=>{
      const image=new Image(); image.onload=()=>resolve([key,image]); image.onerror=reject; image.src=src;
    }))).then(entries=>{if(!cancelled){assetsRef.current=Object.fromEntries(entries);assetsReadyRef.current=true;}})
      .catch(error=>{console.warn('SuperTaleb Level 2 assets fallback',error);assetsReadyRef.current=false;});
    return()=>{cancelled=true;};
  },[]);

  useEffect(() => {
    const handleResize = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('orientationchange', handleResize); };
  }, []);

  const clearMotion = useCallback(() => { motionRef.current = { left: false, right: false, jump: false, run: false }; playerRef.current.vx = 0; }, []);

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
    if (nextLives <= 0) { p.lives = 3; setLives(3); p.x = safeXRef.current; setMessage('عدت إلى آخر نقطة آمنة'); }
  }, [clearMotion]);

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
    if (!started || activeQuestion || finished) return;
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
      const speed = motion.run ? 260 : 175;
      const axis = (motion.right ? 1 : 0) - (motion.left ? 1 : 0);
      p.vx += (axis * speed - p.vx) * Math.min(1, dt * 12);
      if (axis) p.facing = axis > 0 ? 1 : -1;
      if (motion.jump && p.grounded) { p.vy = -465; p.grounded = false; motion.jump = false; }
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
        if (shot.x < cameraRef.current - 100 || shot.x > cameraRef.current + 1500) shot.alive = false;
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
      cameraRef.current += (Math.max(0, Math.min(WORLD_W - viewW, p.x - viewW * 0.34)) - cameraRef.current) * Math.min(1, dt * 6);
      const camera = cameraRef.current;

      const bg = ctx.createLinearGradient(0, 0, 0, viewH); bg.addColorStop(0, '#dff4ff'); bg.addColorStop(1, '#f8e7bd'); ctx.fillStyle = bg; ctx.fillRect(0,0,viewW,viewH);
      const assets=assetsRef.current;
      if(assetsReadyRef.current&&assets.background){
        const bgImage=assets.background;
        const segmentW=1360;
        for(let bx=-(camera*.16)%segmentW-segmentW;bx<viewW+segmentW;bx+=segmentW){ctx.drawImage(bgImage,bx,0,segmentW,Math.max(viewH,690));}
      }
      ctx.save(); ctx.translate(-camera, 0);
      if(!assetsReadyRef.current){
        ctx.fillStyle = '#f4dfb3'; ctx.fillRect(0, 90, WORLD_W, 500);
        for (let x = 250; x < WORLD_W; x += 640) { ctx.fillStyle = '#bfe8ff'; ctx.fillRect(x, 155, 250, 145); ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = 12; ctx.strokeRect(x,155,250,145); }
      }

      platformsRef.current.forEach((platform) => {
        let image:HTMLImageElement|undefined;
        if(assetsReadyRef.current){
          image=platform.kind==='floor'?(platform.w>900?assets.floorLong:assets.floorShort):platform.kind==='desk'?assets.desk:platform.kind==='books'?assets.books:assets.ruler;
        }
        if(image){const drawH=platform.kind==='floor'?Math.max(130,platform.h):Math.max(58,platform.h+26);ctx.drawImage(image,platform.x,platform.y,platform.w,drawH);return;}
        if (platform.kind === 'floor') { ctx.fillStyle = '#c28b50'; ctx.fillRect(platform.x,platform.y,platform.w,platform.h); }
        else { ctx.fillStyle=platform.kind==='ruler'?'#facc15':'#8b5a2b';ctx.fillRect(platform.x,platform.y,platform.w,platform.h); }
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

      hazardsRef.current.forEach((hazard) => { if(!hazard.alive)return;const image=hazard.kind==='eraser'?assets.eraser:hazard.kind==='paper'?assets.paper:assets.bag;ctx.save();ctx.translate(hazard.x,hazard.y);if(hazard.vx<0){ctx.translate(hazard.w,0);ctx.scale(-1,1);}if(assetsReadyRef.current&&image)ctx.drawImage(image,-8,-12,hazard.w+16,hazard.h+16);else{ctx.fillStyle=hazard.kind==='eraser'?'#f472b6':hazard.kind==='paper'?'#f8fafc':'#7c2d12';ctx.fillRect(0,0,hazard.w,hazard.h);}ctx.restore(); });
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
        if(assetsReadyRef.current&&image){const frame=Math.floor(time/1000*fps)%frames;ctx.drawImage(image,frame*256,0,256,256,-58,-104,116,116);}
        else{ctx.fillStyle='#fff';ctx.fillRect(-18,-78,36,78);}ctx.restore();
      }
      ctx.restore();

      // HUD
      ctx.fillStyle='rgba(15,23,42,.88)';ctx.fillRect(12,12,Math.min(560,viewW-24),58);ctx.fillStyle='white';ctx.font='bold 17px sans-serif';ctx.textAlign='left';ctx.fillText(`❤️ ${lives}   ⭐ ${correctIds.length}   ✏️ ${pencilAmmo}   النقاط ${score}`,28,48);
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(14,78,Math.min(680,viewW-28),46);ctx.fillStyle='#0f172a';ctx.font='bold 15px sans-serif';ctx.fillText(message,28,107);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { observer.disconnect(); if(frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [started, activeQuestion, finished, activatedStations.length, correctIds.length, pencilAmmo, score, lives, damagePlayer, finishLevel, openStationQuestion, message]);

  const press = (key: keyof Motion, value: boolean) => { motionRef.current[key] = value; };
  const controlSize = orientation === 'landscape' ? 76 : 68;
  const baseBtn: React.CSSProperties = { width: controlSize, height: controlSize, borderRadius: 22, border: '2px solid rgba(255,255,255,.65)', background: 'rgba(15,23,42,.85)', color: 'white', fontWeight: 900, fontSize: 23, boxShadow: '0 8px 22px rgba(0,0,0,.25)', touchAction: 'none' };

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-slate-950" dir="rtl">
      <canvas ref={canvasRef} className="h-full w-full" />
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-sky-300/40 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <div className="text-6xl">📚</div><h2 className="mt-2 text-3xl font-black">فصل راصد الذكي</h2>
            <p className="mt-3 leading-7 text-slate-300">شغّل محطة الدراسات الاجتماعية ومحطة العلوم ومحطة الرياضيات، واجمع مفاتيح المعرفة لفتح السبورة الذكية.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><div className="rounded-xl bg-amber-500/20 p-3">🗺️ الدراسات الاجتماعية</div><div className="rounded-xl bg-cyan-500/20 p-3">🔬 العلوم</div><div className="rounded-xl bg-violet-500/20 p-3">➗ الرياضيات</div></div>
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
      {started && !activeQuestion && !finished && (
        <>
          {/* أزرار الاتجاهات في الجهة اليسرى لسهولة التحكم بالإبهام */}
          <div style={{ position: 'absolute', left: 18, bottom: 20, display: 'flex', gap: orientation === 'landscape' ? 24 : 18, direction: 'ltr' }}>
            <button
              aria-label="تحرك إلى اليسار"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); press('left', true); }}
              onPointerUp={(event) => { event.currentTarget.releasePointerCapture?.(event.pointerId); press('left', false); }}
              onPointerCancel={() => press('left', false)}
              onPointerLeave={(event) => { if (event.buttons === 0) press('left', false); }}
              style={baseBtn}
            >◀</button>
            <button
              aria-label="تحرك إلى اليمين"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); press('right', true); }}
              onPointerUp={(event) => { event.currentTarget.releasePointerCapture?.(event.pointerId); press('right', false); }}
              onPointerCancel={() => press('right', false)}
              onPointerLeave={(event) => { if (event.buttons === 0) press('right', false); }}
              style={baseBtn}
            >▶</button>
          </div>

          {/* القفز والجري في الجهة اليمنى */}
          <div style={{ position: 'absolute', right: 18, bottom: 20, display: 'flex', gap: orientation === 'landscape' ? 18 : 14, alignItems: 'flex-end', direction: 'ltr' }}>
            {pencilAmmo > 0 && (
              <button
                type="button"
                aria-label="إطلاق قلم المعرفة"
                onClick={shootPencil}
                style={{ ...baseBtn, fontSize: 18, background: 'rgba(14,116,144,.92)' }}
              >✏️ {pencilAmmo}</button>
            )}
            <button
              aria-label="الجري"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); press('run', true); }}
              onPointerUp={(event) => { event.currentTarget.releasePointerCapture?.(event.pointerId); press('run', false); }}
              onPointerCancel={() => press('run', false)}
              onPointerLeave={(event) => { if (event.buttons === 0) press('run', false); }}
              style={{ ...baseBtn, fontSize: 15, background: 'rgba(37,99,235,.93)' }}
            >جري</button>
            <button
              aria-label="قفز"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); press('jump', true); }}
              onPointerUp={(event) => { event.currentTarget.releasePointerCapture?.(event.pointerId); press('jump', false); }}
              onPointerCancel={() => press('jump', false)}
              style={{ ...baseBtn, background: '#f97316', fontSize: 16 }}
            >قفز</button>
          </div>
          <button onClick={onClose} className="absolute left-4 top-4 rounded-2xl bg-slate-900/90 px-4 py-3 font-black text-white">×</button>
        </>
      )}
      {finished && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-amber-300 bg-slate-900 p-6 text-center text-white"><div className="text-6xl">🖥️</div><h2 className="mt-2 text-2xl font-black">تم تشغيل فصل راصد الذكي</h2><p className="mt-3 text-slate-300">شغّلت المحطات الخمس وجمعت مفاتيح المعرفة وفتحت السبورة الذكية.</p><div className="my-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-800 p-3"><b className="text-amber-300">{score}</b><small className="block">النقاط</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-emerald-300">{correctIds.length}</b><small className="block">صحيح</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-sky-300">5</b><small className="block">المفاتيح</small></div></div><button onClick={onClose} className="w-full rounded-2xl bg-amber-400 py-3 font-black text-slate-950">متابعة الرحلة</button></div></div>
      )}
    </div>
  );
};

export default SuperTalebLevel2;
