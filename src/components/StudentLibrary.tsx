import React from 'react';
import { useApp } from '../context/AppContext';
import { Library, Youtube, FileText, Link as LinkIcon, ExternalLink, BookOpen } from 'lucide-react';

// =========================================================================
// 💎 1. إعادة استخدام الغلاف الزجاجي الفاخر (لكي يكون التصميم موحداً)
// =========================================================================
const GlassLayout: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, children }) => {
  const { dir } = useApp();
  return (
    <div className="flex flex-col h-full bg-transparent text-white relative overflow-hidden" dir={dir}>
      
      {/* 🌟 الهيدر الزجاجي (Sticky Glass Header) */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/60 backdrop-blur-2xl border-b border-white/10 pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <h1 className="text-xl font-black text-white flex items-center gap-2 mb-0.5 drop-shadow-md">
          {icon}
          {title}
        </h1>
        {subtitle && (
          <p className="text-[10px] font-bold text-indigo-200/70 pl-7">
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

  // دالة ذكية لاختيار الأيقونة واللون حسب نوع الملف (تم تصغير الأيقونات قليلاً)
  const getIconInfo = (type: string, link: string) => {
    const lowerLink = link.toLowerCase();
    if (type === 'youtube' || type === 'video' || lowerLink.includes('youtube.com') || lowerLink.includes('youtu.be')) {
      return {
        icon: <Youtube className="w-6 h-6 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />,
        bg: 'bg-rose-500/10 border-rose-500/20'
      };
    }
    if (type === 'pdf' || type === 'file' || lowerLink.includes('.pdf') || lowerLink.includes('drive.google')) {
      return {
        icon: <FileText className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />,
        bg: 'bg-cyan-500/10 border-cyan-500/20'
      };
    }
    return {
      icon: <LinkIcon className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />,
      bg: 'bg-emerald-500/10 border-emerald-500/20'
    };
  };

  return (
    <GlassLayout
      title="مكتبة المصادر"
      subtitle="ملخصات، شروحات، وملفات تهمك 📚"
      icon={<Library className="w-5 h-5 text-fuchsia-400" />}
    >
      {resources.length > 0 ? (
        resources.map((res: any) => {
          const styleInfo = getIconInfo(res.type, res.link);
          return (
            // 🔮 بطاقة المرجع (تصميم مدمج Compact)
            <a 
              key={res.id} 
              href={res.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white/5 border border-white/10 rounded-[1.5rem] p-3 flex items-center gap-3 hover:bg-white/10 transition-all group shadow-sm active:scale-[0.98]"
            >
              <div className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border ${styleInfo.bg}`}>
                {styleInfo.icon}
              </div>
              
              <div className="flex-1 min-w-0 pr-1">
                <h3 className="text-sm font-bold text-white mb-1 truncate leading-snug group-hover:text-fuchsia-300 transition-colors">
                  {res.title}
                </h3>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-200/60">
                  <span className="bg-indigo-500/20 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1 truncate">
                    <BookOpen className="w-2.5 h-2.5" /> {res.subject}
                  </span>
                </div>
              </div>

              <div className="shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-colors ml-1">
                <ExternalLink className="w-4 h-4 text-indigo-200/50 group-hover:text-fuchsia-400 transition-colors" />
              </div>
            </a>
          );
        })
      ) : (
        <div className="text-center py-16 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl border-dashed mt-4 shadow-sm">
          <Library className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <h3 className="text-sm font-black text-white mb-1.5">مكتبتك فارغة حالياً</h3>
          <p className="text-[10px] font-bold text-indigo-200/50 leading-relaxed px-6">
            سيقوم معلموك بإضافة ملخصات الدروس ومقاطع الشرح هنا لتتمكن من مراجعتها في أي وقت.
          </p>
        </div>
      )}
    </GlassLayout>
  );
};

export default StudentLibrary;
