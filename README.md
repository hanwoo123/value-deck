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

### 임시 비교점수 — 2026-11-06

현재 숫자는 실제 거래 시세나 젬·벨리·로벅스 가격이 아닌 운영자의 임시 비교점수입니다. 외부 가격표의 값을 복사하거나 조금 변경해 만든 값이 아닙니다. `data/reference-rules.json`의 등급·분류별 고정 규칙만 사용하고, 기존 가격·수요·이전 값은 입력으로 사용하지 않습니다. 같은 등급과 분류의 아이템은 같은 점수이며 실제 수요·수량·성능·희소성 차이는 반영하지 않습니다. 거래 의사결정용 시장 평가로 해석하면 안 됩니다.

- 일반 1, 고급 5, 희귀 15, 영웅 40, 전설 100, 신화 300, 한정/Exclusive 600, Godly 800 참고점.
- 게임패스는 종류와 관계없이 임시 250점, 상자는 임시 50점입니다.
- 영구 열매는 같은 등급 일반 열매 점수의 4배입니다. 이 배수는 운영자 가정이며 거래 시장에서 검증한 비율이 아닙니다.
- 등급이 확인되지 않은 유닛은 점수 미정이며 계산기에서 비교를 보류합니다. 0점으로 처리하지 않습니다.
- 시세표, 거래 계산기, 거래글 합계는 동일한 생성 데이터를 사용합니다. 시장 상승률·수요·가격 이력을 표시하지 않으며 계산 결과는 점수 차이로만 설명합니다.

기준 수정은 `data/reference-rules.json`에서 등급 점수, 분류 점수, 게임별 `overrides`의 개별 점수를 수정한 다음 `python tools/set_reference_values.py`를 실행하면 됩니다. 생성된 두 게임 JSON과 함께 커밋하면 사이트에 반영됩니다. 이 도구는 네트워크에 접근하지 않습니다.

외부 자동 수집은 계속 중단 상태입니다. 워크플로는 비활성화했고 예약 실행을 제거했으며 `collection_enabled: false`로 수동 실행도 요청 전에 차단합니다. VVX와 VVX 커뮤니티 목록은 모두 비활성화하고 수집 함수에서도 루트·하위 도메인 요청을 차단합니다. [새 출처 검토 기록](docs/price-source-review.md)에 조사 상태를 기록합니다. CameramanTowerDefense.com의 가격은 원문에서 VVX를 재인용한다고 명시했으므로 독립 출처로 연결하지 않았습니다.

이번 변경은 가격 데이터에 대한 것으로, 모든 게임 이미지·자산의 이용 허락을 확인했다는 의미는 아닙니다. 기존 거래글·채팅·알림과 보존 기간은 유지합니다.

검증: `python -m unittest discover -s tests -v`, `npm test`.

### Discord 거래 알림

새 공개 거래글을 지정한 Discord 채널에 기존 봇 또는 웹훅으로 알리는 서버 코드를 준비했습니다. 봇 토큰은 서버의 비밀 설정에만 저장합니다. **Edge Function 배포·비밀 설정·대기열/활성화 SQL 적용 전에는 실제 전송되지 않습니다.** [Discord 연결 안내](supabase/README-discord.md)를 따라 설정합니다. 개인 채팅이나 과거 거래글은 전송 대상이 아닙니다.

### 자동 마감·정리

거래글은 등록 6시간 후 공개 목록에서 숨기고 자동 마감하며, 마감 후 7일이 지나면 연결된 대화와 함께 삭제합니다. 완료된 알림 기록과 이 사이트의 예약 실행 로그도 7일 후 정리합니다. 활성화하려면 [자동 정리 SQL](supabase/migrations/202611050003_trade_retention.sql)을 한 번 실행하세요. 기존 글에도 적용되며, 실행 전까지 실제 DB 자동 정리는 활성화되지 않습니다. 상세 동작은 [보존 기간 안내](supabase/README.md#거래글대화-자동-보존-기간)를 참고하세요.
