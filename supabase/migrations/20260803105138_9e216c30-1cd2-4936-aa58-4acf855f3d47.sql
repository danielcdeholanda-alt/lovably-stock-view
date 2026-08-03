REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_auditoria() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_endereco() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exigir_login() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_entrada(uuid, text, integer, integer, date, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_saida(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.criar_ruas_em_bloco(uuid, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_entrada_lote(uuid, text, integer, integer, date, integer, text, date, timestamptz, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.previa_saida(uuid, uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_saida_por_regra(uuid, uuid, integer, text, text, uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_transferencia(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_ajuste(uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_status_palete(uuid, public.palete_status, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_ruas_em_bloco(uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_lote(uuid, text, integer, integer, date, integer, text, date, timestamptz, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.previa_saida(uuid, uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_saida_por_regra(uuid, uuid, integer, text, text, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_transferencia(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_status_palete(uuid, public.palete_status, text) TO authenticated;