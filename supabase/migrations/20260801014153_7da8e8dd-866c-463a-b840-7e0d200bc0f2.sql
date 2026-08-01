REVOKE ALL ON public.galpoes FROM anon;
REVOKE ALL ON public.areas FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.password_resets FROM anon;
REVOKE ALL ON public.ruas FROM anon;
REVOKE ALL ON public.produtos FROM anon;
REVOKE ALL ON public.paletes FROM anon;
REVOKE ALL ON public.movimentacoes FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.password_resets FROM authenticated;
GRANT SELECT ON public.password_resets TO authenticated;
GRANT ALL ON public.password_resets TO service_role;

ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS usuario_id uuid;

CREATE OR REPLACE FUNCTION public.registrar_entrada(p_produto_id uuid, p_area text, p_rua integer, p_quantidade integer, p_validade date, p_lote text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text, p_galpao_id uuid DEFAULT NULL::uuid)
 RETURNS paletes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_galpao uuid;
  v_capacidade integer;
  v_posicao integer;
  v_palete public.paletes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para registrar movimentações';
  END IF;

  v_galpao := COALESCE(p_galpao_id, (SELECT id FROM public.galpoes WHERE padrao ORDER BY created_at LIMIT 1));
  IF v_galpao IS NULL THEN
    RAISE EXCEPTION 'Nenhum galpão cadastrado';
  END IF;

  SELECT r.capacidade * r.niveis INTO v_capacidade
  FROM public.ruas r
  JOIN public.areas a ON a.id = r.area_id
  WHERE a.galpao_id = v_galpao AND a.nome = p_area AND r.rua = p_rua;

  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Rua % da área % não existe neste galpão', p_rua, p_area;
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  IF p_validade IS NULL THEN
    RAISE EXCEPTION 'Informe a validade do palete';
  END IF;

  SELECT COALESCE(MAX(posicao), 0) + 1 INTO v_posicao
  FROM public.paletes WHERE galpao_id = v_galpao AND area = p_area AND rua = p_rua;

  IF v_posicao > v_capacidade THEN
    RAISE EXCEPTION 'A rua %-% está cheia (capacidade de % paletes)', p_area, p_rua, v_capacidade;
  END IF;

  INSERT INTO public.paletes (produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote)
  VALUES (p_produto_id, v_galpao, p_area, p_rua, v_posicao, p_quantidade, p_validade, NULLIF(btrim(COALESCE(p_lote, '')), ''))
  RETURNING * INTO v_palete;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote, observacao, usuario_id)
  VALUES ('entrada', p_produto_id, v_galpao, p_area, p_rua, v_posicao, p_quantidade, p_validade, v_palete.lote, NULLIF(btrim(COALESCE(p_observacao, '')), ''), auth.uid());

  RETURN v_palete;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_saida(p_palete_id uuid, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v public.paletes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para registrar movimentações';
  END IF;

  SELECT * INTO v FROM public.paletes WHERE id = p_palete_id;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Palete não encontrado';
  END IF;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote, observacao, usuario_id)
  VALUES ('saida', v.produto_id, v.galpao_id, v.area, v.rua, v.posicao, v.quantidade, v.validade, v.lote, NULLIF(btrim(COALESCE(p_observacao, '')), ''), auth.uid());

  DELETE FROM public.paletes WHERE id = v.id;

  UPDATE public.paletes SET posicao = posicao - 1
  WHERE galpao_id = v.galpao_id AND area = v.area AND rua = v.rua AND posicao > v.posicao;
END;
$function$;