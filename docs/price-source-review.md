# VVX 제외 시세 출처 조사 — 2026-11-06

사용자 요청에 따라 VVX 기본표와 VVX 안의 커뮤니티 목록을 전부 수집 대상에서 제외했습니다. 세 커뮤니티 목록 역시 별도 사이트가 아닌 VVX의 목록입니다. 설정에서 비활성화했고 수집 함수에서도 VVX의 루트 및 모든 하위 도메인을 요청 전에 거절합니다.

기존 전체 출처 자동 갱신은 중단 상태입니다. 추가 검토 후 블록스 프루츠에 한해 두 사이트의 공개 숫자 비교를 별도 수집기로 적용합니다(문서 마지막 적용 결정 참고). 수동 참고가 전환 초안은 `operator-reference-prices-draft` 로컬 브랜치에만 보관하며 게시하지 않았습니다. 기존 외부 가격·수요·공개 변동 이력은 2026-11-06 제거했으며, 현재 공개 사이트는 운영자 임시 비교점수를 사용합니다.

## 카메라맨 TD 후보

아래는 검색에서 해당 게임의 가격표를 찾은 후보입니다. 검색 결과는 본문·최신 가격·재게시 권한을 검증한 증거가 아니며 아직 자동 갱신에 연결하지 않았습니다.

| 출처 | 가격표 | 현재 확인 상태 |
| --- | --- | --- |
| Pro Game Guides | https://progameguides.com/roblox/cameraman-tower-defense-trading-value-list-roblox/ | 검색 결과에 2026년 11월 가치표 노출, 원문 확인 필요 |
| CameramanTowerDefense.com | https://cameramantowerdefense.com/values/ | 검색 결과에 38개 유닛·상자·패스 가치표 노출, 원문 확인 필요 |
| BloxRant | https://bloxrant.com/values/cameraman-td | 검색 결과에 젬 가치·수요·가격 범위 설명, 원문 확인 필요 |
| Of Zen and Computing | https://www.ofzenandcomputing.com/cameraman-tower-defense-trading-value-list-roblox/ | 검색 결과에 게임별 가치표 노출, 원문 확인 필요 |
| Cameraman Tower Defense Wiki | https://www.cameramantower-defense.wiki/en/units/cameraman-tower-defense-unit-values | 검색 결과의 관측 날짜는 2026-10-24, 최신성 및 출처 확인 필요 |

## 블록스 프루츠 후보 및 기존 출처

- https://bloxfruitsvalues.com/values — `.gg`와 다른 도메인. 검색에서 가격표를 확인했으며 원문·이용 조건 확인 필요.
- https://bloxfruitsvalues.gg/values — 기존 연결 출처. https://bloxfruitsvalues.gg/terms 에 명시적인 외부 가격표 재게시 허용을 확인하지 못함.
- https://bloxfruit.io/ — 기존 검토에서는 오래된 관측 자료 때문에 제외. 최신 가격과 이용 조건을 재검토해야 함.
- FantasyBlox — https://fantasyblox.com/legal/terms-of-service 4항은 자동화로 서비스를 복제하는 행위를 제한하며, 9항은 원본 자료의 무단 복제·재게시·변경을 제한. 별도 허용 근거 없이 자동 수집에 다시 연결하지 않음.

## 새 출처 확인이 막힌 이유

현재 작업 환경의 제한된 HTTP 접속 허용 목록에 새 도메인이 없어 직접 접근이 차단됩니다. 홈페이지를 통해 접근하거나 프록시를 우회하지 않습니다. 기존 허용 목록을 보존하면서 위 후보의 정확한 도메인들을 추가하는 환경 설정 초안을 저장했습니다. 도구 응답은 `status: saved`, `requires_publish: true`이며, 사용자가 환경 설정 변경을 저장·게시해야 실제 접근 정책에 적용됩니다.

접근이 가능해지면 본문과 약관·라이선스·robots 안내를 확인하고, 게임 및 아이템·변형·젬/거래 가치 단위·관측 날짜를 대조합니다. VVX의 값을 그대로 인용한 다른 사이트를 독립적인 근거로 세지 않습니다. 확인된 가격과 이용 범위에 맞춰 연결하며, 이번 조사만으로 자동 수집이나 재게시가 허용된다고 단정하지 않습니다.

## 추가 확인 — 2026-11-06

- CameramanTowerDefense.com 본문을 새 환경에서 읽었습니다. 자체 시세가 아니라 VVX 보드 56개 항목의 관측값이라고 명시하므로 대체 가격 출처에 연결하지 않습니다.
- Pro Game Guides 원문을 읽었으나 재게시 권한을 확인하지 못해 가격표를 복제하지 않았습니다.
- 현재 사이트에는 외부 시세 대신 운영자가 정한 등급·분류별 임시 비교점수를 적용합니다. 실제 게임 화폐 가격이나 실거래 시세를 뜻하지 않습니다.

