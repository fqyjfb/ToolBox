import React, { useState, useEffect, useMemo } from 'react';
import { Clock, RefreshCw, ArrowRightLeft, Search } from 'lucide-react';
import { apiService } from '../../../services/api';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

interface RateItem {
  currency: string;
  rate: number;
}

const ExchangePage: React.FC = () => {
  const [exchangeData, setExchangeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updateTime, setUpdateTime] = useState('');
  const [fromCurrency, setFromCurrency] = useState('CNY');
  const [toCurrency, setToCurrency] = useState('USD');
  const [fromAmount, setFromAmount] = useState(100);
  const [toAmount, setToAmount] = useState(0);
  const [searchCurrency, setSearchCurrency] = useState('');

  const currencyNames: Record<string, string> = {
    USD: '美元', CNY: '人民币', EUR: '欧元', GBP: '英镑', JPY: '日元', KRW: '韩元',
    HKD: '港币', AUD: '澳元', CAD: '加元', SGD: '新加坡元', CHF: '瑞士法郎',
    SEK: '瑞典克朗', NOK: '挪威克朗', DKK: '丹麦克朗', RUB: '俄罗斯卢布',
    INR: '印度卢比', THB: '泰铢', MYR: '马来西亚林吉特', PHP: '菲律宾比索',
    IDR: '印尼盾', VND: '越南盾', MOP: '澳门币', TWD: '新台币', NZD: '新西兰元',
    AED: '阿联酋迪拉姆', SAR: '沙特里亚尔', QAR: '卡塔尔里亚尔', KWD: '科威特第纳尔',
    BHD: '巴林第纳尔', OMR: '阿曼里亚尔', JOD: '约旦第纳尔', ILS: '以色列新谢克尔',
    EGP: '埃及镑', ZAR: '南非兰特', BRL: '巴西雷亚尔', MXN: '墨西哥比索',
    ARS: '阿根廷比索', CLP: '智利比索', COP: '哥伦比亚比索', PEN: '秘鲁新索尔',
    AFN: '阿富汗尼', ALL: '阿尔巴尼亚列克', AMD: '亚美尼亚德拉姆', ANG: '荷属安的列斯盾',
    AOA: '安哥拉宽扎', AWG: '阿鲁巴弗罗林', AZN: '阿塞拜疆马纳特', BAM: '波斯尼亚可兑换马克',
    BBD: '巴巴多斯元', BDT: '孟加拉塔卡', BGN: '保加利亚列弗', BIF: '布隆迪法郎',
    BMD: '百慕大元', BND: '文莱元', BOB: '玻利维亚诺', BSD: '巴哈马元',
    BTN: '不丹努尔特鲁姆', BWP: '博茨瓦纳普拉', BYN: '白俄罗斯卢布', BZD: '伯利兹元',
    CDF: '刚果法郎', CLF: '智利比索(单位)', CNH: '离岸人民币', CRC: '哥斯达黎加科朗',
    CUP: '古巴比索', CVE: '佛得角埃斯库多', CZK: '捷克克朗', DJF: '吉布提法郎',
    DOP: '多米尼加比索', DZD: '阿尔及利亚第纳尔', ERN: '厄立特里亚纳克法', ETB: '埃塞俄比亚比尔',
    FJD: '斐济元', FKP: '福克兰群岛镑', FOK: '法罗群岛克朗', GEL: '格鲁吉亚拉里',
    GGP: '根西岛镑', GHS: '加纳塞地', GIP: '直布罗陀镑', GMD: '冈比亚达拉西',
    GNF: '几内亚法郎', GTQ: '危地马拉格查尔', GYD: '圭亚那元', HNL: '洪都拉斯伦皮拉',
    HRK: '克罗地亚库纳', HTG: '海地古德', HUF: '匈牙利福林', IMP: '马恩岛镑',
    IQD: '伊拉克第纳尔', IRR: '伊朗里亚尔', ISK: '冰岛克朗', JEP: '泽西岛镑',
    JMD: '牙买加元', KES: '肯尼亚先令', KGS: '吉尔吉斯斯坦索姆', KHR: '柬埔寨瑞尔',
    KID: '基里巴斯元', KMF: '科摩罗法郎', KYD: '开曼群岛元', KZT: '哈萨克斯坦坚戈',
    LAK: '老挝基普', LBP: '黎巴嫩镑', LKR: '斯里兰卡卢比', LRD: '利比里亚元',
    LSL: '莱索托洛蒂', LYD: '利比亚第纳尔', MAD: '摩洛哥迪拉姆', MDL: '摩尔多瓦列伊',
    MGA: '马达加斯加阿里亚里', MKD: '北马其顿第纳尔', MMK: '缅甸缅元', MNT: '蒙古图格里克',
    MRU: '毛里塔尼亚乌吉亚', MUR: '毛里求斯卢比', MVR: '马尔代夫拉菲亚', MWK: '马拉维克瓦查',
    MZN: '莫桑比克梅蒂卡尔', NAD: '纳米比亚元', NGN: '尼日利亚奈拉', NIO: '尼加拉瓜科多巴',
    NPR: '尼泊尔卢比', PAB: '巴拿马巴波亚', PGK: '巴布亚新几内亚基那', PKR: '巴基斯坦卢比',
    PLN: '波兰兹罗提', PYG: '巴拉圭瓜拉尼', RON: '罗马尼亚列伊', RSD: '塞尔维亚第纳尔',
    RWF: '卢旺达法郎', SBD: '所罗门群岛元', SCR: '塞舌尔卢比', SDG: '苏丹镑',
    SLE: '塞拉利昂利昂', SLL: '塞拉利昂利昂(旧)', SOS: '索马里先令', SRD: '苏里南元',
    SSP: '南苏丹镑', STN: '圣多美和普林西比多布拉', SYP: '叙利亚镑', SZL: '斯威士兰里兰吉尼',
    TJS: '塔吉克斯坦索莫尼', TMT: '土库曼斯坦马纳特', TND: '突尼斯第纳尔', TOP: '汤加潘加',
    TRY: '土耳其里拉', TTD: '特立尼达和多巴哥元', TVD: '图瓦卢元', TZS: '坦桑尼亚先令',
    UAH: '乌克兰格里夫纳', UGX: '乌干达先令', UYU: '乌拉圭比索', UZS: '乌兹别克斯坦苏姆',
    VES: '委内瑞拉玻利瓦尔', VUV: '瓦努阿图瓦图', WST: '萨摩亚塔拉', XAF: '中非法郎',
    XCD: '东加勒比元', XCG: '加勒比荷兰盾', XDR: '特别提款权', XOF: '西非法郎',
    XPF: '太平洋法郎', YER: '也门里亚尔', ZMW: '赞比亚克瓦查', ZWG: '津巴布韦元(旧)',
    ZWL: '津巴布韦元'
  };

  const commonCurrencies = ['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'AUD', 'CAD', 'SGD', 'KRW'];

  const currencyOptions = useMemo(() => {
    return Object.keys(currencyNames).map(code => ({
      label: currencyNames[code],
      value: code
    }));
  }, []);

  const getRatesBasedOnBase = (): Record<string, number> => {
    if (!exchangeData?.data?.rates) return {};
    
    const ratesArray = exchangeData.data.rates;
    const rates: Record<string, number> = {};
    ratesArray.forEach((item: RateItem) => {
      rates[item.currency] = item.rate;
    });
    
    const currentBase = fromCurrency;
    const baseRate = rates[currentBase];
    
    if (!baseRate) return rates;
    
    const convertedRates: Record<string, number> = {};
    Object.keys(rates).forEach(code => {
      convertedRates[code] = rates[code] / baseRate;
    });
    
    return convertedRates;
  };

  const commonRates = useMemo(() => {
    const rates = getRatesBasedOnBase();
    if (!rates) return {};
    
    const result: Record<string, number> = {};
    commonCurrencies.forEach(code => {
      if (rates[code]) {
        result[code] = rates[code];
      }
    });
    return result;
  }, [exchangeData, fromCurrency]);

  const filteredRates = useMemo(() => {
    const rates = getRatesBasedOnBase();
    if (!rates) return {};
    
    if (!searchCurrency) return rates;
    
    const search = searchCurrency.toUpperCase();
    const filtered: Record<string, number> = {};
    
    Object.keys(rates).forEach(code => {
      if (code.includes(search) || currencyNames[code]?.toUpperCase().includes(search)) {
        filtered[code] = rates[code];
      }
    });
    
    return filtered;
  }, [exchangeData, fromCurrency, searchCurrency]);

  const getCurrencyName = (code: string): string => {
    return currencyNames[code] || code;
  };

  const getExchangeRate = (_from: string, to: string): number => {
    const rates = getRatesBasedOnBase();
    if (!rates) return 0;
    return rates[to] || 0;
  };

  const calculateExchange = () => {
    const rate = getExchangeRate(fromCurrency, toCurrency);
    setToAmount(Number((fromAmount * rate).toFixed(2)));
  };

  const swapCurrencies = () => {
    const tempCurrency = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(tempCurrency);
    setFromAmount(toAmount);
  };

  const formatRate = (rate: number): string => {
    return rate.toFixed(4);
  };

  const refreshExchange = async () => {
    await fetchExchangeData();
    calculateExchange();
  };

  const fetchExchangeData = async () => {
    setLoading(true);
    try {
      const data = await apiService.getExchangeRates();
      if (data.code === 200) {
        setExchangeData(data);
        setUpdateTime(data.data.updated || new Date().toLocaleString('zh-CN'));
      }
    } catch (error) {
      console.error('获取汇率数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeData();
  }, []);

  useEffect(() => {
    calculateExchange();
  }, [exchangeData, fromCurrency, toCurrency, fromAmount]);

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex justify-end items-center mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
              <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>{updateTime}</span>
            </div>
            <button
              onClick={refreshExchange}
              disabled={loading}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md transition-all duration-300 disabled:opacity-50 text-xs"
            >
              {loading ? (
                <LoadingSpinner size="xs" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center mb-1.5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">汇率计算器</h2>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                1 {getCurrencyName(fromCurrency)} = {getExchangeRate(fromCurrency, toCurrency)} {getCurrencyName(toCurrency)}
              </div>
            </div>
          
            <div className="flex flex-wrap items-end gap-1.5">
              <div className="flex flex-col gap-0.5 min-w-[100px] flex-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">从</label>
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                  className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-xs"
                >
                  {currencyOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col gap-0.5 min-w-[100px] flex-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">金额</label>
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(Number(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-center p-0.5">
                <button
                  onClick={swapCurrencies}
                  className="p-1 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>

              <div className="flex flex-col gap-0.5 min-w-[100px] flex-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">到</label>
                <select
                  value={toCurrency}
                  onChange={(e) => setToCurrency(e.target.value)}
                  className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-xs"
                >
                  {currencyOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col gap-0.5 min-w-[100px] flex-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">结果</label>
                <input
                  type="number"
                  value={toAmount}
                  readOnly
                  className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none text-xs"
                />
              </div>
            </div>
            </div>
        )}

        {!loading && exchangeData && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-600">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">常用汇率 (基于 {fromCurrency})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
            {Object.entries(commonRates).map(([code, rate]) => (
              <div key={code} className="bg-white dark:bg-gray-800 p-1.5 rounded-md border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-200">
                <div className="flex flex-col gap-0.25">
                  <div className="font-semibold text-gray-900 dark:text-white text-xs">{code}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{getCurrencyName(code)}</div>
                </div>
                <div className="mt-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 font-mono">
                  {formatRate(rate)}
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        {!loading && exchangeData && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 max-h-[300px] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1.5 gap-1.5 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">完整汇率数据 (1 {fromCurrency} =)</h2>
              <div className="w-full sm:w-56">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="text"
                    value={searchCurrency}
                    onChange={(e) => setSearchCurrency(e.target.value)}
                    placeholder="搜索货币..."
                    className="pl-8 pr-2 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-500 w-16">货币</th>
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-500">名称</th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-500 w-24">汇率</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(filteredRates).map(([code, rate]) => (
                    <tr 
                      key={code} 
                      className={`${(code === fromCurrency || code === toCurrency) ? 'bg-blue-50 dark:bg-blue-900/30' : ''} hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors`}
                    >
                      <td className="px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-500">{code}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-500">{getCurrencyName(code)}</td>
                      <td className="px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border-b border-gray-200 dark:border-gray-500 text-right font-mono">
                        {formatRate(rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExchangePage;