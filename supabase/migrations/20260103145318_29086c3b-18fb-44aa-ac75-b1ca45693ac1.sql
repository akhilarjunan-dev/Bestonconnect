-- Schedule the auto-complete orders function to run daily at 2 AM
SELECT cron.schedule(
  'auto-complete-shipped-orders',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://kuffsqxmdyfsfbdpagfy.supabase.co/functions/v1/auto-complete-orders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1ZmZzcXhtZHlmc2ZiZHBhZ2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzczMjgsImV4cCI6MjA4MTQ1MzMyOH0.8D_jR-JEQoHi0TwbzGIvWMySIxqLcbIvy1y_uLE9bIc"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);