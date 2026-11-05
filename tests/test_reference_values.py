import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('references', ROOT / 'tools/set_reference_values.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ReferenceTests(unittest.TestCase):
    def setUp(self): self.rules = json.loads((ROOT / 'data/reference-rules.json').read_text())
    def test_reference_points_do_not_use_old_prices_demand_or_names(self):
        item = {'id':'a','name':'A','category':'유닛','rarity':'Exclusive','value':475,'demand':10}
        self.assertEqual(m.points(item,self.rules,'cameraman-td')[0],600)
        item.update(name='Different',value=999999,demand=0)
        self.assertEqual(m.points(item,self.rules,'cameraman-td')[0],600)
    def test_categories_permanent_multiplier_and_unknown_grade(self):
        item={'id':'a','category':'열매','rarity':'Rare'}
        self.assertEqual(m.points(item,self.rules,'blox-fruits')[0],15)
        item['category']='영구 열매'
        self.assertEqual(m.points(item,self.rules,'blox-fruits')[0],60)
        item.update(category='상자',rarity='')
        self.assertEqual(m.points(item,self.rules,'cameraman-td')[0],50)
        item.update(category='유닛',rarity='Unknown')
        self.assertIsNone(m.points(item,self.rules,'cameraman-td')[0])
    def test_generation_cleans_external_metadata_and_rejects_bad_rules_before_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'data').mkdir()
            (root/'data/reference-rules.json').write_text(json.dumps(self.rules))
            for gid in self.rules['games']:
                (root/'data'/f'{gid}.json').write_text(json.dumps({'items':[{'id':'a','category':'유닛','rarity':'Mythic','value':99999,'prevValue':475,'demand':10,'referenceValue':99}]}))
            self.assertEqual(m.generate(root),{'blox-fruits':1,'cameraman-td':1})
            data=json.loads((root/'data/cameraman-td.json').read_text())
            self.assertEqual(data['valueUnit'],'참고점')
            self.assertEqual(data['items'][0]['value'],300)
            self.assertFalse(any(k in data['items'][0] for k in ['prevValue','demand','referenceValue']))
            before=(root/'data/blox-fruits.json').read_text()
            self.rules['games']['cameraman-td']['overrides']['a']=-1
            (root/'data/reference-rules.json').write_text(json.dumps(self.rules))
            with self.assertRaises(ValueError):m.generate(root)
            self.assertEqual((root/'data/blox-fruits.json').read_text(),before)

if __name__ == '__main__':unittest.main()
