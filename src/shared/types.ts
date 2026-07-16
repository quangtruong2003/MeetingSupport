export type SessionStatus = 'idle'|'connecting'|'listening'|'paused'|'disconnected'|'stopping'|'error';
export interface TranscriptSegment { id:string; text:string; timestamp:number; final:boolean; }
export interface STTConfig { language:string; provider:string; endpoint?:string; apiKey?:string; }
export type TranscriptCallback=(segment:TranscriptSegment)=>void;
export type ErrorCallback=(error:Error)=>void;
export interface SpeechToTextProvider { connect(config:STTConfig):Promise<void>; sendAudio(chunk:ArrayBuffer):void; disconnect():Promise<void>; onPartialTranscript(callback:TranscriptCallback):void; onFinalTranscript(callback:TranscriptCallback):void; onError(callback:ErrorCallback):void; }
export interface StoredSettings { language:string; sttProvider:'web-speech'|'streaming-websocket'; sttEndpoint:string; sttApiKey:string; openRouterApiKey:string; openRouterModel:string; userProfile:string; systemPrompt:string; }
