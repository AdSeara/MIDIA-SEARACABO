# MÍDIA SEARA V6 — correção da integração

## Problemas tratados

1. O chat estava retornando HTTP 400 porque o PostgREST não encontrava `seara_mensagens.anexo_nome` no schema cache.
2. O botão **Iniciar culto** agora captura e mostra o erro real do Supabase, em vez de gerar apenas `Uncaught (in promise) Object`.
3. A migration garante todas as colunas operacionais usadas pela Mídia para iniciar/avançar o culto.
4. A migration força o reload do schema do PostgREST.

## Ordem obrigatória

1. Abra o Supabase SQL Editor do projeto usado pelo SEARA.
2. Execute `007_corrigir_schema_integracao.sql` inteiro.
3. Aguarde a execução terminar sem erro.
4. Substitua o repositório da Mídia pelo conteúdo desta versão.
5. Faça commit/push.
6. No navegador, faça Ctrl+Shift+R. Se necessário, Application > Service Workers > Unregister.
7. Abra a Mídia, confirme que o culto aparece e clique **Iniciar culto**.

Não é necessário criar outro projeto Supabase.
