import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // 👈 هذا هو السطر المفقود الذي سيعيد الحياة للألوان!
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)