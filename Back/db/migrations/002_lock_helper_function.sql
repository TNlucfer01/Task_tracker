-- 002_lock_helper_function.sql
-- rls_auto_enable() is a security-definer helper that came with the project. Nothing in the app
-- calls it, so no browser role should be able to.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
