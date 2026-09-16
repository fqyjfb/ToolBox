import { BaseEntityService } from './baseEntityService'
import { GeneralAccount } from '../../types/account'
import { encrypt, decrypt } from '../../utils/crypto'
import { logError } from '../loggerService'

export class GeneralAccountService extends BaseEntityService<GeneralAccount> {
  constructor() {
    super('general_accounts', 'GeneralAccountService', ['platform_name', 'website', 'account', 'email', 'phone'])
  }

  protected async afterRead(item: GeneralAccount): Promise<GeneralAccount> {
    let decryptedPassword = item.password
    if (item.password) {
      try {
        decryptedPassword = await decrypt(item.password)
      } catch (e) {
        logError('解密失败', 'GeneralAccountService', e as Error)
      }
    }
    return {
      ...item,
      password: decryptedPassword,
      registration_date: item.registration_date ? item.registration_date.toString() : ''
    }
  }

  protected async beforeCreate(data: Omit<GeneralAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Omit<GeneralAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
    const encryptedPassword = data.password ? await encrypt(data.password) : ''
    return { ...data, password: encryptedPassword }
  }

  protected async beforeUpdate(data: Partial<GeneralAccount>): Promise<Partial<GeneralAccount>> {
    if (data.password !== undefined) {
      const encryptedPassword = data.password ? await encrypt(data.password) : ''
      return { ...data, password: encryptedPassword }
    }
    return data
  }
}

export const generalAccountService = new GeneralAccountService()