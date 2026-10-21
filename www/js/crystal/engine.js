/*! Crystal Sprite Atelier engine v4 - FF5-style 8-direction character sprites.
 * Self-contained, no dependencies: browsers, workers and Node. Integration guide: README.md
 *
 * QUICK START
 *   const S = FF5Sprites;                                 // or require('./crystal-sprite-engine.js')
 *   const sheet = S.generate({job:'Space Marine'}, {seed:42});
 *       // sheet.width/height/data = RGBA pixels; sheet.meta = fps, loop, events, rows per anim x dir
 *   const anim = S.createAnimator({mode:'eight'});        // 'side' for platformers, 'four' for 4-dir RPGs
 *   // every tick:
 *   const s = anim.update(dt, {vx, vy, grounded, airVy, lowHealth});
 *   const r = S.sheetRect(sheet.meta, s.anim, s.dir, s.frame);   // source rect + foot anchor
 *   for (const e of s.events) ...                         // 'footstep' 'takeoff' 'land' 'swing' 'hit' 'fire' 'cast' 'hurt' 'thud' 'done:<anim>'
 *   // verbs: anim.attack() shoot() cast()/stopCast() hurt() ko() revive() jump() emote(name, secs) face(dir)
 *
 * Frames are 40x40, feet anchored at (20, 37). Directions: S SW W NW N NE E SE.
 * Animations (S.animations[k].use explains when to play each one):
 *   idle walk run jump land attack shoot cast flinch knockdown kneel
 *   wave cheer nod shake laugh surprise sad think angry love          (emotes)
 */
