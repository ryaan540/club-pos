import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './noirpos.jsx'
import ToastProvider from './components/ToastProvider.jsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration errors; the app still works without service worker support.
    });
  });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => { void registration.unregister(); });
  });
  if ('caches' in window) {
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('noir-pos-cache-')).map(key => caches.delete(key))));
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
