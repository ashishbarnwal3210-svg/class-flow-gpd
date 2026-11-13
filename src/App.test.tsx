import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
vi.mock('./lib/supabase', () => ({
  backendConfigured: false,
  supabase: null,
  requireBackend: () => { throw new Error('Supabase is intentionally disabled in shell tests.'); },
}));

import App from './App';

afterEach(() => cleanup());

function renderApp(path='/') {
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App/></MemoryRouter></QueryClientProvider>);
}

describe('ClassFlow application shell',()=>{
  it('renders the welcome experience and backend setup state without credentials',()=>{
    renderApp('/');
    expect(screen.getByRole('heading',{name:/Your academic\s*life, in flow/i})).toBeInTheDocument();
    expect(screen.getByText(/Connect your ClassFlow backend/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link',{name:/Library/i}).length).toBeGreaterThan(0);
  });
  it('renders a clear sign-in state while Supabase is not configured',()=>{
    renderApp('/auth');
    expect(screen.getByRole('heading',{name:/Welcome back/i})).toBeInTheDocument();
    expect(screen.getByText(/Authentication is not configured yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ID or username/i)).toBeInTheDocument();
  });
  it('keeps signup limited to name, username and password',()=>{
    renderApp('/auth?mode=signup');
    expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Email|Student ID|Branch|Semester/i)).not.toBeInTheDocument();
  });
});