(function(root){"use strict";

/* ================= Crystal Sprite Atelier engine =================
   Authored head+torso "cores" per base view (from the template), plus
   limbs synthesised from a small 3D rig, projected per view, depth-sorted,
   and outlined the way the template is: 4-connected ink rings, with joints
   left open where limbs meet the body. */

const FR = {"SW":{"px":[".....#####......","....#LLLLM#.....","...#LLLLLMM#....","...#LLLLMMMM#...","...#LLLMMMMM#...","...#L##MMDMM#...","...#L#W#MLDM#...","...#LPWMMLDM#...","...#LLLMMDM#....","...#LLMMMMM#....","....#MMMML#.....",".....#MMLL#.....","....#DLMMLM#....","...#LLMLLLLM#...","..##LLMLLDMLM#..",".#LL#MDMDM#DM#..",".#LM##LLL#LLM#..","..##.#DDL#LM#...",".....#M#MM##....",".....#L#LM#.....",".....#L#LM#.....","....#LM#LLM#....","....###LMLD#....","......######...."],"rg":[".....#####......","....#hhhhh#.....","...#hhhhhhh#....","...#hhhhhhhh#...","...#eeeeehhh#...","...#e##eeehh#...","...#e#e#eehh#...","...#eeeeehhh#...","...#eeeeehh#....","...#eeeeehh#....","....#eeeee#.....",".....#nnnn#.....","....#tttttt#....","...#aattttta#...","..##aatttttaa#..",".#rr#ttttt#rr#..",".#kk##ppp#kkk#..","..##.#ppp#kk#...",".....#l#ll##....",".....#l#ll#.....",".....#l#ll#.....","....#ff#lll#....","....###ffff#....","......######...."]},"S":{"px":["......#####.....",".....#LLLLL#....","....#LLLLLLM#...","...#LLLLLLLMM#..","...#LLLLLLLMM#..","...#LL##L##LM#..","...#LLPWLPWLM#..","...#LLPWMPWLM#..","...#LLLLLLMMD#..","....#LLLMMMD#...",".....#LMMMD#....","....###DDD###...","...#LLLLLMMMD#..","...#LLLLMLMMD#..","...#LLLLLMMMD#..","....#LLLMMMD#...","....#LLLMMMD#...",".....#LMMMD#....","................","................","................","................","................","................"],"rg":["......#####.....",".....#hhhhh#....","....#hhhhhhh#...","...#hhhhhhhhh#..","...#heeeeeeeh#..","...#he##e##eh#..","...#heeeeeeeh#..","...#eeeeeeeee#..","...#eeeeeeeee#..","....#eeeeeee#...",".....#eeeee#....","....###nnn###...","...#ttttttttt#..","...#ttttttttt#..","...#ttttttttt#..","....#ttttttt#...","....#ppppppp#...",".....#ppppp#....","................","................","................","................","................","................"]},"N":{"px":["......#####.....",".....#LLLLL#....","....#LLLLLLM#...","...#LLLLLLLMM#..","...#LLLLLLLMM#..","...#LLLLLLMMM#..","...#LLLLLLMMM#..","...#LLLLLMMMD#..","...#LLLLMMMMD#..","....#LLLMMMD#...",".....#LMMMD#....","....###LMD###...","...#LLLLDMMMD#..","...#LLLLDMMMD#..","...#LLLLDMMMD#..","....#LLLDMMD#...","....#LLLDMMD#...",".....#LMDMD#....","................","................","................","................","................","................"],"rg":["......#####.....",".....#hhhhh#....","....#hhhhhhh#...","...#hhhhhhhhh#..","...#hhhhhhhhh#..","...#hhhhhhhhh#..","...#hhhhhhhhh#..","...#hhhhhhhhh#..","...#hhhhhhhhh#..","....#hhhhhhh#...",".....#hhhhh#....","....###nnn###...","...#ttttttttt#..","...#ttttttttt#..","...#ttttttttt#..","....#ttttttt#...","....#ppppppp#...",".....#ppppp#....","................","................","................","................","................","................"]},"W":{"px":[".....######.....","....#LLLLLM#....","...#LLLLLLMM#...","..#LLLLLLMMMM#..","..#LLLLLLMMMM#..","..#L##LLMMMDM#..","..#PWLLMMLDMM#..","..#LLLLLMLDMM#..","..#LLLLLMMMMM#..","..#LLLLMMMMD#...","...#LLMMMMD#....","....#DDMMMD#....","...#LLLLMMMD#...","...#LLLLMMMD#...","...#LLLLMMMD#...","...#LLLMMMDD#...","....#LLMMMD#....","....#LLMMMD#....","................","................","................","................","................","................"],"rg":[".....######.....","....#hhhhhh#....","...#hhhhhhhh#...","..#hhhhhhhhhh#..","..#eeehhhhhhh#..","..#e##ehhhhhh#..","..#eeeehhhhhh#..","..#eeeeehhhhh#..","..#eeeeehhhhh#..","..#eeeeehhhh#...","...#eeeeehh#....","....#nnnnnn#....","...#tttttttt#...","...#tttttttt#...","...#tttttttt#...","...#tttttttt#...","....#pppppp#....","....#pppppp#....","................","................","................","................","................","................"]},"NW":{"px":[".....#####......","....#LLLLM#.....","...#LLLLLMM#....","...#LLLLMMMM#...","...#LLLMMMMM#...","...#LLLMMMDM#...","...#LLLMMMDM#...","...#LMDLMMDM#...","...#LLLMMDM#....","...#LLMMMMD#....","....#LMMMD#.....",".....#LMMD#.....","....#LLMMMD#....","...#LLLLMMMM#...","..##LLLDMMMMM#..",".#LL#LDLDM#DM#..",".#LM##MLD#LLM#..","..##.#LDM#LM#...",".....#M#MM##....",".....#L#LM#.....",".....#L#LM#.....","....#LM#LLM#....","....###MMMD#....","......######...."],"rg":[".....#####......","....#hhhhh#.....","...#hhhhhhh#....","...#hhhhhhhh#...","...#hhhhhhhh#...","...#hhhhhhhh#...","...#hhhhhhhh#...","...#hhhhhhhh#...","...#ehhhhhh#....","...#ehhhhhh#....","....#hhhhh#.....",".....#nnnn#.....","....#tttttt#....","...#aattttta#...","..##aatttttaa#..",".#rr#ttttt#rr#..",".#kk##ppp#kkk#..","..##.#ppp#kk#...",".....#l#ll##....",".....#l#ll#.....",".....#l#ll#.....","....#ff#lll#....","....###ffff#....","......######...."]}};
const CW=40, CH=40, N=CW*CH, GROUND=37;
const META={S:{view:'front'},SW:{view:'q'},W:{view:'side'},NW:{view:'bq'},N:{view:'back'}};
const FACE={S:[0,1],SW:[-Math.SQRT1_2,Math.SQRT1_2],W:[-0.866,0.5],NW:[-Math.SQRT1_2,-Math.SQRT1_2],N:[0,-1]};
const CXF={S:8.5,SW:8,W:8,NW:8,N:8.5};
const CORE_SRC={S:'S',SW:'SW',W:'SW',NW:'NW',N:'N'};
const SHX={S:4,SW:4.5,W:4.5,NW:4.5,N:4}, SHY={S:4.5,SW:4,W:4.5,NW:4,N:4.5};
const DIRS=['S','SW','W','NW','N','NE','E','SE'];
const DIRSRC={S:['S',0],SW:['SW',0],W:['W',0],NW:['NW',0],N:['N',0],NE:['NW',1],E:['W',1],SE:['SW',1]};
const DIRNAME={S:'South',SW:'South-west',W:'West',NW:'North-west',N:'North',NE:'North-east',E:'East',SE:'South-east'};

const SKIN={Chrome:['#606878','#9aa4b8','#d0d8e8'],Cerulean:['#284878','#4070b0','#70a8e0'],Template:['#b87840','#d89868','#f0b890'],Fair:['#c08868','#e0b090','#f8d8c0'],Olive:['#987040','#c09868','#e0c090'],
  Bronze:['#885028','#b07848','#d8a070'],Umber:['#583020','#804830','#a86848'],Goblin:['#486838','#689850','#98c070']};
const HAIR={Chestnut:['#583018','#885028','#b07840','#d8a868'],Gold:['#986818','#c89830','#f0c858','#f8f0a0'],Ink:['#181830','#303058','#505088','#8080b8'],
  Crimson:['#681818','#a02828','#d04838','#f08868'],Silver:['#606878','#9098a8','#c0c8d0','#f0f0f8'],Violet:['#402858','#684890','#9070c0','#c0a8e8'],
  Moss:['#284020','#487038','#70a050','#b0d888'],Rose:['#883058','#c05080','#e880a8','#f8c0d8']};
const CLOTH={Navy:['#101838','#202c60','#384890'],Denim:['#203050','#385080','#5878b0'],Khaki:['#605830','#988c58','#c8bc88'],Drab:['#2c3418','#4a5428','#6c7840'],Hazard:['#a03808','#e06010','#f89838'],Neon:['#701860','#c02898','#f060d0'],White:['#b8c0c8','#e0e4ec','#ffffff'],Azure:['#183878','#3060b8','#5890e0'],Scarlet:['#701818','#b03030','#e06048'],Forest:['#1c4c28','#2f7f3c','#58b058'],Plum:['#401858','#703090','#a058c0'],
  Linen:['#a09888','#d0c8b8','#f8f0e0'],Coal:['#202028','#383848','#585870'],Leather:['#503018','#805028','#b07840'],Saffron:['#985010','#d08020','#f8b048'],
  Teal:['#105858','#208888','#48b8b0'],Steel:['#485060','#7880a0','#b0b8d0']};
const STEEL4=['#505870','#8890a8','#c8d0e0','#f8f8ff'];
const GLASS=['#102838','#24607e','#58b8d8','#d0f4ff'], GUNMETAL=['#181820','#383848','#606878','#a0a8b8'], FLASH=['#f88820','#f8d040','#fff8c0','#ffffff'];
const OUTLINES={Ink:'#181818',Umber:'#2a160c',Navy:'#10102c'};

const DEFAULT={skin:'Template',hair:'short',hairColor:'Chestnut',head:'none',headColor:'Scarlet',top:'tee',topColor:'Azure',bot:'pants',botColor:'Leather',
  feet:'boots',feetColor:'Leather',hands:'none',handsColor:'Leather',belt:'on',beltColor:'Leather',weapon:'sword',weaponColor:'Leather',trimColor:'White',
  outline:'Ink',selout:'on',shadow:'auto',job:'Freelancer'};
let cfg=Object.assign({},DEFAULT);
let seed=1337;

const I=(x,y)=>y*CW+x, X=i=>i%CW, Y=i=>(i/CW)|0;
const inb=(x,y)=>x>=0&&y>=0&&x<CW&&y<CH;
const N4=[[1,0],[-1,0],[0,1],[0,-1]], N8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function nb(i,set){const x=X(i),y=Y(i),o=[];for(const[dx,dy]of set){const a=x+dx,b=y+dy;if(inb(a,b))o.push(I(a,b));}return o;}
function hash(x,y,s){let h=(x*374761393+y*668265263+s*2246822519)>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return (h^(h>>>16))>>>0;}
function rngFrom(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hex2rgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function rgb2hex(r,g,b){return'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function mix(a,b,t){const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}

/* ---------------- cores: the template's head and torso, dressed ---------------- */
function buildRaw(frameKey){
  const CW=24,CH=32,N=CW*CH,OX=4,OY=6;
  const I=(x,y)=>y*CW+x, X=i=>i%CW, Y=i=>(i/CW)|0, inb=(x,y)=>x>=0&&y>=0&&x<CW&&y<CH;
  const nb=(i,set)=>{const x=X(i),y=Y(i),o=[];for(const[dx,dy]of set){const a=x+dx,b=y+dy;if(inb(a,b))o.push(I(a,b));}return o;};
  const f=FR[frameKey], view=META[frameKey].view, back=(view==='back'||view==='bq');
  const mat=new Array(N).fill(''), tone=new Int8Array(N), reg=new Array(N).fill('');
  for(let y=0;y<24;y++)for(let x=0;x<16;x++){
    const c=f.px[y][x], r=f.rg[y][x]; if(c==='.')continue; const i=I(x+OX,y+OY);
    if(c==='#'){mat[i]='line';reg[i]='#';}
    else if(c==='W'){mat[i]='eyeW';reg[i]='e';}
    else if(c==='P'){mat[i]='eyeP';reg[i]='e';}
    else{mat[i]='skin';tone[i]={D:0,M:1,L:2}[c];reg[i]=r;}
  }
  const fy=i=>Y(i)-OY;
  const rowsOf=r=>{const s=new Set();for(let i=0;i<N;i++)if(reg[i]===r)s.add(Y(i));return[...s].sort((a,b)=>a-b);};
  const pRows=rowsOf('p');
  const coverable=i=>mat[i]&&mat[i]!=='line'&&!mat[i].startsWith('eye');
  const cover=(pred,m)=>{for(let i=0;i<N;i++)if(coverable(i)&&pred(reg[i],Y(i)))mat[i]=m;};
  const T=cfg.top;
  if(cfg.bot==='pants'||cfg.bot==='shorts')cover(r=>r==='p','bot');
  if(T==='vest'||T==='tee'||T==='longsleeve')cover(r=>r==='t','top');
  if(T==='tunic'||T==='robe'||T==='coat')cover(r=>r==='t'||r==='p','top');
  if(T==='jacket'||T==='suit'||T==='armor')cover(r=>r==='t','top');
  const smooth=new Int8Array(tone);
  for(let i=0;i<N;i++){const m=mat[i];if(!(m==='top'||m==='bot'))continue;
    let s=0,n=0;for(const j of nb(i,N8).concat([i])){if(mat[j]===m){s+=tone[j];n++;}} smooth[i]=Math.round(s/n);}
  for(let i=0;i<N;i++)if(mat[i]==='top'||mat[i]==='bot')tone[i]=smooth[i];
  // open fronts (jacket, coat) and ties (suit) show the trim colour down the chest; armour gets a gleam
  if((T==='jacket'||T==='coat'||T==='suit')&&!back){
    for(let y=0;y<CH;y++){const xs=[];for(let x=0;x<CW;x++){const i=I(x,y);if(mat[i]==='top'&&(reg[i]==='t'||(T==='coat'&&reg[i]==='p')))xs.push(x);}
      if(xs.length<3)continue; if(T==='suit'&&fy(I(0,y))>14)continue;
      const cx0=view==='front'?xs[Math.floor(xs.length/2)]:xs[Math.floor(xs.length*0.35)];
      mat[I(cx0,y)]='trim';tone[I(cx0,y)]=T==='suit'?1:2;}
  }
  if(T==='armor'){const ys=[...new Set(Array.from({length:N},(_,i)=>i).filter(i=>mat[i]==='top').map(Y))].sort((a,b)=>a-b);
    for(let i=0;i<N;i++)if(mat[i]==='top'&&Y(i)===ys[0])tone[i]=Math.min(3,tone[i]+1);
    for(let i=0;i<N;i++)if(mat[i]==='top'&&Y(i)===ys[1]&&tone[i]>=2)tone[i]=3;}
  if(cfg.belt==='on'&&pRows.length&&(cfg.bot!=='none'||T==='tunic'||T==='robe'||T==='coat')){
    const by=pRows[0]; const cells=[];
    for(let x=0;x<CW;x++){const i=I(x,by);if(reg[i]==='p'&&(mat[i]==='bot'||mat[i]==='top'))cells.push(i);}
    for(const i of cells)mat[i]='belt';
    if(cells.length&&(view==='front'||view==='q')){const xs=cells.map(X).sort((a,b)=>a-b);const bx=view==='front'?xs[Math.floor(xs.length/2)]:xs[Math.max(0,Math.floor(xs.length/2)-1)];mat[I(bx,by)]='buckle';}
  }
  const headIdx=[];for(let i=0;i<N;i++)if((reg[i]==='h'||reg[i]==='e')&&mat[i]!=='line')headIdx.push(i);
  let hx0=99,hx1=-1,hy0=99,hy1=-1;for(const i of headIdx){hx0=Math.min(hx0,X(i));hx1=Math.max(hx1,X(i));hy0=Math.min(hy0,Y(i));hy1=Math.max(hy1,Y(i));}
  const cx=Math.round((hx0+hx1)/2);
  const isOuter=i=>nb(i,N8).some(j=>!mat[j]);
  const hair=new Set(), hatSet=new Set();
  const st=cfg.hair;
  let P=null;
  if(st==='short'||st==='ponytail')P={hD:back?8:7,eD:4,vol:6};
  if(st==='spiky')P={hD:back?8:7,eD:4,vol:6,spikes:1};
  if(st==='bob')P={hD:10,eD:4,edge:9,vol:9};
  if(st==='long')P={hD:10,eD:4,edge:8,vol:10,fall:15};
  if(cfg.head==='hood'&&P&&st!=='long')P=null;
  if(P){
    for(const i of headIdx){if(mat[i]!=='skin')continue;const r=reg[i],y=fy(i);
      if(r==='h'&&y<=P.hD)hair.add(i); if(r==='e'&&y<=P.eD)hair.add(i);}
    if(P.edge&&view!=='side'){
      for(let y=OY;y<=OY+P.edge;y++){const row=[];for(let x=0;x<CW;x++){const i=I(x,y);if(reg[i]==='e'&&mat[i]!=='line')row.push(i);}
        if(!row.length)continue; const L=row[0],R=row[row.length-1];
        if(mat[L]==='skin'&&view==='front')hair.add(L); if(mat[R]==='skin')hair.add(R);}
    }
    const add=[];
    for(let i=0;i<N;i++){if(mat[i]!=='line'||fy(i)>P.vol||!isOuter(i))continue;
      if(nb(i,N4).some(j=>hair.has(j))&&nb(i,N8).some(j=>reg[j]==='h'||reg[j]==='e'))add.push(i);}
    add.forEach(i=>hair.add(i));
    if(P.fall){
      for(let y=hy1;y<=OY+P.fall;y++){const shrink=y>OY+13?1:0;
        for(let x=hx0-1+shrink;x<=hx1+1-shrink;x++){if(!inb(x,y))continue;const i=I(x,y);if(hair.has(i))continue;
          if(back){ if(mat[i]&&mat[i].startsWith('eye'))continue; hair.add(i);}
          else if(view==='side'){ if(x>=cx||!mat[i])hair.add(i);}
          else if(!mat[i])hair.add(i);}}
    }
    if(P.spikes){
      let minX=99,maxX=-1;hair.forEach(i=>{minX=Math.min(minX,X(i));maxX=Math.max(maxX,X(i));});
      const top={};hair.forEach(i=>{const x=X(i);top[x]=Math.min(top[x]??99,Y(i));});
      const lean=view==='front'?0:1;
      for(let x=minX+1;x<=maxX;x++){if(((x+seed)%3)!==0||top[x]==null)continue;
        const t=top[x];hair.add(I(x,t-1)); if(inb(x-lean,t-2))hair.add(I(x-lean,t-2));}
      hair.forEach(i=>{if(reg[i]==='e'&&fy(i)===P.eD&&((X(i)+seed)%2===0))hair.delete(i);});
      if(view!=='front'){let y=OY+5;let rx=-1;for(let x=CW-1;x>=0;x--){if(hair.has(I(x,y))){rx=x;break;}} if(rx>0&&inb(rx+1,y+1)){hair.add(I(rx+1,y));hair.add(I(rx+1,y+1));}}
    }
  }
  if(st==='ponytail'){
    const path=[[1,4],[2,5],[2,6],[2,7],[2,8],[2,9],[1,10],[1,11],[2,12]];
    if(view==='back'){for(let k=0;k<7;k++){const y=OY+8+k;[cx-1,cx].forEach(x=>{const i=I(x,y);if(!(mat[i]||'').startsWith('eye'))hair.add(i);});}}
    else if(view!=='front'){for(const[dx,dy]of path){const x=hx1+dx,y=OY+dy;if(!inb(x,y))continue;
      for(const xx of [x,x-1]){const i=I(xx,y);if(view==='q'&&mat[i]&&!hair.has(i)&&mat[i]!=='line')continue; if(!(mat[i]||'').startsWith('eye'))hair.add(i);}}}
  }
  if(st==='topknot'){
    const ty=hy0-1; for(const[dx,dy]of[[-1,-2],[0,-2],[1,-2],[-1,-1],[0,-1],[1,-1],[0,-3]]){const x=cx+dx,y=ty+dy;if(inb(x,y))hair.add(I(x,y));}
  }
  const head=cfg.head;
  if(head==='bandana'){
    for(let i=0;i<N;i++){const y=fy(i);if((y===2||y===3)&&(hair.has(i)||((reg[i]==='h'||reg[i]==='e')&&mat[i]==='skin')||(mat[i]==='line'&&isOuter(i)&&nb(i,N8).some(j=>reg[j]==='h'||reg[j]==='e'))))hatSet.add(i);}
    const knot=view==='back'?[[0,4],[-1,5],[1,5],[-1,6],[1,7]]:view==='front'?[]:[[1,3],[2,4],[2,5],[3,6]];
    for(const[dx,dy]of knot){const x=(view==='back'?cx:hx1)+dx,y=OY+dy;if(inb(x,y)){const i=I(x,y);if(view==='q'&&mat[i]&&mat[i]!=='line'&&!hair.has(i))continue;hatSet.add(i);}}
  }
  if(head==='hood'){
    for(const i of headIdx){if(mat[i]!=='skin')continue;const r=reg[i],y=fy(i);if(r==='h'||(r==='e'&&y<=3))hatSet.add(i);}
    if(view!=='side'){for(let y=OY;y<=OY+10;y++){const row=[];for(let x=0;x<CW;x++){const i=I(x,y);if(reg[i]==='e'&&mat[i]==='skin')row.push(i);}
      if(!row.length)continue;if(view==='front')hatSet.add(row[0]);hatSet.add(row[row.length-1]);}}
    for(let i=0;i<N;i++){if(mat[i]==='line'&&fy(i)<=11&&isOuter(i)&&nb(i,N8).some(j=>reg[j]==='h'||reg[j]==='e'||reg[j]==='n'))hatSet.add(i);}
    for(let i=0;i<N;i++){if(reg[i]==='n'||(reg[i]==='t'&&fy(i)===12))hatSet.add(i);}
    hatSet.forEach(i=>hair.delete(i));
  }
  if(head==='helm'){
    for(const i of headIdx){if(mat[i]!=='skin')continue;const r=reg[i],y=fy(i);if((r==='h'&&y<=(back?9:7))||(r==='e'&&y<=4))hatSet.add(i);}
    if(view!=='side'&&!back){for(let y=OY;y<=OY+8;y++){const row=[];for(let x=0;x<CW;x++){const i=I(x,y);if(reg[i]==='e'&&mat[i]==='skin')row.push(i);}
      if(!row.length)continue;if(view==='front')hatSet.add(row[0]);hatSet.add(row[row.length-1]);}}
    for(let i=0;i<N;i++){if(mat[i]==='line'&&fy(i)<=7&&isOuter(i)&&nb(i,N4).some(j=>hatSet.has(j))&&nb(i,N8).some(j=>reg[j]==='h'||reg[j]==='e'))hatSet.add(i);}
    const ridgeX=view==='side'?cx+1:cx; for(let y=hy0-2;y<=hy0-1;y++)hatSet.add(I(ridgeX,y));
    hatSet.forEach(i=>hair.delete(i));
  }
  if(head==='wizard'){
    const brimY=OY+3;
    for(let i=0;i<N;i++){const y=Y(i),x=X(i);if(y<brimY&&x>=hx0-2&&x<=hx1+2&&(mat[i]==='line'||mat[i]==='skin'||hair.has(i))){mat[i]='';reg[i]='';hair.delete(i);}}
    const bx0=hx0-(view==='side'?3:2), bx1=hx1+2;
    for(let x=bx0;x<=bx1;x++){if(inb(x,brimY)){const i=I(x,brimY);hatSet.add(i);hair.delete(i);}}
    const W0=hx1-hx0+1; const widths=[W0,W0,W0-2,W0-2,W0-4,W0-4,1,1]; const bend=[0,0,0,0,0,1,2,3];
    widths.forEach((w,k)=>{const y=brimY-1-k;const sx=cx-Math.floor(w/2)+bend[k]*(view==='front'?0:1)+(view==='front'&&k>=6?(k-5):0);
      for(let x=sx;x<sx+Math.max(1,w);x++)if(inb(x,y))hatSet.add(I(x,y));});
  }
  const trimSet=new Set(), glassSet=new Set();
  const headOutline=i=>mat[i]==='line'&&isOuter(i)&&nb(i,N8).some(j=>reg[j]==='h'||reg[j]==='e');
  if(head==='cap'||head==='hardhat'){
    // a dome over the crown, plus a brim that juts toward the face
    const dome=head==='hardhat'?4:3;
    for(const i of headIdx)if(mat[i]==='skin'&&fy(i)<=dome)hatSet.add(i);
    hair.forEach(i=>{if(fy(i)<=dome)hatSet.add(i);});
    for(let i=0;i<N;i++)if(headOutline(i)&&fy(i)<=dome)hatSet.add(i);
    if(head==='hardhat'){for(let x=hx0+1;x<=hx1-1;x++)hatSet.add(I(x,hy0-2));}
    const by=OY+dome+1;
    if(view==='front'){for(let x=hx0-(head==='hardhat'?1:0);x<=hx1+(head==='hardhat'?1:0);x++)if(inb(x,by)){const i=I(x,by);if(!(mat[i]||'').startsWith('eye'))hatSet.add(i);}}
    else if(!back){for(let x=hx0-2;x<=(head==='hardhat'?hx1+1:cx);x++)if(inb(x,by)){const i=I(x,by);if(!(mat[i]||'').startsWith('eye'))hatSet.add(i);}}
    else if(head==='hardhat'){for(let x=hx0-1;x<=hx1+1;x++)if(inb(x,by))hatSet.add(I(x,by));}
    hatSet.forEach(i=>hair.delete(i));
  }
  if(head==='fedora'){
    // crown with a pinched top, a band in the trim colour, a wide brim
    const brimY=OY+3;
    for(let i=0;i<N;i++){const y=Y(i),x=X(i);if(y<brimY&&x>=hx0-2&&x<=hx1+2&&(mat[i]==='line'||mat[i]==='skin'||hair.has(i))){mat[i]='';reg[i]='';hair.delete(i);}}
    for(let x=hx0-2;x<=hx1+2;x++)if(inb(x,brimY)){hatSet.add(I(x,brimY));hair.delete(I(x,brimY));}
    const W0=hx1-hx0+1;[[W0-1,1],[W0-1,0],[W0-3,0]].forEach(([w,band],k)=>{const y=brimY-1-k;const sx=cx-Math.floor(w/2);
      for(let x=sx;x<sx+w;x++){if(!inb(x,y))continue;if(k===2&&x===cx)continue;(band?trimSet:hatSet).add(I(x,y));}});
  }
  if(head==='spacehelm'){
    // a dome one pixel larger than the head all round, with a glass visor over the face
    for(const i of headIdx)hatSet.add(i);hair.forEach(i=>hatSet.add(i));
    for(let i=0;i<N;i++)if(headOutline(i)||(mat[i]==='line'&&nb(i,N8).some(j=>hair.has(j))))hatSet.add(i);
    const ring=[];hatSet.forEach(i=>{for(const j of nb(i,N4))if(!mat[j]&&!hatSet.has(j)&&fy(j)<=8&&fy(j)>=0)ring.push(j);});ring.forEach(j=>hatSet.add(j));
    for(let i=0;i<N;i++)if(reg[i]==='n')hatSet.add(i);
    if(!back){hatSet.forEach(i=>{if(reg[i]==='e'&&fy(i)>=3&&fy(i)<=8)glassSet.add(i);});
      if(view==='q')hatSet.forEach(i=>{const x=X(i);if(fy(i)>=3&&fy(i)<=8&&x<=hx0)glassSet.add(i);});}
    glassSet.forEach(i=>hatSet.delete(i));
    hair.clear();
  }
  if(head==='visor'){
    // wraparound shades on the eye line, strap round the back
    const eyeRows=new Set();for(let i=0;i<N;i++)if(mat[i]==='eyeW'||mat[i]==='eyeP')eyeRows.add(Y(i));
    const rows=eyeRows.size?[...eyeRows]:[OY+5,OY+6];
    for(let i=0;i<N;i++){if(!rows.includes(Y(i)))continue;const m=mat[i];
      if(m==='eyeW'||m==='eyeP'||(reg[i]==='e'&&m==='skin')||(m==='line'&&nb(i,N8).some(j=>reg[j]==='e')&&!isOuter(i)))glassSet.add(i);
      else if((reg[i]==='h'&&m==='skin')||hair.has(i))hatSet.add(i);}
    if(back)glassSet.forEach(i=>{hatSet.add(i);});
    if(back)glassSet.clear();
    glassSet.forEach(i=>hair.delete(i));
  }
  hair.forEach(i=>{if(!(mat[i]||'').startsWith('eye')){mat[i]='hair';reg[i]=reg[i]||'x';}});
  hatSet.forEach(i=>{mat[i]='hat';reg[i]=reg[i]||'x';});
  trimSet.forEach(i=>{mat[i]='trim';tone[i]=1;reg[i]=reg[i]||'x';hatSet.add(i);});
  glassSet.forEach(i=>{mat[i]='glass';reg[i]=reg[i]||'e';});
  { // glass shading: a diagonal glint across the upper left
    let gx0=99,gy0=99;glassSet.forEach(i=>{gx0=Math.min(gx0,X(i));gy0=Math.min(gy0,Y(i));});
    glassSet.forEach(i=>{const d=(X(i)-gx0)+(Y(i)-gy0)*1.5;tone[i]=d<1.5?3:d<4?2:d<7?1:0;if((X(i)-gx0)===(Y(i)-gy0)+2)tone[i]=3;});}
  const added=new Set([...hair,...hatSet,...glassSet]);
  added.forEach(i=>{for(const j of nb(i,N8)){if(!mat[j]){mat[j]='line';reg[j]='#';}}});
  added.forEach(i=>{for(const j of nb(i,N4)){if(added.has(j))continue;const m=mat[j];
      if(m&&m!=='line'&&!m.startsWith('eye')&&!['h','e'].includes(reg[j])&&Y(j)>Y(i)){if(m==='skin'){mat[j]='line';reg[j]='#';}else tone[j]=0;}}});
  for(let pass=0;pass<2;pass++)for(let i=0;i<N;i++){if(mat[i]!=='line')continue;const n4=nb(i,N4);
    if(!nb(i,N8).some(j=>!mat[j])&&n4.every(j=>added.has(j))){const host=mat[n4[0]];mat[i]=host;added.add(i);host==='hair'?hair.add(i):hatSet.add(i);}}
  const shadowFace=cfg.head==='wizard'&&(cfg.shadow!=='off')||cfg.shadow==='on';
  for(let i=0;i<N;i++){if(mat[i]==='skin'&&(reg[i]==='e'||reg[i]==='h')){const up=i-CW;if(up>=0&&added.has(up))tone[i]=0;}}
  if(shadowFace&&!back){for(let i=0;i<N;i++){if((reg[i]==='e'||reg[i]==='h')&&fy(i)<=11){
      if(mat[i]==='skin')mat[i]='void'; else if(mat[i]==='eyeW'||mat[i]==='eyeP')mat[i]='glow';
      else if(mat[i]==='line'&&!isOuter(i))mat[i]='void';}}}
  const shadeMass=(set,m)=>{
    if(!set.size)return; let x0=99,x1=-1,y0=99,y1=-1;
    set.forEach(i=>{x0=Math.min(x0,X(i));x1=Math.max(x1,X(i));y0=Math.min(y0,Y(i));y1=Math.max(y1,Y(i));});
    const w=Math.max(1,x1-x0),h=Math.max(1,Math.min(10,y1-y0));
    set.forEach(i=>{if(mat[i]!==m)return;const x=X(i),y=Y(i);
      let s=1.12-0.62*(x-x0)/w-0.62*Math.min(1,(y-y0)/h);
      const below=i+CW; if(below<N&&!set.has(below))s-=0.28;
      const above=i-CW; if(above>=0&&!set.has(above)&&(x-x0)/w<0.6)s+=0.22;
      const hv=hash(x,y,seed)%11; if(m==='hair'){if(hv===0||hv===5)s-=0.2; if(hv===3)s+=0.14;}
      tone[i]=s>0.9?3:s>0.58?2:s>0.28?1:0;});
  };
  shadeMass(hair,'hair'); shadeMass(hatSet,'hat');
  const kind=new Array(N).fill('');
  for(let i=0;i<N;i++){if(mat[i]!=='line')continue;
    if(isOuter(i))kind[i]='outer';
    else if(nb(i,N8).some(j=>reg[j]==='e'||mat[j]==='eyeW'||mat[j]==='eyeP'))kind[i]='feature';
    else kind[i]='inner';}
  // strip limbs and the outer ink: what remains is the dressed head + torso
  const LIMB=new Set(['a','r','k','l','f']);
  const cells=[];
  for(let i=0;i<N;i++){const m=mat[i];if(!m)continue;const x=X(i)-OX,y=Y(i)-OY;
    const hairNb=nb(i,N4).some(j=>mat[j]==='hair'||mat[j]==='hat');
    if(m==='line'){
      if(kind[i]==='feature')cells.push({x,y,m,t:0,auth:1,head:1});
      else if(kind[i]==='inner'&&hairNb&&!nb(i,N4).some(j=>LIMB.has(reg[j])&&mat[j]!=='hair'&&mat[j]!=='hat'))cells.push({x,y,m,t:0,auth:1,head:0});
      continue;}
    if(LIMB.has(reg[i])&&m!=='hair'&&m!=='hat')continue;
    const isHead=(reg[i]==='h'||reg[i]==='e'||m==='hair'||m==='hat'||m==='void'||m==='glow'||m.startsWith('eye'))&&!(m==='hair'&&y>11&&view!=='back');
    cells.push({x,y,m,t:tone[i],auth:0,head:isHead||y<=10?1:0});
  }
  // in profile the arm sits inside the torso: close that hole with torso cloth/skin
  const kept=new Map();cells.forEach(c=>{if(c.m!=='line')kept.set(c.x+','+c.y,c);});
  for(let i=0;i<N;i++){const x=X(i)-OX,y=Y(i)-OY;if(y<11||y>18||kept.has(x+','+y))continue;
    const limbish=LIMB.has(reg[i])||(mat[i]==='line'&&nb(i,N4).some(j=>['a','r','k'].includes(reg[j])));
    if(!limbish||!mat[i])continue;
    let L=null,R=null;for(let d=1;d<=4;d++){if(!L&&kept.has((x-d)+','+y))L=kept.get((x-d)+','+y);if(!R&&kept.has((x+d)+','+y))R=kept.get((x+d)+','+y);}
    if(L&&R){const src=L.m==='skin'||L.m==='top'||L.m==='bot'||L.m==='belt'?L:R;const c={x,y,m:src.m==='hair'?'skin':src.m,t:1,auth:0,head:0};cells.push(c);kept.set(x+','+y,c);}
  }
  // secondary-motion weight: loose hair below the skull swings, the skull doesn't
  let sx0=99,sx1=-1;cells.forEach(c=>{if(c.m==='skin'&&c.head&&c.y<=8){sx0=Math.min(sx0,c.x);sx1=Math.max(sx1,c.x);}});
  cells.forEach(c=>{c.w=0;c.wl=0;if(c.m!=='hair')return;
    const below=(c.y-6)/7, out=c.x>sx1?(c.x-sx1)/3:c.x<sx0?(sx0-c.x)/3:0;
    const w=Math.max(below,out);if(c.y>=8||out>0)c.w=Math.max(0,Math.min(1,w));
    if(c.y>=9)c.wl=Math.max(0,Math.min(1,(c.y-8)/6));});
  let top=99;cells.forEach(c=>{if(c.head)top=Math.min(top,c.y);});
  const hc=cells.filter(c=>c.head&&c.m!=='line');let hx=0;hc.forEach(c=>hx+=c.x);
  return{cells,view,headTop:top,headCX:hc.length?hx/hc.length:8};
}
let coreCache={};
function coreFor(base){return coreCache[base]||(coreCache[base]=buildRaw(base));}

/* ---------------- poses ---------------- */
const rad=d=>d*Math.PI/180;
const REST={lean:0,drop:0,air:0,head:[0,0,0],aP:{sw:0,ab:22,el:12},aN:{sw:0,ab:22,el:12},lP:{sw:0,kn:0,ab:3},lN:{sw:0,kn:0,ab:3},wpn:null,eyes:'open',lie:0,trail:0,lift:0};
function pose(o){const p=JSON.parse(JSON.stringify(REST));for(const k in o){if(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])&&p[k])Object.assign(p[k],o[k]);else p[k]=o[k];}return p;}
function walkPose(k,n,amp){const ph=2*Math.PI*k/n+Math.PI/2;const s=Math.sin(ph),c=Math.cos(ph),c2=Math.cos(ph+Math.PI);
  const air=(amp.air&&Math.abs(s)<0.6)?amp.air:0;
  return pose({lean:amp.lean||0,aP:{sw:-amp.arm*s,ab:12,el:amp.el},aN:{sw:amp.arm*s,ab:12,el:amp.el},
    lP:{sw:amp.leg*s,kn:amp.kn0+amp.kn*Math.max(0,c),ab:2},lN:{sw:-amp.leg*s,kn:amp.kn0+amp.kn*Math.max(0,c2),ab:2},air,
    trail:amp.trail*(0.8+0.2*Math.abs(s)), lift:air?amp.lift:-amp.lift*0.4});}
const STANCE={lP:{sw:-14,kn:6,ab:4},lN:{sw:18,kn:10,ab:4}};
const ANIMS={
  idle:{name:'Idle',fps:4,loop:true,n:4,f:k=>pose({aP:{ab:k>=2?27:22,el:k>=2?20:12},aN:{ab:k>=2?27:22,el:k>=2?20:12},lift:k===2?0.3:0})},
  walk:{name:'Walk',fps:10,loop:true,n:6,f:k=>walkPose(k,6,{leg:24,kn0:4,kn:34,arm:22,el:16,trail:0.35,lift:0.3})},
  run:{name:'Run',fps:13,loop:true,n:6,f:k=>walkPose(k,6,{leg:40,kn0:14,kn:72,arm:42,el:85,lean:12,air:1,trail:1,lift:0.6})},
  jump:{name:'Jump',fps:10,loop:false,n:5,frames:['crouch','rise','apex','fall','land'],f:k=>[
    pose({lean:16,aP:{sw:-35,ab:18,el:25},aN:{sw:-35,ab:18,el:25},lP:{sw:40,kn:80},lN:{sw:40,kn:80},lift:0.5}),
    pose({lean:-4,air:4,aP:{sw:35,ab:150,el:10},aN:{sw:35,ab:150,el:10},lP:{sw:-6,kn:6},lN:{sw:4,kn:16},lift:-0.8,trail:0.3}),
    pose({air:6,aP:{sw:20,ab:80,el:30},aN:{sw:20,ab:80,el:30},lP:{sw:55,kn:85},lN:{sw:30,kn:95},lift:0.5,trail:0.2}),
    pose({air:3,lean:-4,aP:{sw:0,ab:110,el:20},aN:{sw:0,ab:110,el:20},lP:{sw:20,kn:15},lN:{sw:-8,kn:30},lift:1.2,trail:0.2}),
    pose({lean:12,aP:{sw:-15,ab:35,el:20},aN:{sw:-15,ab:35,el:20},lP:{sw:32,kn:62},lN:{sw:32,kn:62},lift:-0.4})][k]},
  land:{name:'Land',fps:12,loop:false,n:3,frames:['impact','absorb','recover'],f:k=>[
    pose({lean:18,drop:1,aP:{sw:-20,ab:48,el:25},aN:{sw:-20,ab:48,el:25},lP:{sw:52,kn:104,ab:7},lN:{sw:48,kn:98,ab:9},lift:-1,trail:0.2}),
    pose({lean:10,aP:{sw:-10,ab:34,el:20},aN:{sw:-10,ab:34,el:20},lP:{sw:30,kn:60,ab:5},lN:{sw:28,kn:56,ab:6},lift:-0.4}),
    pose({lean:3,aP:{ab:25,el:14},aN:{ab:25,el:14},lP:{sw:8,kn:16},lN:{sw:8,kn:16},lift:0.25})][k]},
  shoot:{name:'Shoot',fps:14,loop:false,n:4,frames:['aim','fire','recoil','settle'],f:k=>[
    pose(Object.assign({lean:2,aP:{sw:82,ab:8,el:0},aN:{sw:66,ab:22,el:40},wpn:[0,0.04,1]},STANCE)),
    pose(Object.assign({lean:-3,flash:1,aP:{sw:88,ab:8,el:0},aN:{sw:66,ab:22,el:40},wpn:[0,0.12,1],trail:-0.25},STANCE)),
    pose(Object.assign({lean:-2,aP:{sw:96,ab:8,el:10},aN:{sw:60,ab:22,el:40},wpn:[0,0.28,1]},STANCE)),
    pose(Object.assign({lean:1,aP:{sw:84,ab:8,el:2},aN:{sw:64,ab:22,el:40},wpn:[0,0.08,1]},STANCE))][k]},
  attack:{name:'Attack',fps:12,loop:false,n:5,frames:['wind-up','raise','strike','follow','recover'],f:k=>[
    pose(Object.assign({lean:-6,aP:{sw:205,ab:18,el:35},aN:{sw:30,ab:20,el:40},wpn:[0,0.5,-1],trail:-0.3},STANCE)),
    pose(Object.assign({lean:0,aP:{sw:140,ab:15,el:10},aN:{sw:15,ab:22,el:30},wpn:[0,1,0.35]},STANCE)),
    pose(Object.assign({lean:12,aP:{sw:78,ab:12,el:0},aN:{sw:-15,ab:25,el:20},wpn:[0,0.15,1],trail:0.8},STANCE,{lN:{sw:26,kn:20,ab:4}})),
    pose(Object.assign({lean:16,aP:{sw:28,ab:30,el:0},aN:{sw:-25,ab:25,el:20},wpn:[0.35,-0.75,0.55],trail:0.6,lift:0.3},STANCE,{lN:{sw:28,kn:24,ab:4}})),
    pose(Object.assign({lean:5,aP:{sw:12,ab:26,el:25},aN:{sw:0,ab:24,el:20},trail:0.2},STANCE))][k]},
  cast:{name:'Cast',fps:7,loop:true,n:4,f:k=>[
    pose({aP:{sw:70,ab:10,el:45},aN:{sw:70,ab:10,el:45},lean:3}),
    pose({aP:{sw:45,ab:125,el:10},aN:{sw:45,ab:125,el:10},lean:-5,lift:0.4}),
    pose({aP:{sw:40,ab:145,el:5},aN:{sw:40,ab:145,el:5},lean:-6,eyes:'closed',lift:0.8}),
    pose({aP:{sw:45,ab:125,el:10},aN:{sw:45,ab:125,el:10},lean:-5,lift:0.4})][k]},
  flinch:{name:'Flinch',fps:10,loop:false,n:3,f:k=>[
    pose({lean:-20,head:[0,0.3,-1],eyes:'closed',aP:{sw:-35,ab:50,el:45},aN:{sw:-35,ab:50,el:45},lP:{sw:-14,kn:8},lN:{sw:14,kn:12},trail:-0.7,lift:0.4}),
    pose({lean:-12,eyes:'closed',aP:{sw:-20,ab:40,el:35},aN:{sw:-20,ab:40,el:35},lP:{sw:-10,kn:6},lN:{sw:10,kn:10},trail:-0.3}),
    pose({lean:-4,aP:{ab:26},aN:{ab:26},trail:0.2})][k]},
  knockdown:{name:'Knockdown',fps:7,loop:false,n:6,frames:['hit','stagger','buckle','slump','collapse','prone'],f:k=>[
    pose({lean:-20,head:[0,0.3,-1],eyes:'closed',aP:{sw:-35,ab:50,el:45},aN:{sw:-35,ab:50,el:45},lP:{sw:-14,kn:8},lN:{sw:14,kn:12},trail:-0.7,lift:0.4}),
    pose({lean:-26,eyes:'closed',aP:{sw:-25,ab:75,el:30},aN:{sw:-25,ab:75,el:30},lP:{sw:22,kn:6},lN:{sw:-30,kn:18},trail:-1,lift:0.6}),
    pose({lean:20,head:[0,-0.6,0.8],eyes:'closed',aP:{sw:15,ab:15,el:10},aN:{sw:15,ab:15,el:10},lP:{sw:55,kn:115},lN:{sw:55,kn:115},lift:-0.6}),
    pose({lean:38,head:[0,-1,1],eyes:'closed',aP:{sw:55,ab:12,el:5},aN:{sw:55,ab:12,el:5},lP:{sw:80,kn:150},lN:{sw:80,kn:150},trail:0.3}),
    pose({prone:1,armAb:105,legAb:6}),
    pose({prone:1,armAb:150,legAb:3})][k]},
  kneel:{name:'Kneel',fps:3,loop:true,n:2,f:k=>pose({lean:22,head:[0,-0.6,0.6],drop:k,aP:{sw:30,ab:14,el:30},aN:{sw:10,ab:16,el:20},lP:{sw:85,kn:160,ab:4},lN:{sw:70,kn:85,ab:6},lift:-0.3*k})},
  wave:{name:'Wave',fps:5,loop:true,n:2,emote:1,f:k=>pose({aP:{sw:25,ab:k?150:115,el:0,eab:k?205:145},head:[k?1:0,0,0],lean:k?-3:0})},
  cheer:{name:'Cheer',fps:6,loop:true,n:2,emote:1,f:k=>pose({air:k?2:0,eyes:k?'closed':'open',aP:{sw:15,ab:160,el:0,eab:172},aN:{sw:15,ab:160,el:0,eab:172},lP:{sw:k?10:0,kn:k?25:0},lN:{sw:k?10:0,kn:k?25:0},lift:k?0.9:-0.3})},
  nod:{name:'Nod',fps:4,loop:true,n:2,emote:1,f:k=>pose({head:k?[0,-1,0.8]:[0,0,0],eyes:k?'closed':'open',lift:k?-0.3:0})},
  shake:{name:'Shake head',fps:6,loop:true,n:2,emote:1,f:k=>pose({head:[k?1.2:-1.2,0,0],eyes:'closed',lean:-3})},
  laugh:{name:'Laugh',fps:8,loop:true,n:2,emote:1,f:k=>pose({lean:-10,head:[0,0,-0.6],eyes:'closed',drop:k,aP:{sw:45,ab:18,el:80},aN:{sw:45,ab:18,el:80},lift:k?-0.4:0.2})},
  surprise:{name:'Surprise',fps:6,loop:true,n:2,emote:1,f:k=>pose({air:k?0:2,lean:-8,head:[0,0.3,-0.5],aP:{sw:-10,ab:70,el:60},aN:{sw:-10,ab:70,el:60},lift:k?-0.3:0.9})},
  sad:{name:'Sad',fps:3,loop:true,n:2,emote:1,f:k=>pose({lean:14,head:[0,-1,0.8],eyes:'closed',drop:1-k,aP:{sw:5,ab:6,el:5},aN:{sw:5,ab:6,el:5},lift:-0.4})},
  think:{name:'Think',fps:3,loop:true,n:2,emote:1,f:k=>pose({head:[k?1:0,k?-0.6:0,0],drop:k,eyes:k?'closed':'open',aP:{sw:70,ab:12,el:k?140:115},aN:{sw:35,ab:10,el:95},lean:k?6:0})},
  angry:{name:'Angry',fps:8,loop:true,n:2,emote:1,f:k=>pose({lean:8,drop:k,aP:{sw:30,ab:35,el:95},aN:{sw:30,ab:35,el:95},lP:{sw:-8,ab:8},lN:{sw:8,ab:8},head:[0,-0.3,0.4]})},
  love:{name:'Love',fps:4,loop:true,n:2,emote:1,f:k=>pose({eyes:'closed',head:[k?0.6:-0.6,0,0],aP:{sw:40,ab:6,el:115},aN:{sw:40,ab:6,el:115},drop:k})}
};
const ANIM_KEYS=Object.keys(ANIMS);

/* ---------------- compositing ---------------- */
function pitch(v,a){const c=Math.cos(a),s=Math.sin(a);return[v[0],v[1]*c+v[2]*s,-v[1]*s+v[2]*c];}
function limbDir(sw,ab,side){return pitch([side*Math.sin(rad(ab)),-Math.cos(rad(ab)),0],rad(sw));}
const add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], mul3=(a,s)=>[a[0]*s,a[1]*s,a[2]*s], sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len3=a=>Math.hypot(a[0],a[1],a[2]);
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;let u=L?((px-ax)*dx+(py-ay)*dy)/L:0;u=Math.max(0,Math.min(1,u));const qx=ax+dx*u,qy=ay+dy*u;return[Math.hypot(px-qx,py-qy),u,qx,qy];}
const LIGHT=[-Math.SQRT1_2,-Math.SQRT1_2];

