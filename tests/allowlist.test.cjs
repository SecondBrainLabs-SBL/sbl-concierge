const test = require('node:test');
const assert = require('node:assert/strict');
const {cleanup,build,scripts,say,act,done,elements,assigned} = require('./fake-engine.cjs');
const map = require('../core/site-map.js');
globalThis.getComputedStyle = () => ({visibility:'visible'});
test.afterEach(cleanup);
const link = href => ({tagName:'A', href, innerText:'Open page', type:'', clicked:0, isConnected:true,
  getAttribute:()=>null, matches:()=>false, getBoundingClientRect:()=>({width:10,height:10}),
  closest(s){return /^a\[/.test(s)?this:null;}, click(){this.clicked++;}});
for (const then of ['show','do']) for (const tool of ['navigate','click']) {
  test(`engine ${then}/${tool}: offsite destinations end with one honest refusal and never act`, async()=>{
    const urls = [...new Set(['https://gtm.sbl.so/', map.handoff.href, ...map.offsite.slice(0,2).map(l=>l.href), 'https://sbl.so.evil.example/', 'javascript:alert(1)', 'https://user@sbl.so/pricing/', 'https://sbl.so:444/pricing/'])];
    for(const url of urls){
      const b=build(); const a=link(url);elements.set(5,a);
      scripts.push([say('I will show you the page.',then,{because:'open that link for me'}),act(tool,tool==='click'?{index:5}:{url}),done('This must never be said.')]);
      await b.h.hear('open that link for me');
      assert.deepEqual(assigned,[],url);assert.equal(a.clicked,0,url);
      assert.equal(b.said.length,2,url);assert.match(b.said[1],/I cannot open/,url);
      assert.equal(b.events.filter(e=>e.k==='turn_end').at(-1).status,'cannot');
    }
  });
}
test('engine navigation: index page allowed, invented page refused, on-page SBL link allowed',async()=>{
  for(const [url,allowed] of [['https://sbl.so/whatsapp/',true],['https://sbl.so/invented-destination/',false]]){
    const b=build();scripts.push([say('Opening it.'),act('navigate',{url}),done()]);await b.h.hear('show me the page');
    assert.deepEqual(assigned,allowed?[url]:[]);
    if(!allowed)assert.match(b.said.at(-1),/not in the site index/);
  }
  const b=build(),a=link('https://sbl.so/new-on-page-link/'),old=document.querySelectorAll;
  document.querySelectorAll=s=>s==='a[href]'?[a]:[];
  try{scripts.push([say('Opening it.'),act('navigate',{url:a.href}),done()]);await b.h.hear('show me that link');assert.equal(a.clicked,1);}finally{document.querySelectorAll=old;}
});
test('engine app navigation and clicks require evidence',async()=>{
  for(const tool of ['navigate','click'])for(const consent of [false,true]){
    const b=build(),url='https://app.secondbrainlabs.com/signup',a=link(url);elements.set(5,a);
    scripts.push([say('Opening the page.'),act(tool,{...(tool==='click'?{index:5}:{url}),...(consent?{because:'sign me up for the trial'}:{})}),done()]);
    await b.h.hear(consent?'sign me up for the trial':'show me the plans');
    assert.equal(tool==='click'?a.clicked:assigned.length,consent?1:0);
  }
});
