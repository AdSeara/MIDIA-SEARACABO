# SEARA — Entrega Core Central ↔ Mídia

Pacote gerado a partir dos repositórios reais fornecidos no histórico da conversa.

## Pacotes

- `SEARA-CENTRAL-V10.2-CORE/`
- `MIDIA-SEARA-V7-CORE/`

## Mudança arquitetural

A operação compartilhada agora usa exclusivamente:

`seara_culto_operacao`

com:

`oportunidade_atual_id`
`status`
`versao`

A integração persistente usa:

`seara_culto_eventos`

O Realtime propaga as alterações.

## Não foi feita migration nova

A tabela operacional e as RPCs são consideradas já implantadas no Supabase existente.

## Verificação obrigatória

Antes do primeiro teste de operação, execute somente leitura:

`SEARA-CENTRAL-V10.2-CORE/supabase/verification/VERIFY_OPERATION_CONTRACT.sql`

Isso confirma a assinatura real das RPCs antes de testar o botão `Iniciar culto`.
