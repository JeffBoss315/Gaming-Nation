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

  window.hllSupabase = {
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

    /* so a test can look at what the app wrote */
    __db: db,
    __users: users,
  };

  console.log('[HLL TEST] Supabase stand-in installed — nothing leaves this page.');
})();`;

module.exports = { SOURCE };
