import axios, { type AxiosInstance } from 'axios';
import type {
  ChangePasswordRequest,
  CreateDiaryRequest,
  CreateMemoRequest,
  Diary,
  LoginResponse,
  Memo,
  PaginatedResponse,
  Resource,
  UpdateMemoRequest
} from '../types/api';

class APIClient {
  private axiosInstance: AxiosInstance;
  private baseURL: string = '';

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });

    this.loadConfig();
  }

  loadConfig() {
    const token = localStorage.getItem('access_token');
    const baseURL = localStorage.getItem('api_base_url');

    if (baseURL) {
      this.baseURL = baseURL;
    }

    if (token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.refreshToken();
        }
        return Promise.reject(error);
      }
    );
  }

  async setBaseURL(url: string) {
    this.baseURL = url;
    localStorage.setItem('api_base_url', url);
  }

  async setToken(token: string) {
    localStorage.setItem('access_token', token);
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async clearAuth() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('api_base_url');
    this.axiosInstance.defaults.headers.common['Authorization'] = undefined;
    this.baseURL = '';
  }

  async login(serverUrl: string, username: string, password: string): Promise<LoginResponse> {
    const response = await axios.post<LoginResponse>(
      `${serverUrl}/api/auth/login`,
      { username, password }
    );

    await this.setBaseURL(serverUrl);
    await this.setToken(response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);

    return response.data;
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await axios.post<LoginResponse>(
      `${this.baseURL}/api/auth/refresh`,
      { refresh_token: refreshToken }
    );

    await this.setToken(response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await this.axiosInstance.post(`${this.baseURL}/api/auth/change-password`, data);
  }

  async getCurrentUser() {
    const response = await this.axiosInstance.get(`${this.baseURL}/api/auth/me`);
    return response.data;
  }

  async getMemos(params?: { page?: number; page_size?: number; search?: string }): Promise<PaginatedResponse<Memo>> {
    const response = await this.axiosInstance.get<PaginatedResponse<Memo>>(
      `${this.baseURL}/api/memos`,
      { params }
    );
    return response.data;
  }

  async getMemo(id: string): Promise<Memo> {
    const response = await this.axiosInstance.get<Memo>(`${this.baseURL}/api/memos/${id}`);
    return response.data;
  }

  async createMemo(data: CreateMemoRequest): Promise<Memo> {
    const response = await this.axiosInstance.post<Memo>(`${this.baseURL}/api/memos`, data);
    return response.data;
  }

  async updateMemo(id: string, data: UpdateMemoRequest): Promise<Memo> {
    const response = await this.axiosInstance.put<Memo>(`${this.baseURL}/api/memos/${id}`, data);
    return response.data;
  }

  async deleteMemo(id: string): Promise<void> {
    await this.axiosInstance.delete(`${this.baseURL}/api/memos/${id}`);
  }

  async toggleArchiveMemo(id: string): Promise<Memo> {
    const response = await this.axiosInstance.post<Memo>(`${this.baseURL}/api/memos/${id}/archive`);
    return response.data;
  }

  async getResources(params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<Resource>> {
    const response = await this.axiosInstance.get<PaginatedResponse<Resource>>(
      `${this.baseURL}/api/resources`,
      { params }
    );
    return response.data;
  }

  async uploadResource(file: File, memoId?: string): Promise<Resource> {
    const formData = new FormData();
    formData.append('file', file);
    if (memoId) {
      formData.append('memo_id', memoId);
    }

    const response = await this.axiosInstance.post<Resource>(
      `${this.baseURL}/api/resources/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async getResource(id: string): Promise<Resource> {
    const response = await this.axiosInstance.get<Resource>(`${this.baseURL}/api/resources/${id}`);
    return response.data;
  }

  async deleteResource(id: string): Promise<void> {
    await this.axiosInstance.delete(`${this.baseURL}/api/resources/${id}`);
  }

  async getDiaries(params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<Diary>> {
    const response = await this.axiosInstance.get<PaginatedResponse<Diary>>(
      `${this.baseURL}/api/diaries`,
      { params }
    );
    return response.data;
  }

  async getDiary(date: string): Promise<Diary> {
    const response = await this.axiosInstance.get<Diary>(`${this.baseURL}/api/diaries/${date}`);
    return response.data;
  }

  async createOrUpdateDiary(data: CreateDiaryRequest): Promise<Diary> {
    const response = await this.axiosInstance.post<Diary>(`${this.baseURL}/api/diaries`, data);
    return response.data;
  }
}

export const apiClient = new APIClient();
