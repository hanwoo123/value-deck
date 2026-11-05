import copy
from datetime import datetime
from decimal import Decimal as D
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo

ROOT=Path(__file__).parents[1]
spec=importlib.util.spec_from_file_location('compare',ROOT/'tools/update_comparisons.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ComparisonTests(unittest.TestCase):
    now=datetime(2026,11,6,9,tzinfo=ZoneInfo('Asia/Seoul'))
    sources=[{'id':'a','name':'A','url':'https://a.example/values'},{'id':'b','name':'B','url':'https://b.example/values'}]
    def data(self):return {'items':[{'id':'venom','name':'Venom','category':'열매','value':300,'valueBasis':'operator-rules-v1','prevValue':1,'demand':10}]}
    def test_initial_reference_points_are_not_prices_or_percentage_baseline(self):
        d=self.data();count,changes=m.apply(d,self.sources,{'a':({'venom':D(100)},{}),'b':({'venom':D(120)},{})},self.now)
        self.assertEqual(count,1);self.assertEqual(changes,[]);self.assertEqual(d['items'][0]['value'],110)
        self.assertNotIn('prevValue',d['items'][0]);self.assertNotIn('demand',d['items'][0]);self.assertEqual(len(d['items'][0]['priceQuotes']),2)
        self.assertEqual(d['pricingMode'],'comparison');self.assertEqual(d['valueUnit'],'거래가치')
    def test_missing_quorum_and_wide_disagreement_never_fall_back_to_reference_points(self):
        for result in [{'a':({'venom':D(100)},{})},{'a':({'venom':D(100)},{}),'b':({'venom':D(1000)},{})}]:
            d=self.data();count,_=m.apply(d,self.sources,result,self.now);self.assertIsNone(d['items'][0]['value']);self.assertEqual(count,0)
    def page(self,field,rows):return '<script>self.__next_f.push([1,'+json.dumps(json.dumps({field:rows},separators=(',',':')))+'])</script>'
    def test_cosmic_quotes_use_trade_metadata_and_exclude_old_rows(self):
        rows=[{'name':'Venom','category':'Fruits','updatedAt':'2026-11-05T00:00:00Z','metadata':{'regValue':100,'permValue':500,'beliPrice':999,'robuxPrice':9999}}, {'name':'Old','category':'Fruits','updatedAt':'2026-01-01T00:00:00Z','metadata':{'regValue':999}}]
        prices,dates=m.parse_quotes(self.page('initialItems',rows),{'parser':'cosmic-public','minimumPrices':2},self.now)
        self.assertEqual(prices,{'venom':D(100),'permanent venom':D(500)});self.assertEqual(dates['venom'],rows[0]['updatedAt'])
    def test_terms_change_and_robots_disallow_block_before_value_page(self):
        source={'robotsUrl':'https://a.example/robots.txt','termsUrl':'https://a.example/terms','url':'https://a.example/values','reviewedTermsHash':m.terms_hash('<p>Reviewed</p>')}
        with patch.object(m,'get',side_effect=['User-agent: *\nAllow: /','<p>Changed</p>']) as get:
            with self.assertRaisesRegex(ValueError,'Terms changed'):m.fetch_source(source,self.now)
            self.assertEqual(get.call_count,2)
        with patch.object(m,'get',return_value='User-agent: *\nDisallow: /') as get:
            with self.assertRaisesRegex(ValueError,'Robots disallow'):m.fetch_source(source,self.now)
            self.assertEqual(get.call_count,1)
    def test_vvx_blocked_without_network_and_no_redirect_option(self):
        with patch.object(m.subprocess,'run') as request:
            with self.assertRaises(ValueError):m.get('https://cameraman-td.vaultedvaluesx.com/value-list')
            request.assert_not_called()
    def test_failed_run_preserves_prices_and_original_observation_date(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'tools').mkdir();(root/'data').mkdir()
            (root/'tools/comparison-sources.json').write_text(json.dumps({'sources':self.sources}))
            (root/'data/blox-fruits.json').write_text(json.dumps(self.data()))
            report={'state':'comparison','checkedAt':'2026-11-05T00:00:00Z'};(root/'data/value-update-status.json').write_text(json.dumps(report))
            before=(root/'data/blox-fruits.json').read_bytes()
            def unavailable(s,now):raise ValueError('source offline')
            r=m.run(root,unavailable,True);self.assertEqual(r['state'],'blocked');self.assertEqual(before,(root/'data/blox-fruits.json').read_bytes())
            after=json.loads((root/'data/value-update-status.json').read_text());self.assertEqual(after['checkedAt'],report['checkedAt']);self.assertTrue(after['comparisonErrors'])

if __name__=='__main__':unittest.main()
