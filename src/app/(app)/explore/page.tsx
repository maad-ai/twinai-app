import { Compass } from 'lucide-react';

export const metadata = { title: 'Explore' };

export default function ExplorePage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Compass className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Explore Twins</h1>
      </div>
      <p className="text-[#94A3B8] mb-8">Discover AI twins of your favorite creators.</p>

      {/* Placeholder grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card rounded-2xl p-6 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-[#F1F5F9] mb-4" />
            <div className="h-4 bg-[#F1F5F9] rounded w-2/3 mb-2" />
            <div className="h-3 bg-[#F1F5F9] rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
