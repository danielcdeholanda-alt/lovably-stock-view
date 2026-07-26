
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  unidade text NOT NULL DEFAULT 'caixa',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produtos_codigo_nao_vazio CHECK (length(btrim(codigo)) > 0),
  CONSTRAINT produtos_nome_nao_vazio CHECK (length(btrim(nome)) > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO anon, authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produtos acessiveis no painel" ON public.produtos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ruas (
  area text NOT NULL,
  rua integer NOT NULL,
  capacidade integer NOT NULL CHECK (capacidade > 0),
  PRIMARY KEY (area, rua)
);
GRANT SELECT ON public.ruas TO anon, authenticated;
GRANT ALL ON public.ruas TO service_role;
ALTER TABLE public.ruas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estrutura de ruas visivel" ON public.ruas FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.paletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  area text NOT NULL,
  rua integer NOT NULL,
  posicao integer NOT NULL CHECK (posicao > 0),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  validade date NOT NULL,
  lote text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area, rua, posicao),
  FOREIGN KEY (area, rua) REFERENCES public.ruas(area, rua)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paletes TO anon, authenticated;
GRANT ALL ON public.paletes TO service_role;
ALTER TABLE public.paletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Paletes acessiveis no painel" ON public.paletes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX paletes_area_rua_idx ON public.paletes (area, rua, posicao);
CREATE INDEX paletes_validade_idx ON public.paletes (validade);

CREATE TABLE public.movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  area text NOT NULL,
  rua integer NOT NULL,
  posicao integer NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  validade date,
  lote text,
  observacao text,
  data timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes TO anon, authenticated;
GRANT ALL ON public.movimentacoes TO service_role;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Movimentacoes acessiveis no painel" ON public.movimentacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX movimentacoes_data_idx ON public.movimentacoes (data DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER produtos_set_updated_at BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Estrutura fixa do armazem: areas -> ruas -> capacidade de paletes
DO $$
DECLARE
  blocos jsonb := '[
    {"area":"A","ruas":70,"paletes":63},
    {"area":"B","ruas":32,"paletes":19},
    {"area":"B","ruas":4,"paletes":43},
    {"area":"B","ruas":20,"paletes":19},
    {"area":"C","ruas":61,"paletes":33},
    {"area":"D","ruas":34,"paletes":33},
    {"area":"D","ruas":26,"paletes":49},
    {"area":"E","ruas":34,"paletes":15},
    {"area":"F","ruas":63,"paletes":35}
  ]';
  b jsonb;
  i integer;
  contador jsonb := '{}';
  atual integer;
BEGIN
  FOR b IN SELECT * FROM jsonb_array_elements(blocos) LOOP
    atual := COALESCE((contador ->> (b ->> 'area'))::int, 0);
    FOR i IN 1..(b ->> 'ruas')::int LOOP
      atual := atual + 1;
      INSERT INTO public.ruas (area, rua, capacidade)
      VALUES (b ->> 'area', atual, (b ->> 'paletes')::int);
    END LOOP;
    contador := contador || jsonb_build_object(b ->> 'area', atual);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_entrada(
  p_produto_id uuid,
  p_area text,
  p_rua integer,
  p_quantidade integer,
  p_validade date,
  p_lote text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS public.paletes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacidade integer;
  v_posicao integer;
  v_palete public.paletes;
BEGIN
  SELECT capacidade INTO v_capacidade FROM public.ruas WHERE area = p_area AND rua = p_rua;
  IF v_capacidade IS NULL THEN
    RAISE EXCEPTION 'Rua % da área % não existe', p_rua, p_area;
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  IF p_validade IS NULL THEN
    RAISE EXCEPTION 'Informe a validade do palete';
  END IF;

  SELECT COALESCE(MAX(posicao), 0) + 1 INTO v_posicao
  FROM public.paletes WHERE area = p_area AND rua = p_rua;

  IF v_posicao > v_capacidade THEN
    RAISE EXCEPTION 'Rua %-% cheia (capacidade de % paletes)', p_area, p_rua, v_capacidade;
  END IF;

  INSERT INTO public.paletes (produto_id, area, rua, posicao, quantidade, validade, lote)
  VALUES (p_produto_id, p_area, p_rua, v_posicao, p_quantidade, p_validade, NULLIF(btrim(COALESCE(p_lote, '')), ''))
  RETURNING * INTO v_palete;

  INSERT INTO public.movimentacoes (tipo, produto_id, area, rua, posicao, quantidade, validade, lote, observacao)
  VALUES ('entrada', p_produto_id, p_area, p_rua, v_posicao, p_quantidade, p_validade, v_palete.lote, NULLIF(btrim(COALESCE(p_observacao, '')), ''));

  RETURN v_palete;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_saida(
  p_palete_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.paletes;
BEGIN
  SELECT * INTO v FROM public.paletes WHERE id = p_palete_id;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Palete não encontrado';
  END IF;

  INSERT INTO public.movimentacoes (tipo, produto_id, area, rua, posicao, quantidade, validade, lote, observacao)
  VALUES ('saida', v.produto_id, v.area, v.rua, v.posicao, v.quantidade, v.validade, v.lote, NULLIF(btrim(COALESCE(p_observacao, '')), ''));

  DELETE FROM public.paletes WHERE id = v.id;

  -- Paletes ficam no chão: reagrupa a rua para não deixar espaços vazios.
  UPDATE public.paletes SET posicao = posicao - 1
  WHERE area = v.area AND rua = v.rua AND posicao > v.posicao;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_entrada(uuid, text, integer, integer, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_saida(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_entrada(uuid, text, integer, integer, date, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_saida(uuid, text) TO anon, authenticated, service_role;
