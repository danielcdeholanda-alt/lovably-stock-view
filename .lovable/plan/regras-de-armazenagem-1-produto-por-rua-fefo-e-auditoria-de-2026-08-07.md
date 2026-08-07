# Regras de armazenagem (1 produto por rua + FEFO) e Auditoria de Movimentações

## O que já existe (verificado)
- A tabela de movimentações já grava data, usuário, tipo, produto, lote, validade, palete, quantidade, galpão, área, rua, posição de origem, posição de destino e motivo — e já é somente leitura para todos (ninguém pode editar ou apagar).
- Existe também uma tabela de auditoria técnica (antes/depois de cada alteração), hoje visível apenas para administradores.
- As ruas hoje não têm nenhum vínculo com produto, e a entrada em lote ocupa os endereços livres na ordem de posição/nível, sem considerar validade.

Ou seja: o registro já é imutável e completo. Falta a **tela de consulta** e as **duas regras de armazenagem**.

## 1. Uma rua = um produto
- Nova coluna informativa na rua com o produto que a ocupa (preenchida automaticamente, não digitada).
- Validação no banco (gatilho sobre paletes): qualquer palete que entre, seja transferido ou ajustado numa rua que já tenha outro produto é **bloqueado**, com mensagem clara do tipo: "A rua A-07 já armazena o produto 0401000089 — Sabor X. Escolha outra rua."
- Como a validação fica no banco, vale para a interface, para operações futuras e para quem tentar contornar a tela.
- Quando o último palete da rua sai, a rua fica livre para qualquer produto de novo.
- Na tela: ao escolher área e rua na entrada/transferência, mostrar o produto que ocupa a rua e o espaço restante; ruas com outro produto aparecem desabilitadas.

## 2. Organização por validade (FEFO) dentro da rua
- A posição 01 passa a ser a de validade mais próxima; as seguintes, validades maiores.
- Na entrada em lote, o sistema deixa de simplesmente pegar o primeiro endereço livre: ele calcula, entre os endereços livres da rua, a colocação correta considerando produto → validade → lote → data de entrada.
- Sugestão automática de rua: ao informar produto, validade e quantidade de paletes, o painel sugere a melhor rua disponível (primeiro ruas que já têm o mesmo produto e espaço, depois ruas vazias) e a posição inicial.
- Quando a validade nova for menor que a de paletes já posicionados à frente, o sistema avisa que o ideal seria reposicionar e oferece a lista de transferências sugeridas (não move nada sozinho).
- O mapa passa a destacar a ordem FEFO da rua e sinalizar ruas fora de ordem.

## 3. Módulo de Auditoria de Movimentações (somente administrador)
- Nova página **Auditoria**, no menu apenas para administradores; acesso também bloqueado no banco (quem não é admin não lê os registros).
- Lista completa do histórico com: data/hora, usuário, tipo (entrada, saída, transferência, ajuste, bloqueio, desbloqueio), produto, lote, validade, palete, quantidade, galpão, área, rua, posição anterior → nova posição e motivo.
- Filtros: período, usuário, produto, lote, palete, área, rua, posição e tipo.
- Coluna "De → Para" mostrando claramente origem e destino de cada palete.
- Exportação em CSV do resultado filtrado.
- Nenhuma ação de editar/excluir/limpar existe na tela nem é permitida pelo banco.

## Detalhes técnicos
- Migração: coluna `produto_id` em `ruas` (derivada), gatilho `validar_produto_rua()` em `paletes` (INSERT/UPDATE) levantando exceção, e função `sugerir_endereco_fefo(galpao, produto, validade, paletes)`.
- `registrar_entrada_lote` e `registrar_transferencia` reescritas para escolher/validar endereço por ordem FEFO em vez de `ORDER BY posicao, nivel`.
- Política de leitura de `movimentacoes` restrita a admin para a nova visão de auditoria (mantendo o histórico resumido do painel para operadores via visão filtrada).
- Frontend: nova rota `src/routes/_authenticated/auditoria.tsx`, hook de consulta paginada em `src/lib/estoque-queries.ts`, ajustes em `PainelMovimentacao.tsx`, `AcoesPalete.tsx` e `MapaEstoque.tsx`.
- Mensagens de erro do banco traduzidas em `src/lib/erros-banco.ts`.
