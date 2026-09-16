import { logEncryptionOperation } from '../services/loggerService';
import { CRYPTO_CONSTANTS } from '../constants/timers';

// 环境变量值作为默认（web/手机端使用），桌面端可通过 setEncryptionKey 覆盖
let encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY || '';

// 桌面端用户自定义配置后调用此函数覆盖密钥
export const setEncryptionKey = (key: string) => {
  encryptionKey = key;
};

const getEncryptionKey = (): string => {
  if (!encryptionKey) {
    throw new Error('加密密钥未配置，桌面端请在设置中配置');
  }
  if (encryptionKey.length < CRYPTO_CONSTANTS.MIN_KEY_LENGTH) {
    throw new Error(`加密密钥长度不足，至少需要${CRYPTO_CONSTANTS.MIN_KEY_LENGTH}个字符`);
  }
  return encryptionKey;
};

export const validateEncryptionKey = (): boolean => {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
};

const stringToUint8Array = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

const uint8ArrayToBase64 = (arr: Uint8Array): string => {
  return btoa(String.fromCharCode(...arr));
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    array[i] = binaryString.charCodeAt(i);
  }
  return array;
};

const getKey = async (): Promise<CryptoKey> => {
  const key = getEncryptionKey();
  const keyMaterial = stringToUint8Array(key.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyMaterial as BufferSource,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encrypt = async (text: string): Promise<string> => {
  const startTime = Date.now();
  try {
    const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.IV_LENGTH));
    const key = await getKey();
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      stringToUint8Array(text) as BufferSource
    );
    
    const encryptedArray = new Uint8Array(encrypted);
    logEncryptionOperation('encrypt', Date.now() - startTime, true);
    return uint8ArrayToBase64(iv) + ':' + uint8ArrayToBase64(encryptedArray);
  } catch (error) {
    logEncryptionOperation('encrypt', Date.now() - startTime, false);
    console.error('Encryption error:', error);
    throw new Error('加密失败');
  }
};

export const decrypt = async (text: string): Promise<string> => {
  const startTime = Date.now();
  try {
    if (!text || !text.includes(':')) {
      if (text) {
        console.warn('[Crypto] decrypt 收到非加密格式数据，按原文返回（兼容历史数据或已篡改数据）');
      }
      logEncryptionOperation('decrypt', Date.now() - startTime, true);
      return text;
    }
    const textParts = text.split(':');
    const iv = base64ToUint8Array(textParts.shift() || '');
    const encryptedText = base64ToUint8Array(textParts.join(':'));
    const key = await getKey();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      encryptedText as BufferSource
    );
    
    logEncryptionOperation('decrypt', Date.now() - startTime, true);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    logEncryptionOperation('decrypt', Date.now() - startTime, false);
    console.error('Decryption error:', error);
    throw new Error('解密失败');
  }
};