import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeTheme } from './lib/theme';
import './styles.css';

initializeTheme();

async function bootstrap(){
  const desktopBridge=typeof window==='undefined'?undefined:(window as unknown as {myFinHubDesktop?:unknown}).myFinHubDesktop;
  if(desktopBridge){
    document.documentElement.dataset.myfinhubDesktop='true';
    await import('./styles/desktop-titlebar.css');
  }
  // Fail closed: never mount finance UI until the security gate and styles load.
  const [{ DesktopAppLockGate }] = await Promise.all([
    import('./components/DesktopAppLockGate'),
    import('./components/DesktopAppLockGate.css'),
  ]);
  createRoot(document.getElementById('root')!).render(<StrictMode><DesktopAppLockGate><App/></DesktopAppLockGate></StrictMode>);
}

void bootstrap();
