import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';

export type DialogShellRole='dialog'|'alertdialog';
export type DialogMotionMode='system'|'reduced'|'full';
type DialogDataAttributes=Readonly<Record<`data-${string}`,string|number|boolean|undefined>>;

export function DialogShell({
  open,
  className,
  role='dialog',
  ariaLabelledBy,
  ariaDescribedBy,
  busy=false,
  motionMode='system',
  preferredFocus,
  onRequestClose,
  dataAttributes,
  children,
}:{
  open:boolean;
  className:string;
  role?:DialogShellRole;
  ariaLabelledBy:string;
  ariaDescribedBy?:string;
  busy?:boolean;
  motionMode?:DialogMotionMode;
  preferredFocus:string;
  onRequestClose:()=>void;
  dataAttributes?:DialogDataAttributes;
  children:ReactNode;
}){
  const systemReduced=useReducedMotion();
  const reduce=Boolean(systemReduced)||motionMode==='reduced';
  const modalRef=useModalFocus<HTMLElement>(open,preferredFocus,onRequestClose);

  return <AnimatePresence>{open?<motion.div className="modal-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={onRequestClose}>
    <motion.section
      {...dataAttributes}
      ref={modalRef}
      className={`quick-modal ${className} neo-raised`}
      role={role}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-busy={busy||undefined}
      tabIndex={-1}
      initial={reduce?false:{opacity:0,scale:.97,y:12}}
      animate={{opacity:1,scale:1,y:0}}
      exit={reduce?undefined:{opacity:0,scale:.98,y:8}}
      transition={{duration:reduce?0:.18}}
      onMouseDown={event=>event.stopPropagation()}
    >
      {children}
    </motion.section>
  </motion.div>:null}</AnimatePresence>;
}
