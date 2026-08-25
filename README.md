# MÍDIA SEARA

Aplicativo independente da Mídia da Assembleia de Deus Seara — Cabo.

## Objetivo desta versão

Esta versão inicia o refinamento operacional da Mídia antes da integração com os demais aplicativos.

### Responsabilidades
- acompanhar a sequência real do culto;
- operar o Modo Culto com AGORA / PRÓXIMO / DEPOIS;
- avançar e voltar na sequência;
- inserir oportunidade durante o culto;
- alterar a raiz da programação quando necessário;
- reproduzir áudio, vídeo e imagem;
- manter uma fila de mídia auxiliar sem alterar a sequência principal;
- registrar observações e comunicação operacional;
- preservar um histórico local das ações;
- funcionar em modo claro por padrão, com modo escuro equivalente.

## Importante

A comunicação com SEARA CENTRAL, Pastor, Sonoplastia, Banda AD Seara e demais aplicativos ainda não está conectada nesta etapa. A interface já reserva esses pontos para a integração futura.

Os dados desta versão são locais no navegador. O backend/Supabase e a sincronização entre repositórios serão implementados depois que os fluxos individuais estiverem validados.

## Estrutura

- `index.html` — entrada da PWA
- `styles.css` — identidade visual e responsividade
- `app.js` — lógica da aplicação
- `manifest.webmanifest` — instalação PWA
- `sw.js` — cache/offline controlado
- `assets/logo-midia.png` — logo oficial enviada para a Mídia

## Publicação

Suba todos os arquivos na raiz do repositório GitHub e publique pelo GitHub Pages.

## Próxima etapa recomendada

Validar visualmente e funcionalmente o Modo Culto e, depois, definir o contrato de dados que será usado na integração com o SEARA CENTRAL.
