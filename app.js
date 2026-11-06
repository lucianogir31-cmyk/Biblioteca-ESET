// ============================================================
// CONFIGURACIÓN
// ============================================================
const LOGOIMG = '<img class="logo" src="img/logo.png" alt="Logo ESET UNQ">';
const K = 'bib_esc_v2';

// ⚠️ REEMPLAZÁ ESTOS DOS VALORES POR LOS DE TU PROYECTO SUPABASE
const SUPABASE_URL = 'https://xpizjwlnhzwynsuzyqqb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-UGqBJZx3t97iaxM-LF9eQ_64Qv5s37';

// Cliente Supabase tolerante a fallos (si el SDK no cargó, sigue con localStorage)
let supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('SDK de Supabase no disponible. Se usará solo localStorage.');
  }
} catch (e) {
  console.warn('No se pudo inicializar Supabase:', e);
}

const ov = document.getElementById('ov');
let S = null, me = null, V = 'login', A = {}, MSG = null;
let saveTimer = null;

const COURSES = (() => {
  const a = [];
  for (let y = 1; y <= 3; y++) ['A', 'B', 'C'].forEach(d => a.push(y + '° ' + d));
  for (let y = 4; y <= 7; y++) ['Programación', 'Alimentos'].forEach(d => a.push(y + '° ' + d));
  for (let y = 4; y <= 6; y++) ['Bachillerato en Comunicación', 'ATD'].forEach(d => a.push(y + '° ' + d));
  return a;
})();

