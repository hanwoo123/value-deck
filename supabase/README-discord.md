# 공개 거래글 → Discord 알림

상태: 코드·대기열·권한·재시도 테스트 준비 완료. **실제 Supabase 함수 배포와 비밀 설정 전에는 알림이 활성화되지 않습니다.** 기존 Discord 봇 또는 채널 웹훅 중 하나로 전송합니다. 봇 방식은 해당 봇 이름으로, 웹훅 방식은 웹훅 설정 이름으로 표시됩니다. 토큰/웹훅 URL은 서버 비밀 설정에서만 읽습니다.

새 공개 거래글만 작성자 닉네임, 게임, 주는/받는 아이템과 수량, 메모, 첫 아이템 이미지, 해당 게임 게시판 링크를 보냅니다. 링크는 게임 게시판이며 메시지 제목에 글 번호를 표시합니다. 기존 글 일괄 전송, 개인 채팅, 수정/완료 알림은 포함하지 않습니다. `@everyone`·역할·사용자 멘션 알림은 비활성입니다.

## 운영자 설정 순서

1. **기존 봇을 사용할 경우:** Discord Developer Portal에서 노출된 토큰을 Reset Token으로 폐기·재발급합니다. 봇이 알림 받을 서버/채널에 들어와 있고 **채널 보기(View Channel), 메시지 보내기(Send Messages), 링크 삽입(Embed Links)** 권한이 있는지 확인합니다. 메시지를 읽는 기능은 없어 Message Content Intent는 필요하지 않습니다. Discord 개발자 모드를 켜고 대상 채널의 ID를 복사합니다.
2. Supabase **Edge Functions → Secrets**에 아래 항목을 저장합니다.

   | 이름 | 값 |
   |---|---|
   | `DISCORD_BOT_TOKEN` | **재발급한** 봇 토큰. 채팅·GitHub에 보내지 않음 |
   | `DISCORD_CHANNEL_ID` | 알림을 받을 채널 ID |
   | `TRADE_WEBHOOK_SECRET` | 비밀번호 관리자로 생성한 32자 이상의 충분히 긴 무작위 문자열 |

   여기서 `TRADE_WEBHOOK_SECRET`은 DB가 Edge Function을 호출할 때 쓰는 별도의 공유 비밀이며, Discord 봇 토큰과는 다릅니다.

   **웹훅 방식을 선택하는 경우:** 채널 설정 → 연동(Integrations) → 웹후크(Webhooks)에서 생성한 URL을 `DISCORD_WEBHOOK_URL`에 저장하고 `TRADE_WEBHOOK_SECRET`도 저장합니다. 이 경우 봇 토큰/채널 ID는 설정하지 않습니다. 봇 설정이 하나라도 있으면 봇 방식으로 검사하며 불완전한 설정으로 웹훅에 자동 우회하지 않습니다.

   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function 런타임이 제공하는 서버용 값입니다. 프런트엔드에 추가하거나 저장소에 복사하지 않습니다. 봇 토큰이나 웹훅 URL을 이전 대화에 올렸다면 반드시 재발급/재생성해서 폐기한 값이 사용되지 않도록 합니다.
3. 이 저장소를 내려받은 PC에서 [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)를 준비하고 다음을 실행합니다. 관리 권한이 있는 본인 Supabase 계정으로 로그인합니다. 공개 publishable key만으로는 함수 배포가 불가능합니다. 이 채팅에는 Supabase 관리용 연결과 새 비밀 설정이 없어 아직 실제 배포/전송을 수행하지 않았습니다.

   ```sh
   supabase login
   supabase functions deploy trade-discord --project-ref xmdmwchfbroitizgtmlo --no-verify-jwt
   ```

   JWT 검증 대신 2번의 서버 전용 공유 비밀 헤더를 검사합니다. 비밀이 없거나 맞지 않으면 DB/Discord 호출 전에 거부합니다. 함수는 요청에 들어온 거래글 내용을 전달하지 않고 DB의 전송 대기열과 공개 거래글을 다시 읽습니다.
