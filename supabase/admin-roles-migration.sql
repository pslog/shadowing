alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

update public.profiles
set role = 'admin'
where lower(coalesce(email, '')) = 'vovansinh1991@gmail.com';

create or replace function public.current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.jwt() ->> 'email') = 'vovansinh1991@gmail.com';
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_is_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    );
$$;

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'vovansinh1991@gmail.com' then
    new.role := 'admin';
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is null then
      new.role := 'user';
    end if;
    if new.role <> 'user' and not public.current_user_is_super_admin() then
      raise exception 'Only the super admin can create admin profiles';
    end if;
    return new;
  end if;

  if lower(coalesce(old.email, '')) = 'vovansinh1991@gmail.com' then
    new.email := old.email;
    new.role := 'admin';
    return new;
  end if;

  if new.email is distinct from old.email and not public.current_user_is_super_admin() then
    raise exception 'Only the super admin can change profile emails';
  end if;

  if new.role is distinct from old.role and not public.current_user_is_super_admin() then
    raise exception 'Only the super admin can change user roles';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_role_guard();

grant execute on function public.current_user_is_super_admin() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, display_name, avatar_url)
  values (
    new.id,
    new.email,
    case when lower(coalesce(new.email, '')) = 'vovansinh1991@gmail.com'
      then 'admin'
      else 'user'
    end,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "profiles self" on public.profiles;
drop policy if exists "profiles read self or admin" on public.profiles;
drop policy if exists "profiles insert self" on public.profiles;
drop policy if exists "profiles update self" on public.profiles;
drop policy if exists "profiles super admin update" on public.profiles;
drop policy if exists "courses admin all" on public.courses;
drop policy if exists "lessons admin all" on public.lessons;
drop policy if exists "sentences admin all" on public.lesson_sentences;

create policy "profiles read self or admin" on public.profiles
  for select using (auth.uid() = id or public.current_user_is_admin());
create policy "profiles insert self" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles update self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles super admin update" on public.profiles
  for update using (public.current_user_is_super_admin())
  with check (public.current_user_is_super_admin());

create policy "courses admin all" on public.courses
  for all using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
create policy "lessons admin all" on public.lessons
  for all using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
create policy "sentences admin all" on public.lesson_sentences
  for all using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
