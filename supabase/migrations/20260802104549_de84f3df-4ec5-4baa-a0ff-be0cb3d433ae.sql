-- Endereço passa a ser a chave de ocupação (permite níveis na mesma posição)
ALTER TABLE public.paletes DROP CONSTRAINT IF EXISTS paletes_area_rua_posicao_key;

-- Funções internas de gatilho não devem ser chamáveis pela API
REVOKE ALL ON FUNCTION public.registrar_auditoria() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_endereco() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_ruas_em_bloco(uuid, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_entrada(uuid, text, integer, integer, date, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_saida(uuid, text) FROM PUBLIC, anon;

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.exigir_login() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  v := auth.uid();
  IF v IS NULL THEN RAISE EXCEPTION 'Faça login para executar esta operação'; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.exigir_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exigir_login() TO authenticated;

-- ============ ENTRADA EM LOTE (transacional) ============
CREATE OR REPLACE FUNCTION public.registrar_entrada_lote(
  p_produto_id uuid,
  p_area text,
  p_rua integer,
  p_quantidade integer,
  p_validade date,
  p_paletes integer DEFAULT 1,
  p_lote text DEFAULT NULL,
  p_data_fabricacao date DEFAULT NULL,
  p_data_entrada timestamptz DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_galpao_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, codigo text, endereco text, quantidade integer, validade date, data_entrada timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := public.exigir_login();
  v_galpao uuid;
  v_entrada timestamptz := COALESCE(p_data_entrada, now());
  v_lote text := NULLIF(btrim(COALESCE(p_lote,'')), '');
  e RECORD;
  v_novos uuid[] := '{}';
BEGIN
  IF p_paletes IS NULL OR p_paletes <= 0 THEN RAISE EXCEPTION 'Informe uma quantidade de paletes maior que zero'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'A quantidade por palete deve ser maior que zero'; END IF;
  IF p_validade IS NULL THEN RAISE EXCEPTION 'Informe a validade do palete'; END IF;
  IF p_data_fabricacao IS NOT NULL AND p_data_fabricacao > p_validade THEN
    RAISE EXCEPTION 'A data de fabricação não pode ser posterior à validade';
  END IF;

  v_galpao := COALESCE(p_galpao_id, (SELECT g.id FROM public.galpoes g WHERE g.padrao ORDER BY g.created_at LIMIT 1));
  IF v_galpao IS NULL THEN RAISE EXCEPTION 'Nenhum galpão cadastrado'; END IF;

  FOR e IN
    SELECT en.id, en.codigo, en.area, en.rua, en.posicao
    FROM public.enderecos en
    WHERE en.galpao_id = v_galpao AND en.area = p_area AND en.rua = p_rua
      AND en.ativo AND en.status = 'livre'
      AND NOT EXISTS (SELECT 1 FROM public.paletes pa WHERE pa.endereco_id = en.id)
    ORDER BY en.posicao, en.nivel
    LIMIT p_paletes
    FOR UPDATE OF en SKIP LOCKED
  LOOP
    INSERT INTO public.paletes (produto_id, galpao_id, area, rua, posicao, endereco_id, quantidade,
                                validade, lote, data_entrada, data_fabricacao, usuario_entrada,
                                ultima_mov_em, ultima_mov_por)
    VALUES (p_produto_id, v_galpao, e.area, e.rua, e.posicao, e.id, p_quantidade,
            p_validade, v_lote, v_entrada, p_data_fabricacao, v_user, v_entrada, v_user)
    RETURNING paletes.id INTO id;
    v_novos := v_novos || id;
  END LOOP;

  IF COALESCE(array_length(v_novos,1),0) <> p_paletes THEN
    RAISE EXCEPTION 'Não há % endereços livres na rua %-%. Disponíveis agora: %',
      p_paletes, p_area, p_rua, COALESCE(array_length(v_novos,1),0);
  END IF;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade,
                                    validade, lote, observacao, usuario_id, palete_id, palete_codigo, endereco_id, data)
  SELECT 'entrada', pa.produto_id, pa.galpao_id, pa.area, pa.rua, pa.posicao, pa.quantidade,
         pa.validade, pa.lote, NULLIF(btrim(COALESCE(p_observacao,'')),''), v_user, pa.id, pa.codigo, pa.endereco_id, v_entrada
  FROM public.paletes pa WHERE pa.id = ANY(v_novos);

  RETURN QUERY
    SELECT pa.id, pa.codigo, en.codigo, pa.quantidade, pa.validade, pa.data_entrada
    FROM public.paletes pa JOIN public.enderecos en ON en.id = pa.endereco_id
    WHERE pa.id = ANY(v_novos) ORDER BY en.codigo;
END $$;
REVOKE ALL ON FUNCTION public.registrar_entrada_lote(uuid,text,integer,integer,date,integer,text,date,timestamptz,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_lote(uuid,text,integer,integer,date,integer,text,date,timestamptz,text,uuid) TO authenticated;

-- ============ PRÉVIA DE SAÍDA ============
CREATE OR REPLACE FUNCTION public.previa_saida(
  p_galpao_id uuid,
  p_produto_id uuid,
  p_paletes integer,
  p_lote text DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (id uuid, codigo text, endereco text, lote text, quantidade integer, validade date, data_entrada timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pol public.politica_saida;
BEGIN
  PERFORM public.exigir_login();
  SELECT g.politica_saida INTO v_pol FROM public.galpoes g WHERE g.id = p_galpao_id;
  IF v_pol IS NULL THEN RAISE EXCEPTION 'Galpão não encontrado'; END IF;
  IF v_pol = 'MANUAL' THEN RETURN; END IF;

  RETURN QUERY
    SELECT pa.id, pa.codigo, en.codigo, pa.lote, pa.quantidade, pa.validade, pa.data_entrada
    FROM public.paletes pa LEFT JOIN public.enderecos en ON en.id = pa.endereco_id
    WHERE pa.galpao_id = p_galpao_id
      AND pa.produto_id = p_produto_id
      AND pa.status = 'disponivel'
      AND (p_lote IS NULL OR pa.lote = p_lote)
      AND (p_area IS NULL OR pa.area = p_area)
    ORDER BY
      CASE WHEN v_pol = 'FEFO' THEN pa.validade END ASC NULLS LAST,
      pa.data_entrada ASC, pa.id ASC
    LIMIT GREATEST(p_paletes, 0);
END $$;
REVOKE ALL ON FUNCTION public.previa_saida(uuid,uuid,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.previa_saida(uuid,uuid,integer,text,text) TO authenticated;

-- ============ SAÍDA PELA REGRA CONFIGURADA ============
CREATE OR REPLACE FUNCTION public.registrar_saida_por_regra(
  p_galpao_id uuid,
  p_produto_id uuid DEFAULT NULL,
  p_paletes integer DEFAULT NULL,
  p_lote text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_palete_ids uuid[] DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS TABLE (id uuid, codigo text, endereco text, quantidade integer, validade date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := public.exigir_login();
  v_pol public.politica_saida;
  v_ids uuid[];
  v_manual boolean := p_palete_ids IS NOT NULL AND array_length(p_palete_ids,1) > 0;
BEGIN
  SELECT g.politica_saida INTO v_pol FROM public.galpoes g WHERE g.id = p_galpao_id;
  IF v_pol IS NULL THEN RAISE EXCEPTION 'Galpão não encontrado'; END IF;

  IF v_manual THEN
    SELECT array_agg(pa.id ORDER BY pa.id) INTO v_ids
    FROM public.paletes pa
    WHERE pa.id = ANY(p_palete_ids) AND pa.galpao_id = p_galpao_id AND pa.status = 'disponivel'
    FOR UPDATE SKIP LOCKED;
    IF COALESCE(array_length(v_ids,1),0) <> array_length(p_palete_ids,1) THEN
      RAISE EXCEPTION 'Um ou mais paletes selecionados não estão mais disponíveis. Atualize a lista e tente de novo.';
    END IF;
  ELSE
    IF v_pol = 'MANUAL' THEN
      RAISE EXCEPTION 'A regra deste galpão é MANUAL: selecione os paletes que devem sair';
    END IF;
    IF p_produto_id IS NULL OR p_paletes IS NULL OR p_paletes <= 0 THEN
      RAISE EXCEPTION 'Informe o produto e a quantidade de paletes';
    END IF;
    SELECT array_agg(s.id) INTO v_ids FROM (
      SELECT pa.id FROM public.paletes pa
      WHERE pa.galpao_id = p_galpao_id AND pa.produto_id = p_produto_id AND pa.status = 'disponivel'
        AND (p_lote IS NULL OR pa.lote = p_lote)
        AND (p_area IS NULL OR pa.area = p_area)
      ORDER BY
        CASE WHEN v_pol = 'FEFO' THEN pa.validade END ASC NULLS LAST,
        pa.data_entrada ASC, pa.id ASC
      LIMIT p_paletes
      FOR UPDATE SKIP LOCKED
    ) s;
    IF COALESCE(array_length(v_ids,1),0) < p_paletes THEN
      RAISE EXCEPTION 'Não há paletes disponíveis suficientes: pedido %, disponível %',
        p_paletes, COALESCE(array_length(v_ids,1),0);
    END IF;
  END IF;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade,
                                    validade, lote, observacao, usuario_id, palete_id, palete_codigo, endereco_id)
  SELECT 'saida', pa.produto_id, pa.galpao_id, pa.area, pa.rua, pa.posicao, pa.quantidade,
         pa.validade, pa.lote, NULLIF(btrim(COALESCE(p_observacao,'')),''), v_user, pa.id, pa.codigo, pa.endereco_id
  FROM public.paletes pa WHERE pa.id = ANY(v_ids);

  RETURN QUERY
  WITH removidos AS (
    DELETE FROM public.paletes pa WHERE pa.id = ANY(v_ids)
    RETURNING pa.id, pa.codigo, pa.endereco_id, pa.quantidade, pa.validade
  )
  SELECT r.id, r.codigo, en.codigo, r.quantidade, r.validade
  FROM removidos r LEFT JOIN public.enderecos en ON en.id = r.endereco_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_saida_por_regra(uuid,uuid,integer,text,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_saida_por_regra(uuid,uuid,integer,text,text,uuid[],text) TO authenticated;

-- ============ TRANSFERÊNCIA ============
CREATE OR REPLACE FUNCTION public.registrar_transferencia(
  p_palete_id uuid, p_endereco_destino_id uuid, p_motivo text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := public.exigir_login();
  v_p public.paletes; v_d public.enderecos;
BEGIN
  SELECT * INTO v_p FROM public.paletes WHERE id = p_palete_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Palete não encontrado'; END IF;
  IF v_p.status <> 'disponivel' THEN RAISE EXCEPTION 'Este palete está % e não pode ser movimentado', v_p.status; END IF;

  SELECT * INTO v_d FROM public.enderecos WHERE id = p_endereco_destino_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'Endereço de destino não encontrado'; END IF;
  IF NOT v_d.ativo OR v_d.status IN ('bloqueado','interditado') THEN
    RAISE EXCEPTION 'O endereço % está bloqueado e não pode receber paletes', v_d.codigo;
  END IF;
  IF EXISTS (SELECT 1 FROM public.paletes WHERE endereco_id = v_d.id) THEN
    RAISE EXCEPTION 'O endereço % já está ocupado', v_d.codigo;
  END IF;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote,
                                    usuario_id, palete_id, palete_codigo, endereco_id, endereco_destino_id,
                                    area_destino, rua_destino, posicao_destino, motivo)
  VALUES ('transferencia', v_p.produto_id, v_p.galpao_id, v_p.area, v_p.rua, v_p.posicao, v_p.quantidade,
          v_p.validade, v_p.lote, v_user, v_p.id, v_p.codigo, v_p.endereco_id, v_d.id,
          v_d.area, v_d.rua, v_d.posicao, NULLIF(btrim(COALESCE(p_motivo,'')),''));

  UPDATE public.paletes SET endereco_id = v_d.id, galpao_id = v_d.galpao_id, area = v_d.area,
         rua = COALESCE(v_d.rua, rua), posicao = COALESCE(v_d.posicao, posicao),
         ultima_mov_em = now(), ultima_mov_por = v_user
  WHERE id = v_p.id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_transferencia(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_transferencia(uuid,uuid,text) TO authenticated;

-- ============ AJUSTE DE INVENTÁRIO (admin) ============
CREATE OR REPLACE FUNCTION public.registrar_ajuste(
  p_palete_id uuid, p_quantidade_contada integer, p_motivo text, p_observacao text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := public.exigir_login(); v_p public.paletes; v_dif integer;
BEGIN
  IF NOT public.has_role(v_user, 'admin') THEN RAISE EXCEPTION 'Somente administradores podem ajustar o inventário'; END IF;
  IF p_quantidade_contada IS NULL OR p_quantidade_contada < 0 THEN RAISE EXCEPTION 'Informe a contagem física (zero ou mais)'; END IF;
  IF NULLIF(btrim(COALESCE(p_motivo,'')),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;

  SELECT * INTO v_p FROM public.paletes WHERE id = p_palete_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Palete não encontrado'; END IF;
  v_dif := p_quantidade_contada - v_p.quantidade;
  IF v_dif = 0 THEN RAISE EXCEPTION 'A contagem é igual ao saldo do sistema: nada a ajustar'; END IF;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade, quantidade_anterior,
                                    validade, lote, usuario_id, palete_id, palete_codigo, endereco_id, motivo, observacao)
  VALUES ('ajuste', v_p.produto_id, v_p.galpao_id, v_p.area, v_p.rua, v_p.posicao, v_dif, v_p.quantidade,
          v_p.validade, v_p.lote, v_user, v_p.id, v_p.codigo, v_p.endereco_id,
          btrim(p_motivo), NULLIF(btrim(COALESCE(p_observacao,'')),''));

  IF p_quantidade_contada = 0 THEN
    DELETE FROM public.paletes WHERE id = v_p.id;
  ELSE
    UPDATE public.paletes SET quantidade = p_quantidade_contada, ultima_mov_em = now(), ultima_mov_por = v_user
    WHERE id = v_p.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.registrar_ajuste(uuid,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste(uuid,integer,text,text) TO authenticated;

-- ============ STATUS DO PALETE ============
CREATE OR REPLACE FUNCTION public.definir_status_palete(
  p_palete_id uuid, p_status public.palete_status, p_motivo text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := public.exigir_login(); v_p public.paletes;
BEGIN
  SELECT * INTO v_p FROM public.paletes WHERE id = p_palete_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Palete não encontrado'; END IF;
  IF v_p.status = p_status THEN RETURN; END IF;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote,
                                    usuario_id, palete_id, palete_codigo, endereco_id, motivo)
  VALUES (CASE WHEN p_status = 'disponivel' THEN 'desbloqueio' ELSE 'bloqueio' END,
          v_p.produto_id, v_p.galpao_id, v_p.area, v_p.rua, v_p.posicao, v_p.quantidade, v_p.validade, v_p.lote,
          v_user, v_p.id, v_p.codigo, v_p.endereco_id, NULLIF(btrim(COALESCE(p_motivo,'')),''));

  UPDATE public.paletes SET status = p_status, ultima_mov_em = now(), ultima_mov_por = v_user WHERE id = v_p.id;
END $$;
REVOKE ALL ON FUNCTION public.definir_status_palete(uuid, public.palete_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_status_palete(uuid, public.palete_status, text) TO authenticated;

-- ============ ESTRUTURA: ruas + endereços ============
CREATE OR REPLACE FUNCTION public.criar_ruas_em_bloco(
  p_area_id uuid, p_quantidade integer, p_capacidade integer, p_niveis integer DEFAULT 1
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_area text; v_galpao uuid; v_inicio integer; i integer; v_rua public.ruas;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores podem alterar a estrutura'; END IF;
  IF p_quantidade <= 0 OR p_capacidade <= 0 OR p_niveis <= 0 THEN RAISE EXCEPTION 'Valores devem ser maiores que zero'; END IF;

  SELECT a.nome, a.galpao_id INTO v_area, v_galpao FROM public.areas a WHERE a.id = p_area_id;
  IF v_area IS NULL THEN RAISE EXCEPTION 'Área não encontrada'; END IF;

  SELECT COALESCE(MAX(r.rua), 0) INTO v_inicio FROM public.ruas r WHERE r.area_id = p_area_id;

  FOR i IN 1..p_quantidade LOOP
    INSERT INTO public.ruas (area, rua, capacidade, area_id, niveis)
    VALUES (v_area, v_inicio + i, p_capacidade, p_area_id, p_niveis)
    RETURNING * INTO v_rua;

    INSERT INTO public.enderecos (galpao_id, area_id, rua_id, codigo, area, rua, posicao, nivel)
    SELECT v_galpao, p_area_id, v_rua.id,
           v_area || '-' || lpad(v_rua.rua::text,2,'0') || '-' || lpad(p.p::text,2,'0')
             || CASE WHEN p_niveis > 1 THEN '-' || lpad(n.n::text,2,'0') ELSE '' END,
           v_area, v_rua.rua, p.p, CASE WHEN p_niveis > 1 THEN n.n ELSE NULL END
    FROM generate_series(1, p_capacidade) AS p(p), generate_series(1, p_niveis) AS n(n)
    ON CONFLICT (area_id, codigo) DO NOTHING;
  END LOOP;

  RETURN p_quantidade;
END $$;
REVOKE ALL ON FUNCTION public.criar_ruas_em_bloco(uuid,integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_ruas_em_bloco(uuid,integer,integer,integer) TO authenticated;