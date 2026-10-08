import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import { useGame } from './store/game';

// Dev-only handle used for screenshots and debugging.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
