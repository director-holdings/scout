/* 1. 레퍼런스 검색 · 3. 카피 트렌드 */
(function(){
const A=window.APP,S=A.S,C=A.C,esc=A.esc;
A.ss={mode:'text',q:'',plats:[],status:'all',industry:'all',media:'all',sort:'recent',layout:null,hist:null,img:null,simRef:null,randomIds:null,limit:36};
const match=(txt,q)=>{txt=txt.toLowerCase();return q.toLowerCase().split(/\s+/).filter(Boolean).every(t=>txt.includes(t))};
A.filterBase=(o)=>S.CONTENTS.filter(c=>(!o.plats||!o.plats.length||o.plats.includes(c.platform))&&(!o.industry||o.industry==='all'||c.industry===o.industry)&&(!o.media||o.media==='all'||c.media===o.media)&&(!o.status||o.status==='all'||(o.status==='live'?c.isAd&&c.active:o.status==='ended'?c.isAd&&!c.active:!c.isAd))&&(!o.brand||c.brand===o.brand));
A.textSearch=(L,q)=>q?L.filter(c=>match(c.headline+' '+c.body+' '+c.transcript+' '+S.brandById[c.brand].name+' '+S.productById[c.product].name+' '+c.tags.join(' '),q)):L;
A.searchList=()=>{const s=A.ss;let L=A.filterBase(s),score=null;
 if(s.randomIds)return{L:s.randomIds.map(id=>S.contentById[id]).filter(c=>L.includes(c)),score};
 if(s.mode==='text'||s.mode==='creator')L=A.textSearch(L,s.q);
 if(s.mode==='dialogue')L=L.filter(c=>c.transcript&&(!s.q||match(c.transcript,s.q)));
 if(s.mode==='layout'&&s.layout)L=L.filter(c=>c.layout===s.layout);
 if(s.mode==='image'&&(s.hist||s.simRef)){const ref=s.simRef&&S.contentById[s.simRef];const h=s.hist||C.paletteHist(ref);score={};
  L=L.filter(c=>c.id!==s.simRef).map(c=>{let v=C.histSim(h,C.paletteHist(c));if(ref)v=v*.6+(c.layout===ref.layout?.2:0)+(S.productById[c.product].shape===S.productById[ref.product].shape?.12:0)+(c.industry===ref.industry?.08:0);score[c.id]=v;return c}).sort((a,b)=>score[b.id]-score[a.id]);return{L,score}}
 const key={recent:c=>c.ago,views:c=>-c.views,likes:c=>-c.likes,run:c=>-(c.isAd?(c.active?c.ago:c.run):-1)}[s.sort];L=L.slice().sort((a,b)=>key(a)-key(b));return{L,score}};
const recTerms=()=>S.TERMS.map(t=>({t,n:S.termSeries(t).slice(-4).reduce((a,b)=>a+b,0)})).sort((a,b)=>b.n-a.n).slice(0,8).map(o=>o.t);
const sel=(name,val,opts)=>`<label class="sel"><span>${opts[0]}</span><select data-ch="sf" name="${name}">${opts[1].map(([k,l])=>`<option value="${k}"${k===val?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
const MODES=[['text','텍스트·카피'],['image','이미지'],['layout','레이아웃'],['dialogue','영상 대사'],['creator','크리에이터별']];

A.views.search=()=>{const s=A.ss;const{L,score}=A.searchList();
 let input='';
 if(s.mode==='image'){const ref=s.simRef&&S.contentById[s.simRef];input=`<div class="imgq">${s.img?`<img src="${esc(s.img)}" alt="올린 이미지">`:ref?`<div class="mini">${C.creative(C.contentSpec(ref))}</div>`:''}<label class="drop">${A.icon('upload',22)}<b>이미지를 올리면 색감·구성이 비슷한 소재를 찾아요</b><span>PNG, JPG · 이미지는 브라우저 안에서만 분석돼요</span><input type="file" accept="image/*" data-ch="img"></label></div>${!s.hist&&!ref?`<p class="muted">또는 샘플 소재로 해보기</p><div class="minirow">${S.CONTENTS.filter((c,i)=>i%37===3).slice(0,6).map(c=>`<button class="mini" data-act="simsearch" data-id="${c.id}" aria-label="${esc(c.headline)}로 유사 검색">${C.creative(C.contentSpec(c))}</button>`).join('')}</div>`:''}`}
 else if(s.mode==='layout'){input=`<div class="layouts">${Object.entries(S.LAYOUTS).map(([k,l],i)=>`<button class="lay" aria-pressed="${s.layout===k}" data-act="layout" data-k="${k}"><span class="mini">${C.creative({layout:k,pal:[1,0,3,5,6,7][i],shape:'bottle',headline:'카피 예시 문구',cta:'자세히 보기'})}</span>${esc(l)}</button>`).join('')}</div>`}
 else input=`<form class="sbar" data-form="search"><span>${A.icon('search',20)}</span><input name="q" value="${esc(s.q)}" placeholder="${s.mode==='dialogue'?'영상 속 대사로 검색 · 예) 건조해서, 발이 안 아파요':s.mode==='creator'?'키워드로 찾고 크리에이터별로 묶어보기':'카피, 브랜드, 제품으로 검색 · 예) 촉촉 크림'}" aria-label="검색어"><button class="btn pri">검색</button></form>`;
 const top=`<div class="row wrap gap chips">${!s.q&&s.mode!=='image'&&s.mode!=='layout'?`<span class="lbl">추천</span>${recTerms().map(t=>`<button class="chip" data-act="term" data-k="${esc(t)}">${esc(t)}</button>`).join('')}`:''}${A.st.history.length&&s.mode!=='image'&&s.mode!=='layout'?`<span class="lbl">최근</span>${A.st.history.slice(0,5).map((h,i)=>`<span class="chip hist"><button data-act="term" data-k="${esc(h)}">${esc(h)}</button><button data-act="delHist" data-i="${i}" aria-label="삭제">×</button></span>`).join('')}`:''}</div>`;
 const filters=`<div class="filters"><div class="chips">${Object.entries(S.PLATFORMS).map(([k,l])=>`<button class="chip p-${k}c" aria-pressed="${s.plats.includes(k)}" data-act="plat" data-k="${k}">${l}</button>`).join('')}</div><div class="row wrap gap">${sel('status',s.status,['상태',[['all','전체'],['live','진행 중 광고'],['ended','종료된 광고'],['post','일반 게시물']]])}${sel('industry',s.industry,['업종',[['all','전체'],...Object.entries(S.INDUSTRIES)]])}${sel('media',s.media,['형식',[['all','전체'],['image','이미지'],['video','영상'],['carousel','캐러셀']]])}${s.mode!=='image'?sel('sort',s.sort,['정렬',[['recent','최신순'],['views','조회순'],['likes','좋아요순'],['run','오래 게재된 광고순']]]):''}</div></div>`;
 let results;
 if(s.mode==='creator'){const g={};for(const c of L)if(c.creator)(g[c.creator]=g[c.creator]||[]).push(c);const rows=Object.entries(g).sort((a,b)=>b[1].length-a[1].length).slice(0,20);
  results=rows.length?`<div class="cgroups">${rows.map(([id,list])=>{const cr=S.creatorById[id];return `<section class="cgroup"><header><button class="link" data-act="gocreator" data-id="${id}"><b>${esc(cr.handle)}</b></button><span class="muted">${esc(S.INDUSTRIES[cr.industry])} · 팔로워 ${A.fmt(cr.followers)} · 참여율 ${cr.er}% · 매칭 ${list.length}개</span></header><div class="grid sm">${list.slice(0,4).map(c=>A.card(c)).join('')}</div></section>`}).join('')}</div>`:`<div class="empty">크리에이터 콘텐츠가 없어요.</div>`}
 else results=A.grid(L.slice(0,s.limit),score&&(c=>`<div class="score">유사도 ${Math.round(Math.min(.99,score[c.id])*100)}%</div>`))+(L.length>s.limit?`<div class="center"><button class="btn" data-act="more">더 보기 (${L.length-s.limit}개 남음)</button></div>`:'');
 return `<div class="page"><header class="ph"><div><h1>레퍼런스 검색</h1><p class="muted">5개 플랫폼의 광고와 콘텐츠 ${S.CONTENTS.length.toLocaleString()}개를 한 번에 찾아요</p></div><button class="btn" data-act="random">${A.icon('shuffle',16)}랜덤 탐색</button></header>
 ${A.tabs('mode',MODES,s.mode)}<div class="sq">${input}</div>${top}${filters}
 <div class="tagrow"><span class="lbl">태그로 탐색</span>${Object.entries(S.INDUSTRIES).map(([k,l])=>`<button class="chip sm" aria-pressed="${s.industry===k}" data-act="tagInd" data-k="${k}">#${l}</button>`).join('')}${Object.entries(S.LAYOUTS).map(([k,l])=>`<button class="chip sm" data-act="tagLay" data-k="${k}">#${l}</button>`).join('')}</div>
 <div class="rhead"><b>${s.randomIds?'랜덤 탐색 결과':s.mode==='image'&&!s.hist&&!s.simRef?'최근 수집된 레퍼런스':'검색 결과'}</b><span class="muted">${s.mode==='creator'?'':L.length.toLocaleString()+'개'}</span>${s.randomIds||s.simRef||s.hist||s.q||s.layout?`<button class="link" data-act="resetSearch">초기화</button>`:''}</div>${results}</div>`};

const rer=()=>A.render();
Object.assign(A.acts,{
 mode:t=>{Object.assign(A.ss,{mode:t.dataset.k,randomIds:null,limit:36});if(t.dataset.k!=='image'){A.ss.simRef=null;A.ss.hist=null}rer()},
 plat:t=>{const p=A.ss.plats,k=t.dataset.k;A.ss.plats=p.includes(k)?p.filter(x=>x!==k):[...p,k];A.ss.limit=36;rer()},
 term:t=>{A.ss.q=t.dataset.k;if(A.ss.mode!=='dialogue'&&A.ss.mode!=='creator')A.ss.mode='text';A.ss.randomIds=null;rer()},
 delHist:t=>{A.st.history.splice(+t.dataset.i,1);A.save('history');rer()},
 layout:t=>{A.ss.layout=A.ss.layout===t.dataset.k?null:t.dataset.k;rer()},
 tagInd:t=>{A.ss.industry=A.ss.industry===t.dataset.k?'all':t.dataset.k;rer()},
 tagLay:t=>{Object.assign(A.ss,{mode:'layout',layout:t.dataset.k,randomIds:null});rer()},
 more:()=>{A.ss.limit+=36;rer()},
 random:()=>{const ids=S.CONTENTS.map(c=>c.id).sort(()=>Math.random()-.5).slice(0,24);Object.assign(A.ss,{randomIds:ids,mode:'text',q:''});rer()},
 resetSearch:()=>{Object.assign(A.ss,{q:'',layout:null,hist:null,img:null,simRef:null,randomIds:null,limit:36});rer()},
});
A.chs.sf=t=>{A.ss[t.name]=t.value;A.ss.limit=36;rer()};
A.chs.img=t=>{const f=t.files&&t.files[0];if(!f)return;const url=URL.createObjectURL(f);const im=new Image();im.onload=()=>{const cv=document.createElement('canvas');cv.width=cv.height=48;const x=cv.getContext('2d');x.drawImage(im,0,0,48,48);Object.assign(A.ss,{hist:C.imageHist(x.getImageData(0,0,48,48).data),img:url,simRef:null,randomIds:null});A.log('이미지로 유사 소재 검색');rer()};im.onerror=()=>A.toast('이미지를 읽지 못했어요');im.src=url};
A.forms.search=d=>{const q=(d.q||'').trim();A.ss.q=q;A.ss.randomIds=null;A.ss.limit=36;if(q){A.st.history=[q,...A.st.history.filter(h=>h!==q)].slice(0,10);A.save('history')}rer()};

/* ---------- 3. 카피 트렌드 ---------- */
A.ts={sel:['블랙프라이데이','겨울','여름'],industry:'all'};
const COLORS=['#1240e0','#ef5a2a','#2f8a52','#7a4fe0'];
A.views.trend=()=>{const t=A.ts;const base=t.industry==='all'?S.CONTENTS:S.CONTENTS.filter(c=>c.industry===t.industry);
 const series=t.sel.map((term,i)=>({name:term,color:COLORS[i],values:S.termSeries(term,base)}));
 const rows=[...new Set([...S.TERMS,...t.sel])].map(term=>{const s=S.termSeries(term,base);const a=s.slice(-4).reduce((x,y)=>x+y,0),b=s.slice(-8,-4).reduce((x,y)=>x+y,0);return{term,s,a,b,d:b?Math.round((a-b)/b*100):a?100:0}}).sort((x,y)=>y.d-x.d||y.a-x.a);
 const focus=t.sel[0];const fl=focus?base.filter(c=>(c.headline+' '+c.body+' '+c.transcript).includes(focus)).slice(0,12):[];
 const rising=rows.filter(r=>r.a>=3)[0];
 return `<div class="page"><header class="ph"><div><h1>카피 트렌드</h1><p class="muted">광고 카피에 쓰인 키워드가 주마다 몇 개 소재에 등장했는지 보여줘요</p></div>${sel('industry',t.industry,['업종',[['all','전체'],...Object.entries(S.INDUSTRIES)]]).replace('data-ch="sf"','data-ch="tInd"')}</header>
 ${rising?`<p class="lede">최근 4주 가장 빠르게 늘어난 키워드는 <b>‘${esc(rising.term)}’</b>이에요. 직전 4주보다 ${rising.d>0?'+':''}${rising.d}% (${rising.b}개 → ${rising.a}개)</p>`:''}
 <section class="panel"><div class="row wrap gap between"><div class="chips">${t.sel.map((s,i)=>`<span class="chip on" style="--c:${COLORS[i]}"><i></i>${esc(s)}<button data-act="tDel" data-k="${esc(s)}" aria-label="${esc(s)} 빼기">×</button></span>`).join('')}</div><form class="row gap" data-form="tAdd"><input name="q" placeholder="키워드 추가 (최대 4개)" maxlength="20"><button class="btn">비교</button></form></div>
 ${series.length?A.chart({labels:S.weekLabels,series,fmt:v=>Math.round(v)+'개'},280):'<div class="empty">키워드를 추가하세요</div>'}<p class="note">주별 신규 소재 수 · 최근 26주</p></section>
 <div class="two"><section class="panel"><h2>키워드 랭킹</h2><table class="tbl stack"><thead><tr><th>키워드</th><th class="r">최근 4주</th><th class="r">직전 4주</th><th class="r">증감</th><th>추이</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button class="link" data-act="tPick" data-k="${esc(r.term)}">${esc(r.term)}</button></td><td class="r">${r.a}</td><td class="r">${r.b}</td><td class="r ${r.d>0?'up':r.d<0?'down':''}">${r.d>0?'+':''}${r.d}%</td><td>${A.spark(r.s)}</td></tr>`).join('')}</tbody></table></section>
 <section class="panel"><h2>‘${esc(focus||'')}’ 포함 소재</h2>${fl.length?`<div class="grid sm">${fl.map(c=>A.card(c)).join('')}</div>`:'<div class="empty">해당 키워드 소재가 없어요</div>'}</section></div></div>`};
Object.assign(A.acts,{
 tDel:t=>{A.ts.sel=A.ts.sel.filter(x=>x!==t.dataset.k);rer()},
 tPick:t=>{const k=t.dataset.k;A.ts.sel=[k,...A.ts.sel.filter(x=>x!==k)].slice(0,4);rer()},
});
A.chs.tInd=t=>{A.ts.industry=t.value;rer()};
A.forms.tAdd=d=>{const q=(d.q||'').trim();if(!q)return;A.ts.sel=[q,...A.ts.sel.filter(x=>x!==q)].slice(0,4);rer()};
})();
