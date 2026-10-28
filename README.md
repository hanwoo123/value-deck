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

### 시세 자동 동기화 (Vaulted Values X)
카메라맨 타워 디펜스, 블록스 프루츠는 아래 명령 한 번으로 최신 시세와 이미지를 받아온다.
```
python tools/sync_vvx.py              # 전체
python tools/sync_vvx.py blox-fruits  # 한 게임만
```
값이 바뀐 아이템은 이전 값이 prevValue로 옮겨져서 사이트에 변동률이 뜬다. 실행 후 commit/push 하면 반영된다.
