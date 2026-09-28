import { lazy, Suspense, type ReactNode } from 'react';
import { PageSkeleton } from './AppSkeleton';

const WorkspaceStyleLayer=lazy(()=>import('./WorkspaceStyleLayer').then(module=>({default:module.WorkspaceStyleLayer})));

export function WorkspaceStyles({children}:{children:ReactNode}){
  return <Suspense fallback={<PageSkeleton/>}><WorkspaceStyleLayer>{children}</WorkspaceStyleLayer></Suspense>;
}
