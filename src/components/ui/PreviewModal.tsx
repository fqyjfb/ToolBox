import React from 'react';
import { X, Copy, Share2, ExternalLink } from 'lucide-react';
import { Shop, SocialAccount, Email, Phone, Company, Credential, GeneralAccount } from '../../types/account';
import { WebsiteAccount } from '../../types/websiteAccount';
import { useToastStore } from '../../store/toastStore';
import { openUrl } from '../../services/browserService';

export type PreviewItem = Shop | SocialAccount | Email | Phone | Company | Credential | GeneralAccount | WebsiteAccount;

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PreviewItem | null;
  title: string;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, item, title }) => {
  const addToast = useToastStore((state) => state.addToast);

  const handleCopyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message, type: 'success' });
    } catch {
      addToast({ message: '复制失败', type: 'error' });
    }
  };

  const handleShare = async () => {
    if (!item) return;
    try {
      let shareContent = '';
      
      if ('shop_name' in item) {
        const shop = item as Shop;
        shareContent = `${shop.shop_name}\n`;
        shareContent += `平台: ${shop.platform}\n`;
        shareContent += `账号: ${shop.account}\n`;
        shareContent += shop.password ? `密码: ${shop.password}\n` : '';
        shareContent += shop.payment_password ? `支付密码: ${shop.payment_password}\n` : '';
        shareContent += shop.phone ? `手机: ${shop.phone}\n` : '';
        shareContent += shop.email ? `邮箱: ${shop.email}\n` : '';
        shareContent += shop.shop_type ? `类型: ${shop.shop_type}\n` : '';
        shareContent += shop.corporation ? `公司: ${shop.corporation}\n` : '';
        shareContent += shop.alipay_account ? `支付宝: ${shop.alipay_account}\n` : '';
        shareContent += shop.contact_person ? `联系人: ${shop.contact_person}\n` : '';
        shareContent += shop.address ? `地址: ${shop.address}\n` : '';
        shareContent += shop.remark ? `备注: ${shop.remark}` : '';
      } else if ('user_name' in item) {
        const social = item as SocialAccount;
        shareContent = `${social.user_name || social.account}\n`;
        shareContent += `平台: ${social.platform}\n`;
        shareContent += `账号: ${social.account}\n`;
        shareContent += social.password ? `密码: ${social.password}\n` : '';
        shareContent += social.email ? `邮箱: ${social.email}\n` : '';
        shareContent += social.phone ? `手机: ${social.phone}\n` : '';
        shareContent += social.bind_company ? `绑定企业: ${social.bind_company}\n` : '';
        shareContent += social.register_time ? `注册时间: ${social.register_time}\n` : '';
        shareContent += social.account_status ? `状态: ${social.account_status}\n` : '';
        shareContent += social.remark ? `备注: ${social.remark}` : '';
      } else if ('email' in item && !('platform' in item)) {
        const email = item as Email;
        shareContent = `${email.email}\n`;
        shareContent += email.password ? `密码: ${email.password}\n` : '';
        shareContent += email.phone ? `手机: ${email.phone}\n` : '';
        shareContent += email.verification_info ? `验证信息: ${email.verification_info}\n` : '';
        shareContent += email.remark ? `备注: ${email.remark}` : '';
      } else if ('phone_number' in item) {
        const phone = item as Phone;
        shareContent = `${phone.phone_number}\n`;
        shareContent += phone.owner ? `机主: ${phone.owner}\n` : '';
        shareContent += phone.phone_operator ? `运营商: ${phone.phone_operator}\n` : '';
        shareContent += phone.phone_region ? `地区: ${phone.phone_region}\n` : '';
        shareContent += phone.status ? `状态: ${phone.status}\n` : '';
        shareContent += phone.remarks ? `备注: ${phone.remarks}` : '';
      } else if ('name' in item && 'unified_social_credit_code' in item) {
        const company = item as Company;
        shareContent = `${company.name}\n`;
        shareContent += company.unified_social_credit_code ? `统一社会信用代码: ${company.unified_social_credit_code}\n` : '';
        shareContent += company.legal_person ? `法人: ${company.legal_person}\n` : '';
        shareContent += company.establishment_date ? `成立日期: ${company.establishment_date}\n` : '';
        shareContent += company.registered_capital ? `注册资本: ${company.registered_capital}\n` : '';
        shareContent += company.address ? `地址: ${company.address}\n` : '';
        shareContent += company.business_scope ? `经营范围: ${company.business_scope}` : '';
      } else if ('certificate_name' in item) {
        const credential = item as Credential;
        shareContent = `${credential.certificate_name}\n`;
        shareContent += credential.id_card_number ? `身份证号: ${credential.id_card_number}\n` : '';
        shareContent += credential.gender ? `性别: ${credential.gender}\n` : '';
        shareContent += credential.birth_date ? `出生日期: ${credential.birth_date}\n` : '';
        shareContent += credential.id_card_address ? `身份证地址: ${credential.id_card_address}\n` : '';
        shareContent += credential.bank_name ? `开户行: ${credential.bank_name}\n` : '';
        shareContent += credential.bank_account ? `银行账号: ${credential.bank_account}\n` : '';
        shareContent += credential.phone ? `手机号: ${credential.phone}\n` : '';
        shareContent += credential.certificate_status ? `状态: ${credential.certificate_status}\n` : '';
        shareContent += credential.certificate_remark ? `备注: ${credential.certificate_remark}` : '';
      } else if ('platform_name' in item) {
        const general = item as GeneralAccount;
        shareContent = `${general.platform_name}\n`;
        shareContent += `账号: ${general.account}\n`;
        shareContent += general.password ? `密码: ${general.password}\n` : '';
        shareContent += general.email ? `邮箱: ${general.email}\n` : '';
        shareContent += general.phone ? `手机号: ${general.phone}\n` : '';
        shareContent += general.website ? `网站: ${general.website}\n` : '';
        shareContent += general.registration_date ? `注册日期: ${general.registration_date}\n` : '';
        const statusText = general.status === 'active' ? '活跃' : general.status === 'abnormal' ? '异常' : general.status === 'banned' ? '封禁' : '过期';
        shareContent += `状态: ${statusText}\n`;
        shareContent += general.security_question ? `安全问题: ${general.security_question}\n` : '';
        shareContent += general.notes ? `备注: ${general.notes}` : '';
      } else if ('category_id' in item && 'username' in item && !('platform_name' in item)) {
        const website = item as WebsiteAccount;
        shareContent = `${website.name}\n`;
        shareContent += website.url ? `网址: ${website.url}\n` : '';
        shareContent += `账号: ${website.username}\n`;
        shareContent += website.password ? `密码: ${website.password}\n` : '';
        shareContent += website.email ? `邮箱: ${website.email}\n` : '';
        shareContent += website.phone ? `手机号: ${website.phone}\n` : '';
        shareContent += website.security_question ? `安全问题: ${website.security_question}\n` : '';
        shareContent += website.date ? `日期: ${website.date}\n` : '';
        const websiteStatusText = website.status === 'active' ? '活跃' : website.status === 'inactive' ? '非活跃' : '已过期';
        shareContent += `状态: ${websiteStatusText}\n`;
        shareContent += website.category_name ? `分类: ${website.category_name}\n` : '';
        shareContent += website.notes ? `备注: ${website.notes}` : '';
      }

      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '信息已复制到剪贴板', type: 'success' });
    } catch {
      addToast({ message: '分享失败', type: 'error' });
    }
  };

  const renderField = (label: string, value: string, copyable: boolean = false, wrap: boolean = false) => {
    if (!value) return null;
    if (wrap) {
      return (
        <div className="py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
          <div className="mt-1 max-h-24 overflow-y-auto">
            <span className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">{value}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900 dark:text-white max-w-[200px] truncate">{value}</span>
          {copyable && (
            <button
              onClick={() => handleCopyText(value, `${label}已复制`)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="复制"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderUrlField = (label: string, url: string) => {
    if (!url) return null;
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
        <button
          onClick={() => openUrl(url)}
          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline transition-colors truncate max-w-[200px]"
          title="点击打开网站"
        >
          <span className="truncate">{url}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </button>
      </div>
    );
  };

  const getStatusBadge = (item: PreviewItem): { text: string; colorClass: string } | null => {
    if ('status' in item) {
      const status = item.status;
      if (status === 'active') {
        return { text: '活跃', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      } else if (status === 'inactive') {
        return { text: '非活跃', colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
      } else if (status === 'expired') {
        return { text: '已过期', colorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400' };
      } else if (status === 'abnormal') {
        return { text: '异常', colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
      } else if (status === 'banned') {
        return { text: '封禁', colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      } else if (status === '正常') {
        return { text: '正常', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      } else if (status === '失效') {
        return { text: '失效', colorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400' };
      } else if (status === '到期') {
        return { text: '到期', colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
      }
    }
    if ('account_status' in item && item.account_status) {
      const status = item.account_status;
      if (status === '正常') {
        return { text: '正常', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      } else if (status === '异常') {
        return { text: '异常', colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
      } else if (status === '封禁') {
        return { text: '封禁', colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      } else if (status === '待验证') {
        return { text: '待验证', colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
      }
    }
    if ('certificate_status' in item && item.certificate_status) {
      const status = item.certificate_status;
      if (status === '正常') {
        return { text: '正常', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      } else if (status === '异常') {
        return { text: '异常', colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
      } else if (status === '到期') {
        return { text: '到期', colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
      }
    }
    return null;
  };

  const getCategoryBadge = (item: PreviewItem): string | null => {
    if ('category_name' in item && item.category_name) {
      return item.category_name;
    }
    if ('shop_type' in item && item.shop_type) {
      return item.shop_type;
    }
    return null;
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            {(() => {
              const statusBadge = getStatusBadge(item);
              const categoryBadge = getCategoryBadge(item);
              return (
                <>
                  {statusBadge && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge.colorClass}`}>
                      {statusBadge.text}
                    </span>
                  )}
                  {categoryBadge && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400">
                      {categoryBadge}
                    </span>
                  )}
                  {'url' in item && item.url && (
                    <button
                      onClick={() => openUrl(item.url)}
                      className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="打开网站"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="分享"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {('shop_name' in item) && (
            <>
              <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {renderField('店铺名称', (item as Shop).shop_name)}
                {renderField('平台', (item as Shop).platform)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('账号', (item as Shop).account, true)}
                {renderField('密码', (item as Shop).password, true)}
                {renderField('支付密码', (item as Shop).payment_password, true)}
                {renderField('手机号', (item as Shop).phone, true)}
                {renderField('邮箱', (item as Shop).email, true)}
                {renderField('公司名称', (item as Shop).corporation)}
                {renderField('支付宝账号', (item as Shop).alipay_account, true)}
                {renderField('支付宝密码', (item as Shop).alipay_password, true)}
                {renderField('联系人', (item as Shop).contact_person)}
                {renderField('基础保证金', (item as Shop).base_deposit)}
                {renderField('风险保证金', (item as Shop).risk_deposit)}
              </div>
              {(item as Shop).address && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('地址', (item as Shop).address)}
                </div>
              )}
              {(item as Shop).remark && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('备注', (item as Shop).remark, false, true)}
                </div>
              )}
            </>
          )}

          {('user_name' in item && 'platform' in item) && !('shop_name' in item) && (
            <>
              <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {renderField('用户名', (item as SocialAccount).user_name || (item as SocialAccount).account)}
                {renderField('平台', (item as SocialAccount).platform)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('账号', (item as SocialAccount).account, true)}
                {renderField('密码', (item as SocialAccount).password, true)}
                {renderField('邮箱', (item as SocialAccount).email, true)}
                {renderField('手机号', (item as SocialAccount).phone, true)}
                {renderField('绑定企业', (item as SocialAccount).bind_company)}
                {renderField('注册时间', (item as SocialAccount).register_time)}
              </div>
              {(item as SocialAccount).remark && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('备注', (item as SocialAccount).remark, false, true)}
                </div>
              )}
            </>
          )}

          {('email' in item && !('platform' in item) && !('shop_name' in item) && !('platform_name' in item)) && (
            <>
              <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {renderField('邮箱地址', (item as Email).email, true)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('密码', (item as Email).password, true)}
                {renderField('手机号', (item as Email).phone, true)}
                {renderField('验证信息', (item as Email).verification_info)}
              </div>
              {(item as Email).remark && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('备注', (item as Email).remark, false, true)}
                </div>
              )}
            </>
          )}

          {('phone_number' in item) && (
            <>
              <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {renderField('手机号', (item as Phone).phone_number, true)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('机主', (item as Phone).owner)}
                {renderField('运营商', (item as Phone).phone_operator)}
                {renderField('地区', (item as Phone).phone_region)}
              </div>
              {(item as Phone).remarks && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('备注', (item as Phone).remarks, false, true)}
                </div>
              )}
            </>
          )}

          {('name' in item && 'unified_social_credit_code' in item && !('shop_name' in item)) && (
            <>
              <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {renderField('企业名称', (item as Company).name)}
                {renderField('统一社会信用代码', (item as Company).unified_social_credit_code, true)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('法人', (item as Company).legal_person)}
                {renderField('成立日期', (item as Company).establishment_date)}
                {renderField('注册资本', (item as Company).registered_capital)}
              </div>
              {(item as Company).address && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('注册地址', (item as Company).address, false, true)}
                </div>
              )}
              {(item as Company).business_scope && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('经营范围', (item as Company).business_scope, false, true)}
                </div>
              )}
            </>
          )}

          {('certificate_name' in item) && (
            <>
              <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {renderField('证件名称', (item as Credential).certificate_name)}
                {renderField('身份证号', (item as Credential).id_card_number, true)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('性别', (item as Credential).gender)}
                {renderField('出生日期', (item as Credential).birth_date)}
                {renderField('开户银行', (item as Credential).bank_name)}
                {renderField('银行账号', (item as Credential).bank_account, true)}
                {renderField('手机号', (item as Credential).phone, true)}
              </div>
              {(item as Credential).id_card_address && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('身份证地址', (item as Credential).id_card_address)}
                </div>
              )}
              {(item as Credential).certificate_remark && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('备注', (item as Credential).certificate_remark, false, true)}
                </div>
              )}
            </>
          )}

          {('platform_name' in item && !('shop_name' in item)) && (
            <>
              <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {renderField('平台名称', (item as GeneralAccount).platform_name)}
                {renderUrlField('网站', (item as GeneralAccount).website)}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('账号', (item as GeneralAccount).account, true)}
                {renderField('密码', (item as GeneralAccount).password, true)}
                {renderField('邮箱', (item as GeneralAccount).email, true)}
                {renderField('手机号', (item as GeneralAccount).phone, true)}
                {renderField('注册日期', (item as GeneralAccount).registration_date)}
              </div>
              {(item as GeneralAccount).security_question && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('安全问题', (item as GeneralAccount).security_question, false, true)}
                </div>
              )}
              {(item as GeneralAccount).notes && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('备注', (item as GeneralAccount).notes, false, true)}
                </div>
              )}
            </>
          )}

          {('category_id' in item && 'username' in item && !('platform_name' in item) && !('shop_name' in item)) && (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {renderField('用户名', (item as WebsiteAccount).username, true)}
                {renderField('密码', (item as WebsiteAccount).password, true)}
                {renderField('邮箱', (item as WebsiteAccount).email, true)}
                {renderField('手机号', (item as WebsiteAccount).phone, true)}
                {renderField('日期', (item as WebsiteAccount).date)}
              </div>
              {(item as WebsiteAccount).security_question && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('安全问题', (item as WebsiteAccount).security_question, false, true)}
                </div>
              )}
              {(item as WebsiteAccount).notes && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {renderField('备注', (item as WebsiteAccount).notes, false, true)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;