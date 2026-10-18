import type { ReactElement } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { logout } from './store/authSlice';
import { closeParty, openParty, openTab } from './store/uiSlice';
import type { TabKey } from './store/uiSlice';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import StockEntries from './components/StockEntries';
import Payments from './components/Payments';
import Expenses from './components/Expenses';
import Parties from './components/Parties';
import PartyStatement from './components/PartyStatement';
import Vehicles from './components/Vehicles';
import Rates from './components/Rates';

const TABS: [TabKey, string][] = [
  ['dashboard', 'Dashboard'],
  ['stock', 'Stock In/Out'],
  ['payments', 'Payments'],
  ['expenses', 'Expenses'],
  ['parties', 'Parties'],
  ['vehicles', 'Vehicles'],
  ['rates', 'Rates'],
];

export default function App() {
  const dispatch = useAppDispatch();
  const loggedIn = useAppSelector((state) => state.auth.loggedIn);
  const tab = useAppSelector((state) => state.ui.tab);
  const partyId = useAppSelector((state) => state.ui.partyId);

  if (!loggedIn) return <Login />;

  const screens: Record<TabKey, ReactElement> = {
    dashboard: <Dashboard />,
    stock: <StockEntries />,
    payments: <Payments />,
    expenses: <Expenses />,
    parties: partyId ? (
      <PartyStatement id={partyId} onBack={() => dispatch(closeParty())} />
    ) : (
      <Parties onOpen={(id) => dispatch(openParty(id))} />
    ),
    vehicles: <Vehicles />,
    rates: <Rates />,
  };

  return (
    <div className="wrap">
      <div className="row">
        <h1>Scrap Business Manager</h1>
        <button className="btn sm" onClick={() => dispatch(logout())}>Log out</button>
      </div>
      <nav>
        {TABS.map(([key, label]) => (
          <button key={key} className={'tab' + (tab === key ? ' on' : '')} onClick={() => dispatch(openTab(key))}>
            {label}
          </button>
        ))}
      </nav>
      {screens[tab]}
    </div>
  );
}
