// src/app/(admin)/layout.tsx
import NavbarGate from "@/components/custom/navbar-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavbarGate />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </>
  );
}