function armMat(t){let m='skin';const T=cfg.top;
  if((T==='tee'||T==='tunic')&&t<0.36)m='top';
  if((T==='longsleeve'||T==='robe'||T==='jacket'||T==='suit'||T==='coat'||T==='armor')&&t<0.98)m='top';
  if(cfg.hands==='gloves'&&t>1.0)m='glove';
  if(cfg.hands==='gauntlets'&&t>0.6)m='glove';
  return m;}
function legMat(t){let m='skin';
  if(cfg.bot==='pants'&&t<1)m='bot';
  if(cfg.bot==='shorts'&&t<0.3)m='bot';
  if(cfg.feet==='boots'&&t>0.62)m='boot';
  if(cfg.feet==='shoes'&&t>1)m='boot';
  return m;}

function rasterChain(pts,r,matFn,dark,tipDisc,thin){
  // pts: [[x,y],...] screen grid points; returns Map idx->{m,t}
  const cells=new Map();
  let total=0;const segL=[];for(let s=0;s<pts.length-1;s++){const l=Math.hypot(pts[s+1][0]-pts[s][0],pts[s+1][1]-pts[s][1])||0.001;segL.push(l);total+=l;}
  let x0=99,x1=-99,y0=99,y1=-99;pts.concat(tipDisc?[tipDisc.c]:[]).forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  if(![x0,x1,y0,y1].every(Number.isFinite))return cells;
  for(let y=Math.max(-1,Math.floor(y0-2));y<=Math.min(CH,Math.ceil(y1+2));y++)for(let x=Math.max(-1,Math.floor(x0-2));x<=Math.min(CW,Math.ceil(x1+2));x++){
    if(!inb(x,y))continue;const px=x+.5,py=y+.5;let best=null;
    let acc=0;for(let s=0;s<pts.length-1;s++){const[d,u,qx,qy]=segDist(px,py,pts[s][0],pts[s][1],pts[s+1][0],pts[s+1][1]);
      if(!best||d<best.d)best={d,t:(acc+u*segL[s])/total,qx,qy};acc+=segL[s];}
    let inTip=false,tq=null;
    if(tipDisc){const d=Math.hypot(px-tipDisc.c[0],py-tipDisc.c[1]);if(d<tipDisc.r&&(!best||best.d>=r||d<best.d)){inTip=true;tq={d,t:1.2,qx:tipDisc.c[0],qy:tipDisc.c[1]};}}
    const b=inTip?tq:best;
    if(!b||(!inTip&&b.d>=r))continue;
    const off=(px-b.qx)*LIGHT[0]+(py-b.qy)*LIGHT[1];
    let tone=off>0.2?2:off<-0.65?0:1; if(thin&&!inTip)tone=2; if(dark)tone=Math.max(0,tone-1);
    cells.set(I(x,y),{m:matFn(b.t),t:tone});
  }
  return cells;
}
function bresen(a,b,cb){if(![a[0],a[1],b[0],b[1]].every(Number.isFinite))return;let x0=Math.round(a[0]),y0=Math.round(a[1]);const x1=Math.round(b[0]),y1=Math.round(b[1]);
  const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy,n=0;
  while(true){cb(x0,y0,n++);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}

function compose(dir,anim,k){
  if(!DIRSRC[dir])dir='S';if(!ANIMS[anim])anim='idle';
  const n=ANIMS[anim].n;k=((Math.floor(+k)||0)%n+n)%n;
  return composeP(dir,ANIMS[anim].f(k));
}
function composeP(dir,P){
  if(P.prone)return pronify(dir,P);
  const [base,mir]=DIRSRC[dir];
  const core=coreFor(CORE_SRC[base]);
  const f=FACE[base], r=[f[1],-f[0]];
  const pz=v=>[v[0]*r[0]+v[2]*f[0],-v[1],v[0]*r[1]+v[2]*f[1]];
  const lean=rad(P.lean||0);
  // --- forward kinematics (local: x side, y up, z forward; origin pelvis)
  const arms={},legs={};
  const hug=(base==='S'||base==='N');
  for(const[key,side]of[['aP',1],['aN',-1]]){const a0=P[key];const a=hug?Object.assign({},a0,{ab:Math.max(0,a0.ab-18),eab:a0.eab!=null?a0.eab:Math.max(0,a0.ab-18)*0.85}):a0;
    const sh=add3(pitch([side*SHX[base],SHY[base],0],-lean),[0,-(P.drop||0),0]);
    const up=mul3(limbDir(a.sw,a.ab,side),2.2), fo=mul3(limbDir(a.sw+a.el,a.eab!=null?a.eab:a.ab*0.85,side),1.9);
    const el=add3(sh,up),wr=add3(el,fo);arms[key]={sh,el,wr,fo,side};}
  for(const[key,side]of[['lP',1],['lN',-1]]){const l=P[key];
    const hip=[side*1.5,0,0],kn=add3(hip,mul3(limbDir(l.sw,l.ab,side),2.0)),an=add3(kn,mul3(limbDir(l.sw-l.kn,l.ab,side),2.0));
    const fd=pitch([0,0,1],rad(l.sw-l.kn)*0.7);const heel=add3(add3(an,[0,-0.5,0]),mul3(fd,-0.2)),toe=add3(heel,mul3(fd,1.3));
    legs[key]={hip,kn,an,heel,toe,side};}
  let minY=1e9;for(const l of Object.values(legs)){minY=Math.min(minY,l.heel[1]-1,l.toe[1]-1,l.kn[1]-1);}
  const height=-minY+(P.air||0);
  const cX=CXF[base];
  const pelX=20+(cX-8), pelY=GROUND-height;
  const ox=Math.round(pelX-cX), oy=Math.round(pelY-17.5);
  const PX=ox+cX, PY=oy+17.5;
  const S=v=>{const p=pz(v);return[PX+p[0],PY+p[1],p[2]];};
  const G=v=>{const s=S(v);return[Math.round(s[0]),Math.round(s[1]),s[2]];};
  const rnd=v=>{const p=pz(v);return[Math.round(p[0]),Math.round(p[1])];};
  const headShift=rnd(add3(add3(sub3(pitch([0,5.5,0],-lean),[0,5.5,0]),P.head||[0,0,0]),[0,-(P.drop||0),0]));
  const torsoShift=rnd(add3(sub3(pitch([0,2.5,0],-lean),[0,2.5,0]),[0,-(P.drop||0),0]));
  const parts=[];
  // --- core: head + torso (+ skirt)
  const coreCells=new Map();
  const closed=P.eyes==='closed';
  let eyeCols={};
  if(closed){core.cells.forEach(c=>{if(c.m==='eyeW'||c.m==='eyeP'||c.m==='glow'){eyeCols[c.x]=Math.min(eyeCols[c.x]??99,c.y);}});}
  const trailX=-f[0]*(P.trail||0), lift=P.lift||0;
  const swayCells=[];
  for(const pass of [0,1]){core.cells.forEach(c=>{if(c.head!==pass)return;
    const sx=ox+c.x+(c.head?headShift[0]:torsoShift[0]), sy=oy+c.y+(c.head?headShift[1]:torsoShift[1]);
    if(!inb(sx,sy))return;let m=c.m,t=c.t,auth=c.auth;
    if(closed&&(m==='eyeW'||m==='eyeP'||m==='glow')){if(eyeCols[c.x]===c.y){m=m==='glow'?'void':'skin';t=1;}else{m='line';auth=1;}}
    coreCells.set(I(sx,sy),{m,t,auth});
    if(c.w>0&&(trailX||lift))swayCells.push([sx,sy,c.w,t,c.wl]);});}
  // secondary motion: loose hair streams behind and floats with the body's motion
  for(const[sx,sy,w,t,wl]of swayCells){const dx=Math.round(trailX*w*2.2),dy=Math.round(-lift*wl*1.8);
    const steps=Math.max(Math.abs(dx),Math.abs(dy));
    for(let s=1;s<=steps;s++){const x=sx+Math.round(dx*s/steps),y=sy+Math.round(dy*s/steps);if(!inb(x,y))continue;const i=I(x,y);
      const ex=coreCells.get(i);if(ex&&ex.m!=='hair')continue;coreCells.set(i,{m:'hair',t:s===steps?Math.max(0,t-1):t,auth:0});}}
  // skirt for tunic / robe, flaring with the legs
  const T=cfg.top;
  if(T==='tunic'||T==='robe'||T==='coat'){
    const hemT=T==='robe'?0.92:T==='coat'?0.72:0.34;
    const hemPts=Object.values(legs).map(l=>{const a=S(l.hip),b=S(l.kn),c=S(l.an);const tt=hemT*2;return tt<=1?[a[0]+(b[0]-a[0])*tt,a[1]+(b[1]-a[1])*tt]:[b[0]+(c[0]-b[0])*(tt-1),b[1]+(c[1]-b[1])*(tt-1)];});
    const hips=Object.values(legs).map(l=>S(l.hip));
    const topY=Math.min(...hips.map(h=>h[1]))-1, hemY=Math.max(...hemPts.map(h=>h[1]));
    const tl=Math.min(...hips.map(h=>h[0]))-2.2, tr=Math.max(...hips.map(h=>h[0]))+2.2;
    const hemTrail=trailX*(T==='robe'?2.2:1.2);const bl=Math.min(...hemPts.map(h=>h[0]))-2.0+Math.min(0,hemTrail), br=Math.max(...hemPts.map(h=>h[0]))+2.0+Math.max(0,hemTrail);
    for(let y=Math.floor(topY);y<=Math.ceil(hemY);y++){const u=(y+.5-topY)/Math.max(1,hemY-topY);if(u<0||u>1)continue;
      const xl=tl+(bl-tl)*u, xr=tr+(br-tr)*u;
      for(let x=Math.floor(xl);x<=Math.ceil(xr);x++){if(x+.5<xl||x+.5>xr||!inb(x,y))continue;const i=I(x,y);if(coreCells.has(i))continue;
        const v=(x+.5-xl)/Math.max(1,xr-xl);let t=v<0.38?2:v>0.72?0:1;if(u>0.85)t=Math.max(0,t-1);
        if((x+y+seed)%5===0&&u>0.3&&t===1)t=0;
        const open=T==='coat'&&base!=='N'&&base!=='NW'&&x===Math.floor((xl+xr)/2+(base==='S'?0:-1));
        coreCells.set(i,{m:open?'trim':'top',t:open?2:t,auth:0});}}
  }
  const coreConn=[];
  // --- limbs
  const dark=(pts,side)=>{const d=pts.reduce((s,p)=>s+p[2],0)/pts.length;return d<-0.6||(pts[0][0]>PX+0.6&&d<0.6);};
  for(const[key,l]of Object.entries(legs)){
    const hip=G(l.hip),kn=G(l.kn),an=G(l.an);let he=S(l.heel),to=S(l.toe);
    const out=Math.sign(he[0]-PX)||l.side*(r[0]||0);
    if(Math.abs(r[0])>0.5){he=[he[0]+out*0.5,he[1]];to=[to[0]+out*0.5,to[1]];}
    const pts=[hip,kn,an];
    const cells=rasterChain(pts,1.0,legMat,dark([hip,kn,an],l.side));
    const foot=rasterChain([[he[0],he[1]],[to[0],to[1]]],1.15,()=>legMat(1.2),dark([hip,kn,an],l.side));
    foot.forEach((v,i)=>{const below=i+CW;v.t=Math.min(v.t,(below<N&&!foot.has(below))?0:v.t);cells.set(i,v);});
    const depth=(hip[2]+kn[2]+an[2])/3;
    parts.push({id:key,cells,key:depth-2,conn:[{id:'core',pt:[hip[0],hip[1]],r:1.9}],root:hip});
    coreConn.push({id:key,pt:[hip[0],hip[1]],r:1.9});
  }
  let wpnPart=null;
  for(const[key,a]of Object.entries(arms)){
    // front/back: 1-pixel arms hugging the torso (half-grid snap); other views: 2-pixel arms
    const thin=base==='S'||base==='N';
    const GA=v=>{const s=S(v);return thin?[Math.floor(s[0])+0.5,Math.round(s[1]),s[2]]:[Math.round(s[0]),Math.round(s[1]),s[2]];};
    const sh=GA(a.sh),el=GA(a.el),wr=GA(a.wr);
    const fo2=[wr[0]-el[0],wr[1]-el[1]];const fl=Math.hypot(fo2[0],fo2[1])||1;
    let hc=[wr[0]+fo2[0]/fl*0.45,wr[1]+fo2[1]/fl*0.45];
    if(thin)hc=[wr[0],wr[1]+1];
    const dk=dark([sh,el,wr],a.side);
    const cells=rasterChain([sh,el,wr],thin?0.75:1.0,armMat,dk,{c:hc,r:thin?0.9:1.05},thin);
    const depth=(sh[2]+el[2]+wr[2])/3;
    parts.push({id:key,cells,key:depth+0.6,conn:[{id:'core',pt:[sh[0],sh[1]],r:thin?1.1:1.9}],root:sh,soft:thin});
    coreConn.push({id:key,pt:[sh[0],sh[1]],r:thin?1.1:1.7});
    if(key==='aP'&&cfg.weapon!=='none'&&!P.noWeapon){
      const wl=P.wpn?P.wpn:add3(mul3(a.fo,1/len3(a.fo)),[0,0,1.1]);
      const wv=pz(mul3(wl,1/len3(wl)));const L={sword:6.5,dagger:3.2,staff:8,pistol:2.4,rifle:6.5,saber:7,wrench:4}[cfg.weapon]||5;
      const u2=Math.hypot(wv[0],wv[1]);const ux=u2>0.01?wv[0]/u2:0,uy=u2>0.01?wv[1]/u2:-1;
      const vis=Math.max(0.35,u2);
      const wc=new Map();const set=(x,y,m,t)=>{if(inb(x,y))wc.set(I(x,y),{m,t});};
      const WP=cfg.weapon, tipAt=d=>[hc[0]+ux*d*vis,hc[1]+uy*d*vis];
      if(WP==='pistol'||WP==='rifle'){
        // barrel forward from the fist; the rifle adds a stock tucked behind it
        bresen(tipAt(0.6),tipAt(0.6+L),(x,y,n)=>set(x,y,'gun',n%3===1?2:1));
        if(WP==='rifle'){bresen(tipAt(-2.2),tipAt(-0.2),(x,y)=>set(x,y,'gun',0));const g=tipAt(2.2);set(Math.round(g[0]-uy),Math.round(g[1]+ux),'gun',0);}
        else{const g=tipAt(0.6);set(Math.round(g[0]-uy),Math.round(g[1]+ux),'gun',0);}
        if(P.flash){const f=tipAt(0.6+L+1.6),fx=Math.round(f[0]),fy2=Math.round(f[1]);
          [[0,0,3],[1,0,2],[-1,0,2],[0,1,2],[0,-1,2],[Math.round(ux*2),Math.round(uy*2),1]].forEach(([dx,dy,t])=>set(fx+dx,fy2+dy,'flash',t));}
      }else if(WP==='saber'){
        bresen(tipAt(0.4),tipAt(1.4),(x,y)=>set(x,y,'gun',1));
        bresen(tipAt(1.9),tipAt(1.9+L),(x,y,n)=>set(x,y,'beam',n===0?2:3));
      }else if(WP==='wrench'){
        bresen(tipAt(0.6),tipAt(0.6+L),(x,y)=>set(x,y,'blade',1));
        const h=tipAt(0.6+L+0.8),hx=Math.round(h[0]),hy=Math.round(h[1]);
        set(hx,hy,'blade',2);set(hx+1,hy,'blade',2);set(hx-1,hy,'blade',1);set(hx,hy-1,'blade',3);set(hx+1,hy-1,'blade',2);
      }else if(cfg.weapon==='staff'){
        bresen([hc[0]-ux*3*vis,hc[1]-uy*3*vis],[hc[0]+ux*L*vis,hc[1]+uy*L*vis],(x,y)=>set(x,y,'wood',1));
        const tx=Math.round(hc[0]+ux*(L*vis+0.8)),ty=Math.round(hc[1]+uy*(L*vis+0.8));
        set(tx,ty,'gem',2);set(tx+1,ty,'gem',1);set(tx,ty+1,'gem',1);set(tx+1,ty+1,'gem',0);
      }else{
        const g0=[hc[0]+ux*1.3,hc[1]+uy*1.3];
        bresen(g0,[hc[0]+ux*(1.3+L*vis),hc[1]+uy*(1.3+L*vis)],(x,y,n)=>set(x,y,'blade',n===0?1:2));
        const tip=[Math.round(hc[0]+ux*(1.3+L*vis)),Math.round(hc[1]+uy*(1.3+L*vis))];set(tip[0],tip[1],'blade',3);
        const px=-uy,py=ux;set(Math.round(g0[0]+px),Math.round(g0[1]+py),'hilt',2);set(Math.round(g0[0]-px),Math.round(g0[1]-py),'hilt',1);
        set(Math.round(g0[0]),Math.round(g0[1]),'hilt',1);
      }
      const wd=(wr[2]+ (wr[2]+wv[2]*3))/2;
      wpnPart={id:'wpn',cells:wc,key:Math.max(depth+0.6,wd+0.6)-0.01,conn:[]};
    }
  }
  if(wpnPart)parts.push(wpnPart);
  parts.push({id:'core',cells:coreCells,key:0,conn:coreConn});
  parts.sort((a,b)=>a.key-b.key);
  // --- paint back to front, each part inking its own 4-ring
  const mat=new Array(N).fill(''),tone=new Int8Array(N),owner=new Array(N).fill(''),feat=new Uint8Array(N);
  for(const p of parts){
    p.cells.forEach((c,i)=>{mat[i]=c.m;tone[i]=c.t;owner[i]=p.id;feat[i]=c.auth?1:0;});
    p.cells.forEach((c,i)=>{for(const j of nb(i,N4)){if(p.cells.has(j))continue;
      if(!mat[j]){mat[j]='line';owner[j]=p.id;feat[j]=0;continue;}
      if(mat[j]==='line'||owner[j]===p.id)continue;
      const cx=X(j)+.5,cy=Y(j)+.5;
      if(p.conn.some(cn=>cn.id===owner[j]&&Math.hypot(cx-cn.pt[0],cy-cn.pt[1])<cn.r))continue;
      if(p.soft&&owner[j]==='core'){tone[j]=Math.min(tone[j],0);continue;}
      mat[j]='line';owner[j]=p.id;feat[j]=0;}});
  }
  // a hand drawn over a weapon grip keeps the blade readable
  // --- gesture guides from the rig
  const g=[];
  const hcx=ox+core.headCX+.5+headShift[0], hcy=oy+core.headTop+5.5+headShift[1];
  g.push({t:'ell',cx:hcx,cy:hcy,rx:5,ry:5.6});
  const neck=S(add3(pitch([0,5.5,0],-lean),[0,-(P.drop||0),0])),pel=S([0,0,0]);
  g.push({t:'line',a:[neck[0],neck[1]],b:[pel[0],pel[1]]});
  g.push({t:'line',a:G(arms.aN.sh),b:G(arms.aP.sh)});
  g.push({t:'line',a:G(legs.lN.hip),b:G(legs.lP.hip)});
  for(const a of Object.values(arms)){g.push({t:'line',a:G(a.sh),b:G(a.el)});g.push({t:'line',a:G(a.el),b:G(a.wr)});}
  for(const l of Object.values(legs)){g.push({t:'line',a:G(l.hip),b:G(l.kn)});g.push({t:'line',a:G(l.kn),b:G(l.an)});g.push({t:'line',a:S(l.heel),b:S(l.toe)});}
  g.push({t:'line',a:[2,GROUND],b:[38,GROUND]});
  // nothing may sink below the ground line (collapsed poses fold the head down past the feet)
  let maxY=-1;for(let i=0;i<N;i++)if(mat[i])maxY=Math.max(maxY,Y(i));
  const raise=maxY-GROUND;
  if(raise>0){for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const i=I(x,y),sy=y+raise;
      if(sy<CH){const j=I(x,sy);mat[i]=mat[j];tone[i]=tone[j];feat[i]=feat[j];}else{mat[i]='';tone[i]=0;feat[i]=0;}}
    g.forEach(q=>{if(q.t==='ell')q.cy-=raise;else{q.a=[q.a[0],q.a[1]-raise];q.b=[q.b[0],q.b[1]-raise];}});}
  let o={mat,tone,feat,guides:g};
  if(mir)o=flipO(o);
  if(P.lie){const fx=mir?-f[0]:f[0];o=rotO(o,fx<=0&&!(base==='N'));}
  // kinds
  const kind=new Array(N).fill('');
  for(let i=0;i<N;i++){if(o.mat[i]!=='line')continue;
    if(nb(i,N8).some(j=>!o.mat[j]))kind[i]='outer'; else if(o.feat[i])kind[i]='feature'; else kind[i]='inner';}
  o.kind=kind;
  colorize(o);
  return o;
}
/* Prone: lying face-down along the facing direction, seen from the 3/4 game camera.
   Built from the back view (that's what you see of someone face-down), turned so the
   head points where they were facing, and flattened onto the ground plane. */
