import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DesktopAppLockGate } from './components/DesktopAppLockGate';
import './components/DesktopAppLockGate.css';
import { initializeTheme } from './lib/theme';
import './styles.css';

initializeTheme();

async function bootstrap(){
  const desktopBridge=typeof window==='undefined'?undefined:(window as unknown as {myFinHubDesktop?:unknown}).myFinHubDesktop;
  if(desktopBridge){
    document.documentElement.dataset.myfinhubDesktop='true';
    await import('./styles/desktop-titlebar.css');
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><DesktopAppLockGate><App/></DesktopAppLockGate></StrictMode>);
}

void bootstrap();
