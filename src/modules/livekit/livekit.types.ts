export interface StartSessionInput {
  sessionId: string;
}

export interface TokenQueryParams {
  role: 'psychologist' | 'patient';
}
