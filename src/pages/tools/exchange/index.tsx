import React, { useState, useEffect, useMemo } from 'react';
import { Clock, RefreshCw, ArrowRightLeft, Search } from 'lucide-react';
import { apiService } from '../../../services/api';
import LoadingSpinner from '../../../components/LoadingSpinner';

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
    ARS: '阿根廷比索', CLP: '智利比索', COP: '哥伦比亚比索', PEN: '秘鲁新索尔'
  };

  const commonCurrencies = ['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'AUD', 'CAD', 'SGD', 'KRW'];

  const currencyOptions = useMemo(() => {
    return Object.keys(currencyNames).map(code => ({
      label: currencyNames[code],
      value: code
    }));
  }, []);

  const getRatesBasedOnBase = (): Record<string, number> => {
    if (!exchangeData?.data?.exchange) return {};
    
    const rates = exchangeData.data.exchange;
    const currentBase = fromCurrency;
    
    if (currentBase === 'USD') {
      return rates;
    }
    
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
      if (data.code === 1) {
        setExchangeData(data);
        setUpdateTime(new Date().toLocaleString('zh-CN'));
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
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1.5 gap-1.5">
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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-600">
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