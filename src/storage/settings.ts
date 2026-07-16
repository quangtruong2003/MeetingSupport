import { z } from 'zod';
import type { StoredSettings } from '../shared/types';
export const defaultSettings:StoredSettings={language:'vi-VN',sttProvider:'web-speech',sttEndpoint:'',sttApiKey:'',openRouterApiKey:'',openRouterModel:'openai/gpt-4o-mini',userProfile:'',systemPrompt:'You are a concise meeting assistant. Answer using only provided context. State uncertainty clearly.'};
const schema=z.object({language:z.string().min(2),sttProvider:z.enum(['web-speech','streaming-websocket']),sttEndpoint:z.string(),sttApiKey:z.string(),openRouterApiKey:z.string(),openRouterModel:z.string().min(1),userProfile:z.string(),systemPrompt:z.string().min(1)});
export async function loadSettings():Promise<StoredSettings>{const raw=await chrome.storage.local.get('settings');const result=schema.safeParse({...defaultSettings,...(raw.settings as Partial<StoredSettings>|undefined)});return result.success?result.data:defaultSettings;}
export async function saveSettings(settings:StoredSettings):Promise<void>{const result=schema.parse(settings);await chrome.storage.local.set({settings:result});}
export function validateOpenRouterKey(key:string):boolean{return /^sk-or-v1-[A-Za-z0-9_-]{20,}$/.test(key.trim());}
