import { supabase } from './supabase';
import { Shop, ShopRequest, SocialAccount, SocialAccountRequest, Email, EmailRequest, Phone, PhoneRequest, Company, CompanyRequest, Credential, CredentialRequest, GeneralAccount, GeneralAccountRequest, ListResponse } from '../types/account';
import { logError, logInfo } from './loggerService';

export const accountService = {
  async getShops(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Shop>> {
    try {
      const { data, error, count } = await supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('获取店铺列表失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          base_deposit: String(item.base_deposit || ''),
          risk_deposit: String(item.risk_deposit || '')
        })),
        total: count || 0
      };
    } catch (error) {
      logError('获取店铺列表失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async createShop(userId: string, request: ShopRequest): Promise<Shop> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .insert({
          user_id: userId,
          shop_name: request.shop_name,
          platform: request.platform,
          account: request.account,
          password: request.password,
          payment_password: request.payment_password,
          phone: request.phone,
          email: request.email,
          shop_type: request.shop_type,
          corporation: request.corporation,
          alipay_account: request.alipay_account,
          alipay_password: request.alipay_password,
          contact_person: request.contact_person,
          address: request.address,
          base_deposit: request.base_deposit ? parseFloat(request.base_deposit) : null,
          risk_deposit: request.risk_deposit ? parseFloat(request.risk_deposit) : null,
          remark: request.remark
        })
        .select()
        .single();

      if (error) {
        logError('创建店铺失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`创建店铺成功: ${request.shop_name} (${request.platform})`, 'AccountService');

      return {
        ...data,
        base_deposit: String(data.base_deposit || ''),
        risk_deposit: String(data.risk_deposit || '')
      };
    } catch (error) {
      logError('创建店铺失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async updateShop(shopId: string, request: ShopRequest): Promise<Shop> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .update({
          shop_name: request.shop_name,
          platform: request.platform,
          account: request.account,
          password: request.password,
          payment_password: request.payment_password,
          phone: request.phone,
          email: request.email,
          shop_type: request.shop_type,
          corporation: request.corporation,
          alipay_account: request.alipay_account,
          alipay_password: request.alipay_password,
          contact_person: request.contact_person,
          address: request.address,
          base_deposit: request.base_deposit ? parseFloat(request.base_deposit) : null,
          risk_deposit: request.risk_deposit ? parseFloat(request.risk_deposit) : null,
          remark: request.remark,
          updated_at: new Date().toISOString()
        })
        .eq('id', shopId)
        .select()
        .single();

      if (error) {
        logError('更新店铺失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`更新店铺成功: ${request.shop_name}`, 'AccountService');

      return {
        ...data,
        base_deposit: String(data.base_deposit || ''),
        risk_deposit: String(data.risk_deposit || '')
      };
    } catch (error) {
      logError('更新店铺失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async deleteShop(shopId: string): Promise<void> {
    try {
      const { error } = await supabase.from('shops').delete().eq('id', shopId);
      if (error) {
        logError('删除店铺失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`删除店铺成功: ID=${shopId}`, 'AccountService');
    } catch (error) {
      logError('删除店铺失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async searchShops(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Shop>> {
    try {
      const { data, error, count } = await supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`shop_name.ilike.%${keyword}%,platform.ilike.%${keyword}%,account.ilike.%${keyword}%,contact_person.ilike.%${keyword}%,email.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('搜索店铺失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          base_deposit: String(item.base_deposit || ''),
          risk_deposit: String(item.risk_deposit || '')
        })),
        total: count || 0
      };
    } catch (error) {
      logError('搜索店铺失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async getSocialAccounts(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<SocialAccount>> {
    try {
      const { data, error, count } = await supabase
        .from('social_accounts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('获取社交账号列表失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          register_time: item.register_time ? item.register_time.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('获取社交账号列表失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async createSocialAccount(userId: string, request: SocialAccountRequest): Promise<SocialAccount> {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .insert({
          user_id: userId,
          email: request.email,
          platform: request.platform,
          account: request.account,
          password: request.password,
          phone: request.phone,
          user_name: request.user_name,
          bind_company: request.bind_company,
          register_time: request.register_time || null,
          account_status: request.account_status || '正常',
          remark: request.remark
        })
        .select()
        .single();

      if (error) {
        logError('创建社交账号失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`创建社交账号成功: ${request.platform} - ${request.account}`, 'AccountService');

      return {
        ...data,
        register_time: data.register_time ? data.register_time.toString() : ''
      };
    } catch (error) {
      logError('创建社交账号失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async updateSocialAccount(accountId: string, request: SocialAccountRequest): Promise<SocialAccount> {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .update({
          email: request.email,
          platform: request.platform,
          account: request.account,
          password: request.password,
          phone: request.phone,
          user_name: request.user_name,
          bind_company: request.bind_company,
          register_time: request.register_time || null,
          account_status: request.account_status,
          remark: request.remark,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
        .select()
        .single();

      if (error) {
        logError('更新社交账号失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`更新社交账号成功: ${request.platform} - ${request.account}`, 'AccountService');

      return {
        ...data,
        register_time: data.register_time ? data.register_time.toString() : ''
      };
    } catch (error) {
      logError('更新社交账号失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async deleteSocialAccount(accountId: string): Promise<void> {
    try {
      const { error } = await supabase.from('social_accounts').delete().eq('id', accountId);
      if (error) {
        logError('删除社交账号失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`删除社交账号成功: ID=${accountId}`, 'AccountService');
    } catch (error) {
      logError('删除社交账号失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async searchSocialAccounts(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<SocialAccount>> {
    try {
      const { data, error, count } = await supabase
        .from('social_accounts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`platform.ilike.%${keyword}%,account.ilike.%${keyword}%,user_name.ilike.%${keyword}%,email.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('搜索社交账号失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          register_time: item.register_time ? item.register_time.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('搜索社交账号失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async getEmails(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Email>> {
    try {
      const { data, error, count } = await supabase
        .from('emails')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('获取邮箱列表失败', 'AccountService', error as Error);
        throw error;
      }

      return { list: data, total: count || 0 };
    } catch (error) {
      logError('获取邮箱列表失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async createEmail(userId: string, request: EmailRequest): Promise<Email> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .insert({
          user_id: userId,
          email: request.email,
          password: request.password,
          phone: request.phone,
          verification_info: request.verification_info,
          remark: request.remark
        })
        .select()
        .single();

      if (error) {
        logError('创建邮箱失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`创建邮箱成功: ${request.email}`, 'AccountService');

      return data;
    } catch (error) {
      logError('创建邮箱失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async updateEmail(emailId: string, request: EmailRequest): Promise<Email> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .update({
          email: request.email,
          password: request.password,
          phone: request.phone,
          verification_info: request.verification_info,
          remark: request.remark,
          updated_at: new Date().toISOString()
        })
        .eq('id', emailId)
        .select()
        .single();

      if (error) {
        logError('更新邮箱失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`更新邮箱成功: ${request.email}`, 'AccountService');

      return data;
    } catch (error) {
      logError('更新邮箱失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async deleteEmail(emailId: string): Promise<void> {
    try {
      const { error } = await supabase.from('emails').delete().eq('id', emailId);
      if (error) {
        logError('删除邮箱失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`删除邮箱成功: ID=${emailId}`, 'AccountService');
    } catch (error) {
      logError('删除邮箱失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async searchEmails(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Email>> {
    try {
      const { data, error, count } = await supabase
        .from('emails')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`email.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('搜索邮箱失败', 'AccountService', error as Error);
        throw error;
      }

      return { list: data, total: count || 0 };
    } catch (error) {
      logError('搜索邮箱失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async getPhones(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Phone>> {
    try {
      const { data, error, count } = await supabase
        .from('phones')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('获取电话列表失败', 'AccountService', error as Error);
        throw error;
      }

      return { list: data, total: count || 0 };
    } catch (error) {
      logError('获取电话列表失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async createPhone(userId: string, request: PhoneRequest): Promise<Phone> {
    try {
      const { data, error } = await supabase
        .from('phones')
        .insert({
          user_id: userId,
          phone_number: request.phone_number,
          owner: request.owner,
          phone_operator: request.phone_operator,
          phone_region: request.phone_region,
          status: request.status || '正常',
          remarks: request.remarks
        })
        .select()
        .single();

      if (error) {
        logError('创建电话失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`创建电话成功: ${request.phone_number}`, 'AccountService');

      return data;
    } catch (error) {
      logError('创建电话失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async updatePhone(phoneId: string, request: PhoneRequest): Promise<Phone> {
    try {
      const { data, error } = await supabase
        .from('phones')
        .update({
          phone_number: request.phone_number,
          owner: request.owner,
          phone_operator: request.phone_operator,
          phone_region: request.phone_region,
          status: request.status,
          remarks: request.remarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', phoneId)
        .select()
        .single();

      if (error) {
        logError('更新电话失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`更新电话成功: ${request.phone_number}`, 'AccountService');

      return data;
    } catch (error) {
      logError('更新电话失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async deletePhone(phoneId: string): Promise<void> {
    try {
      const { error } = await supabase.from('phones').delete().eq('id', phoneId);
      if (error) {
        logError('删除电话失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`删除电话成功: ID=${phoneId}`, 'AccountService');
    } catch (error) {
      logError('删除电话失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async searchPhones(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Phone>> {
    try {
      const { data, error, count } = await supabase
        .from('phones')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`phone_number.ilike.%${keyword}%,owner.ilike.%${keyword}%,phone_operator.ilike.%${keyword}%,phone_region.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('搜索电话失败', 'AccountService', error as Error);
        throw error;
      }

      return { list: data, total: count || 0 };
    } catch (error) {
      logError('搜索电话失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async getCompanies(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Company>> {
    try {
      const { data, error, count } = await supabase
        .from('companies')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('获取公司列表失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          establishment_date: item.establishment_date ? item.establishment_date.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('获取公司列表失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async createCompany(userId: string, request: CompanyRequest): Promise<Company> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          user_id: userId,
          name: request.name,
          unified_social_credit_code: request.unified_social_credit_code,
          legal_person: request.legal_person,
          establishment_date: request.establishment_date || null,
          address: request.address,
          registered_capital: request.registered_capital,
          business_scope: request.business_scope
        })
        .select()
        .single();

      if (error) {
        logError('创建公司失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`创建公司成功: ${request.name}`, 'AccountService');

      return {
        ...data,
        establishment_date: data.establishment_date ? data.establishment_date.toString() : ''
      };
    } catch (error) {
      logError('创建公司失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async updateCompany(companyId: string, request: CompanyRequest): Promise<Company> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .update({
          name: request.name,
          unified_social_credit_code: request.unified_social_credit_code,
          legal_person: request.legal_person,
          establishment_date: request.establishment_date || null,
          address: request.address,
          registered_capital: request.registered_capital,
          business_scope: request.business_scope,
          updated_at: new Date().toISOString()
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) {
        logError('更新公司失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`更新公司成功: ${request.name}`, 'AccountService');

      return {
        ...data,
        establishment_date: data.establishment_date ? data.establishment_date.toString() : ''
      };
    } catch (error) {
      logError('更新公司失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async deleteCompany(companyId: string): Promise<void> {
    try {
      const { error } = await supabase.from('companies').delete().eq('id', companyId);
      if (error) {
        logError('删除公司失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`删除公司成功: ID=${companyId}`, 'AccountService');
    } catch (error) {
      logError('删除公司失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async searchCompanies(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Company>> {
    try {
      const { data, error, count } = await supabase
        .from('companies')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`name.ilike.%${keyword}%,unified_social_credit_code.ilike.%${keyword}%,legal_person.ilike.%${keyword}%,address.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('搜索公司失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          establishment_date: item.establishment_date ? item.establishment_date.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('搜索公司失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async getCredentials(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Credential>> {
    try {
      const { data, error, count } = await supabase
        .from('credentials')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('获取证件列表失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          birth_date: item.birth_date ? item.birth_date.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('获取证件列表失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async createCredential(userId: string, request: CredentialRequest): Promise<Credential> {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .insert({
          user_id: userId,
          certificate_name: request.certificate_name,
          id_card_number: request.id_card_number,
          gender: request.gender,
          birth_date: request.birth_date || null,
          id_card_address: request.id_card_address,
          certificate_status: request.certificate_status || '正常',
          bank_name: request.bank_name,
          bank_account: request.bank_account,
          phone: request.phone,
          certificate_remark: request.certificate_remark
        })
        .select()
        .single();

      if (error) {
        logError('创建证件失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`创建证件成功: ${request.certificate_name}`, 'AccountService');

      return {
        ...data,
        birth_date: data.birth_date ? data.birth_date.toString() : ''
      };
    } catch (error) {
      logError('创建证件失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async updateCredential(credentialId: string, request: CredentialRequest): Promise<Credential> {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .update({
          certificate_name: request.certificate_name,
          id_card_number: request.id_card_number,
          gender: request.gender,
          birth_date: request.birth_date || null,
          id_card_address: request.id_card_address,
          certificate_status: request.certificate_status,
          bank_name: request.bank_name,
          bank_account: request.bank_account,
          phone: request.phone,
          certificate_remark: request.certificate_remark,
          updated_at: new Date().toISOString()
        })
        .eq('id', credentialId)
        .select()
        .single();

      if (error) {
        logError('更新证件失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`更新证件成功: ${request.certificate_name}`, 'AccountService');

      return {
        ...data,
        birth_date: data.birth_date ? data.birth_date.toString() : ''
      };
    } catch (error) {
      logError('更新证件失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async deleteCredential(credentialId: string): Promise<void> {
    try {
      const { error } = await supabase.from('credentials').delete().eq('id', credentialId);
      if (error) {
        logError('删除证件失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`删除证件成功: ID=${credentialId}`, 'AccountService');
    } catch (error) {
      logError('删除证件失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async searchCredentials(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<Credential>> {
    try {
      const { data, error, count } = await supabase
        .from('credentials')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`certificate_name.ilike.%${keyword}%,id_card_number.ilike.%${keyword}%,bank_name.ilike.%${keyword}%,bank_account.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('搜索证件失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          birth_date: item.birth_date ? item.birth_date.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('搜索证件失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async getGeneralAccounts(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<GeneralAccount>> {
    try {
      const { data, error, count } = await supabase
        .from('general_accounts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('获取通用账号列表失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          registration_date: item.registration_date ? item.registration_date.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('获取通用账号列表失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async createGeneralAccount(userId: string, request: GeneralAccountRequest): Promise<GeneralAccount> {
    try {
      const { data, error } = await supabase
        .from('general_accounts')
        .insert({
          user_id: userId,
          platform_name: request.platform_name,
          website: request.website,
          account: request.account,
          password: request.password,
          email: request.email,
          phone: request.phone,
          registration_date: request.registration_date || null,
          status: request.status || 'active',
          security_question: request.security_question,
          security_answer: request.security_answer,
          notes: request.notes
        })
        .select()
        .single();

      if (error) {
        logError('创建通用账号失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`创建通用账号成功: ${request.platform_name} - ${request.account}`, 'AccountService');

      return {
        ...data,
        registration_date: data.registration_date ? data.registration_date.toString() : ''
      };
    } catch (error) {
      logError('创建通用账号失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async updateGeneralAccount(accountId: string, request: GeneralAccountRequest): Promise<GeneralAccount> {
    try {
      const { data, error } = await supabase
        .from('general_accounts')
        .update({
          platform_name: request.platform_name,
          website: request.website,
          account: request.account,
          password: request.password,
          email: request.email,
          phone: request.phone,
          registration_date: request.registration_date || null,
          status: request.status,
          security_question: request.security_question,
          security_answer: request.security_answer,
          notes: request.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
        .select()
        .single();

      if (error) {
        logError('更新通用账号失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`更新通用账号成功: ${request.platform_name} - ${request.account}`, 'AccountService');

      return {
        ...data,
        registration_date: data.registration_date ? data.registration_date.toString() : ''
      };
    } catch (error) {
      logError('更新通用账号失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async deleteGeneralAccount(accountId: string): Promise<void> {
    try {
      const { error } = await supabase.from('general_accounts').delete().eq('id', accountId);
      if (error) {
        logError('删除通用账号失败', 'AccountService', error as Error);
        throw error;
      }

      logInfo(`删除通用账号成功: ID=${accountId}`, 'AccountService');
    } catch (error) {
      logError('删除通用账号失败', 'AccountService', error as Error);
      throw error;
    }
  },

  async searchGeneralAccounts(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<GeneralAccount>> {
    try {
      const { data, error, count } = await supabase
        .from('general_accounts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`platform_name.ilike.%${keyword}%,website.ilike.%${keyword}%,account.ilike.%${keyword}%,email.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        logError('搜索通用账号失败', 'AccountService', error as Error);
        throw error;
      }

      return {
        list: data.map(item => ({
          ...item,
          registration_date: item.registration_date ? item.registration_date.toString() : ''
        })),
        total: count || 0
      };
    } catch (error) {
      logError('搜索通用账号失败', 'AccountService', error as Error);
      throw error;
    }
  }
};
