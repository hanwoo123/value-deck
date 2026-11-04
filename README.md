# VALUE DECK (bloxdecks.com)
로블록스 여러 게임의 시세표 + 거래 계산기 (정적 사이트)

- data/games.json : 게임 목록 (status: active / hidden), 디스코드 초대 링크
- data/<게임>.json : 아이템 시세
- images/<게임id>/ : 이미지

로컬 확인: 폴더에서 `python -m http.server 8000` 실행 후 http://localhost:8000
(index.html을 더블클릭하면 JSON을 못 불러옵니다)

## 관리 방법
코드를 건드리지 않고 JSON 파일과 이미지만 수정하면 됩니다.

### 1. 새 게임 추가
1. `data/` 폴더에 게임 파일을 만든다. 예: `data/blox-fruits.json` (샘플 파일 복사)
2. `data/games.json`의 `games` 배열에 항목 추가
3. 이미지는 `images/게임id/` 폴더에 넣기

```json
{
  "id": "blox-fruits",
  "name": "블록스 프루츠",
  "status": "active",
  "dataFile": "data/blox-fruits.json",
  "cover": "images/blox-fruits/cover.png",
  "accent": "#ff8a3d",
  "description": "열매·게임패스 시세"
}
```

### 2. 게임 숨기기 / 삭제
- 잠깐 내리기: `"status": "hidden"` (데이터는 남음)
- 완전 삭제: `games.json`에서 항목 삭제 + 게임 JSON과 이미지 폴더 삭제

### 3. 아이템 추가 / 시세 업데이트
게임 JSON의 `items` 배열을 수정하고 `updated` 날짜를 바꾼다.

```js
{
  "id": "dragon",            // 고유 ID (영문, 중복 X)
  "name": "용의 열매",
  "category": "열매",        // categories 목록 중 하나
  "rarity": "Mythic",        // Mythic / Legendary / Epic / Rare / Common
  "value": 4500000,          // 숫자만 (쉼표 X)
  "demand": 5,               // 수요 0~5
  "trend": "up",             // up / down / stable
  "image": "images/blox-fruits/dragon.png",
  "note": ""
}
```
(실제 JSON에는 `//` 주석을 넣으면 안 됨)

시세를 바꿀 때 원래 값을 `"prevValue"`에 옮기고 `"value"`를 새 값으로 바꾸면 카드와 홈 "최근 시세 변동"에 변동률이 표시된다. 표시를 없애려면 `prevValue` 줄 삭제.

### 디스코드 버튼
`data/games.json` 맨 위 `"discordInvite"`에 초대 링크를 넣으면 상단에 버튼이 생긴다. 비우면 버튼이 사라진다.

### 4. 이미지
- 아이템: 투명 배경 PNG, 정사각형(256×256 정도)
- 게임 커버: 16:9 (1280×720 정도)
- 이미지가 없거나 경로가 틀리면 아이템 이름 첫 글자가 대신 표시됨

### 시세 기준 및 자동 업데이트

공개 시세 페이지의 거래 가치 중간값을 사용합니다. 현재 저장된 값과 **3% 이상** 차이가 나면 별도 승인 없이 자동으로 반영합니다. 비교는 **매시간 17분**에 실행하며 GitHub Actions에서 수동 실행도 가능합니다.

현재 검증해 연결한 출처(2026-11-02):