const courseSel = (id, v, ph) => {
  const L = v && !COURSES.includes(v) ? [v, ...COURSES] : COURSES;
  return `<select id="${id}"><option value="">${ph || 'Elegí tu curso'}</option>${L.map(c => `<option ${c == v ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
};

const greet = () => me && me.role != 'bib'
  ? `<div class="card greet"><h2>Hola, ${esc(me.name.split(' ')[0])} · ${me.tipo == 'docente' ? 'Docente' : esc(me.curso || '')}</h2><p style="margin:.2em 0 0">¿Qué querés leer o reservar hoy?</p></div>`
  : '';

const $ = i => document.getElementById(i);
const val = i => $(i) ? $(i).value.trim() : '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const addD = (d, n) => {
  let x = new Date(d + 'T12:00:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
const fm = d => d ? d.split('-').reverse().join('/') : '';
const uid = () => Math.random().toString(36).slice(2, 9);
const hab = d => {
  let w = new Date(d + 'T12:00:00').getDay();
  return !(S.cfg.finde && (w == 0 || w == 6)) && !S.cfg.nh.includes(d);
};
const dueDate = (d, n) => {
  let x = d;
  while (n > 0) {
    x = addD(x, 1);
    if (hab(x)) n--;
  }
  return x;
};

// sha tolerante: si crypto.subtle no está disponible, usa un hash simple de respaldo
const sha = async s => {
  try {
    if (window.crypto && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('esc' + s));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('crypto.subtle no disponible, usando hash de respaldo:', e);
  }
  // Hash de respaldo (NO seguro, solo para que la app funcione en file://)
  let h = 0;
  const str = 'esc' + s;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return 'fallback_' + h.toString(16);
};

// ============================================================
// PERSISTENCIA
// ============================================================
const save = () => {
  // Respaldo local siempre
  try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {}

  // Supabase con debounce
  if (!supabase) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const { error } = await supabase
        .from('app_state')
        .upsert(
          { id: 'main', data: S, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      if (error) console.error('Error guardando en Supabase:', error);
    } catch (e) {
      console.error('Error de red al guardar en Supabase:', e);
    }
  }, 500);
};

const log = (a, d) => { S.audit.unshift({ t: new Date().toLocaleString('es-AR'), u: me ? me.name : 'Sistema', a, d }); S.audit = S.audit.slice(0, 300); };
const note = (u, t) => S.notes.unshift({ id: uid(), u, t, d: today() });
const ask = (t, f) => {
  $('ovt').textContent = t;
  ov.style.display = 'flex';
  $('ovy').onclick = () => { ov.style.display = 'none'; f(); };
  $('ovy').focus();
};
const usr = i => S.users.find(u => u.id == i) || { name: '(socio eliminado)' };
const bk = i => S.books.find(b => b.id == i);
const cp = c => {
  for (const b of S.books) {
    const k = b.c.find(x => x.code == c);
    if (k) return { b, k };
  }
  return null;
};
const avail = b => b.c.filter(k => k.st == 'd').length;
const actCopies = b => b.c.filter(k => k.st != 'b').length;
const badge = b => {
  const n = avail(b);
  return n
    ? `<span class="badge ok">Disponible (${n})</span>`
    : actCopies(b)
      ? `<span class="badge er">Prestado</span>`
      : `<span class="badge wa">Sin ejemplares</span>`;
};
const stB = s => ({
  d: '<span class="badge ok">Disponible</span>',
  r: '<span class="badge wa">Reservado</span>',
  p: '<span class="badge er">Prestado</span>',
  b: '<span class="badge">De baja</span>'
}[s]);
const myLoans = u => S.loans.filter(l => l.u == u && !l.ret);
const late = l => !l.ret && l.due < today();

async function migrate() {
  let ch = 0;
  const c = S.cfg;
  if (c.limiteDoc == null) { c.limiteDoc = 3; c.limiteCurso = 23; ch = 1; }
  if (!S.rcs) {
    S.rcs = [
      { id: 'r1', n: 'Proyector 1', k: 'proyector' },
      { id: 'r2', n: 'Proyector 2', k: 'proyector' },
      { id: 'r3', n: 'Sala de lectura', k: 'espacio' },
      { id: 'r4', n: 'Sala de estudio', k: 'espacio' }
    ];
    S.rv = [];
    ch = 1;
  }
  if (!S.cats.includes('No ficción')) { S.cats.push('No ficción'); ch = 1; }

  const addB = (t, a, g, y, sm, p, n) => {
    if (S.books.some(b => b.t == t)) return;
    S.books.push({ id: 'b' + uid(), t, a, g, y, s: sm, f: 'Papel', c: Array.from({ length: n }, (_, j) => ({ code: p + '-' + (j + 1), st: 'd' })) });
    ch = 1;
  };
  addB('Operación Masacre', 'Rodolfo Walsh', 'No ficción', 1957, 'Investigación periodística sobre los fusilamientos clandestinos de civiles en junio de 1956, en José León Suárez.', 'OM01', 2);
  addB('Cromañón', '(completar autor)', 'No ficción', 2004, 'Libro sobre la tragedia del 30 de diciembre de 2004 en Buenos Aires y la memoria de las víctimas.', 'CR01', 1);

  if (!S.users.some(u => u.user == 'matias')) {
    S.users.push({ id: 'u' + uid(), name: 'Matías Maldonado', user: 'matias', h: await sha('matias123'), role: 'alu', email: 'matias@mail.com', tipo: 'alumno', curso: '6° Programación' });
    ch = 1;
  }
  if (!S.users.some(u => u.user == 'docente')) {
    S.users.push({ id: 'u' + uid(), name: 'Carolina Ríos', user: 'docente', h: await sha('docente123'), role: 'alu', email: 'carolina@mail.com', tipo: 'docente', curso: '' });
    ch = 1;
  }
  if (ch) save();
}

// ============================================================
// INICIALIZACIÓN BLINDADA
// ============================================================
async function init() {
  // 1. Intentar cargar desde Supabase (si está disponible)
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('app_state')
        .select('data')
        .eq('id', 'main')
        .maybeSingle();

      if (error) {
        console.warn('Error al leer Supabase:', error);
      } else if (data?.data) {
        const d = data.data;
        // Validar que tenga la forma esperada antes de aceptarlo
        if (d && d.books && d.users && d.cfg) {
          S = d;
        } else {
          console.warn('El estado en Supabase no tiene la forma esperada. Se ignora.');
        }
      }
    }
  } catch (e) {
    console.warn('No se pudo cargar de Supabase:', e);
  }

  // 2. Fallback: localStorage
  if (!S) {
    try { S = JSON.parse(localStorage.getItem(K)); } catch (e) {}
    if (S && (!S.books || !S.users || !S.cfg)) S = null;
  }

  // 3. Semilla inicial si no hay nada válido
  if (!S) {
    try {
      const h1 = await sha('biblio123'), h2 = await sha('alumno123');
      const t = today();
      const bs = [
        ['El principito', 'Antoine de Saint-Exupéry', 'Novela', 1943, 'Un piloto perdido en el desierto conoce a un pequeño príncipe que viaja entre planetas.', 2],
        ['Cien años de soledad', 'Gabriel García Márquez', 'Novela', 1967, 'La historia de la familia Buendía en el pueblo de Macondo.', 2],
        ['Ficciones', 'Jorge Luis Borges', 'Cuentos', 1944, 'Cuentos fantásticos sobre laberintos, bibliotecas y espejos.', 1],
        ['Rayuela', 'Julio Cortázar', 'Novela', 1963, 'Novela que puede leerse en más de un orden.', 1],
        ['Martín Fierro', 'José Hernández', 'Poesía', 1872, 'Poema narrativo del gaucho argentino.', 3],
        ['Diario de Ana Frank', 'Ana Frank', 'Biografía', 1947, 'El diario de una joven escondida durante la guerra.', 2],
        ['Breve historia del tiempo', 'Stephen Hawking', 'Ciencia', 1988, 'Introducción al universo, los agujeros negros y el tiempo.', 1],
        ['Los juegos del hambre', 'Suzanne Collins', 'Aventura', 2008, 'Una joven debe sobrevivir en un torneo mortal.', 2],
        ['Matemática divertida', 'Adrián Paenza', 'Ciencia', 2005, 'Problemas y curiosidades matemáticas para todos.', 2],
        ['Cuentos de la selva', 'Horacio Quiroga', 'Cuentos', 1918, 'Relatos de animales de la selva misionera.', 2],
        ['Sobre héroes y tumbas', 'Ernesto Sabato', 'Novela', 1961, 'Novela sobre Buenos Aires, el amor y la locura.', 1],
        ['Atlas del mundo', 'Varios autores', 'Referencia', 2020, 'Mapas y datos de todos los países.', 1],
        ['Monster', 'Naoki Urasawa', 'Manga', 1994, 'Un brillante neurocirujano de Düsseldorf decide salvar la vida de un niño herido. Años después, empieza a sospechar que ese niño se convirtió en un peligroso asesino y emprende su búsqueda. Thriller psicológico del gran maestro del manga.', 2, 'Manga (tomo)'],
        ['20th Century Boys', 'Naoki Urasawa', 'Manga', 1999, 'Un grupo de amigos de la infancia descubre que un misterioso líder usa el símbolo de su club secreto para amenazar al mundo.', 2, 'Manga (tomo)'],
        ['Death Note', 'Tsugumi Ohba y Takeshi Obata', 'Manga', 2003, 'Un estudiante encuentra un cuaderno capaz de cambiar el destino de quien aparezca escrito en él.', 2, 'Manga (tomo)'],
        ['Fullmetal Alchemist', 'Hiromu Arakawa', 'Manga', 2001, 'Dos hermanos alquimistas buscan la piedra filosofal para recuperar lo que perdieron.', 2, 'Manga (tomo)'],
        ['Dragon Ball', 'Akira Toriyama', 'Manga', 1984, 'Las aventuras de Goku en busca de las esferas del dragón.', 2, 'Manga (tomo)'],
        ['El Eternauta', 'H. G. Oesterheld y Francisco Solano López', 'Historieta', 1957, 'Una nevada mortal cae sobre Buenos Aires y un grupo de sobrevivientes se organiza para resistir.', 2, 'Historieta'],
        ['Mafalda', 'Quino', 'Historieta', 1964, 'Las tiras de una nena curiosa que se preocupa por el mundo y la humanidad.', 2, 'Historieta'],
        ['Maus', 'Art Spiegelman', 'Historieta', 1980, 'Un hijo cuenta, en forma de historieta, la historia de su padre sobreviviente del Holocausto.', 1, 'Historieta'],
        ['Harry Potter y la piedra filosofal', 'J. K. Rowling', 'Fantasía', 1997, 'Un niño descubre que es mago el día que cumple once años y entra al colegio Hogwarts.', 3],
        ['El hobbit', 'J. R. R. Tolkien', 'Fantasía', 1937, 'Bilbo Bolsón sale de su casa en una aventura con enanos y un dragón.', 2],
        ['Percy Jackson y el ladrón del rayo', 'Rick Riordan', 'Fantasía', 2005, 'Un chico descubre que es hijo de un dios griego y debe evitar una guerra entre dioses.', 2],
        ['Un estudio en escarlata', 'Arthur Conan Doyle', 'Misterio', 1887, 'Primer caso de Sherlock Holmes y el doctor Watson.', 1],
        ['Diez negritos', 'Agatha Christie', 'Misterio', 1939, 'Diez personas llegan a una isla y comienzan a desaparecer una por una.', 2],
        ['Drácula', 'Bram Stoker', 'Misterio', 1897, 'Un abogado viaja a Transilvania y conoce al conde Drácula.', 1],
        ['1984', 'George Orwell', 'Ciencia ficción', 1949, 'Una sociedad vigilada por un poder que controla todo, hasta el pensamiento.', 2],
        ['Fahrenheit 451', 'Ray Bradbury', 'Ciencia ficción', 1953, 'En un futuro donde los libros están prohibidos, un bombero empieza a dudar.', 2],
        ['Un mundo feliz', 'Aldous Huxley', 'Ciencia ficción', 1932, 'Una sociedad perfecta construida sobre el control y el placer.', 1],
        ['La metamorfosis', 'Franz Kafka', 'Novela', 1915, 'Una mañana, Gregor Samsa despierta convertido en un insecto.', 2],
        ['Crónica de una muerte anunciada', 'Gabriel García Márquez', 'Novela', 1981, 'Todo el pueblo sabe que van a matar a Santiago Nasar, menos él.', 2],
        ['El túnel', 'Ernesto Sabato', 'Novela', 1948, 'Un pintor cuenta cómo llegó a cometer un crimen por obsesión.', 1],
        ['Bestiario', 'Julio Cortázar', 'Cuentos', 1951, 'Ocho cuentos donde lo cotidiano se vuelve inquietante.', 1],
        ['Antología poética', 'Alfonsina Storni', 'Poesía', 1938, 'Selección de poemas de una de las grandes voces de la poesía argentina.', 1],
        ['Cosmos', 'Carl Sagan', 'Ciencia', 1980, 'Un recorrido por el universo, las estrellas y el lugar de la Tierra en él.', 1]
      ];

      S = {
        cfg: { dias: { alumno: 14, docente: 30 }, limite: 3, renov: 7, maxRenov: 2, resDias: 3, rec: 2, intentos: 3, finde: true, nh: [] },
        cats: ['Manga', 'Historieta', 'Novela', 'Cuentos', 'Poesía', 'Fantasía', 'Misterio', 'Ciencia ficción', 'Biografía', 'Ciencia', 'Aventura', 'Referencia'],
        users: [
          { id: 'u1', name: 'Marta Gómez (Bibliotecaria)', user: 'biblio', h: h1, role: 'bib', email: 'biblioteca@escuela.edu.ar', tipo: 'docente' },
          { id: 'u2', name: 'Lucía Fernández', user: 'alumno', h: h2, role: 'alu', email: 'lucia@mail.com', tipo: 'alumno', curso: '3° B' }
        ],
        books: bs.map((b, i) => ({
          id: 'b' + i,
          t: b[0], a: b[1], g: b[2], y: b[3], s: b[4], f: b[6] || 'Papel',
          c: Array.from({ length: b[5] }, (_, j) => ({ code: 'L' + String(i + 1).padStart(3, '0') + '-' + (j + 1), st: 'd' }))
        })),
        loans: [], res: [], notes: [], audit: [], wish: {}, rate: {}, fail: {}, rcs: [], rv: []
      };

      const k = S.books[0].c[0];
      k.st = 'p';
      S.loans.push({ id: uid(), u: 'u2', b: 'b0', code: k.code, start: addD(t, -20), due: addD(t, -6), ret: null, n: 0 });

      const k2 = S.books[1].c[0];
      k2.st = 'p';
      S.loans.push({ id: uid(), u: 'u2', b: 'b1', code: k2.code, start: addD(t, -5), due: addD(t, 2), ret: null, n: 0 });

      save();
    } catch (e) {
      console.error('Error creando semilla, usando semilla mínima:', e);
      // Semilla mínima de emergencia para que la UI se dibuje igual
      S = {
        cfg: { dias: { alumno: 14, docente: 30 }, limite: 3, renov: 7, maxRenov: 2, resDias: 3, rec: 2, intentos: 3, finde: true, nh: [] },
        cats: ['Novela'],
        users: [],
        books: [], loans: [], res: [], notes: [], audit: [], wish: {}, rate: {}, fail: {}, rcs: [], rv: []
      };
    }
  }

  // 4. Vinland Saga (por compatibilidad con versiones previas)
  try {
    if (!S.books.some(b => b.t == 'Vinland Saga')) {
      S.books.push({
        id: 'b' + uid(),
        t: 'Vinland Saga', a: 'Makoto Yukimura', g: 'Manga', y: 2005,
        s: 'Thorfinn, hijo de un legendario guerrero vikingo, crece en la Europa del siglo XI buscando venganza. Una historia de guerra, redención y de la búsqueda de una tierra donde vivir en paz.',
        f: 'Manga (tomo)',
        c: [{ code: 'V001-1', st: 'd' }, { code: 'V001-2', st: 'd' }]
      });
      save();
    }
  } catch (e) { console.warn('Vinland Saga:', e); }

  // 5. Migraciones y barrido, tolerantes a fallos
  try { await migrate(); } catch (e) { console.warn('migrate falló:', e); }
  try { sweep(); } catch (e) { console.warn('sweep falló:', e); }

  // 6. Dibujar SIEMPRE, con try/catch final
  try {
    draw();
  } catch (e) {
    console.error('draw falló:', e);
    document.getElementById('app').innerHTML =
      '<main><div class="card"><h2>Error al cargar la interfaz</h2><p class="mut">' +
      esc(e.message) + '</p><p class="mut">Revisá la consola del navegador para más detalles.</p></div></main>';
  }
}

