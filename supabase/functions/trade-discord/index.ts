import {createHandler} from './handler.ts';
Deno.serve(createHandler({
  secret:Deno.env.get('TRADE_WEBHOOK_SECRET')||'',
  webhook:Deno.env.get('DISCORD_WEBHOOK_URL')||'',
  botToken:Deno.env.get('DISCORD_BOT_TOKEN')||'',
  channelId:Deno.env.get('DISCORD_CHANNEL_ID')||'',
  project:Deno.env.get('SUPABASE_URL')||'',
  key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
}));
