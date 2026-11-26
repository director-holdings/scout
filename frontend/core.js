/* 앱 공통: 상태, 라우팅, 차트, 모달, 카드 */
(function(){
const S=window.SCOUT,C=window.CREATIVE,esc=C.esc;
const A=window.APP={S,C,esc,views:{},acts:{},ins:{},chs:{}};
A.$=(s,r=document)=>r.querySelector(s);A.$$=(s,r=document)=>[...r.querySelectorAll(s)];
A.fmt=n=>{n=Math.round(n);return Math.abs(n)>=1e8?(n/1e8).toFixed(1)+'억':Math.abs(n)>=1e4?(n/1e4).toFixed(Math.abs(n)>=1e5?0:1)+'만':n.toLocaleString('ko-KR')};
A.fdate=d=>{d=new Date(d);return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0')};
A.uid=()=>Math.random().toString(36).slice(2,9);
/* 팀 공용 상태: 서버에 저장 (예전 프로토타입은 브라우저에만 저장했음) */
A.me=window.SCOUT_ME||'나';
const ST=window.SCOUT_STATE||{},_tm={};
A.LS={get(k,d){return k in ST?ST[k]:d},set(k,v){ST[k]=v;clearTimeout(_tm[k]);_tm[k]=setTimeout(()=>fetch('/api/state/'+k,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(v)}).then(r=>{if(r.status===401)location.href='/login.html';else if(!r.ok)throw 0}).catch(()=>A.toast('저장하지 못했어요. 인터넷 연결을 확인하세요')),400)}};
A.api=async(path,opt={})=>{const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opt,body:opt.body&&typeof opt.body!=='string'?JSON.stringify(opt.body):opt.body});if(r.status===401){location.href='/login.html';throw new Error('login')}const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||('오류 '+r.status));return d};

/* ---------- 상태 ---------- */
const pickIds=(f,n)=>S.CONTENTS.filter(f).slice(0,n).map(c=>({id:A.uid(),cid:c.id,memos:[],at:Date.now()}));
const defaultNodes=[
 {id:'f1',type:'folder',name:'26 겨울 캠페인',parent:null},
 {id:'b1',type:'board',name:'수분 크림 무드',parent:'f1',fav:true,items:pickIds(c=>c.industry==='beauty'&&c.layout!=='text',6)},
 {id:'b2',type:'board',name:'블프 프로모션 카피',parent:'f1',items:pickIds(c=>c.cta.includes('블랙'),5)},
 {id:'b3',type:'board',name:'UGC 영상 레퍼런스',parent:null,shared:true,share:'k'+A.uid(),items:pickIds(c=>c.layout==='person'&&c.media==='video',5)},
];
defaultNodes[1].items[0].memos=[{by:'이준호',text:'@박서연 이 톤으로 상세페이지 첫 화면 잡아보면 좋겠어요',at:Date.now()-36e5*5}];
A.st={
 nodes:A.LS.get('nodes',defaultNodes),
 tracked:A.LS.get('tracked',['ondo','lumi','dfit','milky','green']),
 history:A.LS.get('history',['수분 크림','블랙프라이데이','러닝화']),
 favStores:A.LS.get('favStores',['glow']),
 creatorFolders:A.LS.get('creatorFolders',[{id:'cf1',name:'뷰티 협업 후보',ids:['c0','c6','c12']}]),
 feedViews:A.LS.get('feedViews',[{id:'fv1',name:'뷰티 신규 광고',platform:'meta',industry:'beauty'}]),
 kit:A.LS.get('kit',{name:'온도스킨',colors:['#fbe9e4','#d9634c','#3a1d17'],tone:'다정하고 짧게, 피부 고민에 공감하는 말투',logo:''}),
 members:A.LS.get('members',S.MEMBERS.length?S.MEMBERS:[]),
 invites:A.LS.get('invites',[]),
 groups:A.LS.get('groups',['브랜드마케팅','퍼포먼스','콘텐츠','외부 대행사']),
 credits:A.LS.get('credits',{used:9500,total:20000}),
 plan:A.LS.get('plan','Pro'),
 ws:A.LS.get('ws','Scout 마케팅팀'),
 activity:A.LS.get('activity',[{t:Date.now()-72e5,by:'박서연',what:'‘수분 크림 무드’ 보드에 콘텐츠 2개 저장'},{t:Date.now()-26e6,by:'이준호',what:'브랜드 ‘데일리핏’ 아카이브 추가'}]),
};
if(!A.st.members.some(m=>m.name===A.me)){A.st.members.push({id:'u'+A.uid(),name:A.me,email:'',role:A.st.members.length?'멤버':'관리자',group:A.st.groups[0]});setTimeout(()=>A.save('members'))}
A.save=(...keys)=>{for(const k of keys)A.LS.set(k,A.st[k])};
A.log=what=>{A.st.activity.unshift({t:Date.now(),by:A.me,what});A.st.activity=A.st.activity.slice(0,40);A.save('activity')};
A.spend=(n,what)=>{A.log(what);return true};
A.boards=()=>A.st.nodes.filter(n=>n.type==='board'&&!n.trashed);

