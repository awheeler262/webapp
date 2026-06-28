// Shared TypeScript types used by both frontend and backend
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