function sweep() {
  const t = today();
  S.res.filter(r => r.st == 'lista' && r.exp < t).forEach(r => {
    r.st = 'vencida';
    note(r.u, 'Tu reserva de "' + bk(r.b).t + '" venció por no retirarla.');
    free(r.code);
  });
  S.loans.filter(l => !l.ret && !l.rem && l.due >= t && l.due <= addD(t, S.cfg.rec)).forEach(l => {
    l.rem = 1;
    note(l.u, 'Recordatorio: "' + bk(l.b).t + '" vence el ' + fm(l.due) + '.');
  });
  save();
}

function free(code) {
  const { b, k } = cp(code);
  const nx = S.res.filter(r => r.b == b.id && r.st == 'espera').sort((x, y) => x.d > y.d ? 1 : -1)[0];
  if (nx) {
    nx.st = 'lista';
    nx.code = code;
    nx.exp = addD(today(), S.cfg.resDias);
    k.st = 'r';
    note(nx.u, '¡Tu libro "' + b.t + '" ya está listo para retirar! Tenés hasta el ' + fm(nx.exp) + '.');
  } else {
    k.st = 'd';
  }
}

function reserve(bid) {
  const b = bk(bid);
  if (S.res.some(r => r.u == me.id && r.b == bid && ['lista', 'espera'].includes(r.st))) return 'Ya tenés una reserva de este libro.';
  if (myLoans(me.id).some(l => l.b == bid)) return 'Ya tenés este libro prestado.';
  const k = b.c.find(x => x.st == 'd');
  const r = { id: uid(), u: me.id, b: bid, d: today(), st: k ? 'lista' : 'espera' };
  if (k) { k.st = 'r'; r.code = k.code; r.exp = addD(today(), S.cfg.resDias); }
  S.res.push(r);
  log('Reserva', b.t + ' - ' + me.name);
  save();
  return null;
}

function cancelRes(id) {
  const r = S.res.find(x => x.id == id);
  const was = r.st;
  r.st = 'cancelada';
  if (was == 'lista') free(r.code);
  log('Cancelación de reserva', bk(r.b).t);
  save();
  draw();
}

function lend(u, code) {
  const x = cp(code);
  if (!x) return 'No encontramos ese código de ejemplar.';
  const { b, k } = x;
  const us = usr(u);
  if (k.st == 'b') return 'Este ejemplar está dado de baja.';
  if (k.st == 'p') return 'Este ejemplar ya está prestado.';
  const r = S.res.find(z => z.code == code && z.st == 'lista');
  if (r && r.u != u) return 'Este ejemplar está reservado para ' + usr(r.u).name + '.';
  const lim = us.tipo == 'docente' ? (S.cfg.limiteDoc || 3) : S.cfg.limite;
  if (myLoans(u).length >= lim) return us.name + ' ya tiene el máximo de ' + lim + ' préstamos.';
  if (S.loans.some(l => l.u == u && !l.ret && late(l))) return us.name + ' tiene un libro vencido. Debe devolverlo primero.';
  if (r) r.st = 'retirada';
  k.st = 'p';
  const t = today();
  S.loans.push({ id: uid(), u, b: b.id, code, start: t, due: dueDate(t, S.cfg.dias[us.tipo] || 14), ret: null, n: 0 });
  log('Préstamo', b.t + ' (' + code + ') a ' + us.name);
  save();
  return null;
}

function renew(id) {
  const l = S.loans.find(x => x.id == id);
  if (S.res.some(r => r.b == l.b && r.u != l.u && ['lista', 'espera'].includes(r.st))) return 'No se puede renovar: otro socio reservó este libro.';
  if (l.n >= S.cfg.maxRenov) return 'Ya se usaron las ' + S.cfg.maxRenov + ' renovaciones permitidas.';
  if (late(l)) return 'El préstamo está vencido; primero hay que devolverlo.';
  l.due = dueDate(l.due, S.cfg.renov);
  l.n++;
  l.rem = 0;
  log('Renovación', bk(l.b).t);
  save();
  return null;
}

function giveBack(code) {
  const l = S.loans.find(x => x.code == code && !x.ret);
  if (!l) return 'Ese ejemplar no figura como prestado.';
  l.ret = today();
  free(code);
  log('Devolución', bk(l.b).t + ' (' + code + ')');
  save();
  return l;
}

function go(v, a = {}) {
  const bibOnly = ['inicio', 'prestar', 'devolver', 'prestamos', 'libros', 'reportes', 'config', 'socios'];
  if (bibOnly.includes(v) && (!me || me.role != 'bib')) v = 'catalogo';
  A = a;
  V = v;
  MSG = null;
  draw();
  scrollTo(0, 0);
}

function say(t, ok = true) { MSG = { t, ok }; draw(); }
const mbox = () => MSG ? `<div class="msg ${MSG.ok ? 'ok' : 'er'}" role="alert">${esc(MSG.t)}</div>` : '';
const empty = t => `<p class="card mut">${t}</p>`;

function draw() {
  const app = $('app');
  if (!me) {
    app.innerHTML = `
      <header><h1>${LOGOIMG} Biblioteca Eset</h1></header>
      <main>
        ${mbox()}
        <section class="hero">
          <p class="sub">Escuela Secundaria de Educación Técnica · Universidad Nacional de Quilmes</p>
          ${loginV()}
        </section>
      </main>`;
    return;
  }

  const bib = me.role == 'bib';
  const nu = S.notes.filter(n => n.u == me.id).length;
  const items = bib
    ? [['inicio', 'Inicio'], ['catalogo', 'Catálogo'], ['prestar', 'Prestar'], ['devolver', 'Devolver'], ['prestamos', 'Préstamos activos'], ['libros', 'Libros'], ['recursos', 'Recursos'], ['socios', 'Socios'], ['reportes', 'Reportes'], ['config', 'Configuración']]
    : [['catalogo', 'Catálogo'], ['mis', 'Mis libros' + (nu ? ' (' + nu + ')' : '')], ['recursos', 'Recursos'], ['deseos', 'Mi lista de deseos'], ['perfil', 'Mis datos']];

  const f = { login: loginV, inicio: inicioV, catalogo: catV, ficha: fichaV, prestar: prestarV, devolver: devolverV, prestamos: prestamosV, libros: librosV, socios: sociosV, reportes: reportesV, config: configV, recursos: recursosV, mis: misV, deseos: deseosV, perfil: perfilV }[V] || catV;

  app.innerHTML = `
    <header>
      <h1>${LOGOIMG} Biblioteca Eset</h1>
      <span>
        ${esc(me.name)}
        <button class="s" onclick="logout()">Cerrar sesión</button>
        <button class="s" onclick="theme()" aria-label="Cambiar entre fondo claro y oscuro">Claro / Oscuro</button>
      </span>
    </header>
    <nav aria-label="Menú principal">
      ${items.map(i => `<button class="${V == i[0] ? 'on' : ''}" onclick="go('${i[0]}')">${i[1]}</button>`).join('')}
    </nav>
    <main>
      ${mbox()}
      ${f()}
    </main>`;

  if (V == 'catalogo') lista();
  if (V == 'reportes') rep();
}

function theme() {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme == 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
}

function logout() { me = null; V = 'login'; MSG = { t: 'Cerraste sesión correctamente.', ok: true }; draw(); }

/* ---------- Acceso ---------- */

