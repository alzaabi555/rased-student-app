import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 👈 النقطة والشرطة المائلة هنا تجعل المسار "نسبياً"، فيعمل بكفاءة على الويب والأندرويد معاً!
  base: './', 
})
