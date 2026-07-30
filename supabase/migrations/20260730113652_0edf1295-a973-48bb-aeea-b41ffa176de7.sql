-- ============ PAPÉIS E PERFIS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Perfil proprio visivel" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Atualizar proprio perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Ver papeis" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Novo usuário: cria perfil e, se for o primeiro, vira admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'operador'))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GALPÕES / ÁREAS / RUAS ============
CREATE TABLE public.galpoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.galpoes TO authenticated;
GRANT ALL ON public.galpoes TO service_role;
ALTER TABLE public.galpoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Galpoes visiveis" ON public.galpoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia galpoes" ON public.galpoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER galpoes_updated_at BEFORE UPDATE ON public.galpoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.galpoes (nome, codigo, padrao) VALUES ('Galpão Principal', 'PRINCIPAL', true);

CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  galpao_id uuid NOT NULL REFERENCES public.galpoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (galpao_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Areas visiveis" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia areas" ON public.areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.areas (galpao_id, nome, ordem)
SELECT g.id, r.area, row_number() OVER (ORDER BY r.area)
FROM (SELECT DISTINCT area FROM public.ruas) r
CROSS JOIN public.galpoes g
WHERE g.codigo = 'PRINCIPAL';

-- ruas: liga à área e ganha níveis
ALTER TABLE public.ruas
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  ADD COLUMN niveis integer NOT NULL DEFAULT 1;

UPDATE public.ruas r SET area_id = a.id
FROM public.areas a JOIN public.galpoes g ON g.id = a.galpao_id
WHERE g.codigo = 'PRINCIPAL' AND a.nome = r.area;

ALTER TABLE public.ruas ALTER COLUMN area_id SET NOT NULL;
ALTER TABLE public.paletes DROP CONSTRAINT IF EXISTS paletes_area_rua_fkey;
ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_area_rua_fkey;
ALTER TABLE public.ruas DROP CONSTRAINT IF EXISTS ruas_pkey;
ALTER TABLE public.ruas ADD PRIMARY KEY (id);
ALTER TABLE public.ruas ADD CONSTRAINT ruas_area_rua_unica UNIQUE (area_id, rua);
ALTER TABLE public.ruas ADD CONSTRAINT ruas_capacidade_positiva CHECK (capacidade > 0);
ALTER TABLE public.ruas ADD CONSTRAINT ruas_niveis_positivos CHECK (niveis > 0);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ruas TO authenticated;
GRANT ALL ON public.ruas TO service_role;
DROP POLICY IF EXISTS "Estrutura de ruas visivel" ON public.ruas;
CREATE POLICY "Ruas visiveis" ON public.ruas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia ruas" ON public.ruas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ ESTOQUE VINCULADO AO GALPÃO ============
ALTER TABLE public.paletes ADD COLUMN galpao_id uuid REFERENCES public.galpoes(id);
ALTER TABLE public.movimentacoes ADD COLUMN galpao_id uuid REFERENCES public.galpoes(id);
UPDATE public.paletes SET galpao_id = (SELECT id FROM public.galpoes WHERE codigo = 'PRINCIPAL');
UPDATE public.movimentacoes SET galpao_id = (SELECT id FROM public.galpoes WHERE codigo = 'PRINCIPAL');
ALTER TABLE public.paletes ALTER COLUMN galpao_id SET NOT NULL;
ALTER TABLE public.movimentacoes ALTER COLUMN galpao_id SET NOT NULL;

-- ============ RLS: SOMENTE AUTENTICADOS ============
DROP POLICY IF EXISTS "Produtos acessiveis no painel" ON public.produtos;
DROP POLICY IF EXISTS "Paletes acessiveis no painel" ON public.paletes;
DROP POLICY IF EXISTS "Movimentacoes acessiveis no painel" ON public.movimentacoes;
REVOKE ALL ON public.produtos FROM anon;
REVOKE ALL ON public.paletes FROM anon;
REVOKE ALL ON public.movimentacoes FROM anon;
REVOKE ALL ON public.ruas FROM anon;

CREATE POLICY "Produtos visiveis" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia produtos" ON public.produtos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Paletes visiveis" ON public.paletes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Movimentacoes visiveis" ON public.movimentacoes FOR SELECT TO authenticated USING (true);

-- ============ RPCs COM GALPÃO E NÍVEIS ============
DROP FUNCTION IF EXISTS public.registrar_entrada(uuid, text, integer, integer, date, text, text);
CREATE OR REPLACE FUNCTION public.registrar_entrada(
  p_produto_id uuid,
  p_area text,
  p_rua integer,
  p_quantidade integer,
  p_validade date,
  p_lote text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_galpao_id uuid DEFAULT NULL
)
RETURNS public.paletes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RAISE EXCEPTION 'Rua %-% cheia (capacidade de % paletes)', p_area, p_rua, v_capacidade;
  END IF;

  INSERT INTO public.paletes (produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote)
  VALUES (p_produto_id, v_galpao, p_area, p_rua, v_posicao, p_quantidade, p_validade, NULLIF(btrim(COALESCE(p_lote, '')), ''))
  RETURNING * INTO v_palete;

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote, observacao)
  VALUES ('entrada', p_produto_id, v_galpao, p_area, p_rua, v_posicao, p_quantidade, p_validade, v_palete.lote, NULLIF(btrim(COALESCE(p_observacao, '')), ''));

  RETURN v_palete;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_saida(p_palete_id uuid, p_observacao text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.movimentacoes (tipo, produto_id, galpao_id, area, rua, posicao, quantidade, validade, lote, observacao)
  VALUES ('saida', v.produto_id, v.galpao_id, v.area, v.rua, v.posicao, v.quantidade, v.validade, v.lote, NULLIF(btrim(COALESCE(p_observacao, '')), ''));

  DELETE FROM public.paletes WHERE id = v.id;

  UPDATE public.paletes SET posicao = posicao - 1
  WHERE galpao_id = v.galpao_id AND area = v.area AND rua = v.rua AND posicao > v.posicao;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_entrada(uuid, text, integer, integer, date, text, text, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.registrar_saida(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.registrar_entrada(uuid, text, integer, integer, date, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_saida(uuid, text) TO authenticated;

-- criação de ruas em bloco (admin)
CREATE OR REPLACE FUNCTION public.criar_ruas_em_bloco(p_area_id uuid, p_quantidade integer, p_capacidade integer, p_niveis integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_area text;
  v_inicio integer;
  i integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem alterar a estrutura';
  END IF;
  IF p_quantidade <= 0 OR p_capacidade <= 0 OR p_niveis <= 0 THEN
    RAISE EXCEPTION 'Valores devem ser maiores que zero';
  END IF;

  SELECT nome INTO v_area FROM public.areas WHERE id = p_area_id;
  IF v_area IS NULL THEN
    RAISE EXCEPTION 'Área não encontrada';
  END IF;

  SELECT COALESCE(MAX(rua), 0) INTO v_inicio FROM public.ruas WHERE area_id = p_area_id;

  FOR i IN 1..p_quantidade LOOP
    INSERT INTO public.ruas (area, rua, capacidade, area_id, niveis)
    VALUES (v_area, v_inicio + i, p_capacidade, p_area_id, p_niveis);
  END LOOP;

  RETURN p_quantidade;
END;
$$;
REVOKE ALL ON FUNCTION public.criar_ruas_em_bloco(uuid, integer, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.criar_ruas_em_bloco(uuid, integer, integer, integer) TO authenticated;