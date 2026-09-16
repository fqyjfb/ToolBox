import { BaseEntityService } from './baseEntityService'
import { Credential } from '../../types/account'

export class CredentialService extends BaseEntityService<Credential> {
  constructor() {
    super('credentials', 'CredentialService', ['certificate_name', 'id_card_number', 'bank_name', 'bank_account', 'phone'])
  }

  protected async afterRead(item: Credential): Promise<Credential> {
    return {
      ...item,
      birth_date: item.birth_date ? item.birth_date.toString() : ''
    }
  }
}

export const credentialService = new CredentialService()