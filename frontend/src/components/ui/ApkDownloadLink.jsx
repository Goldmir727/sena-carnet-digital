import { Download } from 'lucide-react';
import cn from '../../lib/cn';

export const APK_DOWNLOAD_URL =
  'https://github.com/Goldmir727/sena-carnet-digital/releases/download/App/CarnetSena-1.0.0-release.apk';

const TONES = {
  dark: 'border-white/15 bg-white/10 text-sena-tint-200 hover:bg-white/15 hover:text-white',
  light:
    'border-slate-200 bg-white/70 text-slate-600 hover:border-sena-green/40 hover:text-sena-green',
};

export default function ApkDownloadLink({ tone = 'light', className = '' }) {
  return (
    <a
      href={APK_DOWNLOAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        TONES[tone],
        className
      )}
    >
      <Download className="h-3.5 w-3.5" />
      Descargar aplicación Android
    </a>
  );
}
