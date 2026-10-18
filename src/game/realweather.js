// Optional real-world weather: with Settings > Play > "Use my real weather" on, your lake's weather
// follows the weather where you are (Open-Meteo, no key needed; your browser asks before sharing your
// location, and only rough coordinates are sent). Off by default; everyone else keeps the shared sky.
import { setDebugWeather } from '../core/clock.js';

/** Pure: Open-Meteo WMO weather code -> the game's weather. */
export function mapWeatherCode(code) {
  const c = Number(code);
  if ([95, 96, 99].includes(c)) return 'storm';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 71 && c <= 77) || (c >= 85 && c <= 86)) return 'rain';
  if ([2, 3, 45, 48].includes(c)) return 'overcast';
  return 'clear';
}

export class RealWeather {
  constructor(game) { this.game = game; this.on = false; this.weather = null; }

  async enable() {
    const g = this.game;
    try {
      const pos = await new Promise((res, rej) => {
        if (!navigator.geolocation) { rej(new Error('no location')); return; }
        navigator.geolocation.getCurrentPosition(res, rej, { maximumAge: 3600000, timeout: 15000 });
      });
      this.lat = Math.round(pos.coords.latitude * 10) / 10;
      this.lon = Math.round(pos.coords.longitude * 10) / 10;
      await this.refresh();
      this.on = true;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.refresh().catch(() => {}), 30 * 60000);
      g.ui.toast(`Real weather on: it's ${this.weather} where you are.`, { icon: 'cloud' });
      return true;
    } catch (e) {
      this.disable();
      g.ui.toast(`Couldn't get your local weather (${e.message || 'blocked'}). The lake keeps its own sky.`);
      return false;
    }
  }

  async refresh() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lon}&current=weather_code`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`weather service ${res.status}`);
    const j = await res.json();
    this.weather = mapWeatherCode(j?.current?.weather_code);
    setDebugWeather(this.weather);
  }

  disable() { this.on = false; clearInterval(this.timer); setDebugWeather(null); }
}
