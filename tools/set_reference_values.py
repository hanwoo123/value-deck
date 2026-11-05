#!/usr/bin/env python3
"""Generate provisional operator comparison points, with no external price inputs or network access."""
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]


def points(item, rules, game):
    config = rules['games'][game]
    if item['id'] in config['overrides']:
        value = config['overrides'][item['id']]
        reason = '운영자 개별 기준'
    elif item['category'] in config['categoryPoints']:
        value = config['categoryPoints'][item['category']]
        reason = item['category'] + ' 공통 기준'
    else:
        value = rules['rarityPoints'].get(item['rarity'])
        factor = config['categoryMultipliers'].get(item['category'], 1)
        if value is not None:
            value *= factor
        reason = item['rarity'] + ' 등급 기준' + (f' × {factor}' if factor != 1 else '')
    if value is not None and (type(value) is not int or not 0 < value <= 10**15):
        raise ValueError('Reference points must be positive safe integers')
    return value, reason


def generate(root=ROOT):
    rules = json.loads((root / 'data/reference-rules.json').read_text())
    if rules['version'] != 1 or rules['unit'] != '참고점':
        raise ValueError('Unknown reference rules')
    today = datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
    pending = {}
    counts = {}
    for gid in rules['games']:
        path = root / 'data' / (gid + '.json')
        data = json.loads(path.read_text())
        data.update(pricingMode='provisional', valueUnit=rules['unit'], updated=today,
                    source='자체 임시 비교점수 · 등급·분류별 고정 기준 · 실제 거래가격 아님')
        counts[gid] = 0
        for item in data['items']:
            value, reason = points(item, rules, gid)
            for field in ['prevValue', 'demand', 'referenceValue', 'referenceSource', 'referenceUrl', 'valueUpdatedAt']:
                item.pop(field, None)
            item.update(value=value, valueStatus='provisional' if value is not None else 'unassigned',
                        valueBasis='operator-rules-v1', trend='stable',
                        note='임시 비교점수 · ' + reason if value is not None else '등급 확인 전 점수 미정')
            counts[gid] += value is not None
        pending[path] = data
    pending[root / 'data/value-history.json'] = []
    pending[root / 'data/value-update-status.json'] = {
        'state': 'provisional',
        'message': '운영자 임시 비교점수 · 실제 거래 시세나 젬·벨리 가격이 아닙니다. 같은 등급·분류는 같은 점수이며 수요·희소성 차이를 반영하지 않습니다.',
        'registeredItems': counts,
    }
    for path, data in pending.items():
        tmp = path.with_suffix('.json.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        tmp.replace(path)
    return counts


if __name__ == '__main__':
    print(json.dumps(generate(), ensure_ascii=False))
