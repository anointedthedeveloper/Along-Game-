import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { CREDITS } from '@/data/credits';

export default function Credits() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link to="/"><Logo size={24} /></Link>
      <h1 className="mt-8 font-display text-5xl font-extrabold uppercase">Photo credits</h1>
      <p className="mt-2 text-asphalt-300">Photographs of Abuja and its vehicles are from Wikimedia Commons and used under Creative Commons licences. Each links to its source page and licence. Map art, vehicle sprites and the city itself are generated procedurally by ALONG.</p>
      <ul className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10">
        {CREDITS.map((c) => (
          <li key={c.file} className="p-4 text-sm">
            <p className="font-semibold">{c.title}</p>
            <p className="text-asphalt-300">by {c.author} · {c.license} · <span className="font-mono text-xs">{c.file}</span></p>
            <a href={c.url} target="_blank" rel="noreferrer noopener" className="text-taxi hover:underline">Source and licence</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
