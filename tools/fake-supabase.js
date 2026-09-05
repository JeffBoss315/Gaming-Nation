/* ============================================================
   A Supabase stand-in, for tests.

   Registration goes through Supabase Auth now, so any harness that
   signs somebody up needs a Supabase to sign them up to. Pointing
   the tests at the real project is not an option: every run would
   leave real Auth users and real drivers rows behind in the company
   everybody is actually using.

   So this is the smallest thing that behaves like the client for the
   calls the platform makes — signUp, getSession, getUser,
   signInWithPassword, signOut, and the query builder's select /
   insert / update / upsert with eq, order, single and maybeSingle.

   It holds everything in memory in the page. Two windows get two of
   these and share nothing, which is exactly right for a test about
   one machine and wrong for a test about two.

   Used as source, not as a module: a harness reads this file and
   evaluates SOURCE inside the page before the app registers anybody.
   ============================================================ */
const SOURCE = `(function () {
  var seq = { drivers: 0, applications: 0, company: 0 };
  var db = { drivers: [], applications: [], company: [] };
  var users = [];
  var session = null;
  var channels = [];

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function rows(name) { return db[name] || (db[name] = []); }

  function matches(row, filters) {
    return filters.every(function (f) { return String(row[f[0]]) === String(f[1]); });
  }

  function shape(list, want) {
    if (want === 'one') {
      if (list.length !== 1) {
        return { data: null, error: { code: 'PGRST116', message: 'no single row returned' } };
      }
      return { data: list[0], error: null };
    }
    if (want === 'maybe') return { data: list[0] || null, error: null };
    return { data: list, error: null };
  }

  function builder(name) {
    var st = { op: 'select', filters: [], payload: null, want: null };

    function run() {
      var all = rows(name);
      var hit = all.filter(function (r) { return matches(r, st.filters); });

      if (st.op === 'insert' || st.op === 'upsert') {
        var given = Array.isArray(st.payload) ? st.payload : [st.payload];

        /* The one row level security rule worth modelling, because it is
           the one the platform trips over:

             drivers, insert, with check (auth.uid() = auth_user_id)

           With no session there is no auth.uid(), so null = anything is
           never true and the row is refused — even for the person it
           belongs to. Reproduced here so registration can be tested the
           way a real driver meets it. Everything else in this stand-in
           still ignores RLS. */
        if (name === 'drivers' && !session &&
            given.some(function (v) { return v && v.auth_user_id; })) {
          return Promise.resolve({
            data: null,
            error: {
              code: '42501',
              message: 'new row violates row-level security policy for table "drivers"',
            },
          });
        }

        var made = given.map(function (v) {
          var existing = st.op === 'upsert' && v.id != null
            ? all.find(function (r) { return String(r.id) === String(v.id); })
            : null;
          if (existing) { Object.assign(existing, v); return existing; }
          var row = Object.assign({
            id: v.id != null ? v.id : ++seq[name],
            created_at: new Date().toISOString(),
          }, v);
          all.push(row);
          return row;
        });
        return Promise.resolve(shape(made, st.want));
      }

      if (st.op === 'update') {
        hit.forEach(function (r) { Object.assign(r, st.payload); });
        return Promise.resolve(shape(hit, st.want));
      }

      if (st.op === 'delete') {
        hit.forEach(function (r) { all.splice(all.indexOf(r), 1); });
        return Promise.resolve(shape(hit, st.want));
      }

      return Promise.resolve(shape(hit, st.want));
    }

    var api = {
      select: function () { return api; },
      insert: function (v) { st.op = 'insert'; st.payload = v; return api; },
      upsert: function (v) { st.op = 'upsert'; st.payload = v; return api; },
      update: function (v) { st.op = 'update'; st.payload = v; return api; },
      delete: function () { st.op = 'delete'; return api; },
      eq: function (c, v) { st.filters.push([c, v]); return api; },
      order: function () { return api; },
      limit: function () { return api; },
      single: function () { st.want = 'one'; return api; },
      maybeSingle: function () { st.want = 'maybe'; return api; },
      then: function (ok, no) { return run().then(ok, no); },
      catch: function (no) { return run().catch(no); },
    };
    return api;
  }

  window.gmnSupabase = {
    from: function (name) { return builder(name); },

    auth: {
      signUp: function (opts) {
        var email = String((opts && opts.email) || '').toLowerCase();
        var password = String((opts && opts.password) || '');

        if (!email) {
          return Promise.resolve({ data: null, error: { message: 'An email is required' } });
        }
        if (password.length < 6) {
          return Promise.resolve({ data: null, error: { message: 'Signup requires a valid password' } });
        }
        if (users.some(function (u) { return u.email === email; })) {
          return Promise.resolve({ data: null, error: { message: 'User already registered' } });
        }

        var user = {
          id: uuid(),
          email: email,
          user_metadata: (opts && opts.options && opts.options.data) || {},
        };
        users.push({ email: email, password: password, user: user });

        /* Email confirmation. With it on, Supabase hands back the user and
           NO session — the address is not proved yet — and that missing
           session is what the drivers insert policy trips over, because
           auth.uid() is null. It is the default on a new project and the
           state a real driver registers in, so a harness that cannot
           reproduce it cannot test registration as it actually happens.

           Off by default, so every existing test behaves as before. */
        if (window.__hllConfirmEmail) {
          return Promise.resolve({ data: { user: user, session: null }, error: null });
        }

        session = { user: user, access_token: 'fake-' + user.id };
        return Promise.resolve({ data: { user: user, session: session }, error: null });
      },

      signInWithPassword: function (opts) {
        var email = String((opts && opts.email) || '').toLowerCase();
        var found = users.find(function (u) {
          return u.email === email && u.password === String((opts && opts.password) || '');
        });
        if (!found) {
          return Promise.resolve({ data: null, error: { message: 'Invalid login credentials' } });
        }
        session = { user: found.user, access_token: 'fake-' + found.user.id };
        return Promise.resolve({ data: { user: found.user, session: session }, error: null });
      },

      getSession: function () { return Promise.resolve({ data: { session: session }, error: null }); },
      getUser: function () {
        return Promise.resolve({ data: { user: session ? session.user : null }, error: null });
      },
      updateUser: function (patch) {
        if (session && patch && patch.data) Object.assign(session.user.user_metadata, patch.data);
        return Promise.resolve({ data: { user: session ? session.user : null }, error: null });
      },
      signOut: function () { session = null; return Promise.resolve({ error: null }); },
      onAuthStateChange: function () {
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
    },

    /* Realtime.

       The driver terminal subscribes to postgres_changes on drivers, so a
       stand-in without channel() is one where the page throws on load. It
       reports SUBSCRIBED and then does nothing, which is the honest
       behaviour: nothing in a test writes to this store from outside the
       page, so there is never anything to deliver. __emit is there for a
       test that wants to prove the handler works. */
    channel: function (name) {
      var handlers = [];
      var ch = {
        name: name,
        on: function (_event, _opts, fn) { handlers.push(fn); return ch; },
        subscribe: function (cb) {
          if (cb) setTimeout(function () { cb('SUBSCRIBED', null); }, 0);
          return ch;
        },
        unsubscribe: function () { return Promise.resolve('ok'); },
        __emit: function (payload) {
          handlers.forEach(function (fn) { fn(payload); });
        },
      };
      channels.push(ch);
      return ch;
    },

    removeChannel: function (ch) {
      var i = channels.indexOf(ch);
      if (i >= 0) channels.splice(i, 1);
      return Promise.resolve('ok');
    },

    /* so a test can look at what the app wrote */
    __db: db,
    __users: users,
    __channels: channels,
  };

  console.log('[GMN TEST] Supabase stand-in installed — nothing leaves this page.');
})();`;

module.exports = { SOURCE };
