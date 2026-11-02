# 거래 게시판 운영

현재 상태: Node 서버와 거래 게시판 구현 완료. 실서비스 OAuth 연결·호스팅·DNS 전환은 아직 필요합니다. 기존 GitHub Pages에서는 서버 API가 없으므로 게시판 준비 안내를 표시합니다. 브라우저 저장소에 가짜 로그인이나 거래글을 만들지 않습니다.

## 기본 구성

Node.js 24의 내장 HTTP 서버 및 SQLite 사용. 추가 npm 패키지 없음. 정적 사이트와 `/api/*`, `/auth/*`를 같은 도메인에서 제공합니다. 운영 DB는 영구 디스크에 두어야 합니다. GitHub Pages만으로 로그인과 공유 거래글을 운영할 수 없습니다.

```sh
node --test tests/trades.test.mjs
node server/app.mjs
```

설정 없이 로컬 시작 시 http://localhost:3000 에서 시세표·계산기·거래 목록을 확인할 수 있지만 로그인은 비활성입니다. 거래글 작성·완료 기능은 Roblox 인증이 필요합니다. `node:sqlite`는 Node 버전에 따라 실험 기능 경고를 출력할 수 있습니다.

운영 변수는 `.env.example` 참고. 서버는 `.env`를 자동으로 읽지 않으므로 호스팅의 환경 변수 설정을 사용합니다. `.env` 파일을 사용하는 로컬 환경에서는 Node 24의 `node --env-file=.env server/app.mjs`를 사용할 수 있습니다. 실제 비밀값을 Git이나 채팅에 넣지 않습니다.

## 배포 순서 (운영자 작업 필요)

1. Render 계정을 만들고 이 GitHub 저장소를 연결한 뒤 Blueprint로 `render.yaml`을 선택합니다. **starter 서버와 영구 디스크는 유료 구성**입니다. 이 코드는 서비스를 자동 구매하거나 계정을 만들지 않습니다. 한 인스턴스 운영이 기본이며, SQLite 파일을 휘발성 디스크에 두거나 여러 인스턴스 간 공유하지 않습니다.
2. Render가 발급한 HTTPS 주소를 확인합니다. 해당 주소를 `SITE_URL`로 설정합니다(끝 `/` 없이 origin만). 로그인 없이 서버를 먼저 시작해 `/api/me`가 응답하는지 확인할 수 있습니다.
3. [Roblox Creator Hub](https://create.roblox.com/dashboard/credentials)에서 공식 OAuth 앱을 등록합니다. 플랫폼이 요구하는 계정 조건·앱 공개/검토 절차를 완료해야 일반 방문자도 로그인할 수 있습니다. Redirect URI는 `https://호스팅주소/auth/roblox/callback`, 범위는 `openid profile`입니다. 비밀번호나 Roblox 세션 쿠키를 수집하지 않습니다.
4. Render 환경 변수에 앱의 `ROBLOX_CLIENT_ID`와 `ROBLOX_CLIENT_SECRET`을 안전하게 입력하고 재배포합니다. 비밀키는 서버에만 있으며 브라우저에 전달하지 않습니다. 공식 로그인 화면 → 본인 @사용자 이름 표시 → 거래 등록 → 다른 브라우저 공개 목록 확인 → 본인 완료 표시를 검증합니다. 이 단계는 실제 앱 자격증명이 있어야 검증할 수 있습니다.
5. 로그인·글 저장 확인 후 `bloxdecks.com`을 Render의 커스텀 도메인으로 연결하고 Render가 안내하는 DNS로 변경합니다. DNS/HTTPS 준비를 확인한 뒤 `SITE_URL=https://bloxdecks.com`으로 바꾸고 Roblox Redirect URI도 `https://bloxdecks.com/auth/roblox/callback`으로 등록합니다. 기존 GitHub Pages는 전환 확인까지 보존합니다.
6. Render 자동 배포가 main 변경을 감지하도록 유지합니다. 자동 시세 갱신 작업이 main에 커밋한 JSON도 서버 재배포에 포함됩니다. 매일 데이터가 바뀌더라도 거래 DB는 `/data/trades.sqlite`에 남습니다. 영구 디스크 백업 및 복원은 호스팅 설정에서 활성화하고, 운영 전 복구 절차를 확인합니다. DB 파일에는 사용자 ID와 거래 정보가 있으므로 공개 저장소에 올리지 않습니다.

## 구현 범위

- Roblox 공식 OAuth의 authorization code + PKCE S256, 일회성 state와 브라우저 쿠키 연결, 만료 검증.
- 공식 userinfo 응답에서만 Roblox 사용자 ID·@사용자 이름·표시 이름 저장. access token을 DB나 로그에 저장하지 않음.
- HttpOnly / SameSite 쿠키(HTTPS 운영 시 Secure), 세션 7일, Origin + CSRF 토큰 검사.
- 블록스 프루츠 아이템 1~8개씩, 수량 1~99, 메모 200자. 닉네임·작성자 ID는 클라이언트 입력을 신뢰하지 않음.
- 공개 진행 목록과 페이지네이션, 내 글 목록, 작성자만 완료 처리. 진행 글 최대 5개, 1분당 1개 등록.
- 거래 상대의 실제 Roblox 프로필로 이동. 게임 내부 교환, 아이템 보관, 결제, 채팅은 구현하지 않음.
- 현재 자동화 테스트는 제공자 응답을 테스트 안에서 모의하여 인증·권한·CSRF를 검증함. 실제 Roblox 앱 승인은 검증하지 못함.

공개 커뮤니티 확대 전 운영자의 신고 접수·삭제 대응과 개인정보 안내를 마련해야 합니다. 현재 구현은 작성자 완료 처리까지이며 관리자 삭제 UI는 포함하지 않습니다.
