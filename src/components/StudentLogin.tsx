import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Shield, Fingerprint, ArrowRight, ArrowLeft, 
  Sparkles, Gamepad2, Loader2 
} from 'lucide-react';

interface StudentLoginProps {
  onLogin: (civilId: string) => void;
}

const StudentLogin: React.FC<StudentLoginProps> = ({ onLogin }) => {
  const { t, dir } = useApp();
  const [civilId, setCivilId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // تحقق بسيط من أن الرقم المدني ليس فارغاً
    if (!civilId.trim() || civilId.length < 5) {
      setError(t('invalidCivilId') || 'يرجى إدخال رقم مدني صحيح.');
      return;
    }

    // تشغيل تأثير التحميل
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(civilId); 
    }, 1500);
  };

  return (
    // 🚀 الحاوية الرئيسية شفافة لتسمح لثيم RamadanTheme بالظهور
    <div className="min-h-[100dvh] bg-transparent flex flex-col items-center justify-center p-6 relative overflow-hidden" dir={dir}>
      
      {/* 🛡️ الشعار والترحيب */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center mb-10 animate-in slide-in-from-top-8 duration-700">
        <div className="relative mb-6">
          {/* وهج خلفي للشعار (نبض خفيف) */}
          <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-full rotate-12 absolute inset-0 opacity-20 blur-2xl animate-[pulse_3s_ease-in-out_infinite]"></div>
          {/* مربع الشعار الزجاجي */}
          <div className="w-24 h-24 bg-white/5 backdrop-blur-xl border border-white/20 rounded-[2rem] flex items-center justify-center relative shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            <Gamepad2 className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
            <Sparkles className="absolute -top-3 -right-3 w-7 h-7 text-amber-400 animate-bounce drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
          </div>
        </div>
        
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-cyan-200 tracking-tight text-center drop-shadow-lg mb-3">
          {t('rasedApp') || 'راصد'}
        </h1>
        <div className="px-5 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
          <span className="text-xs font-black text-indigo-100 tracking-widest uppercase drop-shadow-sm">
            {t('studentEdition') || 'نسخة الطالب'}
          </span>
        </div>
      </div>

      {/* 🔐 صندوق تسجيل الدخول الزجاجي الفاخر */}
      <div className="relative z-10 w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-500 delay-150">
        
        <h2 className="text-2xl font-black text-white mb-2 text-center drop-shadow-sm">
          {t('welcomeBack') || 'أهلاً بك يا بطل! 🚀'}
        </h2>
        <p className="text-xs font-bold text-indigo-200/60 text-center mb-8 leading-relaxed">
          {t('enterCivilIdToStart') || 'أدخل رقمك المدني لتبدأ المغامرة وتحصد النقاط'}
        </p>

        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* حقل الرقم المدني */}
          <div className="relative">
            <div className="relative group">
              <div className="absolute inset-y-0 flex items-center pointer-events-none px-5 text-indigo-300/40 group-focus-within:text-cyan-400 transition-colors z-10">
                <Fingerprint className="w-6 h-6 drop-shadow-sm" />
              </div>
              <input
                type="number"
                value={civilId}
                onChange={(e) => setCivilId(e.target.value)}
                placeholder={t('civilIdPlaceholder') || 'الرقم المدني'}
                className={`w-full bg-black/20 text-white text-center text-xl font-black tracking-widest py-4 px-14 rounded-[1.5rem] outline-none border transition-all duration-300 shadow-inner placeholder:text-indigo-200/30 placeholder:font-bold ${
                  error ? 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.15)]' : 'border-white/10 focus:border-cyan-400/50 focus:bg-white/10 focus:shadow-[0_0_25px_rgba(34,211,238,0.15)]'
                }`}
                style={{ MozAppearance: 'textfield' }} // لإخفاء أسهم الأرقام في المتصفحات
              />
            </div>
            {/* رسالة الخطأ (متحركة) */}
            {error && (
              <p className="absolute -bottom-6 left-0 right-0 text-[10px] font-black text-rose-400 text-center animate-in slide-in-from-top-1 drop-shadow-sm">
                {error}
              </p>
            )}
          </div>

          {/* زر الدخول المضيء (Gamer Vibe) */}
          <button
            type="submit"
            disabled={isLoading || !civilId.trim()}
            className="relative w-full group overflow-hidden rounded-[1.5rem] disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all active:scale-[0.98]"
          >
            {/* خلفية الزر المتدرجة */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-cyan-500 to-blue-500 transition-transform duration-500 group-hover:scale-105"></div>
            {/* لمعة زجاجية خفيفة */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
            
            <div className="relative bg-transparent px-6 py-4 flex items-center justify-center gap-3">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin drop-shadow-md" />
              ) : (
                <>
                  <span className="text-base font-black text-white tracking-wide drop-shadow-md">
                    {t('startAdventure') || 'انطلق الآن'}
                  </span>
                  <ArrowIcon className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform drop-shadow-md" />
                </>
              )}
            </div>
          </button>
        </form>
      </div>

      {/* 🏢 تذييل الشاشة */}
      <div className="absolute bottom-[max(env(safe-area-inset-bottom),2rem)] left-0 right-0 flex justify-center items-center gap-2 opacity-30 z-10 animate-in fade-in duration-1000 delay-500">
        <Shield className="w-4 h-4 text-indigo-200" />
        <span className="text-[10px] font-black text-indigo-200 tracking-widest uppercase">
          <span className="text-white">مجموعة تطبيق راصد</span> 
        </span>
      </div>

    </div>
  );
};

export default StudentLogin;
