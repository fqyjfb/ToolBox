import { Sun, Cloud, CloudSun, CloudRain, CloudSnow } from 'lucide-react';

/** 按天气文案返回对应图标（天气卡片 / 头部天气入口 / 预报列表共用） */
export const getWeatherIcon = (condition: string, size: 'sm' | 'md' | 'lg' = 'md', color?: string) => {
  const lowerCondition = condition.toLowerCase();
  const sizeClasses = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  const defaultColors = {
    sunny: color || 'text-yellow-500',
    cloudy: color || 'text-yellow-500',
    rainy: color || 'text-blue-500',
    snowy: color || 'text-blue-300',
    default: color || 'text-gray-500',
  };

  if (lowerCondition.includes('晴')) return <Sun className={`${sizeClasses[size]} ${defaultColors.sunny}`} />;
  if (lowerCondition.includes('多云')) return <CloudSun className={`${sizeClasses[size]} ${defaultColors.cloudy}`} />;
  if (lowerCondition.includes('雨')) return <CloudRain className={`${sizeClasses[size]} ${defaultColors.rainy}`} />;
  if (lowerCondition.includes('雪')) return <CloudSnow className={`${sizeClasses[size]} ${defaultColors.snowy}`} />;
  return <Cloud className={`${sizeClasses[size]} ${defaultColors.default}`} />;
};
