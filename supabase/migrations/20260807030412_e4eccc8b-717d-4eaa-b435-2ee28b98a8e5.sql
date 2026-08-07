-- 1) Produto por rua -------------------------------------------------------
ALTER TABLE public.ruas ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.produtos(id);

UPDATE public.ruas r SET produto_id = s.produto_id
FROM (
  SELECT rr.id, min(p.produto_id::text)::uuid AS produto_id
  FROM public.ruas rr
  JOIN public.areas a ON a.id = rr.area_id
  JOIN public.paletes p ON p.galpao_id = a.galpao_id AND p.area = rr.area AND p.rua = rr.rua
  GROUP BY rr.id
  HAVING count(DISTINCT p.produto_id) = 1
) s
WHERE r.id = s.id AND r.produto_id IS DISTINCT FROM s.produto_id;

CREATE OR REPLACE FUNCTION public.rua_do_palete(p_galpao_id uuid, p_area text, p_rua integer)
RETURNS public.ruas
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.* FROM public.ruas r
  JOIN public.areas a ON a.id = r.area_id
  WHERE a.galpao_id = p_galpao_id AND r.area = p_area AND r.rua = p_rua
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.rua_do_palete(uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- Bloqueia dois produtos na mesma rua e mantém ruas.produto_id sincronizado
CREATE OR REPLACE FUNCTION public.validar_produto_rua()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_rua public.ruas; v_atual uuid; v_cod text; v_nome text;
BEGIN
  v_rua := public.rua_do_palete(NEW.galpao_id, NEW.area, NEW.rua);
  IF v_rua.id IS NULL THEN RETURN NEW; END IF;

  SELECT p.produto_id INTO v_atual
  FROM public.paletes p
  WHERE p.galpao_id = NEW.galpao_id AND p.area = NEW.area AND p.rua = NEW.rua
    AND p.id <> NEW.id
  LIMIT 1;

  v_atual := COALESCE(v_atual, v_rua.produto_id);

  IF v_atual IS NOT NULL AND v_atual <> NEW.produto_id THEN
    SELECT pr.codigo, pr.nome INTO v_cod, v_nome FROM public.produtos pr WHERE pr.id = v_atual;
    RAISE EXCEPTION 'A rua %-% já armazena o produto % - %. Cada rua só pode ter um produto: escolha outra rua.',
      NEW.area, lpad(NEW.rua::text, 2, '0'), COALESCE(v_cod, '?'), COALESCE(v_nome, '?');
  END IF;

  IF v_rua.produto_id IS DISTINCT FROM NEW.produto_id THEN
    UPDATE public.ruas SET produto_id = NEW.produto_id WHERE id = v_rua.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validar_produto_rua() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.liberar_rua_vazia()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_rua public.ruas;
BEGIN
  v_rua := public.rua_do_palete(OLD.galpao_id, OLD.area, OLD.rua);
  IF v_rua.id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.paletes p
    WHERE p.galpao_id = OLD.galpao_id AND p.area = OLD.area AND p.rua = OLD.rua
  ) THEN
    UPDATE public.ruas SET produto_id = NULL WHERE id = v_rua.id;
  END IF;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.liberar_rua_vazia() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_paletes_produto_rua ON public.paletes;
CREATE TRIGGER trg_paletes_produto_rua
BEFORE INSERT OR UPDATE OF produto_id, area, rua, galpao_id ON public.paletes
FOR EACH ROW EXECUTE FUNCTION public.validar_produto_rua();

DROP TRIGGER IF EXISTS trg_paletes_libera_rua ON public.paletes;
CREATE TRIGGER trg_paletes_libera_rua
AFTER DELETE ON public.paletes
FOR EACH ROW EXECUTE FUNCTION public.liberar_rua_vazia();