function pronify(dir,P){
  const src=composeP('N',pose({noWeapon:1,aP:{sw:0,ab:P.armAb||150,el:6},aN:{sw:0,ab:P.armAb||150,el:6},lP:{ab:P.legAb||3},lN:{ab:(P.legAb||3)+2},lift:0}));
  let pts=[];for(let i=0;i<N;i++)if(src.mat[i])pts.push([X(i),Y(i),i]);
  const vert=dir==='S'||dir==='N', headLeft=['W','SW','NW'].includes(dir);
  // orient: head toward the facing direction
  pts=pts.map(([x,y,i])=>{
    if(dir==='N')return[x,y,i];
    if(dir==='S')return[x,-y,i];
    return headLeft?[y,-x,i]:[-y,x,i];});
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;pts.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});
  const h=y1-y0+1, nh=Math.max(3,Math.round(h*(vert?0.62:0.72)));
  // keep the first and last rows (outline), sample the rest evenly
  const rowMap=new Map();for(let r=0;r<nh;r++){const sr=r===0?0:r===nh-1?h-1:Math.round(r*(h-1)/(nh-1));rowMap.set(sr,(rowMap.get(sr)||[]).concat([r]));}
  const w=x1-x0+1, ox=Math.round(20-w/2), oy=GROUND-nh+1;
  const o={mat:new Array(N).fill(''),tone:new Int8Array(N),feat:new Uint8Array(N),guides:[]};
  for(const[x,y,i]of pts){const rows=rowMap.get(y-y0);if(!rows)continue;
    for(const r of rows){const gx=x-x0+ox,gy=r+oy;if(!inb(gx,gy))continue;const j=I(gx,gy);o.mat[j]=src.mat[i];o.tone[j]=src.tone[i];o.feat[j]=src.feat[i];}}
  // close any outline gaps the flattening opened
  for(let i=0;i<N;i++){if(!o.mat[i]||o.mat[i]==='line')continue;for(const j of nb(i,N4))if(!o.mat[j]){o.mat[j]='line';o.feat[j]=0;}}
  o.guides.push({t:'line',a:[2,GROUND],b:[38,GROUND]});
  const kind=new Array(N).fill('');
  for(let i=0;i<N;i++){if(o.mat[i]!=='line')continue;if(nb(i,N8).some(j=>!o.mat[j]))kind[i]='outer';else if(o.feat[i])kind[i]='feature';else kind[i]='inner';}
  o.kind=kind;colorize(o);return o;
}
function flipO(o){const r={mat:new Array(N),tone:new Int8Array(N),feat:new Uint8Array(N)};
  for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const a=I(x,y),b=I(CW-1-x,y);r.mat[a]=o.mat[b];r.tone[a]=o.tone[b];r.feat[a]=o.feat[b];}
  const fp=p=>[CW-p[0],p[1],p[2]];
  r.guides=o.guides.map(g=>g.t==='ell'?Object.assign({},g,{cx:CW-g.cx}):{t:'line',a:fp(g.a),b:fp(g.b)});return r;}
