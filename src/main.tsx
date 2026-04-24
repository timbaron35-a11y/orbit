import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply saved color scheme before first render to avoid flash
const saved = localStorage.getItem('orbit_color_scheme') ?? 'dark';
document.documentElement.setAttribute('data-theme', saved);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
