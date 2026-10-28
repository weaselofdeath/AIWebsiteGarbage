// Rebuilds heroes from a save (c2array save[x][y][z]) and prints computed panels.
const fs=require('fs');
const D=require('../compendium.json'), C=require('../calc.js').make(D);
const sv=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).data;
const at=(x,y,z)=>{const c=sv[x]&&sv[x][y]&&sv[x][y][z]; return c===undefined?0:c;};
const num=v=>+v||0, nm=(a,id)=>(a.find(x=>x.id===id)||{}).n||id;
const out=[];
for(let x=1;x<sv.length;x++){
  if(!(num(at(x,0,2))>0 && num(at(x,3,2))>0)) continue;
  const hid=num(at(x,2,2)), cls=num(at(x,6,2));
  if(!hid||!cls) continue;
  const gear={};
  for(let s=1;s<=6;s++){const r=num(at(x,15+s,2)); if(r>0) gear[s]={id:num(at(r,1,9)),tier:num(at(r,3,9)),q:num(at(r,5,9)),lv:num(at(r,6,9)),roll:num(at(r,8,9)),
     affix:[1,2,3,4,5,6].map(k=>[num(at(r,8+k,9)),num(at(r,14+k,9))]).filter(a=>a[0]>0)};}
  const talents=[1,2,3].map(k=>[num(at(x,k,12)),num(at(x,k+20,12))]).filter(t=>t[0]>0);
  const b={hero:hid,cls,level:num(at(x,3,2)),job:num(at(x,cls,4))+(+process.env.JOBADD||0),stage:num(at(x,50,2)),gearTier:num(at(x,50,2))+1,
    elixirs:[13,14,15].map(c=>num(at(x,c,2))/10),skills:[...Array(9)].map((_,k)=>num(at(x,31+k,2))),talents,gear};
  out.push({x,b});
}
const want=process.argv[3]?+process.argv[3]:null;
for(const {x,b} of out){
  if(want&&x!==want) continue;
  const S=C.panel(b);
  console.log(`#${x} ${nm(D.heroes,b.hero)} Lv${b.level} ${nm(D.classes,b.cls)} job${b.job} stage${b.stage}`);
  if(!want) continue;
  console.log(' gear:',Object.entries(b.gear).map(([s,g])=>`${s}:${nm(D.items,g.id)} t${g.tier} q${g.q} +${g.lv} r${g.roll} aff${JSON.stringify(g.affix)}`).join('\n       '));
  console.log(' talents',JSON.stringify(b.talents),'elix',b.elixirs,'skills',b.skills.join(','));
  const show=(process.env.SHOW?process.env.SHOW.split(",").map(Number):null)||[1,2,3,4,5,6,8,9,10,11,12,13,40,41,42,43,44,45,46,47,48,49,50,51,52,28,29,17,18,71,72];
  console.log(show.map(s=>`${nm(D.stats,s)}=${+S.get(s).toFixed(2)}`).join('  '));
}
