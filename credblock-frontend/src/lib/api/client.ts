import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})
