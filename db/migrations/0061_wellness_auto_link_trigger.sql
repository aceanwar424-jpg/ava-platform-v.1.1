-- Migration 0061: Automatic User Linking Trigger for Wellness Enrollments
-- OWNED_BY: ava
-- Target: Supabase / PostgreSQL
-- Deskripsi: Otomatis menautkan auth_user_id ke wellness_enrollments setiap kali pengguna login/mendaftar via email.

CREATE OR REPLACE FUNCTION public.wellness_auto_link_user_enrollments()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    UPDATE public.wellness_enrollments e
       SET auth_user_id = NEW.id, updated_at = now()
      FROM public.corporate_employees emp
     WHERE emp.id = e.corporate_employee_id
       AND lower(emp.email) = lower(btrim(NEW.email))
       AND (e.auth_user_id IS NULL OR e.auth_user_id <> NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger pada tabel user_profiles / auth.users
DROP TRIGGER IF EXISTS trg_wellness_auto_link_user ON public.user_profiles;
CREATE TRIGGER trg_wellness_auto_link_user
  AFTER INSERT OR UPDATE OF id ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.wellness_auto_link_user_enrollments();

GRANT EXECUTE ON FUNCTION public.wellness_auto_link_user_enrollments() TO authenticated;
