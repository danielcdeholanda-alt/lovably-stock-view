# Evolução para WMS configurável

Objetivo: transformar o sistema atual em um WMS configurável, sem recriar nada. Tudo é incremental: as tabelas, telas e dados atuais continuam funcionando durante todas as fases.

## O que já existe e será preservado

- Galpões, áreas, ruas (com capacidade e níveis), produtos, paletes, movimentações, perfis e papéis.
- Login, senha provisória obrigatória, redefinição pelo administrador, histórico de redefinições.
- Dashboard, mapa de estoque, KPIs, gráficos, tabela, painel de entrada/saída, tela de estrutura e de usuários.

## Fases

### Fase 1 — Modelo de estoque e integridade
- Palete ganha: código do palete, data de entrada explícita, data de fabricação, status (disponível, reservado, bloqueado, quarentena, expedido), usuário e data da entrada, usuário e data da última movimentação.
- Endereço de armazenagem passa a existir como conceito próprio (ligado à área), com rua, posição, nível, bloco, capacidade e status (livre, ocupado, reservado, bloqueado, interditado). As ruas atuais são convertidas automaticamente, sem perda.
- Área ganha tipo de armazenagem: porta-paletes, palete no chão, blocado, empilhamento, outro.
- Galpão ganha descrição e política de saída (FIFO, FEFO, MANUAL).
- Restrições: quantidade e capacidade não negativas, endereço único por área, um palete por endereço quando o tipo exigir.
- Índices nas colunas realmente consultadas (produto, lote, validade, data de entrada, galpão, área, endereço, status).

### Fase 2 — Política de saída no banco
- Função única `registrar_saida_por_regra`: lê a política do galpão, seleciona os paletes (data de entrada para FIFO, validade para FEFO, seleção explícita no MANUAL), ignora paletes bloqueados/reservados/quarentena, trava as linhas para evitar que dois operadores retirem o mesmo palete, grava as movimentações e devolve exatamente quais paletes saíram.
- Prévia de saída antes de confirmar: lista dos paletes que serão retirados, total de paletes e unidades.

### Fase 3 — Endereçamento configurável
- Tela de estrutura passa a criar endereços conforme o tipo da área (porta-paletes usa rua/posição/nível; chão usa rua/posição; blocado usa bloco/posição; empilhamento usa altura máxima).
- Códigos legíveis do tipo `A-01-05-02`, já adequados para código de barras/QR no futuro.
- Bloqueio/interdição de endereço impede receber palete.

### Fase 4 — Operações
- Entrada em lote transacional: 10 paletes entram todos ou nenhum.
- Saída automática (pela política) ou manual, sempre com prévia e confirmação.
- Transferência interna como movimentação única com origem e destino.
- Inventário/ajuste: contagem física gera movimentação de ajuste com motivo, nunca edição direta da quantidade.
- Bloqueio/desbloqueio de palete.

### Fase 5 — Usuários e segurança
- Papel de novo usuário nunca vem do frontend: todo cadastro nasce como operador e só um administrador promove.
- Revisão das permissões de leitura de perfis.

### Fase 6 — Recuperação de senha
- "Esqueci minha senha" no login, usando o envio de e-mail nativo, com a mesma mensagem exista ou não a conta.
- Rota `/redefinir-senha` com nova senha e confirmação, tratando link expirado/inválido.
- Senha provisória continua obrigando a troca antes de usar o sistema.

### Fase 7 — Auditoria
- Tabela de auditoria com usuário, ação, tabela, registro, valor anterior, valor novo, motivo e data, alimentada por gatilhos nas tabelas sensíveis.
- Tela de consulta de auditoria só para administrador.

### Fase 8 — Dashboard e relatórios
- Novos indicadores: transferências, ajustes, estoque bloqueado, em quarentena, espaços livres, vencidos e a vencer em 7/15/30 dias.
- Filtros por galpão, área, rua, produto, lote, período e status.
- Consultas de estoque atual, movimentações e auditoria.
- Busca global por produto, lote, palete, endereço e rua.

### Fase 9 — Testes
- FIFO, FEFO e manual com casos controlados; entrada em lote; endereço bloqueado/ocupado; concorrência de saída e de ocupação; regressão de login, dashboard, mapa, produtos, entrada, saída, usuários e permissões.

## Notas técnicas

- Migrações incrementais e aditivas; nada de `DELETE` em paletes, produtos ou movimentações. Colunas novas entram com valor padrão e backfill (`data_entrada` recebe `created_at`, status recebe `disponivel`).
- `registrar_entrada` e `registrar_saida` atuais continuam existindo como compatibilidade; as novas funções ficam ao lado até o frontend migrar.
- Seleção de paletes com `SELECT ... FOR UPDATE SKIP LOCKED` e ocupação de endereço garantida por índice único, resolvendo concorrência no banco.
- Erros do Postgres traduzidos para mensagens de operador ("Este endereço já está ocupado", "Não há paletes disponíveis suficientes").
- RLS mantida; escrita continua apenas via funções com verificação de sessão e papel.

## Entrega

Cada fase é entregue verificando que o projeto continua compilando e funcionando, e ao final informo tabelas/colunas/constraints/índices/RPCs criados, arquivos alterados, o que mudou em segurança e os testes executados.
