/* 서버에서 데이터를 받아 프로토타입과 같은 window.SCOUT 를 만든 뒤 화면 스크립트를 순서대로 불러온다 */
(async function(){
const SCRIPTS=['creative.js','core.js','v-search.js','v-intel.js','v-work.js','v-settings.js'];
const DAY=864e5;
const INDUSTRIES={beauty:'뷰티',fashion:'패션',food:'식품',living:'리빙',health:'헬스',tech:'테크'};
const PLATFORMS={instagram:'Instagram',meta:'Meta 광고',tiktok:'TikTok',youtube:'YouTube',google:'Google 광고'};
const LAYOUTS={center:'중앙 제품',split:'좌우 분할',bottom:'하단 텍스트',grid:'그리드',text:'타이포 중심',person:'인물 UGC'};
const PALETTES=[['#fbe9e4','#f6cfc4','#d9634c','#3a1d17'],['#eef2ff','#c9d4ff','#1240e0','#0a1240'],['#f4f1ea','#e2d9c5','#8a6a3b','#2a2117'],['#e7f4ec','#bfe3cb','#2f8a52','#10301c'],['#1b1d29','#2c3046','#7aa2ff','#f2f4ff'],['#fff6d8','#ffe38a','#e0a100','#3a2c00'],['#f1e9ff','#d9c6ff','#7a4fe0','#24124f'],['#ffece6','#ffb79f','#ef5a2a','#3d1408'],['#e8f6fb','#b5e2f2','#1592b8','#062c38'],['#efefef','#d4d4d4','#111111','#111111'],['#ffe9f1','#ffc0d6','#e0336f','#40101f'],['#eaf0e1','#cfdcb8','#5f7d2c','#1f2a0d']];
const TERMS_DEFAULT=['촉촉','물광','저자극','비건','1+1','무료배송','할인','블랙프라이데이','겨울','한정','리뷰','단독','신상','선물','저당','단백질','여름','품절'];
const WEEKS=26;

const view=document.getElementById('view');
const fail=msg=>{view.innerHTML=`<div class="page"><h1>불러오지 못했어요</h1><p class="lede">${msg}</p><button class="btn pri" onclick="location.reload()">다시 시도</button></div>`};
let D;
try{const r=await fetch('/api/bootstrap',{credentials:'same-origin'});if(r.status===401){location.href='/login.html';return}if(!r.ok)throw new Error(r.status);D=await r.json()}
catch(e){fail('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요. ('+e.message+')');return}

const p=D.today.split('-').map(Number),TODAY=new Date(p[0],p[1]-1,p[2]);
const BRANDS=D.brands.filter(b=>!b.hidden);
const CONTENTS=D.contents.map(c=>({...c,start:new Date(TODAY-c.ago*DAY)}));
const brandById=Object.fromEntries(D.brands.map(b=>[b.id,b]));
const TERMS=(D.state.terms&&D.state.terms.length?D.state.terms:TERMS_DEFAULT);
function termSeries(term,list=CONTENTS){const s=new Array(WEEKS).fill(0);for(const c of list){if((c.headline+' '+c.body+' '+c.transcript).includes(term)){const w=WEEKS-1-Math.floor(c.ago/7);if(w>=0)s[w]++}}return s}
const weekLabels=Array.from({length:WEEKS},(_,i)=>{const d=new Date(TODAY-(WEEKS-1-i)*7*DAY);return(d.getMonth()+1)+'/'+d.getDate()});
const MEMBERS=(D.demoMembers&&D.demoMembers.length?D.demoMembers:[]).map(m=>({...m}));

window.SCOUT={TODAY,DAY,INDUSTRIES,PLATFORMS,LAYOUTS,BRANDS,brandById,CONTENTS,CREATORS:D.creators,STORES:D.stores,PALETTES,TERMS,WEEKS,termSeries,weekLabels,MEMBERS,
 contentById:Object.fromEntries(CONTENTS.map(c=>[c.id,c])),creatorById:Object.fromEntries(D.creators.map(c=>[c.id,c])),
 productById:Object.fromEntries(D.brands.flatMap(b=>b.products).map(p=>[p.id,p])),storeById:Object.fromEntries(D.stores.map(s=>[s.id,s]))};

/* 서버에 저장된 팀 공용 상태 정리: 지워진 콘텐츠·브랜드를 가리키는 항목 제거 */
const st=D.state,S=window.SCOUT;
if(Array.isArray(st.nodes))for(const n of st.nodes)if(n.items)n.items=n.items.filter(i=>!i.cid||S.contentById[i.cid]);
if(Array.isArray(st.tracked))st.tracked=st.tracked.filter(id=>S.brandById[id]);
if(Array.isArray(st.creatorFolders))for(const f of st.creatorFolders)f.ids=f.ids.filter(id=>S.creatorById[id]);
if(Array.isArray(st.favStores))st.favStores=st.favStores.filter(id=>S.storeById[id]);
window.SCOUT_STATE=st;window.SCOUT_ME=D.me;

for(const src of SCRIPTS)await new Promise((ok,no)=>{const s=document.createElement('script');s.src=src+'?v='+(window.SCOUT_VER||'');s.onload=ok;s.onerror=()=>no(new Error(src));document.head.appendChild(s)}).catch(e=>{fail('화면 파일을 불러오지 못했어요: '+e.message);throw e});
window.APP.init();
})();
