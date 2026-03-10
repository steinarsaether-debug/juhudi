export type AlertLevel = 'CRITICAL' | 'WARNING' | 'ADVISORY';

export interface WeatherAlert {
  level: AlertLevel;
  title: string;
  body: string;
  day: string | null;
}

export interface DayForecast {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  precipMm: number;
  precipProbability: number;
  windSpeedKmh: number;
  gustKmh: number;
  et0Mm: number;
  sunshineDurationHrs: number;
  uvIndex: number;
  weatherCode: number;
  description: string;
  alertLevel: AlertLevel | null;
}

export interface BranchWeatherResponse {
  branchId: string;
  branchName: string;
  county: string;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  alerts: WeatherAlert[];
  today: DayForecast;
  forecast: DayForecast[];
}
