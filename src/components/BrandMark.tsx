type BrandMarkProps={
  mode?:'icon'|'lockup';
  size?:'sm'|'md'|'lg';
  subtitle?:string;
  className?:string;
  label?:string;
};

export function BrandMark({mode='icon',size='md',subtitle,className='',label='MyFinHub'}:BrandMarkProps){
  const icon=<span className="brand-mark-icon" role={mode==='icon'?'img':undefined} aria-label={mode==='icon'?label:undefined}>
    <img className="brand-mark-image brand-mark-image-light" src="/brand/icon-light-192.png" alt="" draggable={false}/>
    <img className="brand-mark-image brand-mark-image-dark" src="/brand/icon-dark-192.png" alt="" draggable={false}/>
  </span>;
  if(mode==='icon')return <span className={`brand-mark brand-mark-${size} ${className}`.trim()}>{icon}</span>;
  return <span className={`brand-mark brand-mark-lockup brand-mark-${size} ${className}`.trim()}>
    {icon}
    <span className="brand-mark-copy"><span className="brand-word">MyFin<span>Hub</span></span>{subtitle?<small>{subtitle}</small>:null}</span>
  </span>;
}
