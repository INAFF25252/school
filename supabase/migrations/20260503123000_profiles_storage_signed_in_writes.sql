-- Any signed-in Supabase user may INSERT/UPDATE/DELETE objects in the `profiles` bucket
-- (no path prefix checks). Public read policy stays as defined in earlier migrations.

drop policy if exists "profiles_insert_own_folder" on storage.objects;
drop policy if exists "profiles_update_own_folder" on storage.objects;
drop policy if exists "profiles_delete_own_folder" on storage.objects;
drop policy if exists "profiles_insert_authenticated_paths" on storage.objects;
drop policy if exists "profiles_update_authenticated_paths" on storage.objects;
drop policy if exists "profiles_delete_authenticated_paths" on storage.objects;
drop policy if exists "profiles_insert_signed_in_writes" on storage.objects;
drop policy if exists "profiles_update_signed_in_writes" on storage.objects;
drop policy if exists "profiles_delete_signed_in_writes" on storage.objects;

create policy "profiles_insert_signed_in_writes"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'profiles');

create policy "profiles_update_signed_in_writes"
on storage.objects
for update
to authenticated
using (bucket_id = 'profiles')
with check (bucket_id = 'profiles');

create policy "profiles_delete_signed_in_writes"
on storage.objects
for delete
to authenticated
using (bucket_id = 'profiles');
