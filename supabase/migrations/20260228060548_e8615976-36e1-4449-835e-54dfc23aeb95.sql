
SELECT cron.schedule(
  'check-subscription-expiry-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://kuffsqxmdyfsfbdpagfy.supabase.co/functions/v1/check-subscription-expiry',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1ZmZzcXhtZHlmc2ZiZHBhZ2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzczMjgsImV4cCI6MjA4MTQ1MzMyOH0.8D_jR-JEQoHi0TwbzGIvWMySIxqLcbIvy1y_uLE9bIc"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
