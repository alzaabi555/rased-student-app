import React from 'react';
import { User } from 'lucide-react';

interface StudentAvatarProps {
  gender?: 'male' | 'female';
  className?: string;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({ gender = 'male', className = '' }) => {
  // ألوان متوهجة تناسب تصميم الطالب (أزرق/سماوي للأولاد، ووردي/بنفسجي للبنات)
  const bgGradient = gender === 'female' 
    ? 'from-pink-500 to-purple-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
    : 'from-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]';

  return (
    <div className={`relative flex items-center justify-center rounded-full bg-gradient-to-br ${bgGradient} ${className}`}>
      <User className="w-1/2 h-1/2 text-white/90" strokeWidth={2.5} />
    </div>
  );
};