-- 2) FEFO -------------------------------------------------------------------
-- Sugere ruas para armazenar um produto (mesma rua do produto primeiro, depois vazias)
CREATE OR REPLACE FUNCTION public.sugerir_ruas_fefo(p_galpao_id uuid, p_produto_id uuid, p_paletes integer DEFAULT 1)
RETURNS TABLE(area text, rua integer, livres bigint, ocupados bigint, produto_atual text, prioridade integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.area, r.rua,
         count(e.id) FILTER (WHERE pa.id IS NULL AND e.ativo AND e.status <> 'bloqueado' AND e.status <> 'interditado') AS livres,
         count(pa.id) AS ocupados,
         pr.codigo AS produto_atual,
         CASE WHEN r.produto_id = p_produto_id THEN 1 ELSE 2 END AS prioridade
  FROM public.ruas r
  JOIN public.areas a ON a.id = r.area_id
  LEFT JOIN public.enderecos e ON e.rua_id = r.id
  LEFT JOIN public.paletes pa ON pa.endereco_id = e.id
  LEFT JOIN public.produtos pr ON pr.id = r.produto_id
  WHERE a.galpao_id = p_galpao_id
    AND (r.produto_id IS NULL OR r.produto_id = p_produto_id)
  GROUP BY r.id, r.area, r.rua, r.produto_id, pr.codigo
  HAVING count(e.id) FILTER (WHERE pa.id IS NULL AND e.ativo AND e.status <> 'bloqueado' AND e.status <> 'interditado') >= GREATEST(COALESCE(p_paletes, 1), 1)
  ORDER BY CASE WHEN r.produto_id = p_produto_id THEN 1 ELSE 2 END, r.area, r.rua
  LIMIT 20
$$;
GRANT EXECUTE ON FUNCTION public.sugerir_ruas_fefo(uuid, uuid, integer) TO authenticated;

-- Aponta paletes fora da ordem de validade dentro da rua
CREATE OR REPLACE FUNCTION public.paletes_fora_de_ordem(p_galpao_id uuid)
RETURNS TABLE(palete_id uuid, codigo text, area text, rua integer, posicao integer, validade date,
              endereco text, sugerido_posicao integer, sugerido_endereco text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT pa.id, pa.codigo, pa.area, pa.rua, pa.posicao, pa.validade, en.codigo AS endereco,
           row_number() OVER (PARTITION BY pa.area, pa.rua ORDER BY pa.posicao, en.nivel NULLS FIRST) AS ordem_atual,
           row_number() OVER (PARTITION BY pa.area, pa.rua ORDER BY pa.validade, pa.data_entrada) AS ordem_fefo
    FROM public.paletes pa LEFT JOIN public.enderecos en ON en.id = pa.endereco_id
    WHERE pa.galpao_id = p_galpao_id
  ),
  destino AS (
    SELECT b.*, d.posicao AS destino_posicao, d.endereco AS destino_endereco
    FROM base b
    JOIN (SELECT area, rua, ordem_atual AS slot, posicao, endereco FROM base) d
      ON d.area = b.area AND d.rua = b.rua AND d.slot = b.ordem_fefo
  )
  SELECT id, codigo, area, rua, posicao, validade, endereco, destino_posicao, destino_endereco
  FROM destino WHERE ordem_atual <> ordem_fefo
  ORDER BY area, rua, ordem_fefo
$$;
GRANT EXECUTE ON FUNCTION public.paletes_fora_de_ordem(uuid) TO authenticated;

-- Entrada em lote com colocação FEFO dentro da rua
CREATE OR REPLACE FUNCTION public.registrar_entrada_lote(p_produto_id uuid, p_area text, p_rua integer, p_quantidade integer, p_validade date, p_paletes integer DEFAULT 1, p_lote text DEFAULT NULL::text, p_data_fabricacao date DEFAULT NULL::date, p_data_entrada timestamp with time zone DEFAULT NULL::timestamp with time zone, p_observacao text DEFAULT NULL::text, p_galpao_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, codigo text, endereco text, quantidade integer, validade date, data_entrada timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := public.exigir_login();
  v_galpao uuid;
  v_entrada timestamptz := COALESCE(p_data_entrada, now());
  v_lote text := NULLIF(btrim(COALESCE(p_lote,'')), '');
  v_anteriores integer;
  e RECORD;
  v_novos uuid[] := '{}';
  v_id uuid;
BEGIN
  IF p_paletes IS NULL OR p_paletes <= 0 THEN RAISE EXCEPTION 'Informe uma quantidade de paletes maior que zero'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'A quantidade por palete deve ser maior que zero'; END IF;
  IF p_validade IS NULL THEN RAISE EXCEPTION 'Informe a validade do palete'; END IF;
  IF p_data_fabricacao IS NOT NULL AND p_data_fabricacao > p_validade THEN
    RAISE EXCEPTION 'A data de fabricação não pode ser posterior à validade';
  END IF;

  v_galpao := COALESCE(p_galpao_id, (SELECT g.id FROM public.galpoes g WHERE g.padrao ORDER BY g.created_at LIMIT 1));
  IF v_galpao IS NULL THEN RAISE EXCEPTION 'Nenhum galpão cadastrado'; END IF;

  -- quantos paletes já ocupam a rua com validade menor ou igual à nova (FEFO)
  SELECT count(*) INTO v_anteriores
  FROM public.paletes pa
  WHERE pa.galpao_id = v_galpao AND pa.area = p_area AND pa.rua = p_rua
    AND pa.validade <= p_validade;

  FOR e IN
    SELECT en.id, en.codigo, en.area, en.rua, en.posicao
    FROM public.enderecos en
    WHERE en.galpao_id = v_galpao AND en.area = p_area AND en.rua = p_rua
      AND en.ativo AND en.status = 'livre'
      AND NOT EXISTS (SELECT 1 FROM public.paletes pa WHERE pa.endereco_id = en.id)
    ORDER BY
      -- prefere os endereços logo após os paletes de validade menor (posição FEFO)
      CASE WHEN en.posicao > v_anteriores THEN 0 ELSE 1 END,
      en.posicao, en.nivel
    LIMIT p_paletes
    FOR UPDATE OF en SKIP LOCKED
  LOOP
    INSERT INTO public.paletes (produto_id, galpao_id, area, rua, posicao, endereco_id, quantidade,
                                validade, lote, data_entrada, data_fabricacao, usuario_entrada,
                                ultima_mov_em, ultima_mov_por)
    VALUES (p_produto_id, v_galpao, e.area, e.rua, e.posicao, e.id, p_quantidade,
            p_validade, v_lote, v_entrada, p_data_fabricacao, v_user, v_entrada, v_user)
    RETURNING paletes.id INTO v_id;
    v_novos := v_novos || v_id;
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
END $function$;
REVOKE EXECUTE ON FUNCTION public.registrar_entrada_lote(uuid, text, integer, integer, date, integer, text, date, timestamptz, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_lote(uuid, text, integer, integer, date, integer, text, date, timestamptz, text, uuid) TO authenticated;

-- 3) Auditoria: leitura restrita ------------------------------------------
DROP POLICY IF EXISTS "Movimentacoes visiveis" ON public.movimentacoes;
CREATE POLICY "Movimentacoes visiveis" ON public.movimentacoes
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR usuario_id = auth.uid());