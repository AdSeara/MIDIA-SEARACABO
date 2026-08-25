(function(){
  'use strict';

  const APP_ID='seara-midia';
  const CENTRAL_APP_ID='seara-central';

  class SearaCoreBridge {
    constructor(client){
      if(!client) throw new Error('Cliente Supabase não informado.');
      this.client=client;
      this.channel=null;
    }

    async healthCheck(){
      const {error}=await this.client.from('seara_cultos').select('id',{count:'exact',head:true});
      if(error) throw error;
      return true;
    }

    async ensureOperation(cultoId){
      if(!cultoId) throw new Error('Culto obrigatório.');
      const rpc=await this.client.rpc('seara_ensure_culto_operacao',{p_culto_id:cultoId});
      if(!rpc.error) return this.getOperation(cultoId);
      const msg=String(rpc.error.message||'').toLowerCase();
      const unavailable=['pgrst202','42883','could not find the function','function public.seara_ensure_culto_operacao'].some(x=>rpc.error.code===x || msg.includes(x));
      if(!unavailable) throw rpc.error;

      const existing=await this.getOperation(cultoId);
      if(existing)return existing;
      const insert=await this.client.from('seara_culto_operacao').insert({culto_id:cultoId,status:'aguardando',versao:1}).select().single();
      if(insert.error)throw insert.error;
      return insert.data;
    }

    async getOperation(cultoId){
      const {data,error}=await this.client.from('seara_culto_operacao').select('*').eq('culto_id',cultoId).maybeSingle();
      if(error) throw error;
      return data||null;
    }

    async setOperation(cultoId,{status,oportunidadeAtualId=null,versaoEsperada,atualizadoPor='Mídia Seara',iniciadoPor=null,encerradoPor=null}={}){
      if(!cultoId) throw new Error('Culto obrigatório.');
      if(!Number.isInteger(Number(versaoEsperada))) throw new Error('Versão esperada da operação não informada.');

      const rpc=await this.client.rpc('seara_set_culto_operacao',{
        p_culto_id:cultoId,
        p_status:status,
        p_oportunidade_atual_id:oportunidadeAtualId,
        p_versao_esperada:Number(versaoEsperada),
        p_atualizado_por:atualizadoPor,
        p_iniciado_por:iniciadoPor,
        p_encerrado_por:encerradoPor
      });

      if(!rpc.error) return rpc.data||this.getOperation(cultoId);

      // Compatibilidade defensiva: se o RPC implantado possuir assinatura diferente
      // ou ainda não estiver exposto pelo PostgREST, preservamos o mesmo controle
      // otimista sem criar outra fonte de verdade. Conflitos de negócio nunca usam fallback.
      const rpcMessage=String(rpc.error.message||'').toLowerCase();
      const rpcIsUnavailable=['pgrst202','42883','could not find the function','function public.seara_set_culto_operacao'].some(x=>rpc.error.code===x || rpcMessage.includes(x));
      if(!rpcIsUnavailable) throw rpc.error;

      const now=new Date().toISOString();
      const patch={
        status,
        oportunidade_atual_id:oportunidadeAtualId,
        atualizado_em:now,
        atualizado_por:atualizadoPor,
        versao:Number(versaoEsperada)+1
      };
      if(status==='em_andamento' && iniciadoPor){patch.iniciado_em=now;patch.iniciado_por=iniciadoPor;patch.encerrado_em=null;patch.encerrado_por=null;}
      if(status==='encerrado' && encerradoPor){patch.encerrado_em=now;patch.encerrado_por=encerradoPor;}
      const direct=await this.client.from('seara_culto_operacao').update(patch).eq('culto_id',cultoId).eq('versao',Number(versaoEsperada)).select().single();
      if(direct.error){
        const msg=String(direct.error.message||'').toLowerCase();
        if(direct.error.code==='PGRST116' || msg.includes('0 rows')) throw Object.assign(new Error('O estado do culto foi alterado por outro dispositivo. Atualizando...'),{code:'SEARA_OPERATION_CONFLICT'});
        throw direct.error;
      }
      return direct.data;
    }

    async publishEvent(cultoId,tipoEvento,dados={}){
      const {data,error}=await this.client.from('seara_culto_eventos').insert({
        culto_id:cultoId,
        origem_app:APP_ID,
        destino_app:CENTRAL_APP_ID,
        tipo_evento:tipoEvento,
        dados
      }).select().single();
      if(error) throw error;
      return data;
    }

    async getCulto(cultoId){
      const {data,error}=await this.client.from('seara_cultos').select('*').eq('id',cultoId).single();
      if(error) throw error;
      return data;
    }

    async getSnapshot(cultoId){
      if(!cultoId) return null;
      const [culto,operation,media]=await Promise.all([
        this.getCulto(cultoId),
        this.getOperation(cultoId),
        this.listMedia(cultoId)
      ]);
      let tipo=null;
      if(culto?.tipo_slug){
        const t=await this.client.from('seara_culto_tipos').select('slug,nome,logo_path,cor_principal').eq('slug',culto.tipo_slug).maybeSingle();
        if(t.error) throw t.error;
        tipo=t.data||null;
      }
      return {...culto,tipo,operacao:operation,midias:media};
    }

    async listMedia(cultoId){
      const {data,error}=await this.client.from('seara_culto_midias').select('*').eq('culto_id',cultoId).eq('ativo',true).order('ordem',{ascending:true});
      if(error) throw error;
      return data||[];
    }

    async uploadMedia(cultoId,file,{titulo='',observacao=''}={}){
      if(!cultoId||!file) throw new Error('Culto e arquivo são obrigatórios.');
      const ext=(file.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').toLowerCase()||'bin';
      const path=`cultos/${cultoId}/${crypto.randomUUID()}.${ext}`;
      const upload=await this.client.storage.from('seara-media').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
      if(upload.error) throw upload.error;
      const url=this.client.storage.from('seara-media').getPublicUrl(path).data.publicUrl;
      return this.saveMedia(cultoId,{titulo:titulo||file.name,tipo_midia:this.mediaType(file.type),url,observacao,metadados:{nome_original:file.name,tamanho:file.size,tipo:file.type,path}});
    }

    async saveMedia(cultoId,media){
      const {data,error}=await this.client.from('seara_culto_midias').upsert({
        id:media.id||crypto.randomUUID(),culto_id:cultoId,titulo:media.titulo||'Mídia',tipo_midia:media.tipo_midia||'outro',
        url:media.url||'',ordem:Number(media.ordem||1),ativo:media.ativo!==false,origem_app:APP_ID,
        observacao:media.observacao||'',metadados:media.metadados||{}
      },{onConflict:'id'}).select().single();
      if(error) throw error;
      await this.publishEvent(cultoId,'midia_adicionada',{media_id:data.id});
      return data;
    }

    async removeMedia(mediaId,cultoId){
      const {error}=await this.client.from('seara_culto_midias').update({ativo:false}).eq('id',mediaId);
      if(error) throw error;
      if(cultoId) await this.publishEvent(cultoId,'midia_removida',{media_id:mediaId});
    }

    async updateLiturgia(cultoId,liturgia){
      const {data,error}=await this.client.from('seara_cultos').update({
        liturgia:Array.isArray(liturgia)?liturgia:[],
        origem_app:APP_ID,
        atualizado_em:new Date().toISOString()
      }).eq('id',cultoId).select().single();
      if(error) throw error;
      await this.publishEvent(cultoId,'liturgia_alterada',{origem_app:APP_ID});
      return data;
    }

    mediaType(mime=''){
      if(mime.startsWith('image/')) return 'imagem';
      if(mime.startsWith('video/')) return 'video';
      if(mime.startsWith('audio/')) return 'audio';
      if(mime.includes('pdf')||mime.includes('presentation')) return 'slide';
      return 'outro';
    }

    async listEvents(cultoId,limit=20){
      let q=this.client.from('seara_culto_eventos').select('*').eq('destino_app',APP_ID).eq('origem_app',CENTRAL_APP_ID).order('criado_em',{ascending:false}).limit(limit);
      if(cultoId)q=q.eq('culto_id',cultoId);
      const {data,error}=await q;
      if(error)throw error;
      return data||[];
    }

    subscribeOperation(cultoId,callback){
      if(this.channel) this.client.removeChannel(this.channel);
      let channel=this.client.channel(`seara-core-midia-${cultoId||'todos'}`);
      const filter=cultoId?`culto_id=eq.${cultoId}`:undefined;
      channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'seara_culto_operacao',...(filter?{filter}:{})},payload=>callback?.({kind:'operation',operation:payload.new,old:payload.old}));
      channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'seara_culto_eventos',...(filter?{filter}:{})},payload=>callback?.({kind:'event',event:payload.new,old:payload.old}));
      channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'seara_culto_midias',...(filter?{filter}:{})},payload=>callback?.({kind:'media',media:payload.new,old:payload.old}));
      this.channel=channel.subscribe();
      return ()=>this.dispose();
    }

    dispose(){
      if(this.channel){this.client.removeChannel(this.channel);this.channel=null;}
    }
  }

  window.SearaCoreBridge=SearaCoreBridge;
})();
