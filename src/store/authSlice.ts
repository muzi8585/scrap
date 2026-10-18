import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../api';

interface AuthState {
  loggedIn: boolean;
  loading: boolean;
  error: string;
}

interface Credentials {
  email: string;
  password: string;
}

const initialState: AuthState = {
  loggedIn: Boolean(localStorage.getItem('token')),
  loading: false,
  error: '',
};

export const login = createAsyncThunk<void, Credentials, { rejectValue: string }>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const result = await api.post<{ token: string }>('/login', credentials);
      localStorage.setItem('token', result.token);
    } catch (e) {
      return rejectWithValue((e as Error).message);
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await api.post('/logout');
  } catch {
    // the token is removed below even if the server call fails
  }
  localStorage.removeItem('token');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = '';
      })
      .addCase(login.fulfilled, (state) => {
        state.loading = false;
        state.loggedIn = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error.message ?? 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.loggedIn = false;
      });
  },
});

export default authSlice.reducer;
