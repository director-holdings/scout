/* 연동 설정: 토큰·수집 대상·수집 상태·크롬 확장 키·샘플 데이터 */
(function(){
const A=window.APP,S=A.S,esc=A.esc;
const IND=Object.entries(S.INDUSTRIES);
const indSel=(name,v)=>`<select name="${name}" aria-label="업종">${IND.map(([k,l])=>`<option value="${k}"${k===v?' selected':''}>${l}</option>`).join('')}</select>`;
const JOBNAME={collect_all:'전체 수집',collect_instagram:'인스타그램 수집',collect_youtube:'유튜브 수집',check_instagram:'인스타그램 연결 확인',check_youtube:'유튜브 연결 확인'};
const STNAME={queued:'대기 중',running:'진행 중',done:'완료',error:'실패'};
let D=null,timer=null;

A.views.settings=()=>{A.after=load;return `<div class="page"><header class="ph"><div class="grow"><h1>연동 설정</h1><p class="muted">수집할 계정과 API 연결을 관리해요. 토큰은 저장 후 다시 보여주지 않아요.</p></div></header><div id="setbody"><p class="muted">불러오는 중…</p></div></div>`};

async function load(){try{const [st,tg,jobs]=await Promise.all([A.api('/api/settings'),A.api('/api/targets'),A.api('/api/jobs')]);D={st,tg,jobs};draw()}catch(e){const b=A.$('#setbody');if(b)b.innerHTML=`<p class="errline">${esc(e.message)}</p>`}}
function setLine(k,label){const v=D.st[k];return v&&v.set?`<span class="okline">${label} 저장됨</span>`:`<span class="muted">${label} 아직 없음</span>`}
function draw(){const b=A.$('#setbody');if(!b)return;const {st,tg,jobs}=D;
 const running=jobs.some(j=>j.status==='queued'||j.status==='running');
 b.innerHTML=`
 <section class="panel"><h2>수집 상태</h2>
  <div class="row wrap gap"><button class="btn pri" data-act="job" data-k="collect_all"${running?' disabled':''}>지금 전체 수집</button><button class="btn" data-act="job" data-k="check_instagram">인스타그램 연결 확인</button><button class="btn" data-act="job" data-k="check_youtube">유튜브 연결 확인</button><button class="btn sm" data-act="jobsRefresh">새로고침</button></div>
  <p class="note">매일 ${esc(st.collect_hour.value||'6')}시(한국 시간)쯤 자동으로 수집해요. 수집이 끝나면 화면을 새로고침하세요.</p>
  ${jobs.length?`<table class="tbl stack"><thead><tr><th>작업</th><th>상태</th><th>결과</th><th>시각</th></tr></thead><tbody>${jobs.slice(0,8).map(j=>`<tr><td>${esc(JOBNAME[j.kind]||j.kind)}</td><td class="${j.status==='error'?'errline':j.status==='done'?'okline':''}">${STNAME[j.status]||j.status}</td><td>${esc(j.message||'')}</td><td>${A.fdate(j.created_at)} ${new Date(j.created_at).toTimeString().slice(0,5)}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">아직 실행한 작업이 없어요</p>'}
 </section>

 <div class="two">
 <section class="panel"><h2>인스타그램 (Business Discovery)</h2>
  <form class="setform" data-form="setSave">
   <label>조회용 인스타그램 계정 ID <small>숫자로 된 ID (예: 17841400000000000)</small><input name="ig_user_id" inputmode="numeric" value="${esc(st.ig_user_id.value||'')}" autocomplete="off"></label>
   <label>액세스 토큰 <small>${setLine('ig_access_token','토큰')} · 바꿀 때만 입력</small><input name="ig_access_token" type="password" autocomplete="off" placeholder="EAA로 시작하는 긴 문자열"></label>
   <button class="btn pri">저장</button></form>
 </section>
 <section class="panel"><h2>유튜브 (YouTube Data API)</h2>
  <form class="setform" data-form="setSave">
   <label>API 키 <small>${setLine('yt_api_key','API 키')} · 바꿀 때만 입력</small><input name="yt_api_key" type="password" autocomplete="off" placeholder="AIza로 시작하는 문자열"></label>
   <button class="btn pri">저장</button></form>
 </section>
 </div>

 <section class="panel"><h2>수집할 브랜드 <small>인스타그램 아이디·유튜브 채널을 넣으면 매일 수집해요</small></h2>
  <div class="tlist"><div class="trow head"><span>브랜드 이름 · 업종</span><span>인스타그램 아이디</span><span>유튜브 채널 (@핸들 또는 UC…)</span><span>광고 라이브러리 페이지 이름</span><span></span></div>
  ${tg.brands.filter(x=>!x.is_demo).map(x=>brandRow(x)).join('')}${brandRow({})}</div>
  ${tg.brands.some(x=>x.is_demo)?`<p class="note">샘플 브랜드 ${tg.brands.filter(x=>x.is_demo).length}개는 목록에서 숨겼어요</p>`:''}
 </section>

 <section class="panel"><h2>수집할 인플루언서 <small>비즈니스·크리에이터 계정만 조회돼요</small></h2>
  <div class="tlist"><div class="trow head"><span>이름 · 업종</span><span>인스타그램 아이디</span><span>유튜브 채널</span><span></span><span></span></div>
  ${tg.creators.filter(x=>!x.is_demo).map(x=>creatorRow(x)).join('')}${creatorRow({})}</div>
 </section>

 <section class="panel"><h2>스토어 <small>스토어 분석에 쓰는 판매처 목록</small></h2>
  <div class="tlist">${tg.stores.filter(x=>!x.is_demo).map(x=>`<div class="trow"><b>${esc(x.name)}</b><span class="muted">${esc((x.industries||[]).map(k=>S.INDUSTRIES[k]).join('·'))}</span><span class="muted">${esc(x.url||'')}</span><span></span><button class="link danger" data-act="delTarget" data-kind="stores" data-id="${x.id}">삭제</button></div>`).join('')}
  <form class="trow" data-form="storeSave"><input name="name" placeholder="스토어 이름" required maxlength="40">${indSel('industry','beauty')}<input name="url" placeholder="주소 (선택)"><span></span><button class="btn">추가</button></form></div>
 </section>

 <div class="two">
 <section class="panel"><h2>크롬 확장 연결</h2><p class="muted">광고 저장용 크롬 확장에 아래 서버 주소와 연결 키를 넣어요.</p>
  <p class="sm"><b>서버 주소</b></p><div class="keybox">${esc(location.origin)}</div>
  <p class="sm"><b>연결 키</b></p><div class="keybox">${esc(st.ingest_key.value)}</div>
  <p class="note">키가 밖으로 새어 나갔다면 새 키로 바꾸고 팀원 확장에도 다시 넣어주세요.</p><button class="btn sm" data-act="rotateKey">새 키 만들기</button>
 </section>
 <section class="panel"><h2>팀 설정</h2>
  <form class="setform" data-form="setSave">
   <label>팀 비밀번호 바꾸기 <small>8자 이상 · 바꾸면 다음 로그인부터 적용</small><input name="app_password" type="password" autocomplete="new-password" minlength="8"></label>
   <label>매일 수집 시각 (0~23시) <input name="collect_hour" type="number" min="0" max="23" value="${esc(st.collect_hour.value||'6')}"></label>
   <button class="btn pri">저장</button></form>
  <h3>샘플 데이터</h3><p class="note">처음 화면을 보여주려고 넣어둔 가상 데이터예요. 실제 수집이 시작되면 지우세요.</p>
  <div class="row gap wrap">${S.CONTENTS.some(c=>c.demo)?'<button class="btn danger" data-act="demoClear">샘플 데이터 모두 지우기</button>':'<button class="btn" data-act="demoLoad">샘플 데이터 다시 넣기</button>'}</div>
 </section>
 </div>`;
 clearTimeout(timer);if(running)timer=setTimeout(async()=>{if(A.cur!=='settings')return;try{D.jobs=await A.api('/api/jobs');draw()}catch(e){}},5000)}

function brandRow(x){return `<form class="trow" data-form="brandSave">${x.id?`<input type="hidden" name="id" value="${esc(x.id)}">`:''}<div class="row gap"><input name="name" value="${esc(x.name||'')}" placeholder="${x.id?'':'새 브랜드 이름'}" required maxlength="40">${indSel('industry',x.industry)}</div><input name="ig" value="${esc(x.ig_username||'')}" placeholder="예: ondoskin_official"><input name="yt" value="${esc(x.yt_channel||'')}" placeholder="예: @ondoskin"><input name="metaPage" value="${esc(x.meta_page||'')}" placeholder="광고에 보이는 이름"><span class="row gap"><button class="btn sm${x.id?'':' pri'}">${x.id?'저장':'추가'}</button>${x.id?`<button type="button" class="link danger" data-act="delTarget" data-kind="brands" data-id="${x.id}">삭제</button>`:''}</span></form>`}
function creatorRow(x){return `<form class="trow" data-form="creatorSave">${x.id?`<input type="hidden" name="id" value="${esc(x.id)}">`:''}<div class="row gap"><input name="name" value="${esc(x.name||'')}" placeholder="${x.id?'':'이름 (선택)'}" maxlength="30">${indSel('industry',x.industry)}</div><input name="ig" value="${esc(x.ig_username||'')}" placeholder="인스타그램 아이디"><input name="yt" value="${esc(x.yt_channel||'')}" placeholder="유튜브 @핸들 (선택)"><span></span><span class="row gap"><button class="btn sm${x.id?'':' pri'}">${x.id?'저장':'추가'}</button>${x.id?`<button type="button" class="link danger" data-act="delTarget" data-kind="creators" data-id="${x.id}">삭제</button>`:''}</span></form>`}

const reloadSoon=msg=>{A.toast(msg+' · 화면을 새로 불러와요');setTimeout(()=>location.reload(),900)};
const guard=f=>async(...a)=>{try{await f(...a)}catch(e){A.toast(e.message)}};
Object.assign(A.acts,{
 job:guard(async t=>{await A.api('/api/jobs',{method:'POST',body:{kind:t.dataset.k}});A.toast((JOBNAME[t.dataset.k]||'작업')+'을 시작했어요');D.jobs=await A.api('/api/jobs');draw()}),
 jobsRefresh:guard(async()=>{D.jobs=await A.api('/api/jobs');draw()}),
 rotateKey:guard(async()=>{if(!confirm('새 키를 만들면 지금 쓰는 확장들은 다시 설정해야 해요. 계속할까요?'))return;await A.api('/api/settings/ingest-key/rotate',{method:'POST'});load()}),
 delTarget:guard(async t=>{if(!confirm('삭제하면 이 대상으로 수집한 콘텐츠도 함께 지워져요. 계속할까요?'))return;await A.api(`/api/${t.dataset.kind}/${t.dataset.id}`,{method:'DELETE'});reloadSoon('삭제했어요')}),
 demoClear:guard(async()=>{if(!confirm('샘플 브랜드·콘텐츠·인플루언서를 모두 지울까요? 직접 만든 보드와 실제 수집 데이터는 남아요.'))return;await A.api('/api/demo/clear',{method:'POST'});reloadSoon('샘플 데이터를 지웠어요')}),
 demoLoad:guard(async()=>{await A.api('/api/demo/load',{method:'POST'});reloadSoon('샘플 데이터를 넣었어요')}),
});
Object.assign(A.forms,{
 setSave:guard(async d=>{await A.api('/api/settings',{method:'POST',body:d});A.toast('저장했어요');load()}),
 brandSave:guard(async d=>{await A.api('/api/brands',{method:'POST',body:d});reloadSoon('브랜드를 저장했어요')}),
 creatorSave:guard(async d=>{await A.api('/api/creators',{method:'POST',body:d});reloadSoon('인플루언서를 저장했어요')}),
 storeSave:guard(async d=>{await A.api('/api/stores',{method:'POST',body:{name:d.name,url:d.url,industries:[d.industry]}});reloadSoon('스토어를 추가했어요')}),
});
})();