function loginV() {
  if (A.mode == 'reg') return `
    <h2>Crear mi cuenta</h2>
    <div class="card">
      <label for="rn">Nombre y apellido</label><input id="rn" value="${esc((A.f || {}).rn)}">
      <label for="ru">Nombre de usuario</label><input id="ru" value="${esc((A.f || {}).ru)}">
      <label for="re">Correo electrónico</label><input id="re" type="email" value="${esc((A.f || {}).re)}">
      <label for="rtp">Soy</label>
      <select id="rtp" onchange="$('rcb').style.display=this.value=='docente'?'none':'block'">
        <option value="alumno">Alumno/a</option>
        <option value="docente" ${(A.f || {}).rtp == 'docente' ? 'selected' : ''}>Docente</option>
      </select>
      <div id="rcb" style="display:${(A.f || {}).rtp == 'docente' ? 'none' : 'block'}">
        <label for="rc">Tu curso</label>${courseSel('rc', (A.f || {}).rc)}
      </div>
      <label for="rp">Contraseña (mínimo 6 caracteres)</label><input id="rp" type="password">
      <p><button onclick="reg()">Crear cuenta</button> <button class="s" onclick="A={};MSG=null;draw()">Volver</button></p>
    </div>`;

  if (A.mode == 'rec') return `
    <h2>Recuperar contraseña</h2>
    <div class="card">
      <p>Escribí tu usuario y el correo con el que te registraste. Te enviaremos un enlace válido por 15 minutos.</p>
      <label for="cu">Usuario</label><input id="cu">
      <label for="ce">Correo electrónico</label><input id="ce" type="email">
      ${A.ok ? `<label for="cn">Nueva contraseña (simula abrir el enlace del correo)</label><input id="cn" type="password">` : ''}
      <p>
        <button onclick="rec()">${A.ok ? 'Guardar nueva contraseña' : 'Enviar enlace'}</button>
        <button class="s" onclick="A={};MSG=null;draw()">Volver</button>
      </p>
    </div>`;

  return `
    <h2>Ingresar</h2>
    <div class="card">
      <label for="lu">Usuario</label><input id="lu" autocomplete="username">
      <label for="lp">Contraseña</label><input id="lp" type="password" autocomplete="current-password" onkeydown="if(event.key=='Enter')login()">
      <p><button onclick="login()">Ingresar</button></p>
      <p>
        <button class="s" onclick="A={mode:'reg'};MSG=null;draw()">Quiero registrarme (alumno o docente)</button>
        <button class="s" onclick="A={mode:'rec'};MSG=null;draw()">Olvidé mi contraseña</button>
      </p>
    </div>
    <p class="card mut">
      <b>Para probar:</b> bibliotecaria → <b>biblio</b> / <b>biblio123</b> ·
      alumno (6° Programación) → <b>matias</b> / <b>matias123</b> ·
      alumna (3° B) → <b>alumno</b> / <b>alumno123</b> ·
      docente → <b>docente</b> / <b>docente123</b>.
    </p>`;
}

async function login() {
  const u = val('lu').toLowerCase(), p = $('lp').value;
  const f = S.fail[u] || { n: 0, until: 0 };
  if (f.until > Date.now()) return say('Cuenta bloqueada por varios intentos. Esperá 5 minutos e intentá de nuevo.', false);
  const us = S.users.find(x => x.user == u);
  if (us && us.h == await sha(p)) {
    S.fail[u] = { n: 0, until: 0 };
    me = us;
    V = 'catalogo';
    A = {};
    MSG = null;
    log('Inicio de sesión', '');
    save();
    draw();
    return;
  }
  f.n++;
  if (f.n >= S.cfg.intentos) { f.until = Date.now() + 300000; f.n = 0; }
  S.fail[u] = f;
  save();
  say('Usuario o contraseña incorrectos.', false);
}

async function reg() {
  const n = val('rn'), u = val('ru').toLowerCase(), e = val('re'), p = $('rp').value;
  A.f = { rn: val('rn'), ru: val('ru'), re: val('re'), rc: val('rc'), rtp: val('rtp') };
  if (!n || !u || !e.includes('@') || p.length < 6) return say('Completá todos los datos. La contraseña debe tener al menos 6 caracteres y el correo debe ser válido.', false);
  if (S.users.some(x => x.user == u)) return say('Ese nombre de usuario ya existe. Elegí otro.', false);
  if (val('rtp') != 'docente' && !val('rc')) return say('Elegí tu curso.', false);
  const id = uid();
  S.users.push({ id, name: n, user: u, h: await sha(p), role: 'alu', email: e, tipo: val('rtp') == 'docente' ? 'docente' : 'alumno', curso: val('rtp') == 'docente' ? '' : val('rc') });
  note(id, '¡Bienvenido/a! Enviamos la confirmación de tu cuenta a ' + e + '.');
  save();
  A = {};
  say('Cuenta creada. Te enviamos un correo de confirmación. Ya podés ingresar.');
}

async function rec() {
  const us = S.users.find(x => x.user == val('cu').toLowerCase() && x.email == val('ce'));
  if (!A.ok) {
    A.ok = !!us;
    if (!us) { A = { mode: 'rec' }; return say('Si los datos son correctos, recibirás un correo con el enlace.'); }
    return say('Enlace enviado al correo. (En esta demostración se habilita el campo de nueva contraseña.)');
  }
  if (!us || $('cn').value.length < 6) return say('Revisá los datos. La contraseña nueva debe tener 6 caracteres como mínimo.', false);
  us.h = await sha($('cn').value);
  save();
  A = {};
  say('Contraseña cambiada. Ya podés ingresar.');
}

/* ---------- Inicio bibliotecaria ---------- */

function inicioV() {
  const venc = S.loans.filter(late).length, ret = S.res.filter(r => r.st == 'lista').length, esp = S.res.filter(r => r.st == 'espera').length;
  return `
    <h2>¡Hola, ${esc(me.name.split(' ')[0])}! ¿Qué querés hacer?</h2>
    <div class="tiles">
      <button class="tile" onclick="go('prestar')">📖 Prestar un libro<small>${ret} reserva(s) esperan ser retiradas</small></button>
      <button class="tile" onclick="go('devolver')">↩️ Recibir una devolución<small>${S.loans.filter(l => !l.ret).length} libros prestados</small></button>
      <button class="tile" onclick="go('catalogo')">🔎 Buscar un libro<small>${S.books.length} títulos en el catálogo</small></button>
      <button class="tile" onclick="go('prestamos',{od:1})" style="${venc ? 'background:var(--er);border-color:var(--er);color:#fff' : ''}">⏰ Libros vencidos<small>${venc} sin devolver</small></button>
      <button class="tile" onclick="go('libros')">📚 Agregar o cambiar libros</button>
      <button class="tile" onclick="go('reportes')">📊 Reportes<small>${esp} personas en lista de espera</small></button>
    </div>`;
}

/* ---------- Catálogo ---------- */

const pal = ['#7a1f2b', '#1d4a6b', '#3b5a2a', '#5b3a7a', '#8a4b12', '#1f5a55', '#6b2d4f', '#34495e'];
const cover = b => {
  let h = 0;
  for (const c of b.t) h = (h * 31 + c.charCodeAt(0)) % 997;
  return `<div class="cov" style="background:${b.t == 'Monster' ? '#141414' : pal[h % pal.length]}"><span>${esc(b.g)}</span><b>${esc(b.t)}</b><span>${esc(b.a)}</span></div>`;
};
const card = b => `<button class="bk" onclick="go('ficha',{id:'${b.id}'})" aria-label="Ver ${esc(b.t)}">${cover(b)}<span class="bm">${badge(b)}</span></button>`;

function catV() {
  return `
    ${greet()}
    <h2>Catálogo de la biblioteca</h2>
    <div class="card">
      <div class="row">
        <div><label for="q">Escribí el título o el autor</label><input id="q" value="${esc(A.q || '')}" onkeydown="if(event.key=='Enter')lista(1)"></div>
        <div><label for="by">Buscar en</label><select id="by"><option value="">Título y autor</option><option value="t">Solo título</option><option value="a">Solo autor</option></select></div>
        <button onclick="lista(1)">Buscar</button>
      </div>
      <div class="row">
        <div><label for="fy">Año (ejemplo: 1967)</label><input id="fy" type="number"></div>
        <div><label for="fa">Disponibilidad</label><select id="fa"><option value="">Todos</option><option value="1">Solo disponibles</option></select></div>
      </div>
      <label>Elegí un género</label>
      <div class="chips" id="chips"></div>
    </div>
    <div id="lst"></div>`;
}

function lista(f) {
  if (f) A.q = val('q');
  const nz = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = nz(A.q), by = $('by') ? $('by').value : '', g = A.g || '', y = val('fy'), a = val('fa');
  if ($('chips')) $('chips').innerHTML = ['Todos', ...S.cats].map(c => `<button class="${(g || 'Todos') == c ? '' : 's'}" onclick="A.g='${c == 'Todos' ? '' : c}';lista(0)">${c}</button>`).join('');
  const r = S.books.filter(b => (!q || (by != 'a' && nz(b.t).includes(q)) || (by != 't' && nz(b.a).includes(q))) && (!g || b.g == g) && (!y || b.y == y) && (!a || avail(b) > 0));
  const act = q || g || y || a;
  let h = '';
  if (!r.length) {
    h = empty('No encontramos libros con esos datos. Probá con menos palabras o elegí “Todos” en géneros.');
  } else if (act) {
    h = `<p class="mut">${r.length} libro(s) encontrado(s)</p><div class="grid">${r.map(card).join('')}</div>`;
  } else {
    const m = bk0('Monster');
    h = (m ? `<div class="card feat"><div style="width:170px;max-width:100%;flex:0 0 170px">${cover(m)}</div><div style="flex:1 1 260px;min-width:0"><h3 style="margin-top:0">Destacado de la semana</h3><b style="font-size:1.4rem">${esc(m.t)}</b><br>${esc(m.a)}<p>${esc(m.s)}</p>${badge(m)} <button onclick="go('ficha',{id:'${m.id}'})">Ver detalle</button></div></div>` : '')
      + S.cats.filter(c => S.books.some(b => b.g == c)).map(c => `<h3>${esc(c)}</h3><div class="grid">${S.books.filter(b => b.g == c).map(card).join('')}</div>`).join('');
  }
  if ($('lst')) $('lst').innerHTML = h;
}

const bk0 = t => S.books.find(b => b.t == t);

