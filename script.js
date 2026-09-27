'use strict';

const KEY='atlant-earnings-v2';
const OLD_KEY='atlant-earnings-v1';
const DEFAULT_TARIFFS={
  city:{minWeekday:4400,minWeekend:4500,pointWeekday:150,pointWeekend:155,order:5,lot:27,multi4Weekday:150,multi4Weekend:155,multi5:42},
  country:{minWeekday:3950,minWeekend:4050,pointWeekday:140,pointWeekend:150,order:4,lot:48,multi4Weekday:140,multi4Weekend:150,multi5:38},
  car:{r1:2000,r2:2100,r3:2200,r4:2300,r5:2400,r6:2500}
};
let state={tariffs:clone(DEFAULT_TARIFFS),days:[],cars:[]};
function localMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
let currentMonth=localMonth();
let wizardStep=1;

function clone(x){return JSON.parse(JSON.stringify(x));}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0;}
function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
function money(v){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n(v)))+' ₽';}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function safeGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
function safeSet(key,val){try{localStorage.setItem(key,val);return true}catch(e){return false}}
function merge(a,b){if(!b||typeof b!=='object')return a;for(const k of Object.keys(b)){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k])merge(a[k],b[k]);else a[k]=b[k]}return a}
function load(){
  try{
    const raw=safeGet(KEY)||safeGet(OLD_KEY);
    if(raw){const x=JSON.parse(raw);state.tariffs=merge(clone(DEFAULT_TARIFFS),x.tariffs||{});state.days=Array.isArray(x.days)?x.days:[];state.days=state.days.map(d=>({...d,mgt:n(d.mgt),extraAdd:d.extraAdd!=null?n(d.extraAdd):n(d.bonus)+n(d.manualAdd),extraReason:d.extraReason||''}));state.cars=Array.isArray(x.cars)?x.cars:[];state.cars=state.cars.map(c=>({...c,amount:c.amount??null}));}
  }catch(e){console.error(e);}
}
function seedKnownData(){
  const known=[
    {date:'2026-09-11',tariff:'city',points:13,orders:59,lots:28,multi4:0,multi5:0,mgt:0,extraAdd:0,extraReason:'',actual:4080,note:''},
    {date:'2026-09-14',tariff:'city',points:11,orders:170,lots:47,multi4:0,multi5:0,mgt:0,extraAdd:0,extraReason:'',actual:4794,note:''},
    {date:'2026-09-17',tariff:'city',points:24,orders:146,lots:31,multi4:0,multi5:0,mgt:0,extraAdd:0,extraReason:'',actual:'',note:''},
    {date:'2026-09-18',tariff:'city',points:4,orders:102,lots:23,multi4:0,multi5:0,mgt:0,extraAdd:2000,extraReason:'Вышел в свой личный выходной',actual:'',note:''},
    {date:'2026-09-21',tariff:'city',points:15,orders:161,lots:64,multi4:0,multi5:0,mgt:0,extraAdd:0,extraReason:'',actual:'',note:''},
    {date:'2026-09-22',tariff:'city',points:19,orders:196,lots:41,multi4:0,multi5:0,mgt:0,extraAdd:0,extraReason:'',actual:'',note:''},
    {date:'2026-09-25',tariff:'country',points:5,orders:85,lots:24,multi4:17,multi5:0,mgt:19,extraAdd:0,extraReason:'',actual:'',note:'Доставка клиентам: 19 МГТ'},
    {date:'2026-09-26',tariff:'city',points:11,orders:105,lots:25,multi4:0,multi5:0,mgt:0,extraAdd:0,extraReason:'',actual:'',note:''}
  ];
  for(const item of known){
    let d=state.days.find(x=>x.date===item.date);
    if(!d){d={id:'seed-day-'+item.date};state.days.push(d);}
    Object.assign(d,item);
  }
  let car=state.cars.find(x=>x.date==='2026-09-27' && n(x.km)===45);
  if(!car){state.cars.push({id:'seed-car-2026-09-27',date:'2026-09-27',km:45,amount:2000,note:'Перегон автомобиля на сервис'});}
  else {car.amount=2000;car.note='Перегон автомобиля на сервис';}
}
function save(){
  const ok=safeSet(KEY,JSON.stringify(state));
  if(!ok)toast('Не удалось сохранить данные браузером');
  renderAll();
}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),1800)}
function dateObj(s){return new Date(s+'T12:00:00');}
function isWeekend(s){const d=dateObj(s).getDay();return d===0||d===6;}
function dayType(s){return isWeekend(s)?'выходной':'будний';}
function monthName(ym){const [y,m]=ym.split('-').map(Number);return new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));}
function fmtDate(s){return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(dateObj(s));}
function calcDay(d){
  const t=state.tariffs[d.tariff]||state.tariffs.city;
  const weekend=isWeekend(d.date);
  const min=weekend?t.minWeekend:t.minWeekday;
  const pointRate=weekend?t.pointWeekend:t.pointWeekday;
  const multi4Rate=weekend?t.multi4Weekend:t.multi4Weekday;
  const points=n(d.points),orders=n(d.orders),lots=n(d.lots),multi4=n(d.multi4),multi5=n(d.multi5),mgt=n(d.mgt);
  // МГТ — отдельная отчётная графа. В расчёт входит только через обычные заказы, чтобы не было двойного начисления.
  const raw=points*pointRate+orders*t.order+lots*t.lot+multi4*multi4Rate+multi5*t.multi5+n(d.extraAdd ?? (n(d.bonus)+n(d.manualAdd)));
  const calculated=Math.max(min,raw);
  const actual=d.actual!==''&&d.actual!=null&&Number.isFinite(Number(d.actual))?Number(d.actual):null;
  return {raw,min,calculated,actual,pointRate,multi4Rate,weekend};
}
function calcCar(km,override){if(override!==undefined&&override!==null&&override!==''&&Number.isFinite(Number(override)))return Number(override);const t=state.tariffs.car;km=n(km);if(km<=0)return 0;if(km<=20)return t.r1;if(km<=50)return t.r2;if(km<=80)return t.r3;if(km<=100)return t.r4;if(km<=120)return t.r5;return t.r6;}
function shownDayAmount(d){const c=calcDay(d);return c.actual!==null?c.actual:c.calculated;}
function inMonth(date, ym){return typeof date==='string' && date.slice(0,7)===ym;}
function monthCar(){return state.cars.filter(x=>inMonth(x.date,currentMonth)).reduce((sum,x)=>sum+calcCar(x.km,x.amount),0)}

