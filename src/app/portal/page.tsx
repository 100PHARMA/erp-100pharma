import LogoutButton from '@/components/auth/LogoutButton';

export const dynamic = 'force-dynamic';

export default function PortalHome() {
  return (
    <div style={{ padding: 24 }}>
      <div>PORTAL (SSR OK)</div>
      <div style={{ marginTop: 12 }}>
        <LogoutButton />
      </div>
    </div>
  );
}
