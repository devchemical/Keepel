# Keepel

Keepel es un servicio para que personas particulares organicen la información de sus vehículos y su mantenimiento.

## Language

**Persona usuaria**:
Persona física mayor de 18 años que crea una cuenta de Keepel para gestionar información de sus vehículos.
_Avoid_: Cliente, conductor, titular de la cuenta

**Intento de inicio de sesión**:
Solicitud para acceder a Keepel mediante unas credenciales. Puede terminar con acceso concedido, credenciales no válidas o inicio de sesión temporalmente no disponible. El resultado no revela si existe una cuenta asociada al email.
_Avoid_: Comprobación de cuenta, búsqueda de usuario

**Referencia de incidente**:
Identificador opaco que una persona usuaria puede comunicar a soporte para relacionar un resultado temporalmente no disponible con su diagnóstico interno. No contiene datos personales ni credenciales.
_Avoid_: Código de error, identificador de usuario

**Previsión**:
Mantenimiento programado para un vehículo por fecha o kilometraje. Está pendiente hasta que un mantenimiento realizado la completa o la persona usuaria la cancela; si se elimina el mantenimiento que la completó, vuelve a estar pendiente. Una previsión cancelada no cambia más. En el código, `pending`, `completed` y `cancelled`.
_Avoid_: Recordatorio, cita, servicio programado

**Urgencia**:
Clasificación de una previsión pendiente según cuándo vence: vencida (fecha pasada o kilometraje alcanzado), hoy, próxima (fecha dentro de los próximos 30 días) o más adelante (fecha posterior o solo un kilometraje aún no alcanzado). Las previsiones de más adelante no aparecen en el panel. En el código, `overdue`, `today`, `upcoming` y `later`.
_Avoid_: Prioridad, estado de la previsión
