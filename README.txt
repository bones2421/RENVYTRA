Business HQ demo — Supabase deployment

1. Create a separate Supabase project for this public demo and run setup.sql in its SQL Editor.
2. Enable Anonymous Sign-Ins in the Auth provider settings. Visitors do not need to enter credentials.
3. In site/config.js, set the project URL and public publishable key from your new project. Never use a secret or service_role key.
4. Upload only the site folder to the existing HQ demo's Netlify Deploys page. Keep the existing demo.renvytrait.com custom domain.
5. Verify that the page says Connected to Supabase. Create a ticket and reload to check that it persists. Open a private window and verify that it gets separate sample data.

The public deployment creates anonymous users. Consider bot protection before broadly promoting it.
The demo stores fictional workspace state in a per-user Postgres row. Clearing the browser session starts a new workspace.