- 블록스 프루츠: [VVX 공식](https://blox-fruits.vaultedvaluesx.com/value-list), [BloxFruitsValues.gg](https://bloxfruitsvalues.gg/values), [FantasyBlox](https://fantasyblox.com/games/blox-fruits/values)
- 카메라맨 TD: [VVX 공식](https://cameraman-td.vaultedvaluesx.com/value-list), [Peak values ig](https://cameraman-td.vaultedvaluesx.com/lists/peak-values-ig-7ad104da-cfda-812b-af36-2c33958f98fb), [CTD VALUE](https://cameraman-td.vaultedvaluesx.com/lists/ctd-value-289bb241-c5a4-89b0-a927-d028ac7ae6de), [Second-Best Value List](https://cameraman-td.vaultedvaluesx.com/lists/better-value-list-2dd620c2-6007-836b-afc1-05d2d3a8a344)

과거 README의 6곳/5곳 전체를 연결했다고 가정하지 않습니다. 과거 커뮤니티 3개 주소는 기록에 없어, 이번에 공개 페이지를 확인한 위 3개 목록으로 고정했습니다. 커뮤니티 목록은 품질이 다르고 Second-Best 목록은 일부 큰 아이템을 공식표에 맞춘다고 밝히고 있어, 완전히 독립적인 4개 시장 조사는 아닙니다. Cosmic Values는 접속 오류, Game.Guide는 접근 차단, Trade Hub는 정확한 출처 미확인으로 제외했습니다. bloxfruit.io는 공개 표의 관측 날짜가 오래되어 현재 비교에는 포함하지 않습니다. 제외한 출처는 설정에 남겨두되 자동 사용하지 않습니다.

- 최소 2개 등록 출처에 정확한 이름으로 있는 아이템만 갱신합니다. 영구 열매와 일반 열매, 구매 가격(Beli/Robux)과 거래 가치는 분리합니다. 이름이 다르면 명시적인 `item_names` 매핑이 필요하며 비슷한 이름을 추측하지 않습니다.
- 중앙값의 1/5 미만 또는 5배 초과인 극단값을 먼저 제외하고, 남은 값에서도 다른 값의 중간값과 같은 기준으로 비교합니다. 최종 2개 이상이 남아야 합니다.
- 범위 값, `800+`, `N/A`, 0, 음수는 단일 확정 가격으로 해석하지 않고 제외합니다.
- 중간값을 정수 단위로 반올림한 뒤 3% 경계값을 검사합니다. 3% 미만이면 기존 값과 변동 내역을 그대로 둡니다.
- 갱신 시 `prevValue`, `value`, `trend`, 게임의 `updated`, 카드의 비교 범위를 기록합니다. 홈의 기존 ‘최근 시세 변동’에도 표시됩니다. `data/value-history.json`에는 변경 시각·이전 값·새 값·근거 가격·출처 URL을 누적합니다.
- 공개 HTML에 포함된 페이지 데이터를 읽으며 비공개 API를 호출하지 않습니다. 실패한 출처는 해당 실행에서 제외하되 아이템별 유효한 가격 2개 이상을 확보한 경우만 반영합니다. 한 게임의 비교 출처가 부족하면 그 게임의 기존 가격은 유지하고, 검증 가능한 다른 게임은 계속 갱신합니다.

### 실행과 배포

Python 3.12 및 curl이 필요합니다. 추가 Python 패키지는 필요 없습니다.

```sh
python3 -m unittest discover -s tests -v
python3 tools/update_values.py          # 비교만
python3 tools/update_values.py --write  # 실제 변경 반영
```

출처 설정은 `tools/value-sources.json`, 공개 페이지 파서는 `tools/public_sources.py`입니다. 출처별 최소 가격 개수와 VVX 목록 ID를 검사합니다. 추가 출처는 실제 페이지·단위·아이템 매핑을 검증한 뒤 활성화해야 합니다.

`.github/workflows/update-values.yml`이 예약 갱신·커밋·배포를 수행합니다. `.github/workflows/deploy.yml`은 main에 반영한 사이트 변경을 배포합니다. Pages 배포 액션이 직접 게시하며, 기존 main 브랜치 기반 Pages 설정에서도 실제 배포 성공을 확인했습니다. 예약 작업은 GitHub 사정에 따라 지연되거나 장기 비활성 저장소에서 중단될 수 있습니다. 실패 내역은 저장소 Actions에서 확인할 수 있습니다. 클라우드 환경 Publish와 사이트 배포는 별개입니다.

### 블록스 프루츠 거래 게시판

`#/trades`에서 Roblox 사용자 이름을 직접 저장하고 거래글을 등록합니다. 닉네임은 사용자 입력이며 계정 소유 인증을 뜻하지 않습니다. 사이트는 기존 GitHub Pages를 유지하고 거래글만 Supabase에 저장합니다. 별도 Render 서버나 Roblox OAuth 등록은 필요하지 않습니다.

Supabase 초기 설정과 RLS 권한은 [연결 안내](supabase/README.md)를 참고하세요. SQL 적용과 익명 사용자 인증 활성화 전에는 거래글 등록이 작동하지 않습니다. 테스트: `npm ci && npm test`. 닉네임과 작성자 세션은 브라우저에 보관되므로 브라우저 데이터를 지우면 기존 글의 관리 권한을 복구하기 어렵습니다.

거래글은 이미지·수량·현재 시세 합계를 표시합니다. 1:1 채팅은 작성자와 문의자별로 분리되며 **내 채팅**에서 다시 열 수 있습니다. 채팅 활성화를 위해 [채팅 SQL](supabase/migrations/202611020002_trade_chat.sql)을 한 번 더 적용하세요. 기존 거래글은 유지됩니다.

거래 게시판은 블록스 프루츠와 카메라맨 TD를 지원합니다. 게임별로 거래 목록이 나뉘며, 아이템 선택창에서 이름 검색·카테고리 필터·이미지 선택을 사용할 수 있습니다. 카메라맨 TD 거래 활성화에는 [게임 확장 SQL](supabase/migrations/202611030001_trade_games.sql)을 한 번 적용해야 합니다.


### 자동 갱신 상태 확인

`data/value-update-status.json`은 매 실행의 한국 시간 확인 시각, 게임별 갱신/변동 없음/확인 중단, 성공한 출처 수, 아이템 비교 범위, 실패 출처와 오류를 기록합니다. 가격 변동이 없어도 확인 기록은 저장·배포됩니다. 홈페이지와 시세표에 ‘최근 시세 확인’을 표시하므로 마지막 가격 변경 날짜와 마지막 비교 시각을 구분할 수 있습니다.

‘최근 시세 변동’은 아이템의 `valueUpdatedAt`을 기준으로 최신 변경순으로 보여주고 같은 실행에서 변한 항목만 변동률순으로 정렬합니다. 과거 날짜 없는 항목은 그 뒤에 표시합니다. 최대 6개 표시이며 실제 변경 전체는 `value-history.json`에 남습니다.

작업은 매시간 17분 예약이지만 GitHub 상황에 따라 지연될 수 있습니다. 적어도 한 게임에서 유효한 출처를 확보하지 못하면 확인 가능한 게임/확인 기록을 먼저 저장·배포한 후 워크플로는 실패로 표시합니다. 일부 출처만 실패하고 두 게임의 비교가 가능하면 `degraded` 상태로 기록합니다. 실패가 조용히 묻히거나 오래된 가격을 최신으로 간주하지 않습니다.

### 2026-11-05 카메라맨 TD 신규 유닛

공식 공개 가치표에서 Hacked Cameraman, Pharaoh Cameraman, Upgraded Titan TV Man을 확인해 카탈로그와 이미지를 추가했습니다. 공식 상세 페이지는 각 아이템의 `referenceUrl`에 기록했습니다. 당시 공식 표에 등급은 미표기이고 비교 중인 다른 3개 목록에는 없어 `rarity: Unknown`, `value: null`, `valueStatus: pending`으로 구분합니다. VVX 공식의 단일 참고 가격은 별도 `referenceValue`이며 비교 시세나 0 가치로 취급하지 않습니다.

시세표·거래 아이템 선택창에는 ‘시세 확인 중’, 계산기에는 ‘비교 보류’를 표시합니다. 최소 2개 유효 출처가 확인되면 자동 갱신이 첫 비교 시세를 등록하고 이후 3% 변동 규칙을 적용합니다. 최초 등록에는 이전 값이 없어 변동률을 만들지 않습니다.

거래글에도 새 유닛을 사용하려면 [신규 유닛 허용 SQL](supabase/migrations/202611050001_ctd_new_units.sql)을 Supabase SQL Editor에서 한 번 실행하세요. 기존 거래글·채팅은 변경하지 않습니다.

### Discord 거래 알림

새 공개 거래글을 지정한 Discord 채널에 기존 봇 또는 웹훅으로 알리는 서버 코드를 준비했습니다. 봇 토큰은 서버의 비밀 설정에만 저장합니다. **Edge Function 배포·비밀 설정·대기열/활성화 SQL 적용 전에는 실제 전송되지 않습니다.** [Discord 연결 안내](supabase/README-discord.md)를 따라 설정합니다. 개인 채팅이나 과거 거래글은 전송 대상이 아닙니다.
