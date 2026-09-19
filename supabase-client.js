/* Shared Supabase browser client.

   Loaded after the Supabase UMD bundle by every page that needs an account:
   the two web front-ends (login.html, admin.html) and the standalone driver
   pages. The bundle used to come off a CDN, and in the packaged desktop
   build — file:// pages, often started before the network is up — it simply
   was not there: window.supabase undefined, no client, and every account
   feature quietly offline in the shipped .exe. It is vendored now, next to
   leaflet, at the version package.json pins, so it loads from disk and the
   client is always built. The guard stays anyway: a file that fails to
   parse should leave window.gmnSupabase undefined and let the callers that
   need it (resetGamingNationPassword) say so, rather than throw here and
   take the rest of the page down with it. */
const SUPABASE_URL = 'https://sfzeauvkguywidrqjntk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5UTt258m0KUZigLXraZClw_nkXUTcMx';

if (window.supabase && typeof window.supabase.createClient === 'function') {

    window.gmnSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log('Gaming Nation Supabase client created successfully.');

    /* The back/forward cache.

       Chrome keeps the page it is navigating away from, frozen, so the Back
       button can bring it straight back - and it will not freeze an open
       WebSocket. It closes Realtime itself and reports that as a failure:

         WebSocket connection to 'wss://…/realtime/v1/websocket…' failed:
         Page entered Back-Forward Cache.

       Closing the socket first, only when the page is actually being kept,
       is the same outcome without the error.

       The raw socket, not realtime.disconnect(). disconnect() records the
       close as deliberate, which switches reconnection off and leaves every
       channel believing it is still joined: a restored page then hears
       nothing, and removing a channel to start again hangs. A plain close
       looks like a dropped connection, and realtime-js already recovers
       from those - a few seconds after Back it reconnects and the channels
       rejoin by themselves. What it cannot recover is whatever was sent
       while the page was frozen, so the pages that listen read again on
       pageshow. */
    window.addEventListener('pagehide', function (event) {
        if (!event.persisted) return;
        var realtime = window.gmnSupabase.realtime;
        var socket = realtime && realtime.conn;
        if (socket && socket.readyState <= 1) {
            try { socket.close(1000, 'page cached'); } catch (e) { /* already closing */ }
        }
    });

} else {

    console.warn(
        'Gaming Nation: the Supabase library did not load — account features are offline.'
    );
}
