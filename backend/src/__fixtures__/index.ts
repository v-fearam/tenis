/**
 * Shared test fixtures for backend unit tests.
 * All UUIDs are deterministic strings for predictable assertions.
 */

export const fixtures = {
  // --- Config ---
  config: [
    { clave: 'precio_no_socio', valor: '2000' },
    { clave: 'precio_socio_sin_abono', valor: '1200' },
    { clave: 'precio_socio_abonado', valor: '600' },
    { clave: 'descuento_recurrente', valor: '20' },
  ],

  // --- Canchas ---
  cancha: {
    id: 1,
    nombre: 'Cancha 1',
    hora_apertura: '08:00',
    hora_cierre: '22:00',
  },
  canchas: [
    { id: 1, nombre: 'Cancha 1', hora_apertura: '08:00', hora_cierre: '22:00' },
    { id: 2, nombre: 'Cancha 2', hora_apertura: '08:00', hora_cierre: '22:00' },
  ],

  // --- Usuarios ---
  usuario_admin: {
    id: 'uuid-admin-001',
    email: 'admin@test.com',
    rol: 'admin',
    nombre: 'Admin Test',
    estado: 'activo',
    ok_club: true,
  },
  usuario_socio: {
    id: 'uuid-socio-001',
    email: 'socio@test.com',
    rol: 'socio',
    nombre: 'Socio Test',
    estado: 'activo',
    ok_club: true,
  },
  usuario_socio2: {
    id: 'uuid-socio-002',
    email: 'socio2@test.com',
    rol: 'socio',
    nombre: 'Socio Test 2',
    estado: 'activo',
    ok_club: true,
  },
  usuario_no_socio: {
    id: 'uuid-nosocio-001',
    email: 'nosocio@test.com',
    rol: 'no-socio',
    nombre: 'NoSocio Test',
    estado: 'activo',
    ok_club: false,
  },

  // --- Tipos de Abono ---
  tipo_abono: {
    id: 'uuid-tipo-001',
    nombre: 'Abono Estándar',
    creditos: 8,
    precio: 5000,
    color: '#2196F3',
  },
  tipo_abono_libre: {
    id: 'uuid-tipo-libre',
    nombre: 'Abono Libre',
    creditos: 0,
    precio: 8000,
    color: '#4CAF50',
  },

  // --- Socios ---
  socio_con_abono: {
    id: 'uuid-socio-row-001',
    id_usuario: 'uuid-socio-001',
    id_tipo_abono: 'uuid-tipo-001',
    creditos_disponibles: 5,
    nro_socio: 100,
    activo: true,
  },
  socio_sin_abono: {
    id: 'uuid-socio-row-002',
    id_usuario: 'uuid-socio-002',
    id_tipo_abono: null,
    creditos_disponibles: 0,
    nro_socio: 101,
    activo: true,
  },
  socio_sin_creditos: {
    id: 'uuid-socio-row-003',
    id_usuario: 'uuid-socio-001',
    id_tipo_abono: 'uuid-tipo-001',
    creditos_disponibles: 0,
    nro_socio: 102,
    activo: true,
  },

  // --- Usuarios con socios relation (for cost calculation) ---
  usuario_socio_con_abono: {
    id: 'uuid-socio-001',
    nombre: 'Socio Test',
    rol: 'socio',
    socios: [{ id: 'uuid-socio-row-001', id_tipo_abono: 'uuid-tipo-001', tipo_abono: { nombre: 'Abono Estándar' } }],
  },
  usuario_socio_sin_abono: {
    id: 'uuid-socio-002',
    nombre: 'Socio Sin Abono',
    rol: 'socio',
    socios: [{ id: 'uuid-socio-row-002', id_tipo_abono: null, tipo_abono: null }],
  },
  usuario_no_socio_relation: {
    id: 'uuid-nosocio-001',
    nombre: 'NoSocio Test',
    rol: 'no-socio',
    socios: [],
  },
  usuario_admin_relation: {
    id: 'uuid-admin-001',
    nombre: 'Admin Test',
    rol: 'admin',
    socios: [{ id: 'uuid-admin-socio', id_tipo_abono: null, tipo_abono: null }],
  },

  // --- Turnos ---
  turno_pendiente: {
    id: 'uuid-turno-001',
    id_cancha: 1,
    fecha: '2026-06-15',
    hora_inicio: '09:00',
    hora_fin: '10:30',
    tipo_partido: 'double',
    estado: 'pendiente',
    creado_por: 'uuid-socio-001',
    costo: 1000,
    id_turno_recurrente: null,
  },
  turno_confirmado: {
    id: 'uuid-turno-002',
    id_cancha: 1,
    fecha: '2026-06-15',
    hora_inicio: '11:00',
    hora_fin: '12:30',
    tipo_partido: 'double',
    estado: 'confirmado',
    creado_por: 'uuid-socio-001',
    costo: 1200,
    id_turno_recurrente: null,
  },
  turno_con_jugadores: {
    id: 'uuid-turno-002',
    id_cancha: 1,
    fecha: '2026-06-15',
    hora_inicio: '11:00',
    hora_fin: '12:30',
    tipo_partido: 'double',
    estado: 'confirmado',
    creado_por: 'uuid-socio-001',
    costo: 1200,
    id_turno_recurrente: null,
    turno_jugadores: [
      {
        id: 'uuid-jugador-001',
        id_turno: 'uuid-turno-002',
        id_persona: 'uuid-socio-001',
        nombre_invitado: null,
        tipo_persona: 'socio',
        monto_generado: 600,
        estado_pago: 'pendiente',
        uso_abono: false,
      },
      {
        id: 'uuid-jugador-002',
        id_turno: 'uuid-turno-002',
        id_persona: 'uuid-socio-002',
        nombre_invitado: null,
        tipo_persona: 'socio',
        monto_generado: 600,
        estado_pago: 'pendiente',
        uso_abono: false,
      },
    ],
  },

  // --- Turno Jugadores ---
  jugador_pendiente: {
    id: 'uuid-jugador-001',
    id_turno: 'uuid-turno-002',
    id_persona: 'uuid-socio-001',
    nombre_invitado: null,
    tipo_persona: 'socio',
    monto_generado: 600,
    estado_pago: 'pendiente',
    uso_abono: false,
  },
  jugador_pagado: {
    id: 'uuid-jugador-003',
    id_turno: 'uuid-turno-002',
    id_persona: 'uuid-socio-002',
    nombre_invitado: null,
    tipo_persona: 'socio',
    monto_generado: 600,
    estado_pago: 'pagado',
    uso_abono: false,
  },
  jugador_con_abono: {
    id: 'uuid-jugador-004',
    id_turno: 'uuid-turno-001',
    id_persona: 'uuid-socio-001',
    nombre_invitado: null,
    tipo_persona: 'socio',
    monto_generado: 0,
    estado_pago: 'pendiente',
    uso_abono: true,
  },

  // --- Pagos ---
  pago_cargo: {
    id: 'uuid-pago-001',
    id_turno_jugador: 'uuid-jugador-001',
    id_socio: 'uuid-socio-row-001',
    monto: -600,
    tipo: 'cargo',
  },
  pago_efectivo: {
    id: 'uuid-pago-002',
    id_turno_jugador: 'uuid-jugador-001',
    id_socio: 'uuid-socio-row-001',
    monto: 300,
    tipo: 'pago',
    medio: 'efectivo',
    fecha: '2026-03-01',
  },

  // --- Bloqueos ---
  bloqueo: {
    id: 'uuid-bloqueo-001',
    id_cancha: 1,
    fecha: '2026-06-20',
    hora_inicio: '08:00',
    hora_fin: '22:00',
    tipo: 'completo',
    descripcion: 'Mantenimiento',
    creado_por: 'uuid-admin-001',
  },

  // --- Cierres Mensuales ---
  cierre_mensual: {
    id: 'uuid-cierre-001',
    mes_anio: '2026-02-01',
    ingreso_abonos: 50000,
    ingreso_turnos: 30000,
    ingreso_recurrentes: 10000,
    cantidad_socios_con_abono: 10,
    detalle_abonos: [],
    ejecutado_por: 'uuid-admin-001',
  },
};
