export const apiService = {
  async getExchangeRates(): Promise<any> {
    const apiUrl = import.meta.env.VITE_EXCHANGE_API_URL || 'https://oiapi.net/api/Exchange';
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.code === 1) {
      return data;
    } else {
      throw new Error(data.message || '获取汇率数据失败');
    }
  }
};