## 약관 원문 재검토 — 2026-11-06

현재 환경에서 아래 원문을 직접 읽었습니다. 금지 문구가 없다는 사실과 외부 사이트에서 가격표를 자동 수집·재게시할 권한을 확인했다는 것은 구분합니다. 공개 페이지에 사실인 숫자가 있다는 이유만으로 모든 이용이 금지된다고 단정하지도 않습니다. 이 표는 법적 허용 여부의 확정 판단이 아니라 연결을 재개할 근거를 확인한 기록입니다.

| 후보 | 읽은 문서 | 확인 결과 | 연결 상태 |
| --- | --- | --- | --- |
| bloxfruit.io | https://bloxfruit.io/terms/ | `Use automated tools to scrape or download content`를 금지하며 무단 복제도 제한 | 제외 |
| FantasyBlox | https://fantasyblox.com/legal/terms-of-service | 4항 자동화로 서비스 복제 제한, 9항 원본 자료 무단 재게시 제한 | 제외 |
| BloxFruitsValues.com (Cosmic Values 운영) | https://bloxfruitsvalues.com/terms-of-service | 원문에 가격표 자동 수집·외부 재게시를 명시적으로 허용한 조항을 확인하지 못함. 이용자 콘텐츠의 사용 허락은 해당 서비스에 부여한 것이며 우리 사이트에 대한 허락이 아님 | 허용 근거 미확인 |
| BloxFruitsValues.gg | https://bloxfruitsvalues.gg/terms | 기존 검토에서 가격표 외부 재게시 허용 근거 미확인. .com과는 별도 도메인으로 구분 | 허용 근거 미확인 |
| Cameraman Tower Defense Wiki | https://www.cameramantower-defense.wiki/en/terms-of-service | 약관은 정보·오락 목적 안내와 오용 금지 등을 명시. CC 등 공개 데이터 라이선스나 자동 재게시 허용은 확인하지 못함. 가치표는 2026-10-24 관측값으로 현재 가격과도 구분 필요 | 허용 근거·최신성 미확인 |
| CameramanTowerDefense.com | https://cameramantowerdefense.com/values/ | 본문에서 숫자가 VVX 보드에서 왔다고 명시 | VVX 제외 요청에 따라 제외 |
| Pro Game Guides | https://progameguides.com/roblox/cameraman-tower-defense-trading-value-list-roblox/ | 본문은 읽었으나 약관 링크는 `gamurs.group/terms/`이며 이 도메인은 현재 환경에서 접근 차단. `/terms/`는 404이므로 약관으로 취급하지 않음 | 약관 확인 미완료 |
| Of Zen and Computing | https://www.ofzenandcomputing.com/cameraman-tower-defense-trading-value-list-roblox/ | 본문은 읽었으나 추정한 약관 경로는 홈페이지로 리디렉션됨. 해당 응답을 약관 확인으로 취급하지 않음 | 약관·이용 범위 미확인 |
| BloxRant | https://bloxrant.com/ | 사이트에서 403 차단 응답. 이를 우회하지 않음 | 원문 확인 불가 |

### 공개 API/저장소 추가 검토

- https://github.com/Cyerc/123demands-Value-Fetcher 는 MIT로 공개된 **수집 코드**입니다. 그 라이선스가 외부 123demands 가격 데이터의 재배포 허락까지 증명하지 않으므로 가격 출처 라이선스로 사용하지 않습니다.
- https://github.com/iliaprogrammer/bloxfruits-api 는 README에서 외부 웹사이트 스크래핑과 `No license has been specified`를 명시합니다. 공개 API 코드라는 이유로 가격 이용 허락을 확보한 것으로 취급하지 않습니다.
- https://github.com/gloomysummer/ctd-guide-wiki 는 README에서 가격 원문을 VVX로 명시합니다. 다른 도메인·GitHub를 거쳐 VVX 값이 다시 들어오지 않도록 제외합니다.

현재 확인한 후보로는 두 게임의 자동 수집·재게시 범위를 확인한 독립 출처 두 곳을 확보하지 못했습니다. 이번 검토에서 가격을 복구하거나 자동 수집을 재개하지 않았습니다. 임시 점수를 외부 시세로 바꾸어 표시하지 않습니다.

## 적용 결정 — 공개 숫자 비교에 한정

