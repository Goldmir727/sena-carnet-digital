import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sena-bg">
      <p className="text-6xl font-extrabold text-sena-green">404</p>
      <h1 className="mt-2 text-xl font-semibold text-sena-ink">Página no encontrada</h1>
      <Link to="/" className="mt-4 rounded-lg bg-sena-green px-4 py-2 text-white hover:bg-sena-green-dark">
        Volver al inicio
      </Link>
    </div>
  );
}
