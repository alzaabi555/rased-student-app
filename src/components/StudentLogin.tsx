import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Shield,
  Fingerprint,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Gamepad2,
  Loader2
} from 'lucide-react';

interface StudentLoginProps {
  onLogin: (civilId: string) => void;
}

const StudentLogin: React.FC<StudentLoginProps> = ({ onLogin }) => {
  const { t, dir } = useApp();

  // استدعاء الرقم المحفوظ من الذاكرة فور فتح التطبيق
  const [civilId, setCivilId] = useState(
    () => localStorage.getItem('last_civil_id') || ''
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCivilId = civilId.trim();

    if (!cleanCivilId || cleanCivilId.length < 5) {
      setError(t('invalidCivilId') || 'يرجى إدخال رقم مدني صحيح.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      localStorage.setItem('last_civil_id', cleanCivilId);
      setIsLoading(false);
      onLogin(cleanCivilId);
    }, 800);
  };

  return (
    <div
      className="rased-student-light min-h-[100dvh] bg-bgMain text-textPrimary flex flex-col items-center justify-center p-6 relative overflow-hidden"
      dir={dir}
    >
      {/* الشعار والترحيب */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center mb-8 animate-in slide-in-from-top-8 duration-700">
        <div className="relative mb-6">
          {/* توهج خفيف جدًا */}
          <div className="w-28 h-28 bg-primary/10 rounded-full rotate-12 absolute inset-0 opacity-80 blur-2xl animate-[pulse_3s_ease-in-out_infinite]" />

          {/* مربع الشعار */}
          <div className="w-24 h-24 bg-bgCard border border-borderColor rounded-[2rem] flex items-center justify-center relative shadow-card">
            <Gamepad2 className="w-12 h-12 text-info" />

            <Sparkles className="absolute -top-3 -right-3 w-7 h-7 text-warning animate-bounce" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tight text-center mb-3">
          {t('rasedApp') || 'راصد'}
        </h1>

        <div className="px-5 py-1.5 bg-bgCard border border-borderColor rounded-full flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />

          <span className="text-xs font-black text-textSecondary tracking-widest uppercase">
            {t('studentEdition') || 'نسخة الطالب'}
          </span>
        </div>
      </div>

      {/* صندوق تسجيل الدخول */}
      <div className="relative z-10 w-full max-w-sm bg-bgCard border border-borderColor rounded-[2.25rem] p-8 shadow-elevated animate-in fade-in zoom-in duration-500 delay-150">
        <h2 className="text-2xl font-black text-textPrimary mb-2 text-center">
          {t('welcomeBack') || 'أهلاً بك يا بطل! 🚀'}
        </h2>

        <p className="text-xs font-bold text-textSecondary text-center mb-8 leading-relaxed">
          {t('enterCivilIdToStart') ||
            'أدخل رقمك المدني لتبدأ المغامرة وتحصد النقاط'}
        </p>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* حقل الرقم المدني */}
          <div className="relative">
            <div className="relative group">
              <div
                className={`absolute inset-y-0 ${
                  dir === 'rtl' ? 'right-0 pr-5' : 'left-0 pl-5'
                } flex items-center pointer-events-none text-textMuted group-focus-within:text-primary transition-colors z-10`}
              >
                <Fingerprint className="w-6 h-6" />
              </div>

              <input
                type="number"
                value={civilId}
                onChange={(e) => setCivilId(e.target.value)}
                placeholder={t('civilIdPlaceholder') || 'الرقم المدني'}
                className={`w-full bg-bgSoft text-textPrimary text-center text-xl font-black tracking-widest py-4 px-14 rounded-[1.5rem] outline-none border transition-all duration-300 shadow-sm placeholder:text-textMuted placeholder:font-bold ${
                  error
                    ? 'border-danger/50 bg-danger/5 text-danger'
                    : 'border-borderColor focus:border-primary focus:bg-bgCard'
                }`}
                style={{ MozAppearance: 'textfield' }}
              />
            </div>

            {error && (
              <p className="absolute -bottom-6 left-0 right-0 text-[10px] font-black text-danger text-center animate-in slide-in-from-top-1">
                {error}
              </p>
            )}
          </div>

          {/* زر الدخول */}
          <button
            type="submit"
            disabled={isLoading || !civilId.trim()}
            className="relative w-full group overflow-hidden rounded-[1.5rem] disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-card transition-all active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-info transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />

            <div className="relative bg-transparent px-6 py-4 flex items-center justify-center gap-3">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <>
                  <span className="text-base font-black text-white tracking-wide">
                    {t('startAdventure') || 'انطلق الآن'}
                  </span>

                  <ArrowIcon
                    className={`w-5 h-5 text-white transition-transform ${
                      dir === 'rtl'
                        ? 'group-hover:-translate-x-1'
                        : 'group-hover:translate-x-1'
                    }`}
                  />
                </>
              )}
            </div>
          </button>
        </form>
      </div>

      {/* تذييل الشاشة */}
      <div className="absolute bottom-[max(env(safe-area-inset-bottom),2rem)] left-0 right-0 flex justify-center items-center gap-2 z-10 animate-in fade-in duration-1000 delay-500">
        <Shield className="w-4 h-4 text-textMuted" />

        <span className="text-[10px] font-black text-textMuted tracking-widest uppercase">
          مجموعة تطبيق راصد
        </span>
      </div>
    </div>
  );
};

export default StudentLogin;