function rotO(o,cw){
  const pv=[20,23];const T=(x,y)=>{const dx=x-pv[0],dy=y-pv[1];return cw?[pv[0]-dy,pv[1]+dx]:[pv[0]+dy,pv[1]-dx];};
  const tmp=[];let x0=99,x1=-99,y1=-99;
  for(let i=0;i<N;i++){if(!o.mat[i])continue;const[nx,ny]=T(X(i)+.5,Y(i)+.5);const gx=Math.floor(nx),gy=Math.floor(ny);tmp.push([gx,gy,i]);
    x0=Math.min(x0,gx);x1=Math.max(x1,gx);y1=Math.max(y1,gy);}
  const sx=Math.round(20-(x0+x1+1)/2), sy=GROUND-y1;
  const r={mat:new Array(N).fill(''),tone:new Int8Array(N),feat:new Uint8Array(N)};
  for(const[gx,gy,i]of tmp){const x=gx+sx,y=gy+sy;if(!inb(x,y))continue;const j=I(x,y);r.mat[j]=o.mat[i];r.tone[j]=o.tone[i];r.feat[j]=o.feat[i];}
  const tp=p=>{const q=T(p[0],p[1]);return[q[0]+sx,q[1]+sy];};
  r.guides=o.guides.filter(g=>!(g.t==='line'&&g.a[1]===GROUND&&g.b[1]===GROUND)).map(g=>g.t==='ell'?(()=>{const c=tp([g.cx,g.cy]);return{t:'ell',cx:c[0],cy:c[1],rx:g.ry,ry:g.rx};})():{t:'line',a:tp(g.a),b:tp(g.b)});
  r.guides.push({t:'line',a:[2,GROUND],b:[38,GROUND]});
  return r;}

