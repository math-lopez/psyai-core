import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export function getRoomService(): RoomServiceClient {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error('Variáveis LiveKit não configuradas');
  }

  return new RoomServiceClient(url, apiKey, apiSecret);
}

export async function generateToken(roomName: string, identity: string): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY ou LIVEKIT_API_SECRET não configurados');
  }

  const at = new AccessToken(apiKey, apiSecret, { identity });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return await at.toJwt();
}
