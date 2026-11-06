"""Parse the data embedded in public value-list pages; never call private APIs."""
import json
import re


def page_array(html, field):
    chunks = re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html)
    payload = ''.join(json.loads(m.group(1)) for m in chunks)
    marker = json.dumps(field) + ':'
    arrays = []
    for match in re.finditer(re.escape(marker), payload):
        try:
            value, _ = json.JSONDecoder().raw_decode(payload[match.end():])
            if isinstance(value, list) and value not in arrays:
                arrays.append(value)
        except json.JSONDecodeError:
            continue
    if len(arrays) != 1 or not arrays[0]:
        raise ValueError(f'Expected one nonempty public {field} array')
    return arrays[0]


def parse_public(html, source, number, key):
    kind = source['parser']
    field = {'vvx': 'items', 'bloxfruitsvalues': 'fruits', 'fantasyblox': 'initialOverrides'}[kind]
    rows = page_array(html, field)
    prices = {}
    def add(name, raw):
        try:
            value = number(raw)
        except ValueError:
            return
        name = key(name)
        if name in prices:
            raise ValueError(f'Duplicate public item name: {name}')
        prices[name] = value
    for row in rows:
        if kind == 'vvx':
            if row.get('priceSourceListId') != source['list_id']:
                raise ValueError('VVX page contains values from an unexpected list')
            raw = row['rawValues']
            add(row['name'], raw.get('value'))
            if row.get('category') not in ('Limited', 'Gamepass', 'Gamepasses'):
                add('Permanent ' + row['name'], raw.get('permValue'))
        elif kind == 'bloxfruitsvalues':
            add(row['name'], row.get('physical_value'))
            if row.get('category') == 'fruit':
                add('Permanent ' + row['name'], row.get('permanent_value'))
        else:
            add(row['itemName'], row.get('value'))
            if row['category'] == 'fruits':
                add('Permanent ' + row['itemName'], row.get('permValue'))
    if len(prices) < source.get('minimum_prices', 10):
        raise ValueError('Public price coverage unexpectedly low')
    return prices


def page_object(html, field):
    """Read one object embedded in a public detail page, never an API endpoint."""
    chunks = re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html)
    payload = ''.join(json.loads(m.group(1)) for m in chunks)
    marker = json.dumps(field) + ':'
    objects = []
    for match in re.finditer(re.escape(marker), payload):
        try:
            value, _ = json.JSONDecoder().raw_decode(payload[match.end():])
            if isinstance(value, dict) and value not in objects:
                objects.append(value)
        except json.JSONDecodeError:
            continue
    if len(objects) != 1:
        raise ValueError(f'Expected one public {field} object')
    return objects[0]
