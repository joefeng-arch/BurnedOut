const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:54321/functions/v1';

export const getDeviceId = () => {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => (Math.random()*16|0).toString(16));
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Device-ID': getDeviceId(),
});

export const api = {
  registerUser: async (locale: string, region: string) => {
    try {
      // Edge Function: users-register (not users/register)
      const res = await fetch(`${API_BASE_URL}/users-register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ device_id: getDeviceId(), locale, region }),
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable, using mock data for registerUser');
      return { id: 'mock-id', device_id: getDeviceId(), locale, region, created_at: new Date().toISOString() };
    }
  },

  getTodayCheckIn: async () => {
    try {
      // Edge Function: check-ins (sub-path /today handled internally)
      const res = await fetch(`${API_BASE_URL}/check-ins/today`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Not checked in');
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable or not checked in, using mock data');
      throw e; // Let the caller handle it (means not checked in)
    }
  },

  createCheckIn: async (level: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/check-ins`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ level }),
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable, using mock data for createCheckIn');
      return { id: 'mock-id', level, date: new Date().toISOString().split('T')[0] };
    }
  },

  getGlobalStats: async () => {
    try {
      // Edge Function: dashboard-global (not dashboard/global)
      const res = await fetch(`${API_BASE_URL}/dashboard-global`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable, using mock data for getGlobalStats');
      return {
        total_users: 12580,
        today_check_ins: 3842,
        today_vents: 1567,
        avg_level: 3.2,
        level_distribution: { "1": 384, "2": 692, "3": 1153, "4": 998, "5": 615 },
        updated_at: new Date().toISOString()
      };
    }
  },

  getCheckInHistory: async (limit = 30) => {
    try {
      const res = await fetch(`${API_BASE_URL}/check-ins/history?limit=${limit}&offset=0`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable, using mock data for getCheckInHistory');
      return { data: [], total: 0, limit, offset: 0 };
    }
  },

  createVent: async (char_count: number, locale: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/vents?locale=${locale}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ char_count }),
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch (e) {
      console.warn('Backend not reachable, using mock data for createVent');
      const mockQuips = locale === 'zh-CN'
        ? ["你的愤怒已被宇宙回收", "骂得好，明天继续", "今天有 12 万人和你一起骂过了", "已销毁。没人看到，包括我们", "发泄完了？喝水去吧"]
        : ["Your rage has been recycled by the universe", "Well ranted. See you tomorrow.", "120K people screamed with you today", "Destroyed. Nobody saw it. Not even us.", "Done? Now go drink some water."];
      return {
        id: 'mock-id',
        char_count,
        quip: mockQuips[Math.floor(Math.random() * mockQuips.length)],
        created_at: new Date().toISOString()
      };
    }
  }
};
