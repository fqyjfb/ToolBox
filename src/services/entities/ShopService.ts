import { BaseEntityService } from './baseEntityService'
import { Shop } from '../../types/account'
import { encrypt, decrypt } from '../../utils/crypto'
import { logError } from '../loggerService'

export class ShopService extends BaseEntityService<Shop> {
  constructor() {
    super('shops', 'ShopService', ['shop_name', 'platform', 'account', 'contact_person', 'email', 'phone'])
  }

  protected async afterRead(item: Shop): Promise<Shop> {
    let decryptedPassword = item.password
    if (item.password) {
      try {
        decryptedPassword = await decrypt(item.password)
      } catch (e) {
        logError('解密失败', 'ShopService', e as Error)
      }
    }
    return {
      ...item,
      password: decryptedPassword,
      base_deposit: String(item.base_deposit || ''),
      risk_deposit: String(item.risk_deposit || '')
    }
  }

  protected async beforeCreate(data: Omit<Shop, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Omit<Shop, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
    const encryptedPassword = data.password ? await encrypt(data.password) : ''
    return { ...data, password: encryptedPassword }
  }

  protected async beforeUpdate(data: Partial<Shop>): Promise<Partial<Shop>> {
    if (data.password !== undefined) {
      const encryptedPassword = data.password ? await encrypt(data.password) : ''
      return { ...data, password: encryptedPassword }
    }
    return data
  }
}

export const shopService = new ShopService()