4. Supabase **SQL Editor**에서 `migrations/202611050002_discord_outbox.sql` 전체를 실행합니다. 기존 글을 전송 대기열에 소급해서 넣지 않습니다. 이 시점 이후 생성한 새 글만 대기열에 들어갑니다. 사적 채팅 테이블에는 트리거를 설치하지 않습니다.
5. Supabase **Vault**에 아래 두 항목을 생성합니다. 비밀값을 SQL 파일이나 채팅에 넣을 필요가 없습니다.

   | Vault 항목 이름 | 값 |
   |---|---|
   | `trade_discord_function_url` | `https://xmdmwchfbroitizgtmlo.supabase.co/functions/v1/trade-discord` |
   | `trade_discord_webhook_secret` | 2번의 `TRADE_WEBHOOK_SECRET`과 **동일한 문자열** |

6. SQL Editor에서 `enable-discord-notifications.sql` 전체를 실행합니다. `pg_cron`, `pg_net`, Supabase Vault가 필요합니다. 새 대기열이 생기면 함수를 깨우며, 매분 미전송/재시도 항목이 있는 경우에만 함수를 호출합니다. 비어 있으면 Discord나 Edge Function을 호출하지 않습니다.
7. 사이트에서 새 공개 거래글 하나를 올려 Discord 알림을 확인합니다. 원래 거래글 등록, 1:1 채팅이 정상인지도 확인합니다. 아직 함수·비밀 설정을 하지 않았다면 실제 전송을 검증했다고 볼 수 없습니다.

## 실패와 보안

- Discord HTTP 오류·429 제한·네트워크 오류는 대기열에 남겨 재시도합니다. 8번 실패하면 `failed`로 남깁니다. 전송 지연은 재시도 시점 및 서비스 상황에 따라 달라질 수 있습니다.
- 전송 중 임대와 처리 토큰으로 일반적인 중복 실행을 막습니다. Discord가 메시지를 받은 직후 연결이 끊기거나 DB 확인 기록을 못 남기면 드물게 재전송될 수 있습니다. 외부 Discord 요청의 특성상 정확히 한 번 전송을 보장하지 않습니다.
- 전송 전에 거래글을 다시 읽으며 이미 완료된 거래는 `skipped` 처리합니다. 완료 후에도 이미 디스코드에 올라간 알림은 자동 삭제하지 않습니다.
- 장애가 나도 사이트 거래글은 유지됩니다. 전송 상태는 운영자가 `trade_discord_outbox`의 `status`, `attempts`, `last_error`에서 확인합니다. 방문자는 이 대기열을 읽거나 조작할 수 없습니다.
- 오류 기록에는 HTTP 상태 등 짧은 코드만 남기고 URL/토큰/서버 응답의 비밀값은 반환하거나 로그로 출력하지 않습니다. pg_net 요청 헤더 및 Vault에 있는 공유 비밀은 운영자만 접근할 수 있도록 DB 관리 권한도 보호합니다.
- 끄려면 Supabase Cron에서 `value-deck-trade-discord` 작업을 중지하고 `wake_trade_discord` 트리거를 비활성화합니다. 대기열 트리거도 끄면 중지 중의 새 거래글이 누적되지 않습니다. Discord 웹훅을 삭제하면 해당 URL은 더 이상 사용할 수 없습니다.

## 개발 검증

`npm test`에 포맷·멘션 차단·웹훅 주소 검증·인증·DB 재조회·429 재시도·비공개 채팅 제외·대기열 역할/중복/재시도 검증이 포함됩니다. 네트워크는 모의하며 실제 채널로 테스트 메시지를 보내지 않습니다. 봇 인증 테스트도 가짜 토큰만 사용합니다.

Deno 타입 검사: `deno check supabase/functions/trade-discord/index.ts`. `enable-discord-notifications.sql`의 pg_cron/pg_net/Vault 설정은 실제 프로젝트에서 별도 확인해야 합니다.

새 게임 아이템을 추가한 경우 `functions/trade-discord/catalog.json`의 이름·이미지 목록도 갱신하고 함수를 재배포하세요. 카탈로그 일치 테스트가 누락을 알려줍니다. 가격 값은 알림에 포함하지 않아 정기 가격 갱신 때마다 함수를 재배포할 필요는 없습니다.
