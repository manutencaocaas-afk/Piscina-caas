import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://ourqruurjzolgbljiqxl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cnFydXVyanpvbGdibGppcXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MjY1NDEsImV4cCI6MjA3NDAwMjU0MX0.Puc7tSawUnvsTjeRjUJBOHJaSJ6D-T1G3T0Hz_n8MiA";

export const supabase = createClient(supabaseUrl, supabaseKey);
