import { getDataAccessLayer } from './dataAccessLayer'
import { Shop, ShopRequest, SocialAccount, SocialAccountRequest, Email, EmailRequest, Phone, PhoneRequest, Company, CompanyRequest, Credential, CredentialRequest, GeneralAccount, GeneralAccountRequest, ListResponse } from '../types/account'
import { logError, logInfo } from './loggerService'
import { encrypt, decrypt } from '../utils/crypto'

export const accountService = {
  async getShops(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Shop>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<Shop>('shops', {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return {
          ...item,
          password: decryptedPassword,
          base_deposit: String(item.base_deposit || ''),
          risk_deposit: String(item.risk_deposit || '')
        }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('获取店铺列表失败', 'AccountService', error as Error)
      throw error
    }
  },

  async createShop(userId: string, request: ShopRequest): Promise<Shop> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.create<Shop>('shops', {
        shop_name: request.shop_name,
        platform: request.platform,
        account: request.account,
        password: encryptedPassword,
        payment_password: request.payment_password,
        phone: request.phone,
        email: request.email,
        shop_type: request.shop_type,
        corporation: request.corporation,
        alipay_account: request.alipay_account,
        alipay_password: request.alipay_password,
        contact_person: request.contact_person,
        address: request.address,
        base_deposit: request.base_deposit || '',
        risk_deposit: request.risk_deposit || '',
        remark: request.remark
      })

      logInfo(`创建店铺成功: ${request.shop_name} (${request.platform})`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return {
        ...data,
        password: decryptedPassword,
        base_deposit: String(data.base_deposit || ''),
        risk_deposit: String(data.risk_deposit || '')
      }
    } catch (error) {
      logError('创建店铺失败', 'AccountService', error as Error)
      throw error
    }
  },

  async updateShop(userId: string, shopId: string, request: ShopRequest): Promise<Shop> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.update<Shop>('shops', shopId, {
        shop_name: request.shop_name,
        platform: request.platform,
        account: request.account,
        password: encryptedPassword,
        payment_password: request.payment_password,
        phone: request.phone,
        email: request.email,
        shop_type: request.shop_type,
        corporation: request.corporation,
        alipay_account: request.alipay_account,
        alipay_password: request.alipay_password,
        contact_person: request.contact_person,
        address: request.address,
        base_deposit: request.base_deposit || '',
        risk_deposit: request.risk_deposit || '',
        remark: request.remark
      })

      logInfo(`更新店铺成功: ${request.shop_name}`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return {
        ...data,
        password: decryptedPassword,
        base_deposit: String(data.base_deposit || ''),
        risk_deposit: String(data.risk_deposit || '')
      }
    } catch (error) {
      logError('更新店铺失败', 'AccountService', error as Error)
      throw error
    }
  },

  async deleteShop(userId: string, shopId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('shops', shopId)
      logInfo(`删除店铺成功: ID=${shopId}`, 'AccountService')
    } catch (error) {
      logError('删除店铺失败', 'AccountService', error as Error)
      throw error
    }
  },

  async searchShops(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Shop>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<Shop>('shops', keyword, ['shop_name', 'platform', 'account', 'contact_person', 'email', 'phone'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return {
          ...item,
          password: decryptedPassword,
          base_deposit: String(item.base_deposit || ''),
          risk_deposit: String(item.risk_deposit || '')
        }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('搜索店铺失败', 'AccountService', error as Error)
      throw error
    }
  },

  async getSocialAccounts(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<SocialAccount>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<SocialAccount>('social_accounts', {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return {
          ...item,
          password: decryptedPassword,
          register_time: item.register_time ? item.register_time.toString() : ''
        }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('获取社交账号列表失败', 'AccountService', error as Error)
      throw error
    }
  },

  async createSocialAccount(userId: string, request: SocialAccountRequest): Promise<SocialAccount> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.create<SocialAccount>('social_accounts', {
        email: request.email,
        platform: request.platform,
        account: request.account,
        password: encryptedPassword,
        phone: request.phone,
        user_name: request.user_name,
        bind_company: request.bind_company,
        register_time: request.register_time || '',
        account_status: request.account_status || '正常',
        remark: request.remark
      })

      logInfo(`创建社交账号成功: ${request.platform} - ${request.account}`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return {
        ...data,
        password: decryptedPassword,
        register_time: data.register_time ? data.register_time.toString() : ''
      }
    } catch (error) {
      logError('创建社交账号失败', 'AccountService', error as Error)
      throw error
    }
  },

  async updateSocialAccount(userId: string, accountId: string, request: SocialAccountRequest): Promise<SocialAccount> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.update<SocialAccount>('social_accounts', accountId, {
        email: request.email,
        platform: request.platform,
        account: request.account,
        password: encryptedPassword,
        phone: request.phone,
        user_name: request.user_name,
        bind_company: request.bind_company,
        register_time: request.register_time || '',
        account_status: request.account_status,
        remark: request.remark
      })

      logInfo(`更新社交账号成功: ${request.platform} - ${request.account}`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return {
        ...data,
        password: decryptedPassword,
        register_time: data.register_time ? data.register_time.toString() : ''
      }
    } catch (error) {
      logError('更新社交账号失败', 'AccountService', error as Error)
      throw error
    }
  },

  async deleteSocialAccount(userId: string, accountId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('social_accounts', accountId)
      logInfo(`删除社交账号成功: ID=${accountId}`, 'AccountService')
    } catch (error) {
      logError('删除社交账号失败', 'AccountService', error as Error)
      throw error
    }
  },

  async searchSocialAccounts(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<SocialAccount>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<SocialAccount>('social_accounts', keyword, ['platform', 'account', 'user_name', 'email', 'phone'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return {
          ...item,
          password: decryptedPassword,
          register_time: item.register_time ? item.register_time.toString() : ''
        }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('搜索社交账号失败', 'AccountService', error as Error)
      throw error
    }
  },

  async getEmails(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Email>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<Email>('emails', {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return { ...item, password: decryptedPassword }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('获取邮箱列表失败', 'AccountService', error as Error)
      throw error
    }
  },

  async createEmail(userId: string, request: EmailRequest): Promise<Email> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.create<Email>('emails', {
        email: request.email,
        password: encryptedPassword,
        phone: request.phone,
        verification_info: request.verification_info,
        remark: request.remark
      })

      logInfo(`创建邮箱成功: ${request.email}`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return { ...data, password: decryptedPassword }
    } catch (error) {
      logError('创建邮箱失败', 'AccountService', error as Error)
      throw error
    }
  },

  async updateEmail(userId: string, emailId: string, request: EmailRequest): Promise<Email> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.update<Email>('emails', emailId, {
        email: request.email,
        password: encryptedPassword,
        phone: request.phone,
        verification_info: request.verification_info,
        remark: request.remark
      })

      logInfo(`更新邮箱成功: ${request.email}`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return { ...data, password: decryptedPassword }
    } catch (error) {
      logError('更新邮箱失败', 'AccountService', error as Error)
      throw error
    }
  },

  async deleteEmail(userId: string, emailId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('emails', emailId)
      logInfo(`删除邮箱成功: ID=${emailId}`, 'AccountService')
    } catch (error) {
      logError('删除邮箱失败', 'AccountService', error as Error)
      throw error
    }
  },

  async searchEmails(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Email>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<Email>('emails', keyword, ['email', 'phone'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return { ...item, password: decryptedPassword }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('搜索邮箱失败', 'AccountService', error as Error)
      throw error
    }
  },

  async getPhones(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Phone>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<Phone>('phones', {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      return { list: data, total }
    } catch (error) {
      logError('获取电话列表失败', 'AccountService', error as Error)
      throw error
    }
  },

  async createPhone(userId: string, request: PhoneRequest): Promise<Phone> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<Phone>('phones', {
        phone_number: request.phone_number,
        owner: request.owner,
        phone_operator: request.phone_operator,
        phone_region: request.phone_region,
        status: request.status || '正常',
        remarks: request.remarks
      })

      logInfo(`创建电话成功: ${request.phone_number}`, 'AccountService')
      return data
    } catch (error) {
      logError('创建电话失败', 'AccountService', error as Error)
      throw error
    }
  },

  async updatePhone(userId: string, phoneId: string, request: PhoneRequest): Promise<Phone> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<Phone>('phones', phoneId, {
        phone_number: request.phone_number,
        owner: request.owner,
        phone_operator: request.phone_operator,
        phone_region: request.phone_region,
        status: request.status,
        remarks: request.remarks
      })

      logInfo(`更新电话成功: ${request.phone_number}`, 'AccountService')
      return data
    } catch (error) {
      logError('更新电话失败', 'AccountService', error as Error)
      throw error
    }
  },

  async deletePhone(userId: string, phoneId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('phones', phoneId)
      logInfo(`删除电话成功: ID=${phoneId}`, 'AccountService')
    } catch (error) {
      logError('删除电话失败', 'AccountService', error as Error)
      throw error
    }
  },

  async searchPhones(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Phone>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<Phone>('phones', keyword, ['phone_number', 'owner', 'phone_operator', 'phone_region'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      return { list: data, total }
    } catch (error) {
      logError('搜索电话失败', 'AccountService', error as Error)
      throw error
    }
  },

  async getCompanies(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Company>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<Company>('companies', {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      return {
        list: data.map(item => ({
          ...item,
          establishment_date: item.establishment_date ? item.establishment_date.toString() : ''
        })),
        total
      }
    } catch (error) {
      logError('获取公司列表失败', 'AccountService', error as Error)
      throw error
    }
  },

  async createCompany(userId: string, request: CompanyRequest): Promise<Company> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<Company>('companies', {
        name: request.name,
        unified_social_credit_code: request.unified_social_credit_code,
        legal_person: request.legal_person,
        establishment_date: request.establishment_date || '',
        address: request.address,
        registered_capital: request.registered_capital,
        business_scope: request.business_scope
      })

      logInfo(`创建公司成功: ${request.name}`, 'AccountService')

      return {
        ...data,
        establishment_date: data.establishment_date ? data.establishment_date.toString() : ''
      }
    } catch (error) {
      logError('创建公司失败', 'AccountService', error as Error)
      throw error
    }
  },

  async updateCompany(userId: string, companyId: string, request: CompanyRequest): Promise<Company> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<Company>('companies', companyId, {
        name: request.name,
        unified_social_credit_code: request.unified_social_credit_code,
        legal_person: request.legal_person,
        establishment_date: request.establishment_date || '',
        address: request.address,
        registered_capital: request.registered_capital,
        business_scope: request.business_scope
      })

      logInfo(`更新公司成功: ${request.name}`, 'AccountService')

      return {
        ...data,
        establishment_date: data.establishment_date ? data.establishment_date.toString() : ''
      }
    } catch (error) {
      logError('更新公司失败', 'AccountService', error as Error)
      throw error
    }
  },

  async deleteCompany(userId: string, companyId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('companies', companyId)
      logInfo(`删除公司成功: ID=${companyId}`, 'AccountService')
    } catch (error) {
      logError('删除公司失败', 'AccountService', error as Error)
      throw error
    }
  },

  async searchCompanies(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Company>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<Company>('companies', keyword, ['name', 'unified_social_credit_code', 'legal_person', 'address'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      return {
        list: data.map(item => ({
          ...item,
          establishment_date: item.establishment_date ? item.establishment_date.toString() : ''
        })),
        total
      }
    } catch (error) {
      logError('搜索公司失败', 'AccountService', error as Error)
      throw error
    }
  },

  async getCredentials(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Credential>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<Credential>('credentials', {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      return {
        list: data.map(item => ({
          ...item,
          birth_date: item.birth_date ? item.birth_date.toString() : ''
        })),
        total
      }
    } catch (error) {
      logError('获取证件列表失败', 'AccountService', error as Error)
      throw error
    }
  },

  async createCredential(userId: string, request: CredentialRequest): Promise<Credential> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<Credential>('credentials', {
        certificate_name: request.certificate_name,
        id_card_number: request.id_card_number,
        gender: request.gender,
        birth_date: request.birth_date || '',
        id_card_address: request.id_card_address,
        certificate_status: request.certificate_status || '正常',
        bank_name: request.bank_name,
        bank_account: request.bank_account,
        phone: request.phone,
        certificate_remark: request.certificate_remark
      })

      logInfo(`创建证件成功: ${request.certificate_name}`, 'AccountService')

      return {
        ...data,
        birth_date: data.birth_date ? data.birth_date.toString() : ''
      }
    } catch (error) {
      logError('创建证件失败', 'AccountService', error as Error)
      throw error
    }
  },

  async updateCredential(userId: string, credentialId: string, request: CredentialRequest): Promise<Credential> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<Credential>('credentials', credentialId, {
        certificate_name: request.certificate_name,
        id_card_number: request.id_card_number,
        gender: request.gender,
        birth_date: request.birth_date || '',
        id_card_address: request.id_card_address,
        certificate_status: request.certificate_status,
        bank_name: request.bank_name,
        bank_account: request.bank_account,
        phone: request.phone,
        certificate_remark: request.certificate_remark
      })

      logInfo(`更新证件成功: ${request.certificate_name}`, 'AccountService')

      return {
        ...data,
        birth_date: data.birth_date ? data.birth_date.toString() : ''
      }
    } catch (error) {
      logError('更新证件失败', 'AccountService', error as Error)
      throw error
    }
  },

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('credentials', credentialId)
      logInfo(`删除证件成功: ID=${credentialId}`, 'AccountService')
    } catch (error) {
      logError('删除证件失败', 'AccountService', error as Error)
      throw error
    }
  },

  async searchCredentials(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Credential>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<Credential>('credentials', keyword, ['certificate_name', 'id_card_number', 'bank_name', 'bank_account', 'phone'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      return {
        list: data.map(item => ({
          ...item,
          birth_date: item.birth_date ? item.birth_date.toString() : ''
        })),
        total
      }
    } catch (error) {
      logError('搜索证件失败', 'AccountService', error as Error)
      throw error
    }
  },

  async getGeneralAccounts(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<GeneralAccount>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<GeneralAccount>('general_accounts', {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return {
          ...item,
          password: decryptedPassword,
          registration_date: item.registration_date ? item.registration_date.toString() : ''
        }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('获取通用账号列表失败', 'AccountService', error as Error)
      throw error
    }
  },

  async createGeneralAccount(userId: string, request: GeneralAccountRequest): Promise<GeneralAccount> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.create<GeneralAccount>('general_accounts', {
        platform_name: request.platform_name,
        website: request.website,
        account: request.account,
        password: encryptedPassword,
        email: request.email,
        phone: request.phone,
        registration_date: request.registration_date || '',
        status: request.status || 'active',
        security_question: request.security_question,
        security_answer: request.security_answer,
        notes: request.notes
      })

      logInfo(`创建通用账号成功: ${request.platform_name} - ${request.account}`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return {
        ...data,
        password: decryptedPassword,
        registration_date: data.registration_date ? data.registration_date.toString() : ''
      }
    } catch (error) {
      logError('创建通用账号失败', 'AccountService', error as Error)
      throw error
    }
  },

  async updateGeneralAccount(userId: string, accountId: string, request: GeneralAccountRequest): Promise<GeneralAccount> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''
      const data = await dal.update<GeneralAccount>('general_accounts', accountId, {
        platform_name: request.platform_name,
        website: request.website,
        account: request.account,
        password: encryptedPassword,
        email: request.email,
        phone: request.phone,
        registration_date: request.registration_date || '',
        status: request.status,
        security_question: request.security_question,
        security_answer: request.security_answer,
        notes: request.notes
      })

      logInfo(`更新通用账号成功: ${request.platform_name} - ${request.account}`, 'AccountService')

      let decryptedPassword = data.password
      try {
        decryptedPassword = await decrypt(data.password)
      } catch (e) { logError('解密失败', 'AccountService', e as Error); }

      return {
        ...data,
        password: decryptedPassword,
        registration_date: data.registration_date ? data.registration_date.toString() : ''
      }
    } catch (error) {
      logError('更新通用账号失败', 'AccountService', error as Error)
      throw error
    }
  },

  async deleteGeneralAccount(userId: string, accountId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('general_accounts', accountId)
      logInfo(`删除通用账号成功: ID=${accountId}`, 'AccountService')
    } catch (error) {
      logError('删除通用账号失败', 'AccountService', error as Error)
      throw error
    }
  },

  async searchGeneralAccounts(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<GeneralAccount>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<GeneralAccount>('general_accounts', keyword, ['platform_name', 'website', 'account', 'email', 'phone'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const decryptedList = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) { logError('解密失败', 'AccountService', e as Error); }
        }
        return {
          ...item,
          password: decryptedPassword,
          registration_date: item.registration_date ? item.registration_date.toString() : ''
        }
      }))

      return { list: decryptedList, total }
    } catch (error) {
      logError('搜索通用账号失败', 'AccountService', error as Error)
      throw error
    }
  }
}
