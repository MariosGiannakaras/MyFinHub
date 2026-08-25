import {
  ArrowLeftRight, BadgeEuro, Banknote, BookOpen, Bot, CarFront, CircleParking, Coffee,
  CreditCard, Droplets, Dumbbell, Fuel, Gift, GraduationCap, HandCoins, HeartPulse, Home,
  Landmark, Music2, PawPrint, Pill, PiggyBank, Plane, Popcorn, ReceiptText, RotateCcw,
  Scissors, ShieldCheck, Shirt, ShoppingBag, ShoppingBasket, SlidersHorizontal, Smartphone,
  Sparkles, Split, Stethoscope, UtensilsCrossed, WalletCards, Wifi, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';

const ICONS:Record<string,LucideIcon>={
  coffee:Coffee,dining:UtensilsCrossed,groceries:ShoppingBasket,bakery:ShoppingBasket,takeaway:UtensilsCrossed,
  clothing:Shirt,shoes:Shirt,shopping:ShoppingBag,gift:Gift,electronics:Smartphone,computer:Smartphone,phone:Smartphone,gaming:Bot,
  fuel:Fuel,parking:CircleParking,car:CarFront,motorcycle:CarFront,'public-transport':CarFront,taxi:CarFront,service:Wrench,insurance:ShieldCheck,
  home:Home,rent:Home,furniture:Home,maintenance:Wrench,electricity:Zap,water:Droplets,heating:Zap,internet:Wifi,telephone:Smartphone,
  subscription:Sparkles,streaming:Popcorn,music:Music2,cinema:Popcorn,entertainment:Popcorn,sport:Dumbbell,gym:Dumbbell,
  health:HeartPulse,doctor:Stethoscope,dentist:Stethoscope,pharmacy:Pill,hospital:HeartPulse,
  education:GraduationCap,books:BookOpen,course:GraduationCap,travel:Plane,flight:Plane,hotel:Home,ferry:Plane,holiday:Plane,
  pet:PawPrint,child:Gift,family:Home,'personal-care':Sparkles,barber:Scissors,cosmetics:Sparkles,tobacco:ReceiptText,kiosk:ShoppingBag,
  tax:Landmark,government:Landmark,'bank-fee':Landmark,cash:Banknote,card:CreditCard,loan:HandCoins,installment:BadgeEuro,
  saving:PiggyBank,investment:Landmark,salary:BadgeEuro,bonus:Gift,income:WalletCards,refund:RotateCcw,sale:ShoppingBag,
  freelance:WalletCards,business:WalletCards,charity:HandCoins,celebration:Gift,calendar:ReceiptText,receipt:ReceiptText,wallet:WalletCards,
  transfer:ArrowLeftRight,reconciliation:SlidersHorizontal,other:Split,
};

export function CategoryIconGlyph({iconKey,size=18,label}:{iconKey:string;size?:number;label?:string}){
  const Icon=ICONS[iconKey]??ReceiptText;
  return <span className="category-icon-glyph" aria-label={label} aria-hidden={label?undefined:true} data-category-icon={iconKey}><Icon size={size}/></span>;
}
