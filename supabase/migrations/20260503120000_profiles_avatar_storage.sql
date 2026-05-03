-- Public bucket for user avatars at object paths: {auth_user_uuid}/{filename}
-- Apply via Supabase SQL editor or `supabase db push`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profiles',
  'profiles',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profiles_select_public" on storage.objects;
drop policy if exists "profiles_insert_own_folder" on storage.objects;
drop policy if exists "profiles_update_own_folder" on storage.objects;
drop policy if exists "profiles_delete_own_folder" on storage.objects;

create policy "profiles_select_public"
on storage.objects
for select
using (bucket_id = 'profiles');

create policy "profiles_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profiles'
  and name like (auth.uid()::text || '/%')
);

create policy "profiles_update_own_folder"
on storage.objects
for update
to authenticated
using (bucket_id = 'profiles' and name like (auth.uid()::text || '/%'))
with check (bucket_id = 'profiles' and name like (auth.uid()::text || '/%'));

create policy "profiles_delete_own_folder"
on storage.objects
for delete
to authenticated
using (bucket_id = 'profiles' and name like (auth.uid()::text || '/%'));
