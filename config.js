// Backend connection. The anon key is public by design: row level security in the database decides what each signed-in role may read or change.
// Remove this file (or set HEADWAY_CONFIG to null) to run Headway as a standalone demo that keeps data in the browser.
window.HEADWAY_CONFIG = {
  supabaseUrl: 'https://zkcgsplfyexlhqslkozv.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprY2dzcGxmeWV4bGhxc2xrb3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MzYyMDUsImV4cCI6MjEwODQxMjIwNX0.31BhcJ7cNUUTq5Zau9X7L7If4gG9UEkhu7QSbHN1rN4'
};