/* ---------------- colour ---------------- */
const RAMP_MATS=new Set(['skin','hair','hat','top','bot','belt','glove','boot','blade','hilt','wood','gem','trim','glass','gun','beam','flash']);
function rampOf(m){switch(m){case'skin':return SKIN[cfg.skin];case'hair':return HAIR[cfg.hairColor];case'hat':return CLOTH[cfg.headColor];case'top':return CLOTH[cfg.topColor];
  case'bot':return CLOTH[cfg.botColor];case'belt':case'buckle':return CLOTH[cfg.beltColor];case'glove':return CLOTH[cfg.handsColor];case'boot':return CLOTH[cfg.feetColor];
  case'blade':return STEEL4;case'hilt':return CLOTH[cfg.weaponColor];case'wood':return CLOTH[cfg.weaponColor];case'gem':return CLOTH.Teal;case'trim':return CLOTH[cfg.trimColor]||CLOTH.White;case'glass':return GLASS;case'gun':return GUNMETAL;case'flash':return FLASH;
  case'beam':{const r=CLOTH[cfg.weaponColor]||CLOTH.Azure;return[r[1],r[2],mix(r[2],'#ffffff',0.55),'#ffffff'];}}return null;}
function rampColor(m,t){const r=rampOf(m);if(!r)return'#ff00ff';if(r.length===4)return r[Math.max(0,Math.min(3,t))];
  if(t>=3)return mix(r[2],'#ffffff',0.45);return r[Math.max(0,t)];}
