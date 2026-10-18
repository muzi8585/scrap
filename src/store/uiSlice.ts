import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';

export type TabKey = 'dashboard' | 'stock' | 'payments' | 'expenses' | 'parties' | 'vehicles' | 'rates';

interface UiState {
  tab: TabKey;
  partyId: number | null;
}

const initialState: UiState = { tab: 'dashboard', partyId: null };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openTab(state, action: PayloadAction<TabKey>) {
      state.tab = action.payload;
      state.partyId = null;
    },
    openParty(state, action: PayloadAction<number>) {
      state.partyId = action.payload;
    },
    closeParty(state) {
      state.partyId = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => initialState);
  },
});

export const { openTab, openParty, closeParty } = uiSlice.actions;
export default uiSlice.reducer;
