import copy
from decimal import Decimal as D
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import tempfile
import json

spec = importlib.util.spec_from_file_location('update', Path(__file__).parents[1] / 'tools/update_values.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)


class UpdateTests(unittest.TestCase):
    def game(self, value=100):
        return {'updated': '2026-01-01', 'items': [{'id': 'a', 'name': 'A', 'value': value, 'note': '2곳 비교 · 범위 90~110 · 메모'}]}

    def update(self, values, old=100):
        data = self.game(old)
        changes = u.update_game(data, {str(i): {'a': D(str(v))} for i, v in enumerate(values)}, '2026-11-02T12:00:00+09:00')
        return data, changes

    def test_threshold_inclusive_both_directions(self):
        for price in (103, 97):
            data, changes = self.update([price, price])
            self.assertEqual(len(changes), 1)
            self.assertEqual(data['items'][0]['prevValue'], 100)
            self.assertEqual(data['items'][0]['value'], price)
            self.assertEqual(data['updated'], '2026-11-02')

    def test_below_threshold_preserves_every_field(self):
        data = self.game(1000)
        original = copy.deepcopy(data)
        self.assertEqual(u.update_game(data, {'s1': {'a': D(1029)}, 's2': {'a': D(1029)}}, '2026-11-02'), [])
        self.assertEqual(data, original)

    def test_one_source_and_conflicting_sources_cannot_update(self):
        for values in ([110], [100, 10000], [0, 100]):
            data, changes = self.update(values)
            self.assertEqual(changes, [])

    def test_median_excludes_outlier(self):
        data, changes = self.update([110, 112, 10000])
        self.assertEqual(data['items'][0]['value'], 111)
        self.assertEqual(len(changes[0]['sources']), 2)
        self.assertIn('2곳 비교 · 범위 110~112 · 메모', data['items'][0]['note'])

    def test_repeat_does_not_erase_previous_value(self):
        data, _ = self.update([110, 110])
        original = copy.deepcopy(data)
        self.assertEqual(u.update_game(data, {'x': {'a': D(110)}, 'y': {'a': D(110)}}, '2026-11-03'), [])
        self.assertEqual(data, original)

    def test_numbers_and_ambiguous_prices(self):
        self.assertEqual(u.number('1.5B'), D(1500000000))
        self.assertEqual(u.number('1,200'), D(1200))
        for text in ('N/A', '-2', '0', '10/10', '100-200', '$100', 'NaN', 'Infinity'):
            with self.assertRaises(ValueError):
                u.number(text)

    def test_public_html_table_and_distinct_variants(self):
        html = '<table><tr><th>Name</th><th>Value</th><th>Robux</th></tr><tr><td>Dragon</td><td>1B</td><td>500</td></tr><tr><td>Permanent Dragon</td><td>5B</td><td>1000</td></tr></table>'
        result = u.parse_table(html, {'table_index': 0, 'name_header': 'Name', 'value_header': 'Value'})
        self.assertEqual(result['dragon'], D(10**9))
        self.assertEqual(result['permanent dragon'], D(5*10**9))
        with self.assertRaises(ValueError):
            u.parse_table(html, {'table_index': 0, 'name_header': 'Name', 'value_header': 'Trade Price'})

    def test_both_games_write_history_and_repeat_without_changes(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def geturl(self): return 'https://example.com/values'
            def read(self, limit):
                return b'<table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>110</td></tr></table>'
        config = {'games': {gid: {'sources': [
            {'id': str(i), 'url': f'https://example.com/{gid}/{i}', 'verified': True,
             'table_index': 0, 'name_header': 'Name', 'value_header': 'Value'}
            for i in range(2)]} for gid in ('blox-fruits', 'cameraman-td')}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            for gid in config['games']:
                (root / 'data' / f'{gid}.json').write_text(json.dumps(self.game()))
            with patch.object(u, 'urlopen', return_value=Response()):
                report = u.run(root, config, write=False)
                self.assertEqual(len(report['games']['blox-fruits']), 1)
                self.assertFalse((root / 'data/value-history.json').exists())
                u.run(root, config, write=True)
                before = {p: p.read_bytes() for p in (root / 'data').iterdir() if p.name != 'value-update-status.json'}
                u.run(root, config, write=True)
                self.assertEqual(before, {p: p.read_bytes() for p in (root / 'data').iterdir() if p.name != 'value-update-status.json'})
                self.assertEqual(len(json.loads((root / 'data/value-history.json').read_text())), 1)
            with patch.object(u, 'urlopen', side_effect=OSError('source unavailable')):
                report=u.run(root, config, write=True)
                self.assertEqual(report['state'],'failed')
                self.assertEqual(json.loads((root/'data/value-update-status.json').read_text())['state'],'failed')
                self.assertEqual(before, {p: p.read_bytes() for p in (root / 'data').iterdir() if p.name != 'value-update-status.json'})

    def test_failed_source_does_not_block_valid_quorum_or_other_game(self):
        config={'games':{gid:{'sources':[
            {'id':str(i),'url':f'https://example.com/{gid}/{i}','verified':True,'parser':'table','table_index':0,'name_header':'Name','value_header':'Value'}
            for i in range(3)]} for gid in ('blox-fruits','cameraman-td')}}
        def fetch(source):
            if source['id']=='2' or ('cameraman-td' in source['url'] and source['id']=='1'):
                raise ValueError('source changed')
            return {'a':D(110)}
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'data').mkdir()
            for gid in config['games']:(root/'data'/f'{gid}.json').write_text(json.dumps(self.game()))
            with patch.object(u,'fetch_source',side_effect=fetch):
                report=u.run(root,config,write=True)
            self.assertEqual(report['state'],'failed')
            self.assertEqual(report['checks']['blox-fruits']['state'],'updated')
            self.assertEqual(report['checks']['cameraman-td']['state'],'blocked')
            self.assertEqual(json.loads((root/'data/blox-fruits.json').read_text())['items'][0]['value'],110)
            self.assertEqual(json.loads((root/'data/cameraman-td.json').read_text())['items'][0]['value'],100)
            self.assertTrue(json.loads((root/'data/blox-fruits.json').read_text())['items'][0]['valueUpdatedAt'])
            with patch.object(u,'fetch_source',side_effect=lambda source: (_ for _ in ()).throw(ValueError('offline')) if source['id']=='2' else {'a':D(110)}):
                report=u.run(root,config,write=True)
            self.assertEqual(report['state'],'degraded')
            self.assertTrue(report['errors'])
            self.assertEqual(report['checks']['cameraman-td']['state'],'updated')

    def test_pending_new_unit_waits_for_two_sources_then_gets_first_price(self):
        data=self.game();item=data['items'][0];item.update(value=None,valueStatus='pending',referenceValue=1500)
        original=copy.deepcopy(data)
        self.assertEqual(u.update_game(data,{'official':{'a':D(1500)}},'2026-11-05'),[])
        self.assertEqual(data,original)
        changes=u.update_game(data,{'official':{'a':D(1500)},'community':{'a':D(1700)}},'2026-11-05')
        self.assertEqual(item['value'],1600)
        self.assertEqual(item['valueStatus'],'confirmed')
        self.assertNotIn('prevValue',item)
        self.assertEqual(item['trend'],'stable')
        self.assertIsNone(changes[0]['oldValue'])
        self.assertEqual(item['valueUpdatedAt'],'2026-11-05')

    def test_public_page_payloads_and_variants(self):
        from public_sources import page_array, parse_public
        def page(field, rows):
            payload = json.dumps({field: rows}, separators=(',', ':'))
            return '<script>self.__next_f.push([1,' + json.dumps(payload) + '])</script>'
        rows = [{'name': 'Dragon', 'category': 'Mythical', 'priceSourceListId': 'expected',
                 'rawValues': {'value': '100', 'permValue': '500', 'beliPrice': '999'}}]
        html = page('items', rows)
        parsed = parse_public(html, {'parser': 'vvx', 'list_id': 'expected', 'minimum_prices': 2}, u.number, u.key)
        self.assertEqual(parsed, {'dragon': D(100), 'permanent dragon': D(500)})
        self.assertEqual(page_array(html + html, 'items'), rows)
        with self.assertRaises(ValueError):
            parse_public(html, {'parser': 'vvx', 'list_id': 'wrong'}, u.number, u.key)
        with self.assertRaises(ValueError):
            page_array(html + page('items', [{'name': 'different'}]), 'items')
        for parser, field, row in [
            ('bloxfruitsvalues', 'fruits', {'name': 'Dragon', 'category': 'fruit', 'physical_value': 100, 'permanent_value': 500, 'money_price': 999}),
            ('fantasyblox', 'initialOverrides', {'itemName': 'Dragon', 'category': 'fruits', 'value': '100', 'permValue': '500'})]:
            self.assertEqual(parse_public(page(field, [row]), {'parser': parser, 'minimum_prices': 2}, u.number, u.key), parsed)

    def test_missing_sources_fails_before_network_or_write(self):
        config = json.loads((Path(__file__).parents[1] / 'tools/value-sources.json').read_text())
        config['games']['blox-fruits']['sources'][0]['url'] = None
        with tempfile.TemporaryDirectory() as directory, patch.object(u, 'urlopen') as network:
            with self.assertRaises(ValueError):
                u.run(Path(directory), config, write=True)
            network.assert_not_called()
            self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
