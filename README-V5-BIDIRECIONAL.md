# MÍDIA SEARA V5 — operação compartilhada com SEARA CENTRAL

## Responsabilidade
O Mídia Seara é o aplicativo que inicia e conduz o culto.

O Central não controla a passagem das etapas. Ele acompanha o estado operacional.

## Sincronização
O aplicativo lê `seara_cultos` e usa Realtime para receber:
- novo culto;
- alterações da liturgia;
- início do culto;
- mudança de AGORA;
- encerramento;
- novas mídias;
- mídias desativadas.

Quando a Mídia inicia/avança/volta/encerra ou insere oportunidade, ela atualiza `seara_cultos`.

## Comunicação
Chat bidirecional com o SEARA CENTRAL:
- mensagens;
- anexos;
- emojis;
- respostas;
- confirmação de leitura;
- apagar mensagem própria;
- Realtime.

## Importante
Execute a migration `006_operacao_bidirecional_whatsapp.sql` no mesmo projeto Supabase usado pelo Central.
