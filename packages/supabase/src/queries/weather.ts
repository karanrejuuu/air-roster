import { useQuery } from '@tanstack/react-query'
import { supabase } from '../client'
import { demoWeather, shouldUseDemoData } from '../demoData'
import { type WeatherCache } from '../types'

export const weatherKeys = {
  airports: (codes: string[]) => ['weather', codes.join(',')] as const
}

export function useWeather(codes: string[]) {
  return useQuery({
    enabled: codes.length > 0,
    queryFn: async () => {
      if (shouldUseDemoData()) return demoWeather.filter((item) => codes.includes(item.airport_iata))
      const { data, error } = await supabase.from('weather_cache').select('*').in('airport_iata', codes)
      if (error) throw error
      return (data ?? []) as WeatherCache[]
    },
    queryKey: weatherKeys.airports(codes)
  })
}