function fichaV() {
  const b = bk(A.id);
  const rt = S.rate[b.id] || [];
  const avg = rt.length ? (rt.reduce((s, x) => s + x.n, 0) / rt.length).toFixed(1) : null;
  const bib = me.role == 'bib';
  const mine = S.res.find(r => r.u == me.id && r.b == b.id && ['lista', 'espera'].includes(r.st));
  const w = (S.wish[me.id] || []).includes(b.id);

  return `
    <button class="s" onclick="go('catalogo',{q:A.q})">← Volver a la búsqueda</button>
    <div class="card">
      <div style="max-width:220px;margin-bottom:12px">${cover(b)}</div>
      <h2>${esc(b.t)}</h2>
      <p>
        <b>Autor:</b> ${esc(b.a)}<br>
        <b>Género:</b> ${esc(b.g)} · <b>Año:</b> ${b.y} · <b>Formato:</b> ${esc(b.f)}
      </p>
      <p>${esc(b.s)}</p>
      <p>${badge(b)} ${avg ? `<span class="mut">Valoración: ${avg} de 5 (${rt.length})</span>` : ''}</p>
      ${bib
        ? `<h3>Ejemplares</h3><div class="tw"><table><tr><th>Código</th><th>Estado</th></tr>${b.c.map(k => `<tr><td>${k.code}</td><td>${stB(k.st)}</td></tr>`).join('')}</table></div>`
        : `<p>${mine
            ? `<span class="badge wa">${mine.st == 'lista' ? 'Tu reserva está lista para retirar' : 'Estás en lista de espera'}</span>`
            : `<button onclick="doRes('${b.id}')">${avail(b) ? 'Reservar este libro' : 'Anotarme en lista de espera'}</button>`}
            <button class="s" onclick="wish('${b.id}')">${w ? 'Quitar de mi lista de deseos' : 'Guardar en mi lista de deseos'}</button>
          </p>`}
    </div>
    <div class="card">
      <h3>Opiniones</h3>
      ${rt.length ? rt.map(x => `<p><b>${'★'.repeat(x.n)}${'☆'.repeat(5 - x.n)}</b> ${esc(x.t)} <span class="mut">— ${esc(x.who)}</span></p>`).join('') : '<p class="mut">Todavía no hay opiniones.</p>'}
      ${bib ? '' : `<div class="row"><div><label for="rn1">Tu puntaje</label><select id="rn1"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></div><div style="flex:3 1 300px"><label for="rt">Tu comentario</label><input id="rt"></div><button onclick="rate('${b.id}')">Publicar opinión</button></div>`}
    </div>`;
}

function doRes(id) {
  const e = reserve(id);
  if (e) return say(e, false);
  go('mis');
  MSG = { t: 'Reserva registrada correctamente.', ok: true };
  draw();
}

function wish(id) {
  const w = S.wish[me.id] = S.wish[me.id] || [];
  const i = w.indexOf(id);
  i < 0 ? w.push(id) : w.splice(i, 1);
  save();
  say(i < 0 ? 'Guardado en tu lista de deseos.' : 'Quitado de tu lista de deseos.');
}

function rate(id) {
  (S.rate[id] = S.rate[id] || []).push({ n: +$('rn1').value, t: val('rt'), who: me.name.split(' ')[0] });
  save();
  say('¡Gracias por tu opinión!');
}

/* ---------- Préstamos / devoluciones ---------- */

function prestarV() {
  const al = S.users.filter(u => u.role == 'alu'), rs = S.res.filter(r => r.st == 'lista');
  return `
    <h2>Prestar un libro</h2>
    <div class="card">
      <div class="row">
        <div><label for="ps">1. ¿A quién se lo prestás?</label><select id="ps">${al.map(u => `<option value="${u.id}">${esc(u.name)} ${u.tipo == 'docente' ? '(Docente)' : u.curso ? '(' + esc(u.curso) + ')' : ''}</option>`).join('')}</select></div>
        <div><label for="pc">2. Escaneá el código de barras o escribilo</label><input id="pc" placeholder="Ejemplo: L001-1" onkeydown="if(event.key=='Enter')prestar()"></div>
        <button onclick="prestar()">Registrar préstamo</button>
      </div>
    </div>
    <h3>Reservas listas para retirar</h3>
    ${rs.length
      ? `<div class="tw"><table><tr><th>Socio</th><th>Libro</th><th>Código</th><th>Retira hasta</th><th></th></tr>${rs.map(r => `<tr><td>${esc(usr(r.u).name)}</td><td>${esc(bk(r.b).t)}</td><td>${r.code}</td><td>${fm(r.exp)}</td><td><button onclick="entregar('${r.u}','${r.code}')">Entregar</button></td></tr>`).join('')}</table></div>`
      : empty('No hay reservas esperando.')}`;
}

function prestar() {
  const c = val('pc').toUpperCase(), u = val('ps');
  const e = lend(u, c);
  if (e) return say(e, false);
  const l = S.loans[S.loans.length - 1];
  say('Préstamo registrado. Devolución: ' + fm(l.due) + '.');
}

function entregar(u, c) {
  const e = lend(u, c);
  e ? say(e, false) : say('Libro entregado. Reserva convertida en préstamo.');
}

function devolverV() {
  return `
    <h2>Recibir una devolución</h2>
    <div class="card">
      <label for="dc">Escaneá el código de barras o escribilo</label>
      <div class="row">
        <input id="dc" placeholder="Ejemplo: L001-1" onkeydown="if(event.key=='Enter')devolver()">
        <button onclick="devolver()">Registrar devolución</button>
      </div>
    </div>
    <h3>Libros prestados ahora</h3>
    ${tablaP(S.loans.filter(l => !l.ret), 0)}`;
}

function devolver() {
  const r = giveBack(val('dc').toUpperCase());
  if (typeof r == 'string') return say(r, false);
  const sig = S.res.find(x => x.code == r.code && x.st == 'lista');
  say('Devolución registrada: "' + bk(r.b).t + '".' + (sig ? ' Quedó reservado para ' + usr(sig.u).name + '.' : ' El libro quedó disponible.'));
}

function tablaP(ls, ren) {
  return ls.length
    ? `<div class="tw"><table><tr><th>Socio</th><th>Libro</th><th>Código</th><th>Vence</th><th></th></tr>${ls.map(l => `<tr><td>${esc(usr(l.u).name)}</td><td>${esc(bk(l.b).t)}</td><td>${l.code}</td><td>${fm(l.due)} ${late(l) ? '<span class="badge er">Vencido</span>' : ''}</td><td>${ren ? `<button class="s" onclick="renovar('${l.id}')">Renovar</button>` : ''}</td></tr>`).join('')}</table></div>`
    : empty('No hay libros prestados en este momento.');
}

function prestamosV() {
  const q = (A.pq || '').toLowerCase();
  let ls = S.loans.filter(l => !l.ret && (!A.od || late(l)) && (!q || (usr(l.u).name + bk(l.b).t).toLowerCase().includes(q)));
  return `
    <h2>Préstamos activos</h2>
    <div class="card">
      <div class="row">
        <div><label for="pq">Buscar por socio o libro</label><input id="pq" value="${esc(A.pq || '')}" onkeydown="if(event.key=='Enter')go('prestamos',{pq:val('pq'),od:A.od})"></div>
        <button onclick="go('prestamos',{pq:val('pq'),od:A.od})">Buscar</button>
        <button class="s" onclick="go('prestamos',{pq:A.pq,od:A.od?0:1})">${A.od ? 'Ver todos' : 'Ver solo vencidos'}</button>
      </div>
    </div>
    ${tablaP(ls, 1)}`;
}

function renovar(id) {
  const e = renew(id);
  e ? say(e, false) : say('Préstamo renovado. Nueva fecha de devolución: ' + fm(S.loans.find(l => l.id == id).due) + '.');
}

/* ---------- Libros ---------- */

