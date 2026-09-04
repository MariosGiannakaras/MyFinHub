import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DesktopAppLockGate } from './components/DesktopAppLockGate';
import { initializeTheme } from './lib/theme';
import './styles.css';

initializeTheme();

async function bootstrap(){
  const desktopBridge=typeof window==='undefined'?undefined:(window as unknown as {myFinHubDesktop?:unknown}).myFinHubDesktop;
  if(desktopBridge)await import('./components/DesktopAppLockGate.css');
  createRoot(document.getElementById('root')!).render(<StrictMode><DesktopAppLockGate><App/></DesktopAppLockGate></StrictMode>);
}

void bootstrap();
