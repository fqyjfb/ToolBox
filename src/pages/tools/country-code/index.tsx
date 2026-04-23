import React, { useState, useMemo } from 'react';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import { countryCodes, regions, CountryCode } from '../../../data/countryCodes';

const CountryCodePage: React.FC = () => {
  const { searchQuery } = useNavSearch();
  const [selectedRegion, setSelectedRegion] = useState<string>('全部');

  const filteredCodes = useMemo(() => {
    let result = countryCodes;

    if (selectedRegion !== '全部') {
      result = result.filter(item => item.region === selectedRegion);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.country.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query)
      );
    }

    return result;
  }, [searchQuery, selectedRegion]);

  const regionColors: Record<string, string> = {
    亚洲: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    欧洲: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    非洲: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    北美洲: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    南美洲: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    大洋洲: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };

  const handleCopy = async (code: string) => {
    const cleanCode = code.split(',')[0].trim();
    try {
      await navigator.clipboard.writeText(cleanCode);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="mb-3">
        <div className="flex flex-wrap gap-1.5">
          {regions.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedRegion === region
                  ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800 shadow-sm'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col min-h-0">
        <table className="w-full flex-shrink-0">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">国家/地区</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">电话区号</th>
            </tr>
          </thead>
        </table>
        
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <tbody>
              {filteredCodes.length > 0 ? (
                filteredCodes.map((item: CountryCode, index: number) => (
                  <tr
                    key={`${item.country}-${item.code}-${index}`}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleCopy(item.code)}
                  >
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-900 dark:text-white">{item.country}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${regionColors[item.region]}`}>
                          {item.region}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3">
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-blue-600 dark:text-blue-400">
                        {item.code}
                      </code>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <p className="text-xs">未找到匹配的国家/地区</p>
                    <p className="text-[10px] mt-1">请尝试其他搜索关键词或选择其他区域</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredCodes.length > 0 && (
          <div className="flex-shrink-0 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              共找到 <span className="font-medium text-gray-700 dark:text-gray-300">{filteredCodes.length}</span> 个国家/地区，点击行复制区号
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryCodePage;