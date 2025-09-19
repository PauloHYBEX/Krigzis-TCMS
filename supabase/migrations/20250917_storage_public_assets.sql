-- Cria bucket de storage para avatares e políticas RLS adequadas
-- Idempotente

begin;

-- 1) Bucket público
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

-- 2) Políticas (storage.objects)
-- Leitura pública do bucket (útil mesmo com bucket público)
drop policy if exists "Public read public-assets" on storage.objects;
create policy "Public read public-assets" on storage.objects
  for select
  using (bucket_id = 'public-assets');

-- Upload apenas do próprio usuário, no prefixo avatars/{uid}_*
drop policy if exists "Avatar upload own path" on storage.objects;
create policy "Avatar upload own path" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and name like ('avatars/' || auth.uid() || '_%')
  );

-- Update apenas do próprio usuário, no mesmo prefixo
drop policy if exists "Avatar update own path" on storage.objects;
create policy "Avatar update own path" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-assets'
    and name like ('avatars/' || auth.uid() || '_%')
  )
  with check (
    bucket_id = 'public-assets'
    and name like ('avatars/' || auth.uid() || '_%')
  );

-- Delete apenas do próprio usuário, no mesmo prefixo
drop policy if exists "Avatar delete own path" on storage.objects;
create policy "Avatar delete own path" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and name like ('avatars/' || auth.uid() || '_%')
  );

commit;
