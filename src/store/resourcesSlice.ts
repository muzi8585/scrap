import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../api';
import { logout } from './authSlice';

interface ResourceEntry {
  data: unknown;
  error: string;
  loading: boolean;
}

// One entry per API path, e.g. state.resources['/parties']
type ResourcesState = Record<string, ResourceEntry>;

const initialState: ResourcesState = {};

export const fetchResource = createAsyncThunk<unknown, string, { rejectValue: string }>(
  'resources/fetch',
  async (path, { rejectWithValue }) => {
    try {
      return await api.get<unknown>(path);
    } catch (e) {
      return rejectWithValue((e as Error).message);
    }
  }
);

function entryFor(state: ResourcesState, path: string): ResourceEntry {
  if (!state[path]) state[path] = { data: null, error: '', loading: false };
  return state[path];
}

const resourcesSlice = createSlice({
  name: 'resources',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchResource.pending, (state, action) => {
        entryFor(state, action.meta.arg).loading = true;
      })
      .addCase(fetchResource.fulfilled, (state, action) => {
        const entry = entryFor(state, action.meta.arg);
        entry.data = action.payload;
        entry.error = '';
        entry.loading = false;
      })
      .addCase(fetchResource.rejected, (state, action) => {
        const entry = entryFor(state, action.meta.arg);
        entry.error = action.payload ?? action.error.message ?? 'Something went wrong';
        entry.loading = false;
      })
      .addCase(logout.fulfilled, () => initialState);
  },
});

export default resourcesSlice.reducer;
