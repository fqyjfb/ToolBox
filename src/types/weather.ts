export interface WeatherData {
  code: number;
  message: string;
  data?: WeatherInfo;
}

export interface WeatherInfo {
  location: Location;
  weather: Weather;
  air_quality: AirQuality;
  sunrise: Sunrise;
  life_indices: LifeIndex[];
}

export interface Location {
  name: string;
  province: string;
  city: string;
  county: string;
}

export interface Weather {
  condition: string;
  condition_code: string;
  temperature: number;
  humidity: number;
  pressure: number;
  precipitation: number;
  wind_direction: string;
  wind_power: string;
  weather_icon: string;
  weather_colors: string[];
  updated: string;
  updated_at: number;
}

export interface AirQuality {
  aqi: number;
  level: number;
  quality: string;
  pm25: number;
  pm10: number;
  co: number;
  no2: number;
  o3: number;
  so2: number;
  rank: number;
  total_cities: number;
  updated: string;
  updated_at: number;
}

export interface Sunrise {
  sunrise: string;
  sunrise_at: number;
  sunrise_desc: string;
  sunset: string;
  sunset_at: number;
  sunset_desc: string;
}

export interface LifeIndex {
  key: string;
  name: string;
  level: string;
  description: string;
}

export interface ForecastData {
  code: number;
  message: string;
  data?: ForecastInfo;
}

export interface ForecastInfo {
  location: Location;
  daily_forecast: DailyForecast[];
  hourly_forecast: HourlyForecast[];
  sunrise_sunset: SunriseSunset[];
}

export interface DailyForecast {
  date: string;
  day_condition: string;
  day_condition_code: string;
  day_weather_icon: string;
  day_wind_direction: string;
  day_wind_power: string;
  night_condition: string;
  night_condition_code: string;
  night_weather_icon: string;
  night_wind_direction: string;
  night_wind_power: string;
  max_temperature: number;
  min_temperature: number;
  aqi: number;
  aqi_level: number;
  air_quality: string;
}

export interface HourlyForecast {
  datetime: string;
  condition: string;
  condition_code: string;
  temperature: number;
  weather_icon: string;
  wind_direction: string;
  wind_power: string;
}

export interface SunriseSunset {
  date: string;
  sunrise: string;
  sunrise_at: number;
  sunrise_desc: string;
  sunset: string;
  sunset_at: number;
  sunset_desc: string;
}