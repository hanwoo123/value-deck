#!/usr/bin/env python3
"""Read public value-list pages; apply each game's verified pricing policy."""
import argparse
from datetime import datetime
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from statistics import median
import sys
import subprocess

# Also support loading this module through importlib in the tests.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from public_sources import parse_public
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]


def number(text):
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*([KMBT]?)\s*', str(text).replace(',', ''), re.I)
    if not match:
        raise ValueError(f'Not an unambiguous positive price: {text!r}')
    value = Decimal(match[1]) * (10 ** (3 * ' KMBT'.index(match[2].upper())) if match[2] else 1)
    if not value.is_finite() or value <= 0:
        raise ValueError('Price must be positive and finite')
    return value


def key(text):
    return ' '.join(text.casefold().split())


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.depth = 0
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.depth += 1
            if self.depth == 1:
                self.table = []
        if self.depth == 1:
            if tag == 'tr':
                self.row = []
            elif tag in ('td', 'th'):
                self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if self.depth == 1:
            if tag in ('td', 'th') and self.cell is not None:
                self.row.append(' '.join(''.join(self.cell).split()))
                self.cell = None
            elif tag == 'tr' and getattr(self, 'row', None):
                self.table.append(self.row)
            elif tag == 'table':
                self.tables.append(self.table)
        if tag == 'table':
            self.depth -= 1


def parse_table(html, source):
    parser = Tables()
    parser.feed(html)
    table = parser.tables[source['table_index']]
    header = [key(x) for x in table[0]]
    name_col = header.index(key(source['name_header']))
    price_col = header.index(key(source['value_header']))
    prices = {}
    for row in table[1:]:
        if len(row) <= max(name_col, price_col):
            continue
        name = key(row[name_col])
        if not name:
            continue
        try:
            value = number(row[price_col])
        except ValueError:
            continue  # Never infer prices from ranges, demand, Robux or arbitrary digits.
        if name in prices:
            raise ValueError(f'Ambiguous duplicate item: {name}')
        prices[name] = value
    if not prices:
        raise ValueError('No valid public table prices parsed')
    return prices


def consensus(values):
    if len(values) < 2:
        return None
    # Remove gross outliers against the robust center first, so a single
    # extreme quote cannot eject the two agreeing quotes. Then check peers.
    center = median(values)
    candidates = [v for v in values if center / 5 <= v <= center * 5]
    if len(candidates) < 2:
        return None
    kept = [v for i, v in enumerate(candidates)
            if median(candidates[:i] + candidates[i+1:]) / 5 <= v <= median(candidates[:i] + candidates[i+1:]) * 5]
    return (median(kept), kept) if len(kept) >= 2 else None


def select_prices(evidence, policy=None):
    if policy and policy.get('mode') == 'primary':
        values = [v for sid, v in evidence if sid == policy['source_id']]
        return (values[0], values) if values else None
    return consensus([v for _, v in evidence])


