import importlib.util
import sys
from pathlib import Path
import unittest
import json
import tempfile
import subprocess
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
 def test_denied_automatic_attempt_does_not_change_last_success(self):
  with tempfile.TemporaryDirectory() as directory:
   p=Path(directory)/'status.json';old='2026-11-06T00:00:00Z'
   p.write_text(json.dumps({'games':{'cameraman-td':{'checkedAt':old,'referencedItems':33}}}))
   e=subprocess.CalledProcessError(22,['curl'],stderr=b'curl: (22) The requested URL returned error: 403')
   now=datetime(2026,11,6,10,tzinfo=ZoneInfo('Asia/Seoul'));m.record_failure(p,e,now)
   info=json.loads(p.read_text())['games']['cameraman-td'];self.assertEqual(info['checkedAt'],old);self.assertEqual(info['lastAttemptAt'],now.isoformat(timespec='seconds'));self.assertEqual(info['refreshState'],'blocked');self.assertEqual(info['httpStatus'],403);self.assertEqual(info['referencedItems'],33)

if __name__=='__main__':unittest.main()
