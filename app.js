
const STORE_KEY = "seara_midia";
const CONFIG = {"title": "Mídia Seara", "subtitle": "Operação visual do culto", "accent": "#2563eb", "modules": ["Início", "Cultos", "Sequência", "Mídia", "Avisos", "Comunicação"], "description": "Acompanhamento operacional da sequência e dos recursos visuais dos cultos.", "items": ["Culto", "Etapa atual", "Próximo", "Recurso visual", "Observação"]};
const state = JSON.parse(localStorage.getItem(STORE_KEY) || '{"records":[]}');
const root = document.getElementById("app");
const toast = document.getElementById("toast");

function save(){localStorage.setItem(STORE_KEY, JSON.stringify(state));}
function notify(msg){toast.textContent=msg;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1800);}
function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
function nav(active){
  return `<aside class="sidebar" id="sidebar">
    <div class="brand"><div class="brand-mark">S</div><div><strong>${CONFIG.title}</strong><small>${CONFIG.subtitle}</small></div></div>
    <div class="nav">${CONFIG.modules.map((m,i)=>`<button class="${i===0?'active':''}" data-module="${escapeHtml(m)}">${escapeHtml(m)}</button>`).join("")}</div>
    <div class="sidebar-footer">Aplicativo independente integrado ao ecossistema AD Seara.<br>Integrações serão ativadas por etapas.</div>
  </aside>`;
}
function render(){
  root.innerHTML=`<div class="app">${nav()}<main class="main">
    <header class="topbar"><button class="mobile-toggle" id="toggle">☰</button><div><h1>${CONFIG.title}</h1><span>${CONFIG.subtitle}</span></div><button class="btn" id="theme">☾</button></header>
    <section class="content" id="content"></section>
  </main></div><div class="toast" id="toast"></div>`;
  document.querySelectorAll("[data-module]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-module]").forEach(x=>x.classList.remove("active"));b.classList.add("active");showModule(b.dataset.module);document.getElementById("sidebar").classList.remove("open")});
  document.getElementById("toggle").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("theme").onclick=toggleTheme;
  showModule(CONFIG.modules[0]);
}
function showModule(module){
  const c=document.getElementById("content");
  if(module===CONFIG.modules[0]) return dashboard(c);
  if(module.includes("Comunicação")) return communication(c);
  c.innerHTML=`<div class="toolbar"><div><h2 style="margin:0">${escapeHtml(module)}</h2><div class="muted">Módulo inicial preparado para evolução.</div></div><button class="btn primary" id="add">Adicionar</button></div><div id="list"></div>`;
  document.getElementById("add").onclick=()=>openForm(module);
  listRecords(module);
}
function dashboard(c){
  c.innerHTML=`<div class="hero"><h2>${CONFIG.title}</h2><p>${CONFIG.description}</p></div>
  <div class="grid">
    <div class="card"><h3>Registros</h3><strong style="font-size:28px">${state.records.length}</strong><div class="muted">dados locais desta etapa</div></div>
    <div class="card"><h3>Integração</h3><span class="badge">Preparada</span><p class="muted">A comunicação com o Seara Central e outros aplicativos será ligada depois da validação dos módulos.</p></div>
    <div class="card"><h3>Observações</h3><p class="muted">Cada envio poderá carregar uma mensagem contextual para quem receber a informação.</p></div>
  </div>`;
}
function listRecords(module){
  const list=document.getElementById("list"); const rows=state.records.filter(r=>r.module===module);
  if(!rows.length){list.innerHTML=`<div class="empty">Nenhum registro cadastrado neste módulo.</div>`;return;}
  list.innerHTML=`<table class="table"><thead><tr><th>Registro</th><th>Descrição</th><th>Observação</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.description)}</td><td>${escapeHtml(r.note||"—")}</td><td><button class="btn danger" data-del="${r.id}">Excluir</button></td></tr>`).join("")}</tbody></table>`;
  list.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{state.records=state.records.filter(r=>r.id!==b.dataset.del);save();notify("Registro excluído.");listRecords(module)});
}
function openForm(module){
  const c=document.getElementById("content");
  c.innerHTML=`<div class="toolbar"><div><h2 style="margin:0">Novo registro</h2><div class="muted">${escapeHtml(module)}</div></div></div>
  <div class="card"><form class="form" id="form">
  <div class="field"><label>Nome / identificação</label><input name="name" required placeholder="Ex.: Participação no culto"></div>
  <div class="field"><label>Descrição</label><textarea name="description" placeholder="Detalhes da atividade, programação ou música"></textarea></div>
  <div class="field"><label>Observação</label><textarea name="note" placeholder="Mensagem ou orientação adicional"></textarea></div>
  <div><button class="btn" type="button" id="cancel">Cancelar</button> <button class="btn primary">Salvar</button></div>
  </form></div>`;
  document.getElementById("cancel").onclick=()=>showModule(module);
  document.getElementById("form").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);state.records.push({id:crypto.randomUUID(),module,name:f.get("name"),description:f.get("description"),note:f.get("note"),createdAt:new Date().toISOString()});save();notify("Salvo localmente.");showModule(module)};
}
function communication(c){
  c.innerHTML=`<div class="toolbar"><div><h2 style="margin:0">Comunicação</h2><div class="muted">Chat contextual preparado para a futura integração entre aplicativos.</div></div><button class="btn primary" id="msg">Nova mensagem</button></div>
  <div class="card"><div class="empty">Nenhuma conversa ainda.<br><br>Quando as integrações forem ativadas, as mensagens poderão ser associadas a culto, oportunidade, música ou programação.</div></div>`;
  document.getElementById("msg").onclick=()=>notify("Chat será conectado na fase de integração.");
}
function toggleTheme(){
  const dark=document.documentElement.dataset.theme==="dark";
  document.documentElement.dataset.theme=dark?"":"dark";
  document.getElementById("theme").textContent=dark?"☾":"☀";
  if(!dark){document.body.style.background="#101010";document.body.style.color="#eee";document.querySelectorAll(".card,.hero,.table,.empty,.field input,.field select,.field textarea").forEach(x=>{x.style.background="#191919";x.style.color="#eee";x.style.borderColor="#333"});}
  else location.reload();
}
render();