function librosV() {
  const e = A.edit ? bk(A.edit) : null;
  return `
    <h2>Libros del catálogo</h2>
    <div class="card">
      <h3>${e ? 'Modificar libro' : 'Agregar un libro nuevo'}</h3>
      <div class="row">
        <div><label for="lt">Título</label><input id="lt" value="${esc(e?.t)}"></div>
        <div><label for="la">Autor</label><input id="la" value="${esc(e?.a)}"></div>
      </div>
      <div class="row">
        <div><label for="lg">Género</label><select id="lg">${S.cats.map(g => `<option ${e && e.g == g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        <div><label for="ly">Año</label><input id="ly" type="number" value="${e ? e.y : ''}"></div>
        ${e ? '' : `<div><label for="ln">Cantidad de ejemplares</label><input id="ln" type="number" value="1" min="1"></div>`}
      </div>
      <label for="ls">Resumen</label>
      <textarea id="ls">${esc(e?.s)}</textarea>
      <p><button onclick="guardarL()">${e ? 'Guardar cambios' : 'Agregar libro'}</button> ${e ? `<button class="s" onclick="go('libros')">Cancelar</button>` : ''}</p>
    </div>
    <div class="card">
      <h3>Géneros</h3>
      <div class="row"><input id="nc" placeholder="Nuevo género" aria-label="Nuevo género"><button onclick="addCat()">Agregar género</button></div>
      <p class="mut">${S.cats.map(esc).join(' · ')}</p>
    </div>
    <h3>Ejemplares</h3>
    ${S.books.map(b => `
      <div class="card">
        <div class="top">
          <b>${esc(b.t)}</b>
          <span>
            <button class="s" onclick="go('libros',{edit:'${b.id}'})">Modificar</button>
            <button class="s" onclick="addCopy('${b.id}')">+ Ejemplar</button>
          </span>
        </div>
        ${b.c.map(k => `<p>${k.code} ${stB(k.st)} ${k.st == 'd' ? `<button class="d" onclick="baja('${k.code}')">Dar de baja</button>` : ''}</p>`).join('')}
      </div>`).join('')}`;
}

function guardarL() {
  const t = val('lt'), a = val('la');
  if (!t || !a) return say('Completá al menos el título y el autor.', false);
  const e = A.edit ? bk(A.edit) : null;
  if (e) {
    Object.assign(e, { t, a, g: val('lg'), y: +val('ly'), s: val('ls') });
    log('Edición de libro', t);
    A = {};
    save();
    return say('Cambios guardados. Ya se ven en el catálogo.');
  }
  const id = 'b' + uid(), n = +val('ln') || 1, p = id.slice(1, 4).toUpperCase();
  S.books.push({ id, t, a, g: val('lg'), y: +val('ly'), s: val('ls'), f: 'Papel', c: Array.from({ length: n }, (_, j) => ({ code: p + '-' + (j + 1), st: 'd' })) });
  log('Alta de libro', t);
  save();
  say('Libro agregado. Ya está disponible para buscar y prestar.');
}

function addCopy(id) {
  const b = bk(id);
  b.c.push({ code: b.c[0] ? b.c[0].code.split('-')[0] + '-' + (b.c.length + 1) : 'X-1', st: 'd' });
  save();
  say('Ejemplar agregado.');
}

function baja(c) {
  ask('¿Dar de baja el ejemplar ' + c + '? Ya no se podrá reservar ni prestar.', () => {
    cp(c).k.st = 'b';
    log('Baja de ejemplar', c);
    save();
    say('Ejemplar dado de baja.');
  });
}

function addCat() {
  const c = val('nc');
  if (c && !S.cats.includes(c)) {
    S.cats.push(c);
    save();
    say('Género agregado.');
  }
}

/* ---------- Recursos ---------- */

const RK = { proyector: 'Proyector', espacio: 'Espacio' };
const rcn = id => (S.rcs.find(r => r.id == id) || { n: '(recurso dado de baja)' }).n;
const rvName = x => x.k == 'rec' ? rcn(x.r) : x.q + ' ejemplar(es) de "' + (bk(x.b) || { t: '?' }).t + '"';
const rvWhen = x => x.k == 'rec' ? fm(x.date) + ' · ' + x.from + ' a ' + x.to : fm(x.date) + ' (se devuelven el mismo día)';
const stRv = s => ({
  pend: '<span class="badge wa">Pendiente</span>',
  ok: '<span class="badge ok">Aceptada</span>',
  no: '<span class="badge er">Rechazada</span>',
  can: '<span class="badge">Cancelada</span>'
}[s]);

function recursosV() { return me.role == 'bib' ? recBibV() : me.tipo == 'docente' ? recDocV() : recAluV(); }

function recAluV() {
  return `
    ${greet()}
    <h2>Recursos de la biblioteca</h2>
    <div class="card"><h3>💻 Área de computadoras</h3><p>Podés usar las computadoras de la biblioteca cuando la bibliotecaria esté presente. No hace falta reservar: se usan en el momento.</p></div>
    <div class="card"><h3>Proyectores y espacios</h3><p>Los reservan los docentes. Si necesitás uno para una actividad, pedíselo a tu docente.</p></div>`;
}

function recDocV() {
  const mis = S.rv.filter(x => x.u == me.id);
  const rs = S.rcs.map(r => `<option value="${r.id}">${esc(r.n)} (${RK[r.k]})</option>`).join('');
  const bs = S.books.filter(b => avail(b) > 0).map(b => `<option value="${b.id}">${esc(b.t)} (${avail(b)} disponibles)</option>`).join('');
  return `
    ${greet()}
    <h2>Recursos de la biblioteca</h2>
    <div class="card"><h3>💻 Área de computadoras</h3><p>Se usan en el momento, sin reservar.</p></div>
    <div class="card">
      <h3>Reservar un proyector o un espacio</h3>
      <div class="row">
        <div><label for="xr">¿Qué necesitás?</label><select id="xr">${rs}</select></div>
        <div><label for="xd">Día</label><input id="xd" type="date" min="${today()}" value="${today()}"></div>
      </div>
      <div class="row">
        <div><label for="xf">Desde</label><input id="xf" type="time" value="08:00"></div>
        <div><label for="xh">Hasta</label><input id="xh" type="time" value="09:00"></div>
        <div><label for="xc">Curso (opcional)</label>${courseSel('xc', '', 'Sin curso')}</div>
      </div>
      <label for="xm">Motivo</label><input id="xm" placeholder="Ejemplo: clase de Lengua">
      <p><button onclick="reservarR()">Enviar reserva</button></p>
    </div>
    <div class="card">
      <h3>Pedir libros para un curso</h3>
      <p class="mut">Hasta ${S.cfg.limiteCurso} ejemplares por pedido. Se devuelven el mismo día.</p>
      ${bs
        ? `<div class="row"><div><label for="yb">Libro</label><select id="yb">${bs}</select></div><div><label for="yq">Cantidad</label><input id="yq" type="number" min="1" max="${S.cfg.limiteCurso}" value="1"></div></div>
           <div class="row"><div><label for="yc">Curso</label>${courseSel('yc', '', 'Elegí el curso')}</div><div><label for="yd">Día</label><input id="yd" type="date" min="${today()}" value="${today()}"></div></div>
           <p><button onclick="pedirLibros()">Enviar pedido</button></p>`
        : '<p class="mut">Ahora no hay libros disponibles.</p>'}
    </div>
    <h3>Mis reservas de recursos</h3>
    ${mis.length
      ? mis.map(x => `<div class="card top"><div><b>${esc(rvName(x))}</b><br>${rvWhen(x)}${x.curso ? ' · ' + esc(x.curso) : ''}</div><span>${stRv(x.st)} ${['pend', 'ok'].includes(x.st) ? `<button class="s" onclick="ask('¿Cancelar esta reserva?',()=>cancelRv('${x.id}'))">Cancelar</button>` : ''}</span></div>`).join('')
      : empty('Todavía no hiciste reservas de recursos.')}`;
}

function reservarR() {
  const r = val('xr'), d = val('xd'), f = val('xf'), t = val('xh'), m = val('xm');
  if (!r || !d || !f || !t || !m) return say('Completá el recurso, el día, el horario y el motivo.', false);
  if (d < today()) return say('Elegí un día de hoy o futuro.', false);
  if (t <= f) return say('La hora de fin tiene que ser posterior a la de inicio.', false);
  const cl = S.rv.find(x => x.k == 'rec' && x.r == r && x.date == d && ['pend', 'ok'].includes(x.st) && x.from < t && x.to > f);
  if (cl) return say('Ese recurso ya está reservado de ' + cl.from + ' a ' + cl.to + ' ese día. Probá con otro horario.', false);
  S.rv.unshift({ id: uid(), u: me.id, k: 'rec', r, date: d, from: f, to: t, mot: m, curso: val('xc'), st: 'pend', d: today() });
  log('Reserva de recurso', rcn(r) + ' - ' + fm(d));
  save();
  say('Reserva enviada. La bibliotecaria la va a aceptar o rechazar y te avisamos.');
}

function pedirLibros() {
  const b = bk(val('yb')), q = +val('yq'), c = val('yc'), d = val('yd');
  if (!b || !q || !c || !d) return say('Elegí el libro, la cantidad, el curso y el día.', false);
  if (d < today()) return say('Elegí un día de hoy o futuro.', false);
  if (q < 1 || q > S.cfg.limiteCurso) return say('Para un curso podés pedir entre 1 y ' + S.cfg.limiteCurso + ' ejemplares.', false);
  if (q > avail(b)) return say('Hoy hay ' + avail(b) + ' ejemplar(es) disponible(s) de este libro.', false);
  S.rv.unshift({ id: uid(), u: me.id, k: 'lib', b: b.id, q, date: d, curso: c, mot: 'Jornada de clase', st: 'pend', d: today() });
  log('Pedido de libros para un curso', q + ' x ' + b.t);
  save();
  say('Pedido enviado. La bibliotecaria lo va a aceptar o rechazar y te avisamos.');
}

function cancelRv(id) {
  const x = S.rv.find(v => v.id == id);
  x.st = 'can';
  log('Cancelación de reserva de recurso', rvName(x));
  save();
  say('Reserva cancelada.');
}

function decideRv(id, ok) {
  const x = S.rv.find(v => v.id == id);
  if (!x || x.st != 'pend') return;
  if (ok && x.k == 'lib' && (!bk(x.b) || x.q > avail(bk(x.b)))) return say('Ya no hay tantos ejemplares disponibles. Rechazá el pedido o esperá una devolución.', false);
  if (ok && x.k == 'rec' && S.rv.some(v => v != x && v.k == 'rec' && v.r == x.r && v.date == x.date && v.st == 'ok' && v.from < x.to && v.to > x.from)) return say('Se superpone con otra reserva ya aceptada.', false);
  x.st = ok ? 'ok' : 'no';
  note(x.u, (ok ? '¡Aceptamos tu reserva de ' : 'No pudimos aceptar tu reserva de ') + rvName(x) + ' para el ' + fm(x.date) + '.' + (ok ? '' : ' Consultá en la biblioteca.'));
  log(ok ? 'Reserva aceptada' : 'Reserva rechazada', rvName(x) + ' - ' + usr(x.u).name);
  save();
  say(ok ? 'Reserva aceptada. El docente recibió el aviso.' : 'Reserva rechazada. El docente recibió el aviso.');
}

function recBibV() {
  const pe = S.rv.filter(x => x.st == 'pend'), ok = S.rv.filter(x => x.st == 'ok' && x.date >= today()).sort((a, b) => a.date > b.date ? 1 : -1);
  const row = (x, a) => `<tr><td>${esc(usr(x.u).name)}</td><td>${esc(rvName(x))}</td><td>${rvWhen(x)}</td><td>${esc(x.curso || '')} ${esc(x.mot || '')}</td><td>${a}</td></tr>`;
  const tb = (l, a) => `<div class="tw"><table><tr><th>Docente</th><th>Pedido</th><th>Cuándo</th><th>Detalle</th><th></th></tr>${l.map(x => row(x, a(x))).join('')}</table></div>`;
  return `
    <h2>Recursos y reservas de docentes</h2>
    <h3>Pendientes de respuesta (${pe.length})</h3>
    ${pe.length ? tb(pe, x => `<button onclick="decideRv('${x.id}',1)">Aceptar</button> <button class="d" onclick="decideRv('${x.id}',0)">Rechazar</button>`) : empty('No hay reservas pendientes.')}
    <h3>Aceptadas (próximas)</h3>
    ${ok.length ? tb(ok, () => '') : empty('No hay reservas aceptadas próximas.')}
    <h3>Recursos de la biblioteca</h3>
    <div class="card">
      <p class="mut">💻 Área de computadoras: se usa en el momento, no se reserva.</p>
      ${S.rcs.map(r => `<div class="row"><div><label for="n_${r.id}">${RK[r.k]}</label><input id="n_${r.id}" value="${esc(r.n)}"></div><button class="s" onclick="renRc('${r.id}')">Guardar nombre</button><button class="d" onclick="bajaRc('${r.id}')">Dar de baja</button></div>`).join('')}
      <h3>Dar de alta un recurso</h3>
      <div class="row">
        <div><label for="nrn">Nombre</label><input id="nrn" placeholder="Ejemplo: Proyector 3"></div>
        <div><label for="nrk">Tipo</label><select id="nrk"><option value="proyector">Proyector</option><option value="espacio">Espacio</option></select></div>
        <button onclick="addRc()">Agregar</button>
      </div>
    </div>`;
}

function addRc() {
  const n = val('nrn');
  if (!n) return say('Escribí el nombre del recurso.', false);
  S.rcs.push({ id: 'r' + uid(), n, k: val('nrk') });
  log('Alta de recurso', n);
  save();
  say('Recurso agregado. Los docentes ya pueden reservarlo.');
}

function renRc(id) {
  const n = val('n_' + id);
  if (!n) return say('El nombre no puede quedar vacío.', false);
  S.rcs.find(r => r.id == id).n = n;
  log('Cambio de recurso', n);
  save();
  say('Nombre guardado.');
}

function bajaRc(id) {
  if (S.rv.some(x => x.k == 'rec' && x.r == id && ['pend', 'ok'].includes(x.st) && x.date >= today())) return say('Ese recurso tiene reservas pendientes o próximas. Resolvelas antes de darlo de baja.', false);
  ask('¿Dar de baja "' + rcn(id) + '"? Ya no se podrá reservar.', () => {
    const n = rcn(id);
    S.rcs = S.rcs.filter(r => r.id != id);
    log('Baja de recurso', n);
    save();
    say('Recurso dado de baja.');
  });
}

/* ---------- Socios ---------- */

function sociosV() {
  return `
    <h2>Socios</h2>
    <p class="mut">Los alumnos se registran solos desde la pantalla de ingreso. Acá ves a todos.</p>
    <div class="tw">
      <table>
        <tr><th>Nombre</th><th>Usuario</th><th>Curso</th><th>Correo</th><th>Préstamos</th></tr>
        ${S.users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.user)}</td><td>${u.tipo == 'docente' && u.role != 'bib' ? 'Docente' : esc(u.curso || '')}</td><td>${esc(u.email)}</td><td>${myLoans(u.id).length}</td></tr>`).join('')}
      </table>
    </div>`;
}

