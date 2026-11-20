import PublicLayout from '../components/layout/PublicLayout';
import ApkDownloadLink from '../components/ui/ApkDownloadLink';

const FUNCTIONS = [
  ['Carnet digital', 'Consulta tu identificación, su estado y los códigos QR de acceso desde tu cuenta.'],
  ['Asistencia con QR', 'Registra la asistencia a clases y eventos con los códigos que comparte el responsable.'],
  ['Gestión por roles', 'Coordinadores, docentes, aprendices, funcionarios y validadores acceden a las funciones de su rol.'],
];

export default function PublicHome() {
  return (
    <PublicLayout>
      <section aria-labelledby="presentacion" className="max-w-4xl">
        <h1 id="presentacion" className="text-4xl font-bold leading-[1.12] tracking-tight sm:text-6xl">
          Tu carnet digital y tu asistencia, en un solo lugar.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-soft">
          CarnetiSENA reúne la consulta de carnets, el registro de asistencia y la validación
          de acceso para la comunidad SENA. Ingresa con la cuenta que te asignó la coordinación.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-5">
          <a href="/login" className="rounded-lg bg-sena-green px-6 py-3 font-semibold text-white hover:bg-sena-green-dark">
            Acceder a mi cuenta
          </a>
          <a href="/guia" className="font-semibold text-sena-green underline underline-offset-4">
            Cómo usar CarnetiSENA
          </a>
        </div>
      </section>

      <section aria-labelledby="funciones" className="mt-16 border-t border-slate-200 pt-10 sm:mt-20">
        <h2 id="funciones" className="text-2xl font-bold tracking-tight">Qué puedes hacer</h2>
        <dl className="mt-7 grid gap-8 md:grid-cols-3 md:gap-10">
          {FUNCTIONS.map(([title, description]) => (
            <div key={title}>
              <dt className="border-l-4 border-sena-green pl-4 text-lg font-semibold">{title}</dt>
              <dd className="mt-3 text-base leading-relaxed text-ink-soft">{description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-7 text-sm text-ink-soft">
          Las opciones disponibles dependen de los permisos de tu cuenta. Los eventos también se gestionan desde la aplicación móvil.
        </p>
      </section>

      <section aria-labelledby="primer-acceso" className="mt-14 grid gap-8 border-t border-slate-200 pt-10 md:grid-cols-2 md:gap-16">
        <div>
          <h2 id="primer-acceso" className="text-2xl font-bold tracking-tight">Antes de ingresar</h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 leading-relaxed text-ink-soft">
            <li>Ten a mano el usuario y la contraseña que te asignaron.</li>
            <li>Revisa el correo asociado a tu cuenta para recibir el código de verificación.</li>
            <li>Introduce el código para acceder a tu panel y consultar las funciones de tu rol.</li>
          </ol>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            ¿Aún no tienes cuenta? Solicita el acceso a la coordinación de tu centro.
            No compartas contraseñas ni códigos de verificación.
          </p>
        </div>
        <div className="self-start rounded-xl bg-sena-green-light p-7">
          <h2 className="text-2xl font-bold tracking-tight">También en Android</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Usa la aplicación móvil para consultar tu carnet y escanear los QR de asistencia.
            Necesitas una cuenta activa y conexión a Internet.
          </p>
          <ApkDownloadLink className="mt-5" />
          <p className="mt-3 text-sm text-ink-soft">La descarga del APK se realiza desde el repositorio del proyecto en GitHub.</p>
        </div>
      </section>
    </PublicLayout>
  );
}