/* ---------- 아이콘 ---------- */
const IC={settings:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',trend:'M3 17l6-6 4 4 8-8M15 7h6v6',brands:'M4 20V8l8-4 8 4v12M9 20v-6h6v6',stores:'M4 9h16l-1 11H5L4 9zm4 0V7a4 4 0 0 1 8 0v2',creators:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',boards:'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',feed:'M4 6h16M4 12h16M4 18h10',studio:'M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z',workspace:'M3 7h18v13H3zM8 7V4h8v3',bookmark:'M6 4h12v17l-6-4-6 4z',bell:'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',close:'M6 6l12 12M18 6 6 18',plus:'M12 5v14M5 12h14',star:'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z',back:'M15 5l-7 7 7 7',upload:'M12 16V4m-5 5 5-5 5 5M4 20h16',link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',trash:'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',folder:'M3 6h6l2 2h10v11H3z',send:'M4 12l16-8-6 16-3-7z',shuffle:'M4 7h4l8 10h4M4 17h4l2-2.5M14 9.5 16 7h4M18 5l2 2-2 2M18 15l2 2-2 2'};
A.icon=(k,s=18)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[k]||''}"/></svg>`;

/* ---------- 차트 ---------- */
const charts=new Map();let cid=0;
A.chart=(spec,h=240)=>{const k='ch'+(cid++);charts.set(k,spec);return `<div class="fig" style="min-height:${h}px" data-chart="${k}"><svg></svg></div>`};
A.legend=series=>`<div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
const fmtS=v=>Math.abs(v)>=1e4?A.fmt(v):(Math.round(v*10)/10).toString();
function drawLine(svg,sp){const W=svg.clientWidth,H=svg.clientHeight;if(!W||!H)return;const small=W<520,L=small?34:46,Rr=14,T=12,B=26,n=sp.labels.length;
 const vals=sp.series.flatMap(s=>s.values);let mx=Math.max(...vals),mn=sp.zero===false?Math.min(...vals):0;if(mx===mn)mx=mn+1;const pad=(mx-mn)*.08;if(sp.zero===false)mn-=pad;mx+=pad;
 const x=i=>L+(W-L-Rr)*(n<2?.5:i/(n-1)),y=v=>sp.invert?T+(H-T-B)*(v-mn)/(mx-mn):H-B-(H-T-B)*(v-mn)/(mx-mn);
 let g='';const tk=small?2:3;for(let k=0;k<=tk;k++){const v=mn+(mx-mn)*k/tk,yy=y(v);g+=`<line x1="${L}" x2="${W-Rr}" y1="${yy}" y2="${yy}" class="gl"/><text x="${L-6}" y="${yy+4}" text-anchor="end" class="tk">${esc((sp.fmt||fmtS)(v))}</text>`}
 const step=Math.ceil(n/(small?4:8));for(let i=0;i<n;i+=step)g+=`<text x="${x(i)}" y="${H-7}" text-anchor="middle" class="tk">${esc(sp.labels[i])}</text>`;
 if(sp.bars){const bw=Math.max(2,(W-L-Rr)/n*.62);for(const s of sp.series)s.values.forEach((v,i)=>{g+=`<rect x="${x(i)-bw/2}" y="${y(v)}" width="${bw}" height="${Math.max(0,H-B-y(v))}" rx="2" fill="${s.color}"/>`})}
 else for(const s of sp.series){const pts=s.values.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');if(sp.area&&sp.series.length===1)g+=`<polygon points="${x(0)},${H-B} ${pts} ${x(n-1)},${H-B}" fill="${s.color}" opacity=".13"/>`;g+=`<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(n-1)}" cy="${y(s.values[n-1])}" r="3.5" fill="${s.color}"/>`}
 svg.innerHTML=g}
