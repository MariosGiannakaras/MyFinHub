import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../lib/format';

type DailyFlow={day:number;income:number;expense:number};
type CategoryTotal={name:string;value:number};

export function DashboardSummaryChart({income,expense,animateCharts}:{income:number;expense:number;animateCharts:boolean}){
  return <ResponsiveContainer width="100%" height={74}>
    <PieChart accessibilityLayer={false}>
      <Pie data={[{name:'Έσοδα',value:Math.max(income,0)},{name:'Έξοδα',value:Math.max(expense,0)}]} dataKey="value" innerRadius={21} outerRadius={31} strokeWidth={0} isAnimationActive={animateCharts}>
        <Cell fill="#36c978"/><Cell fill="#ff5b62"/>
      </Pie>
    </PieChart>
  </ResponsiveContainer>;
}

const flowAxisInteger=new Intl.NumberFormat('el-GR',{maximumFractionDigits:0});
const flowAxisCompact=new Intl.NumberFormat('el-GR',{notation:'compact',maximumFractionDigits:1});

function flowAxisLabel(value:number){
  const amount=Number(value);
  if(!Number.isFinite(amount))return '—';
  return `${(Math.abs(amount)>=10000?flowAxisCompact:flowAxisInteger).format(Math.round(amount))} €`;
}

export function DashboardFlowChart({data,month,animateCharts}:{data:DailyFlow[];month:string;animateCharts:boolean}){
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart accessibilityLayer={false} data={data} barGap={1} margin={{top:4,right:6,bottom:0,left:4}}>
      <CartesianGrid stroke="#e6edf6" vertical={false}/>
      <XAxis dataKey="day" tick={{fontSize:10,fill:'#62728e'}} interval={4} axisLine={false} tickLine={false}/>
      <YAxis tick={{fontSize:10,fill:'#62728e'}} tickFormatter={flowAxisLabel} width={64} tickMargin={4} axisLine={false} tickLine={false}/>
      <Tooltip formatter={(value,name)=>[money.format(Number(value)),name==='income'?'Έσοδα':'Έξοδα']} labelFormatter={day=>`${day} ${new Intl.DateTimeFormat('el-GR',{month:'short'}).format(new Date(`${month}-01T12:00:00`)).replace('.','')}`}/>
      <Bar dataKey="income" fill="#36c978" radius={[2,2,0,0]} isAnimationActive={animateCharts}/>
      <Bar dataKey="expense" fill="#ff5b62" radius={[2,2,0,0]} isAnimationActive={animateCharts}/>
    </BarChart>
  </ResponsiveContainer>;
}

export function DashboardCategoryChart({categories,animateCharts,colors}:{categories:CategoryTotal[];animateCharts:boolean;colors:string[]}){
  return <ResponsiveContainer width="100%" height="100%">
    <PieChart accessibilityLayer={false}>
      <Pie data={categories} dataKey="value" nameKey="name" innerRadius={45} outerRadius={67} strokeWidth={0} isAnimationActive={animateCharts}>
        {categories.map((_,index)=><Cell key={index} fill={colors[index%colors.length]}/>)}
      </Pie>
      <Tooltip formatter={value=>money.format(Number(value))}/>
    </PieChart>
  </ResponsiveContainer>;
}
