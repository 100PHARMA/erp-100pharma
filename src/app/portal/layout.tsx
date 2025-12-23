export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-500">Portal do Vendedor</div>
            <div className="text-2xl font-bold text-gray-900">Dashboard</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
