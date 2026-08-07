import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { BrowserRouter } from 'react-router-dom';
import { trpc } from './trpc.js';
import App from './App.js';
import './index.css';

// Every mutation in this app explicitly invalidates the queries it affects
// on success, so data only needs to refetch when we say so — not on every
// remount/refocus. That's what makes swapping the Timeline's sizing key
// (a fresh useQuery observer each time, since it's keyed by the selected
// id) read from cache with zero network calls instead of silently
// revalidating in the background on every switch.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  },
});
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: '/trpc' })],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
