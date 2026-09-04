/* Shared Supabase browser client.

   Loaded after the Supabase UMD bundle by every page that needs an account:
   the two web front-ends (index.html, admin.html) and the standalone driver
   pages. The bundle comes off a CDN, so it can simply not be there — a
   packaged desktop build opened offline, or a blocked request. Guard it:
   window.hllSupabase is then left undefined and the callers that need it
   (resetGamingNationPassword) already say so instead of throwing here and
   taking the rest of the page down with it. */
const SUPABASE_URL = 'https://sfzeauvkguywidrqjntk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5UTt258m0KUZigLXraZClw_nkXUTcMx';

if (window.supabase && typeof window.supabase.createClient === 'function') {

    window.hllSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log('Gaming Nation Supabase client created successfully.');

} else {

    console.warn(
        'Gaming Nation: the Supabase library did not load — account features are offline.'
    );
}
