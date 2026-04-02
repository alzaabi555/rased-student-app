import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 👈 هذا هو السطر السحري الذي تمت إضافته
  base: '/https://github.com/alzaabi555/rased-student-app/', 
})
