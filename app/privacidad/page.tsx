import type { Metadata } from "next"
import Link from "next/link"
import { PrivacyPageLayout } from "@/components/privacy/privacy-page-layout"
import { PrivacySettingsTrigger } from "@/components/privacy/privacy-settings-trigger"

export const metadata: Metadata = {
  title: "Política de Privacidad y Cookies | Keepel",
  description:
    "Información sobre cómo Keepel trata los datos personales y utiliza cookies necesarias y analítica opcional.",
  alternates: {
    canonical: "/privacidad",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://keepel.chemicaldev.com/privacidad",
    title: "Política de Privacidad y Cookies | Keepel",
    description: "Información sobre privacidad, protección de datos, cookies y analítica opcional en Keepel.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

const sections = [
  ["responsable", "Responsable"],
  ["datos", "Datos tratados"],
  ["finalidades", "Finalidades y bases"],
  ["proveedores", "Proveedores y transferencias"],
  ["conservacion", "Conservación"],
  ["cookies", "Cookies"],
  ["derechos", "Tus derechos"],
  ["seguridad", "Seguridad y cambios"],
] as const

const sectionClassName = "scroll-mt-28 space-y-4"
const headingClassName = "text-foreground text-2xl font-semibold tracking-tight"
const paragraphClassName = "text-muted-foreground leading-7"
const linkClassName = "text-primary font-medium underline underline-offset-4"

export default function PrivacyPage() {
  return (
    <PrivacyPageLayout>
      <article className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <header className="border-border mb-10 space-y-5 border-b pb-8">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">Privacidad en Keepel</p>
          <h1 className="text-foreground text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            Política de Privacidad y Cookies
          </h1>
          <p className="text-muted-foreground max-w-3xl text-lg leading-8">
            Explicamos de forma clara qué información trata Keepel, para qué la utiliza, durante cuánto tiempo la
            conserva y cómo puedes ejercer tus derechos.
          </p>
          <dl className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-foreground font-medium">Versión</dt>
              <dd>1.0</dd>
            </div>
            <div>
              <dt className="text-foreground font-medium">Vigente desde</dt>
              <dd>
                <time dateTime="2026-07-22">22 de julio de 2026</time>
              </dd>
            </div>
            <div>
              <dt className="text-foreground font-medium">Última actualización</dt>
              <dd>
                <time dateTime="2026-07-22">22 de julio de 2026</time>
              </dd>
            </div>
          </dl>
        </header>

        <nav aria-label="Índice de la política" className="bg-muted/40 border-border mb-12 rounded-xl border p-5">
          <h2 className="text-foreground mb-3 font-semibold">Contenido</h2>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {sections.map(([id, label], index) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  {index + 1}. {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-12">
          <section id="responsable" className={sectionClassName}>
            <h2 className={headingClassName}>1. Responsable y ámbito de la política</h2>
            <div className="border-border bg-card rounded-xl border p-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-foreground text-sm font-medium">Responsable del tratamiento</dt>
                  <dd className="text-muted-foreground mt-1">Alejandro Bayón Burgos</dd>
                </div>
                <div>
                  <dt className="text-foreground text-sm font-medium">País</dt>
                  <dd className="text-muted-foreground mt-1">España</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-foreground text-sm font-medium">Contacto de privacidad</dt>
                  <dd className="mt-1">
                    <a href="mailto:privacidad@keepel.dev" className={linkClassName}>
                      privacidad@keepel.dev
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
            <p className={paragraphClassName}>
              Esta política se aplica al sitio y a la aplicación Keepel. El servicio está dirigido a personas físicas de
              18 años o más en España y en el Espacio Económico Europeo. Keepel no está diseñado para menores de edad.
            </p>
          </section>

          <section id="datos" className={sectionClassName}>
            <h2 className={headingClassName}>2. Qué datos tratamos</h2>
            <ul className="text-muted-foreground list-disc space-y-3 pl-6 leading-7">
              <li>
                <strong className="text-foreground">Cuenta y autenticación:</strong> nombre, correo electrónico,
                identificador interno, proveedor de acceso y fechas relacionadas con la cuenta. Si utilizas contraseña,
                Supabase Auth la procesa para autenticarte; Keepel no la almacena en texto legible.
              </li>
              <li>
                <strong className="text-foreground">Acceso con Google:</strong> identificador de Google, nombre y correo
                asociados a los permisos básicos <code>openid</code>, <code>email</code> y <code>profile</code>. Google
                y Supabase pueden incluir otros campos básicos del perfil, como imagen o configuración regional, aunque
                Keepel utiliza actualmente el nombre, el correo y el identificador para el acceso.
              </li>
              <li>
                <strong className="text-foreground">Vehículos:</strong> marca, modelo, año, color, kilometraje y, cuando
                los facilites, matrícula y VIN.
              </li>
              <li>
                <strong className="text-foreground">Mantenimiento:</strong> tipos de servicio, fechas, kilometraje,
                costes, descripciones, notas y servicios programados.
              </li>
              <li>
                <strong className="text-foreground">Seguridad y funcionamiento:</strong> dirección IP, fecha, ruta
                solicitada, errores y otros datos técnicos limitados presentes en registros del servidor o utilizados
                para prevenir abusos.
              </li>
              <li>
                <strong className="text-foreground">Preferencia de privacidad:</strong> decisión sobre analítica,
                versión de la política y fecha de la elección, guardadas en una cookie firmada.
              </li>
              <li>
                <strong className="text-foreground">Analítica opcional:</strong> únicamente contadores anónimos de
                accesos y cierres de sesión completados, sin perfiles ni propiedades personales.
              </li>
            </ul>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-foreground text-sm leading-6">
                Utiliza los campos de descripción y notas solo para información necesaria del vehículo. No introduzcas
                datos sensibles, categorías especiales de datos ni información personal de terceras personas.
              </p>
            </div>
          </section>

          <section id="finalidades" className={sectionClassName}>
            <h2 className={headingClassName}>3. Finalidades y bases jurídicas</h2>
            <div className="overflow-x-auto">
              <table className="border-border w-full min-w-[640px] border-collapse overflow-hidden rounded-lg border text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-foreground border-border border-b px-4 py-3 font-semibold">Finalidad</th>
                    <th className="text-foreground border-border border-b px-4 py-3 font-semibold">Base jurídica</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="border-border border-b px-4 py-3">
                      Crear y gestionar la cuenta y prestar las funciones solicitadas.
                    </td>
                    <td className="border-border border-b px-4 py-3">
                      Ejecución del servicio solicitado y medidas precontractuales.
                    </td>
                  </tr>
                  <tr>
                    <td className="border-border border-b px-4 py-3">
                      Autenticar, mantener sesiones y enviar correos de cuenta.
                    </td>
                    <td className="border-border border-b px-4 py-3">
                      Ejecución del servicio y seguridad de la cuenta.
                    </td>
                  </tr>
                  <tr>
                    <td className="border-border border-b px-4 py-3">
                      Prevenir fraude, abuso e intentos automatizados.
                    </td>
                    <td className="border-border border-b px-4 py-3">
                      Interés legítimo en proteger a las personas usuarias y el servicio.
                    </td>
                  </tr>
                  <tr>
                    <td className="border-border border-b px-4 py-3">
                      Atender derechos, reclamaciones y obligaciones legales.
                    </td>
                    <td className="border-border border-b px-4 py-3">Cumplimiento de obligaciones legales.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Obtener estadísticas anónimas y mínimas para mejorar Keepel.</td>
                    <td className="px-4 py-3">Tu consentimiento, que puedes retirar en cualquier momento.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={paragraphClassName}>
              Keepel no vende datos personales, no muestra publicidad personalizada, no elabora perfiles comerciales, no
              utiliza tus datos para entrenar modelos de inteligencia artificial y no los facilita a talleres,
              aseguradoras o socios comerciales.
            </p>
          </section>

          <section id="proveedores" className={sectionClassName}>
            <h2 className={headingClassName}>4. Proveedores, destinatarios y transferencias</h2>
            <p className={paragraphClassName}>
              Solo acceden a datos los proveedores necesarios para operar Keepel y las autoridades cuando exista una
              obligación legal válida. Los principales servicios son:
            </p>
            <ul className="text-muted-foreground list-disc space-y-3 pl-6 leading-7">
              <li>
                <strong className="text-foreground">Infraestructura propia en España:</strong> aplicación y registros
                técnicos.
              </li>
              <li>
                <strong className="text-foreground">Supabase Cloud, Frankfurt:</strong> autenticación, base de datos y
                correo transaccional. Consulta su{" "}
                <a href="https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf" className={linkClassName}>
                  acuerdo de tratamiento
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">Upstash, Frankfurt:</strong> limitación de intentos. Recibe
                identificadores protegidos mediante HMAC, no el correo o la IP en formato legible. Consulta su{" "}
                <a href="https://upstash.com/trust/dpa.pdf" className={linkClassName}>
                  DPA
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">OpenPanel autogestionado en España:</strong> recibe exclusivamente
                eventos anónimos y sin propiedades después del consentimiento.
              </li>
              <li>
                <strong className="text-foreground">Cloudflare:</strong> DNS, entrega, protección perimetral y
                mitigación de amenazas. Consulta su{" "}
                <a href="https://www.cloudflare.com/cloudflare-customer-dpa/" className={linkClassName}>
                  DPA
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">Google Ireland Limited:</strong> autenticación opcional con Google,
                que también trata información conforme a su{" "}
                <a href="https://policies.google.com/privacy" className={linkClassName}>
                  política de privacidad
                </a>
                .
              </li>
            </ul>
            <p className={paragraphClassName}>
              Aunque los datos principales de Supabase y Upstash se alojan en Frankfurt, estos proveedores, Cloudflare o
              sus subencargados pueden realizar tratamientos fuera del EEE. Cuando corresponde, se utilizan decisiones
              de adecuación, cláusulas contractuales tipo y medidas complementarias. La ubicación principal en la UE no
              implica que toda operación técnica ocurra exclusivamente dentro del EEE.
            </p>
          </section>

          <section id="conservacion" className={sectionClassName}>
            <h2 className={headingClassName}>5. Cuánto tiempo conservamos los datos</h2>
            <ul className="text-muted-foreground list-disc space-y-3 pl-6 leading-7">
              <li>Cuenta, vehículos y mantenimiento: mientras la cuenta permanezca activa.</li>
              <li>Solicitud verificada de supresión: eliminación de los sistemas activos en un máximo de 30 días.</li>
              <li>Copias de seguridad: desaparición dentro de su ciclo ordinario, con un máximo de 90 días.</li>
              <li>Registros técnicos y de seguridad del servidor: máximo de 30 días.</li>
              <li>
                Claves operativas antiabuso: durante el periodo técnico necesario para aplicar límites de 60 segundos o
                una hora.
              </li>
              <li>Eventos analíticos anónimos: máximo de 13 meses.</li>
              <li>Preferencia de analítica: 12 meses, salvo que la cambies antes.</li>
              <li>
                Datos necesarios para cumplir una obligación legal: durante el plazo exigido por la norma aplicable.
              </li>
            </ul>
          </section>

          <section id="cookies" className={sectionClassName}>
            <h2 className={headingClassName}>6. Cookies y tecnologías similares</h2>
            <p className={paragraphClassName}>
              Las cookies necesarias funcionan sin consentimiento porque permiten prestar y proteger el servicio. La
              analítica permanece desactivada hasta que la aceptas expresamente.
            </p>
            <p className={paragraphClassName}>
              Para comprobar operaciones de datos pendientes después de recargar, esta pestaña conserva temporalmente su
              referencia y los valores enviados en sessionStorage, separados por cuenta. Se eliminan al confirmar el
              resultado o el rechazo de la operación, o al cerrar la pestaña.
            </p>
            <div className="overflow-x-auto">
              <table className="border-border w-full min-w-[760px] border-collapse overflow-hidden rounded-lg border text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-foreground border-border border-b px-4 py-3 font-semibold">Cookie o patrón</th>
                    <th className="text-foreground border-border border-b px-4 py-3 font-semibold">Finalidad</th>
                    <th className="text-foreground border-border border-b px-4 py-3 font-semibold">Duración máxima</th>
                    <th className="text-foreground border-border border-b px-4 py-3 font-semibold">Tipo</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="border-border border-b px-4 py-3 font-mono text-xs">keepel_privacy_consent</td>
                    <td className="border-border border-b px-4 py-3">Guardar una elección firmada sobre analítica.</td>
                    <td className="border-border border-b px-4 py-3">12 meses</td>
                    <td className="border-border border-b px-4 py-3">Necesaria, propia</td>
                  </tr>
                  <tr>
                    <td className="border-border border-b px-4 py-3 font-mono text-xs">
                      sb-&lt;proyecto&gt;-auth-token[.*]
                    </td>
                    <td className="border-border border-b px-4 py-3">
                      Mantener y renovar la sesión autenticada de Supabase.
                    </td>
                    <td className="border-border border-b px-4 py-3">
                      Hasta 400 días; la sesión efectiva puede expirar antes
                    </td>
                    <td className="border-border border-b px-4 py-3">Necesaria, Supabase</td>
                  </tr>
                  <tr>
                    <td className="border-border border-b px-4 py-3 font-mono text-xs">
                      sb-&lt;proyecto&gt;-auth-token-code-verifier
                    </td>
                    <td className="border-border border-b px-4 py-3">
                      Proteger el intercambio PKCE durante el acceso con Google.
                    </td>
                    <td className="border-border border-b px-4 py-3">10 minutos; se elimina al completar el flujo</td>
                    <td className="border-border border-b px-4 py-3">Necesaria, Supabase</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">Cookies condicionales de Cloudflare</td>
                    <td className="px-4 py-3">
                      Superar desafíos de seguridad o mitigar tráfico malicioso cuando se activen.
                    </td>
                    <td className="px-4 py-3">Según el desafío y la configuración de seguridad aplicada</td>
                    <td className="px-4 py-3">Necesaria, Cloudflare</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={paragraphClassName}>
              OpenPanel no carga scripts en tu navegador, no crea cookies analíticas y no recibe la dirección IP ni el
              agente de usuario del visitante. Keepel envía desde su servidor únicamente el nombre de una acción
              completada y permitida.
            </p>
            <PrivacySettingsTrigger variant="outline">Cambiar preferencias de privacidad</PrivacySettingsTrigger>
          </section>

          <section id="derechos" className={sectionClassName}>
            <h2 className={headingClassName}>7. Tus derechos</h2>
            <p className={paragraphClassName}>
              Puedes solicitar acceso, rectificación, supresión, limitación, oposición y portabilidad, así como retirar
              tu consentimiento de analítica. La retirada no afecta a la licitud del tratamiento realizado antes de
              retirarlo.
            </p>
            <p className={paragraphClassName}>
              Escribe desde el correo asociado a tu cuenta a{" "}
              <a href="mailto:privacidad@keepel.dev" className={linkClassName}>
                privacidad@keepel.dev
              </a>
              . Solo pediremos información adicional si existen dudas razonables sobre tu identidad. Las exportaciones
              se preparan manualmente en JSON o CSV y se entregan mediante un canal seguro. Respondemos normalmente
              dentro de un mes; ese plazo puede ampliarse en los casos permitidos por el RGPD.
            </p>
            <p className={paragraphClassName}>
              También puedes presentar una reclamación ante la{" "}
              <a href="https://www.aepd.es/" className={linkClassName}>
                Agencia Española de Protección de Datos
              </a>
              .
            </p>
          </section>

          <section id="seguridad" className={sectionClassName}>
            <h2 className={headingClassName}>8. Seguridad, cambios y contacto</h2>
            <p className={paragraphClassName}>
              Aplicamos autenticación, conexiones HTTPS, controles de acceso por cuenta, políticas de seguridad a nivel
              de fila, minimización de datos y limitación de intentos. Ninguna medida elimina por completo el riesgo,
              por lo que revisamos y mejoramos las protecciones de forma continua.
            </p>
            <p className={paragraphClassName}>
              Si esta política cambia de forma sustancial, actualizaremos la versión y la fecha y avisaremos mediante
              correo y un aviso dentro de Keepel antes o al entrar en vigor. Los cambios menores pueden comunicarse
              mediante la actualización de esta página.
            </p>
            <p className={paragraphClassName}>
              Para cualquier consulta de privacidad, escribe a{" "}
              <a href="mailto:privacidad@keepel.dev" className={linkClassName}>
                privacidad@keepel.dev
              </a>
              .
            </p>
            <p className="text-muted-foreground text-sm">
              <Link href="/" className={linkClassName}>
                Volver a Keepel
              </Link>
            </p>
          </section>
        </div>
      </article>
    </PrivacyPageLayout>
  )
}
