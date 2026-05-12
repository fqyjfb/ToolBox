export interface Shop {
  id: string;
  user_id: string;
  shop_name: string;
  platform: '淘宝' | '天猫' | '拼多多' | '抖音' | '京东' | '其他';
  account: string;
  password: string;
  payment_password: string;
  phone: string;
  email: string;
  shop_type: '企业' | '个人' | '';
  corporation: string;
  alipay_account: string;
  alipay_password: string;
  contact_person: string;
  address: string;
  base_deposit: string;
  risk_deposit: string;
  remark: string;
  created_at: string;
  updated_at: string;
}

export interface ShopRequest {
  shop_name: string;
  platform: '淘宝' | '天猫' | '拼多多' | '抖音' | '京东' | '其他';
  account: string;
  password: string;
  payment_password: string;
  phone: string;
  email: string;
  shop_type: '企业' | '个人' | '';
  corporation: string;
  alipay_account: string;
  alipay_password: string;
  contact_person: string;
  address: string;
  base_deposit: string;
  risk_deposit: string;
  remark: string;
}

export interface SocialAccount {
  id: string;
  user_id: string;
  email: string;
  platform: 'tiktok' | 'youtube' | 'facebook' | 'twitter' | 'linkedin' | 'whatsapp' | 'instagram' | 'wechat' | 'weibo' | 'douyin' | 'other' | '';
  account: string;
  password: string;
  phone: string;
  user_name: string;
  bind_company: string;
  register_time: string;
  account_status: '正常' | '异常' | '封禁' | '待验证';
  remark: string;
  created_at: string;
  updated_at: string;
}

export interface SocialAccountRequest {
  email: string;
  platform: 'tiktok' | 'youtube' | 'facebook' | 'twitter' | 'linkedin' | 'whatsapp' | 'instagram' | 'wechat' | 'weibo' | 'douyin' | 'other' | '';
  account: string;
  password: string;
  phone: string;
  user_name: string;
  bind_company: string;
  register_time: string;
  account_status: '正常' | '异常' | '封禁' | '待验证';
  remark: string;
}

export interface Email {
  id: string;
  user_id: string;
  email: string;
  password: string;
  phone: string;
  verification_info: string;
  remark: string;
  created_at: string;
  updated_at: string;
}

export interface EmailRequest {
  email: string;
  password: string;
  phone: string;
  verification_info: string;
  remark: string;
}

export interface Phone {
  id: string;
  user_id: string;
  phone_number: string;
  owner: string;
  phone_operator: string;
  phone_region: string;
  status: '正常' | '失效';
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface PhoneRequest {
  phone_number: string;
  owner: string;
  phone_operator: string;
  phone_region: string;
  status: '正常' | '失效';
  remarks: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  unified_social_credit_code: string;
  legal_person: string;
  establishment_date: string;
  address: string;
  registered_capital: string;
  business_scope: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyRequest {
  name: string;
  unified_social_credit_code: string;
  legal_person: string;
  establishment_date: string;
  address: string;
  registered_capital: string;
  business_scope: string;
}

export interface Credential {
  id: string;
  user_id: string;
  certificate_name: string;
  id_card_number: string;
  gender: '男' | '女' | '';
  birth_date: string;
  id_card_address: string;
  certificate_status: '正常' | '异常' | '到期';
  bank_name: string;
  bank_account: string;
  phone: string;
  certificate_remark: string;
  created_at: string;
  updated_at: string;
}

export interface CredentialRequest {
  certificate_name: string;
  id_card_number: string;
  gender: '男' | '女' | '';
  birth_date: string;
  id_card_address: string;
  certificate_status: '正常' | '异常' | '到期';
  bank_name: string;
  bank_account: string;
  phone: string;
  certificate_remark: string;
}

export interface GeneralAccount {
  id: string;
  user_id: string;
  platform_name: string;
  website: string;
  account: string;
  password: string;
  email: string;
  phone: string;
  registration_date: string;
  status: 'active' | 'abnormal' | 'banned' | 'expired';
  security_question: string;
  security_answer: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface GeneralAccountRequest {
  platform_name: string;
  website: string;
  account: string;
  password: string;
  email: string;
  phone: string;
  registration_date: string;
  status: 'active' | 'abnormal' | 'banned' | 'expired';
  security_question: string;
  security_answer: string;
  notes: string;
}

export interface ListResponse<T> {
  list: T[];
  total: number;
}