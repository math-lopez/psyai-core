export interface WhatsappInstance {
  id: string;
  psychologist_id: string;
  instance_name: string;
  connected: boolean;
  phone: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvolutionQRResponse {
  pairingCode: string | null;
  code: string;
  base64: string;
}

export interface EvolutionStatusResponse {
  instance: {
    instanceName: string;
    state: 'open' | 'connecting' | 'close';
  };
}
