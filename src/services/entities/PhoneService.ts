import { BaseEntityService } from './baseEntityService'
import { Phone } from '../../types/account'

export class PhoneService extends BaseEntityService<Phone> {
  constructor() {
    super('phones', 'PhoneService', ['phone_number', 'owner', 'phone_operator', 'phone_region'])
  }
}

export const phoneService = new PhoneService()