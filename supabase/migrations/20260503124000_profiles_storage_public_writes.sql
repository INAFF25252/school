-- Open the `profiles` bucket as much as RLS allows: any visitor (including anon) may
-- read/write/delete objects in this bucket. Bucket stays `public` for public URLs.
-- MIME/size limits on the bucket are cleared; the app still validates file type/size.

update storage.buckets
set
  public = true,
  file_size_limit = null,
  allowed_mime_types = null
where id = 'profiles';

drop policy if exists "profiles_select_public" on storage.objects;
drop policy if exists "profiles_insert_own_folder" on storage.objects;
drop policy if exists "profiles_update_own_folder" on storage.objects;
drop policy if exists "profiles_delete_own_folder" on storage.objects;
drop policy if exists "profiles_insert_authenticated_paths" on storage.objects;
drop policy if exists "profiles_update_authenticated_paths" on storage.objects;
drop policy if exists "profiles_delete_authenticated_paths" on storage.objects;
drop policy if exists "profiles_insert_signed_in_writes" on storage.objects;
drop policy if exists "profiles_update_signed_in_writes" on storage.objects;
drop policy if exists "profiles_delete_signed_in_writes" on storage.objects;
drop policy if exists "profiles_insert_public_writes" on storage.objects;
drop policy if exists "profiles_update_public_writes" on storage.objects;
drop policy if exists "profiles_delete_public_writes" on storage.objects;

create policy "profiles_select_public"
on storage.objects
for select
to public
using (bucket_id = 'profiles');

create policy "profiles_insert_public_writes"
on storage.objects
for insert
to public
with check (bucket_id = 'profiles');

create policy "profiles_update_public_writes"
on storage.objects
for update
to public
using (bucket_id = 'profiles')
with check (bucket_id = 'profiles');

create policy "profiles_delete_public_writes"
on storage.objects
for delete
to public
using (bucket_id = 'profiles');
