import sys,json,tempfile,copy
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from unittest import TestCase,main
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]/'tools'))
import reference_catalog as m
class CatalogTests(TestCase):
 def setUp(self):
  self.now=datetime(2026,11,14,20,tzinfo=ZoneInfo('Asia/Seoul'))
  self.source={'id':'s','name':'Source','url':'https://example.com/value-list','valueUnit':'목록 참고가치','unitVerified':False,'unitNote':'단위 미표기','maximumAgeDays':7,'minimumPrices':1,'itemNames':{'alias':'old name'}}
 def test_decimal_range_qualitative_and_invalid_values(self):
  self.assertEqual(m.numeric_quote('0.75'),{'value':0.75});self.assertEqual(m.numeric_quote('14,000–15,000'),{'low':14000,'high':15000})
  for x in ['O/C',None,'','free','0','-20','NaN']:self.assertIsNone(m.numeric_quote(x))
  with self.assertRaises(ValueError):m.numeric_quote('9–3')
 def test_exact_alias_decimal_preservation_archive_and_missing_are_not_zero(self):
  d={'items':[{'id':'alias','name':'Canonical','value':99,'priceQuotes':[{'low':5,'high':8,'unit':'Fins'}],'tradeReady':False},{'id':'r','name':'Range'},{'id':'m','name':'Missing'}]}
  r=m.apply(d,[{'name':'old name','rawValues':{'value':'0.75'}},{'name':'Range','rawValues':{'value':'10–20'}}],self.source,self.now)
  self.assertEqual(r,{'priced':1,'ranges':1,'unpriced':1});a=d['items'][0]
  self.assertEqual(a['value'],0.75);self.assertFalse(a['tradeReady']);self.assertEqual(a['historicalQuotes'][0]['unit'],'Fins');self.assertNotIn('prevValue',a)
  self.assertIsNone(d['items'][1]['value']);self.assertIsNone(d['items'][2]['value']);self.assertEqual(d['items'][2]['priceQuotes'],[])
  self.assertEqual(datetime.fromisoformat(a['priceValidUntil']),self.now+timedelta(days=7))
 def test_stale_known_publication_date_is_not_renewed_by_new_observation(self):
  d={'items':[{'id':'a','name':'A'},{'id':'b','name':'B'}]}
  m.apply(d,[{'name':'A','rawValues':{'value':'1'}},{'name':'B','updatedAt':'2026-10-31T00:00:00Z','rawValues':{'value':'400'}}],self.source,self.now)
  self.assertEqual(d['items'][0]['value'],1);self.assertIsNone(d['items'][1]['value']);self.assertEqual(d['items'][1]['priceQuotes'],[])
 def test_failed_refresh_does_not_replace_prices_or_success_dates(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);(root/'tools').mkdir();(root/'data').mkdir()
   (root/'tools/reference-catalog-sources.json').write_text(json.dumps({'king-legacy':self.source}))
   p=root/'data/king-legacy.json';p.write_text(json.dumps({'items':[{'id':'a','name':'A','value':50}]}));before=p.read_text()
   status=root/'data/value-update-status.json';status.write_text(json.dumps({'games':{'king-legacy':{'checkedAt':'2026-11-01','referencedItems':1}}}))
   with patch.object(m,'read_rows',side_effect=ValueError('Terms changed')):
    with self.assertRaises(ValueError):m.run('king-legacy',root,True)
   self.assertEqual(p.read_text(),before);info=json.loads(status.read_text())['games']['king-legacy'];self.assertEqual(info['checkedAt'],'2026-11-01');self.assertEqual(info['referencedItems'],1);self.assertEqual(info['refreshState'],'error')
 def test_wrong_list_or_changed_unit_evidence_is_rejected(self):
  source={**self.source,'robotsUrl':'https://example.com/robots.txt','termsUrl':'https://example.com/terms','reviewedTermsHash':m.terms_hash('terms'),'minimumCatalogItems':1,'listId':'expected','unitEvidenceLabel':'1 value = 1 gem'}
  with patch.object(m,'get',side_effect=['User-agent: *\nAllow: /','terms','html']),patch.object(m,'page_array',return_value=[{'name':'A','priceSourceListId':'other'}]):
   with self.assertRaisesRegex(ValueError,'Unexpected public value list'):m.read_rows(source)
  with patch.object(m,'get',side_effect=['User-agent: *\nAllow: /','terms','html']),patch.object(m,'page_array',return_value=[{'name':'A','priceSourceListId':'expected','ownFieldVariants':'$undefined'}]):
   with self.assertRaisesRegex(ValueError,'unit evidence'):m.read_rows(source)
if __name__=='__main__':main()
