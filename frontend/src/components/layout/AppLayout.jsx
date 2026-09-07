import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import DockNav from './DockNav';
import Footer from './Footer';

export default function AppLayout() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-canvas">
      {/* Ambiente decorativo de fondo (profundidad sin cajas) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0" aria-hidden="true">
        <div className="absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-sena-tint-100/70 blur-3xl" />
        <div className="absolute -top-16 left-[-6%] h-72 w-72 rounded-full bg-sena-tint-100/50 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-32 pt-6 md:px-6 lg:px-10 lg:pt-8">
          <Outlet />
        </main>
        <Footer />
        <DockNav />
      </div>
    </div>
  );
}