import React, { useState, useMemo } from 'react';
import { Copy, Check, Phone, Globe } from 'lucide-react';
import { useNavSearch } from '../contexts/NavSearchContext';
import { countryCodes, regions, CountryCode } from '../data/countryCodes';

const CountryCodeSearch: React.FC = () => {
  const { searchQuery, clearSearch } = useNavSearch();
  const [selectedRegion, setSelectedRegion] = useState<string>('全部');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
          item.code.toLowerCase().includes(query) ||
          item.region.toLowerCase().includes(query)
      );
      clearSearch();
    }

    return result;
  }, [searchQuery, selectedRegion, clearSearch]);

  const handleCopy = async (code: string, id: string) => {
    const cleanCode = code.split(',')[0].trim();
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const regionColors: Record<string, string> = {
    亚洲: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    欧洲: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    非洲: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    北美洲: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    南美洲: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    大洋洲: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <div className="p-6 h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Phone className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">国家区号查询</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">快速查找全球各国/地区的电话区号</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {regions.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedRegion === region
                  ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800 shadow-md'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Globe size={14} />
                {region}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">国家/地区</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">电话区号</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">所属区域</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.length > 0 ? (
                filteredCodes.map((item: CountryCode, index: number) => (
                  <tr
                    key={`${item.country}-${item.code}-${index}`}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">{item.country}</div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-blue-600 dark:text-blue-400">
                        {item.code}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${regionColors[item.region]}`}>
                        {item.region}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleCopy(item.code, `${item.country}-${index}`)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          copiedId === `${item.country}-${index}`
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {copiedId === `${item.country}-${index}` ? (
                          <>
                            <Check size={14} />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            复制
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Globe className="w-12 h-12 opacity-50" />
                      <p>未找到匹配的国家/地区</p>
                      <p className="text-sm">请尝试其他搜索关键词或选择其他区域</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredCodes.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              共找到 <span className="font-medium text-gray-700 dark:text-gray-300">{filteredCodes.length}</span> 个国家/地区
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryCodeSearch;