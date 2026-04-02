import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  return {
    plugins: [react()],
    // 💡 إذا كان البناء لغرض النشر (Production) فسيستخدم المسار النسبي الذي يعمل مع الكل
    // وإذا كان للتطوير فسيستخدم المسار الجذري
    base: mode === 'production' ? './' : '/',
  }
})
