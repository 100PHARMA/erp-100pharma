// src/app/(admin)/quilometragem/page.tsx
import QuilometragemClient from './quilometragem-client';

export const dynamic = 'force-dynamic';

function currentYYYYMM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default async function QuilometragemAdminPage() {
  // Autenticação e role (ADMIN) são garantidos pelo layout: src/app/(admin)/layout.tsx
  // Não duplicar guards aqui — isso estava causando redirects para /login?next=...
  return <QuilometragemClient initialMes={currentYYYYMM()} />;
}
