const SEARA_CORE_APP = "seara-midia";

class SearaCoreBridge {

  constructor(client) {
    this.client = client;
    this.channel = null;
  }

  async ensureOperation(cultoId) {
    const { data, error } = await this.client
      .rpc("seara_ensure_culto_operacao", {
        p_culto_id: cultoId
      });

    if (error) throw error;

    return data;
  }

  async getOperation(cultoId) {
    const { data, error } = await this.client
      .from("seara_culto_operacao")
      .select("*")
      .eq("culto_id", cultoId)
      .maybeSingle();

    if (error) throw error;

    return data;
  }

  async setOperation({
    cultoId,
    status,
    oportunidadeAtualId = null,
    versaoEsperada = null
  }) {

    const { data, error } = await this.client
      .rpc("seara_set_culto_operacao", {
        p_culto_id: cultoId,
        p_status: status,
        p_oportunidade_atual_id: oportunidadeAtualId,
        p_atualizado_por: SEARA_CORE_APP,
        p_versao_esperada: versaoEsperada
      });

    if (error) throw error;

    return data;
  }

  async publishEvent(cultoId, tipoEvento, dados = {}) {

    const { data, error } = await this.client
      .from("seara_culto_eventos")
      .insert({
        culto_id: cultoId,
        origem_app: SEARA_CORE_APP,
        destino_app: "seara-central",
        tipo_evento: tipoEvento,
        dados
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  subscribeOperation(cultoId, callback) {

    if (this.channel) {
      this.client.removeChannel(this.channel);
    }

    this.channel = this.client
      .channel(`seara-operacao-${cultoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seara_culto_operacao",
          filter: `culto_id=eq.${cultoId}`
        },
        payload => {
          callback?.(payload);
        }
      )
      .subscribe();

    return () => {
      if (this.channel) {
        this.client.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }
}

window.SearaCoreBridge = SearaCoreBridge;
