# VVX 제외 시세 출처 조사 — 2026-11-06

사용자 요청에 따라 VVX 기본표와 VVX 안의 커뮤니티 목록을 전부 수집 대상에서 제외했습니다. 세 커뮤니티 목록 역시 별도 사이트가 아닌 VVX의 목록입니다. 설정에서 비활성화했고 수집 함수에서도 VVX의 루트 및 모든 하위 도메인을 요청 전에 거절합니다.

외부 자동 갱신은 현재 중단 상태입니다. 수동 참고가 전환 초안은 `operator-reference-prices-draft` 로컬 브랜치에만 보관하며 게시하지 않았습니다. 공개 사이트의 기존 저장 가격은 아직 교체하지 않았습니다.

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
