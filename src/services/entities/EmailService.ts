import { BaseEntityService } from './baseEntityService'
import { Email } from '../../types/account'
import { encrypt, decrypt } from '../../utils/crypto'
import { logError } from '../loggerService'

export class EmailService extends BaseEntityService<Email> {
  constructor() {
    super('emails', 'EmailService', ['email', 'phone'])
  }

  protected async afterRead(item: Email): Promise<Email> {
    let decryptedPassword = item.password
    if (item.password) {
      try {
        decryptedPassword = await decrypt(item.password)
      } catch (e) {
        logError('解密失败', 'EmailService', e as Error)
      }
    }
    return { ...item, password: decryptedPassword }
  }

  protected async beforeCreate(data: Omit<Email, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Omit<Email, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
    const encryptedPassword = data.password ? await encrypt(data.password) : ''
    return { ...data, password: encryptedPassword }
  }

  protected async beforeUpdate(data: Partial<Email>): Promise<Partial<Email>> {
    if (data.password !== undefined) {
      const encryptedPassword = data.password ? await encrypt(data.password) : ''
      return { ...data, password: encryptedPassword }
    }
    return data
  }
}

export const emailService = new EmailService()