import React, { useEffect } from 'react';

// =========================================================================
// ☀️ ثيم راصد الطالب الفاتح - Rased Student Light Theme
// =========================================================================

const RamadanTheme: React.FC = () => {
  useEffect(() => {
    const lightColor = '#F8FAFC';

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }

    metaThemeColor.setAttribute('content', lightColor);

    document.documentElement.style.backgroundColor = lightColor;
    document.body.style.backgroundColor = lightColor;

    document.documentElement.setAttribute('data-theme', 'light');

    return () => {
      document.documentElement.style.backgroundColor = lightColor;
      document.body.style.backgroundColor = lightColor;
    };
  }, []);

  return (
    <>
      <style>
        {`
          :root,
          :root[data-theme="light"],
          :root[data-theme="dark"],
          :root[data-theme="glass"],
          :root[data-theme="ramadan"] {
            color-scheme: light;

            --bg: 248 250 252;
            --card: 255 255 255;
            --glass: 241 245 249;

            --text: 15 23 42;
            --secondary: 71 85 105;
            --muted: 148 163 184;

            --border: 226 232 240;
            --border-soft: 238 242 247;

            --primary: 79 70 229;
            --primary-hover: 67 56 202;
            --primary-soft: 238 242 255;

            --success: 22 163 74;
            --danger: 220 38 38;
            --warning: 217 119 6;
            --info: 2 132 199;

            --glow: 79 70 229;
          }

          html,
          body,
          #root {
            min-height: 100%;
            background: rgb(var(--bg)) !important;
            color: rgb(var(--text)) !important;
          }

          body {
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }

          input,
          textarea,
          select {
            background-color: rgb(var(--card));
            color: rgb(var(--text));
            border-color: rgb(var(--border));
          }

          input::placeholder,
          textarea::placeholder {
            color: rgb(var(--muted));
          }

          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: transparent !important;
          }

          ::-webkit-scrollbar-thumb {
            background: rgb(203 213 225) !important;
            border-radius: 999px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: rgb(148 163 184) !important;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent !important;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgb(203 213 225) !important;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgb(148 163 184) !important;
          }

          .student-light-card {
            background: rgb(var(--card));
            color: rgb(var(--text));
            border: 1px solid rgb(var(--border));
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
          }

          .student-soft-panel {
            background: rgb(var(--glass));
            color: rgb(var(--text));
            border: 1px solid rgb(var(--border));
          }
        `}
      </style>

      {/* الخلفية الفاتحة الموحدة */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#F8FAFC]">
        {/* توهج ناعم جدًا بلون راصد */}
        <div className="absolute top-[-18%] right-[8%] w-[420px] h-[420px] bg-indigo-500/5 rounded-full blur-[120px]" />

        {/* توهج معلوماتي خفيف */}
        <div className="absolute bottom-[-18%] left-[8%] w-[360px] h-[360px] bg-sky-500/5 rounded-full blur-[110px]" />
      </div>
    </>
  );
};

export default RamadanTheme;
