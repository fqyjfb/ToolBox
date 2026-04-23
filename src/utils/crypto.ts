const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'jfb519695178';
const IV_LENGTH = 16;

export const checkPasswordStrength = (password: string): { strength: 'weak' | 'medium' | 'strong', message: string } => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score < 3) {
    return { strength: 'weak', message: '密码强度弱，请使用更长、更复杂的密码' };
  } else if (score < 5) {
    return { strength: 'medium', message: '密码强度中等' };
  } else {
    return { strength: 'strong', message: '密码强度强' };
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
  const keyMaterial = stringToUint8Array(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyMaterial as BufferSource,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encrypt = async (text: string): Promise<string> => {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await getKey();
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      stringToUint8Array(text) as BufferSource
    );
    
    const encryptedArray = new Uint8Array(encrypted);
    return uint8ArrayToBase64(iv) + ':' + uint8ArrayToBase64(encryptedArray);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('加密失败');
  }
};

export const decrypt = async (text: string): Promise<string> => {
  try {
    const textParts = text.split(':');
    const iv = base64ToUint8Array(textParts.shift() || '');
    const encryptedText = base64ToUint8Array(textParts.join(':'));
    const key = await getKey();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      encryptedText as BufferSource
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('解密失败');
  }
};