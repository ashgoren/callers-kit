-- Fix RLS policies to use (select auth.role()) to avoid per-row re-evaluation
drop policy "authenticated_read" on public.dance_types;
drop policy "authenticated_read" on public.formations;
drop policy "authenticated_read" on public.progressions;

create policy "authenticated_read" on public.dance_types
  as permissive for select using ((select auth.role()) = 'authenticated');

create policy "authenticated_read" on public.formations
  as permissive for select using ((select auth.role()) = 'authenticated');

create policy "authenticated_read" on public.progressions
  as permissive for select using ((select auth.role()) = 'authenticated');