def update_game(data, quotes, timestamp, policy=None):
    changes = []
    for item in data['items']:
        evidence = [(sid, prices[item['id']]) for sid, prices in quotes.items() if item['id'] in prices]
        primary = policy and policy.get('mode') == 'primary'
        basis = 'primary:' + policy['source_id'] if primary else 'consensus'
        result = select_prices(evidence, policy)
        if result is None:
            if primary:
                old = item.get('value')
                item.update(value=None, valueStatus='pending', valueBasis=basis, trend='stable',
                            note='VVX 기준표에 확정 숫자 시세 없음')
                item.pop('prevValue', None)
                item.pop('referenceValue', None)
                if old is not None:
                    item['valueUpdatedAt'] = timestamp
                    changes.append({'id': item['id'], 'oldValue': old, 'value': None, 'sources': []})
            continue
        candidate, kept = result
        initial = item.get('value') is None and item.get('valueStatus') == 'pending'
        old = None if initial else Decimal(str(item['value']))
        if old is not None and (not old.is_finite() or old <= 0):
            continue
        # Round to the site's integer units BEFORE testing the threshold.
        new = candidate.quantize(Decimal('1'))
        basis_changed = primary and item.get('valueBasis') != basis
        if basis_changed:
            item.pop('prevValue', None)
            item['trend'] = 'stable'
        if primary:
            item.update(valueBasis=basis, valueStatus='confirmed',
                        note=f'VVX 기본 가치표 기준 · {int(new):,} 젬')
            if 'referenceValue' in item:
                item['referenceValue'] = int(new)
        if old is not None and (new == old or (not basis_changed and abs(new-old) * 100 < old * 3)):
            continue
        if old is not None and not basis_changed:
            item['prevValue'] = item['value']
        else:
            item.pop('prevValue',None)
            item['valueStatus'] = 'confirmed'
        item['value'] = int(new)
        item['trend'] = 'stable' if old is None or basis_changed else 'up' if new > old else 'down'
        item['valueUpdatedAt'] = timestamp
        if not primary:
            comparison = f'{len(kept)}곳 비교 · 범위 {min(kept):,}~{max(kept):,}'
            note = re.sub(r'^\d+곳 비교 · 범위 [^·]+(?:·\s*)?', '', item.get('note', '')).strip()
            item['note'] = comparison + (f' · {note}' if note else '')
        changes.append({'id': item['id'], 'oldValue': int(old) if old is not None else None, 'value': int(new),
                        'sources': [{'id': sid, 'value': str(v)} for sid, v in evidence if v in kept and (not primary or sid == policy['source_id'])]})
    if changes:
        data['updated'] = timestamp[:10]
    return changes


def validate_config(config):
    errors = []
    for gid in ('blox-fruits', 'cameraman-td'):
        sources = [s for s in config['games'][gid]['sources'] if s.get('enabled', True)]
        policy = config['games'][gid].get('price_policy', {'mode': 'consensus'})
        primary = policy.get('mode') == 'primary'
        if policy.get('mode') not in ('primary', 'consensus'):
            errors.append(f'{gid}: unknown price policy')
        if primary and policy.get('source_id') not in {s['id'] for s in sources}:
            errors.append(f'{gid}: enabled primary source missing')
        if len(sources) < (1 if primary else 2) or len({s['id'] for s in sources}) != len(sources):
            errors.append(f'{gid}: insufficient or duplicate enabled source IDs')
        urls = []
        for source in sources:
            url = urlparse(source.get('url') or '')
            if url.scheme != 'https' or not url.hostname or url.username or url.password:
                errors.append(f"{gid}/{source['id']}: verified public HTTPS URL missing")
            elif source['url'] in urls:
                errors.append(f'{gid}: duplicate source URL')
            urls.append(source.get('url'))
            if not source.get('verified') or (source.get('parser', 'table') == 'table' and (not source.get('name_header') or not source.get('value_header') or not isinstance(source.get('table_index'), int))):
                errors.append(f"{gid}/{source['id']}: public table mapping not verified")
    if errors:
        raise ValueError('\n'.join(errors))


def fetch_source(source):
    if source.get('parser', 'table') == 'table':
        request = Request(source['url'], headers={'User-Agent': 'VALUE-DECK-price-check/1.0'})
        with urlopen(request, timeout=30) as response:
            if urlparse(response.geturl()).scheme != 'https':
                raise ValueError('Refusing non-HTTPS redirect')
            html = response.read(5_000_001)
            if len(html) > 5_000_000:
                raise ValueError('Source page too large')
            return parse_table(html.decode('utf-8'), source)
    response = subprocess.run(['curl', '--fail', '--silent', '--show-error',
        '--location', '--proto', '=https', '--proto-redir', '=https',
        '--retry', '1', '--retry-delay', '2', '--max-time', '25', '--max-filesize', '5000000', source['url']],
        capture_output=True, check=True)
    return parse_public(response.stdout.decode('utf-8'), source, number, key)


