import React, { createContext, useContext } from 'react';

const AppContext = createContext({
  t: (key: string) => undefined as any, // لكي تعمل النصوص العربية الافتراضية
  dir: 'rtl' as const,
});

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  return <AppContext.Provider value={{ t: () => undefined, dir: 'rtl' }}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);