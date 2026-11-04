-- SETUP: deploy the Edge Function and create the two Vault entries described in README-discord.md first.
-- No Discord URL, bot token or shared-secret value belongs in this file.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='trade_discord_function_url') or
     not exists(select 1 from vault.decrypted_secrets where name='trade_discord_webhook_secret' and length(decrypted_secret)>=32) then
    raise exception 'Create trade_discord_function_url and trade_discord_webhook_secret in Supabase Vault first';
  end if;
end $$;
create or replace function public.process_trade_discord_queue()
returns bigint language plpgsql security definer set search_path='' as $$
declare target text; shared_secret text; request_id bigint;
begin
  if not exists(select 1 from public.trade_discord_outbox where (status='pending' and available_at<=now()) or (status='sending' and lease_until<now())) then return null; end if;
  select decrypted_secret into target from vault.decrypted_secrets where name='trade_discord_function_url' limit 1;
  select decrypted_secret into shared_secret from vault.decrypted_secrets where name='trade_discord_webhook_secret' limit 1;
  if target is null or shared_secret is null then return null; end if;
  if target !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/trade-discord$' then raise exception 'Invalid Edge Function URL'; end if;
  select net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','x-trade-webhook-secret',shared_secret),body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
  return request_id;
end $$;
revoke all on function public.process_trade_discord_queue() from public,anon,authenticated;
create or replace function public.wake_trade_discord()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.process_trade_discord_queue();
  return new;
exception when others then
  -- Notification infrastructure must never roll back a user's trade post.
  raise warning 'Discord wake-up failed; notification remains queued';
  return new;
end $$;
revoke all on function public.wake_trade_discord() from public,anon,authenticated;
drop trigger if exists wake_trade_discord on public.trade_discord_outbox;
create trigger wake_trade_discord after insert on public.trade_discord_outbox
for each row execute function public.wake_trade_discord();
select cron.schedule('value-deck-trade-discord','* * * * *','select public.process_trade_discord_queue();');
commit;
