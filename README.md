# Habit Tracker

Versión digital (PWA) del habit tracker que llevo en una libreta: hábitos en tres bloques, nota y peso diarios, horas de sueño, metas del mes, un momento memorable por día, calificación mensual y "¿qué mejorar el siguiente mes?". Se instala en el móvil y en el portátil, funciona sin conexión y guarda los datos en el propio dispositivo.

**App:** https://alvaromolmateo-cmd.github.io/habit-tracker/

## Qué hay dentro

| Vista | Contenido |
|---|---|
| **Hoy** | Resumen del mes (racha, cumplimiento, ánimo medio, peso), registro rápido de hoy (nota 1-10, peso, sueño, hábitos ✓ / ½ / —, momento memorable), cuadrícula de todos los hábitos × días del mes (como la página derecha de la libreta), gráfica de evolución (peso / sueño / nota) con objetivo, anillo de cumplimiento y % por hábito, metas del mes, momentos memorables y revisión mensual. |
| **Calendario** | Mes completo con el % de cada día; cada día abre su editor (con navegación día a día). |
| **Hábitos** | Crear, editar, ordenar, archivar y eliminar hábitos en los bloques *Físico y salud*, *Productividad* y *Rutina*. Muestra la racha actual y la mejor de cada uno. |
| **Reflexiones** | La página izquierda de la libreta: metas del mes (pendiente / conseguida / no conseguida), una línea memorable por día, calificación del mes y qué mejorar. Historial de meses anteriores. |
| **Estadísticas** | Periodo seleccionable (mes, 3, 6, 12 meses, todo): cumplimiento por hábito, rachas, evolución de peso / sueño / nota, medias por día de la semana y mapa de calor del año. |
| **Ajustes** | Nombre y lema, peso y sueño objetivo, umbral de "día cumplido", tema claro/oscuro, instalación de la PWA, exportar / importar copia (JSON) y borrar datos. |

Estados de un hábito en un día: **hecho** (cuenta 1), **a medias** (cuenta 0,5), **no aplica** (no cuenta) y sin marcar (cuenta 0 si el día está registrado). El cumplimiento solo tiene en cuenta los días con algún registro.

## Tecnología

- HTML, CSS y JavaScript (módulos ES) sin dependencias ni paso de build.
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
js/views/*.js         una vista por sección
```

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
