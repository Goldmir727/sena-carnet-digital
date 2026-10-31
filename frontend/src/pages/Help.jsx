import {
  HelpCircle,
  LogIn,
  UserPen,
  IdCard,
  QrCode,
  Download,
  ScanLine,
  GraduationCap,
  FileBarChart2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../constants/permissions';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

function HelpSection({ icon: Icon, question, children }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <h2 className="text-base font-semibold text-sena-ink">{question}</h2>
      </div>
      <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </Card>
  );
}

export default function Help() {
  const { user } = useAuth();
  const role = user?.role_name;

  const canConsultarCarnet = hasPermission(role, 'carnet.view');
  const canGenerarQrAcceso = hasPermission(role, 'qr.carnet');
  const canRegistrarAsistencia = hasPermission(role, 'asistencia.escanear');
  const canGenerarQrClase = hasPermission(role, 'qr.clase');
  const canValidar = hasPermission(role, 'validar.qr');
  const canConsultarReportes = hasPermission(role, 'reports.view');

  const faqs = [
    {
      q: '¿Olvidé mi contraseña?',
      a: 'En la pantalla de inicio de sesión, pulsa el enlace "¿Olvidé tu contraseña?". Ingresa tu correo y el sistema te enviará instrucciones para restablecerla.',
    },
    {
      q: '¿No recibí el código de verificación?',
      a: 'Revisa tu correo (y la carpeta de spam). Si sigue sin llegar, usa la opción "Reenviar código" en la pantalla de verificación.',
    },
    {
      q: '¿Mi QR de acceso expiró?',
      a: 'Los QR de acceso generados tienen una validez de 15 minutos y son de un solo uso. Puedes generar uno nuevo desde tu carnet.',
    },
    {
      q: '¿Mi QR de acceso ya fue utilizado?',
      a: 'Sí, los QR de acceso son de un solo uso. Genera uno nuevo desde tu carnet para presentarlo al validador.',
    },
    {
      q: '¿Mi carnet está vencido?',
      a: 'Si el carnet está vencido u no vigente, el acceso será denegado. Contacta a la Coordinación para gestionar su renovación.',
    },
    {
      q: '¿Por qué no puedo acceder a una opción?',
      a: 'Cada rol tiene permisos asignados. Si una opción no aparece en tu menú, es porque tu rol no tiene habilitada esa función.',
    },
    {
      q: '¿Puedo cambiar mi rol?',
      a: 'No. Solo un Coordinador puede cambiar el rol de otra persona, y nunca desde el perfil propio de un usuario.',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Soporte"
        title="Ayuda"
        description="Guía rápida para usar el sistema carnet digital. Si no encuentras lo que buscas, contacta a la Coordinación."
        icon={HelpCircle}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Ayuda' }]}
      />

      <HelpSection icon={LogIn} question="¿Cómo iniciar sesión?">
        <p>1. Ingresa tu usuario y contraseña en la pantalla de inicio de sesión.</p>
        <p>2. Pulsa <strong>Continuar</strong>. El sistema enviará un código de verificación de 6 dígitos a tu correo.</p>
        <p>3. Ingresa el código y pulsa <strong>Verificar y entrar</strong>.</p>
        <p>4. Si no recibiste el código, usa <strong>Reenviar código</strong>.</p>
        <p>5. Si olvidaste tu contraseña, usa <strong>¿Olvidé tu contraseña? Recupérala aquí</strong>.</p>
      </HelpSection>

      <HelpSection icon={UserPen} question="¿Cómo editar mis datos?">
        <p>1. Entra desde el avatar de la esquina superior derecha.</p>
        <p>2. Pulsa <strong>Editar mis datos</strong>.</p>
        <p>3. Actualiza los campos que necesites y pulsa <strong>Guardar cambios</strong>.</p>
        <p>
          <Badge variant="yellow">Importante:</Badge> Tu rol no puede modificarse desde tu perfil. Solo un Coordinador
          puede cambiar el rol de otra persona.
        </p>
      </HelpSection>

      {canConsultarCarnet && (
        <>
          <HelpSection icon={IdCard} question="¿Cómo consultar mi carnet?">
            <p>1. Entra desde el avatar de la esquina superior derecha.</p>
            <p>2. Revisa tus datos personales, el estado del carnet y sus fechas de emisión y vencimiento.</p>
            <p>3. Puedes presentar el código QR o el UUID del carnet para la validación en portería.</p>
          </HelpSection>

          {canGenerarQrAcceso && (
            <HelpSection icon={QrCode} question="¿Cómo generar mi QR de acceso?">
              <p>1. Entra desde el avatar de la esquina superior derecha.</p>
              <p>2. Pulsa <strong>Generar QR de acceso</strong>.</p>
              <p>3. El QR es temporal: expira en 15 minutos o se utiliza con el primer escaneo.</p>
              <p>4. Si ya fue utilizado o expiró, pulsa <strong>Regenerar QR</strong>.</p>
            </HelpSection>
          )}

          <HelpSection icon={Download} question="¿Cómo descargar mi carnet?">
            <p>1. Entra desde el avatar de la esquina superior derecha.</p>
            <p>2. Pulsa <strong>Descargar carnet en PDF</strong>.</p>
            <p>3. El PDF incluye tu foto, datos y el código QR para presentación en portería.</p>
          </HelpSection>
        </>
      )}

      {canRegistrarAsistencia && (
        <HelpSection icon={ScanLine} question="¿Cómo registrar mi asistencia?">
          <p>1. Genera el QR de clase desde el módulo <strong>QR de clase</strong> (si eres Docente) o ingresa el token del QR de clase.</p>
          <p>2. En <strong>Registrar asistencia</strong>, pega el token del QR de clase.</p>
          <p>3. Pulsa <strong>Registrar asistencia</strong> y revisa el resultado.</p>
        </HelpSection>
      )}

      {canGenerarQrClase && (
        <HelpSection icon={GraduationCap} question="¿Cómo generar un QR de clase?">
          <p>1. Entra al módulo <strong>QR de clase</strong>.</p>
          <p>2. Selecciona el grupo o la ficha de tu clase.</p>
          <p>3. Pulsa <strong>Generar QR de clase</strong> y comparte el código con tus aprendices.</p>
        </HelpSection>
      )}

      {canValidar && (
        <HelpSection icon={ShieldCheck} question="¿Cómo validar un carnet o QR?">
          <p>1. Entra al módulo <strong>Validar acceso</strong>.</p>
          <p>2. Selecciona el modo <strong>Código QR</strong> o <strong>UUID</strong>.</p>
          <p>3. Ingresa el token o el UUID y pulsa <strong>Validar identidad</strong>.</p>
          <p>4. El resultado indica si el acceso está <strong>Permitido</strong>, <strong>Denegado</strong>, si el QR <strong>expiró</strong> o <strong>ya fue utilizado</strong>, o si el carnet está <strong>vencido</strong>.</p>
        </HelpSection>
      )}

      {canConsultarReportes && (
        <HelpSection icon={FileBarChart2} question="¿Cómo consultar los reportes?">
          <p>1. Entra al módulo <strong>Reportes</strong>.</p>
          <p>2. Selecciona la pestaña que necesites: resumen, usuarios, carnets o asistencias.</p>
          <p>3. Aplica los filtros y exporta el resultado con <strong>Exportar PDF</strong> o <strong>Exportar Excel</strong>.</p>
        </HelpSection>
      )}

      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
            <HelpCircle className="h-4 w-4" strokeWidth={2} />
          </div>
          <h2 className="text-base font-semibold text-sena-ink">Preguntas frecuentes</h2>
        </div>
        <div className="mt-4 space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-sena-ink">{f.q}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
