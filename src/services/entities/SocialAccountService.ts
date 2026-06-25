import { BaseEntityService } from './baseEntityService'
import { SocialAccount } from '../../types/account'
import { encrypt, decrypt } from '../../utils/crypto'
import { logError } from '../loggerService'

export class SocialAccountService extends BaseEntityService<SocialAccount> {
  constructor() {
    super('social_accounts', 'SocialAccountService', ['platform', 'account', 'user_name', 'email', 'phone'])
  }

  protected async afterRead(item: SocialAccount): Promise<SocialAccount> {
    let decryptedPassword = item.password
    if (item.password) {
      try {
        decryptedPassword = await decrypt(item.password)
      } catch (e) {
        logError('解密失败', 'SocialAccountService', e as Error)
      }
    }
    return {
      ...item,
      password: decryptedPassword,
      register_time: item.register_time ? item.register_time.toString() : ''
    }
  }

  protected async beforeCreate(data: Omit<SocialAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Omit<SocialAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
    const encryptedPassword = data.password ? await encrypt(data.password) : ''
    return { ...data, password: encryptedPassword }
  }

  protected async beforeUpdate(data: Partial<SocialAccount>): Promise<Partial<SocialAccount>> {
    if (data.password !== undefined) {
      const encryptedPassword = data.password ? await encrypt(data.password) : ''
      return { ...data, password: encryptedPassword }
    }
    return data
  }
}

export const socialAccountService = new SocialAccountService()