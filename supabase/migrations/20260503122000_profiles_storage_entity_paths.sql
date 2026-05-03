-- Allow authenticated app users to upload directory avatars under students/{id}/ and teachers/{id}/,
-- in addition to their own account folder {auth.uid()}/.

drop policy if exists "profiles_insert_own_folder" on storage.objects;
drop policy if exists "profiles_update_own_folder" on storage.objects;
drop policy if exists "profiles_delete_own_folder" on storage.objects;

create policy "profiles_insert_authenticated_paths"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profiles'
  and (
    name like (auth.uid()::text || '/%')
    or name ~ '^students/[0-9]+/[^/]+$'
    or name ~ '^teachers/[0-9]+/[^/]+$'
  )
);

create policy "profiles_update_authenticated_paths"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profiles'
  and (
    name like (auth.uid()::text || '/%')
    or name ~ '^students/[0-9]+/[^/]+$'
    or name ~ '^teachers/[0-9]+/[^/]+$'
  )
)
with check (
  bucket_id = 'profiles'
  and (
    name like (auth.uid()::text || '/%')
    or name ~ '^students/[0-9]+/[^/]+$'
    or name ~ '^teachers/[0-9]+/[^/]+$'
  )
);

create policy "profiles_delete_authenticated_paths"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profiles'
  and (
    name like (auth.uid()::text || '/%')
    or name ~ '^students/[0-9]+/[^/]+$'
    or name ~ '^teachers/[0-9]+/[^/]+$'
  )
);
