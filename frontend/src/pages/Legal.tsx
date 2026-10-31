import Firma from '../components/Firma';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="card space-y-4 p-6 leading-relaxed text-igm-800 sm:p-10 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-igm-950 [&_li]:ml-5 [&_li]:list-disc">
          <h1 className="text-3xl font-extrabold tracking-tight text-igm-950">{title}</h1>
          <p className="text-sm text-igm-500">Última actualización: 31 de octubre de 2026</p>
          {children}
        </article>
        <p className="mt-6 text-center text-sm"><Link to="/" className="text-igm-600 underline">← Volver al inicio</Link></p>
        <Firma className="mt-4" />
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        IGM Rancho es la aplicación interna para reservar desayuno, almuerzo y merienda del personal del Instituto
        Geográfico Militar (IGM). Esta política explica qué datos recogemos y cómo los usamos.
      </p>
      <h2>Datos que recogemos</h2>
      <ul>
        <li>Grado y nombre completo, número de cédula y correo institucional (@geograficomilitar.gob.ec).</li>
        <li>Los ranchos reservados, la fecha y el valor a pagar.</li>
        <li>La captura o comprobante de la transferencia que la persona sube.</li>
      </ul>
      <h2>Para qué los usamos</h2>
      <ul>
        <li>Registrar la reserva y verificar el pago.</li>
        <li>Saber cuántas raciones preparar y llevar el control contable del servicio.</li>
        <li>Permitir que cada persona consulte el estado de sus reservas.</li>
      </ul>
      <p>No vendemos ni compartimos los datos con terceros, ni los usamos con fines publicitarios.</p>
      <h2>Dónde se guardan</h2>
      <p>
        Los datos se guardan en el servidor de la aplicación. Además, los comprobantes de pago se guardan como respaldo en
        una carpeta de Google Drive de la administración del servicio.
      </p>
      <h2>Uso de los servicios de Google</h2>
      <p>
        La aplicación usa la API de Google Drive únicamente con el permiso <code>drive.file</code>, que le permite crear y
        leer <b>solo los archivos que ella misma sube</b> (los comprobantes). No tiene acceso al resto del contenido del
        Drive. El uso de la información recibida de las API de Google cumple la{' '}
        <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Política de datos de usuario de los servicios de API de Google
        </a>, incluidos los requisitos de uso limitado.
      </p>
      <h2>Acceso y conservación</h2>
      <p>
        Solo la administración del servicio de alimentación puede ver los comprobantes. Los datos se conservan mientras
        sean necesarios para el control del servicio. Puedes pedir la corrección o eliminación de tus datos a la
        administración del rancho del IGM.
      </p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Términos de uso">
      <ul>
        <li>IGM Rancho es de uso exclusivo del personal del Instituto Geográfico Militar.</li>
        <li>La reserva queda confirmada cuando la administración verifica el pago.</li>
        <li>Las reservas se reciben hasta la hora límite publicada en la aplicación.</li>
        <li>El comprobante debe corresponder al valor reservado; los comprobantes falsos o duplicados serán rechazados.</li>
        <li>Los precios y el menú pueden cambiar; cada reserva conserva el precio con el que se hizo.</li>
      </ul>
      <p>Al usar la aplicación aceptas estos términos y la <Link className="underline" to="/privacidad">política de privacidad</Link>.</p>
    </LegalPage>
  );
}
