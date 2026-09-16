import { shopService } from './entities/ShopService'
import { socialAccountService } from './entities/SocialAccountService'
import { emailService } from './entities/EmailService'
import { phoneService } from './entities/PhoneService'
import { companyService } from './entities/CompanyService'
import { credentialService } from './entities/CredentialService'
import { generalAccountService } from './entities/GeneralAccountService'
import { ShopRequest, SocialAccountRequest, EmailRequest, PhoneRequest, CompanyRequest, CredentialRequest, GeneralAccountRequest } from '../types/account'

export const accountService = {
  getShops: (userId: string, page: number = 1, pageSize: number = 10) => shopService.getList(userId, page, pageSize),
  createShop: (userId: string, request: ShopRequest) => shopService.create(userId, request),
  updateShop: (userId: string, shopId: string, request: ShopRequest) => shopService.update(userId, shopId, request),
  deleteShop: (userId: string, shopId: string) => shopService.delete(userId, shopId),
  searchShops: (userId: string, keyword: string, page: number = 1, pageSize: number = 10) => shopService.search(userId, keyword, page, pageSize),

  getSocialAccounts: (userId: string, page: number = 1, pageSize: number = 10) => socialAccountService.getList(userId, page, pageSize),
  createSocialAccount: (userId: string, request: SocialAccountRequest) => socialAccountService.create(userId, request),
  updateSocialAccount: (userId: string, accountId: string, request: SocialAccountRequest) => socialAccountService.update(userId, accountId, request),
  deleteSocialAccount: (userId: string, accountId: string) => socialAccountService.delete(userId, accountId),
  searchSocialAccounts: (userId: string, keyword: string, page: number = 1, pageSize: number = 10) => socialAccountService.search(userId, keyword, page, pageSize),

  getEmails: (userId: string, page: number = 1, pageSize: number = 10) => emailService.getList(userId, page, pageSize),
  createEmail: (userId: string, request: EmailRequest) => emailService.create(userId, request),
  updateEmail: (userId: string, emailId: string, request: EmailRequest) => emailService.update(userId, emailId, request),
  deleteEmail: (userId: string, emailId: string) => emailService.delete(userId, emailId),
  searchEmails: (userId: string, keyword: string, page: number = 1, pageSize: number = 10) => emailService.search(userId, keyword, page, pageSize),

  getPhones: (userId: string, page: number = 1, pageSize: number = 10) => phoneService.getList(userId, page, pageSize),
  createPhone: (userId: string, request: PhoneRequest) => phoneService.create(userId, request),
  updatePhone: (userId: string, phoneId: string, request: PhoneRequest) => phoneService.update(userId, phoneId, request),
  deletePhone: (userId: string, phoneId: string) => phoneService.delete(userId, phoneId),
  searchPhones: (userId: string, keyword: string, page: number = 1, pageSize: number = 10) => phoneService.search(userId, keyword, page, pageSize),

  getCompanies: (userId: string, page: number = 1, pageSize: number = 10) => companyService.getList(userId, page, pageSize),
  createCompany: (userId: string, request: CompanyRequest) => companyService.create(userId, request),
  updateCompany: (userId: string, companyId: string, request: CompanyRequest) => companyService.update(userId, companyId, request),
  deleteCompany: (userId: string, companyId: string) => companyService.delete(userId, companyId),
  searchCompanies: (userId: string, keyword: string, page: number = 1, pageSize: number = 10) => companyService.search(userId, keyword, page, pageSize),

  getCredentials: (userId: string, page: number = 1, pageSize: number = 10) => credentialService.getList(userId, page, pageSize),
  createCredential: (userId: string, request: CredentialRequest) => credentialService.create(userId, request),
  updateCredential: (userId: string, credentialId: string, request: CredentialRequest) => credentialService.update(userId, credentialId, request),
  deleteCredential: (userId: string, credentialId: string) => credentialService.delete(userId, credentialId),
  searchCredentials: (userId: string, keyword: string, page: number = 1, pageSize: number = 10) => credentialService.search(userId, keyword, page, pageSize),

  getGeneralAccounts: (userId: string, page: number = 1, pageSize: number = 10) => generalAccountService.getList(userId, page, pageSize),
  createGeneralAccount: (userId: string, request: GeneralAccountRequest) => generalAccountService.create(userId, request),
  updateGeneralAccount: (userId: string, accountId: string, request: GeneralAccountRequest) => generalAccountService.update(userId, accountId, request),
  deleteGeneralAccount: (userId: string, accountId: string) => generalAccountService.delete(userId, accountId),
  searchGeneralAccounts: (userId: string, keyword: string, page: number = 1, pageSize: number = 10) => generalAccountService.search(userId, keyword, page, pageSize),
}