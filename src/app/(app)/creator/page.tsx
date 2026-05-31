import { LayoutDashboard } from 'lucide-react';

export const metadata = { title: 'Creator Dashboard' };

export default function CreatorDashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Creator Dashboard</h1>
      </div>
      <p className="text-[#94A3B8] mb-8">Manage your AI twin, track earnings, and grow your audience.</p>

      {/* Placeholder stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Subscribers', value: '0', color: '#00D4FF' },
          { label: 'Monthly Revenue', value: '$0', color: '#84FF57' },
          { label: 'Messages Today', value: '0', color: '#FF6B6B' },
        ].map((stat) => (
          <div key={stat.label} className="card rounded-2xl p-6">
            <p className="text-sm text-[#94A3B8] mb-1">{stat.label}</p>
            <p className="font-display font-800 text-3xl" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
