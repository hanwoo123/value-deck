#!/usr/bin/env python3
"""Publish dated single-source CTD ranges; never invent a midpoint or confirmed market price."""
import argparse
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
from urllib.robotparser import RobotFileParser
from zoneinfo import ZoneInfo
from update_comparisons import get, terms_hash, fetch_source
from update_values import Tables, number, key, source_error

ROOT=Path(__file__).resolve().parents[1]

def parse_ranges(html):
    parser=Tables();parser.feed(html);ranges={}
    for table in parser.tables:
        if not table or len(table[0])<2 or key(table[0][1])!='value in gems':continue
        for row in table[1:]:
            if len(row)<2:continue
            cells=re.split(r'\s*[–—]\s*|\s+to\s+',row[1],flags=re.I)
            if len(cells) not in (1,2):continue
            try:lo=number(cells[0]);hi=number(cells[-1])
            except ValueError:continue
            if lo>hi or lo!=int(lo) or hi!=int(hi):raise ValueError('Invalid published range')
            name=key(row[0]);quote=(int(lo),int(hi))
            if name in ranges and ranges[name]!=quote:raise ValueError('Conflicting same-source ranges')
            ranges[name]=quote
    if len(ranges)<30:raise ValueError('Unexpected public range coverage')
    # Read only the primary article modification date; never treat retrieval time as publication time.
    dates=set(re.findall(r'"dateModified"\s*:\s*"([^"<>]+)"',html))
    if len(dates)!=1:raise ValueError('Article modification date is ambiguous')
    published=dates.pop();datetime.fromisoformat(published.replace('Z','+00:00'))
    return ranges,published

def apply(data,ranges,published,source,now):
    count=0;stamp=now.isoformat(timespec='seconds')
    for item in data['items']:
        for k in ['prevValue','demand','referenceValue','referenceUrl','referenceSource','valueUpdatedAt']:item.pop(k,None)
        name=key(source.get('itemNames',{}).get(item['id'],item['name']))
        quotes=[]
        if name in ranges:
            low,high=ranges[name];count+=1
            quotes=[{'id':source['id'],'name':source['name'],'url':source['url'],'low':low,'high':high,'unit':'자료 표기 젬','publishedAt':published,'observedAt':stamp}]
        item.update(value=None,valueStatus='insufficient',valueBasis='public-range-reference-v1',trend='stable',priceQuotes=quotes,
                    note='공개 자료 1곳의 범위 · 독립 검증·평균 계산 전이며 합산하지 않습니다' if quotes else '확인된 외부 숫자 자료 없음')
    data.update(pricingMode='reference',valueUnit='자료 표기 젬',updated=stamp[:10],source='공개 자료의 단일 출처 범위 · 확정 시세·비교 평균 아님 · 계산 보류')
    return count

def run(root=ROOT,write=False):
    source=json.loads((root/'tools/ctd-reference-source.json').read_text());now=datetime.now(ZoneInfo('Asia/Seoul'))
    path=root/'data/cameraman-td.json';data=json.loads(path.read_text())
    if source.get('parser')=='vvx-public':
        prices,dates,links,errors=fetch_source(source,now);count=0;stamp=now.isoformat(timespec='seconds')
        for item in data['items']:
            for field in ['prevValue','demand','referenceValue','referenceUrl','referenceSource','valueUpdatedAt']:item.pop(field,None)
            name=key(item['name']);value=int(prices[name]) if name in prices else None;quotes=[]
            if value is not None:
                count+=1;quotes=[{'id':source['id'],'name':source['name'],'url':links.get(name,source['url']),'value':value,'publishedAt':dates.get(name),'observedAt':stamp}]
            item.update(value=value,valueStatus='single' if quotes else 'insufficient',valueBasis='vvx-public-reference-v1',trend='stable',priceQuotes=quotes,note='VVX 공개 표기값 · 단일 출처 참고가' if quotes else '숫자로 확정된 값이 없어 가격 보류')
        data.update(pricingMode='comparison',valueUnit='참고가치',updated=stamp[:10],source='VVX 공개 가치표의 숫자 · 단일 출처 참고 · 게임 화폐 환산·실거래가 보장 아님')
        published=None;mode='comparison';message=f'VVX 공개 숫자 {count}개 · 단일 출처 참고가 · 6시간마다 확인'
    else:
        rp=RobotFileParser();rp.parse(get(source['robotsUrl']).splitlines())
        for url in [source['url'],source['policyUrl']]:
            if not rp.can_fetch('BLOX-DECKS-price-comparison',url):raise ValueError('Robots disallow access')
        if terms_hash(get(source['policyUrl']))!=source['reviewedPolicyHash']:raise ValueError('Publisher policy changed: review required')
        ranges,published=parse_ranges(get(source['url']))
        if now-datetime.fromisoformat(published.replace('Z','+00:00'))>timedelta(days=7):raise ValueError('Published ranges older than seven days')
        count=apply(data,ranges,published,source,now);mode='reference';message=f'외부 자료 범위 {count}개 · 단일 출처 참고 · 합산 보류'
    if write:
        status_path=root/'data/value-update-status.json';report=json.loads(status_path.read_text())
        report['games']['cameraman-td']={'mode':mode,'referencedItems':count,'sourceCount':1,'checkedAt':now.isoformat(timespec='seconds'),'lastAttemptAt':now.isoformat(timespec='seconds'),'refreshState':'ok','message':message}
        report.pop('ctdReferenceError',None)
        for p,value in [(path,data),(status_path,report)]:
            tmp=p.with_suffix('.json.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');tmp.replace(p)
    return {'items':count,'publishedAt':published}

def record_failure(path,error,now):
    report=json.loads(path.read_text());message=source_error(error)[:250]
    report['ctdReferenceError']=message
    info=report.setdefault('games',{}).setdefault('cameraman-td',{})
    info['lastAttemptAt']=now.isoformat(timespec='seconds')
    info['refreshState']='blocked' if 'error: 403' in message or 'error: 401' in message else 'error'
    info['httpStatus']=403 if 'error: 403' in message else 401 if 'error: 401' in message else None
    # checkedAt and all published quote observation dates intentionally stay unchanged.
    tmp=path.with_suffix('.json.tmp');tmp.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');a=p.parse_args()
    try:print(json.dumps(run(write=a.write),ensure_ascii=False))
    except Exception as e:
        if a.write:
            record_failure(ROOT/'data/value-update-status.json',e,datetime.now(ZoneInfo('Asia/Seoul')))
        raise
