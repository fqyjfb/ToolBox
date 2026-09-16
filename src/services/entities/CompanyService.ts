import { BaseEntityService } from './baseEntityService'
import { Company } from '../../types/account'

export class CompanyService extends BaseEntityService<Company> {
  constructor() {
    super('companies', 'CompanyService', ['name', 'unified_social_credit_code', 'legal_person', 'address'])
  }

  protected async afterRead(item: Company): Promise<Company> {
    return {
      ...item,
      establishment_date: item.establishment_date ? item.establishment_date.toString() : ''
    }
  }
}

export const companyService = new CompanyService()