import React from 'react';
import { useApp } from '../context/AppContext';
import { Library, Youtube, FileText, Link as LinkIcon, ExternalLink, BookOpen } from 'lucide-react';

const StudentLibrary: React.FC = () => {
  const { dir, studentData } = useApp();
  
  // سحب المصادر من بيانات الطالب (التي أضفناها للسيرفر قبل قليل)
  const resources = studentData?.resources || [];

  // دالة ذكية لاختيار الأيقونة واللون حسب نوع الملف
  const getIcon = (type: string, link: string) => {
    const lowerLink = link.toLowerCase();
    if (type === 'youtube' || type === 'video' || lowerLink.includes('youtube.com') || lowerLink.includes('youtu.be')) {
      return <Youtube className="w-8 h-8 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />;
    }
    if (type === 'pdf' || type === 'file' || lowerLink.includes('.pdf') || lowerLink.includes('drive.google')) {
      return <FileText className="w-8 h-8 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />;
    }
    return <LinkIcon className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />;
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto custom-scrollbar pt-safe pb-24" dir={dir}>
      
      {/* 🌟 رأس الصفحة */}
      <div className="pt-8 pb-6 px-6 bg-white/5 backdrop-blur-3xl rounded-b-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.15)] border-b border-white/10 sticky top-0 z-30 shrink-0">
        <h1 className="text-2xl font-black text-white flex items-center gap-2 mb-1 drop-shadow-md">
          <Library className="w-6 h-6 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.5)]" />
          مكتبة المصادر
        </h1>
        <p className="text-[11px] font-bold text-indigo-200/80 drop-shadow-sm">
          ملخصات، شروحات، وملفات تهمك 📚
        </p>
      </div>

      {/* 📚 قائمة الملفات */}
      <div className="px-6 py-6 flex-1 relative z-10">
        {resources.length > 0 ? (
          <div className="space-y-4">
            {resources.map((res: any) => (
              <a 
                key={res.id} 
                href={res.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white/5 border border-white/10 rounded-[1.5rem] p-4 flex items-center gap-4 hover:bg-white/10 transition-all group shadow-sm"
              >
                <div className="shrink-0 bg-black/30 p-3 rounded-2xl border border-white/5">
                  {getIcon(res.type, res.link)}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white mb-1.5 line-clamp-2 leading-snug group-hover:text-fuchsia-300 transition-colors">
                    {res.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-200/70">
                    <span className="bg-indigo-500/20 px-2 py-1 rounded-md border border-white/10 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {res.subject}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-colors">
                  <ExternalLink className="w-5 h-5 text-indigo-200/50 group-hover:text-fuchsia-400 transition-colors" />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] border-dashed mt-8 shadow-inner">
            <Library className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-base font-black text-white mb-2">مكتبتك فارغة حالياً</h3>
            <p className="text-[11px] font-bold text-indigo-200/60 leading-relaxed">
              سيقوم معلموك بإضافة ملخصات الدروس ومقاطع الشرح هنا لتتمكن من مراجعتها في أي وقت.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentLibrary;
