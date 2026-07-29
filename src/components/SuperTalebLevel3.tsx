import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SuperTalebLevelComponentProps,
  SuperTalebLevelResult,
  SuperTalebQuestion,
} from './SuperTalebCampaign';
import { superTalebAudio } from './super-taleb/SuperTalebAudio';

type Motion = { left: boolean; right: boolean; jump: boolean; run: boolean };
type Player = {
  x:number; y:number; vx:number; vy:number; w:number; h:number;
  grounded:boolean; facing:1|-1; lives:number; invulnerableUntil:number;
};
type PlatformKind = 'floor'|'book'|'ruler'|'desk'|'paper';
type Platform = { x:number; y:number; w:number; h:number; kind:PlatformKind };
type HazardKind = 'paper'|'eraser'|'clock'|'question';
type Hazard = { id:string; x:number; y:number; w:number; h:number; minX:number; maxX:number; vx:number; alive:boolean; kind:HazardKind };
type Gate = { id:string; x:number; title:string; color:string; activated:boolean };
type Projectile = { x:number; y:number; vx:number; alive:boolean };

type Level3Assets = Record<string, HTMLImageElement>;

const WORLD_W = 7350;
const WORLD_H = 720;
const GROUND_Y = 590;
const POINTS_PER_CORRECT = 10;

const FALLBACK_QUESTIONS: SuperTalebQuestion[] = [
  { id:'l3-fallback-1', question:'اختر السلوك الأفضل قبل نهاية العام الدراسي:', options:['مراجعة الدروس','إهمال الواجب','عدم الحضور','ترك الكتب'], correctAnswerIndex:0 },
  { id:'l3-fallback-2', question:'تنظيم الوقت يساعد على إنجاز المهام.', options:['صحيح','خطأ'], correctAnswerIndex:0 },
  { id:'l3-fallback-3', question:'ناتج 8 × 5 يساوي:', options:['35','40','45','50'], correctAnswerIndex:1 },
];

