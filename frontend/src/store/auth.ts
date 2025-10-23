import { create } from 'zustand';
import { api } from '@/lib/api';

type Role = 'ADMIN' | 'MANAGER';
type User = { id: number; name: string; role: Role };

type State = {
  user?: User;
  token?: string;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
};

export const useAuth = create<State>((set) => ({
  user: undefined,
  token: undefined,
  async login(login, password) {
    const { data } = await api.post('/auth/login', { login, password });
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user });
  },
  logout() {
    localStorage.removeItem('token');
    set({ token: undefined, user: undefined });
  },
}));