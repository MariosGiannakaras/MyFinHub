import {
  ArrowLeftRight, Baby, BadgeEuro, Banknote, BedDouble, Bike, BookOpen, Briefcase,
  Building2, BusFront, CakeSlice, CalendarDays, CarFront, Cigarette, CircleParking, Coffee,
  CreditCard, Droplets, Dumbbell, Flame, Footprints, Fuel, Gamepad2, Gift, GraduationCap,
  HandCoins, HeartHandshake, HeartPulse, Home, Hospital, KeyRound, Landmark, Laptop,
  Music2, PawPrint, Pill, PiggyBank, Plane, Popcorn, Presentation, ReceiptText, RotateCcw,
  Scissors, ShieldCheck, Ship, Shirt, ShoppingBag, ShoppingBasket, SlidersHorizontal,
  Smartphone, Sofa, Sparkles, Split, Stethoscope, Store, Tv, Users, UtensilsCrossed,
  WalletCards, Wheat, Wifi, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import { decodeCategoryIconValue } from '../lib/categoryIconRegistry';
import { MultiPackCategoryGlyph } from './MultiPackCategoryGlyph';
import { TablerCategoryGlyph } from './TablerCategoryGlyph';

const ICONS:Record<string,LucideIcon>={
  coffee:Coffee,dining:UtensilsCrossed,groceries:ShoppingBasket,bakery:Wheat,takeaway:Bike,
  clothing:Shirt,shoes:Footprints,shopping:ShoppingBag,gift:Gift,electronics:Smartphone,computer:Laptop,phone:Smartphone,gaming:Gamepad2,
  fuel:Fuel,parking:CircleParking,car:CarFront,motorcycle:Bike,'public-transport':BusFront,taxi:CarFront,service:Wrench,insurance:ShieldCheck,
  home:Home,rent:KeyRound,furniture:Sofa,maintenance:Wrench,electricity:Zap,water:Droplets,heating:Flame,internet:Wifi,telephone:Smartphone,
  subscription:Sparkles,streaming:Tv,music:Music2,cinema:Popcorn,entertainment:Popcorn,sport:Dumbbell,gym:Dumbbell,
  health:HeartPulse,doctor:Stethoscope,dentist:Stethoscope,pharmacy:Pill,hospital:Hospital,
  education:GraduationCap,books:BookOpen,course:Presentation,travel:Plane,flight:Plane,hotel:BedDouble,ferry:Ship,holiday:Plane,
  pet:PawPrint,child:Baby,family:Users,'personal-care':Sparkles,barber:Scissors,cosmetics:Sparkles,tobacco:Cigarette,kiosk:Store,
  tax:Landmark,government:Building2,'bank-fee':Landmark,cash:Banknote,card:CreditCard,loan:HandCoins,installment:BadgeEuro,
  saving:PiggyBank,investment:Landmark,salary:BadgeEuro,bonus:Gift,income:WalletCards,refund:RotateCcw,sale:ShoppingBag,
  freelance:Briefcase,business:Briefcase,charity:HeartHandshake,celebration:CakeSlice,calendar:CalendarDays,receipt:ReceiptText,wallet:WalletCards,
  transfer:ArrowLeftRight,reconciliation:SlidersHorizontal,other:Split,
};

export function CategoryIconGlyph({iconKey,size=18,label}:{iconKey:string;size?:number;label?:string}){
  const decoded=decodeCategoryIconValue(iconKey);
  if(decoded.pack==='tabler')return <span className="category-icon-glyph" aria-label={label} aria-hidden={label?undefined:true} data-category-icon={iconKey} data-icon-pack="tabler"><TablerCategoryGlyph iconKey={decoded.key} size={size}/></span>;
  if(decoded.pack==='phosphor'||decoded.pack==='heroicons'||decoded.pack==='bootstrap')return <span className="category-icon-glyph" aria-label={label} aria-hidden={label?undefined:true} data-category-icon={iconKey} data-icon-pack={decoded.pack}><MultiPackCategoryGlyph pack={decoded.pack} iconKey={decoded.key} size={size}/></span>;
  const Icon=ICONS[decoded.key]??ReceiptText;
  return <span className="category-icon-glyph" aria-label={label} aria-hidden={label?undefined:true} data-category-icon={iconKey} data-icon-pack="lucide"><Icon size={size}/></span>;
}
