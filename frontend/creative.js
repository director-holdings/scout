/* 광고 소재 SVG 렌더러 */
(function(){
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let uid=0;
function wrap(t,n){const w=String(t).split(' ');const out=[];let line='';for(const x of w){if((line+' '+x).trim().length>n&&line){out.push(line);line=x}else line=(line+' '+x).trim()}if(line)out.push(line);return out.slice(0,4)}
function lines(arr,x,y,size,fill,anchor='start',weight=800){return arr.map((l,i)=>`<text x="${x}" y="${y+i*size*1.18}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Noto Sans KR,sans-serif" letter-spacing="-0.5">${esc(l)}</text>`).join('')}
function shape(kind,cx,cy,s,acc,ink,g){
 const T=(d)=>`<g transform="translate(${cx} ${cy}) scale(${s})">${d}</g>`;
 const sh=`<ellipse cx="0" cy="92" rx="70" ry="10" fill="${ink}" opacity=".16"/>`;
 const F=`url(#${g})`;
 switch(kind){
  case'bottle':return T(sh+`<rect x="-34" y="-60" width="68" height="150" rx="18" fill="${F}"/><rect x="-14" y="-92" width="28" height="36" rx="4" fill="${ink}"/><rect x="-24" y="-8" width="48" height="56" rx="6" fill="#fff" opacity=".85"/><rect x="-26" y="-52" width="8" height="120" rx="4" fill="#fff" opacity=".35"/>`);
  case'jar':return T(sh+`<rect x="-62" y="-6" width="124" height="96" rx="22" fill="${F}"/><rect x="-66" y="-34" width="132" height="36" rx="10" fill="${ink}"/><rect x="-40" y="22" width="80" height="40" rx="6" fill="#fff" opacity=".85"/><rect x="-54" y="4" width="10" height="70" rx="5" fill="#fff" opacity=".3"/>`);
  case'tube':return T(sh+`<path d="M-44 -86 L44 -86 L30 60 L-30 60 Z" fill="${F}"/><rect x="-30" y="60" width="60" height="30" rx="6" fill="${ink}"/><rect x="-26" y="-60" width="52" height="60" rx="4" fill="#fff" opacity=".85"/><path d="M-36 -82 L-28 50" stroke="#fff" stroke-width="6" opacity=".3"/>`);
  case'box':return T(sh+`<path d="M-70 -40 L0 -70 L70 -40 L0 -10 Z" fill="#fff" opacity=".55"/><path d="M-70 -40 L0 -10 L0 90 L-70 60 Z" fill="${F}"/><path d="M70 -40 L0 -10 L0 90 L70 60 Z" fill="${acc}" opacity=".75"/><path d="M-54 0 L-16 16 L-16 44 L-54 28 Z" fill="#fff" opacity=".8"/>`);
  case'shoe':return T(sh+`<path d="M-90 40 C-90 0 -60 -10 -40 -30 C-20 -50 10 -40 20 -20 C40 0 90 10 90 40 L90 62 L-90 62 Z" fill="${F}"/><rect x="-92" y="58" width="184" height="18" rx="9" fill="#fff"/><path d="M-30 -20 L10 0 M-20 -30 L18 -10" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`);
  case'bag':return T(sh+`<path d="M-40 -40 C-40 -100 40 -100 40 -40" stroke="${ink}" stroke-width="10" fill="none"/><path d="M-70 -40 L70 -40 L84 90 L-84 90 Z" fill="${F}"/><rect x="-30" y="0" width="60" height="22" rx="4" fill="#fff" opacity=".8"/>`);
  case'shirt':return T(sh+`<path d="M-40 -80 L-90 -50 L-70 -6 L-50 -16 L-50 90 L50 90 L50 -16 L70 -6 L90 -50 L40 -80 C30 -60 -30 -60 -40 -80 Z" fill="${F}"/><path d="M-50 20 L50 20" stroke="#fff" stroke-width="4" opacity=".4"/>`);
  case'can':return T(sh+`<rect x="-46" y="-80" width="92" height="170" rx="14" fill="${F}"/><ellipse cx="0" cy="-80" rx="46" ry="12" fill="${ink}"/><rect x="-46" y="-20" width="92" height="50" fill="#fff" opacity=".85"/><rect x="-36" y="-70" width="10" height="150" rx="5" fill="#fff" opacity=".3"/>`);
  default:return T(sh+`<rect x="-56" y="-90" width="112" height="180" rx="22" fill="${ink}"/><rect x="-46" y="-78" width="92" height="156" rx="14" fill="${F}"/><circle cx="0" cy="0" r="26" fill="#fff" opacity=".8"/>`);
 }
}
function person(cx,cy,tone,shirt){return `<g transform="translate(${cx} ${cy})"><path d="M-110 230 C-110 120 -60 90 0 90 C60 90 110 120 110 230 Z" fill="${shirt}"/><rect x="-20" y="56" width="40" height="44" rx="12" fill="${tone}"/><ellipse cx="0" cy="20" rx="52" ry="60" fill="${tone}"/><path d="M-56 10 C-60 -50 60 -60 58 6 C40 -20 -30 -24 -56 10 Z" fill="#2a1d17"/></g>`}
/* spec: {layout,pal|colors:[bg,bg2,acc,ink],shape,headline,cta,brand,media,img} */
function creative(spec){
 if(spec.thumb){const badge=spec.media==='video'?'<i class="vbadge" aria-hidden="true"></i>':spec.media==='carousel'?'<i class="cbadge" aria-hidden="true"></i>':'';return `<span class="realimg"><img src="${esc(spec.thumb)}" alt="${esc(spec.headline||'')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('broken')">${badge}</span>`}
 const S=window.SCOUT;const id='g'+(uid++);
 const [bg,bg2,acc,ink]=spec.colors||S.PALETTES[spec.pal||0];
 const light=ink.toLowerCase()>'#c'||/^#f/.test(ink);
 const head=wrap(spec.headline,spec.layout==='text'?7:9);
 const defs=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${acc}"/><stop offset="1" stop-color="${ink}" stop-opacity=".9"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/></linearGradient><clipPath id="${id}c"><rect width="400" height="500"/></clipPath></defs>`;
 const prod=(x,y,s)=>spec.img?`<image href="${esc(spec.img)}" x="${x-110*s}" y="${y-110*s}" width="${220*s}" height="${220*s}" preserveAspectRatio="xMidYMid meet"/>`:shape(spec.shape,x,y,s,acc,ink,id);
 const pill=(x,y,anchor='middle',fg='#fff',bgc=ink)=>{const t=String(spec.cta||'').slice(0,18);const w=t.length*15+36;const x0=anchor==='middle'?x-w/2:x;return `<rect x="${x0}" y="${y-26}" width="${w}" height="38" rx="19" fill="${bgc}"/><text x="${x0+w/2}" y="${y}" font-size="16" font-weight="700" fill="${fg}" text-anchor="middle" font-family="Noto Sans KR,sans-serif">${esc(t)}</text>`};
 let body='';
 switch(spec.layout){
  case'split':body=`<rect width="400" height="500" fill="url(#${id}b)"/><rect width="190" height="500" fill="${acc}"/>${lines(wrap(spec.headline,5),24,120,28,'#fff')}${prod(296,270,.95)}${pill(24,440,'start',acc,'#fff')}`;break;
  case'bottom':body=`<rect width="400" height="500" fill="url(#${id}b)"/><circle cx="200" cy="200" r="150" fill="${bg2}"/>${prod(200,200,1.25)}<rect y="352" width="400" height="148" fill="${ink}"/>${lines(head.slice(0,2),28,400,26,light?'#111':'#fff')}${pill(28,470,'start',ink,acc)}`;break;
  case'grid':body=`<rect width="400" height="500" fill="${bg}"/>${[[100,110],[300,110],[100,290],[300,290]].map(([x,y],i)=>`<rect x="${x-90}" y="${y-80}" width="180" height="168" rx="14" fill="${i%3?bg2:'#fff'}"/>${prod(x,y,.62)}`).join('')}${lines(head.slice(0,1),24,420,24,ink)}${pill(24,470,'start')}`;break;
  case'text':body=`<rect width="400" height="500" fill="${acc}"/>${lines(head,30,110,44,'#fff','start',900)}${prod(318,410,.6)}${pill(30,460,'start',acc,'#fff')}`;break;
  case'person':body=`<rect width="400" height="500" fill="url(#${id}b)"/>${person(150,250,'#f0c9ad',acc)}${prod(300,330,.7)}<rect x="20" y="24" width="${Math.min(360,head[0].length*19+40)}" height="46" rx="23" fill="#fff"/><text x="40" y="54" font-size="18" font-weight="700" fill="#111" font-family="Noto Sans KR,sans-serif">${esc(head[0])}</text>${pill(200,476)}`;break;
  default:body=`<rect width="400" height="500" fill="url(#${id}b)"/><circle cx="200" cy="300" r="120" fill="${bg2}"/>${lines(head.slice(0,2),200,78,30,ink,'middle')}${prod(200,300,1)}${pill(200,470)}`;
 }
 const badge=spec.media==='video'?`<circle cx="362" cy="38" r="20" fill="#000" opacity=".55"/><path d="M355 28 L373 38 L355 48 Z" fill="#fff"/>`:spec.media==='carousel'?`<g fill="#fff">${[0,1,2].map(i=>`<circle cx="${184+i*16}" cy="492" r="4" opacity="${i?'.5':'1'}"/>`).join('')}</g>`:'';
 const logo=spec.brand?`<text x="${spec.layout==='split'?24:380}" y="${spec.layout==='person'?96:30}" font-size="13" font-weight="700" fill="${spec.layout==='split'?'#fff':ink}" opacity=".8" text-anchor="${spec.layout==='split'?'start':'end'}" font-family="Noto Sans KR,sans-serif">${esc(spec.brand)}</text>`:'';
 return `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(spec.headline)}">${defs}<g clip-path="url(#${id}c)">${body}${spec.media==='video'||spec.layout==='person'?'':logo}${badge}</g></svg>`;
}
function contentSpec(c){const S=window.SCOUT;const b=S.brandById[c.brand]||{name:''};const p=S.productById[c.product]||{shape:'box'};return{thumb:c.thumb,layout:c.layout||'center',pal:c.pal,shape:p.shape,headline:c.headline,cta:c.cta,brand:b.name,media:c.media}}
/* 색 히스토그램(유사 이미지 검색용): 12 색상 + 3 명도 */
function hexRgb(h){const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]}
function binOf(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/510,d=mx-mn;if(d<28)return 12+(l<.33?0:l<.7?1:2);let h;if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360;return Math.floor(h/30)}
function paletteHist(c){if(c.hist&&c.hist.length===15)return c.hist;if(c.thumb&&!c.demo)return new Array(15).fill(1/15);const S=window.SCOUT;const[bg,bg2,acc,ink]=S.PALETTES[c.pal];const h=new Array(15).fill(0);const wt=c.layout==='text'?[[acc,.7],[bg,.1],[ink,.2]]:c.layout==='split'?[[acc,.45],[bg,.3],[bg2,.15],[ink,.1]]:[[bg,.35],[bg2,.3],[acc,.2],[ink,.15]];for(const[col,w]of wt){const[r,g,b]=hexRgb(col);h[binOf(r,g,b)]+=w}return h}
function imageHist(data){const h=new Array(15).fill(0);let n=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;h[binOf(data[i],data[i+1],data[i+2])]++;n++}return h.map(v=>v/(n||1))}
function histSim(a,b){let s=0;for(let i=0;i<a.length;i++)s+=Math.min(a[i],b[i]);return s}
window.CREATIVE={creative,contentSpec,paletteHist,imageHist,histSim,esc};
})();