function renderSummary(){
  const days=state.days.filter(d=>inMonth(d.date,currentMonth));
  const cars=state.cars.filter(c=>inMonth(c.date,currentMonth));
  const shiftsCalculated=days.reduce((sum,d)=>sum+calcDay(d).calculated,0);
  const shiftsShown=days.reduce((sum,d)=>sum+shownDayAmount(d),0);
  const confirmed=days.reduce((sum,d)=>sum+(calcDay(d).actual!==null?calcDay(d).actual:0),0);
  const carsTotal=cars.reduce((sum,c)=>sum+calcCar(c.km,c.amount),0);
  const calculated=shiftsCalculated+carsTotal;
  const total=shiftsShown+carsTotal;
  const totalEl=document.getElementById('monthTotal');
  const calcEl=document.getElementById('monthCalculated');
  const actualEl=document.getElementById('monthActual');
  const carEl=document.getElementById('monthCar');
  if(totalEl) totalEl.textContent=money(total);
  if(calcEl) calcEl.textContent=money(calculated);
  if(actualEl) actualEl.textContent=money(confirmed);
  if(carEl) carEl.textContent=money(carsTotal);
  const range=document.getElementById('monthRange');
  if(range) range.textContent=monthName(currentMonth);
}
function renderDays(){
  const all=document.getElementById('showAllMonths').checked;
  const list=state.days.filter(d=>all||d.date.startsWith(currentMonth)).sort((a,b)=>b.date.localeCompare(a.date));
  const cars=state.cars.filter(c=>all||c.date.startsWith(currentMonth)).sort((a,b)=>b.date.localeCompare(a.date));
  let html='';
  if(!list.length&&!cars.length)html='<div class="empty">Пока ничего нет.<br>Нажми «＋ Добавить день» и внеси смену по шагам.</div>';
  for(const d of list){const c=calcDay(d);html+=`<article class="day-card"><div class="day-head"><div><div class="day-date">${fmtDate(d.date)}</div><div class="day-meta">${d.tariff==='city'?'Город':'Загород'} · ${dayType(d.date)}${d.note?' · '+esc(d.note):''}</div></div><div class="day-money">${money(shownDayAmount(d))}<small>${c.actual!==null?'факт':'расчёт'} · расчёт ${money(c.calculated)}</small></div></div><div class="day-stats"><div class="stat"><b>${n(d.points)}</b><span>точек</span></div><div class="stat"><b>${n(d.orders)}</b><span>заказов</span></div><div class="stat"><b>${n(d.lots)}</b><span>ЛОТов</span></div><div class="stat"><b>${n(d.multi4)+n(d.multi5)}</b><span>мульти</span></div><div class="stat"><b>${n(d.mgt)}</b><span>МГТ клиентам</span></div><div class="stat"><b>${money(n(d.extraAdd ?? (n(d.bonus)+n(d.manualAdd))))}</b><span>доп. сумма</span></div></div><div class="day-bottom"><div>${c.actual!==null?`<span class="actual">Фактически: ${money(c.actual)}</span>`:`<span class="muted">Фактическая выплата ещё не внесена</span>`}</div><button class="edit" onclick="editDay('${d.id}')">Изменить</button></div></article>`}
  for(const c of cars){html+=`<article class="day-card car-card"><div class="day-head"><div><div class="day-date">${fmtDate(c.date)}</div><div class="day-meta car-badge">ПЕРЕГОН · ${n(c.km)} км${c.note?' · '+esc(c.note):''}</div></div><div class="day-money">${money(calcCar(c.km,c.amount))}<small>перегон автомобиля</small></div></div><div class="day-bottom"><span class="muted">Автомобильный перегон</span><button class="edit" onclick="editCar('${c.id}')">Изменить</button></div></article>`}
  document.getElementById('daysList').innerHTML=html;
}
function tariffFields(type){
  const t=state.tariffs[type];
  const labels=type==='city'?[
    ['minWeekday','Минимум будний'],['minWeekend','Минимум выходной'],['pointWeekday','Точка / ПВЗ будний'],['pointWeekend','Точка / ПВЗ выходной'],['order','Заказ'],['lot','ЛОТ'],['multi4Weekday','Мульти ≤4 будний'],['multi4Weekend','Мульти ≤4 выходной'],['multi5','Мульти 5+']
  ]:[
    ['minWeekday','Минимум будний'],['minWeekend','Минимум выходной'],['pointWeekday','Точка / ПВЗ будний'],['pointWeekend','Точка / ПВЗ выходной'],['order','Заказ'],['lot','ЛОТ'],['multi4Weekday','Мульти ≤4 будний'],['multi4Weekend','Мульти ≤4 выходной'],['multi5','Мульти 5+']
  ];
  return labels.map(([key,label])=>`<label class="tariff-field"><span>${label}</span><input type="number" step="1" data-tariff="${type}" data-key="${key}" value="${n(t[key])}"></label>`).join('');
}
function renderTariffs(){
  document.getElementById('cityFields').innerHTML=tariffFields('city');document.getElementById('countryFields').innerHTML=tariffFields('country');
  const t=state.tariffs.car;const labels=[['r1','4–20 км'],['r2','21–50 км'],['r3','51–80 км'],['r4','81–100 км'],['r5','101–120 км'],['r6','121+ км']];
  document.getElementById('carFields').innerHTML=labels.map(([k,l])=>`<label class="tariff-field"><span>${l}</span><input type="number" step="1" data-tariff="car" data-key="${k}" value="${n(t[k])}"></label>`).join('');
  document.querySelectorAll('[data-tariff]').forEach(el=>el.addEventListener('change',()=>{state.tariffs[el.dataset.tariff][el.dataset.key]=n(el.value);save();toast('Тариф сохранён')}));
}
function periodKey(date){const [y,m]=date.split('-').map(Number);return `${y}-${String(m).padStart(2,'0')}-${date.slice(8,10)<=15?'01':'16'}`;}
function payoutLabel(key){const [y,m,start]=key.split('-').map(Number);if(start===1)return `25–30 ${monthName(`${y}-${String(m).padStart(2,'0')}`)}`;const next=new Date(y,m,1);return `15–20 ${monthName(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`)}`;}
function renderPayments(){
  const groups={};
  for(const d of state.days){if(!d.date)continue;const k=periodKey(d.date);(groups[k]??={days:[],cars:[]}).days.push(d)}
  for(const c of state.cars){if(!c.date)continue;const k=periodKey(c.date);(groups[k]??={days:[],cars:[]}).cars.push(c)}
  const keys=Object.keys(groups).sort().reverse();
  if(!keys.length){document.getElementById('paymentsList').innerHTML='<div class="empty">Здесь появятся периоды после добавления рабочих дней или перегонов.</div>';return}
  document.getElementById('paymentsList').innerHTML=keys.map(k=>{
    const group=groups[k];
    const days=group.days.sort((a,b)=>a.date.localeCompare(b.date));
    const cars=group.cars.sort((a,b)=>a.date.localeCompare(b.date));
    const calcDays=days.reduce((s,d)=>s+calcDay(d).calculated,0);
    const factDays=days.reduce((s,d)=>s+(calcDay(d).actual??0),0);
    const shownDays=days.reduce((s,d)=>s+shownDayAmount(d),0);
    const carTotal=cars.reduce((s,c)=>s+calcCar(c.km,c.amount),0);
    const shown=shownDays+carTotal;
    const calc=calcDays+carTotal;
    return `<article class="payment-group"><div class="payment-group-head"><div><b>${k.endsWith('-01')?'1–15':'16–конец месяца'}</b><div class="muted">Период работы · выплата ${payoutLabel(k)}</div></div><div><b>${money(shown)}</b><div class="muted">расчёт ${money(calc)} · факт смен ${money(factDays)} · перегоны ${money(carTotal)}</div></div></div><div class="payment-items">${days.map(d=>{const c=calcDay(d);const extra=n(d.extraAdd ?? (n(d.bonus)+n(d.manualAdd)));return `<div class="payment-item payment-day-item"><div><span>${fmtDate(d.date)} · ${d.tariff==='city'?'Город':'Загород'}</span><small>${n(d.points)} точек · ${n(d.orders)} заказов · ${n(d.lots)} ЛОТов${n(d.mgt)?` · ${n(d.mgt)} МГТ клиентам`:''}${extra?` · доп. ${money(extra)}`:''}</small></div><strong>${money(shownDayAmount(d))}</strong></div>`}).join('')}${cars.map(c=>`<div class="payment-item car-payment-item"><div><span>${fmtDate(c.date)} · 🚗 Перегон</span><small>${n(c.km)} км${c.note?' · '+esc(c.note):''}</small></div><strong>${money(calcCar(c.km,c.amount))}</strong></div>`).join('')}</div></article>`
  }).join('');
}
function renderAll(){document.getElementById('monthPicker').value=currentMonth;renderSummary();renderDays();renderTariffs();renderPayments();}

function setWizardStep(step){wizardStep=Math.max(1,Math.min(5,step));document.querySelectorAll('.step').forEach(el=>el.classList.toggle('active',Number(el.dataset.step)===wizardStep));document.querySelectorAll('.progress i').forEach((el,i)=>el.classList.toggle('active',i<wizardStep));document.getElementById('wizardBack').disabled=wizardStep===1;document.getElementById('wizardNext').classList.toggle('hidden',wizardStep===5);document.getElementById('wizardSave').classList.toggle('hidden',wizardStep!==5);if(wizardStep===5)updateDayPreview();}
function updateCalendarRule(){const date=document.getElementById('dayDate').value;if(!date)return;const weekend=isWeekend(date);const t=state.tariffs[document.getElementById('dayTariff').value];document.getElementById('calendarRule').innerHTML=`<strong>${fmtDate(date)} — ${weekend?'ВЫХОДНОЙ':'БУДНИЙ'} тариф</strong><span>Минимум: ${money(weekend?t.minWeekend:t.minWeekday)} · ставка точки: ${money(weekend?t.pointWeekend:t.pointWeekday)}</span><small>Личный график не влияет на будний/выходной тариф. Если вышел в свой выходной — это отдельная надбавка.</small>`;}
function formDay(){return {date:document.getElementById('dayDate').value,tariff:document.getElementById('dayTariff').value,points:n(document.getElementById('dayPoints').value),orders:n(document.getElementById('dayOrders').value),lots:n(document.getElementById('dayLots').value),multi4:n(document.getElementById('dayMulti4').value),multi5:n(document.getElementById('dayMulti5').value),mgt:n(document.getElementById('dayMgt').value),extraAdd:n(document.getElementById('dayExtraAdd').value),extraReason:document.getElementById('dayExtraReason').value.trim(),actual:document.getElementById('dayActual').value};}
function updateDayPreview(){const d=formDay();const c=calcDay(d);document.getElementById('dayPreview').innerHTML=`<div>По введённым данным: <strong>${money(c.calculated)}</strong></div><div class="muted">До минималки: ${money(c.raw)} · Минимум дня: ${money(c.min)}</div><div class="muted">Точки: ${n(d.points)} × ${money(c.pointRate)} · Заказы: ${n(d.orders)} × ${money(state.tariffs[d.tariff].order)} · ЛОТы: ${n(d.lots)} × ${money(state.tariffs[d.tariff].lot)}</div><div class="muted">Доставка клиентам — МГТ: ${n(d.mgt)} · Дополнительная сумма: ${money(d.extraAdd)}${d.extraReason?` · ${esc(d.extraReason)}`:''}</div>${d.actual!==''?`<div class="actual">Факт: ${money(d.actual)}</div>`:''}`;}
function fillDay(d){
  document.getElementById('dayId').value=d?.id||'';document.getElementById('dayDate').value=d?.date||new Date().toISOString().slice(0,10);document.getElementById('dayTariff').value=d?.tariff||'city';document.getElementById('dayNote').value=d?.note||'';document.getElementById('dayPoints').value=n(d?.points);document.getElementById('dayOrders').value=n(d?.orders);document.getElementById('dayLots').value=n(d?.lots);document.getElementById('dayMulti4').value=n(d?.multi4);document.getElementById('dayMulti5').value=n(d?.multi5);document.getElementById('dayMgt').value=n(d?.mgt);document.getElementById('dayExtraAdd').value=n(d?.extraAdd ?? (n(d?.bonus)+n(d?.manualAdd)));document.getElementById('dayExtraReason').value=d?.extraReason||'';document.getElementById('dayActual').value=d?.actual??'';updateCalendarRule();updateDayPreview();
}
function newDay(){document.getElementById('dayModalTitle').textContent='Добавить день';document.getElementById('wizardLabel').textContent='НОВАЯ СМЕНА';fillDay(null);document.getElementById('deleteDayBtn').classList.add('hidden');wizardStep=1;setWizardStep(1);openModal('dayModal');}
function editDay(id){const d=state.days.find(x=>x.id===id);if(!d)return;document.getElementById('dayModalTitle').textContent='Изменить день';document.getElementById('wizardLabel').textContent='РЕДАКТИРОВАНИЕ';fillDay(d);document.getElementById('deleteDayBtn').classList.remove('hidden');wizardStep=1;setWizardStep(1);openModal('dayModal');}
function openModal(id){document.getElementById(id).classList.remove('hidden');document.body.classList.add('modal-open');}
function closeModal(id){document.getElementById(id).classList.add('hidden');if(!document.querySelector('.modal:not(.hidden)'))document.body.classList.remove('modal-open');}
function saveDay(){const d=formDay();if(!d.date){toast('Укажи дату');setWizardStep(1);return}if(d.extraAdd>0&&!d.extraReason){toast('Укажи причину дополнительной суммы');setWizardStep(4);document.getElementById('dayExtraReason').focus();return}const obj={...d,id:document.getElementById('dayId').value||uid('day'),note:document.getElementById('dayNote').value.trim()};const i=state.days.findIndex(x=>x.id===obj.id);if(i>=0)state.days[i]=obj;else state.days.push(obj);save();closeModal('dayModal');toast('День сохранён');}
function editCar(id){const c=state.cars.find(x=>x.id===id);if(!c)return;document.getElementById('carModalTitle').textContent='Изменить перегон';document.getElementById('carId').value=c.id;document.getElementById('carDate').value=c.date;document.getElementById('carKm').value=c.km;document.getElementById('carAmount').value=c.amount??'';document.getElementById('carNote').value=c.note||'';document.getElementById('deleteCarBtn').classList.remove('hidden');updateCarPreview();openModal('carModal');}
function newCar(){document.getElementById('carModalTitle').textContent='Добавить перегон';document.getElementById('carId').value='';document.getElementById('carDate').value=new Date().toISOString().slice(0,10);document.getElementById('carKm').value='';document.getElementById('carAmount').value='';document.getElementById('carNote').value='';document.getElementById('deleteCarBtn').classList.add('hidden');updateCarPreview();openModal('carModal');}
function updateCarPreview(){const km=n(document.getElementById('carKm').value);const override=document.getElementById('carAmount').value;document.getElementById('carPreview').innerHTML=`За ${km} км: <strong>${money(calcCar(km,override))}</strong>${override!==''?'<div class="muted">Использована указанная фактическая сумма.</div>':''}`;}

// tabs
for(const btn of document.querySelectorAll('.tab'))btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById(btn.dataset.tab).classList.add('active');});
document.getElementById('monthPicker').addEventListener('change',e=>{currentMonth=e.target.value||currentMonth;renderAll()});
document.getElementById('prevMonth').addEventListener('click',()=>{const [y,m]=currentMonth.split('-').map(Number);const d=new Date(y,m-2,1);currentMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderAll()});
document.getElementById('nextMonth').addEventListener('click',()=>{const [y,m]=currentMonth.split('-').map(Number);const d=new Date(y,m,1);currentMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderAll()});
document.getElementById('showAllMonths').addEventListener('change',renderAll);document.getElementById('addDayBtn').addEventListener('click',newDay);document.getElementById('addCarBtn').addEventListener('click',newCar);
document.getElementById('dayDate').addEventListener('input',()=>{updateCalendarRule();updateDayPreview()});document.getElementById('dayTariff').addEventListener('change',()=>{updateCalendarRule();updateDayPreview()});
['dayPoints','dayOrders','dayLots','dayMulti4','dayMulti5','dayMgt','dayExtraAdd','dayExtraReason','dayActual'].forEach(id=>document.getElementById(id).addEventListener('input',updateDayPreview));

// Интерактивные числовые поля: 0 не превращается в 01. При первом вводе ноль автоматически заменяется.
document.querySelectorAll('.number-control input[type=number]').forEach(input=>{
  input.addEventListener('focus',()=>{
    if(input.value==='0'){input.value='';}
  });
  input.addEventListener('blur',()=>{
    if(input.value==='' || Number(input.value)<0){input.value='0';}
    updateDayPreview();
  });
});
document.querySelectorAll('[data-number]').forEach(button=>{
  button.addEventListener('click',()=>{
    const input=document.getElementById(button.dataset.number);
    const delta=n(button.dataset.delta);
    const min=input.min===''?0:n(input.min);
    const step=Math.abs(delta);
    let value=n(input.value);
    if(input.value==='') value=0;
    value=Math.max(min,value+delta);
    input.value=String(value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
  });
});
document.getElementById('wizardNext').addEventListener('click',()=>setWizardStep(wizardStep+1));document.getElementById('wizardBack').addEventListener('click',()=>setWizardStep(wizardStep-1));document.getElementById('dayForm').addEventListener('submit',e=>{e.preventDefault();saveDay()});
document.getElementById('deleteDayBtn').addEventListener('click',()=>{const id=document.getElementById('dayId').value;if(id&&confirm('Удалить этот день?')){state.days=state.days.filter(x=>x.id!==id);save();closeModal('dayModal');toast('День удалён')}});
document.getElementById('carKm').addEventListener('input',updateCarPreview);document.getElementById('carAmount').addEventListener('input',updateCarPreview);document.getElementById('carForm').addEventListener('submit',e=>{e.preventDefault();const amount=document.getElementById('carAmount').value;const obj={id:document.getElementById('carId').value||uid('car'),date:document.getElementById('carDate').value,km:n(document.getElementById('carKm').value),amount:amount===''?null:n(amount),note:document.getElementById('carNote').value.trim()};const i=state.cars.findIndex(x=>x.id===obj.id);if(i>=0)state.cars[i]=obj;else state.cars.push(obj);save();closeModal('carModal');toast('Перегон сохранён')});
document.getElementById('deleteCarBtn').addEventListener('click',()=>{const id=document.getElementById('carId').value;if(id&&confirm('Удалить этот перегон?')){state.cars=state.cars.filter(x=>x.id!==id);save();closeModal('carModal');toast('Перегон удалён')}});
for(const el of document.querySelectorAll('[data-close]'))el.addEventListener('click',()=>closeModal(el.dataset.close));for(const modal of document.querySelectorAll('.modal'))modal.addEventListener('click',e=>{if(e.target===modal)closeModal(modal.id)});
document.getElementById('resetTariffs').addEventListener('click',()=>{if(confirm('Сбросить все тарифы к исходным значениям?')){state.tariffs=clone(DEFAULT_TARIFFS);save();toast('Тарифы сброшены')}});
document.getElementById('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`atlant-zarplata-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
document.getElementById('importFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);state.tariffs=merge(clone(DEFAULT_TARIFFS),x.tariffs||{});state.days=Array.isArray(x.days)?x.days:[];state.days=state.days.map(d=>({...d,mgt:n(d.mgt),extraAdd:d.extraAdd!=null?n(d.extraAdd):n(d.bonus)+n(d.manualAdd),extraReason:d.extraReason||''}));state.cars=Array.isArray(x.cars)?x.cars:[];state.cars=state.cars.map(c=>({...c,amount:c.amount??null}));state.cars=state.cars.map(c=>({...c,amount:c.amount??null}));save();toast('Данные импортированы')}catch(err){alert('Файл повреждён или имеет неверный формат')}};r.readAsText(file);e.target.value=''})
window.editDay=editDay;window.editCar=editCar;
load();seedKnownData();save();renderAll();
