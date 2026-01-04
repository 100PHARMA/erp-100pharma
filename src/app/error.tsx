'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('APP ERROR:', error);
  }, [error]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Erro na aplicação</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {String(error?.message || error)}
        {error?.digest ? `\nDigest: ${error.digest}` : ''}
      </pre>
      <button onClick={() => reset()} style={{ marginTop: 12 }}>
        Tentar novamente
      </button>
    </div>
  );
}
