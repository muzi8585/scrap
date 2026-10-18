import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import uiReducer from './uiSlice';
import resourcesReducer from './resourcesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    resources: resourcesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
