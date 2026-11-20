import PublicLayout from '../components/layout/PublicLayout';

const QUESTIONS = [
  {
    title: '¿Cómo consigo una cuenta?',
    answer: 'Las cuentas las gestiona la coordinación. Solicita el acceso al responsable de tu centro y confirma que tu correo esté actualizado. No hay un formulario público de registro.',
  },
  {
    title: '¿Cómo inicio sesión?',
    answer: 'Abre Iniciar sesión, escribe tu usuario y contraseña y pulsa Continuar. Revisa el correo asociado a tu cuenta e introduce el código de verificación de seis dígitos. Si no llega, revisa spam o utiliza Reenviar código.',
  },
  {
    title: '¿Cómo consulto mi carnet digital?',
    answer: 'Después de ingresar, abre tu perfil desde el avatar o la opción Mi carnet, si tu rol la tiene habilitada. Allí puedes consultar tus datos, el estado del carnet y las opciones de QR disponibles.',
  },
  {
    title: '¿Cómo registro mi asistencia?',
    answer: 'Usa el QR que comparte tu docente o el responsable del evento. En Android puedes escanearlo con la aplicación. En la web, los roles autorizados disponen de Registrar asistencia para introducir el token del QR de clase. Comprueba la confirmación antes de salir.',
  },
  {
    title: '¿Por qué no aparecen todas las funciones?',
    answer: 'El menú se adapta a los permisos de cada rol. Los coordinadores, docentes, aprendices, funcionarios y validadores no tienen las mismas opciones. Si necesitas corregir tu rol o tus datos, contacta a la coordinación.',
  },
  {
    title: '¿Qué hago si un QR expiró o ya se utilizó?',
    answer: 'Los códigos QR pueden vencer y algunos son de un solo uso. Genera uno nuevo desde tu carnet o pide al responsable de la clase o del evento un código activo. No publiques capturas de tu carnet ni sus códigos.',
  },
];

export default function PublicGuide() {
  return (
    <PublicLayout>
      <div className="max-w-3xl">
        <a href="/" className="text-sm font-semibold text-sena-green underline underline-offset-4">Volver a la presentación</a>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Guía de acceso y carnet digital</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          Resuelve las dudas más comunes antes de ingresar a CarnetiSENA. Para problemas con
          tu cuenta, consulta al responsable de la plataforma en tu centro.
        </p>
        <section aria-labelledby="preguntas" className="mt-10">
          <h2 id="preguntas" className="text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
            {QUESTIONS.map(({ title, answer }) => (
              <details key={title} className="py-5">
                <summary className="cursor-pointer text-lg font-semibold text-sena-ink">{title}</summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section aria-labelledby="recuperar" className="mt-10">
          <h2 id="recuperar" className="text-2xl font-bold tracking-tight">¿Olvidaste tu contraseña?</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            En la pantalla de acceso selecciona la recuperación de contraseña e introduce el correo de tu cuenta.
            Sigue las instrucciones del mensaje recibido. No compartas el enlace de recuperación.
          </p>
          <div className="mt-6 flex flex-wrap gap-6 font-semibold text-sena-green">
            <a href="/forgot-password" className="underline underline-offset-4">Recuperar contraseña</a>
            <a href="/login" className="underline underline-offset-4">Iniciar sesión</a>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
