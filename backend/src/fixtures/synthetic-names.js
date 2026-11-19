const FIRST_NAMES = [
  'Sofía', 'Mateo', 'Valeria', 'Sebastián', 'Camila', 'Santiago', 'Lucía', 'Daniel', 'Mariana', 'Alejandro',
  'Isabella', 'Gabriel', 'Paula', 'Andrés', 'Natalia', 'Diego', 'Fernanda', 'Esteban', 'Andrea', 'Felipe',
];

const LAST_NAMES = [
  'Vargas Méndez', 'Rojas Solís', 'Jiménez Castro', 'Mora Quesada', 'Chacón Alpízar',
  'Brenes Navarro', 'Salazar Chacón', 'Araya Campos', 'Quesada Monge', 'Solano Valverde',
  'Herrera Cordero', 'Cordero Ramírez', 'Alfaro Murillo', 'Montero Porras', 'Rodríguez Víquez',
  'Gómez Arias', 'Castillo Umaña', 'Calderón Sibaja', 'Zúñiga Arce', 'Fallas Picado',
];

function syntheticNameForIndex(index) {
  const safe = Math.abs(Number(index) || 0);
  const first = FIRST_NAMES[safe % FIRST_NAMES.length];
  const last = LAST_NAMES[(safe * 3 + Math.floor(safe / FIRST_NAMES.length)) % LAST_NAMES.length];
  return `${first} ${last}`;
}

module.exports = { FIRST_NAMES, LAST_NAMES, syntheticNameForIndex };