function questionText(question:SuperTalebQuestion):string {
  return String(question.question || question.text || 'اختر الإجابة الصحيحة');
}
function correctIndex(question:SuperTalebQuestion):number {
  if (Number.isInteger(question.correctAnswerIndex)) return Number(question.correctAnswerIndex);
  const options = Array.isArray(question.options) ? question.options : [];
  const index = options.findIndex(option => String(option) === String(question.correctAnswerText || ''));
  return Math.max(0, index);
}
function overlaps(a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}):boolean {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

const SuperTalebLevel3:React.FC<SuperTalebLevelComponentProps> = ({
  questions,
  campaignMode,
  savedLevelState,
  onProgress,
  onComplete,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const frameRef = useRef<number|null>(null);
  const lastTimeRef = useRef(performance.now());
  const cameraRef = useRef(0);
  const safeXRef = useRef(120);
  const motionRef = useRef<Motion>({left:false,right:false,jump:false,run:false});
  const playerRef = useRef<Player>({x:120,y:GROUND_Y-82,vx:0,vy:0,w:48,h:82,grounded:true,facing:1,lives:3,invulnerableUntil:0});
  const assetsRef = useRef<Level3Assets>({});
  const projectilesRef = useRef<Projectile[]>([]);
  const answerLockedRef = useRef(false);
  const completionSentRef = useRef(false);

  const usableQuestions = useMemo(() => questions.length ? questions : FALLBACK_QUESTIONS, [questions]);
  const initialAnswered = (savedLevelState?.answeredQuestionIds as string[]|undefined) || [];
  const initialCorrect = (savedLevelState?.correctQuestionIds as string[]|undefined) || [];
  const initialWeak = (savedLevelState?.weakQuestionIds as string[]|undefined) || [];
  const initialActivated = (savedLevelState?.activatedGateIds as string[]|undefined) || [];

  const [started,setStarted] = useState(false);
  const [finished,setFinished] = useState(false);
  const [gameOver,setGameOver] = useState(false);
  const [runEnabled,setRunEnabled] = useState(false);
  const [orientation,setOrientation] = useState<'portrait'|'landscape'>(() => window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  const [score,setScore] = useState(Number(savedLevelState?.score || 0));
  const [pencilAmmo,setPencilAmmo] = useState(Number(savedLevelState?.pencilAmmo || 0));
  const [lives,setLives] = useState(3);
  const [answeredIds,setAnsweredIds] = useState<string[]>(initialAnswered);
  const [correctIds,setCorrectIds] = useState<string[]>(initialCorrect);
  const [weakIds,setWeakIds] = useState<string[]>(initialWeak);
  const [activatedGateIds,setActivatedGateIds] = useState<string[]>(initialActivated);
  const [activeGate,setActiveGate] = useState<Gate|null>(null);
  const [activeQuestion,setActiveQuestion] = useState<SuperTalebQuestion|null>(null);
  const [feedback,setFeedback] = useState<{correct:boolean;text:string}|null>(null);
  const [message,setMessage] = useState('اعبر بوابات الإنجاز واجمع أسئلة اليوم حتى تصل إلى احتفال نهاية العام');

  const gatesRef = useRef<Gate[]>([
    {id:'memory',x:1280,title:'بوابة التذكّر',color:'#f59e0b',activated:initialActivated.includes('memory')},
    {id:'understanding',x:2740,title:'بوابة الفهم',color:'#06b6d4',activated:initialActivated.includes('understanding')},
    {id:'application',x:4210,title:'بوابة التطبيق',color:'#8b5cf6',activated:initialActivated.includes('application')},
    {id:'achievement',x:5680,title:'بوابة الإنجاز',color:'#22c55e',activated:initialActivated.includes('achievement')},
    {id:'future',x:6660,title:'بوابة المستقبل',color:'#ec4899',activated:initialActivated.includes('future')},
  ]);

  const platformsRef = useRef<Platform[]>([
    {x:0,y:GROUND_Y,w:900,h:130,kind:'floor'},
    {x:950,y:GROUND_Y,w:860,h:130,kind:'floor'},
    {x:1860,y:GROUND_Y,w:900,h:130,kind:'floor'},
    {x:2810,y:GROUND_Y,w:880,h:130,kind:'floor'},
    {x:3740,y:GROUND_Y,w:870,h:130,kind:'floor'},
    {x:4665,y:GROUND_Y,w:900,h:130,kind:'floor'},
    {x:5620,y:GROUND_Y,w:850,h:130,kind:'floor'},
    {x:6525,y:GROUND_Y,w:825,h:130,kind:'floor'},
    {x:430,y:500,w:225,h:34,kind:'desk'},
    {x:700,y:450,w:170,h:30,kind:'book'},
    {x:1110,y:500,w:215,h:32,kind:'ruler'},
    {x:1510,y:445,w:175,h:30,kind:'paper'},
    {x:2020,y:500,w:230,h:34,kind:'book'},
    {x:2320,y:440,w:180,h:30,kind:'desk'},
    {x:3000,y:500,w:220,h:34,kind:'ruler'},
    {x:3290,y:440,w:175,h:30,kind:'book'},
    {x:3900,y:505,w:230,h:34,kind:'desk'},
    {x:4205,y:450,w:180,h:30,kind:'paper'},
    {x:4830,y:500,w:230,h:34,kind:'book'},
    {x:5140,y:438,w:180,h:30,kind:'ruler'},
    {x:5810,y:500,w:220,h:34,kind:'desk'},
    {x:6100,y:447,w:170,h:30,kind:'book'},
    {x:6750,y:500,w:230,h:34,kind:'ruler'},
  ]);

  const hazardsRef = useRef<Hazard[]>([
    {id:'paper-1',x:620,y:GROUND_Y-72,w:60,h:70,minX:500,maxX:820,vx:82,alive:true,kind:'paper'},
    {id:'eraser-1',x:1530,y:GROUND_Y-44,w:60,h:44,minX:1390,maxX:1710,vx:74,alive:true,kind:'eraser'},
    {id:'clock-1',x:2220,y:GROUND_Y-92,w:64,h:64,minX:2040,maxX:2550,vx:88,alive:true,kind:'clock'},
    {id:'question-1',x:3190,y:GROUND_Y-68,w:62,h:66,minX:3000,maxX:3540,vx:90,alive:true,kind:'question'},
    {id:'paper-2',x:4070,y:GROUND_Y-76,w:60,h:74,minX:3900,maxX:4460,vx:94,alive:true,kind:'paper'},
    {id:'eraser-2',x:5000,y:GROUND_Y-44,w:60,h:44,minX:4800,maxX:5400,vx:96,alive:true,kind:'eraser'},
    {id:'clock-2',x:5980,y:GROUND_Y-92,w:64,h:64,minX:5760,maxX:6330,vx:100,alive:true,kind:'clock'},
    {id:'question-2',x:6860,y:GROUND_Y-68,w:62,h:66,minX:6700,maxX:7160,vx:98,alive:true,kind:'question'},
  ]);

  const clearMotion = useCallback(() => {
    motionRef.current = {left:false,right:false,jump:false,run:false};
    playerRef.current.vx = 0;
    setRunEnabled(false);
  },[]);

  const persist = useCallback((patch:Record<string,unknown>={}) => {
    onProgress?.({
      answeredQuestionIds:answeredIds,
      correctQuestionIds:correctIds,
      weakQuestionIds:weakIds,
      activatedGateIds,
      score,
      pencilAmmo,
      playerX:playerRef.current.x,
      ...patch,
    });
  },[answeredIds,correctIds,weakIds,activatedGateIds,score,pencilAmmo,onProgress]);

  useEffect(() => { persist(); },[persist]);


  useEffect(() => { const unlock=()=>void superTalebAudio.unlock(); window.addEventListener('pointerdown',unlock,{once:true}); return()=>window.removeEventListener('pointerdown',unlock); }, []);
  useEffect(() => {
    let cancelled=false;
    const paths:Record<string,string> = {
      playerIdle:'/assets/games/super-taleb/player/idle.webp',
      playerWalk:'/assets/games/super-taleb/player/walk.webp',
      playerRun:'/assets/games/super-taleb/player/run.webp',
      playerJump:'/assets/games/super-taleb/player/jump.webp',
      playerFall:'/assets/games/super-taleb/player/fall.webp',
      playerVictory:'/assets/games/super-taleb/player/victory.webp',
      paper:'/assets/games/super-taleb/level-2/enemies/flying-paper.webp',
      eraser:'/assets/games/super-taleb/level-2/enemies/eraser.webp',
      clock:'/assets/games/super-taleb/level-2/enemies/school-bell.webp',
      question:'/assets/games/super-taleb/level-3/enemies/question-creature.webp',
      background:'/assets/games/super-taleb/level-3/backgrounds/end-year-panorama.webp',
      memoryGate:'/assets/games/super-taleb/level-3/gates/memory-gate.webp',
      understandingGate:'/assets/games/super-taleb/level-3/gates/understanding-gate.webp',
      applicationGate:'/assets/games/super-taleb/level-3/gates/application-gate.webp',
      achievementGate:'/assets/games/super-taleb/level-3/gates/achievement-gate.webp',
      futureGate:'/assets/games/super-taleb/level-3/gates/future-gate.webp',
      podium:'/assets/games/super-taleb/level-3/items/celebration-podium.webp',
      chestClosed:'/assets/games/super-taleb/level-3/items/completion-chest-closed.webp',
      chestOpen:'/assets/games/super-taleb/level-3/items/completion-chest-open.webp',
      omanFlag:'/assets/games/super-taleb/level-3/items/oman-flag.webp',
      exitArch:'/assets/games/super-taleb/level-3/items/exit-arch.webp',
      floorLong:'/assets/games/super-taleb/level-3/terrain/corridor-long-a.webp',
      floorShort:'/assets/games/super-taleb/level-3/terrain/corridor-short.webp',
      books:'/assets/games/super-taleb/level-3/terrain/books-medium.webp',
      desk:'/assets/games/super-taleb/level-3/terrain/desk-medium.webp',
      pencilBridge:'/assets/games/super-taleb/level-3/terrain/pencil-medium.webp',
      ruler:'/assets/games/super-taleb/level-3/terrain/ruler-medium.webp',
      paperPlatform:'/assets/games/super-taleb/level-3/terrain/paper-medium.webp',
      paper:'/assets/games/super-taleb/level-3/enemies/flying-paper.webp',
      eraser:'/assets/games/super-taleb/level-3/enemies/error-eraser.webp',
      clock:'/assets/games/super-taleb/level-3/enemies/time-clock.webp',
      revisionBook:'/assets/games/super-taleb/level-3/enemies/revision-book.webp',
      pencilEffect:'/assets/games/super-taleb/level-3/effects/pencil-projectile.webp',
      impactSpark:'/assets/games/super-taleb/level-3/effects/impact-spark.webp',
    };
    Promise.all(Object.entries(paths).map(([key,src]) => new Promise<[string,HTMLImageElement]>((resolve,reject) => {
      const image=new Image(); image.onload=()=>resolve([key,image]); image.onerror=reject; image.src=src;
    }))).then(entries => { if(!cancelled) assetsRef.current=Object.fromEntries(entries); }).catch(() => {});
    return () => { cancelled=true; };
  },[]);

  useEffect(() => {
    const update=()=>setOrientation(window.innerWidth>window.innerHeight?'landscape':'portrait');
    window.addEventListener('resize',update); window.addEventListener('orientationchange',update);
    return()=>{window.removeEventListener('resize',update);window.removeEventListener('orientationchange',update);};
  },[]);

  const openGate = useCallback((gate:Gate) => {
    if(gate.activated || activeQuestion) return;
    clearMotion();
    const unanswered=usableQuestions.filter(item=>!answeredIds.includes(String(item.id)));
    const selected=unanswered[0];
    if(!selected){
      gate.activated=true;
      const next=Array.from(new Set([...activatedGateIds,gate.id]));
      setActivatedGateIds(next); setMessage(`عبرت ${gate.title} — تابع طريق الإنجاز`); persist({activatedGateIds:next});
      return;
    }
    superTalebAudio.play('questionOpen');
    setActiveGate(gate); setActiveQuestion(selected); answerLockedRef.current=false;
  },[activeQuestion,activatedGateIds,answeredIds,clearMotion,persist,usableQuestions]);

  const handleAnswer = useCallback((choice:number) => {
    if(!activeQuestion || !activeGate || answerLockedRef.current) return;
    answerLockedRef.current=true;
    const id=String(activeQuestion.id);
    const isCorrect=choice===correctIndex(activeQuestion);
    const nextAnswered=Array.from(new Set([...answeredIds,id]));
    const nextCorrect=isCorrect?Array.from(new Set([...correctIds,id])):correctIds;
    const nextWeak=isCorrect?weakIds:Array.from(new Set([...weakIds,id]));
    const nextScore=nextCorrect.length*POINTS_PER_CORRECT;
    const nextAmmo=pencilAmmo+(isCorrect?1:0);
    const nextGates=Array.from(new Set([...activatedGateIds,activeGate.id]));
    activeGate.activated=true;
    setAnsweredIds(nextAnswered);setCorrectIds(nextCorrect);setWeakIds(nextWeak);setScore(nextScore);setPencilAmmo(nextAmmo);setActivatedGateIds(nextGates);
    superTalebAudio.play(isCorrect?'correct':'incorrect'); if(isCorrect){superTalebAudio.play('star');superTalebAudio.play('pencilEarned');}
    superTalebAudio.play('gateOpen');
    setFeedback({correct:isCorrect,text:isCorrect?'إجابة صحيحة: +10 نقاط وطلقة قلم':'إجابة غير صحيحة: لا نقاط ولا خسارة قلب، وتستمر المغامرة'});
    persist({answeredQuestionIds:nextAnswered,correctQuestionIds:nextCorrect,weakQuestionIds:nextWeak,score:nextScore,pencilAmmo:nextAmmo,activatedGateIds:nextGates});
    window.setTimeout(()=>{setActiveQuestion(null);setActiveGate(null);setFeedback(null);answerLockedRef.current=false;},850);
  },[activeGate,activeQuestion,activatedGateIds,answeredIds,correctIds,pencilAmmo,persist,weakIds]);

  const shootPencil=useCallback(()=>{
    if(pencilAmmo<=0 || activeQuestion || gameOver) return;
    const player=playerRef.current;
    superTalebAudio.play('pencilFire');
    projectilesRef.current.push({x:player.x+(player.facing>0?player.w:-24),y:player.y+34,vx:player.facing*650,alive:true});
    setPencilAmmo(value=>Math.max(0,value-1));
  },[activeQuestion,gameOver,pencilAmmo]);

  const finishLevel=useCallback(()=>{
    if(completionSentRef.current) return;
    const remaining=usableQuestions.filter(item=>!answeredIds.includes(String(item.id)));
    if(remaining.length>0){setMessage(`تبقى ${remaining.length} سؤالًا — عد إلى بوابة المعرفة التالية`);return;}
    completionSentRef.current=true;clearMotion();setFinished(true);superTalebAudio.play('levelComplete');
    const result:SuperTalebLevelResult={
      completed:true,score:correctIds.length*10,pointsEarned:correctIds.length*10,
      correct:correctIds.length,correctAnswers:correctIds.length,
      wrong:weakIds.length,wrongAnswers:weakIds.length,
      answeredQuestionIds:answeredIds,correctQuestionIds:correctIds,weakQuestionIds:weakIds,
      pencilAmmo,stars:correctIds.length,
    };
    onComplete(result);
  },[answeredIds,clearMotion,correctIds,onComplete,pencilAmmo,usableQuestions,weakIds]);

  const damagePlayer=useCallback((sourceX:number)=>{
    const now=performance.now();const player=playerRef.current;
    if(now<player.invulnerableUntil || gameOver) return;
    player.invulnerableUntil=now+2300;superTalebAudio.play('obstacleHit');
    player.x=Math.max(100,safeXRef.current);player.y=GROUND_Y-player.h;player.vx=sourceX>player.x?-90:90;player.vy=-190;
    const next=Math.max(0,player.lives-1);player.lives=next;setLives(next);clearMotion();
    if(next<=0){player.vx=0;player.vy=0;setGameOver(true);superTalebAudio.play('gameOver');setMessage('انتهت المحاولة — أعد المرحلة من البداية');}
  },[clearMotion,gameOver]);

  const restartAttempt=useCallback(()=>{
    const player=playerRef.current;
    player.x=120;player.y=GROUND_Y-player.h;player.vx=0;player.vy=0;player.grounded=true;player.lives=3;player.invulnerableUntil=performance.now()+1800;
    safeXRef.current=120;cameraRef.current=0;projectilesRef.current=[]; hazardsRef.current.forEach(item=>item.alive=true);
    setLives(3);setGameOver(false);setRunEnabled(false);motionRef.current={left:false,right:false,jump:false,run:false};setMessage('بدأت محاولة جديدة من بداية تحدي نهاية العام');
  },[]);

  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(event.key==='ArrowLeft'||event.key==='a') motionRef.current.left=true;
      if(event.key==='ArrowRight'||event.key==='d') motionRef.current.right=true;
      if(event.key==='ArrowUp'||event.key===' '||event.key==='w') motionRef.current.jump=true;
      if(event.key==='Shift') motionRef.current.run=true;
      if(event.key==='f') shootPencil();
    };
    const up=(event:KeyboardEvent)=>{
      if(event.key==='ArrowLeft'||event.key==='a') motionRef.current.left=false;
      if(event.key==='ArrowRight'||event.key==='d') motionRef.current.right=false;
      if(event.key==='ArrowUp'||event.key===' '||event.key==='w') motionRef.current.jump=false;
      if(event.key==='Shift') motionRef.current.run=false;
    };
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
  },[shootPencil]);

  useEffect(()=>{
    if(!started||activeQuestion||finished||gameOver) return;
    const canvas=canvasRef.current;if(!canvas)return;const context=canvas.getContext('2d');if(!context)return;
    const resize=()=>{const rect=canvas.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));context.setTransform(dpr,0,0,dpr,0,0);};
    resize();const observer=new ResizeObserver(resize);observer.observe(canvas);

    const loop=(time:number)=>{
      const dt=Math.min(.033,(time-lastTimeRef.current)/1000||0);lastTimeRef.current=time;
      const player=playerRef.current;const motion=motionRef.current;
      const speed=motion.run?410:205;const axis=(motion.right?1:0)-(motion.left?1:0);
      player.vx+=(axis*speed-player.vx)*Math.min(1,dt*12);if(axis)player.facing=axis>0?1:-1;
      if(motion.jump&&player.grounded){superTalebAudio.play('jump');player.vy=-515;player.grounded=false;motion.jump=false;}
      player.vy+=1270*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;player.x=Math.max(0,Math.min(WORLD_W-player.w,player.x));
      const previousBottom=player.y+player.h-player.vy*dt;const wasGrounded=player.grounded;player.grounded=false;
      platformsRef.current.forEach(platform=>{
        const image=platform.kind==='floor'?(platform.w>850?assets.floorLong:assets.floorShort):platform.kind==='book'?assets.books:platform.kind==='ruler'?assets.ruler:platform.kind==='paper'?assets.paperPlatform:assets.desk;
        if(image){const drawH=platform.kind==='floor'?Math.max(125,platform.h):Math.max(48,platform.h+25);context.drawImage(image,platform.x,platform.y,platform.w,drawH);return;}
        context.fillStyle=platform.kind==='floor'?'#e2b56f':'#9a642f';context.fillRect(platform.x,platform.y,platform.w,platform.h);
      });
      gatesRef.current.forEach(gate=>{
        const gateImage=gate.id==='memory'?assets.memoryGate:gate.id==='understanding'?assets.understandingGate:gate.id==='application'?assets.applicationGate:gate.id==='achievement'?assets.achievementGate:assets.futureGate;
        context.save();context.globalAlpha=gate.activated?1:.92;
        if(gateImage)context.drawImage(gateImage,gate.x-82,GROUND_Y-205,164,205);
        else{context.strokeStyle=gate.activated?'#22c55e':gate.color;context.lineWidth=12;context.strokeRect(gate.x-54,GROUND_Y-165,108,165);}
        context.globalAlpha=1;context.fillStyle='rgba(15,23,42,.86)';context.beginPath();context.roundRect(gate.x-72,GROUND_Y-66,144,34,12);context.fill();context.fillStyle='white';context.font='bold 14px sans-serif';context.textAlign='center';context.fillText(gate.title,gate.x,GROUND_Y-43);context.restore();
      });
      hazardsRef.current.forEach(hazard=>{
        if(!hazard.alive)return;const image=hazard.kind==='paper'?assets.paper:hazard.kind==='eraser'?assets.eraser:hazard.kind==='clock'?assets.clock:hazard.kind==='question'?assets.question:assets.revisionBook;
        context.save();context.translate(hazard.x,hazard.y);if(hazard.vx<0){context.translate(hazard.w,0);context.scale(-1,1);}if(image)context.drawImage(image,-7,-9,hazard.w+14,hazard.h+14);else{context.fillStyle='#ef4444';context.fillRect(0,0,hazard.w,hazard.h);}context.restore();
      });
      projectilesRef.current.forEach(shot=>{if(assets.pencilEffect)context.drawImage(assets.pencilEffect,shot.x,shot.y-12,48,30);else{context.fillStyle='#facc15';context.fillRect(shot.x,shot.y,30,8);}});
      // منصة الاحتفال النهائية.
      if(assets.podium)context.drawImage(assets.podium,7045,395,260,195);
      if(assets.chestClosed)context.drawImage(finished&&assets.chestOpen?assets.chestOpen:assets.chestClosed,7140,455,115,105);
      if(assets.omanFlag)context.drawImage(assets.omanFlag,7270,360,70,160);

      const blink=time<player.invulnerableUntil&&Math.floor(time/100)%2===0;
      if(!blink){
        let image=assets.playerIdle,frames=6,fps=5;
        if(finished&&assets.playerVictory){image=assets.playerVictory;frames=6;fps=7;}
        else if(!player.grounded){image=player.vy<0?assets.playerJump:assets.playerFall;frames=player.vy<0?7:5;fps=8;}
        else if(Math.abs(player.vx)>260){image=assets.playerRun;frames=7;fps=13;}
        else if(Math.abs(player.vx)>20){image=assets.playerWalk;frames=7;fps=9;}
        context.save();context.translate(player.x+player.w/2,player.y+player.h);context.scale(player.facing,1);
        if(image){const frame=Math.floor(time/1000*fps)%frames;context.drawImage(image,frame*256,0,256,256,-61,-109,122,122);}else{context.fillStyle='#fff';context.fillRect(-20,-82,40,82);}context.restore();
      }
      context.restore();
      context.fillStyle='rgba(15,23,42,.9)';context.fillRect(12,12,Math.min(580,viewW-24),58);context.fillStyle='#fff';context.font='bold 17px sans-serif';context.textAlign='left';context.fillText(`❤️ ${lives}   ⭐ ${correctIds.length}   ✏️ ${pencilAmmo}   النقاط ${score}`,28,48);
      context.fillStyle='rgba(255,255,255,.93)';context.fillRect(14,78,Math.min(760,viewW-28),46);context.fillStyle='#0f172a';context.font='bold 15px sans-serif';context.fillText(message,28,107);
      frameRef.current=requestAnimationFrame(loop);
    };
    frameRef.current=requestAnimationFrame(loop);
    return()=>{observer.disconnect();if(frameRef.current)cancelAnimationFrame(frameRef.current);};
  },[started,activeQuestion,finished,gameOver,activatedGateIds.length,answeredIds.length,correctIds.length,pencilAmmo,score,lives,damagePlayer,finishLevel,message,openGate]);

  const press=(key:keyof Motion,value:boolean)=>{motionRef.current[key]=value;};
  const controlSize=orientation==='landscape'?76:68;
  const baseButton:React.CSSProperties={width:controlSize,height:controlSize,borderRadius:22,border:'2px solid rgba(255,255,255,.65)',background:'rgba(15,23,42,.86)',color:'#fff',fontWeight:900,fontSize:23,boxShadow:'0 8px 22px rgba(0,0,0,.3)',touchAction:'none',userSelect:'none'};

  return <div className="fixed inset-0 z-[120] overflow-hidden bg-slate-950" dir="rtl">
    <canvas ref={canvasRef} className="h-full w-full" />
    {!started && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-amber-300/45 bg-slate-900 p-6 text-center text-white shadow-2xl">
        <div className="text-6xl">🏆</div><h2 className="mt-2 text-3xl font-black">المرحلة الثالثة: تحدي نهاية العام</h2>
        <p className="mt-3 leading-7 text-slate-300">اعبر بوابات التذكّر والفهم والتطبيق والإنجاز والمستقبل، وتفاعل مع جميع أسئلة اليوم للوصول إلى منصة الاحتفال.</p>
        <p className="mt-3 rounded-2xl bg-amber-400/15 p-3 text-sm font-bold text-amber-200">هذه مغامرة يومية عادية وليست اختبارًا رسميًا.</p>
        <button type="button" onClick={()=>setStarted(true)} className="mt-5 rounded-2xl bg-amber-400 px-8 py-3 font-black text-slate-950">ابدأ المرحلة الثالثة</button>
      </div>
    </div>}
    {activeQuestion && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm">
      <div className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-amber-300 bg-white p-5 text-right shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">{activeGate?.title}</span><span className="text-sm font-bold text-slate-500">سؤال اليوم</span></div>
        <h3 className="mb-5 text-xl font-black leading-8 text-slate-900">{questionText(activeQuestion)}</h3>
        <div className="grid gap-3">{(activeQuestion.options||[]).map((option,index)=><button type="button" key={index} disabled={Boolean(feedback)} onClick={()=>handleAnswer(index)} className="rounded-2xl border-2 border-amber-200 bg-white p-4 text-right font-bold text-slate-800 shadow-sm disabled:opacity-80">{index+1}. {option}</button>)}</div>
        {feedback&&<div className={`mt-4 rounded-2xl p-4 text-center font-black ${feedback.correct?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{feedback.text}</div>}
      </div>
    </div>}
    {started&&!activeQuestion&&!finished&&!gameOver&&<>
      <div style={{position:'absolute',left:18,bottom:20,display:'flex',gap:orientation==='landscape'?24:18,direction:'ltr'}}>
        <button type="button" aria-label="يسار" onPointerDown={event=>{event.currentTarget.setPointerCapture?.(event.pointerId);press('left',true);}} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture?.(event.pointerId);press('left',false);}} onPointerCancel={()=>press('left',false)} style={baseButton}>◀</button>
        <button type="button" aria-label="يمين" onPointerDown={event=>{event.currentTarget.setPointerCapture?.(event.pointerId);press('right',true);}} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture?.(event.pointerId);press('right',false);}} onPointerCancel={()=>press('right',false)} style={baseButton}>▶</button>
      </div>
      <div style={{position:'absolute',right:18,bottom:20,display:'flex',gap:orientation==='landscape'?18:14,alignItems:'flex-end',direction:'ltr'}}>
        {pencilAmmo>0&&<button type="button" onClick={shootPencil} style={{...baseButton,fontSize:17,background:'rgba(14,116,144,.94)'}}>✏️ {pencilAmmo}</button>}
        <button type="button" onClick={()=>{const next=!runEnabled;setRunEnabled(next);motionRef.current.run=next;}} style={{...baseButton,fontSize:15,background:runEnabled?'linear-gradient(145deg,#0ea5e9,#1d4ed8)':'rgba(37,99,235,.93)',border:runEnabled?'3px solid #fde68a':baseButton.border}}>{runEnabled?'إيقاف':'جري'}</button>
        <button type="button" aria-label="قفز" onPointerDown={event=>{event.currentTarget.setPointerCapture?.(event.pointerId);press('jump',true);}} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture?.(event.pointerId);press('jump',false);}} onPointerCancel={()=>press('jump',false)} style={{...baseButton,background:'#f97316',fontSize:16}}>قفز</button>
      </div>
      <button type="button" onClick={onClose} className="absolute left-4 top-4 rounded-2xl bg-slate-900/90 px-4 py-3 font-black text-white">×</button>
    </>}
    {gameOver&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-rose-300 bg-slate-900 p-6 text-center text-white"><div className="text-6xl">❤️‍🩹</div><h2 className="mt-3 text-2xl font-black">انتهت المحاولة</h2><p className="mt-3 leading-7 text-slate-300">تعود الحركة إلى بداية المرحلة، مع بقاء نتائج الأسئلة التي أجبت عنها محفوظة.</p><button type="button" onClick={restartAttempt} className="mt-5 w-full rounded-2xl bg-rose-400 py-3 font-black text-slate-950">إعادة المرحلة من البداية</button></div></div>}
    {finished&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-amber-300 bg-slate-900 p-6 text-center text-white"><div className="text-6xl">🎉</div><h2 className="mt-2 text-2xl font-black">اكتمل تحدي نهاية العام</h2><p className="mt-3 text-slate-300">عبرت بوابات الإنجاز وتفاعلت مع جميع أسئلة المهمة الحالية.</p><div className="my-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-800 p-3"><b className="text-amber-300">{score}</b><small className="block">النقاط</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-emerald-300">{correctIds.length}</b><small className="block">صحيح</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-sky-300">{campaignMode==='review'?'∞':'3'}</b><small className="block">المراحل</small></div></div><button type="button" onClick={onClose} className="w-full rounded-2xl bg-amber-400 py-3 font-black text-slate-950">متابعة رحلة سوبر طالب</button></div></div>}
  </div>;
};

export default SuperTalebLevel3;
