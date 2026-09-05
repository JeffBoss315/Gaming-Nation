/* Where a desktop build should be written.

     node tools/dist-out.js        prints the directory

   Not dist/ inside the project, and the reason is not taste.

   This repository lives under OneDrive. The sync client opens files it is
   uploading, and an 80 MB installer plus a 173 MB unpacked tree is exactly
   the sort of thing it is still holding when the next build starts. What
   that looks like is:

     remove dist/win-unpacked/resources/app.asar: the process cannot
     access the file because it is being used by another process

   and the build stops. Worse than stopping: the tree that could not be
   replaced stays on disk looking exactly like the current app. Somebody
   launches dist/win-unpacked/Gaming Nation Trucker.exe, gets a build from
   before the last three fixes, and reports bugs that were fixed days ago.
   That happened.

   So builds go somewhere the sync client has no interest in, and
   tools/collect-release.js copies the finished artefacts back into
   release/ under the names the downloads page asks for. release/ is small,
   gitignored, and only ever written once per build.

   GMN_DIST_DIR overrides this, for anyone whose checkout is not in a
   synced folder and would rather keep everything in one place.
*/
const os = require('os');
const path = require('path');

const dir = (process.env.GMN_DIST_DIR || process.env.HLL_DIST_DIR)
  || path.join(os.tmpdir(), 'hll-dist');

process.stdout.write(dir);