/* ---------- Alumno ---------- */

function misV() {
  const ns = S.notes.filter(n => n.u == me.id).slice(0, 6);
  const rs = S.res.filter(r => r.u == me.id && ['lista', 'espera'].includes(r.st));
  const ls = myLoans(me.id);
  const hs = S.loans.filter(l => l.u == me.id && l.ret);
  const last = S.loans.filter(l => l.u == me.id).pop();
  const rec = last ? S.books.filter(b => b.g == bk(last.b).g && b.id != last.b && avail(b)).slice(0, 3) : [];
  return `
    ${greet()}
    <h2>Mis libros</h2>
    ${ns.length ? `<div class="card"><h3>Avisos</h3>${ns.map(n => `<p>🔔 ${esc(n.t)} <span class="mut">${fm(n.d)}</span></p>`).join('')}</div>` : ''}
    <h3>Libros que tengo prestados</h3>
    ${ls.length
      ? ls.map(l => `<div class="card top"><div><b>${esc(bk(l.b).t)}</b><br>Devolver antes del ${fm(l.due)} ${late(l) ? '<span class="badge er">Vencido</span>' : ''}</div><button class="s" onclick="renovar('${l.id}')">Renovar</button></div>`).join('')
      : empty('No tenés libros prestados.')}
    <h3>Mis reservas</h3>
    ${rs.length
      ? rs.map(r => `<div class="card top"><div><b>${esc(bk(r.b).t)}</b><br>${r.st == 'lista' ? `Listo para retirar hasta el ${fm(r.exp)}` : 'En lista de espera'}</div><button class="s" onclick="ask('¿Cancelar esta reserva?',()=>cancelRes('${r.id}'))">Cancelar reserva</button></div>`).join('')
      : empty('No tenés reservas.')}
    ${rec.length ? `<h3>Te puede interesar</h3>${rec.map(b => `<div class="card top"><b>${esc(b.t)}</b><button onclick="go('ficha',{id:'${b.id}'})">Ver detalle</button></div>`).join('')}` : ''}
    <h3>Historial</h3>
    ${hs.length
      ? `<div class="tw"><table><tr><th>Libro</th><th>Retiro</th><th>Devolución</th></tr>${hs.map(l => `<tr><td>${esc(bk(l.b).t)}</td><td>${fm(l.start)}</td><td>${fm(l.ret)}</td></tr>`).join('')}</table></div>`
      : empty('Todavía no devolviste libros.')}`;
}

function deseosV() {
  const w = (S.wish[me.id] || []).map(bk).filter(Boolean);
  return `
    <h2>Mi lista de deseos</h2>
    ${w.length
      ? w.map(b => `<div class="card top"><b>${esc(b.t)}</b><span>${badge(b)} <button onclick="go('ficha',{id:'${b.id}'})">Ver detalle</button></span></div>`).join('')
      : empty('Aún no guardaste libros. Entrá a un libro y elegí “Guardar en mi lista de deseos”.')}`;
}

function perfilV() {
  return `
    <h2>Mis datos</h2>
    <div class="card">
      <label for="pe">Correo electrónico</label><input id="pe" value="${esc(me.email)}">
      ${me.tipo == 'docente' ? '' : `<label for="pcu">Curso</label>${courseSel('pcu', me.curso)}`}
      <p><button onclick="me.email=val('pe');me.curso=val('pcu');save();say('Datos guardados. Se usarán en tus próximos avisos.')">Guardar datos</button></p>
    </div>`;
}

/* ---------- Reportes ---------- */

function reportesV() {
  const t = today();
  return `
    <h2>Reportes</h2>
    <div class="card">
      <div class="row">
        <div><label for="r1">Desde</label><input id="r1" type="date" value="${addD(t, -30)}"></div>
        <div><label for="r2">Hasta</label><input id="r2" type="date" value="${t}"></div>
        <button onclick="rep()">Ver reporte</button>
      </div>
    </div>
    <div id="rp"></div>`;
}