A.mountCharts=root=>{for(const f of A.$$('.fig[data-chart]',root)){const sp=charts.get(f.dataset.chart);if(!sp||f._m)continue;f._m=1;charts.delete(f.dataset.chart);const svg=f.querySelector('svg');const draw=()=>drawLine(svg,sp);const ro=new ResizeObserver(draw);ro.observe(f);draw()}};
A.bars=(rows,fmt=A.fmt)=>{const mx=Math.max(...rows.map(r=>r.value),1);return `<div class="bars">${rows.map(r=>`<div class="bar"><span class="bl">${esc(r.label)}</span><span class="bt"><i style="width:${(r.value/mx*100).toFixed(1)}%;${r.color?'background:'+r.color:''}"></i></span><span class="bv">${esc(fmt(r.value))}</span></div>`).join('')}</div>`};
A.spark=(vals,color='var(--acc)')=>{const mx=Math.max(...vals,1),mn=Math.min(...vals),n=vals.length;const pts=vals.map((v,i)=>(i/(n-1)*100).toFixed(1)+','+(28-(v-mn)/((mx-mn)||1)*24).toFixed(1)).join(' ');return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`};
A.kpi=(label,value,note='')=>`<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b>${note?`<em>${esc(note)}</em>`:''}</div>`;
A.tabs=(act,items,cur)=>`<div class="tabs" role="tablist">${items.map(([k,l])=>`<button role="tab" aria-selected="${k===cur}" data-act="${act}" data-k="${k}">${esc(l)}</button>`).join('')}</div>`;

/* ---------- 모달·토스트 ---------- */
A.modal=(html,cls='')=>{const m=A.$('#modal');m.className='on '+cls;m.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><button class="mx" data-act="close" aria-label="닫기">${A.icon('close')}</button>${html}</div>`;A.mountCharts(m);const f=m.querySelector('input,textarea,button:not(.mx)');if(f&&m.dataset.focus!=='no')f.focus({preventScroll:true})};
A.close=()=>{const m=A.$('#modal');m.className='';m.innerHTML=''};
A.toast=msg=>{const t=A.$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(A._tt);A._tt=setTimeout(()=>t.classList.remove('on'),2600)};

/* ---------- 콘텐츠 카드 ---------- */
A.status=c=>c.isAd?(c.active?`<span class="st on">게재 ${c.ago+1}일째</span>`:`<span class="st off">종료 · ${c.run}일 게재</span>`):`<span class="st">게시물</span>`;
A.thumb=c=>`<div class="thumb">${C.creative(C.contentSpec(c))}<span class="plat p-${c.platform}">${S.PLATFORMS[c.platform]}</span></div>`;
A.card=(c,extra='')=>{const b=S.brandById[c.brand];return `<article class="card" data-act="open" data-id="${c.id}" tabindex="0">${A.thumb(c)}<button class="save" data-act="save" data-id="${c.id}" aria-label="보드에 저장">${A.icon('bookmark',16)}</button><div class="meta"><b>${esc(b.name)}</b>${A.status(c)}</div><p class="hl">${esc(c.headline)}</p><div class="nums">${c.views?A.fmt(c.views)+' 조회 · ':''}${A.fmt(c.likes)} 좋아요${c.views?'':' · '+A.fmt(c.comments)+' 댓글'}</div>${extra}</article>`};
A.grid=(list,extra)=>list.length?`<div class="grid">${list.map(c=>A.card(c,extra&&extra(c))).join('')}</div>`:`<div class="empty">조건에 맞는 레퍼런스가 없어요. 필터를 줄여보세요.</div>`;
A.similar=(c,n=6)=>{const h=C.paletteHist(c);return S.CONTENTS.filter(x=>x.id!==c.id).map(x=>({x,s:C.histSim(h,C.paletteHist(x))+(c.layout&&x.layout===c.layout?.35:0)+(c.layout&&(S.productById[x.product]||{}).shape===(S.productById[c.product]||{}).shape?.25:0)+(x.industry===c.industry?.15:0)})).sort((a,b)=>b.s-a.s).slice(0,n).map(o=>o.x)};

