-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.politica_saida AS ENUM ('FIFO','FEFO','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tipo_armazenagem AS ENUM ('porta_paletes','palete_chao','blocado','empilhamento','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.palete_status AS ENUM ('disponivel','reservado','bloqueado','quarentena','expedido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.endereco_status AS ENUM ('livre','ocupado','reservado','bloqueado','interditado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ GALPOES ============
ALTER TABLE public.galpoes
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS politica_saida public.politica_saida NOT NULL DEFAULT 'FEFO';

-- ============ AREAS ============
ALTER TABLE public.areas
  ADD COLUMN IF NOT EXISTS tipo_armazenagem public.tipo_armazenagem NOT NULL DEFAULT 'palete_chao',
  ADD COLUMN IF NOT EXISTS altura_max integer NOT NULL DEFAULT 1;
ALTER TABLE public.areas DROP CONSTRAINT IF EXISTS areas_altura_max_check;
ALTER TABLE public.areas ADD CONSTRAINT areas_altura_max_check CHECK (altura_max > 0);

-- ============ ENDERECOS ============
CREATE TABLE IF NOT EXISTS public.enderecos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  galpao_id uuid NOT NULL REFERENCES public.galpoes(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  rua_id uuid REFERENCES public.ruas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  area text NOT NULL,
  rua integer,
  posicao integer,
  nivel integer,
  bloco text,
  capacidade integer NOT NULL DEFAULT 1 CHECK (capacidade > 0),
  status public.endereco_status NOT NULL DEFAULT 'livre',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enderecos_codigo_unico UNIQUE (area_id, codigo)
);

GRANT SELECT ON public.enderecos TO authenticated;
GRANT ALL ON public.enderecos TO service_role;
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enderecos visiveis" ON public.enderecos;
CREATE POLICY "Enderecos visiveis" ON public.enderecos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin gerencia enderecos" ON public.enderecos;
CREATE POLICY "Admin gerencia enderecos" ON public.enderecos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_enderecos_galpao ON public.enderecos(galpao_id);
CREATE INDEX IF NOT EXISTS idx_enderecos_area ON public.enderecos(area_id, rua, posicao, nivel);
CREATE INDEX IF NOT EXISTS idx_enderecos_status ON public.enderecos(galpao_id, status);

DROP TRIGGER IF EXISTS trg_enderecos_updated ON public.enderecos;
CREATE TRIGGER trg_enderecos_updated BEFORE UPDATE ON public.enderecos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Gera endereços das ruas já cadastradas (idempotente)
INSERT INTO public.enderecos (galpao_id, area_id, rua_id, codigo, area, rua, posicao, nivel)
SELECT a.galpao_id, a.id, r.id,
       a.nome || '-' || lpad(r.rua::text,2,'0') || '-' || lpad(p.p::text,2,'0')
         || CASE WHEN r.niveis > 1 THEN '-' || lpad(n.n::text,2,'0') ELSE '' END,
       a.nome, r.rua, p.p, CASE WHEN r.niveis > 1 THEN n.n ELSE NULL END
FROM public.ruas r
JOIN public.areas a ON a.id = r.area_id
CROSS JOIN LATERAL generate_series(1, r.capacidade) AS p(p)
CROSS JOIN LATERAL generate_series(1, r.niveis) AS n(n)
ON CONFLICT (area_id, codigo) DO NOTHING;

-- ============ PALETES ============
CREATE SEQUENCE IF NOT EXISTS public.palete_codigo_seq;
GRANT USAGE ON SEQUENCE public.palete_codigo_seq TO service_role;

ALTER TABLE public.paletes
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS endereco_id uuid REFERENCES public.enderecos(id),
  ADD COLUMN IF NOT EXISTS data_entrada timestamptz,
  ADD COLUMN IF NOT EXISTS data_fabricacao date,
  ADD COLUMN IF NOT EXISTS status public.palete_status NOT NULL DEFAULT 'disponivel',
  ADD COLUMN IF NOT EXISTS usuario_entrada uuid,
  ADD COLUMN IF NOT EXISTS ultima_mov_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_mov_por uuid;

UPDATE public.paletes SET data_entrada = created_at WHERE data_entrada IS NULL;
UPDATE public.paletes SET codigo = 'PAL-' || lpad(nextval('public.palete_codigo_seq')::text, 6, '0') WHERE codigo IS NULL;
ALTER TABLE public.paletes ALTER COLUMN data_entrada SET DEFAULT now();
ALTER TABLE public.paletes ALTER COLUMN data_entrada SET NOT NULL;
ALTER TABLE public.paletes ALTER COLUMN codigo SET DEFAULT 'PAL-' || lpad(nextval('public.palete_codigo_seq')::text, 6, '0');
ALTER TABLE public.paletes ALTER COLUMN codigo SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_paletes_codigo ON public.paletes(codigo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paletes_endereco_unico ON public.paletes(endereco_id) WHERE endereco_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paletes_produto ON public.paletes(produto_id);
CREATE INDEX IF NOT EXISTS idx_paletes_lote ON public.paletes(lote);
CREATE INDEX IF NOT EXISTS idx_paletes_fifo ON public.paletes(galpao_id, status, data_entrada, id);
CREATE INDEX IF NOT EXISTS idx_paletes_fefo ON public.paletes(galpao_id, status, validade, id);

ALTER TABLE public.paletes DROP CONSTRAINT IF EXISTS paletes_fabricacao_validade;
ALTER TABLE public.paletes ADD CONSTRAINT paletes_fabricacao_validade
  CHECK (data_fabricacao IS NULL OR validade IS NULL OR data_fabricacao <= validade);

-- Mantém a situação do endereço em sincronia com a ocupação
CREATE OR REPLACE FUNCTION public.sincronizar_endereco()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.endereco_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR NEW.endereco_id IS DISTINCT FROM OLD.endereco_id) THEN
    UPDATE public.enderecos SET status = 'livre' WHERE id = OLD.endereco_id AND status = 'ocupado';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.endereco_id IS NOT NULL THEN
    UPDATE public.enderecos SET status = 'ocupado' WHERE id = NEW.endereco_id AND status IN ('livre','reservado');
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_paletes_endereco ON public.paletes;
CREATE TRIGGER trg_paletes_endereco AFTER INSERT OR UPDATE OR DELETE ON public.paletes
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_endereco();

-- ============ MOVIMENTACOES ============
ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS palete_id uuid,
  ADD COLUMN IF NOT EXISTS palete_codigo text,
  ADD COLUMN IF NOT EXISTS endereco_id uuid REFERENCES public.enderecos(id),
  ADD COLUMN IF NOT EXISTS endereco_destino_id uuid REFERENCES public.enderecos(id),
  ADD COLUMN IF NOT EXISTS area_destino text,
  ADD COLUMN IF NOT EXISTS rua_destino integer,
  ADD COLUMN IF NOT EXISTS posicao_destino integer,
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS quantidade_anterior integer;

ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_tipo_check;
ALTER TABLE public.movimentacoes ADD CONSTRAINT movimentacoes_tipo_check
  CHECK (tipo IN ('entrada','saida','transferencia','ajuste','bloqueio','desbloqueio'));
ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_quantidade_check;
ALTER TABLE public.movimentacoes ADD CONSTRAINT movimentacoes_quantidade_check CHECK (quantidade <> 0);

CREATE INDEX IF NOT EXISTS idx_mov_galpao_data ON public.movimentacoes(galpao_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_mov_produto ON public.movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_usuario ON public.movimentacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mov_tipo ON public.movimentacoes(tipo);

-- ============ AUDITORIA ============
CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id uuid,
  acao text NOT NULL,
  usuario_id uuid,
  valor_anterior jsonb,
  valor_novo jsonb,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins veem auditoria" ON public.auditoria;
CREATE POLICY "Admins veem auditoria" ON public.auditoria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON public.auditoria(tabela, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria(usuario_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  BEGIN
    v_id := CASE WHEN TG_OP = 'DELETE' THEN (to_jsonb(OLD)->>'id')::uuid ELSE (to_jsonb(NEW)->>'id')::uuid END;
  EXCEPTION WHEN others THEN v_id := NULL;
  END;
  INSERT INTO public.auditoria (tabela, registro_id, acao, usuario_id, valor_anterior, valor_novo)
  VALUES (
    TG_TABLE_NAME, v_id, lower(TG_OP), auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos','galpoes','areas','ruas','enderecos','paletes','user_roles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_auditoria_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria()', t);
  END LOOP;
END $$;