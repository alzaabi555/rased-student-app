export type SuperTalebSound =
  | 'jump' | 'land' | 'correct' | 'incorrect' | 'questionOpen'
  | 'pencilEarned' | 'pencilFire' | 'obstacleHit' | 'coin' | 'star'
  | 'stationActivate' | 'gateOpen' | 'gameOver' | 'levelComplete';

export interface SuperTalebAudioSettings {
  effectsEnabled: boolean;
  effectsVolume: number;
}

const STORAGE_KEY = 'rased_super_taleb_audio_settings_v1';
const DEFAULT_SETTINGS: SuperTalebAudioSettings = { effectsEnabled: true, effectsVolume: 0.72 };

class SuperTalebAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: SuperTalebAudioSettings = DEFAULT_SETTINGS;
  private lastPlayed = new Map<SuperTalebSound, number>();

  constructor() {
    if (typeof window !== 'undefined') {
      try { this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch {}
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) void this.context?.suspend();
      });
    }
  }

  unlock = async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!this.context) {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.settings.effectsVolume;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  };

  setEnabled(enabled: boolean): void {
    this.settings.effectsEnabled = enabled;
    this.persist();
  }

  setVolume(volume: number): void {
    this.settings.effectsVolume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = this.settings.effectsVolume;
    this.persist();
  }

  getSettings(): SuperTalebAudioSettings { return { ...this.settings }; }

  play = (sound: SuperTalebSound): void => {
    if (!this.settings.effectsEnabled) return;
    void this.unlock().then(() => {
      const ctx = this.context; const destination = this.master;
      if (!ctx || !destination) return;
      const nowMs = performance.now();
      const cooldown = sound === 'land' ? 110 : sound === 'obstacleHit' ? 300 : 45;
      if (nowMs - (this.lastPlayed.get(sound) || 0) < cooldown) return;
      this.lastPlayed.set(sound, nowMs);

      const tone = (frequency: number, start: number, duration: number, type: OscillatorType='sine', gain=0.13, endFrequency?: number) => {
        const osc=ctx.createOscillator(); const amp=ctx.createGain(); const filter=ctx.createBiquadFilter();
        osc.type=type; osc.frequency.setValueAtTime(frequency,start);
        if(endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(25,endFrequency),start+duration);
        filter.type='lowpass'; filter.frequency.value=3600;
        amp.gain.setValueAtTime(0.0001,start); amp.gain.exponentialRampToValueAtTime(gain,start+0.012); amp.gain.exponentialRampToValueAtTime(0.0001,start+duration);
        osc.connect(filter);filter.connect(amp);amp.connect(destination);osc.start(start);osc.stop(start+duration+0.02);
      };
      const noise = (start:number,duration:number,gain=0.08,highpass=300) => {
        const length=Math.max(1,Math.floor(ctx.sampleRate*duration));const buffer=ctx.createBuffer(1,length,ctx.sampleRate);const data=buffer.getChannelData(0);
        for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
        const source=ctx.createBufferSource();const amp=ctx.createGain();const filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='highpass';filter.frequency.value=highpass;amp.gain.setValueAtTime(gain,start);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);source.connect(filter);filter.connect(amp);amp.connect(destination);source.start(start);
      };
      const t=ctx.currentTime+0.004;
      switch(sound){
        case 'jump': tone(360,t,.13,'sine',.12,760); tone(190,t,.10,'triangle',.06,310); break;
        case 'land': noise(t,.075,.10,110); tone(120,t,.09,'sine',.11,72); break;
        case 'questionOpen': tone(520,t,.08,'sine',.09,650); tone(780,t+.07,.11,'sine',.10,940); break;
        case 'correct': tone(523,t,.11,'sine',.11); tone(659,t+.08,.12,'sine',.11); tone(784,t+.16,.18,'sine',.13); break;
        case 'incorrect': tone(330,t,.13,'triangle',.08,280); tone(245,t+.10,.18,'sine',.07,210); break;
        case 'pencilEarned': tone(700,t,.08,'sine',.09); tone(920,t+.06,.11,'triangle',.10); noise(t,.08,.025,1800); break;
        case 'pencilFire': noise(t,.08,.055,850); tone(840,t,.13,'sawtooth',.055,250); break;
        case 'obstacleHit': noise(t,.13,.11,180); tone(150,t,.14,'square',.07,90); break;
        case 'coin': tone(880,t,.07,'sine',.09); tone(1320,t+.055,.11,'sine',.10); break;
        case 'star': tone(660,t,.08,'sine',.08); tone(990,t+.05,.11,'sine',.10); tone(1320,t+.11,.14,'sine',.10); break;
        case 'stationActivate': tone(310,t,.10,'triangle',.08); tone(465,t+.07,.12,'sine',.10); tone(620,t+.15,.16,'sine',.11); break;
        case 'gateOpen': noise(t,.18,.035,900); tone(260,t,.18,'sine',.08,520); tone(780,t+.14,.20,'sine',.11); break;
        case 'gameOver': tone(310,t,.18,'triangle',.09,240); tone(220,t+.14,.25,'sine',.09,135); break;
        case 'levelComplete': tone(392,t,.12,'sine',.09); tone(523,t+.09,.13,'sine',.10); tone(659,t+.18,.14,'sine',.11); tone(784,t+.28,.28,'sine',.13); break;
      }
    }).catch(()=>{});
  };

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch {}
  }
}

export const superTalebAudio = new SuperTalebAudioEngine();
export default superTalebAudio;