/* ---------- 상세 모달 (2. 콘텐츠 상세 분석) ---------- */
A.openDetail=id=>{const c=S.contentById[id];if(!c)return;const b=S.brandById[c.brand],p=S.productById[c.product]||{name:'제품 미지정'},cr=c.creator&&S.creatorById[c.creator],st=S.storeById[c.store]||{name:'판매처 미지정'};
 const days=Array.from({length:30},(_,i)=>{const d=new Date(S.TODAY-(29-i)*S.DAY);return(d.getMonth()+1)+'/'+d.getDate()});
 A.modal(`<div class="detail"><div class="dimg">${C.creative(C.contentSpec(c))}</div><div class="dinfo">
 <div class="row gap"><span class="plat p-${c.platform} inl">${S.PLATFORMS[c.platform]}</span>${A.status(c)}</div>
 <h2>${esc(c.headline)}</h2><p class="muted">${esc(c.body)}</p>
 ${c.transcript?`<blockquote class="script"><span>영상 대사</span>${esc(c.transcript)}</blockquote>`:''}
 <dl class="facts"><dt>브랜드</dt><dd><a href="#brands" data-act="gobrand" data-id="${b.id}">${esc(b.name)}</a></dd><dt>제품</dt><dd>${esc(p.name)}</dd><dt>${c.isAd?'게재 시작':'게시일'}</dt><dd>${A.fdate(c.start)}</dd>${cr?`<dt>크리에이터</dt><dd><a href="#creators" data-act="gocreator" data-id="${cr.id}">${esc(cr.handle)}</a></dd>`:''}<dt>판매처</dt><dd>${esc(st.name)}</dd><dt>조회 · 좋아요 · 댓글</dt><dd>${c.views?A.fmt(c.views):'–'} · ${A.fmt(c.likes)} · ${A.fmt(c.comments)}</dd>${c.savedBy?`<dt>저장한 사람</dt><dd>${esc(c.savedBy)}</dd>`:''}${c.url?`<dt>원본</dt><dd><a href="${esc(c.url)}" target="_blank" rel="noopener">원본 보기 ↗</a></dd>`:''}</dl>
 <div class="chips">${c.tags.map(t=>`<span class="chip sm">${esc(t)}</span>`).join('')}</div>
 <div class="row wrap gap"><button class="btn pri" data-act="save" data-id="${c.id}">${A.icon('bookmark',16)}보드에 저장</button><button class="btn" data-act="simsearch" data-id="${c.id}">유사 이미지 검색</button></div>
 <h3>노출 순위 변화 <small>최근 30일 · 낮을수록 상위</small></h3>${c.rank.length?A.chart({labels:days,series:[{name:'순위',color:'var(--acc)',values:c.rank}],invert:true,zero:false,fmt:v=>Math.round(v)+'위'},170):'<p class="note">이틀 이상 수집되면 그래프가 나타나요</p>'}
 ${c.ages.length?`<h3>타깃 연령 점수</h3>${A.bars(['10대','20대','30대','40대','50대+'].map((l,i)=>({label:l,value:c.ages[i]})),v=>v+'점')}`:''}
 </div></div><h3 class="simh">비슷한 레퍼런스</h3><div class="grid sm">${A.similar(c).map(x=>A.card(x)).join('')}</div>`,'wide')};

/* ---------- 보드에 저장 ---------- */
A.saveItem=(boardId,item)=>{const b=A.st.nodes.find(n=>n.id===boardId);if(!b)return;if(item.cid&&b.items.some(i=>i.cid===item.cid)){A.toast('이미 ‘'+b.name+'’에 있어요');return}b.items.unshift({id:A.uid(),memos:[],at:Date.now(),...item});A.save('nodes');A.log('‘'+b.name+'’ 보드에 저장');A.toast('‘'+b.name+'’에 저장했어요')};
A.openSave=item=>{A._pendingSave=item;A.modal(`<h2>보드에 저장</h2><div class="blist">${A.boards().map(b=>`<button class="bitem" data-act="saveTo" data-id="${b.id}">${A.icon('boards',16)}<span>${esc(b.name)}</span><em>${b.items.length}개</em></button>`).join('')}</div><form class="row gap" data-form="newBoardSave"><input name="n" placeholder="새 보드 이름" required maxlength="40"><button class="btn pri">만들고 저장</button></form>`)};

