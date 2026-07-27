UPDATE public.produtos SET codigo = lpad(regexp_replace(codigo, '\D', '', 'g'), 10, '0');

ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_codigo_formato CHECK (codigo ~ '^\d{4}000\d{3}$');

ALTER TABLE public.produtos
  ADD COLUMN tipo_codigo text GENERATED ALWAYS AS (left(codigo, 4)) STORED,
  ADD COLUMN sabor_codigo text GENERATED ALWAYS AS (right(codigo, 3)) STORED;

CREATE INDEX IF NOT EXISTS produtos_tipo_codigo_idx ON public.produtos (tipo_codigo);
CREATE INDEX IF NOT EXISTS produtos_sabor_codigo_idx ON public.produtos (sabor_codigo);