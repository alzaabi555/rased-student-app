import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { superTalebAudio } from './super-taleb/SuperTalebAudio';
import type {
  SuperTalebLevelComponentProps,
  SuperTalebLevelResult,
  SuperTalebQuestion,
} from './SuperTalebCampaign';

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
  const [showMessage,setShowMessage] = useState(true);
  const [currentZone,setCurrentZone] = useState(0);
  const zoneRef = useRef(-1);

  const gatesRef = useRef<Gate[]>([
    {id:'memory',x:1180,title:'بوابة التذكّر',color:'#f59e0b',activated:initialActivated.includes('memory')},
    {id:'understanding',x:2860,title:'بوابة الفهم',color:'#06b6d4',activated:initialActivated.includes('understanding')},
    {id:'application',x:4220,title:'بوابة التطبيق',color:'#8b5cf6',activated:initialActivated.includes('application')},
    {id:'achievement',x:5600,title:'بوابة الإنجاز',color:'#22c55e',activated:initialActivated.includes('achievement')},
    {id:'future',x:6680,title:'بوابة المستقبل',color:'#ec4899',activated:initialActivated.includes('future')},
  ]);

  const platformsRef = useRef<Platform[]>([
    // القسم 1: مسار السرعة، أرض متصلة وعقبات أرضية متحركة.
    {x:0,y:GROUND_Y,w:1320,h:150,kind:'floor'},
    // القسم 2: جسر الأقلام، فجوتان قصيرتان وواضحتان فقط.
    {x:1365,y:GROUND_Y,w:770,h:150,kind:'floor'},
    {x:2180,y:GROUND_Y,w:910,h:150,kind:'floor'},
    // القسم 3: طريقان منخفضان من الكتب والطاولات، لا ارتفاعات قرب سقف الهاتف.
    {x:3135,y:GROUND_Y,w:1180,h:150,kind:'floor'},
    {x:4360,y:GROUND_Y,w:1060,h:150,kind:'floor'},
    // القسم 4: ممر بوابات الإنجاز والاندفاعة الختامية.
    {x:5465,y:GROUND_Y,w:1885,h:150,kind:'floor'},

    {x:520,y:GROUND_Y-62,w:190,h:62,kind:'book'},
    {x:900,y:GROUND_Y-48,w:210,h:48,kind:'desk'},
    {x:1425,y:GROUND_Y-42,w:260,h:42,kind:'ruler'},
    {x:1870,y:GROUND_Y-58,w:210,h:58,kind:'book'},
    {x:2240,y:GROUND_Y-42,w:300,h:42,kind:'ruler'},
    {x:2680,y:GROUND_Y-55,w:240,h:55,kind:'paper'},
    {x:3250,y:GROUND_Y-70,w:220,h:70,kind:'book'},
    {x:3580,y:GROUND_Y-50,w:245,h:50,kind:'desk'},
    {x:3940,y:GROUND_Y-78,w:230,h:78,kind:'book'},
    {x:4480,y:GROUND_Y-50,w:270,h:50,kind:'ruler'},
    {x:4900,y:GROUND_Y-68,w:240,h:68,kind:'paper'},
    {x:5580,y:GROUND_Y-55,w:250,h:55,kind:'desk'},
    {x:6030,y:GROUND_Y-72,w:230,h:72,kind:'book'},
    {x:6560,y:GROUND_Y-46,w:300,h:46,kind:'ruler'},
  ]);

  const hazardsRef = useRef<Hazard[]>([
    // سباق الوقت: ساعات وممحاة أرضية.
    {id:'clock-1',x:760,y:GROUND_Y-68,w:62,h:62,minX:650,maxX:1080,vx:-115,alive:true,kind:'clock'},
    {id:'eraser-1',x:1120,y:GROUND_Y-42,w:64,h:42,minX:960,maxX:1260,vx:-95,alive:true,kind:'eraser'},
    // جسر الأقلام: أوراق طائرة تتحرك على ارتفاع منخفض يمكن تجاوزها.
    {id:'paper-1',x:1660,y:GROUND_Y-118,w:66,h:72,minX:1480,maxX:2040,vx:102,alive:true,kind:'paper'},
    {id:'paper-2',x:2520,y:GROUND_Y-125,w:66,h:72,minX:2300,maxX:2920,vx:-108,alive:true,kind:'paper'},
    // طريق الاختيار: كتب ثابتة وعلامات سؤال متذبذبة.
    {id:'book-1',x:3380,y:GROUND_Y-72,w:72,h:72,minX:3380,maxX:3381,vx:0,alive:true,kind:'book'},
    {id:'question-1',x:4000,y:GROUND_Y-112,w:64,h:68,minX:3820,maxX:4200,vx:88,alive:true,kind:'question'},
    {id:'book-2',x:4700,y:GROUND_Y-72,w:72,h:72,minX:4700,maxX:4701,vx:0,alive:true,kind:'book'},
    // اندفاعة الإنجاز: نمط متناوب أسرع.
    {id:'eraser-2',x:5740,y:GROUND_Y-42,w:64,h:42,minX:5580,maxX:6000,vx:125,alive:true,kind:'eraser'},
    {id:'clock-2',x:6240,y:GROUND_Y-68,w:62,h:62,minX:6120,maxX:6500,vx:-125,alive:true,kind:'clock'},
    {id:'question-2',x:6810,y:GROUND_Y-108,w:64,h:68,minX:6660,maxX:7060,vx:112,alive:true,kind:'question'},
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
  useEffect(()=>{setShowMessage(true);const timer=window.setTimeout(()=>setShowMessage(false),3000);return()=>window.clearTimeout(timer);},[message]);

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
      floorLong:'/assets/games/super-taleb/level-3/terrain/corridor-long-a.webp',
      floorShort:'/assets/games/super-taleb/level-3/terrain/corridor-short.webp',
      books:'/assets/games/super-taleb/level-3/terrain/books-medium.webp',
      desk:'/assets/games/super-taleb/level-3/terrain/desk-medium.webp',
      ruler:'/assets/games/super-taleb/level-3/terrain/ruler-medium.webp',
      paperPlatform:'/assets/games/super-taleb/level-3/terrain/paper-medium.webp',
      revisionBook:'/assets/games/super-taleb/level-3/enemies/revision-book.webp',
      pencilEffect:'/assets/games/super-taleb/level-3/effects/pencil-projectile.webp',
    };
    Promise.allSettled(Object.entries(paths).map(([key,src]) => new Promise<[string,HTMLImageElement]>((resolve,reject) => {
      const image=new Image();
      image.onload=async()=>{ try { await image.decode?.(); } catch {} resolve([key,image]); };
      image.onerror=reject; image.src=src;
    }))).then(results => {
      if(cancelled) return;
      const loaded=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
      assetsRef.current={...assetsRef.current,...Object.fromEntries(loaded)};
    });
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
    superTalebAudio.play(isCorrect?'correct':'incorrect');
    if(isCorrect){superTalebAudio.play('star');superTalebAudio.play('pencilEarned');}
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
      const zone=player.x<1320?0:player.x<3090?1:player.x<5420?2:3;
      // لكل قسم طريقة لعب مختلفة: سباق تلقائي، جسر تحكم كامل، طريق اختيار، ثم اندفاعة ختامية.
      const manualAxis=(motion.right?1:0)-(motion.left?1:0);
      const axis=zone===0?(motion.left?-1:1):zone===3?(motion.left?-1:(motion.right?1:0.72)):manualAxis;
      const speed=zone===0?330:zone===3?(motion.run?465:360):(motion.run?410:205);
      player.vx+=(axis*speed-player.vx)*Math.min(1,dt*(zone===0||zone===3?8:12));if(axis)player.facing=axis>0?1:-1;
      if(motion.jump&&player.grounded){superTalebAudio.play('jump');player.vy=-515;player.grounded=false;motion.jump=false;}
      player.vy+=1270*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;player.x=Math.max(0,Math.min(WORLD_W-player.w,player.x));
      if(zone!==zoneRef.current){zoneRef.current=zone;setCurrentZone(zone);setMessage(['مسار السرعة: الجري تلقائي، تحكم بالقفز وتفادى الساعات والممحاة','جسر الأقلام: تحكم كامل واعبر الفجوات القصيرة وتفادَ الأوراق','طريق الاختيار: اسلك الطريق الأرضي الآمن أو المنصات الأقصر','اندفاعة الإنجاز: سرعة أمامية متزايدة حتى منصة الاحتفال'][zone]);}
      const previousBottom=player.y+player.h-player.vy*dt;const wasGrounded=player.grounded;player.grounded=false;
      platformsRef.current.forEach(platform=>{
        if(player.x+player.w*.8>platform.x&&player.x+player.w*.2<platform.x+platform.w&&previousBottom<=platform.y+12&&player.y+player.h>=platform.y&&player.vy>=0){
          player.y=platform.y-player.h;player.vy=0;player.grounded=true;if(!wasGrounded)superTalebAudio.play('land');
          if(platform.kind==='floor'&&player.x>safeXRef.current+200)safeXRef.current=player.x;
        }
      });
      if(player.y>WORLD_H+100) damagePlayer(player.x);
      hazardsRef.current.forEach(hazard=>{
        if(!hazard.alive)return;hazard.x+=hazard.vx*dt;if(hazard.x<=hazard.minX||hazard.x>=hazard.maxX)hazard.vx*=-1;
        const body={x:player.x+11,y:player.y+15,w:player.w-22,h:player.h-20};
        const target={x:hazard.x+10,y:hazard.y+8,w:hazard.w-20,h:hazard.h-12};
        if(overlaps(body,target))damagePlayer(hazard.x);
      });
      projectilesRef.current.forEach(shot=>{
        if(!shot.alive)return;shot.x+=shot.vx*dt;
        hazardsRef.current.forEach(hazard=>{if(hazard.alive&&overlaps({x:shot.x,y:shot.y,w:30,h:9},hazard)){hazard.alive=false;shot.alive=false;}});
        if(shot.x<cameraRef.current-100||shot.x>cameraRef.current+1800)shot.alive=false;
      });
      projectilesRef.current=projectilesRef.current.filter(item=>item.alive);
      gatesRef.current.forEach(gate=>{if(!gate.activated&&Math.abs((player.x+player.w/2)-gate.x)<80&&player.y+player.h>GROUND_Y-150)openGate(gate);});
      if(player.x>7160)finishLevel();

      const viewW=canvas.clientWidth;const viewH=canvas.clientHeight;const landscape=viewW>viewH;const portraitView=viewH>viewW;
      // معادلة المرحلة الأولى حرفيًا: الأفقي يوسع مجال الرؤية ولا يكبر عناصر العالم.
      const sceneScale=portraitView?Math.max(.86,Math.min(1.12,viewH/700)):Math.max(.80,Math.min(1.04,viewH/560));
      const bottomClearance=portraitView?150:118;
      const offsetY=viewH-(GROUND_Y+bottomClearance)*sceneScale;const visibleWorldW=viewW/sceneScale;
      cameraRef.current+=(Math.max(0,Math.min(WORLD_W-visibleWorldW,player.x-visibleWorldW*.32))-cameraRef.current)*Math.min(1,dt*6);
      const camera=cameraRef.current;

      const assets=assetsRef.current;
      const sky=context.createLinearGradient(0,0,0,viewH);sky.addColorStop(0,'#5bb9f5');sky.addColorStop(1,'#f8d9a5');context.fillStyle=sky;context.fillRect(0,0,viewW,viewH);
      if(assets.background){
        const bgW=1536; const bgH=Math.max(viewH,620); const shift=-(camera*.13)%bgW;
        for(let x=shift-bgW;x<viewW+bgW;x+=bgW) context.drawImage(assets.background,x,0,bgW,bgH);
      } else {
        const parallax=-(camera*.13)%900;
        for(let x=parallax-900;x<viewW+900;x+=900){context.fillStyle='#f6e2bd';context.fillRect(x,80,900,430);context.fillStyle='#8ccde8';context.fillRect(x+90,145,255,190);context.fillRect(x+550,145,255,190);}
      }

      context.save();context.translate(0,offsetY);context.scale(sceneScale,sceneScale);context.translate(-camera,0);
      // الحفر المرئية جزء من العالم وليست فراغًا شفافًا: ظل عميق وحدود حجرية واضحة.
      [[1320,1365],[2135,2180],[3090,3135],[4315,4360],[5420,5465]].forEach(([left,right])=>{
        const gradient=context.createLinearGradient(0,GROUND_Y,0,GROUND_Y+150);gradient.addColorStop(0,'#3b2416');gradient.addColorStop(1,'#080b12');
        context.fillStyle=gradient;context.fillRect(left,GROUND_Y,right-left,170);
        context.strokeStyle='#f59e0b';context.lineWidth=5;context.beginPath();context.moveTo(left,GROUND_Y+2);context.lineTo(left+10,GROUND_Y+18);context.moveTo(right,GROUND_Y+2);context.lineTo(right-10,GROUND_Y+18);context.stroke();
      });
      platformsRef.current.forEach(platform=>{
        const image=platform.kind==='floor'?(platform.w>850?assets.floorLong:assets.floorShort):platform.kind==='book'?assets.books:platform.kind==='ruler'?assets.ruler:platform.kind==='paper'?assets.paperPlatform:assets.desk;
        if(image){
          // لا خلفية زرقاء أو مستطيل خلف الأصل. أعلى الأصل يساوي سطح التصادم.
          const targetH=platform.kind==='floor'?Math.max(138,platform.h):Math.max(48,platform.h+18);
          const scale=Math.min(platform.w/image.naturalWidth,targetH/image.naturalHeight);
          const drawW=Math.min(platform.w,image.naturalWidth*scale),drawH=Math.min(targetH,image.naturalHeight*scale);
          context.drawImage(image,platform.x+(platform.w-drawW)/2,platform.y,drawW,drawH);
          if(platform.kind==='floor'&&drawH<platform.h){
            const fill=context.createLinearGradient(0,platform.y+drawH,0,platform.y+platform.h);fill.addColorStop(0,'#986138');fill.addColorStop(1,'#3f281c');context.fillStyle=fill;context.fillRect(platform.x,platform.y+drawH,platform.w,platform.h-drawH+30);
          }
          return;
        }
        // fallback يظهر فقط إذا لم يُحمّل الأصل.
        if(platform.kind==='floor'){
          const body=context.createLinearGradient(0,platform.y,0,platform.y+platform.h);body.addColorStop(0,'#eac47f');body.addColorStop(.2,'#9a6237');body.addColorStop(1,'#3d281c');context.fillStyle=body;context.fillRect(platform.x,platform.y,platform.w,platform.h+25);context.fillStyle='#f6d79a';context.fillRect(platform.x,platform.y,platform.w,10);
        }else{
          context.fillStyle=platform.kind==='ruler'?'#facc15':platform.kind==='paper'?'#f8fafc':platform.kind==='desk'?'#9a642f':'#2563eb';context.fillRect(platform.x,platform.y,platform.w,Math.max(42,platform.h));
        }
      });
      gatesRef.current.forEach(gate=>{
        const gateImage=gate.id==='memory'?assets.memoryGate:gate.id==='understanding'?assets.understandingGate:gate.id==='application'?assets.applicationGate:gate.id==='achievement'?assets.achievementGate:assets.futureGate;
        context.save();context.globalAlpha=gate.activated?1:.92;
        if(gateImage)context.drawImage(gateImage,gate.x-72,GROUND_Y-168,144,168);
        else{context.strokeStyle=gate.activated?'#22c55e':gate.color;context.lineWidth=12;context.strokeRect(gate.x-54,GROUND_Y-165,108,165);}
        context.globalAlpha=1;context.fillStyle='rgba(15,23,42,.86)';context.fillRect(gate.x-72,GROUND_Y-66,144,34);context.fillStyle='white';context.font='bold 14px sans-serif';context.textAlign='center';context.fillText(gate.title,gate.x,GROUND_Y-43);context.restore();
      });
      hazardsRef.current.forEach(hazard=>{
        if(!hazard.alive)return;const image=hazard.kind==='paper'?assets.paper:hazard.kind==='eraser'?assets.eraser:hazard.kind==='clock'?assets.clock:hazard.kind==='question'?assets.question:assets.revisionBook;
        context.save();context.translate(hazard.x,hazard.y);if(hazard.vx<0){context.translate(hazard.w,0);context.scale(-1,1);}if(image){const ratio=Math.min(hazard.w/image.naturalWidth,hazard.h/image.naturalHeight);const dw=image.naturalWidth*ratio;const dh=image.naturalHeight*ratio;context.drawImage(image,(hazard.w-dw)/2,hazard.h-dh,dw,dh);}else{context.fillStyle='#ef4444';context.fillRect(0,0,hazard.w,hazard.h);}context.restore();
      });
      projectilesRef.current.forEach(shot=>{if(assets.pencilEffect)context.drawImage(assets.pencilEffect,shot.x,shot.y-12,48,30);else{context.fillStyle='#facc15';context.fillRect(shot.x,shot.y,30,8);}});
      // منصة الاحتفال النهائية.
      if(assets.podium)context.drawImage(assets.podium,7045,GROUND_Y-195,260,195);else{context.fillStyle='#0f766e';context.fillRect(7100,410,190,180);}
      if(assets.chestClosed)context.drawImage(finished&&assets.chestOpen?assets.chestOpen:assets.chestClosed,7140,GROUND_Y-105,115,105);
      if(assets.omanFlag)context.drawImage(assets.omanFlag,7270,GROUND_Y-160,70,160);

      const blink=time<player.invulnerableUntil&&Math.floor(time/100)%2===0;
      if(!blink){
        let image=assets.playerIdle,frames=6,fps=5;
        if(finished&&assets.playerVictory){image=assets.playerVictory;frames=6;fps=7;}
        else if(!player.grounded){image=player.vy<0?assets.playerJump:assets.playerFall;frames=player.vy<0?7:5;fps=8;}
        else if(Math.abs(player.vx)>260){image=assets.playerRun;frames=7;fps=13;}
        else if(Math.abs(player.vx)>20){image=assets.playerWalk;frames=7;fps=9;}
        context.save();context.translate(player.x+player.w/2,player.y+player.h);context.scale(player.facing,1);
        if(image){const frame=Math.floor(time/1000*fps)%frames;context.drawImage(image,frame*256,0,256,256,-59,-118,118,118);}else{context.fillStyle='#fff';context.fillRect(-20,-82,40,82);}context.restore();
      }
      context.restore();
      frameRef.current=requestAnimationFrame(loop);
    };
    frameRef.current=requestAnimationFrame(loop);
    return()=>{observer.disconnect();if(frameRef.current)cancelAnimationFrame(frameRef.current);};
  },[started,activeQuestion,finished,gameOver,activatedGateIds.length,answeredIds.length,correctIds.length,pencilAmmo,score,lives,damagePlayer,finishLevel,message,openGate]);

  const press=(key:keyof Motion,value:boolean)=>{motionRef.current[key]=value;};
  const touchButton=(key:keyof Motion)=>(down:boolean)=>()=>press(key,down);

  return <div className="fixed inset-0 z-[120] overflow-hidden bg-slate-950" dir="rtl">
    <canvas ref={canvasRef} className="h-full w-full" />
    {started&&!finished&&!gameOver&&<div style={{position:'absolute',top:orientation==='landscape'?8:12,left:12,right:12,display:'flex',justifyContent:'space-between',alignItems:'center',pointerEvents:'none',transform:orientation==='landscape'?'scale(.92)':'none',transformOrigin:'top center',zIndex:12}}>
      <button type="button" onClick={onClose} style={{pointerEvents:'auto',width:46,height:46,borderRadius:16,border:'1px solid rgba(255,255,255,.35)',background:'rgba(7,21,47,.85)',color:'#fff',fontSize:23,fontWeight:900}}>×</button>
      <div style={{display:'flex',gap:8,alignItems:'center'}}><Level3Hud text={`❤️ ${lives}`} color="#EF4444"/><Level3Hud text={`⭐ ${correctIds.length}`} color="#FACC15"/><Level3Hud text={`✏️ ${pencilAmmo}`} color="#22D3EE"/><Level3Hud text={`النقاط ${score}`} color="#38BDF8"/></div>
    </div>}
    {started&&!activeQuestion&&!finished&&!gameOver&&showMessage&&<div style={{position:'absolute',top:orientation==='landscape'?72:82,left:'50%',transform:'translateX(-50%)',maxWidth:orientation==='landscape'?'62vw':'88vw',padding:orientation==='landscape'?'8px 16px':'10px 14px',borderRadius:16,background:'rgba(248,250,252,.92)',border:'1px solid rgba(245,158,11,.45)',boxShadow:'0 8px 24px rgba(0,0,0,.15)',color:'#0f172a',fontWeight:800,fontSize:orientation==='landscape'?14:15,textAlign:'center',zIndex:11,pointerEvents:'none'}}>{message}</div>}
    {started&&!activeQuestion&&!finished&&!gameOver&&<div style={{position:'absolute',top:orientation==='landscape'?76:132,right:orientation==='landscape'?18:12,padding:'6px 10px',borderRadius:12,background:'rgba(7,21,47,.72)',color:'#fff',fontSize:12,fontWeight:900,zIndex:10,pointerEvents:'none'}}>{['سباق الوقت','جسر الأقلام','طريق الاختيار','اندفاعة الإنجاز'][currentZone]}</div>}
    {!started && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-amber-300/45 bg-slate-900 p-6 text-center text-white shadow-2xl">
        <div className="text-6xl">🏆</div><h2 className="mt-2 text-3xl font-black">المرحلة الثالثة: تحدي نهاية العام</h2>
        <p className="mt-3 leading-7 text-slate-300">تتغير طريقة اللعب في أربعة أقسام: سباق الوقت، جسر الأقلام، طريق الاختيار، ثم اندفاعة الإنجاز. اعبر بوابات المعرفة وأكمل أسئلة اليوم.</p>
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
    {started&&!activeQuestion&&!finished&&!gameOver&&<div style={{position:'absolute',bottom:orientation==='landscape'?10:14,left:orientation==='landscape'?30:18,right:orientation==='landscape'?30:18,display:'flex',justifyContent:'space-between',alignItems:'flex-end',pointerEvents:'none',zIndex:12}}>
      <div style={{display:'flex',gap:orientation==='landscape'?24:18,direction:'ltr',pointerEvents:'auto'}}>
        <Level3Control label="◀" large={orientation==='landscape'} onDown={touchButton('left')(true)} onUp={touchButton('left')(false)}/>
        <Level3Control label="▶" large={orientation==='landscape'} onDown={touchButton('right')(true)} onUp={touchButton('right')(false)}/>
      </div>
      <div style={{display:'flex',gap:orientation==='landscape'?18:12,alignItems:'flex-end',direction:'ltr',pointerEvents:'auto'}}>
        {pencilAmmo>0&&<button type="button" onClick={shootPencil} style={{width:orientation==='landscape'?74:64,height:orientation==='landscape'?74:64,borderRadius:24,border:'3px solid #FDE68A',background:'linear-gradient(145deg,#FACC15,#EA580C)',color:'#fff',fontSize:15,fontWeight:900,touchAction:'none',boxShadow:'0 10px 28px rgba(0,0,0,.28)'}}>✏️ {pencilAmmo}</button>}
        <button type="button" onClick={()=>{const next=!runEnabled;setRunEnabled(next);motionRef.current.run=next;}} style={{width:orientation==='landscape'?74:64,height:orientation==='landscape'?74:64,borderRadius:24,border:runEnabled?'3px solid #FDE68A':'2px solid rgba(255,255,255,.55)',background:runEnabled?'linear-gradient(145deg,rgba(14,165,233,.92),rgba(3,105,161,.92))':'rgba(7,21,47,.68)',color:'#fff',fontSize:17,fontWeight:900,boxShadow:'0 10px 28px rgba(0,0,0,.28)',touchAction:'none'}}>{runEnabled?'إيقاف':'جري'}</button>
        <Level3Control label="قفز" large={orientation==='landscape'} accent onDown={touchButton('jump')(true)} onUp={touchButton('jump')(false)}/>
      </div>
    </div>}
    {gameOver&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-rose-300 bg-slate-900 p-6 text-center text-white"><div className="text-6xl">❤️‍🩹</div><h2 className="mt-3 text-2xl font-black">انتهت المحاولة</h2><p className="mt-3 leading-7 text-slate-300">تعود الحركة إلى بداية المرحلة، مع بقاء نتائج الأسئلة التي أجبت عنها محفوظة.</p><button type="button" onClick={restartAttempt} className="mt-5 w-full rounded-2xl bg-rose-400 py-3 font-black text-slate-950">إعادة المرحلة من البداية</button></div></div>}
    {finished&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-amber-300 bg-slate-900 p-6 text-center text-white"><div className="text-6xl">🎉</div><h2 className="mt-2 text-2xl font-black">اكتمل تحدي نهاية العام</h2><p className="mt-3 text-slate-300">عبرت بوابات الإنجاز وتفاعلت مع جميع أسئلة المهمة الحالية.</p><div className="my-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-800 p-3"><b className="text-amber-300">{score}</b><small className="block">النقاط</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-emerald-300">{correctIds.length}</b><small className="block">صحيح</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-sky-300">{campaignMode==='review'?'∞':'3'}</b><small className="block">المراحل</small></div></div><button type="button" onClick={onClose} className="w-full rounded-2xl bg-amber-400 py-3 font-black text-slate-950">متابعة رحلة سوبر طالب</button></div></div>}
  </div>;
};

function Level3Hud({text,color}:{text:string;color:string}){return <div style={{padding:'9px 13px',borderRadius:14,background:'rgba(7,21,47,.84)',border:`1px solid ${color}88`,color:'#fff',fontWeight:900,fontSize:15,boxShadow:'0 8px 25px rgba(0,0,0,.18)'}}>{text}</div>;}
function Level3Control({label,accent,large,onDown,onUp}:{label:string;accent?:boolean;large?:boolean;onDown:()=>void;onUp:()=>void}){return <button type="button" onContextMenu={event=>event.preventDefault()} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture?.(event.pointerId);onDown();}} onPointerUp={event=>{event.preventDefault();if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture?.(event.pointerId);onUp();}} onPointerCancel={onUp} onLostPointerCapture={onUp} style={{width:large?74:64,height:large?74:64,borderRadius:24,border:'2px solid rgba(255,255,255,.55)',background:accent?'linear-gradient(145deg,rgba(245,158,11,.92),rgba(234,88,12,.92))':'rgba(7,21,47,.68)',color:'#fff',fontSize:label.length>1?16:27,fontWeight:900,boxShadow:'0 10px 28px rgba(0,0,0,.28)',touchAction:'none',WebkitUserSelect:'none',userSelect:'none'}}>{label}</button>;}

export default SuperTalebLevel3;
