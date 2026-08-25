# MÍDIA SEARA — Core Integration 7.0

## Regra operacional

`SEARA CENTRAL` planeja.

`MÍDIA SEARA` inicia, avança, volta e encerra.

`seara_culto_operacao` é a fonte oficial do estado operacional.

A Mídia não usa `seara_cultos.current_index`, `operacao_atual` ou `operacao_estado` para determinar a posição do culto.

## Bridge

`seara-core-bridge.js` é a única camada da Mídia responsável por:

- `ensureOperation()`
- `getOperation()`
- `setOperation()`
- `publishEvent()`
- `subscribeOperation()`
- leitura do culto compartilhado
- alteração da liturgia compartilhada
- mídias compartilhadas

A interface não escreve diretamente em `seara_culto_operacao` ou `seara_culto_eventos`.

## Concorrência

Toda alteração operacional carrega `versaoEsperada`.

Se outro dispositivo alterar a operação antes da gravação, a Mídia não sobrescreve o estado. O estado atual é recarregado e o operador recebe a mensagem:

> O estado do culto foi alterado por outro dispositivo. Atualizando...

## Supabase

Não execute migrations antigas desta pasta.

Os arquivos SQL `006_operacao_bidirecional_whatsapp.sql` e `007_corrigir_schema_integracao.sql` pertencem ao modelo anterior baseado em `current_index` e não fazem parte desta entrega.

A migration que criou `seara_culto_operacao` e as RPCs já foi executada no projeto Supabase existente, conforme o contrato fornecido.

## Storage

O upload utiliza o bucket `seara-media`. O aplicativo não cria bucket automaticamente.

Se o bucket não existir, o sistema continuará permitindo URLs externas, mas upload físico de arquivos falhará de forma explícita.

## Deploy

1. Substitua o conteúdo do repositório pelo conteúdo desta versão.
2. Commit/push.
3. Aguarde o GitHub Pages.
4. Faça `Ctrl+Shift+R`.
5. Se necessário, DevTools → Application → Service Workers → Unregister.

## Teste mínimo

- Culto criado no Central aparece na Mídia.
- Mídia inicia o culto.
- `seara_culto_operacao.status` muda para `em_andamento`.
- `oportunidade_atual_id` aponta para a primeira oportunidade.
- Avançar altera `oportunidade_atual_id`.
- Voltar restaura a oportunidade anterior.
- Encerrar muda `status` para `encerrado`.
- Central recebe todas essas alterações por Realtime.
- Mídias adicionadas pelo Central aparecem na Mídia.
- Mídias adicionadas pela Mídia aparecem no Central.
- Chat continua persistente e em tempo real.

## Observação sobre as RPCs

Os ZIPs fornecidos não continham o SQL exato da migration operacional já executada. O bridge usa a assinatura contratual informada para `seara_ensure_culto_operacao()` e `seara_set_culto_operacao()` e possui fallback condicional seguro para o caso de o RPC não estar exposto pelo PostgREST.
