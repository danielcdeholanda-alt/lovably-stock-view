## Objetivo

1. Colocar o sistema atrás de login (cadastro fechado, com admin e operador).
2. Tornar a estrutura do armazém editável e multi-galpão, mantendo o galpão atual (áreas A–F, 344 ruas) como galpão principal com todo o estoque preservado.

## 1. Login e permissões

- Tela `/auth` com e-mail e senha. Sem auto-cadastro: o auto-registro fica desativado; contas são criadas por um admin dentro do app (tela "Usuários").
- Todo o painel passa a viver em rota protegida; quem não estiver logado é enviado para `/auth`.
- Cabeçalho ganha o nome do usuário, o papel e o botão "Sair".
- Papéis em tabela própria (`user_roles`), nunca no perfil:
  - **admin**: tudo — cadastrar produtos, editar estrutura de galpões, criar usuários e definir papéis, registrar movimentações.
  - **operador**: registrar entradas e saídas e consultar o painel; sem acesso a estrutura, cadastro de produtos e usuários.
- As regras de acesso ao banco deixam de ser abertas: leitura e escrita só para usuários autenticados, e as operações administrativas só para admin.
- O primeiro admin: o e-mail que você indicar vira admin na migração (me diga o e-mail; se preferir, crio uma tela de "primeiro acesso" que promove o primeiro usuário cadastrado a admin).

## 2. Estrutura modular de galpões

Novo cadastro em três níveis, no banco:

```text
galpao (nome, código, ativo, padrão)
  └── area (letra/nome, ordem)
        └── rua (número, capacidade de paletes, níveis)
```

- A estrutura atual A–F vira o galpão **"Galpão Principal"**, marcado como padrão; paletes e movimentações existentes são vinculados a ele sem perda de dados.
- **Modo simples**: com um único galpão, nada muda na navegação — o seletor de galpão fica oculto e a tela de estrutura edita direto as áreas/ruas desse galpão.
- **Modo multi-galpão**: ao cadastrar o segundo galpão, aparece um seletor no topo do painel; KPIs, mapa, gráficos, tabela e movimentações passam a ser filtrados pelo galpão selecionado.

### Tela "Estrutura" (somente admin)

- Criar/renomear/desativar galpões.
- Por galpão: adicionar e remover áreas.
- Por área: adicionar ruas em bloco (ex.: "70 ruas de 63 paletes, 2 níveis") ou editar rua a rua (capacidade e níveis).
- Proteções: não permite reduzir capacidade abaixo dos paletes já ocupados, nem excluir área/rua com estoque.
- Resumo de capacidade total recalculado a partir do banco (o layout deixa de ser fixo no código).

### Níveis

- Cada rua passa a ter um campo `niveis` (padrão 1). Com `niveis = 1` o comportamento é exatamente o de hoje (paletes no chão, contíguos). Com mais de um nível, a capacidade efetiva da rua é `capacidade × níveis` e o mapa mostra as camadas empilhadas.

## Detalhes técnicos

- Migração: tabelas `galpoes`, `areas`, `ruas` (reestruturada com `area_id`, `niveis`), colunas `galpao_id` em `paletes` e `movimentacoes`, `profiles`, `user_roles` + enum `app_role` e função `has_role` (security definer). GRANTs e RLS por tabela; políticas de escrita administrativa via `has_role`.
- As funções `registrar_entrada` / `registrar_saida` passam a receber o galpão e a ler capacidade/níveis do banco, mantendo a regra de contiguidade e o reagrupamento na saída.
- Front: rota protegida `_authenticated`, `/auth`, hooks de sessão/papel, `src/data/estoque.ts` deixa de conter o layout fixo e passa a derivar tudo das queries; `MapaEstoque`, `Kpis`, `Graficos`, `TabelaEstoque` e `PainelMovimentacao` recebem a estrutura vinda do banco e o galpão selecionado.
