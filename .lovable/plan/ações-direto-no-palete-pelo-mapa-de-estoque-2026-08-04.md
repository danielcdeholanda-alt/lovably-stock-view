# Ações direto no palete pelo Mapa de estoque

Hoje, clicar em uma posição do mapa só mostra os detalhes no rodapé. A ideia é permitir agir sobre o palete ali mesmo: pedir a retirada (saída) ou transferir para outro endereço, sem ir até o painel de movimentação.

## Como vai funcionar

- Ao clicar numa posição **ocupada**, abre uma janela com os dados do palete (código, produto, quantidade, lote, validade, endereço, status) e dois botões: **Retirar palete** e **Transferir palete**.
- **Retirar**: pede uma observação opcional, mostra um resumo de confirmação ("Sair o palete PAL-000123 do endereço A-01-05?") e confirma a saída daquele palete específico, mesmo quando a regra do galpão é FIFO/FEFO (é uma saída manual, por seleção).
- **Transferir**: lista os endereços livres do galpão (com filtro por área e rua), pede um motivo opcional e efetiva a transferência.
- Posição **livre** continua apenas informando que está livre (sem ações).
- Palete que não está disponível (bloqueado, quarentena, reservado) mostra o motivo e os botões ficam desabilitados, com aviso de que é preciso desbloquear antes.
- Sucesso mostra aviso e atualiza mapa, KPIs, tabela e histórico automaticamente; erro do banco aparece como mensagem legível (endereço ocupado, palete já retirado, etc.).
- O rodapé de detalhes atual continua existindo.

## Detalhes técnicos

- `src/components/estoque/MapaEstoque.tsx`: célula ocupada abre um `Dialog` (shadcn) com as duas ações; estado local para diálogo/ação selecionada.
- Novo componente `src/components/estoque/AcoesPalete.tsx` com o conteúdo do diálogo, para não inchar o mapa.
- Reaproveita hooks existentes, sem mudança de banco nem de RPC:
  - retirada → `useSaidaPorRegra()` com `p_palete_ids: [id]` (caminho manual já suportado pela função `registrar_saida_por_regra`).
  - transferência → `useTransferencia()` (`registrar_transferencia`) + `useEnderecos(galpaoId, area, rua)` para listar destinos livres.
- Erros traduzidos com o helper existente `src/lib/erros-banco.ts`; feedback por toast (sonner).
- Invalidação de queries já feita pelos hooks; nada muda em `src/data/estoque.ts` nem em `PainelMovimentacao.tsx`.