def source_error(error):
    if isinstance(error, subprocess.CalledProcessError):
        return (error.stderr or b'curl failed').decode('utf-8', errors='replace').strip()[-400:]
    return f'{type(error).__name__}: {str(error)[:300]}'


def run(root, config, write=False):
    if config.get('collection_enabled') is False:
        raise ValueError('External price collection is paused pending reuse permission')
    validate_config(config)
    timestamp = datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds')
    pending, report = {}, {'checkedAt': timestamp, 'games': {}, 'sources': {
        gid: {s['id']: {'name': s.get('name', s['id']), 'url': s['url']}
              for s in settings['sources'] if s.get('enabled', True)}
        for gid, settings in config['games'].items()}, 'checks': {}, 'errors': [], 'coverage': {}}
    for gid, settings in config['games'].items():
        data = json.loads((root / 'data' / f'{gid}.json').read_text())
        original = json.dumps(data, sort_keys=True)
        policy = settings.get('price_policy')
        quotes = {}
        for source in settings['sources']:
            if not source.get('enabled', True):
                continue
            try:
                parsed = fetch_source(source)
                names = {item['id']: key(source.get('item_names', {}).get(item['id'],
                    ('Permanent ' + item['name'].removesuffix(' (영구)')) if item.get('category') == '영구 열매' else item['name']))
                    for item in data['items']}
                mapped = {item['id']: parsed[names[item['id']]] for item in data['items']
                    if list(names.values()).count(names[item['id']]) == 1 and names[item['id']] in parsed}
                if not mapped:
                    raise ValueError('No matching item prices')
                quotes[source['id']] = mapped
            except (ValueError, KeyError, IndexError, OSError, InvalidOperation, subprocess.CalledProcessError) as error:
                report['errors'].append({'game': gid, 'source': source['id'], 'name': source.get('name', source['id']), 'error': source_error(error)})
        eligible = sum(select_prices([(sid, prices[item['id']]) for sid, prices in quotes.items() if item['id'] in prices], policy) is not None for item in data['items'])
        primary = policy and policy.get('mode') == 'primary'
        blocked = (policy['source_id'] not in quotes if primary else len(quotes) < 2) or eligible == 0
        changes = [] if blocked else update_game(data, quotes, timestamp, policy)
        report['games'][gid] = changes
        report['coverage'][gid] = {sid: len(prices) for sid, prices in quotes.items()}
        report['checks'][gid] = {'state': 'blocked' if blocked else 'updated' if changes else 'unchanged',
            'pricePolicy': policy or {'mode': 'consensus'}, 'successfulSources': len(quotes), 'eligibleItems': eligible, 'totalItems': len(data['items']), 'changedItems': len(changes)}
        if json.dumps(data, sort_keys=True) != original:
            pending[root / 'data' / f'{gid}.json'] = data
    blocked = any(c['state'] == 'blocked' for c in report['checks'].values())
    report['state'] = 'failed' if blocked else 'degraded' if report['errors'] else 'ok'
    if write:
        # Publish only verified policy results; never fall back to stale source prices.
        if any(report['games'].values()):
            history_path = root / 'data' / 'value-history.json'
            history = json.loads(history_path.read_text()) if history_path.exists() else []
            pending[history_path] = history + [report]
        pending[root / 'data' / 'value-update-status.json'] = report
        for path, content in pending.items():
            temp = path.with_suffix('.json.tmp')
            temp.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')
            temp.replace(path)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Apply changes; default is dry run')
    args = parser.parse_args()
    try:
        config = json.loads((ROOT / 'tools' / 'value-sources.json').read_text())
        report = run(ROOT, config, args.write)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        if report['state'] == 'failed':
            return 1
    except (ValueError, KeyError, IndexError, OSError, InvalidOperation, subprocess.CalledProcessError) as error:
        print(f'Update aborted; source verification required: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