function rep() {
  const a = val('r1'), z = val('r2'), ls = S.loans.filter(l => l.start >= a && l.start <= z);
  csvT = 'Socio,Libro,Retiro,Vence,Devuelto\n' + ls.map(l => [usr(l.u).name, bk(l.b).t, l.start, l.due, l.ret || ''].map(x => '"' + x + '"').join(',')).join('\n');
  const cnt = {};
  S.loans.concat(S.res).forEach(x => cnt[x.b] = (cnt[x.b] || 0) + 1);
  const top = Object.entries(cnt).sort((x, y) => y[1] - x[1]).slice(0, 5), mo = S.loans.filter(late);
  $('rp').innerHTML = `
    <h3>Préstamos del período (${ls.length})</h3>
    ${ls.length
      ? `<div class="tw"><table><tr><th>Socio</th><th>Libro</th><th>Retiro</th><th>Devuelto</th></tr>${ls.map(l => `<tr><td>${esc(usr(l.u).name)}</td><td>${esc(bk(l.b).t)}</td><td>${fm(l.start)}</td><td>${l.ret ? fm(l.ret) : 'Pendiente'}</td></tr>`).join('')}</table></div>`
      : empty('No hubo préstamos en esas fechas.')}
    <h3>Libros más pedidos</h3>
    <div class="card">
      ${top.map(x => `<p>${esc(bk(x[0]).t)}: <b>${x[1]}</b> pedidos</p>`).join('') || 'Sin datos.'}
      <p class="mut">Este reporte no muestra datos de personas.</p>
    </div>
    <h3>Libros vencidos (morosidad)</h3>
    ${mo.length
      ? `<div class="tw"><table><tr><th>Socio</th><th>Libro</th><th>Días de atraso</th></tr>${mo.map(l => `<tr><td>${esc(usr(l.u).name)}</td><td>${esc(bk(l.b).t)}</td><td>${Math.round((new Date(today()) - new Date(l.due)) / 864e5)}</td></tr>`).join('')}</table></div>`
      : empty('No hay libros vencidos.')}
    <p><button class="s" onclick="$('cv').style.display='block';$('cv').value=csvT;$('cv').select()">Exportar préstamos (texto CSV para Excel)</button></p>
    <textarea id="cv" style="display:none" aria-label="Datos CSV, copiar y pegar en Excel"></textarea>`;
}

let csvT = '';

/* ---------- Configuración ---------- */

function configV() {
  const c = S.cfg;
  const n = (i, l, v) => `<div><label for="${i}">${l}</label><input id="${i}" type="number" min="0" value="${v}"></div>`;
  return `
    <h2>Configuración</h2>
    <div class="card">
      <p class="mut">Los cambios se aplican a los préstamos nuevos. Los ya registrados no se modifican.</p>
      <div class="row">
        ${n('c1', 'Días de préstamo (alumnos)', c.dias.alumno)}
        ${n('c2', 'Días de préstamo (docentes)', c.dias.docente)}
        ${n('c3', 'Máximo de libros por persona', c.limite)}
      </div>
      <div class="row">
        ${n('c4', 'Días que dura una renovación', c.renov)}
        ${n('c5', 'Renovaciones permitidas', c.maxRenov)}
        ${n('c6', 'Días para retirar una reserva', c.resDias)}
        ${n('c7', 'Avisar con (días de anticipación)', c.rec)}
        ${n('c8', 'Intentos de ingreso antes de bloquear', c.intentos)}
      </div>
      <div class="row">
        ${n('c10', 'Libros por docente (uso personal)', c.limiteDoc ?? 3)}
        ${n('c11', 'Ejemplares por pedido para un curso', c.limiteCurso ?? 23)}
      </div>
      <label for="c9">¿No contar sábados y domingos en los plazos?</label>
      <select id="c9">
        <option value="1" ${c.finde ? 'selected' : ''}>Sí</option>
        <option value="0" ${c.finde ? '' : 'selected'}>No</option>
      </select>
      <p><button onclick="saveCfg()">Guardar configuración</button></p>
    </div>
    <div class="card">
      <h3>Días sin atención (feriados)</h3>
      <div class="row"><input id="nh" type="date" aria-label="Día sin atención"><button onclick="addNh()">Agregar día</button></div>
      <p>${c.nh.length ? c.nh.map(d => fm(d) + ` <button class="s" onclick="S.cfg.nh=S.cfg.nh.filter(x=>x!='${d}');save();draw()">Quitar</button>`).join('<br>') : '<span class="mut">No hay días cargados.</span>'}</p>
    </div>
    <div class="card">
      <h3>Registro de actividad</h3>
      <div class="tw">
        <table>
          <tr><th>Fecha</th><th>Quién</th><th>Qué hizo</th></tr>
          ${S.audit.slice(0, 40).map(a => `<tr><td>${a.t}</td><td>${esc(a.u)}</td><td>${esc(a.a)} ${esc(a.d)}</td></tr>`).join('')}
        </table>
      </div>
    </div>`;
}

function saveCfg() {
  const g = i => Math.max(0, +val(i) || 0), c = S.cfg;
  c.dias = { alumno: g('c1'), docente: g('c2') };
  c.limite = g('c3');
  c.renov = g('c4');
  c.maxRenov = g('c5');
  c.resDias = g('c6');
  c.rec = g('c7');
  c.intentos = g('c8') || 3;
  c.limiteDoc = g('c10') || 3;
  c.limiteCurso = g('c11') || 23;
  c.finde = val('c9') == '1';
  log('Cambio de configuración', '');
  save();
  say('Configuración guardada.');
}

function addNh() {
  const d = val('nh');
  if (d && !S.cfg.nh.includes(d)) { S.cfg.nh.push(d); save(); draw(); }
}

/* ---------- Asistente de ayuda (preguntas frecuentes) ---------- */

const faq = () => {
  const c = S.cfg;
  return [
    ['¿Cómo reservo un libro?', 'Entrá a Catálogo, tocá el libro y después “Reservar este libro”. Si está prestado, te anotás en la lista de espera y te avisamos cuando esté listo.'],
    ['¿Cuántos días puedo tener un libro?', 'Los alumnos pueden tener cada libro ' + c.dias.alumno + ' días y hasta ' + c.limite + ' libros a la vez. Los docentes, ' + c.dias.docente + ' días y hasta ' + (c.limiteDoc || 3) + ' libros.'],
    ['¿Cómo renuevo un préstamo?', 'En “Mis libros”, tocá “Renovar”. Se extiende ' + c.renov + ' días, hasta ' + c.maxRenov + ' veces, salvo que otra persona haya reservado el libro o que esté vencido.'],
    ['¿Cómo recibo una devolución?', 'Menú “Devolver”: escaneá o escribí el código del libro y tocá “Registrar devolución”.'],
    ['¿Cómo presto un libro?', 'Menú “Prestar”: elegí a la persona, escribí el código del ejemplar (por ejemplo L001-1) y tocá “Registrar préstamo”.'],
    ['¿Cómo reservo un proyector o un espacio?', 'Solo los docentes pueden. Entrá a “Recursos”, elegí qué necesitás, el día y el horario, y la bibliotecaria te avisa si lo acepta.'],
    ['¿Qué pasa si no retiro mi reserva?', 'Tenés ' + c.resDias + ' días para retirarla. Después vence y el libro pasa a la siguiente persona en espera.'],
    ['Olvidé mi contraseña', 'En la pantalla de ingreso tocá “Olvidé mi contraseña” y seguí los pasos.']
  ];
};

const nz = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
let chat = [], chOpen = false;

function chToggle() {
  chOpen = !chOpen;
  $('chp').style.display = chOpen ? 'flex' : 'none';
  $('chb').style.display = chOpen ? 'none' : 'block';
  if (chOpen) {
    $('chq').innerHTML = faq().map((f, i) => `<button class="s" onclick="chAsk(faq()[${i}][0])">${f[0]}</button>`).join('');
    chMsgs();
    $('chi').focus();
  }
}

function chMsgs() {
  $('chm').innerHTML = (chat.length ? '' : '<div class="cm assistant">Hola 👋 Soy el asistente de la biblioteca y estoy disponible las 24 horas. Elegí una pregunta o escribí tu duda.</div>')
    + chat.map(m => `<div class="cm ${m.role}">${esc(m.content)}</div>`).join('');
  $('chm').scrollTop = 1e9;
}

function chAsk(q) {
  q = (q || $('chi').value).trim();
  if (!q) return;
  $('chi').value = '';
  chat.push({ role: 'user', content: q });
  const F = faq(), w = nz(q).split(/\W+/).filter(x => x.length > 3);
  let best = null, sc = 0;
  F.forEach(f => {
    const t = nz(f[0] + ' ' + f[1]);
    const s = w.filter(x => t.includes(x)).length + (f[0] == q ? 9 : 0);
    if (s > sc) { sc = s; best = f; }
  });
  chat.push({ role: 'assistant', content: best ? best[1] : 'No encontré una respuesta para eso. Probá con una de las preguntas de abajo o consultá a la bibliotecaria.' });
  chMsgs();
}

init();