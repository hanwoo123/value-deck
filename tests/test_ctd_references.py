import importlib.util
import sys
from pathlib import Path
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import update_ctd_references as m
class CTDReferenceTests(unittest.TestCase):
 def page(self,rows):return '<script type="application/ld+json">{"dateModified":"2026-11-03T12:00:00Z"}</script><table><tr><th>Unit</th><th>Value in gems</th><th>Demand</th></tr>'+''.join('<tr><td>'+n+'</td><td>'+v+'</td><td>10</td></tr>' for n,v in rows)+'</table>'
 def test_public_ranges_not_demand_or_cross_game_guide_table(self):
  h=self.page([(f'Unit {i}','500 – 1,000') for i in range(30)])
  ranges,published=m.parse_ranges(h);self.assertEqual(ranges['unit 0'],(500,1000));self.assertEqual(published,'2026-11-03T12:00:00Z')
  with self.assertRaises(ValueError):m.parse_ranges(h+self.page([('Unit 0','800 – 900')]))
 def test_reference_only_never_turns_range_or_old_points_into_price(self):
  d={'items':[{'id':'a','name':'Unit A','value':600,'demand':9,'prevValue':100},{'id':'b','name':'Unknown','value':800}]}
  s={'id':'s','name':'Source','url':'https://example.com/article'}
  count=m.apply(d,{'unit a':(500,1000)},'2026-11-03T12:00:00Z',s,datetime(2026,11,6,tzinfo=ZoneInfo('Asia/Seoul')))
  self.assertEqual(count,1);self.assertTrue(all(i['value'] is None for i in d['items']));self.assertNotIn('demand',d['items'][0]);self.assertNotIn('prevValue',d['items'][0]);self.assertEqual(d['items'][0]['priceQuotes'][0]['low'],500);self.assertEqual(d['items'][1]['priceQuotes'],[]);self.assertEqual(d['pricingMode'],'reference')
if __name__=='__main__':unittest.main()
