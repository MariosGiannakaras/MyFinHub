import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DesktopAppLockGate } from './components/DesktopAppLockGate';
import { initializeTheme } from './lib/theme';
import './styles.css';

initializeTheme();
createRoot(document.getElementById('root')!).render(<StrictMode><DesktopAppLockGate><App/></DesktopAppLockGate></StrictMode>);
