import { FormEvent, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login } from '../store/authSlice';
import Field from './common/Field';

export default function Login() {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((state) => state.auth.loading);
  const error = useAppSelector((state) => state.auth.error);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    dispatch(login({ email, password }));
  };

  return (
    <div className="wrap" style={{ maxWidth: 380 }}>
      <form className="card" onSubmit={submit}>
        <h1>Scrap Business Manager</h1>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="bad">{error}</p>}
        <button className="btn pri" type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
