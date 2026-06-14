import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Library,
  Youtube,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  BookOpen
} from 'lucide-react';

// =========================================================================
// ☀️ 1. الغلاف الفاتح الموحد لصفحة المكتبة
// =========================================================================
const GlassLayout: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, children }) => {
  const { dir } = useApp();

  return (
    <div
      className="rased-student-light flex flex-col h-full bg-bgMain text-textPrimary relative overflow-hidden"
      dir={dir}
    >
      {/* الهيدر الفاتح */}
      <header className="sticky top-0 z-40 bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <h1 className="text-xl font-black text-textPrimary flex items-center gap-2 mb-0.5">
          {icon}
          {title}
        </h1>

        {subtitle && (
          <p className="text-[10px] font-bold text-textSecondary pr-7">
            {subtitle}
          </p>
        )}
      </header>

      {/* المحتوى المنزلق */}
      <main className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-5 pb-[100px] space-y-3">
        {children}
      </main>
    </div>
  );
};

// =========================================================================
// 📚 2. محتوى صفحة المكتبة
// =========================================================================
const StudentLibrary: React.FC = () => {
  const { studentData } = useApp();

  const resources = studentData?.resources || [];

  // اختيار الأيقونة واللون حسب نوع المصدر أو الرابط
  const getIconInfo = (type?: string, link?: string) => {
    const safeType = String(type || '').toLowerCase();
    const lowerLink = String(link || '').toLowerCase();

    if (
      safeType === 'youtube' ||
      safeType === 'video' ||
      lowerLink.includes('youtube.com') ||
      lowerLink.includes('youtu.be')
    ) {
      return {
        icon: <Youtube className="w-6 h-6 text-rose-600" />,
        bg: 'bg-rose-50 border-rose-200',
        text: 'text-rose-700',
        hover: 'group-hover:text-rose-700'
      };
    }

    if (
      safeType === 'pdf' ||
      safeType === 'file' ||
      lowerLink.includes('.pdf') ||
      lowerLink.includes('drive.google')
    ) {
      return {
        icon: <FileText className="w-6 h-6 text-info" />,
        bg: 'bg-sky-50 border-sky-200',
        text: 'text-info',
        hover: 'group-hover:text-info'
      };
    }

    return {
      icon: <LinkIcon className="w-6 h-6 text-success" />,
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-success',
      hover: 'group-hover:text-success'
    };
  };

  return (
    <GlassLayout
      title="مكتبة المصادر"
      subtitle="ملخصات، شروحات، وملفات تهمك 📚"
      icon={<Library className="w-5 h-5 text-primary" />}
    >
      {resources.length > 0 ? (
        resources.map((res: any) => {
          const styleInfo = getIconInfo(res.type, res.link);

          return (
            {res.link}
              <div
                className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border ${styleInfo.bg}`}
              >
                {styleInfo.icon}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <h3
                  className={`text-sm font-bold text-textPrimary mb-1 truncate leading-snug transition-colors ${styleInfo.hover}`}
                >
                  {res.title || 'مصدر بدون عنوان'}
                </h3>

                <div className="flex items-center gap-1.5 text-[9px] font-bold text-textSecondary">
                  <span className="bg-bgSoft px-2 py-0.5 rounded-md border border-borderColor flex items-center gap-1 truncate max-w-[180px]">
                    <BookOpen className="w-2.5 h-2.5 text-primary shrink-0" />
                    <span className="truncate">
                      {res.subject || 'عام'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="shrink-0 w-8 h-8 rounded-full bg-bgSoft flex items-center justify-center group-hover:bg-primary/10 transition-colors ml-1 border border-borderColor">
                <ExternalLink className="w-4 h-4 text-textSecondary group-hover:text-primary transition-colors" />
              </div>
            </a>
          );
        })
      ) : (
        <div className="text-center py-16 bg-bgCard border border-borderColor rounded-3xl border-dashed mt-4 shadow-sm">
          <Library className="w-12 h-12 text-textMuted mx-auto mb-3" />

          <h3 className="text-sm font-black text-textPrimary mb-1.5">
            مكتبتك فارغة حالياً
          </h3>

          <p className="text-[10px] font-bold text-textSecondary leading-relaxed px-6">
            سيقوم معلموك بإضافة ملخصات الدروس ومقاطع الشرح هنا لتتمكن من مراجعتها في أي وقت.
          </p>
        </div>
      )}
    </GlassLayout>
  );
};

export default StudentLibrary;
