// 프로토타입의 가상 샘플 데이터를 서버용 JSON으로 내보내는 도구 (node tools/export_demo.js)
const fs=require('fs'),path=require('path'),vm=require('vm');
const ctx={window:{},Date,Math,Object,Array,JSON,String,Number};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'demo-data.js'),'utf8'),ctx);
const S=ctx.window.SCOUT, day=d=>new Date(d).toISOString().slice(0,10);
const out={
 brands:S.BRANDS.map(b=>({id:b.id,name:b.name,industry:b.industry,color:b.color,products:b.products.map(p=>({id:p.id,name:p.name,shape:p.shape})),followerTrend:b.followerTrend,erTrend:b.erTrend})),
 creators:S.CREATORS.map(c=>({id:c.id,name:c.name,handle:c.handle,industry:c.industry,platforms:c.platforms,er:c.er,avgViews:c.avgViews,trend:c.trend})),
 stores:S.STORES,
 contents:S.CONTENTS.map(c=>({id:c.id,platform:c.platform,brand:c.brand,industry:c.industry,product:c.product,media:c.media,layout:c.layout,pal:c.pal,headline:c.headline,body:c.body,cta:c.cta,transcript:c.transcript,start:day(c.start),ago:c.ago,run:c.run,active:c.active,isAd:c.isAd,creator:c.creator,views:c.views,likes:c.likes,comments:c.comments,ages:c.ages,rank:c.rank,tags:c.tags,store:c.store})),
 members:S.MEMBERS.map(({used,limit,...m})=>m),
 today:day(S.TODAY),
};
fs.writeFileSync(path.join(__dirname,'..','backend','app','demo_seed.json'),JSON.stringify(out));
console.log('contents',out.contents.length,'brands',out.brands.length);
