# MÍDIA SEARA V4 — sincronização com SEARA CENTRAL

## Correção principal

O aplicativo não depende mais exclusivamente de `seara_culto_eventos` para descobrir que um culto foi criado.

Ao iniciar:

1. consulta `seara_cultos` no Supabase;
2. recupera a identidade do culto em `seara_culto_tipos`;
3. recupera as mídias em `seara_culto_midias`;
4. seleciona o culto em andamento ou o próximo culto programado;
5. verifica eventos recentes que possam ter sido perdidos;
6. abre Realtime para INSERT/UPDATE/DELETE de cultos;
7. abre Realtime para novas mídias e eventos Central → Mídia.

Assim, se o Pastor criar um culto enquanto o aplicativo Mídia estiver fechado, o culto será carregado quando a Mídia for aberta.

## Comunicação

O canal com o Pastor agora usa `seara_mensagens` no Supabase. A comunicação continua separada da liturgia operacional.

## Supabase

Usa o mesmo projeto:

`https://tdfccdytrfremgvnktzt.supabase.co`

A chave publishable já está configurada no aplicativo.
