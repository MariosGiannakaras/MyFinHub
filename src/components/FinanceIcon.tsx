import {
  ArrowLeftRight, BadgeEuro, Banknote, BookOpen, Bot, CarFront, CircleParking, Coffee,
  CreditCard, Droplets, Dumbbell, Fuel, Gift, GraduationCap, HandCoins, HeartPulse, Home,
  Landmark, Music2, PawPrint, Pill, PiggyBank, Plane, Popcorn, ReceiptText, RotateCcw,
  Scissors, ShieldCheck, Shirt, ShoppingBag, ShoppingBasket, SlidersHorizontal, Smartphone,
  Sparkles, Split, Stethoscope, UtensilsCrossed, WalletCards, Wifi, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import { explicitFinanceCategoryIcon } from '../lib/categoryFinanceIcon';
import { financeIconSpec, type FinanceIconInput, type FinanceIconKey } from '../lib/financeIcons';
import type { FinanceSettings } from '../types';
import { CategoryIconGlyph } from './CategoryIconGlyph';

const ICONS:Record<FinanceIconKey,LucideIcon>={
  coffee:Coffee,
  dining:UtensilsCrossed,
  supermarket:ShoppingBasket,
  clothing:Shirt,
  electronics:Smartphone,
  shopping:ShoppingBag,
  fuel:Fuel,
  parking:CircleParking,
  vehicle:CarFront,
  service:Wrench,
  doctor:Stethoscope,
  pharmacy:Pill,
  health:HeartPulse,
  home:Home,
  electricity:Zap,
  water:Droplets,
  internet:Wifi,
  phone:Smartphone,
  streaming:Popcorn,
  music:Music2,
  ai:Bot,
  gym:Dumbbell,
  barber:Scissors,
  insurance:ShieldCheck,
  gift:Gift,
  education:GraduationCap,
  travel:Plane,
  pet:PawPrint,
  entertainment:Popcorn,
  tax:Landmark,
  salary:BadgeEuro,
  income:WalletCards,
  expense:ReceiptText,
  transfer:ArrowLeftRight,
  saving:PiggyBank,
  cash:Banknote,
  refund:RotateCcw,
  reconciliation:SlidersHorizontal,
  lending:HandCoins,
  card:CreditCard,
  subscription:Sparkles,
  installment:BadgeEuro,
  split:Split,
  fallback:ReceiptText,
};

type FinanceIconProps=FinanceIconInput&{settings?:FinanceSettings;size?:number;className?:string;label?:string};

export function FinanceIcon({kind,category,subcategory,note,settings,size=16,className='',label}:FinanceIconProps){
  const spec=financeIconSpec({kind,category,subcategory,note});
  const explicitKey=settings?explicitFinanceCategoryIcon(settings,{kind,category,subcategory,note}):null;
  const Icon=ICONS[spec.key];
  return <span className={`finance-icon tone-${spec.tone} ${className}`.trim()} data-icon-key={explicitKey??spec.key} data-icon-source={explicitKey?'category-preference':'heuristic'} aria-label={label} aria-hidden={label?undefined:true}>{explicitKey?<CategoryIconGlyph iconKey={explicitKey} size={size}/>:<Icon size={size}/>}</span>;
}

export function FinanceIconInline(props:FinanceIconProps){
  return <FinanceIcon {...props} size={props.size??15} className="finance-icon-inline"/>;
}