function colorize(o){
  const ink=OUTLINES[cfg.outline], col=new Array(N).fill(null), flat=new Array(N).fill(null);
  for(let i=0;i<N;i++){const m=o.mat[i];if(!m)continue;
    if(m==='line'){col[i]=ink;flat[i]=ink;continue;}
    if(m==='eyeW'){col[i]='#f8f8f8';flat[i]=SKIN[cfg.skin][1];continue;}
    if(m==='eyeP'){col[i]='#885038';flat[i]=SKIN[cfg.skin][1];continue;}
    if(m==='glow'){col[i]='#f8e050';flat[i]=SKIN[cfg.skin][1];continue;}
    if(m==='void'){col[i]='#16102a';flat[i]=SKIN[cfg.skin][1];continue;}
    if(m==='buckle'){col[i]='#f8d860';flat[i]=rampColor('belt',1);continue;}
    col[i]=rampColor(m,o.tone[i]); flat[i]=rampColor(m,1);
  }
  const sel=new Array(N).fill(false);
  if(cfg.selout==='on'){
    for(let i=0;i<N;i++){if(o.kind[i]!=='outer')continue;const x=X(i),y=Y(i);
      for(const[a,b]of[[x,y+1],[x+1,y],[x-1,y]]){if(!inb(a,b))continue;const j=I(a,b);const m=o.mat[j];
        if(m&&RAMP_MATS.has(m)&&o.tone[j]>=2&&b>=y){const r=rampOf(m);col[i]=mix(r[0],ink,0.55);sel[i]=true;break;}}}
  }
  o.col=col;o.flat=flat;o.sel=sel;o.ink=ink;
}

/* ---------------- frame cache ---------------- */
let frameCache=new Map();
function frameOf(dir,anim,k){if(ANIMS[anim]){const n=ANIMS[anim].n;k=((Math.floor(+k)||0)%n+n)%n;}const key=dir+'|'+anim+'|'+k;let o=frameCache.get(key);
  if(!o){o=compose(dir,anim,k);frameCache.set(key,o);}return o;}
function invalidate(){frameCache=new Map();coreCache={};}
const _rgb=new Map();
function rgbaOf(o){if(o.rgba)return o.rgba;const a=new Uint8ClampedArray(N*4);
  for(let i=0;i<N;i++){const c=o.col[i];if(!c)continue;let v=_rgb.get(c);if(!v){v=hex2rgb(c);_rgb.set(c,v);}a[i*4]=v[0];a[i*4+1]=v[1];a[i*4+2]=v[2];a[i*4+3]=255;}
  return o.rgba=a;}

/* ================= GAME INTEGRATION NOTES =================
   Every animation below exists in all 8 directions. ANIM_DOC says what each one is FOR,
   which frames carry gameplay events, and what the character should do when it ends.
   The animator (createAnimator) wires all of this up so a game only reports movement and
   calls verbs (attack, hurt, ko, emote...). Use the full set: a game that only plays
   idle/walk throws away most of the character.

   priority  higher interrupts lower (locomotion 0 < land 1 < emote 2 < action 3 < hurt 4 < ko 5)
   events    {frameIndex: 'eventName'} fired once when that frame starts
   next      what plays when a one-shot finishes ('loco' = back to idle/walk/run)
   lock      true = the character should not steer or move while it plays (the game decides)
*/
const ANIM_DOC={
  idle:     {priority:0,loop:true, use:'Standing still. Breathing arms and settling hair; never moves the feet.'},
  walk:     {priority:0,loop:true, events:{0:'footstep',3:'footstep'}, use:'Moving below the run threshold: towns, sneaking, carrying, low stamina. Advance frames by distance, not time, so feet do not skate.'},
  run:      {priority:0,loop:true, events:{0:'footstep',3:'footstep'}, use:'Normal movement in action games. Hair and coat hems stream behind. Advance by distance.'},
  jump:     {priority:0,loop:false,frameNames:['crouch','rise','apex','fall','land'], events:{0:'crouch'}, use:'Airborne state chosen by vertical speed: 0 crouch (anticipation, ~70 ms before take-off), 1 rising, 2 apex, 3 falling. Frame 4 is a 1-frame landing; prefer the Land animation.'},
  land:     {priority:1,loop:false,events:{0:'land'}, next:'loco', use:'Touch-down after any airborne state (jump, fall off a ledge, knock-up). Movement may interrupt after frame 1.'},
  attack:   {priority:3,loop:false,events:{1:'swing',2:'hit'}, next:'loco', lock:true, use:'Melee swing with the held weapon (sword, dagger, staff, saber, wrench; a pistol-whip with guns). Open the hitbox on "hit" (frame 2).'},
  shoot:    {priority:3,loop:false,events:{1:'fire'}, next:'loco', use:'Ranged attack. Spawn the projectile on "fire" (frame 1, muzzle flash drawn for guns). Also works empty-handed as a point or throw. Strafing while shooting is fine.'},
  cast:     {priority:3,loop:true, events:{2:'cast'}, use:'Channelled spell or ability. Loop while charging; release on "cast" or when the game stops it.'},
  flinch:   {priority:4,loop:false,events:{0:'hurt'}, next:'loco', lock:true, use:'Took damage but still standing. Pair with knockback and a short invulnerability window.'},
  knockdown:{priority:5,loop:false,events:{0:'hurt',4:'thud'}, next:'hold', lock:true, frameNames:['hit','stagger','buckle','slump','collapse','prone'], use:'Defeat / KO. Holds the prone frame until revive(). Also usable for a non-lethal knock-down with revive() after a delay.'},
  kneel:    {priority:0,loop:true, use:'Low-health stance in place of idle (the FF5 "critical" kneel). The animator picks it automatically when lowHealth is true.'},
  wave:     {priority:2,loop:true, emote:true, use:'Greeting, calling attention, NPC hello.'},
  cheer:    {priority:2,loop:true, emote:true, use:'Victory, level-up, quest complete.'},
  nod:      {priority:2,loop:true, emote:true, use:'Yes / agreement in dialogue.'},
  shake:    {priority:2,loop:true, emote:true, use:'No / refusal in dialogue.'},
  laugh:    {priority:2,loop:true, emote:true, use:'Joke, taunt, smug reaction.'},
  surprise: {priority:2,loop:true, emote:true, use:'Spotted the player, startled, plot twist.'},
  sad:      {priority:2,loop:true, emote:true, use:'Failure, bad news, mourning.'},
  think:    {priority:2,loop:true, emote:true, use:'Puzzle, shop browsing, waiting on a choice.'},
  angry:    {priority:2,loop:true, emote:true, use:'Hostile dialogue, aggro warning before combat.'},
  love:     {priority:2,loop:true, emote:true, use:'Gift received, affection, recruit / join party.'}
};

/* Direction from a screen-space vector (x right, y down). mode 'eight' for top-down games,
   'side' for platformers (W or E only), 'four' for S/W/N/E only. */
function dirFromVector(x,y,mode){
  if(!x&&!y)return null;
  if(mode==='side')return x<0?'W':'E';
  const a=Math.atan2(y,x);
  if(mode==='four'){const q=Math.round(a/(Math.PI/2));return{0:'E',1:'S','2':'W','-2':'W','-1':'N'}[q];}
  const sec=Math.round(a/(Math.PI/4));return{0:'E',1:'SE',2:'S',3:'SW',4:'W','-4':'W','-3':'NW','-2':'N','-1':'NE'}[sec];
}

/* Where a frame sits in a sheet from generate(): sx, sy, w, h plus the foot anchor.
   Draw at (worldX - anchor.x, worldY - anchor.y) so the feet land on the entity position. */
function sheetRect(meta,anim,dir,frame){const a=meta.animations[anim];if(!a)return null;const row=a.rows[dir];if(row==null)return null;
  const f=Math.max(0,Math.min(a.frames-1,frame|0));return{sx:f*meta.frameWidth,sy:row*meta.frameHeight,w:meta.frameWidth,h:meta.frameHeight,anchor:meta.anchor};}

/* createAnimator: a small state machine that turns game state into {anim, dir, frame, events}.
     const a = FF5Sprites.createAnimator({mode:'eight', walkSpeed:20, runSpeed:55});
     each tick:  const s = a.update(dt, {vx, vy, grounded, airVy, lowHealth});
                 draw sheetRect(meta, s.anim, s.dir, s.frame); handle s.events ('hit','fire','footstep','land','takeoff',...)
     verbs:      a.attack()  a.shoot()  a.cast() / a.stopCast()  a.hurt()  a.ko()  a.revive()   state: a.dir  a.action  a.isKO
                 a.jump()  -> plays the crouch, then emits 'takeoff': apply your jump impulse then
                 a.emote('wave', seconds)  a.face('SW')
   Units: vx/vy in your world units per second; walkSpeed/runSpeed in the same units.
   stridePx: world distance per walk/run frame (tune so feet do not slide; default 5 / 6.5). */
function createAnimator(opt){
  opt=Object.assign({mode:'eight',walkSpeed:4,runSpeed:45,walkStride:5,runStride:6.5,riseVy:-60,fallVy:60,crouchTime:0.07},opt||{});
  const st={dir:opt.dir||'S',act:null,actT:0,actDur:0,lastFrame:-1,dist:0,locoAnim:'idle',locoFrame:-1,t:0,wasGrounded:true,crouch:0,ko:false,castHold:false};
  const fps=a=>ANIMS[a].fps, nF=a=>ANIMS[a].n, pri=a=>ANIM_DOC[a].priority;
  function play(name,o){o=o||{};if(!ANIMS[name])return false;
    if(st.ko&&name!=='knockdown')return false;
    if(st.act&&pri(st.act)>pri(name)&&!o.force)return false;
    st.act=name;st.actT=0;st.lastFrame=-1;st.actDur=o.seconds!=null?o.seconds:(ANIM_DOC[name].loop?Infinity:nF(name)/fps(name));
    if(name==='knockdown')st.ko=true;return true;}
  function fireEvents(name,f,out){const ev=ANIM_DOC[name].events;if(ev&&ev[f])out.push(ev[f]);}
  return{
    get dir(){return st.dir;}, get isKO(){return st.ko;}, get action(){return st.act;},
    face(d){if(DIRSRC[d])st.dir=d;},
    attack(){return play('attack');}, shoot(){return play('shoot');},
    cast(){st.castHold=true;return play('cast');}, stopCast(){st.castHold=false;if(st.act==='cast')st.act=null;},
    hurt(){return play('flinch');}, ko(){return play('knockdown',{force:true});},
    revive(){st.ko=false;st.act=null;},
    emote(name,seconds){return ANIM_DOC[name]&&ANIM_DOC[name].emote?play(name,{seconds:seconds==null?2:seconds}):false;},
    jump(){if(st.act&&pri(st.act)>=3)return false;st.crouch=opt.crouchTime;st.crouchNew=true;return true;},
    update(dt,inp){inp=inp||{};dt=Math.max(0,+dt||0);st.t+=dt;const out=[];
      const vx=+inp.vx||0,vy=+inp.vy||0,grounded=inp.grounded!==false,sp=Math.hypot(vx,vy);
      const locked=st.act&&ANIM_DOC[st.act].lock;
      if(!locked&&!st.ko){const d=dirFromVector(vx,vy,inp.mode||opt.mode);if(d&&sp>=opt.walkSpeed)st.dir=d;}
      // landing
      if(grounded&&!st.wasGrounded&&!st.ko){play('land');}
      st.wasGrounded=grounded;
      // one-shot / held actions
      if(st.act){st.actT+=dt;const A=st.act,n=nF(A);let f=Math.floor(st.actT*fps(A));
        // fire every frame's events that were passed since last tick, even on a long frame
        for(let g=st.lastFrame+1;g<=f;g++){if(!ANIM_DOC[A].loop&&g>n-1)break;fireEvents(A,ANIM_DOC[A].loop?g%n:g,out);}
        if(f>st.lastFrame)st.lastFrame=f;
        if(A==='land'&&f>=1&&sp>=opt.walkSpeed)st.act=null;
        else if(st.actT>=st.actDur&&!(A==='cast'&&st.castHold)){
          if(A==='knockdown'){return{anim:A,dir:st.dir,frame:n-1,events:out,ko:true};}
          out.push('done:'+A);st.act=null;}
        else{const frame=ANIM_DOC[A].loop?f%n:Math.min(f,n-1);return{anim:A,dir:st.dir,frame,events:out,ko:st.ko};}
      }
      // jump anticipation, then airborne frames by vertical speed
      if(st.crouch>0){if(st.crouchNew){out.push('crouch');st.crouchNew=false;}st.crouch-=dt;if(st.crouch<=0)out.push('takeoff');return{anim:'jump',dir:st.dir,frame:0,events:out};}
      if(!grounded){const v=+inp.airVy||0;return{anim:'jump',dir:st.dir,frame:v<opt.riseVy?1:v>opt.fallVy?3:2,events:out};}
      // locomotion: frames advance by distance travelled
      let anim,frame;
      if(sp>=opt.walkSpeed){anim=sp>=opt.runSpeed?'run':'walk';st.dist+=sp*dt;frame=Math.floor(st.dist/(anim==='run'?opt.runStride:opt.walkStride))%nF(anim);}
      else{anim=inp.lowHealth?'kneel':'idle';frame=Math.floor(st.t*fps(anim))%nF(anim);}
      if(anim!==st.locoAnim){st.locoAnim=anim;st.locoFrame=-1;fireEvents(anim,frame,out);st.locoFrame=frame;}
      else if(frame!==st.locoFrame){const n=nF(anim);for(let g=(st.locoFrame+1)%n,c=0;c<n;g=(g+1)%n,c++){fireEvents(anim,g,out);if(g===frame)break;}st.locoFrame=frame;}
      return{anim,dir:st.dir,frame,events:out};}
  };
}