/* ---------- 레이아웃·라우팅 ---------- */
const NAV=[['search','레퍼런스 검색'],['trend','카피 트렌드'],['brands','브랜드 아카이브'],['stores','스토어 분석'],['creators','인플루언서'],['boards','레퍼런스 보드'],['feed','피드'],['workspace','워크스페이스'],['settings','연동 설정']];
A.cur='search';
A.topbar=()=>{const el=A.$('#credits');if(el)el.innerHTML=`<span>${esc(A.me)}</span><button class="link" data-act="logout">로그아웃</button>`;const w=A.$('#wsname');if(w)w.textContent=A.st.ws};
A.render=()=>{const h=location.hash.slice(1);A.cur=A.views[h]?h:'search';A.$$('.nav a').forEach(a=>a.setAttribute('aria-current',a.dataset.k===A.cur?'page':'false'));const v=A.$('#view');v.innerHTML=A.views[A.cur]();A.mountCharts(v);A.topbar();if(A.after){const f=A.after;A.after=null;f()}};
A.go=(k)=>{if(location.hash.slice(1)===k)A.render();else location.hash=k;A.$('#view').scrollTo?.(0,0);window.scrollTo(0,0)};
A.init=()=>{A.$('#nav').innerHTML=NAV.map(([k,l])=>`<a href="#${k}" data-k="${k}">${A.icon(k)}<span>${l}</span></a>`).join('');
 document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const f=A.acts[t.dataset.act];if(f){if(t.tagName==='A'||t.tagName==='BUTTON')e.preventDefault();e.stopPropagation();f(t,e)}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&A.$('#modal').classList.contains('on'))A.close();if(e.key==='Enter'&&e.target.matches('.card'))A.openDetail(e.target.dataset.id)});
 document.addEventListener('input',e=>{const t=e.target.closest('[data-in]');if(t&&A.ins[t.dataset.in])A.ins[t.dataset.in](t,e)});
 document.addEventListener('change',e=>{const t=e.target.closest('[data-ch]');if(t&&A.chs[t.dataset.ch])A.chs[t.dataset.ch](t,e)});
 document.addEventListener('submit',e=>{const f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();const fn=A.forms[f.dataset.form];if(fn)fn(Object.fromEntries(new FormData(f)),f)});
 A.$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')A.close()});
 window.addEventListener('hashchange',A.render);A.render()};
A.forms={};

/* 공통 액션 */
Object.assign(A.acts,{
 close:()=>A.close(),
 open:t=>A.openDetail(t.dataset.id),
 save:t=>A.openSave({cid:t.dataset.id}),
 saveTo:t=>{A.saveItem(t.dataset.id,A._pendingSave);A.close();if(A.cur==='boards')A.render()},
 gobrand:t=>{A.close();A.bs.sel=t.dataset.id;A.bs.tab='overview';if(!A.st.tracked.includes(t.dataset.id)){A.st.tracked.push(t.dataset.id);A.save('tracked')}A.go('brands')},
 gocreator:t=>{A.close();A.cs.sel=t.dataset.id;A.go('creators')},
 makeFrom:t=>{A.close();A.ai.tab='create';A.ai.ref=t.dataset.id;A.go('studio')},
 scriptFrom:t=>{A.close();A.ai.tab='script';A.ai.vref=t.dataset.id;A.go('studio')},
 simsearch:t=>{A.close();Object.assign(A.ss,{mode:'image',simRef:t.dataset.id,hist:null,img:null,limit:36});A.go('search')},
 bell:()=>{const tr=A.st.tracked;const fresh=S.CONTENTS.filter(c=>tr.includes(c.brand)&&c.ago<=3).slice(0,6);A.modal(`<h2>알림</h2><ul class="notes">${fresh.map(c=>`<li><button class="link" data-act="open" data-id="${c.id}"><b>${esc(S.brandById[c.brand].name)}</b> 새 ${c.isAd?'광고':'게시물'} · ${esc(c.headline)}</button><small>${c.ago?c.ago+'일 전':'오늘'}</small></li>`).join('')}${fresh.length?'':'<li><span class="muted">최근 3일 동안 추적 브랜드의 새 콘텐츠가 없어요</span></li>'}</ul>`)},
 logout:async()=>{await fetch('/api/logout',{method:'POST',credentials:'same-origin'});location.href='/login.html'},
 wsSwitch:()=>{A.st.ws=A.st.ws==='Scout 마케팅팀'?'개인 워크스페이스':'Scout 마케팅팀';A.save('ws');A.topbar();A.toast(A.st.ws+'(으)로 전환했어요')},
});
A.forms.newBoardSave=d=>{const n={id:'b'+A.uid(),type:'board',name:d.n.trim(),parent:null,items:[]};A.st.nodes.push(n);A.save('nodes');A.saveItem(n.id,A._pendingSave);A.close();if(A.cur==='boards')A.render()};
})();
