import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../js/catalog-quality.js',import.meta.url),'utf8'),context);
const q=context.window.ValueDeckCatalog;
const future='2099-01-01T00:00:00Z',past='2000-01-01T00:00:00Z';
test('totals preserve fractional quotes and reject missing/range/expired prices',()=>{
 const data={byId:{a:{value:0.75,priceValidUntil:future},b:{value:2.5,priceValidUntil:future},range:{value:null,priceQuotes:[{low:14000,high:15000}]},old:{value:500,priceValidUntil:past},missing:{value:null}}};
 assert.equal(q.total([{id:'a',qty:2},{id:'b',qty:3}],data),9);
 for(const id of ['range','old','missing'])assert.equal(q.total([{id:'a',qty:1},{id,qty:1}],data),null);
 assert.equal(q.status(data.byId.range),'range');assert.equal(q.status(data.byId.old),'stale');
 assert.equal(q.hasPrice({value:12,priceValidUntil:'bad'}),false);assert.equal(q.hasPrice({value:12,priceValidUntil:null}),false);
});
test('pending registration is independent of calculators and legacy IDs remain usable',()=>{
 const item={id:'old-id',name:'Glitch Cameraman',aliases:['Glitch plungerman'],value:150};
 assert(q.matches(item,'glitch plungerman'));assert(q.matches(item,'old-id'));
 assert(!q.canRegister({},undefined));assert(q.canRegister({},item));assert(!q.canRegister({tradeRegistration:'pending'},item));
 assert(!q.canRegister({},{...item,tradeReady:false}));assert(q.hasPrice({...item,tradeReady:false}));
});
test('catalog publication has valid source records, full CTD images and explicit unknown King units',()=>{
 const ctd=JSON.parse(readFileSync(new URL('../data/cameraman-td.json',import.meta.url)));
 const king=JSON.parse(readFileSync(new URL('../data/king-legacy.json',import.meta.url)));
 assert.equal(ctd.items.length,62);assert.equal(ctd.items.filter(i=>i.tradeReady===false).length,0);
 assert(ctd.items.every(i=>i.image));assert.equal(ctd.items.find(i=>i.id==='headless-tv-man').rarity,'Unknown');
 const games=JSON.parse(readFileSync(new URL('../data/games.json',import.meta.url))).games;
 for(const [id,data] of [['cameraman-td',ctd],['king-legacy',king]]){
  const game=games.find(g=>g.id===id);assert(game);
  assert(data.items.every(i=>q.canRegister(game,i)));
 }
 assert.equal(king.valueUnit,'목록 참고가치');assert.equal(king.pricePolicy.unitVerified,false);
 for(const data of [ctd,king])for(const i of data.items){
  if(i.value!==null){assert(i.value>0);assert.equal(i.priceQuotes.length,1);assert(i.priceValidUntil);assert.equal(i.priceQuotes[0].value,i.value);}
  if(i.valueStatus==='range'){assert.equal(i.value,null);assert(i.priceQuotes[0].low<=i.priceQuotes[0].high);}
 }
});
