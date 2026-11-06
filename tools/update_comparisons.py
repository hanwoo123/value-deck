#!/usr/bin/env python3
"""Summarize numeric public quotes; use only explicitly configured public sources, never private APIs or provisional points as prices."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import time
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from zoneinfo import ZoneInfo
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from public_sources import page_array, page_object
from update_values import number, key

ROOT = Path(__file__).resolve().parents[1]

class PageText(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip=0; self.parts=[]
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','svg'): self.skip+=1
    def handle_endtag(self,tag):
        if tag in ('script','style','svg'): self.skip-=1
    def handle_data(self,data):
        if not self.skip: self.parts.append(data)

def terms_hash(html):
    p=PageText();p.feed(html)
    return hashlib.sha256(' '.join(' '.join(p.parts).split()).encode()).hexdigest()

def get(url,allow_vvx=False):
    host=(urlparse(url).hostname or '').lower()
    if allow_vvx and (host=='vaultedvaluesx.com' or host.endswith('.vaultedvaluesx.com')) and (host not in ('vaultedvaluesx.com','www.vaultedvaluesx.com','blox-fruits.vaultedvaluesx.com','cameraman-td.vaultedvaluesx.com') or urlparse(url).path not in ('/value-list','/terms-of-service','/robots.txt') or urlparse(url).query):
        raise ValueError('VVX access limited to reviewed public pages')
    excluded=('progameguides.com','fruityblox.com')+(() if allow_vvx else ('vaultedvaluesx.com',))
    if urlparse(url).scheme!='https' or any(host==h or host.endswith('.'+h) for h in excluded):
        raise ValueError('Excluded destination')
    # No redirects: a source cannot redirect collection to an excluded host/API.
    r=subprocess.run(['curl','--fail','--silent','--show-error','--proto','=https','--retry','1','--retry-delay','2','--retry-max-time','15','--max-time','25','--max-filesize','5000000','--user-agent','BLOX-DECKS-price-comparison/1.0',url],capture_output=True,check=True)
    text=r.stdout.decode('utf-8')
    if len(r.stdout)>5000000:raise ValueError('Page too large')
    return text

def parse_quotes(html,source,now):
    prices={};dates={}
    if source['parser']=='vvx-public':
        rows=page_array(html,'items')
    elif source['parser']=='bloxfruitsvalues':
        rows=page_array(html,'fruits')
    else:
        try: rows=page_array(html,'initialItems')
        except ValueError:
            row=page_object(html,'item')
            if not isinstance(row.get('metadata'),dict) or not isinstance(row.get('name'),str):raise ValueError('Invalid public item detail')
            rows=[row]
    def add(name,raw,published):
        try:v=number(raw)
        except ValueError:return
        name=key(name)
        if name in prices:raise ValueError('Duplicate public item name')
        prices[name]=v;dates[name]=published
    for row in rows:
        published=row.get('updatedAt')
        if isinstance(published,str):published=published.removeprefix('$D')
        if published:
            age=now-datetime.fromisoformat(published.replace('Z','+00:00'))
            if age>timedelta(days=source.get('maximumAgeDays',7)) or age<timedelta(days=-1):continue
        if source['parser']=='vvx-public':
            if row.get('priceSourceListId')!=source['listId']:raise ValueError('Unexpected VVX public list')
            raw=row.get('rawValues') or {}
            add(row['name'],raw.get('value'),published)
            if row.get('category') not in ('Limited','Gamepass','Gamepasses'):
                add('Permanent '+row['name'],raw.get('permValue'),published)
        elif source['parser']=='bloxfruitsvalues':
            add(row['name'],row.get('physical_value'),published)
            if row.get('category')=='fruit':add('Permanent '+row['name'],row.get('permanent_value'),published)
        elif source['parser']=='cosmic-public':
            metadata=row.get('metadata') or {}
            if row.get('category') in ('Fruits','Gamepasses','Limiteds'):
                add(row['name'],metadata.get('regValue'),published)
                if row['category']=='Fruits':add('Permanent '+row['name'],metadata.get('permValue'),published)
        else:raise ValueError('Unknown public parser')
    if len(prices)<source['minimumPrices']:raise ValueError('Unexpected public quote coverage')
    return prices,dates

def fetch_source(source,now):
    read=(lambda url:get(url,allow_vvx=True)) if source.get('allowVvxPublic') and source['parser']=='vvx-public' else get
    robots=read(source['robotsUrl'])
    rp=RobotFileParser();rp.parse(robots.splitlines())
    urls=list(dict.fromkeys([source['url']]+source.get('extraPages',[])))
    if len(urls)>64 or any(urlparse(u).hostname!=urlparse(source['url']).hostname for u in urls):raise ValueError('Unexpected public page manifest')
    for url in [source['termsUrl']]+urls:
        if not rp.can_fetch('BLOX-DECKS-price-comparison',url):raise ValueError('Robots disallow access')
    terms=read(source['termsUrl'])
    if terms_hash(terms)!=source['reviewedTermsHash']:raise ValueError('Terms changed: review required before collection')
    prices={};dates={};links={};errors=[];consecutive=0
    for index,url in enumerate(urls):
        if index:time.sleep(source.get('requestIntervalSeconds',1))
        try:
            parsed,published=parse_quotes(read(url),dict(source,minimumPrices=0),now)
            for name,value in parsed.items():
                if name in prices and prices[name]!=value:raise ValueError('Conflicting quotes from same publisher')
                prices[name]=value;dates[name]=published.get(name);links[name]=url
            consecutive=0
        except (ValueError,OSError,KeyError,subprocess.CalledProcessError) as error:
            errors.append({'url':url,'error':str(error)[:160]});consecutive+=1
            if consecutive>=3:break
    if len(prices)<source['minimumPrices']:raise ValueError('Unexpected aggregate public quote coverage')
    return prices,dates,links,errors

def apply(data,sources,results,now):
    stamp=now.isoformat(timespec='seconds');changed=[];count=0
    for item in data['items']:
        previous=item.get('value') if item.get('valueBasis')=='public-comparison-v1' else None
        oldquotes=item.get('priceQuotes',[])
        for field in ['prevValue','demand','referenceValue','referenceSource','referenceUrl','valueUpdatedAt']:
            item.pop(field,None)
        name=key('Permanent '+item['name'].removesuffix(' (영구)') if item['category']=='영구 열매' else item['name'])
        quotes=[]
        for source in sources:
            if source['id'] not in results:continue
            prices,dates,*extra=results[source['id']]
            links=extra[0] if extra else {}
            source_name=key(source.get('itemNames',{}).get(item['id'],name))
            if source_name in prices:
                quotes.append({'id':source['id'],'name':source['name'],'url':links.get(source_name,source['url']),'value':int(prices[source_name]),'observedAt':stamp,'publishedAt':dates.get(source_name)})
        value=None;status='insufficient';reason='비교 자료 부족'
        if len(quotes)>=2:
            vals=[Decimal(q['value']) for q in quotes]
            if max(vals)<=min(vals)*2:
                value=int((sum(vals)/len(vals)).quantize(Decimal('1')));status='comparison';count+=1
                reason=f'{len(quotes)}개 사이트 공개값 비교 · 범위 {int(min(vals)):,}~{int(max(vals)):,}'
            else:
                preferred=next((q for q in quotes if q['id']=='vvx-bf'),None)
                if preferred:value=preferred['value'];status='disputed-reference';reason='출처 간 차이 큼 · VVX 표기값 참고 (평균 아님)';count+=1
                else:status='disputed';reason='출처 간 가격 차이가 커서 비교 보류'
        elif len(quotes)==1:
            value=quotes[0]['value'];status='single';reason='단일 출처 표기값 참고 · 비교 평균 아님';count+=1
        item.update(value=value,valueStatus=status,valueBasis='public-comparison-v1',trend='stable',note=reason,priceQuotes=quotes)
        # Initial replacement of provisional points is not a market move.
        if previous is not None and value is not None and previous!=value:
            changed.append({'id':item['id'],'oldValue':previous,'value':value})
        if previous!=value or oldquotes!=quotes:item['valueUpdatedAt']=stamp
    data.update(pricingMode='comparison',valueUnit='거래가치',updated=stamp[:10],source='공개 출처 숫자 참고 · 비교 평균/단일 출처/VVX 참고값 구분 · 실거래 완료가 아님')
    return count,changed

def run(root=ROOT,fetcher=fetch_source,write=False):
    config=json.loads((root/'tools/comparison-sources.json').read_text());now=datetime.now(ZoneInfo('Asia/Seoul'));results={};errors=[]
    for s in config['sources']:
        try:
            results[s['id']]=fetcher(s,now)
            if len(results[s['id']])>3:
                errors.extend({'id':s['id'],**e} for e in results[s['id']][3])
        except (ValueError,OSError,KeyError,subprocess.CalledProcessError) as e:errors.append({'id':s['id'],'error':str(e)[:250]})
    if not results:
        # Leave published quotes and their original observation date intact; never relabel stale data as checked.
        if write:
            p=root/'data/value-update-status.json';old=json.loads(p.read_text());old['lastAttemptAt']=now.isoformat(timespec='seconds');old['comparisonErrors']=errors;p.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
        return {'state':'blocked','errors':errors}
    p=root/'data/blox-fruits.json';data=json.loads(p.read_text());count,changes=apply(data,config['sources'],results,now)
    report={'state':'comparison','checkedAt':now.isoformat(timespec='seconds'),'games':{'blox-fruits':{'mode':'comparison','pricedItems':count,'sourceCount':len(results),'message':f'공개 사이트 {len(results)}곳 숫자 비교 · {count}개 항목 숫자 확인 · 단일 출처·편차 큰 값은 별도 표시 · 출처가 같은 원본을 사용했을 수 있으며 독립된 실거래 조사로 확인한 값이 아닙니다.'},'cameraman-td':json.loads((root/'data/value-update-status.json').read_text()).get('games',{}).get('cameraman-td',{'mode':'provisional','message':'카타디 자료 검토 중'})},'comparisonErrors':errors}
    if write:
        pending={p:data,root/'data/value-update-status.json':report}
        for path,content in pending.items():
            tmp=path.with_suffix('.json.tmp');tmp.write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
    return report

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');a=p.parse_args();r=run(write=a.write);print(json.dumps(r,ensure_ascii=False,indent=2));raise SystemExit(1 if r['state']=='blocked' else 0)