function animInfo(k){const A=ANIMS[k],D=ANIM_DOC[k]||{};return{name:A.name,fps:A.fps,loop:A.loop,frames:A.n,frameNames:A.frames||D.frameNames||null,emote:!!A.emote,
  priority:D.priority||0,events:D.events||{},next:D.next||(A.loop?null:'loco'),lock:!!D.lock,use:D.use||''};}
/* ---------------- public API ---------------- */
/* Preset roles. Any field can be overridden: setCharacter({job:'Pilot', hairColor:'Rose'}). */
const JOBS={
  // fantasy (FF5 jobs)
  Freelancer:{era:'Fantasy',hair:'short',hairColor:'Chestnut',head:'none',top:'tee',topColor:'Azure',bot:'pants',botColor:'Leather',feet:'boots',feetColor:'Leather',hands:'none',belt:'on',beltColor:'Leather',weapon:'sword',weaponColor:'Leather',skin:'Template'},
  Knight:{era:'Fantasy',hair:'short',hairColor:'Gold',head:'helm',headColor:'Steel',top:'armor',topColor:'Steel',bot:'pants',botColor:'Steel',feet:'boots',feetColor:'Coal',hands:'gauntlets',handsColor:'Steel',belt:'on',beltColor:'Scarlet',weapon:'sword',weaponColor:'Scarlet',skin:'Fair'},
  Monk:{era:'Fantasy',hair:'topknot',hairColor:'Ink',head:'none',top:'vest',topColor:'Saffron',bot:'pants',botColor:'Saffron',feet:'none',hands:'gloves',handsColor:'Linen',belt:'on',beltColor:'Coal',weapon:'none',skin:'Bronze'},
  Thief:{era:'Fantasy',hair:'spiky',hairColor:'Crimson',head:'bandana',headColor:'Forest',top:'vest',topColor:'Forest',bot:'pants',botColor:'Coal',feet:'boots',feetColor:'Leather',hands:'gloves',handsColor:'Leather',belt:'on',beltColor:'Leather',weapon:'dagger',weaponColor:'Coal',skin:'Olive'},
  'White Mage':{era:'Fantasy',hair:'long',hairColor:'Gold',head:'hood',headColor:'Linen',top:'robe',topColor:'Linen',bot:'none',feet:'shoes',feetColor:'Scarlet',hands:'none',belt:'off',weapon:'staff',weaponColor:'Leather',skin:'Fair'},
  'Black Mage':{era:'Fantasy',hair:'short',hairColor:'Ink',head:'wizard',headColor:'Leather',top:'robe',topColor:'Azure',bot:'none',feet:'shoes',feetColor:'Leather',hands:'none',belt:'on',beltColor:'Saffron',weapon:'staff',weaponColor:'Coal',shadow:'auto',skin:'Template'},
  Ranger:{era:'Fantasy',hair:'ponytail',hairColor:'Violet',head:'none',top:'tunic',topColor:'Teal',bot:'pants',botColor:'Leather',feet:'boots',feetColor:'Leather',hands:'gloves',handsColor:'Leather',belt:'on',beltColor:'Leather',weapon:'dagger',weaponColor:'Leather',skin:'Template'},
  // present day
  'Office Worker':{era:'Present day',hair:'short',hairColor:'Ink',head:'none',top:'suit',topColor:'Navy',trimColor:'Scarlet',bot:'pants',botColor:'Navy',feet:'shoes',feetColor:'Coal',hands:'none',belt:'off',weapon:'none',skin:'Fair'},
  'Police Officer':{era:'Present day',hair:'short',hairColor:'Ink',head:'cap',headColor:'Navy',top:'longsleeve',topColor:'Navy',bot:'pants',botColor:'Navy',feet:'boots',feetColor:'Coal',hands:'none',belt:'on',beltColor:'Coal',weapon:'pistol',skin:'Bronze'},
  Medic:{era:'Present day',hair:'bob',hairColor:'Chestnut',head:'none',top:'tee',topColor:'Teal',bot:'pants',botColor:'Teal',feet:'shoes',feetColor:'White',hands:'gloves',handsColor:'White',belt:'off',weapon:'none',skin:'Olive'},
  'Construction Worker':{era:'Present day',hair:'short',hairColor:'Chestnut',head:'hardhat',headColor:'Saffron',top:'vest',topColor:'Hazard',bot:'pants',botColor:'Denim',feet:'boots',feetColor:'Leather',hands:'gloves',handsColor:'Leather',belt:'on',beltColor:'Leather',weapon:'wrench',skin:'Umber'},
  Detective:{era:'Present day',hair:'short',hairColor:'Chestnut',head:'fedora',headColor:'Leather',trimColor:'Coal',top:'coat',topColor:'Khaki',bot:'pants',botColor:'Coal',feet:'shoes',feetColor:'Leather',hands:'none',belt:'on',beltColor:'Khaki',weapon:'pistol',skin:'Template'},
  Athlete:{era:'Present day',hair:'ponytail',hairColor:'Gold',head:'none',top:'tee',topColor:'Scarlet',bot:'shorts',botColor:'Navy',feet:'shoes',feetColor:'White',hands:'none',belt:'off',weapon:'none',skin:'Bronze'},
  Punk:{era:'Present day',hair:'spiky',hairColor:'Rose',head:'none',top:'jacket',topColor:'Coal',trimColor:'Scarlet',bot:'pants',botColor:'Denim',feet:'boots',feetColor:'Coal',hands:'gloves',handsColor:'Coal',belt:'on',beltColor:'Steel',weapon:'none',skin:'Fair'},
  // science fiction
  'Space Marine':{era:'Sci-fi',hair:'short',hairColor:'Ink',head:'spacehelm',headColor:'Khaki',top:'armor',topColor:'Drab',bot:'pants',botColor:'Drab',feet:'boots',feetColor:'Coal',hands:'gauntlets',handsColor:'Drab',belt:'on',beltColor:'Coal',weapon:'rifle',skin:'Template'},
  Pilot:{era:'Sci-fi',hair:'short',hairColor:'Gold',head:'visor',headColor:'Coal',top:'longsleeve',topColor:'Hazard',bot:'pants',botColor:'Hazard',feet:'boots',feetColor:'Coal',hands:'gloves',handsColor:'Coal',belt:'on',beltColor:'Coal',weapon:'pistol',skin:'Fair'},
  Android:{era:'Sci-fi',hair:'bald',head:'visor',headColor:'Steel',top:'armor',topColor:'White',bot:'pants',botColor:'White',feet:'shoes',feetColor:'Steel',hands:'none',belt:'off',weapon:'saber',weaponColor:'Teal',shadow:'off',skin:'Chrome'},
  Netrunner:{era:'Sci-fi',hair:'long',hairColor:'Violet',head:'visor',headColor:'Coal',top:'jacket',topColor:'Coal',trimColor:'Neon',bot:'pants',botColor:'Coal',feet:'boots',feetColor:'Coal',hands:'gloves',handsColor:'Neon',belt:'on',beltColor:'Neon',weapon:'pistol',skin:'Olive'},
  Scientist:{era:'Sci-fi',hair:'bob',hairColor:'Silver',head:'none',top:'coat',topColor:'White',trimColor:'Azure',bot:'pants',botColor:'Navy',feet:'shoes',feetColor:'Coal',hands:'gloves',handsColor:'Teal',belt:'off',weapon:'none',skin:'Fair'},
  'Alien Envoy':{era:'Sci-fi',hair:'bald',head:'none',top:'robe',topColor:'Plum',bot:'none',feet:'shoes',feetColor:'Plum',hands:'none',belt:'on',beltColor:'Saffron',weapon:'staff',weaponColor:'Teal',skin:'Cerulean'},
  'Bounty Hunter':{era:'Sci-fi',hair:'short',hairColor:'Ink',head:'spacehelm',headColor:'Steel',top:'armor',topColor:'Scarlet',bot:'pants',botColor:'Coal',feet:'boots',feetColor:'Coal',hands:'gauntlets',handsColor:'Steel',belt:'on',beltColor:'Leather',weapon:'rifle',skin:'Template'},
  'Star Knight':{era:'Sci-fi',hair:'short',hairColor:'Chestnut',head:'none',top:'tunic',topColor:'Khaki',bot:'pants',botColor:'Leather',feet:'boots',feetColor:'Leather',hands:'none',belt:'on',beltColor:'Leather',weapon:'saber',weaponColor:'Azure',skin:'Template'},
  Mannequin:{era:'Base',hair:'bald',head:'none',top:'none',bot:'none',feet:'none',hands:'none',belt:'off',weapon:'none',skin:'Template'}
};
const OPTIONS={hair:['bald','short','spiky','bob','long','ponytail','topknot'],head:['none','bandana','hood','helm','wizard','cap','hardhat','fedora','spacehelm','visor'],
  top:['none','vest','tee','longsleeve','tunic','robe','jacket','suit','coat','armor'],bot:['none','shorts','pants'],feet:['none','shoes','boots'],hands:['none','gloves','gauntlets'],
  belt:['on','off'],weapon:['none','sword','dagger','staff','pistol','rifle','saber','wrench'],shadow:['auto','on','off'],selout:['on','off'],
  skin:Object.keys(SKIN),hairColor:Object.keys(HAIR),headColor:Object.keys(CLOTH),topColor:Object.keys(CLOTH),botColor:Object.keys(CLOTH),
  feetColor:Object.keys(CLOTH),handsColor:Object.keys(CLOTH),beltColor:Object.keys(CLOTH),weaponColor:Object.keys(CLOTH),trimColor:Object.keys(CLOTH),outline:Object.keys(OUTLINES)};
function setCharacter(c,s){c=c||{};cfg=Object.assign({},DEFAULT,JOBS[c.job]||{},c);delete cfg.era;if(s!=null)seed=s|0;invalidate();return Object.assign({},cfg);}
function randomCharacter(s,era){const r=rngFrom(s);const pick=a=>a[Math.floor(r()*a.length)];const C=Object.keys(CLOTH);
  // start from a random preset of the chosen era (or any), then remix colours and a few parts
  const pool=Object.keys(JOBS).filter(j=>j!=='Mannequin'&&(!era||JOBS[j].era===era));const base=Object.assign({},DEFAULT,JOBS[pick(pool)]);delete base.era;
  return Object.assign(base,{skin:pick(Object.keys(SKIN).filter(k=>k!=='Chrome'&&k!=='Cerulean'&&k!=='Goblin').concat(r()<0.08?['Chrome','Cerulean','Goblin']:[])),
    hair:pick(['short','spiky','bob','long','ponytail','short','spiky','topknot','bald']),hairColor:pick(Object.keys(HAIR)),
    headColor:r()<0.5?base.headColor:pick(C),topColor:pick(C),botColor:pick(C),trimColor:pick(C),
    feetColor:pick(['Leather','Coal','Scarlet','Steel','White']),handsColor:pick(['Leather','Linen','Steel','Coal','White']),beltColor:pick(['Leather','Saffron','Scarlet','Coal','Steel']),
    weaponColor:pick(['Leather','Coal','Scarlet','Saffron','Azure','Teal','Neon']),job:''});}
function frame(dir,anim,k){return rgbaOf(frameOf(dir,anim,k));}
function generate(c,opts){opts=opts||{};if(c!==undefined)setCharacter(c,opts.seed);
  const anims=opts.anims||ANIM_KEYS, dirs=opts.dirs||DIRS;const maxN=Math.max(...anims.map(a=>ANIMS[a].n));
  const W=maxN*CW,H=anims.length*dirs.length*CH,data=new Uint8ClampedArray(W*H*4);
  const meta={frameWidth:CW,frameHeight:CH,anchor:{x:20,y:GROUND},directions:dirs,layout:'rows = animation x direction, columns = frames',
    character:Object.assign({},cfg),seed,animations:{}};
  let row=0;
  for(const a of anims){meta.animations[a]=Object.assign(animInfo(a),{rows:{}});const A=ANIMS[a];
    for(const d of dirs){meta.animations[a].rows[d]=row;
      for(let k=0;k<A.n;k++){const f=frame(d,a,k);for(let y=0;y<CH;y++){const src=y*CW*4,dst=((row*CH+y)*W+k*CW)*4;data.set(f.subarray(src,src+CW*4),dst);}}
      row++;}}
  return{width:W,height:H,data,meta};}
const API={generate,frame,setCharacter,randomCharacter,
  animations:Object.fromEntries(ANIM_KEYS.map(k=>[k,animInfo(k)])),
  createAnimator,dirFromVector,sheetRect,
  directions:DIRS.slice(),directionNames:Object.assign({},DIRNAME),jobs:JOBS,defaults:Object.assign({},DEFAULT),options:OPTIONS,
  palettes:{skin:SKIN,hair:HAIR,cloth:CLOTH,outline:OUTLINES},frameSize:{width:CW,height:CH,anchor:{x:20,y:GROUND}},version:'4.0'};

if(typeof module!=="undefined"&&module.exports)module.exports=API;root.FF5Sprites=API;
})(typeof globalThis!=="undefined"?globalThis:this);
