# VALUE DECK

로블록스 아이템 참고자료와 거래 비교 계산기. 정적 사이트: https://bloxdecks.com

## 현재 설정 — 2026-11-14 재검토

| 게임 | 가격 기준 | 갱신 |
|---|---|---|
| 블록스 프루츠 | 기존 공개 숫자 비교 규칙 유지 | 6시간 |
| 카타디 | VVX 공개 원문 전체 목록, 단일 출처 표기 젬 | 6시간 |
| 킹피스 | VVX 공개 원문 전체 목록, 단일 출처 목록 참고가치 | 6시간 |

카타디는 62개 항목(캐릭터 52개, 패스/상자 10개) 중 숫자 45개·범위 1개·숫자 미확인 16개입니다. 킹피스는 136개 중 숫자 126개·미확인 10개입니다. 원문에 숫자가 없거나 O/C인 항목을 0이나 등급별 임시 점수로 만들지 않습니다. 범위의 중간값도 확정 가격으로 만들지 않습니다. 현재 62개 카타디 항목과 126개 킹피스 항목에 실제 이미지가 있습니다.

킹피스 원문은 단위를 명시하지 않습니다. 같은 목록의 숫자만 비교하며 Fins·Robux·현금으로 환산하지 않습니다. 이전 PGG의 Fins 범위는 `historicalQuotes`와 이전 기록에만 보관하고 현재 계산에 섞지 않습니다. Game.Guide의 공개 아이템 수정일이 2026-10-31인 자료는 화면의 상대적 업데이트 문구만 보고 최신 가격으로 사용하지 않았습니다. 출처 간 같은 원자료를 사용하는지도 불명확하므로 독립된 시장 두 곳을 비교했다고 주장하지 않습니다.

표시값은 단일 공개 목록의 참고값이며 실제 거래 체결가나 자체 조사한 시세가 아닙니다. 화면에는 출처별 숫자·링크를 나열하지 않지만 JSON의 원문 링크와 관측 시각은 공개 상태로 보존합니다.

## 데이터와 수집

- 게임 메뉴: `data/games.json`, 아이템: `data/<game>.json`, 이미지: `images/<game>/`
- 카타디/킹피스의 유일한 운영 출처 설정: `tools/reference-catalog-sources.json`
- 공통 수집·단위·범위·소수 처리: `tools/reference_catalog.py`
- 블록스 프루츠 설정: `tools/comparison-sources.json`
- 갱신 상태: `data/value-update-status.json`, 예약: `.github/workflows/update-comparisons.yml`

카타디/킹피스 수집기는 robots·검토된 약관 해시·공개 목록 ID·중복 이름·최소 항목 수를 확인합니다. 카타디는 원문의 `1 value-1 gem btw` 단위 표기가 바뀌어도 중단합니다. 허용한 공개 `/value-list`, `/robots.txt`, `/terms-of-service`만 읽고 로그인·비공개 API·다른 목록으로 확장하지 않습니다. 이미지는 수집기와 분리해 공개 페이지에서 확인한 원본을 수동 보관했습니다. 별도 재사용 허락이나 게시자 보증을 받았다는 뜻은 아닙니다.

```sh
python tools/update_ctd_references.py          # 확인만
python tools/update_king_references.py         # 확인만
python tools/update_ctd_references.py --write  # 자료 적용
python tools/update_king_references.py --write # 자료 적용
```

성공한 전체 수집에서만 자료 관측일을 바꿉니다. 실패하면 이전 값과 관측일을 보존하고 마지막 시도·실패 상태만 기록합니다. 게시 수정일이 알려져 있고 7일을 넘으면 배제합니다. 수정일이 미공개인 자료는 관측일과 구분합니다. 브라우저에서도 자료 유효 기한이 지나면 카드·계산기·거래 합계를 모두 보류합니다. 소수값을 정수로 잘라내지 않으며 범위는 합산하지 않습니다.

과거 임시 점수 생성 도구는 현재 운영 데이터에 실행하지 않습니다. 새 게임/새 이름을 연결할 때는 ID를 바꾸지 않고 출처 이름 매핑·검색 별칭을 설정합니다. 카타디의 이름이 달랐던 3개는 원본 이미지 대조로 통합했고 Headless TV Man은 유닛 목록과 가치표의 등급 분류가 달라 Unknown으로 보류했습니다.

## 거래글 DB

사용자가 킹피스·카타디 통합 SQL 적용 완료를 확인하여 킹피스 게시판과 카타디 신규 25개 항목의 등록 잠금을 해제했습니다. 기존 거래글과 채팅은 유지합니다.

재실행 가능한 추가 SQL은 `supabase/pending/catalogs-20261114.sql`에 보관합니다. 운영 DB 실행은 사용자가 수행했으며 이번 사이트 변경에서 별도 DB 쓰기는 수행하지 않았습니다.

Discord 알림 카탈로그와 배포용 번들은 현재 이름·이미지에 맞게 준비했습니다. 운영 알림에 반영하려면 별도 Edge Function 배포가 필요합니다. 기존 연결·채팅·보존 기간 안내는 `supabase/README.md`와 `supabase/README-discord.md`를 참고하세요.

## 확인 기록

- `docs/catalog-audit-20261114.json`: 자료 선택·제외, 단위, 이름 매칭, 등급 충돌
- `docs/catalog-images-20261114.json`: 새 이미지 원문 URL·해시·관측 기록
- `docs/king-legacy-rarities.json`: 기존 희귀도 조사 기록
- `docs/archive/`: 재검토 이전 상태와 설정 기록. 현재 운영 설정이 아닙니다.

로컬 미리보기는 `python -m http.server 8000`. `npm ci && npm test`, `python -m unittest discover -s tests -v`로 검증합니다.

검색 비노출 메타 태그와 robots.txt는 유지하며 접속 인증·비공개 기능은 아닙니다.