추가로 두 블록스 프루츠 사이트의 robots 원문을 읽어 공개 `/values`가 허용되어 있고 `/api/` 등에 제한이 있음을 확인했습니다. 검토한 약관에 명시적인 읽기 전용 공개 가격 숫자 비교 금지 조항이 없다는 범위에서 가격 숫자·이름 대응·관측일만 사용하기로 했습니다. 명시적 재게시 허락을 받았다거나 평균 계산으로 원본의 이용 조건이 소멸한다는 의미가 아닙니다. 약관·robots를 검사하고 공개 HTML만 읽으며 서술·디자인·수요 평가·이미지는 수집하지 않습니다. 가격 비교로 사용할 수 없는 항목을 임시 점수로 채우지 않습니다.

BloxFruitsValues.com 공개 HTML의 `initialItems`에 있는 `metadata.regValue` 및 `metadata.permValue`와 BloxFruitsValues.gg의 `physical_value`/`permanent_value`만 사용합니다. 게임 상점 `beliPrice`·`robuxPrice`는 사용하지 않습니다. 개별 관측 날짜와 출처 원문 링크를 표시합니다. 약관의 검토 시점과 텍스트 해시는 `tools/comparison-sources.json`에 기록했으며 변경 시 수집을 멈춥니다.

카타디는 이번에 같은 조건으로 확인한 두 출처를 확보하지 못해 외부 가격으로 전환하지 않았습니다. 임시 비교점수 표시를 유지하고 블록스 프루츠의 거래가치와 섞지 않습니다.

## 누락 항목 전수 대조 — 2026-11-06

블록스 프루츠 전체 135개를 대상으로 다시 대조했습니다. 기존 수집기는 BloxFruitsValues.com의 첫 열매 목록 24개만 읽고 게임패스·한정 아이템 목록과 하위 상세 페이지를 누락했습니다. 공개 사이트맵의 경로와 실제 원문을 확인해 분류 목록 2개 및 상세 페이지 36개(총 추가 페이지 38개)를 같은 출처에 합쳤습니다. 공개 상세 `item` 객체와 React Flight의 `$D` 날짜 직렬화를 읽으며 Gamepasses/Limiteds의 거래가치도 `metadata.regValue`에서 읽습니다. API/로그인/제한 페이지는 요청하지 않습니다.

- 공개 수치 비교 가능: 111개(기존 45개에서 66개 증가).
- 단일 출처 참고만 가능: 23개. 숫자·출처는 표시하되 평균과 계산기 합산은 보류.
- 검증된 숫자 없음: Eclipse 1개. `Chromatic Eclipse`를 같은 아이템으로 추정해 넣지 않음.
- 공개 원문 수정일이 오래됐거나 값을 비워둔 경우 두 번째 출처를 확보한 것으로 세지 않습니다. 일반/영구·기본/변형 아이템을 합쳐 빈칸을 채우지 않습니다.
- 확인한 명시적 표기 차이만 설정에 기록합니다: +1 Fruit Storage/Fruit Storage, Arcsteel/Arc Steel, Eagle Matrix/Matrix Eagle, Eagle Requiem/Requiem Eagle, Eagle Glacier/Glacier Eagle, Meme-Meme/Meme. 실제 공개 이름을 유지하고 게임/변형이 불명확한 다른 별칭은 사용하지 않습니다.

개별 대조 결과: `docs/blox-fruits-coverage.csv`. 여러 공개 페이지를 방문해도 한 사이트는 출처 하나로만 셉니다.

### 카타디 추가 후보 조사

- CTD Hub: https://cameramantowerdefensehub.wiki/trading/ — 검색에서 별도 가격표를 찾았으나 원문 접근 도메인 추가가 필요. 검색 요약의 가격 기준일은 2026-10-21이므로 현재 자료와 구분해야 함.
- Google Sites: https://sites.google.com/view/ctdvalues/values — 제목 `ST: CTD Website - Values`, 게임 및 단위·원본·날짜 확인 전에는 연결하지 않음.
- Google Sites: https://sites.google.com/view/ctdvaluelist/home — 설명은 Classic Tower Defense를 가리켜 Cameraman TD와 다른 게임일 가능성이 높음. 같은 CTD 약칭이라는 이유로 사용하지 않음.
- https://github.com/Mentalitys-valueweb/Ctd-Value-List-website — 원문 README는 Dimasha Studios의 CTD라고 명시. Aligators Games의 Cameraman TD 자료로 사용하지 않음.
- 추가 블록스 프루츠 후보 https://123demands.com/ — 공개 수집 코드에서 `https://123demands.com/api/value-list?gameId=bf`를 확인. API가 존재한다는 사실만 확인했으며 운영자 문서·robots·이용 조건을 읽기 전에는 호출하지 않음.
- Pro Game Guides의 실제 약관은 https://gamurs.group/terms/ 에 있으므로 기존 작업 환경 허용 목록 밖인 해당 도메인 추가가 필요.

