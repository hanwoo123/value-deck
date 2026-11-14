"""Refresh a whole reviewed public value list without guessing units, ranges or aliases."""
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
from urllib.robotparser import RobotFileParser
from zoneinfo import ZoneInfo
from public_sources import page_array
from update_comparisons import get, terms_hash
from update_values import key, number, source_error

ROOT = Path(__file__).resolve().parents[1]

def read_rows(source):
    robots = get(source['robotsUrl'], allow_vvx=True)
    policy = RobotFileParser(); policy.parse(robots.splitlines())
    if not all(policy.can_fetch('BLOX-DECKS-price-comparison', u) for u in [source['url'], source['termsUrl']]):
        raise ValueError('Robots disallow access')
    if terms_hash(get(source['termsUrl'], allow_vvx=True)) != source['reviewedTermsHash']:
        raise ValueError('Terms changed: review required before collection')
    rows = page_array(get(source['url'], allow_vvx=True), 'items')
    if len(rows) < source['minimumCatalogItems']:
        raise ValueError('Unexpected public catalog coverage')
    names = set()
    for row in rows:
        if row.get('priceSourceListId') != source['listId']:
            raise ValueError('Unexpected public value list')
        name = key(row['name'])
        if name in names: raise ValueError('Duplicate public item name')
        names.add(name)
    label = source.get('unitEvidenceLabel')
    if label and not any(isinstance(r.get('ownFieldVariants'), dict) and any(isinstance(f, dict) and f.get('label') == label for f in r['ownFieldVariants'].get('fields', [])) for r in rows):
        raise ValueError('Published unit evidence changed')
    return rows

def numeric_quote(raw):
    """O/C, missing values and text are not zero. Preserve decimal prices and ranges."""
    if raw is None: return None
    text = str(raw).strip()
    parts = re.split(r'\s*[–—]\s*|\s+to\s+', text, flags=re.I)
    try:
        if len(parts) not in (1, 2): return None
        values = [number(p) for p in parts]
    except ValueError: return None
    values = [int(v) if v == int(v) else float(v) for v in values]
    if len(values) == 2:
        if values[0] > values[1]: raise ValueError('Reversed published range')
        return {'low': values[0], 'high': values[1]}
    return {'value': values[0]}

def apply(data, rows, source, now):
    by_name = {key(r['name']): r for r in rows}
    if len(by_name) != len(rows): raise ValueError('Duplicate public item name')
    stamp = now.isoformat(timespec='seconds'); result = {'priced': 0, 'ranges': 0, 'unpriced': 0}
    for item in data['items']:
        row = by_name.get(key(source.get('itemNames', {}).get(item['id'], item['name'])))
        quote = None; published = row.get('updatedAt') if row else None
        if isinstance(published, str): published = published.removeprefix('$D')
        valid_date = True
        if published:
            age = now - datetime.fromisoformat(published.replace('Z', '+00:00'))
            valid_date = timedelta(days=-1) <= age <= timedelta(days=source['maximumAgeDays'])
        if row and valid_date:
            quote = numeric_quote((row.get('rawValues') or {}).get('value'))
        if item.get('valueBasis') != 'reviewed-public-list-v2' and item.get('priceQuotes'):
            item['historicalQuotes'] = item.get('historicalQuotes', []) + item['priceQuotes']
        for field in ['prevValue', 'demand', 'valueUpdatedAt', 'referenceValue', 'referenceUrl', 'referenceSource']:
            item.pop(field, None)
        quotes = [{ 'id': source['id'], 'name': source['name'], 'url': source['url'], **quote,
                    'unit': source['valueUnit'], 'unitVerified': source['unitVerified'],
                    'publishedAt': published, 'observedAt': stamp }] if quote else []
        value = quote.get('value') if quote else None
        status = 'single' if value is not None else 'range' if quote else 'insufficient'
        result['priced' if value is not None else 'ranges' if quote else 'unpriced'] += 1
        item.update(value=value, valueStatus=status, valueBasis='reviewed-public-list-v2', priceQuotes=quotes,
                    trend='stable', priceReviewedAt=stamp,
                    priceValidUntil=(min(now, datetime.fromisoformat(published.replace('Z','+00:00'))) + timedelta(days=source['maximumAgeDays'])).isoformat(timespec='seconds') if quote and published else (now + timedelta(days=source['maximumAgeDays'])).isoformat(timespec='seconds') if quote else None,
                    note='단일 목록 참고값 · 실제 거래 체결가 아님' if value is not None else '범위 참고 · 합산 보류' if quote else '현재 원문에 확인되는 숫자 없음 · 합산 보류')
    if result['priced'] < source['minimumPrices']:
        raise ValueError('Unexpected numeric coverage; keeping prior catalog')
    data.update(updated=stamp[:10], pricingMode='comparison', valueUnit=source['valueUnit'],
                source='공개 가치 목록의 단일 출처 표기값 · 평균·확정 거래가 아님',
                pricePolicy={'maximumAgeDays': source['maximumAgeDays'], 'unitVerified': source['unitVerified'],
                             'unitNote': source['unitNote'], 'refreshHours': 6},
                priceReview={'checkedAt': stamp, 'method': 'whole-public-html', **result})
    return result

def write_json(path, value):
    tmp = path.with_suffix('.json.tmp'); tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n'); tmp.replace(path)

def run(game_id, root=ROOT, write=False):
    source = json.loads((root/'tools/reference-catalog-sources.json').read_text())[game_id]
    path = root/'data'/f'{game_id}.json'; data = json.loads(path.read_text())
    now = datetime.now(ZoneInfo('Asia/Seoul'))
    try:
        rows = read_rows(source); result = apply(data, rows, source, now)
    except Exception as error:
        if write:
            status_path = root/'data/value-update-status.json'; report = json.loads(status_path.read_text())
            info = report.setdefault('games', {}).setdefault(game_id, {})
            message = source_error(error)[:250]
            info.update(lastAttemptAt=now.isoformat(timespec='seconds'), refreshState='blocked' if '403' in message or '401' in message else 'error', error=message)
            write_json(status_path, report)
        raise
    if write:
        status_path = root/'data/value-update-status.json'; report = json.loads(status_path.read_text())
        report.setdefault('games', {})[game_id] = {'mode': 'reference-list', 'referencedItems': result['priced'],
            'rangeItems': result['ranges'], 'unpricedItems': result['unpriced'], 'sourceCount': 1,
            'checkedAt': now.isoformat(timespec='seconds'), 'lastAttemptAt': now.isoformat(timespec='seconds'),
            'refreshState': 'ok', 'message': '공개 원문 전체 확인 · 단일 목록 참고값'}
        if game_id == 'cameraman-td': report.pop('ctdReferenceError', None)
        write_json(path, data); write_json(status_path, report)
    return result
