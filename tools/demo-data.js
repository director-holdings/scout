/* Scout 샘플 데이터 — 모든 브랜드·인물·스토어는 가상입니다 */
(function(){
const seed=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const R=seed(20261125);
const pick=a=>a[Math.floor(R()*a.length)];
const rint=(a,b)=>a+Math.floor(R()*(b-a+1));
const DAY=864e5, TODAY=new Date(2026,10,25);

const INDUSTRIES={beauty:'뷰티',fashion:'패션',food:'식품',living:'리빙',health:'헬스',tech:'테크'};
const PLATFORMS={instagram:'Instagram',meta:'Meta 광고',tiktok:'TikTok',youtube:'YouTube',google:'Google 광고'};
const LAYOUTS={center:'중앙 제품',split:'좌우 분할',bottom:'하단 텍스트',grid:'그리드',text:'타이포 중심',person:'인물 UGC'};

const BRANDS=[
 ['ondo','온도스킨','beauty','#e8a598',[['수분 크림','jar'],['비타 세럼','bottle'],['톤업 선크림','tube']]],
 ['lumi','루미에르랩','beauty','#b9a4e0',[['물광 앰플','bottle'],['립 틴트','tube'],['클렌징 폼','tube']]],
 ['soy','소이베이스','beauty','#9cc8a8',[['비건 토너','bottle'],['진정 크림','jar']]],
 ['mono','모노크롬스튜디오','fashion','#2b2b2b',[['울 블렌드 코트','shirt'],['미니 토트백','bag']]],
 ['dfit','데일리핏','fashion','#4a7bd0',[['쿠션 러닝화','shoe'],['기모 맨투맨','shirt']]],
 ['haru','하루견과','food','#c98d4a',[['데일리 견과','box'],['단백질 바','box']]],
 ['milky','밀키웨이','food','#f1d36b',[['저당 그릭요거트','jar'],['오트 라떼','can']]],
 ['square','스퀘어커피','food','#6b4a3a',[['콜드브루 원액','can'],['드립백 세트','box']]],
 ['nua','누아리빙','living','#c7b79a',[['우드 디퓨저','bottle'],['리넨 침구','box']]],
 ['cloud','클라우드슬립','living','#8fb3d9',[['메모리폼 베개','box'],['구스 이불','box']]],
 ['green','그린데이','health','#5fae6e',[['장 유산균','bottle'],['비타민D','jar']]],
 ['fitco','핏앤코','health','#e0623a',[['프로틴 쉐이크','can'],['콜라겐 젤리','box']]],
 ['dot','도트테크','tech','#1d1f2b',[['노이즈캔슬링 이어폰','device'],['스마트워치','device']]],
 ['wave','웨이브오디오','tech','#3a6ff0',[['블루투스 스피커','can'],['무선 충전기','device']]],
].map(([id,name,industry,color,products])=>({id,name,industry,color,products:products.map(([n,s],i)=>({id:id+'-p'+i,name:n,shape:s,brand:id}))}));
const brandById=Object.fromEntries(BRANDS.map(b=>[b.id,b]));

const HEAD={
 beauty:['속당김 없이 하루 종일 촉촉','물광 피부, 3초면 충분해요','민감 피부도 안심하는 저자극 포뮬러','비건 인증 받은 순한 진정 케어','모공 걱정 없는 아침 루틴','겨울 건조함엔 이거 하나면 끝','바르자마자 차오르는 수분','피부과 테스트 완료한 저자극 크림'],
 fashion:['올겨울 가장 많이 찾은 코트','하루 종일 신어도 편한 쿠션','출근룩부터 주말룩까지 하나로','가볍고 따뜻한 겨울 아우터','신상 컬러 단독 공개','여름 휴가 필수템 미리 준비','10만 명이 선택한 데일리 핏'],
 food:['설탕 걱정 없는 저당 간식','하루 한 줌 건강 습관','아침을 바꾸는 단백질 한 잔','카페 맛 그대로 집에서','겨울 선물로 딱 좋은 세트','여름엔 시원한 콜드브루','리뷰 1만 개가 증명한 맛'],
 living:['잠이 달라지는 베개','집 안 가득 퍼지는 우드 향','겨울 침구 교체 시즌','호텔 같은 침실 만들기','선물하기 좋은 디퓨저 세트','여름밤 시원한 리넨'],
 health:['장 건강, 아침 한 알로','하루 비타민D 충전','운동 후 단백질 보충','먹기 쉬운 콜라겐 젤리','겨울철 면역 관리 시작','부모님 선물로 많이 찾는 영양제'],
 tech:['소음은 끄고 음악에 집중','하루 종일 가는 배터리','선물하기 좋은 테크 아이템','책상 위가 깔끔해지는 무선 충전','신상 출시 단독 혜택','여름 캠핑 필수 스피커'],
};
const CTA=['지금 구매하면 1+1','첫 구매 50% 할인','무료배송 이벤트 진행 중','블랙프라이데이 최대 70% 할인','리뷰 1만 개 돌파 기념 할인','오늘만 단독 특가','선착순 한정 수량','겨울 시즌 한정 패키지','품절 임박, 서두르세요','신상 출시 기념 사은품 증정'];
const SCRIPT={
 beauty:['요즘 날씨 때문에 피부가 너무 건조했는데요, 이거 바르고 나서 진짜 달라졌어요.','아침에 세안하고 딱 두 방울이면 하루 종일 촉촉해요.','민감한 편인데 따가움이 하나도 없어서 놀랐어요.'],
 fashion:['이 코트 입고 나가면 다들 어디 거냐고 물어봐요.','하루에 만 보 넘게 걷는데 발이 하나도 안 아파요.','사이즈 고민되시면 한 치수 크게 가세요.'],
 food:['당 걱정 때문에 간식 끊었었는데 이건 먹어도 괜찮더라고요.','아침 대신 이거 한 잔 마시고 출근해요.','카페 가는 돈 아끼려고 시작했는데 맛이 더 좋아요.'],
 living:['베개 바꾸고 나서 아침에 목이 안 아파요.','현관 들어서자마자 향이 너무 좋다고 해요.','이불 하나 바꿨을 뿐인데 침실 분위기가 완전히 달라졌어요.'],
 health:['아침에 물이랑 한 알만 먹으면 돼서 꾸준히 먹게 되더라고요.','운동 끝나고 바로 마시는데 맛이 생각보다 괜찮아요.','부모님 선물로 드렸더니 너무 좋아하셨어요.'],
 tech:['지하철에서 켜는 순간 세상이 조용해져요.','충전 한 번으로 일주일을 써요.','캠핑 가서 틀었는데 소리가 진짜 꽉 차요.'],
};
const PALETTES=[['#fbe9e4','#f6cfc4','#d9634c','#3a1d17'],['#eef2ff','#c9d4ff','#1240e0','#0a1240'],['#f4f1ea','#e2d9c5','#8a6a3b','#2a2117'],['#e7f4ec','#bfe3cb','#2f8a52','#10301c'],['#1b1d29','#2c3046','#7aa2ff','#f2f4ff'],['#fff6d8','#ffe38a','#e0a100','#3a2c00'],['#f1e9ff','#d9c6ff','#7a4fe0','#24124f'],['#ffece6','#ffb79f','#ef5a2a','#3d1408'],['#e8f6fb','#b5e2f2','#1592b8','#062c38'],['#efefef','#d4d4d4','#111111','#111111'],['#ffe9f1','#ffc0d6','#e0336f','#40101f'],['#eaf0e1','#cfdcb8','#5f7d2c','#1f2a0d']];

const FIRST=['유나','지호','서윤','민준','하린','도윤','수아','예준','지안','시우','채원','건우','나은','현우','소희','태윤','다인','준서','윤슬','이든','가온','라희','태오','보미'];
const TAIL=['.daily','_log','.moment','.film','_room','.table','.fit','.home','_pick','.diary'];
const CREATORS=FIRST.map((n,i)=>{const ind=Object.keys(INDUSTRIES)[i%6];const f=rint(8,420)*1000;let v=f*0.92;const tr=[];for(let w=0;w<26;w++){v*=1+(R()*0.03-0.004);tr.push(Math.round(v))}
 return{id:'c'+i,name:n,handle:'@'+['yu','ji','seo','min','ha','do','su','ye','an','si','chae','geon','na','hyun','so','tae','da','jun','yun','eden','gaon','ra','teo','bomi'][i]+TAIL[i%TAIL.length],industry:ind,followers:tr[25],er:+(1.2+R()*6.5).toFixed(1),avgViews:Math.round(f*(0.2+R()*0.9)),trend:tr,platforms:[pick(['instagram','tiktok','youtube']),pick(['instagram','tiktok'])].filter((x,j,a)=>a.indexOf(x)===j)}});

const STORES=[
 ['glow','글로우마켓',['beauty','health'],'뷰티·헬스 전문 쇼핑몰'],
 ['daily','데일리몰',['food','living'],'식품·생활 큐레이션 몰'],
 ['fits','핏스토어',['fashion','health'],'패션·스포츠 편집숍'],
 ['techp','테크플러스',['tech'],'전자기기 전문 몰'],
 ['allday','올데이마켓',['beauty','food','living','tech'],'종합 라이브커머스 몰'],
].map(([id,name,inds,desc])=>({id,name,industries:inds,desc}));

/* 콘텐츠 */
const CONTENTS=[];
for(let i=0;i<280;i++){
 const b=pick(BRANDS), ind=b.industry, p=pick(b.products);
 const platform=pick(['instagram','meta','meta','tiktok','youtube','google','meta','instagram']);
 const isAd=platform==='meta'||platform==='google';
 let ago=Math.floor(R()**1.3*180);
 let headline=pick(HEAD[ind]), cta=pick(CTA);
 if(/블랙프라이데이/.test(cta)&&ago>28) ago=rint(0,28);
 if(/겨울/.test(headline+cta)&&ago>75) ago=rint(0,75);
 if(/여름/.test(headline)&&ago<95) ago=rint(95,180);
 const start=new Date(TODAY-ago*DAY);
 const run=isAd?(R()<.42?ago+rint(1,40):rint(3,Math.max(4,ago))):0;
 const active=isAd?(run>ago):null;
 const media=platform==='tiktok'||platform==='youtube'?'video':pick(['image','image','video','carousel']);
 const creator=(platform==='meta'&&R()<.3)||(!isAd&&R()<.6)?pick(CREATORS.filter(c=>c.industry===ind)):null;
 const layout=creator&&R()<.6?'person':pick(Object.keys(LAYOUTS));
 const pal=Math.floor(R()*PALETTES.length);
 const views=Math.round((creator?creator.avgViews:rint(5,300)*1000)*(0.3+R()*2.2));
 let ages=[R(),R()*1.4,R()*1.2,R()*.8,R()*.5];
 if(ind==='health'||ind==='living') ages=ages.reverse();
 const sum=ages.reduce((a,c)=>a+c,0); ages=ages.map(a=>Math.round(a/sum*100));
 const rank=[];let r=rint(5,80);for(let d=0;d<30;d++){r=Math.max(1,Math.min(100,r+rint(-6,5)));rank.push(r)}
 const tags=[INDUSTRIES[ind],LAYOUTS[layout],media==='video'?'영상':media==='carousel'?'캐러셀':'이미지',creator?'인플루언서':'브랜드 계정'];
 CONTENTS.push({id:'r'+(1000+i),platform,brand:b.id,industry:ind,product:p.id,media,layout,pal,headline,body:p.name+' · '+cta,cta,
  transcript:media==='video'?pick(SCRIPT[ind])+' '+pick(SCRIPT[ind]):'',
  start,ago,run,active,isAd,creator:creator&&creator.id,views,likes:Math.round(views*(0.01+R()*0.06)),comments:Math.round(views*(0.0005+R()*0.004)),
  ages,rank,tags,store:pick(STORES.filter(s=>s.industries.includes(ind))).id});
}
CONTENTS.sort((a,b)=>a.ago-b.ago);

const TERMS=['촉촉','물광','저자극','비건','1+1','무료배송','할인','블랙프라이데이','겨울','한정','리뷰','단독','신상','선물','저당','단백질','여름','품절'];
const WEEKS=26;
function termSeries(term,list=CONTENTS){const s=new Array(WEEKS).fill(0);for(const c of list){if((c.headline+' '+c.body+' '+c.transcript).includes(term)){const w=WEEKS-1-Math.floor(c.ago/7);if(w>=0)s[w]++}}return s}
const weekLabels=Array.from({length:WEEKS},(_,i)=>{const d=new Date(TODAY-(WEEKS-1-i)*7*DAY);return(d.getMonth()+1)+'/'+d.getDate()});

/* 브랜드 SNS 추이 */
for(const b of BRANDS){let v=rint(20,300)*1000;b.followerTrend=[];b.erTrend=[];for(let w=0;w<WEEKS;w++){v*=1+(R()*.035-.008);b.followerTrend.push(Math.round(v));b.erTrend.push(+(1+R()*4).toFixed(2))}}

const MEMBERS=[
 {id:'u1',name:'김하늘',email:'haneul@scout.example',role:'소유자',group:'브랜드마케팅',used:4120,limit:0},
 {id:'u2',name:'이준호',email:'junho@scout.example',role:'관리자',group:'퍼포먼스',used:2870,limit:5000},
 {id:'u3',name:'박서연',email:'seoyeon@scout.example',role:'멤버',group:'퍼포먼스',used:1340,limit:2000},
 {id:'u4',name:'최민재',email:'minjae@scout.example',role:'멤버',group:'콘텐츠',used:960,limit:2000},
 {id:'u5',name:'정다은',email:'daeun@agency.example',role:'게스트',group:'외부 대행사',used:210,limit:500},
];

window.SCOUT={TODAY,DAY,INDUSTRIES,PLATFORMS,LAYOUTS,BRANDS,brandById,CONTENTS,CREATORS,STORES,PALETTES,TERMS,WEEKS,termSeries,weekLabels,MEMBERS,
 contentById:Object.fromEntries(CONTENTS.map(c=>[c.id,c])),creatorById:Object.fromEntries(CREATORS.map(c=>[c.id,c])),
 productById:Object.fromEntries(BRANDS.flatMap(b=>b.products).map(p=>[p.id,p])),storeById:Object.fromEntries(STORES.map(s=>[s.id,s]))};
})();
