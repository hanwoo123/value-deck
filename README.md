# VALUE DECK
로블록스 여러 게임의 시세표 + 거래 계산기 (정적 사이트)

- data/games.json : 게임 목록 (status: active / hidden)
- data/<게임>.json : 아이템 시세
- images/<게임id>/ : 이미지

로컬 확인: 폴더에서 `python -m http.server 8000` 실행 후 http://localhost:8000
(index.html을 더블클릭하면 JSON을 못 불러옵니다)
자세한 방법은 사이트의 "관리 방법" 메뉴 참고.
