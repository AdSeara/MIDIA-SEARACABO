const STORE='seara_midia_v6';
let supabaseClient=null, coreBridge=null, realtimeChannel=null, remoteMessagesChannel=null, remoteStatus='connecting';
let remoteCultos=[], chatReplyTo=null;
const DEFAULT={theme:'light',cult:null,sequence:[],current:0,media:[],messages:[],log:[],standaloneMedia:[],settings:{church:'Assembleia de Deus Seara — Cabo'}};
let state={...DEFAULT,...JSON.parse(localStorage.getItem(STORE)||'{}')};
state.sequence=Array.isArray(state.sequence)?state.sequence:[];state.messages=Array.isArray(state.messages)?state.messages:[];
const root=document.getElementById('app');
const modules=['Início','Modo Culto','Programação','Biblioteca de Mídia','Comunicação','Histórico'];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function save(){localStorage.setItem(STORE,JSON.stringify(state));}
function toast(msg){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function setTheme(dark){state.theme=dark?'dark':'light';document.documentElement.dataset.theme=dark?'dark':'';document.querySelector('meta[name="theme-color"]').setAttribute('content',dark?'#0c0c0d':'#fff');save()}
function mediaSupabaseInit(){try{if(!window.supabase?.createClient)throw Error('Biblioteca Supabase não carregada.');supabaseClient=window.supabase.createClient(SEARA_SUPABASE_CONFIG.url,SEARA_SUPABASE_CONFIG.publishableKey);coreBridge=new window.SearaCoreBridge(supabaseClient);return true}catch(e){remoteStatus='error';console.error(e);return false}}
function modal(body){closeModal();const o=document.createElement('div');o.className='overlay';o.id='overlay';o.innerHTML=`<div class="modal">${body}</div>`;document.body.appendChild(o)}
function closeModal(){document.getElementById('overlay')?.remove()}
function currentItem(){return state.sequence[state.current]||null}
function seqCard(x,i){return `<div class="seq-item ${i===state.current?'current':''}"><div><div class="seq-number">${String(i+1).padStart(2,'0')}</div><div class="seq-title">${esc(x.title)}</div><div class="seq-sub">${esc(x.type)} • ${esc(x.group||'Sem grupo')} ${x.note?'• '+esc(x.note):''}</div></div><span class="badge ${x.status==='em_andamento'?'live':''}">${esc(x.status||'aguardando')}</span></div>`}
async function hydrateCult(row){
  if(!row)return null;
  const snapshot=await coreBridge.getSnapshot(row.id);
  return snapshot;
}

function sequenceFromRow(row){
  return Array.isArray(row?.liturgia)?row.liturgia.map((o,i)=>({
    id:o.id||crypto.randomUUID(),
    position:i+1,
    title:o.titulo||o.title||o.tipo||'Oportunidade',
    type:o.tipo||o.type||'Outra atividade',
    group:o.grupoId||o.grupo||'Sem grupo',
    note:[o.descricao,o.musicaSolicitada].filter(Boolean).join(' • '),
    status:o.status||'aguardando',
    ordem:i+1
  })):[];
}

function rowToLocal(row){
  const sequence=sequenceFromRow(row);
  const operation=row.operacao||null;
  const currentIndex=operation?.oportunidade_atual_id ? sequence.findIndex(o=>o.id===operation.oportunidade_atual_id) : -1;
  const operationStatus=operation?.status||'aguardando';
  return {
    id:row.id,
    name:row.titulo||row.tipo?.nome||row.tipo_slug||'Culto',
    type:row.tipo?.nome||row.tipo_slug||'Culto',
    date:row.data_inicio?new Date(row.data_inicio).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—',
    startedAt:operation?.iniciado_em||null,
    note:row.observacoes||'',
    planningStatus:row.status,
    status:operationStatus==='em_andamento'?'em_andamento':operationStatus==='encerrado'?'encerrado':row.status,
    operationStatus,
    operationVersion:Number(operation?.versao||0),
    currentOpportunityId:operation?.oportunidade_atual_id||null,
    currentIndex:currentIndex>=0?currentIndex:0,
    operacaoAtual:currentIndex>=0?sequence[currentIndex]?.title||'':operationStatus==='encerrado'?'Culto encerrado':'',
    operacaoAtualizadaEm:operation?.atualizado_em||null,
    midias:row.midias||[],
    sequence,
    remote:true
  };
}

function applyRemoteCult(row){
  if(!row)return;
  const local=rowToLocal(row);
  state.cult=local;
  state.sequence=local.sequence;
  state.current=local.currentIndex;
  remoteStatus='connected';
  save();
}

async function fetchCultById(id){
  if(!supabaseClient||!id)return null;
  try{return await hydrateCult({id});}
  catch(error){console.error('[MÍDIA] Falha ao carregar culto',error);return null;}
}

async function syncRemoteCultos(){
  if(!supabaseClient)return;
  const r=await supabaseClient.from('seara_cultos').select('id').order('data_inicio',{ascending:true}).limit(100);
  if(r.error){remoteStatus='error';toast('Falha ao consultar cultos do SEARA CENTRAL.');console.error(r.error);return;}
  remoteCultos=[];
  for(const row of r.data||[]){
    try{remoteCultos.push(await hydrateCult(row));}
    catch(error){console.error('[MÍDIA] Falha ao hidratar culto',row.id,error);}
  }
  const candidates=remoteCultos.filter(x=>x&&x.status!=='cancelado'&&x.operationStatus!=='encerrado');
  const now=Date.now();
  const active=candidates.find(x=>x.operationStatus==='em_andamento')||
    candidates.find(x=>x.data_inicio&&new Date(x.data_inicio).getTime()>=now)||
    candidates.slice().sort((a,b)=>new Date(a.data_inicio||0)-new Date(b.data_inicio||0))[0];
  if(active)applyRemoteCult(active);
  else{state.cult=null;state.sequence=[];state.current=0;save();}
  remoteStatus='connected';
}

async function syncCultStateToRemote(status=state.cult?.operationStatus||'aguardando',currentIndex=state.current,sequence=state.sequence){
  if(!state.cult?.id)throw new Error('Nenhum culto operacional selecionado.');
  const operation=await coreBridge.getOperation(state.cult.id)||await coreBridge.ensureOperation(state.cult.id);
  const current=sequence[currentIndex]||null;
  const normalized=sequence.map((o,i)=>({...o,ordem:i+1,status:o.status||'aguardando'}));
  let result;
  try{
    result=await coreBridge.setOperation(state.cult.id,{
      status,
      oportunidadeAtualId:current?.id||null,
      versaoEsperada:Number(operation.versao||0),
      atualizadoPor:'Mídia Seara',
      iniciadoPor:status==='em_andamento' ? 'Mídia Seara' : null,
      encerradoPor:status==='encerrado' ? 'Mídia Seara' : null
    });
  }catch(error){
    if(error?.code==='PGRST202'||error?.code==='PGRST204'||String(error?.message||'').toLowerCase().includes('conflito')||String(error?.message||'').toLowerCase().includes('version')){
      const fresh=await coreBridge.getOperation(state.cult.id).catch(()=>null);
      if(fresh)applyRemoteCult(await fetchCultById(state.cult.id));
      throw new Error('O estado do culto foi alterado por outro dispositivo. Atualizando...');
    }
    throw error;
  }
  if(Array.isArray(normalized))await coreBridge.updateLiturgia(state.cult.id,normalized);
  const fresh=await coreBridge.getSnapshot(state.cult.id);
  applyRemoteCult(fresh);
  return result;
}

async function startRemoteCult(){
  if(!state.cult)return;
  if(!state.sequence.length){toast('O culto recebido não possui etapas.');return;}
  const ops=state.sequence.map(o=>({...o,status:o.status==='cancelada'?'cancelada':'aguardando'}));
  const idx=ops.findIndex(o=>o.status==='aguardando');
  if(idx<0){toast('Não há uma etapa disponível para iniciar.');return;}
  ops[idx].status='em_andamento';
  try{
    state.sequence=ops;state.current=idx;
    await syncCultStateToRemote('em_andamento',idx,ops);
    render('Modo Culto');toast('Culto iniciado. A Mídia agora controla a sequência.');
  }catch(err){
    console.error('[MÍDIA] Falha ao iniciar culto:',err);
    toast(`Não foi possível iniciar: ${err?.message||'verifique o Supabase'}`);
  }
}

async function advanceRemoteCult(){
  if(!state.cult||state.cult.operationStatus!=='em_andamento')return;
  const ops=state.sequence.map(o=>({...o}));
  if(ops[state.current])ops[state.current].status='concluida';
  let next=state.current+1;
  while(next<ops.length&&ops[next].status==='cancelada')next++;
  try{
    if(next>=ops.length){
      state.sequence=ops;state.current=Math.max(0,ops.length-1);
      await syncCultStateToRemote('encerrado',state.current,ops);
      state.log.push({title:`Culto encerrado: ${state.cult.name}`,status:'ENCERRADO',at:new Date().toISOString()});
      render('Início');toast('Última etapa concluída. Culto encerrado.');return;
    }
    ops[next].status='em_andamento';state.sequence=ops;state.current=next;
    await syncCultStateToRemote('em_andamento',next,ops);render('Modo Culto');
  }catch(error){console.error('[MÍDIA] Falha ao avançar:',error);toast(`Não foi possível avançar: ${error.message||'erro'}`);}
}

async function backRemoteCult(){
  if(!state.cult||state.cult.operationStatus!=='em_andamento')return;
  const ops=state.sequence.map(o=>({...o}));
  if(ops[state.current])ops[state.current].status='aguardando';
  let prev=state.current-1;
  while(prev>=0&&ops[prev].status==='cancelada')prev--;
  if(prev<0){toast('Não há oportunidade anterior.');return;}
  ops[prev].status='em_andamento';state.sequence=ops;state.current=prev;
  try{await syncCultStateToRemote('em_andamento',prev,ops);render('Modo Culto');}
  catch(error){console.error('[MÍDIA] Falha ao voltar:',error);toast(`Não foi possível voltar: ${error.message||'erro'}`);}
}

async function replayMissedEvents(){
  if(!supabaseClient)return;
  const events=await coreBridge.listEvents(null,20).catch(error=>{console.warn('[MÍDIA] Falha ao recuperar eventos pendentes',error);return[];});
  for(const e of events){
    const c=await fetchCultById(e.culto_id);
    if(c&&c.operationStatus!=='encerrado'&&c.status!=='cancelado'){applyRemoteCult(c);break;}
  }
}

function subscribeRemote(){
  if(!supabaseClient)return;
  if(realtimeChannel){realtimeChannel();realtimeChannel=null;}
  realtimeChannel=coreBridge.subscribeOperation(null,async message=>{
    try{
      if(message.kind==='operation'&&message.operation?.culto_id){
        const c=await fetchCultById(message.operation.culto_id);
        if(c){applyRemoteCult(c);if(document.querySelector('.now-card'))render('Modo Culto');}
        return;
      }
      if(message.kind==='event'&&message.event?.culto_id){
        const c=await fetchCultById(message.event.culto_id);
        if(c&&c.status!=='cancelado'){applyRemoteCult(c);if(message.event.origem_app==='seara-central')toast('Programação atualizada pelo SEARA CENTRAL.');if(document.querySelector('.now-card'))render('Modo Culto');}
        return;
      }
      if(message.kind==='media'&&message.media?.culto_id&&state.cult?.id===message.media.culto_id){
        const c=await fetchCultById(message.media.culto_id);if(c){applyRemoteCult(c);if(document.querySelector('.now-card'))render('Modo Culto');}
      }
    }catch(error){console.error('[MÍDIA] Falha ao processar Realtime',error);}
  });
}

async function loadRemoteMessages(){
  if(!supabaseClient)return;
  const r=await supabaseClient.from('seara_mensagens').select('*').or('origem_app.eq.seara-midia,destino_app.eq.seara-midia').order('criado_em',{ascending:true}).limit(300);
  if(!r.error){state.messages=r.data||[];save();}
  else{console.error('[MÍDIA] Falha ao carregar mensagens',r.error);toast(`Comunicação indisponível: ${r.error.message||'erro'}`);}
}

function subscribeRemoteMessages(){
  if(!supabaseClient)return;
  if(remoteMessagesChannel)supabaseClient.removeChannel(remoteMessagesChannel);
  remoteMessagesChannel=supabaseClient.channel('seara-midia-chat-v6').on('postgres_changes',{event:'INSERT',schema:'public',table:'seara_mensagens'},p=>{
    const m=p.new;if(m.origem_app!=='seara-midia'&&m.destino_app!=='seara-midia')return;
    const i=state.messages.findIndex(x=>x.id===m.id);if(i>=0)state.messages[i]=m;else state.messages.push(m);save();
    if(m.destino_app==='seara-midia'){toast('Nova mensagem do SEARA CENTRAL.');markRead(m.id)}
    if(document.querySelector('.chat-main'))chat();
  }).on('postgres_changes',{event:'UPDATE',schema:'public',table:'seara_mensagens'},p=>{
    const i=state.messages.findIndex(x=>x.id===p.new.id);if(i>=0)state.messages[i]=p.new;save();if(document.querySelector('.chat-main'))chat();
  }).subscribe();
}

async function markRead(id){
  const {error}=await supabaseClient.from('seara_mensagens').update({lida:true,lida_em:new Date().toISOString()}).eq('id',id);
  if(error)console.warn('[MÍDIA] Não foi possível marcar mensagem como lida',error);
}

async function uploadFile(file,pathPrefix){
  const ext=(file.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').toLowerCase()||'bin';
  const path=`${pathPrefix}/${crypto.randomUUID()}.${ext}`;
  const r=await supabaseClient.storage.from('seara-media').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
  if(r.error)throw r.error;
  const url=supabaseClient.storage.from('seara-media').getPublicUrl(path).data.publicUrl;
  return {url,nome:file.name,tipo:file.type||'application/octet-stream',tamanho:file.size||0,path};
}

async function sendMessage(text,anexo=null,replyToId=null){
  const r=await supabaseClient.from('seara_mensagens').insert({
    origem_app:'seara-midia',destino_app:'seara-central',remetente_tipo:'equipe',remetente_nome:'Mídia Seara',
    assunto:state.cult?`Culto: ${state.cult.name}`:'Operação Mídia',mensagem:text?.trim()||'',tipo:'operacional',
    culto_id:state.cult?.id||null,reply_to_id:replyToId||null,anexo_url:anexo?.url||null,anexo_nome:anexo?.nome||null,
    anexo_tipo:anexo?.tipo||null,anexo_tamanho:anexo?.tamanho||null
  });
  if(r.error)throw r.error;
}

async function addSharedMedia(file,url,titulo,observacao){
  if(!state.cult?.id)throw Error('Nenhum culto recebido do Central.');
  let mediaUrl=url||'',tipo='outro',meta={};
  if(file){const u=await coreBridge.uploadMedia(state.cult.id,file,{titulo:titulo||file.name,observacao});const c=await fetchCultById(state.cult.id);if(c)applyRemoteCult(c);return u;}
  const saved=await coreBridge.saveMedia(state.cult.id,{titulo,observacao,url:mediaUrl,tipo_midia:tipo,ordem:(state.cult.midias?.length||0)+1});
  const c=await fetchCultById(state.cult.id);if(c)applyRemoteCult(c);return saved;
}

function layout(active){return `<div class="app"><aside class="sidebar" id="sidebar"><div class="brand"><img src="./assets/logo-midia.png" alt="Logo Mídia Seara"><div><strong>MÍDIA SEARA</strong><small>Operação visual do culto</small></div></div><nav class="nav">${modules.map(m=>`<button class="${m===active?'active':''}" data-nav="${esc(m)}">${esc(m)}</button>`).join('')}</nav><div class="sidebar-footer">Aplicativo operacional da Mídia.<br>O Modo Culto inicia e acompanha a sequência real recebida do SEARA CENTRAL.</div></aside><main class="main"><header class="topbar"><div class="top-title"><button class="mobile-toggle" id="toggle">☰</button><div><h1>MÍDIA SEARA</h1><span>Assembleia de Deus • Cabo</span></div></div><div class="top-actions"><span class="badge ${state.cult?'live':'warn'}">${state.cult?(state.cult.operationStatus==='em_andamento'?'CULTO EM ANDAMENTO':'CULTO RECEBIDO'):'SEM CULTO'}</span><span class="badge ${remoteStatus==='connected'?'live':'warn'}">${remoteStatus==='connected'?'CENTRAL CONECTADO':remoteStatus==='error'?'CENTRAL OFFLINE':'CONECTANDO...'}</span><button class="btn small" id="theme">${state.theme==='dark'?'☀ Claro':'☾ Escuro'}</button></div></header><section class="content" id="content"></section></main></div><div id="toast" class="toast"></div>`}
function render(active='Início'){root.innerHTML=layout(active);document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{show(b.dataset.nav);document.getElementById('sidebar').classList.remove('open')});document.getElementById('toggle').onclick=()=>document.getElementById('sidebar').classList.toggle('open');document.getElementById('theme').onclick=()=>{setTheme(state.theme!=='dark');render(active)};setTheme(state.theme==='dark');show(active)}
function show(m){if(m==='Início')home();else if(m==='Modo Culto')cultMode();else if(m==='Programação')program();else if(m==='Biblioteca de Mídia')mediaLibrary();else if(m==='Comunicação')chat();else historyPage()}
function home(){const c=document.getElementById('content');const st=state.cult?.operationStatus || state.cult?.status;const label=st==='em_andamento'?'Abrir Modo Culto':state.cult?'Iniciar culto':'Sincronizar cultos';c.innerHTML=`<div class="hero"><div class="hero-copy"><div class="badge blue">MÍDIA • OPERAÇÃO DO CULTO</div><h2>O centro visual da celebração.</h2><p>O SEARA CENTRAL planeja. A Mídia inicia e conduz o culto. Liturgia, etapa atual e mídias compartilhadas ficam sincronizadas nos dois aplicativos.</p><div class="controls"><button class="btn primary" id="start">${label}</button><button class="btn" id="program">Abrir programação</button><button class="btn" id="refresh">↻ Atualizar</button></div></div><img class="logo-hero" src="./assets/logo-midia.png" alt="Mídia Seara"></div>${state.cult?`<div class="live-card"><div><span class="badge ${st==='em_andamento'?'live':'warn'}">${st==='em_andamento'?'CULTO EM ANDAMENTO':'CULTO PROGRAMADO'}</span><h2>${esc(state.cult.name)}</h2><p>${esc(state.cult.type)} · ${esc(state.cult.date)}</p></div><strong>${state.cult.operacaoAtual?`Agora: ${esc(state.cult.operacaoAtual)}`:'Aguardando início'}</strong></div>`:''}<div class="grid"><div class="card"><h3>Culto atual</h3><div class="metric">${state.cult?esc(state.cult.name):'—'}</div><div class="muted">${state.cult?esc(state.cult.date):'Nenhum culto recebido'}</div></div><div class="card"><h3>Agora</h3><div class="metric">${currentItem()?.position??'—'}</div><div class="muted">${currentItem()?.title||'Nenhuma oportunidade'}</div></div><div class="card"><h3>Sequência</h3><div class="metric">${state.sequence.length}</div><div class="muted">itens recebidos do Central</div></div><div class="card"><h3>Não lidas</h3><div class="metric">${state.messages.filter(m=>m.destino_app==='seara-midia'&&!m.lida).length}</div><div class="muted">mensagens do Central</div></div></div><div class="section"><div class="section-title"><h3>Próximos cultos publicados pelo SEARA CENTRAL</h3></div><div class="sequence-list">${remoteCultos.filter(x=>x.id!==state.cult?.id&&x.status!=='encerrado').slice(0,6).map(x=>`<div class="seq-item"><div><strong>${esc(x.titulo)}</strong><div class="seq-sub">${esc(x.data_inicio?new Date(x.data_inicio).toLocaleString('pt-BR'):'—')} · ${esc(x.status)}</div></div><button class="btn small" data-select="${x.id}">Selecionar</button></div>`).join('')||'<div class="empty">Nenhum outro culto disponível.</div>'}</div></div>`;document.getElementById('start').onclick=()=>{if(st==='em_andamento')render('Modo Culto');else if(state.cult)startRemoteCult();else syncRemoteCultos().then(()=>render('Início'))};document.getElementById('program').onclick=()=>render('Programação');document.getElementById('refresh').onclick=()=>syncRemoteCultos().then(()=>render('Início'));c.querySelectorAll('[data-select]').forEach(b=>b.onclick=async()=>{const row=await fetchCultById(b.dataset.select);if(row){applyRemoteCult(row);render('Início')}})}
function cultMode(){const c=document.getElementById('content');if(!state.cult){c.innerHTML=`<div class="empty"><h2>Nenhum culto recebido.</h2><p>Crie e programe o culto no SEARA CENTRAL.</p><button class="btn primary" id="sync">Atualizar Central</button></div>`;document.getElementById('sync').onclick=()=>syncRemoteCultos().then(()=>render('Modo Culto'));return}const now=currentItem(),next=state.sequence[state.current+1],after=state.sequence.slice(state.current+2,state.current+5);c.innerHTML=`<div class="cult-header"><div><span class="badge ${state.cult.operationStatus==='em_andamento'?'live':'warn'}">${state.cult.operationStatus==='em_andamento'?'EM ANDAMENTO':'PROGRAMADO'}</span><h2>${esc(state.cult.name)}</h2><p>${esc(state.cult.date)} · ${state.cult.operacaoAtual?`Agora: ${esc(state.cult.operacaoAtual)}`:'aguardando início'}</p></div><div class="toolbar-actions">${state.cult.operationStatus!=='em_andamento'?'<button class="btn primary" id="startRemote">Iniciar culto</button>':''}<button class="btn" id="edit">Editar liturgia</button><button class="btn blue" id="add">Inserir oportunidade</button><button class="btn" id="media">Mídia auxiliar</button><button class="btn danger" id="end">Encerrar</button></div></div><div class="sequence"><div class="now-card"><div class="now-label">AGORA</div><div class="now-title">${now?esc(now.title):'Nenhuma oportunidade'}</div><div class="now-meta">${now?`${esc(now.type)} • ${esc(now.group||'Sem grupo')} ${now.note?`• ${esc(now.note)}`:''}`:'A sequência está vazia.'}</div><div class="controls"><button class="btn" id="prev" ${state.cult.operationStatus!=='em_andamento'||state.current<=0?'disabled':''}>← Voltar</button><button class="btn primary" id="next" ${state.cult.operationStatus!=='em_andamento'||state.current>=state.sequence.length-1?'disabled':''}>Avançar →</button><button class="btn" id="done" ${state.cult.operationStatus!=='em_andamento'?'disabled':''}>Concluir atual</button></div></div><div><div class="section-title"><h3>PRÓXIMO</h3></div>${next?seqCard(next,state.current+1):'<div class="empty">Não há próxima oportunidade.</div>'}</div><div><div class="section-title"><h3>DEPOIS</h3></div><div class="sequence-list">${after.length?after.map((x,i)=>seqCard(x,state.current+i+2)).join(''):'<div class="empty">Sem itens seguintes.</div>'}</div></div></div><div class="section"><div class="section-title"><h3>Mídias compartilhadas</h3><span class="muted">${state.cult.midias?.length||0} recurso(s)</span></div><div class="shared-media-grid">${(state.cult.midias||[]).map(m=>`<article class="shared-media-card"><span class="tag">${esc(m.tipo_midia)}</span><strong>${esc(m.titulo)}</strong><small>${esc(m.observacao||'')}</small><a href="${esc(m.url)}" target="_blank" rel="noopener">Abrir ↗</a></article>`).join('')||'<div class="empty">Nenhuma mídia compartilhada.</div>'}</div></div><div class="section"><div class="section-title"><h3>Sequência atual</h3><span class="muted">${state.sequence.length} oportunidades</span></div><div class="card"><div class="sequence-list">${state.sequence.map((x,i)=>seqCard(x,i)).join('')||'<div class="empty">A sequência está vazia.</div>'}</div></div></div>`;document.getElementById('startRemote')?.addEventListener('click',startRemoteCult);document.getElementById('prev').onclick=backRemoteCult;document.getElementById('next').onclick=advanceRemoteCult;document.getElementById('done').onclick=advanceRemoteCult;document.getElementById('add').onclick=opportunityForm;document.getElementById('edit').onclick=()=>program(true);document.getElementById('media').onclick=()=>mediaLibrary();document.getElementById('end').onclick=endCult}
function opportunityForm(){modal(`<h3>Inserir oportunidade</h3><form id="opForm" class="form"><div class="form-grid three"><div class="field"><label>Nome</label><input name="title" required></div><div class="field"><label>Tipo</label><select name="type"><option>Saudação</option><option>Cantar um louvor</option><option>Oração</option><option>Leitura</option><option>Harpa Cristã</option><option>Aviso</option><option>Pregação</option><option>Convite</option><option>Participação especial</option><option>Outro</option></select></div><div class="field"><label>Grupo / origem</label><input name="group"></div></div><div class="field"><label>Orientação</label><textarea name="note"></textarea></div><div><button type="button" class="btn" id="cancel">Cancelar</button><button class="btn primary">Adicionar</button></div></form>`);document.getElementById('cancel').onclick=closeModal;document.getElementById('opForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);state.sequence.splice(state.current+1,0,{id:crypto.randomUUID(),title:f.get('title'),type:f.get('type'),group:f.get('group'),note:f.get('note'),status:'aguardando'});try{await coreBridge.updateLiturgia(state.cult.id,state.sequence.map((o,i)=>({id:o.id,ordem:i+1,titulo:o.title,tipo:o.type,grupo:o.group,descricao:o.note,status:o.status||'aguardando',inseridaDuranteCulto:Boolean(o.inseridaDuranteCulto)})));const fresh=await fetchCultById(state.cult.id);if(fresh)applyRemoteCult(fresh);closeModal();render('Modo Culto');toast('Etapa adicionada e enviada ao Central.')}catch(err){toast(`Falha: ${err.message||'erro'}`)}}}
function program(){const c=document.getElementById('content');c.innerHTML=`<div class="toolbar"><div><h2>Programação / Liturgia</h2><div class="muted">A sequência é compartilhada com o SEARA CENTRAL. Durante o culto, alterações feitas aqui são publicadas no mesmo culto.</div></div><button class="btn primary" id="add">Adicionar oportunidade</button></div>${state.cult?`<div class="card"><strong>${esc(state.cult.name)}</strong><div class="muted">${state.cult.operationStatus==='em_andamento'?'Culto em andamento — alterações são publicadas em tempo real.':'Culto programado.'}</div></div>`:''}<div class="card"><div class="sequence-list">${state.sequence.map((x,i)=>`<div class="seq-item"><div><div class="seq-number">${String(i+1).padStart(2,'0')}</div><div class="seq-title">${esc(x.title)}</div><div class="seq-sub">${esc(x.type)} • ${esc(x.group||'Sem grupo')} ${x.note?'• '+esc(x.note):''}</div></div><div class="toolbar-actions"><button class="btn small" data-up="${i}" ${i===0?'disabled':''}>↑</button><button class="btn small" data-down="${i}" ${i===state.sequence.length-1?'disabled':''}>↓</button><button class="btn small danger" data-del="${i}">Excluir</button></div></div>`).join('')||'<div class="empty">Nenhuma oportunidade.</div>'}</div></div>`;document.getElementById('add').onclick=opportunityForm;c.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>move(+b.dataset.up,-1));c.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>move(+b.dataset.down,1));c.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{state.sequence.splice(+b.dataset.del,1);state.current=Math.min(state.current,Math.max(0,state.sequence.length-1));await syncCultStateToRemote(state.cult?.operationStatus || state.cult?.status,state.current,state.sequence);program()})}
async function move(i,d){const j=i+d;if(j<0||j>=state.sequence.length)return;[state.sequence[i],state.sequence[j]]=[state.sequence[j],state.sequence[i]];if(state.cult)await coreBridge.updateLiturgia(state.cult.id,state.sequence.map((o,i)=>({id:o.id,ordem:i+1,titulo:o.title,tipo:o.type,grupo:o.group,descricao:o.note,status:o.status||'aguardando'})));save();program()}
function mediaLibrary(){const c=document.getElementById('content');c.innerHTML=`<div class="toolbar"><div><h2>Biblioteca de Mídia</h2><div class="muted">Tudo aqui fica vinculado ao culto compartilhado e aparece no SEARA CENTRAL.</div></div><div class="toolbar-actions"><button class="btn primary" id="upload">Adicionar arquivo</button><button class="btn" id="url">Adicionar por URL</button></div></div><div class="card"><input id="file" type="file" hidden accept="image/*,video/*,audio/*,.pdf,.ppt,.pptx,.doc,.docx"><div class="empty">${state.cult?`Culto: <strong>${esc(state.cult.name)}</strong>`:'Receba um culto do SEARA CENTRAL primeiro.'}</div></div><div class="section"><div class="section-title"><h3>Recursos compartilhados</h3></div><div class="shared-media-grid">${(state.cult?.midias||[]).map(m=>`<article class="shared-media-card"><span class="tag">${esc(m.tipo_midia)}</span><h3>${esc(m.titulo)}</h3><small>${esc(m.observacao||'')}</small><a href="${esc(m.url)}" target="_blank" rel="noopener">Abrir ↗</a><button class="btn small danger" data-del="${esc(m.id)}">Desativar</button></article>`).join('')||'<div class="empty">Nenhuma mídia compartilhada.</div>'}</div></div>`;document.getElementById('upload').onclick=()=>{if(!state.cult)return toast('Nenhum culto recebido.');document.getElementById('file').click()};document.getElementById('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await addSharedMedia(f,null,f.name,'');toast('Arquivo compartilhado com o Central.');render('Biblioteca de Mídia')}catch(err){toast(`Falha: ${err.message||'erro'}`)}};document.getElementById('url').onclick=()=>{if(!state.cult)return toast('Nenhum culto recebido.');modal(`<h3>Adicionar mídia por URL</h3><form id="urlForm" class="form"><div class="field"><label>Título</label><input name="title" required></div><div class="field"><label>URL</label><input name="url" type="url" required></div><div class="field"><label>Observação</label><textarea name="note"></textarea></div><button class="btn primary">Adicionar</button></form>`);document.getElementById('urlForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await addSharedMedia(null,f.get('url'),f.get('title'),f.get('note'));closeModal();render('Biblioteca de Mídia');toast('Mídia compartilhada.')}catch(err){toast(`Falha: ${err.message||'erro'}`)}}};c.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Desativar esta mídia?'))return;await coreBridge.removeMedia(b.dataset.del,state.cult.id);const row=await fetchCultById(state.cult.id);if(row)applyRemoteCult(row);render('Biblioteca de Mídia')})}
function mediaOverlay(){mediaLibrary()}
function chatBubble(m){const mine=m.origem_app==='seara-midia';const reply=m.reply_to_id?state.messages.find(x=>x.id===m.reply_to_id):null;return `<div class="wa-row ${mine?'mine':''}"><div class="wa-bubble">${reply?`<div class="wa-reply"><strong>${esc(reply.remetente_nome||reply.origem_app)}</strong><span>${esc(reply.mensagem||reply.anexo_nome||'Anexo')}</span></div>`:''}${m.mensagem?`<div class="wa-text">${esc(m.mensagem)}</div>`:''}${m.anexo_url?`<a class="wa-attachment" href="${esc(m.anexo_url)}" target="_blank" rel="noopener">📎 <strong>${esc(m.anexo_nome||'Arquivo')}</strong></a>`:''}<div class="wa-meta"><span>${new Date(m.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>${mine?`<span class="wa-check ${m.lida?'read':''}">${m.lida?'✓✓':'✓'}</span>`:''}</div><div class="wa-menu"><button data-reply="${esc(m.id)}">Responder</button>${mine?`<button data-delete="${esc(m.id)}">Apagar</button>`:''}</div></div></div>`}
function chat(){const c=document.getElementById('content');c.innerHTML=`<div class="toolbar"><div><h2>WhatsApp Operacional</h2><div class="muted">Pastor / SEARA CENTRAL ↔ Mídia Seara. Texto, anexos, respostas, emojis, leitura e histórico.</div></div><span class="badge ${remoteStatus==='connected'?'live':'warn'}">${remoteStatus==='connected'?'CONECTADO':'OFFLINE'}</span></div><div class="wa-shell single"><section class="wa-main"><header class="wa-head"><span class="wa-avatar">S</span><div><strong>Pastor / SEARA CENTRAL</strong><small>${state.cult?`Culto: ${esc(state.cult.name)}`:'Sem culto ativo'}</small></div><span class="wa-live">● online</span></header><div class="wa-messages" id="waMessages">${state.messages.length?state.messages.map(chatBubble).join(''):'<div class="wa-empty"><strong>Nenhuma mensagem.</strong><span>Envie uma mensagem ao Pastor.</span></div>'}</div>${chatReplyTo?`<div class="wa-reply-compose"><div><strong>Respondendo</strong><span>${esc(chatReplyTo.mensagem||chatReplyTo.anexo_nome||'Anexo')}</span></div><button id="cancelReply">×</button></div>`:''}<form class="wa-compose" id="chatForm"><button type="button" class="wa-icon" id="emoji">☺</button><label class="wa-icon">📎<input id="chatFile" type="file" hidden accept="image/*,video/*,audio/*,.pdf,.ppt,.pptx,.doc,.docx"></label><input id="chatText" autocomplete="off" placeholder="Digite uma mensagem"><button class="wa-send">➤</button></form><div class="wa-emoji" id="emojiBox" hidden>${['😀','😂','😍','🙏','👏','🔥','👍','❤️','🎵','🎤','📺','📷','⚠️','✅','❌','👀'].map(x=>`<button type="button">${x}</button>`).join('')}</div></section></div>`;const list=document.getElementById('waMessages');if(list)list.scrollTop=list.scrollHeight;document.getElementById('chatForm').onsubmit=async e=>{e.preventDefault();const text=document.getElementById('chatText').value.trim(),file=document.getElementById('chatFile').files[0];if(!text&&!file)return;try{const a=file?await uploadFile(file,'chat/midia'):null;await sendMessage(text,a,chatReplyTo?.id);chatReplyTo=null;await loadRemoteMessages();chat()}catch(err){toast(`Falha: ${err.message||'erro'}`)}};document.getElementById('cancelReply')?.addEventListener('click',()=>{chatReplyTo=null;chat()});document.getElementById('emoji').onclick=()=>{const x=document.getElementById('emojiBox');x.hidden=!x.hidden};document.querySelectorAll('#emojiBox button').forEach(b=>b.onclick=()=>{const i=document.getElementById('chatText');i.value+=b.textContent;i.focus()});document.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>{chatReplyTo=state.messages.find(m=>m.id===b.dataset.reply)||null;chat();document.getElementById('chatText')?.focus()});document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Apagar esta mensagem?'))return;await supabaseClient.from('seara_mensagens').update({apagada_em:new Date().toISOString(),mensagem:'Mensagem apagada'}).eq('id',b.dataset.delete).eq('origem_app','seara-midia');await loadRemoteMessages();chat()});state.messages.filter(m=>m.destino_app==='seara-midia'&&!m.lida).forEach(m=>markRead(m.id))}
function historyPage(){const c=document.getElementById('content');c.innerHTML=`<div class="toolbar"><div><h2>Histórico operacional</h2><div class="muted">Ações executadas pela Mídia.</div></div></div>${state.log.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Horário</th><th>Oportunidade</th><th>Status</th></tr></thead><tbody>${state.log.slice().reverse().map(x=>`<tr><td>${new Date(x.at).toLocaleString('pt-BR')}</td><td>${esc(x.title)}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma ação registrada.</div>'}`}
async function endCult(){if(!state.cult||!confirm('Encerrar o culto?'))return;const ops=state.sequence.map(o=>({...o,status:o.status==='em_andamento'?'concluida':o.status}));await syncCultStateToRemote('encerrado',state.current,ops);state.log.push({title:`Culto encerrado: ${state.cult.name}`,status:'ENCERRADO',at:new Date().toISOString()});state.cult=null;state.sequence=[];state.current=0;save();render('Início');toast('Culto encerrado e enviado ao Central.')}
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Enter'&&!e.shiftKey&&document.activeElement?.id==='chatText'){e.preventDefault();document.getElementById('chatForm')?.requestSubmit()}if(state.cult&&document.querySelector('.now-card')){if(e.key==='ArrowRight')advanceRemoteCult();if(e.key==='ArrowLeft')backRemoteCult()}});
setTheme(state.theme==='dark');render('Início');
(async()=>{if(!mediaSupabaseInit())return;await coreBridge.healthCheck();await syncRemoteCultos();await replayMissedEvents();await loadRemoteMessages();subscribeRemote();subscribeRemoteMessages();render('Início')})().catch(e=>{console.error(e);remoteStatus='error';render('Início')});
