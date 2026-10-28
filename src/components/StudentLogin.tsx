import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface StudentLoginProps {
  onLogin: (secretCode: string) => void;
}

const StudentLogin: React.FC<StudentLoginProps> = ({ onLogin }) => {
  const { t, dir } = useApp();
  const [secretCode, setSecretCode] = useState(
    () => localStorage.getItem('last_secret_code') || ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCode, setShowCode] = useState(true);

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const normalizedCode = useMemo(
    () => secretCode.trim().toUpperCase().replace(/\s+/g, ''),
    [secretCode]
  );

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!normalizedCode || normalizedCode.length < 5) {
      setError(
        t('invalidSecretCode') ||
          'أدخل كود راصد صحيحًا، مثل RSD-A7X9.'
      );
      return;
    }

    setIsLoading(true);
    window.setTimeout(() => {
      localStorage.setItem('last_secret_code', normalizedCode);
      onLogin(normalizedCode);
      setIsLoading(false);
    }, 650);
  };

  const handleCodeChange = (value: string) => {
    setError('');
    setSecretCode(value.toUpperCase().replace(/\s+/g, ''));
  };

  return (
    <main
      className="rased-student-light relative min-h-[100dvh] overflow-hidden bg-[#f6faf7] text-slate-900"
      dir={dir}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-amber-50 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid w-full overflow-hidden rounded-[2.25rem] border border-white/90 bg-white/90 shadow-[0_24px_80px_rgba(15,118,80,0.10)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <aside className="relative hidden min-h-[650px] overflow-hidden border-l border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50/60 p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full border-[38px] border-emerald-100/45" />
            <div className="pointer-events-none absolute bottom-10 right-8 grid grid-cols-5 gap-3 opacity-40">
              {Array.from({ length: 20 }).map((_, index) => (
                <span key={index} className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ))}
            </div>

            <div className="relative">
              <div className="mb-10 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xl font-black text-emerald-900">
                    {t('rasedApp') || 'راصد'}
                  </p>
                  <p className="text-xs font-bold text-emerald-700/70">
                    {t('studentEdition') || 'منصة الطالب التعليمية'}
                  </p>
                </div>
              </div>

              <div className="max-w-md">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-black text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  تعلم، تابع، وأنجز
                </span>
                <h1 className="mt-6 text-4xl font-black leading-[1.35] text-slate-900">
                  كل أدواتك التعليمية
                  <span className="block text-emerald-600">في مكان واحد</span>
                </h1>
                <p className="mt-5 text-sm font-bold leading-8 text-slate-500">
                  تابع مهامك ودرجاتك واختباراتك ومراسلاتك، وادخل إلى تجربتك التعليمية بأمان باستخدام كود راصد.
                </p>
              </div>
            </div>

            <div className="relative grid gap-3">
              {[
                'دخول موحد وآمن للطالب',
                'وصول سريع إلى المهام والاختبارات',
                'تواصل مباشر مع معلمي المواد'
              ].map(item => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white bg-white/75 px-4 py-3 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <span className="text-sm font-black text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col justify-center p-5 sm:p-9 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 flex items-center justify-between lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-emerald-900">{t('rasedApp') || 'راصد'}</p>
                    <p className="text-[10px] font-bold text-slate-400">{t('studentEdition') || 'نسخة الطالب'}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">دخول آمن</span>
              </div>

              <div className="mb-8">
                <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <h2 className="text-3xl font-black tracking-tight text-slate-900">
                  أهلًا بك في راصد
                </h2>
                <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
                  أدخل كود الطالب للانتقال إلى حسابك ومتابعة يومك الدراسي.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="student-rased-code" className="text-sm font-black text-slate-700">
                      كود راصد
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">الكود القديم أو الموحد</span>
                  </div>

                  <div className={`group flex items-center rounded-2xl border bg-white px-4 shadow-sm transition-all ${error ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-50'}`}>
                    <KeyRound className={`h-5 w-5 shrink-0 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-emerald-600'}`} />
                    <input
                      id="student-rased-code"
                      type={showCode ? 'text' : 'password'}
                      value={secretCode}
                      onChange={event => handleCodeChange(event.target.value)}
                      placeholder={t('secretCodePlaceholder') || 'RSD-A7X9'}
                      dir="ltr"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'student-code-error' : undefined}
                      className="min-w-0 flex-1 bg-transparent px-3 py-4 text-center text-lg font-black tracking-[0.16em] text-slate-900 outline-none placeholder:text-sm placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(value => !value)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      aria-label={showCode ? 'إخفاء الكود' : 'إظهار الكود'}
                    >
                      {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="mt-2 min-h-5">
                    {error ? (
                      <p id="student-code-error" role="alert" className="text-xs font-black text-red-600">
                        {error}
                      </p>
                    ) : (
                      <p className="text-[11px] font-bold text-slate-400">
                        اكتب الكود كما استلمته من المدرسة، دون مسافات.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !normalizedCode}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-black text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] transition hover:bg-emerald-600 hover:shadow-[0_16px_34px_rgba(16,185,129,0.28)] focus:outline-none focus:ring-4 focus:ring-emerald-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    <>
                      الدخول إلى حسابي
                      <ArrowIcon className={`h-5 w-5 transition-transform ${dir === 'rtl' ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-black text-emerald-900">حسابك محمي</p>
                  <p className="mt-1 text-[11px] font-bold leading-6 text-emerald-800/70">
                    يستخدم الكود للوصول الآمن إلى بياناتك التعليمية داخل منظومة راصد.
                  </p>
                </div>
              </div>

              <footer className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                مجموعة تطبيقات راصد التعليمية
              </footer>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
};

export default StudentLogin;
