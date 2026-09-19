# Habit Tracker

Aplicación personal (PWA) para llevar el control de los hábitos del día a día: hábitos en secciones, nota y peso diarios, horas de sueño, tareas del día, eventos con horario, metas del mes y revisión mensual. Se instala en el móvil y en el portátil, funciona sin conexión y guarda los datos en el propio dispositivo.

**App:** https://alvaromolmateo-cmd.github.io/habit-tracker/

## Qué hay dentro

| Vista | Contenido |
|---|---|
| **Hoy** | Resumen (racha, cumplimiento del mes, sueño de hoy, peso), registro de hoy (nota 1-10, peso, sueño, hábitos ✓ / ½ / —, momento memorable), **tareas del día** (listado que se va tachando, con los eventos de hoy) y gráficas del mes de peso, sueño y nota del día con su objetivo. |
| **Calendario** | Mes completo con el % de cada día, sus eventos y sus tareas. Cada día abre un panel tipo agenda: **eventos con hora de inicio y fin** (o de todo el día), tareas del día y acceso al registro de hábitos. Debajo, la lista de eventos del mes. |
| **Hábitos** | Crear, editar, ordenar, archivar y eliminar hábitos, y **crear, renombrar, ordenar y eliminar secciones**. Muestra la racha actual y la mejor de cada hábito. |
| **Mensual** | Cuadrícula de todos los hábitos × días del mes, anillo de cumplimiento y % por hábito, **metas del mes con Sí / Regular / No** (con explicación cuando es «regular»), un momento memorable por día, calificación del mes y qué mejorar. Historial de meses anteriores. |
| **Estadísticas** | Periodo seleccionable (mes, 3, 6, 12 meses, todo): cumplimiento por hábito, rachas, evolución de peso / sueño / nota, medias por día de la semana y mapa de calor del año. |
| **Ajustes** | Nombre y lema, peso y sueño objetivo, umbral de "día cumplido", tema claro/oscuro, instalación de la PWA, exportar / importar copia (JSON) y borrar datos. |

Estados de un hábito en un día: **hecho** (cuenta 1), **a medias** (cuenta 0,5), **no aplica** (no cuenta) y sin marcar (cuenta 0 si el día está registrado). El cumplimiento solo tiene en cuenta los días con algún registro; las tareas y los eventos no cuentan como registro.

## Tecnología

- HTML, CSS y JavaScript (módulos ES) sin dependencias ni paso de build.
- Paleta de rojos oscuros con tema claro y oscuro; colores de las gráficas validados para daltonismo y contraste.
- Gráficas en SVG generadas a mano (`js/charts.js`), con tooltip al pasar el ratón y vista de tabla.
- Datos en `localStorage` bajo la clave `habit-tracker:data` (`js/store.js`), con copia de seguridad en JSON.
- PWA: `manifest.webmanifest` + `sw.js` (precaché de la app y estrategia *red primero, caché si falla*).
- Iconos PNG generados con `node tools/make-icons.js` (sin librerías).

```
index.html            estructura, iconos SVG y barras de navegación
css/styles.css        tema claro/oscuro, layout escritorio (barra lateral) y móvil (barra inferior)
js/app.js             arranque, enrutado por hash, tema, service worker, instalación
js/store.js           estado, persistencia, acciones y migración
js/stats.js           cumplimiento, rachas, medias y series
js/charts.js          gráficas SVG (línea, barras, mapa de calor, anillo, lista de barras)
js/dayform.js         formulario de un día (usado en Hoy y en el editor modal)
js/tasks.js           tareas del día
js/events.js          eventos con horario
js/views/*.js         una vista por sección
```

## Tus datos entre versiones

Todo se guarda en el propio navegador; actualizar la app no borra nada:

- Los hábitos y secciones de ejemplo solo se crean la primera vez, cuando no hay nada guardado.
- Cuando cambia la estructura de los datos, la app los adapta (`migrate` en `js/store.js`) y antes guarda una
  **copia automática** tal cual estaban (`habit-tracker:data:copia`), que se descarga desde Ajustes → Datos.
- Si algún día no pudiera leerlos, los **aparta sin borrarlos** (`habit-tracker:data:rescate`) en vez de empezar
  encima, y avisa.
- Pide al navegador almacenamiento persistente para que no los borre cuando ande justo de espacio. Aun así, en
  iPhone conviene instalarla en la pantalla de inicio y exportar una copia de vez en cuando.

## Ejecutar en local

Cualquier servidor estático vale (los módulos ES no cargan desde `file://`):

```
python -m http.server 5173
```

y abrir http://localhost:5173/. El service worker solo se registra en `https` o `localhost`.

## Despliegue

GitHub Pages sirve la rama `main` desde la raíz. Al hacer push, la app se actualiza sola; el service worker descarga la versión nueva en cuanto hay red. Si se cambian los archivos precacheados, subir `VERSION` en `sw.js`.

## Instalar en el móvil

- **Android / Chrome:** abrir la URL, menú ⋮ → *Instalar aplicación* (o el botón *Instalar app* de la propia web).
- **iPhone / Safari:** *Compartir* → *Añadir a pantalla de inicio*.

## Pendiente / ideas

- Sincronización entre dispositivos (ahora: exportar en uno e importar en otro).
- Recordatorio diario (notificaciones).
- Hábitos con días de la semana concretos y hábitos numéricos (p. ej. pasos reales).