필수 원문 확인용 `gamurs.group`, `cameramantowerdefensehub.wiki` 두 도메인만 추가하는 환경 설정 초안을 저장했습니다. 저장 결과는 `requires_publish: true`이며 아직 실행 환경에 적용됐다고 주장하지 않습니다. 두 곳을 읽기 전까지 카타디 외부 비교값을 만들거나 임시 점수를 실제 젬 가격으로 바꾸지 않습니다. 모든 인터넷 사이트를 빠짐없이 검색했다는 뜻은 아니며, 이번에 발견하고 접근·원문·게임 정체를 확인한 범위를 기록한 것입니다.

## 게시된 새 환경에서의 최종 확인 — 2026-11-06

- 실제 GAMURS 약관 https://gamurs.group/terms 를 읽었습니다. 3항은 `unauthorised automated means of compiling information`을 제한하며 복제·데이터베이스 입력·게시 등을 제한하고, 6항은 콘텐츠 재이용을 제한합니다. 적용 사이트 목록에 Pro Game Guides가 명시되어 있어 가격 수집 대상으로 추가하지 않았습니다. `robots Allow`만 보고 약관상 허용됐다고 해석하지 않습니다.
- CTD Hub https://cameramantowerdefensehub.wiki/trading/ 는 현재 숫자 시세를 확립하지 못했다고 명시하고, 설명에 사용하는 기존 목록은 VVX 자료라고 밝힙니다. 새로운 독립 가격표로 사용하지 않습니다.
- Of Zen and Computing 원문 https://www.ofzenandcomputing.com/cameraman-tower-defense-trading-value-list-roblox/ 에서 공개된 숫자 범위만 읽습니다. 게시자 정책 https://www.ofzenandcomputing.com/disclosure-policy/ 및 robots 원문을 확인했습니다. 이 정책은 재게시 라이선스가 아니라 disclosure 문서이며, 별도 수집·재게시 허락을 받았다고 주장하지 않습니다. 공개 숫자의 제한적 요약·출처 링크·날짜만 표시하는 운영 결정입니다.
- 공개 범위는 33개 기존 카탈로그 아이템에 대응합니다. 동일 게시물의 Top 10과 본문 표에 중복된 행을 여러 출처로 세지 않습니다. 수요 점수와 설명·이미지는 수집하지 않습니다. 표의 `Value in gems` 열만 읽고 다른 게임 비교 예시나 획득 비용은 읽지 않습니다.
- 원문에 확인되지 않는 4개는 숫자를 만들지 않습니다. 33개도 한 출처에서만 확인한 범위이므로 `value=null`을 유지하고 비교 평균·합산에 사용하지 않습니다.

### 첫 자동 실행 검증 결과

사이트 게시와 로컬 원문 확인은 성공했지만 GitHub 실행 `42137591815`에서는 Of Zen and Computing 게시자 정책 페이지의 curl 요청이 실패했습니다. 정확한 HTTP 원인은 확보하지 못했으므로 차단 원인을 단정하지 않습니다. 카타디 파일을 덮어쓰지 않고 기존 관측일을 유지했으며 공개 상태 파일의 `ctdReferenceError`로 실패를 알립니다. 자동 수집이 성공했다고 취급하지 않습니다. 블록스 프루츠 수집과 정적 사이트 배포는 성공했습니다.

## 사용자의 VVX 재연결 요청 적용 — 2026-11-06

앞선 VVX 제외 요청을 철회하는 명시적 요청에 따라, 원문·robots·약관을 다시 읽고 두 게임의 VVX 공개 숫자 목록을 설정에 추가했습니다. 명시적 공개 페이지 옵션이 없으면 VVX 요청은 계속 차단하며, API·개인 페이지·다른 하위 도메인·목록 ID는 거절합니다. 이 변경을 게시자의 개별 허락이나 평균 계산에 따른 권리 이전이라고 표현하지 않습니다.

카타디는 37개 중 36개의 VVX 숫자를 단일 출처 참고가로 표시하며 Pharaoh의 `O/C`는 숫자로 만들지 않습니다. 블록스 프루츠는 현재 135개 모두 확인된 숫자가 있으며, 비교 평균/출처 편차에 따른 VVX 참고/단일 출처의 상태를 따로 기록합니다. 초기 기준 변경의 퍼센트와 수요 점수를 만들지 않습니다.
