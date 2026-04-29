-- Create scheduled_services table
-- Separates future service scheduling from historical maintenance records (Issue #13)

CREATE TABLE IF NOT EXISTS public.scheduled_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'oil_change', 'tire_rotation', 'brake_service', etc.
  description TEXT,
  scheduled_date DATE,
  scheduled_mileage INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  completed_record_id UUID REFERENCES public.maintenance_records(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.scheduled_services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for scheduled_services
CREATE POLICY "scheduled_services_select_own" ON public.scheduled_services FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "scheduled_services_insert_own" ON public.scheduled_services FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scheduled_services_update_own" ON public.scheduled_services FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "scheduled_services_delete_own" ON public.scheduled_services FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for dashboard queries
CREATE INDEX idx_scheduled_services_user_status ON public.scheduled_services(user_id, status);
CREATE INDEX idx_scheduled_services_pending_date ON public.scheduled_services(scheduled_date) WHERE status = 'pending';