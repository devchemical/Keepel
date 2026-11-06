/** Guarded, disposable plan rehearsal. Seeds synthetic rows and rolls them back. */
import { randomUUID } from "node:crypto"
import { createAccount, executeLocalSql } from "./support"

process.env.KEEPEL_DATA_API_TEST = "1"
async function main() {
  const alice = await createAccount("explain-alice")
  const bob = await createAccount("explain-bob")
  const vehicles = Array.from({ length: 40 }, () => randomUUID())
  const values = vehicles.map((id, i) => `('${id}','${i < 20 ? alice.id : bob.id}','Plan','Synthetic',2026)`).join(",")
  const query = (vehicle: boolean, deep: boolean) => `EXPLAIN (ANALYZE, BUFFERS)
SELECT id, user_id, vehicle_id, type, description, cost, mileage, service_date, notes, created_at, updated_at
FROM public.maintenance_records WHERE user_id = '${alice.id}' ${vehicle ? `AND vehicle_id = '${vehicles[0]}'` : ""}
${deep ? "AND (service_date < '2026-03-08' OR (service_date = '2026-03-08' AND id < '40000000-0000-4000-8000-000000000000'))" : ""}
ORDER BY service_date DESC, id DESC LIMIT 26;`
  process.stdout.write(
    executeLocalSql(`
INSERT INTO public.vehicles(id,user_id,make,model,year) VALUES ${values};
INSERT INTO public.maintenance_records(user_id,vehicle_id,type,service_date,cost)
SELECT v.user_id,v.id,'other',DATE '2026-03-08' - (n % 5),2.50
FROM public.vehicles v CROSS JOIN generate_series(1,2500) n WHERE v.id IN (${vehicles.map((id) => `'${id}'`).join(",")});
INSERT INTO public.vehicles(user_id,make,model,year)
SELECT CASE WHEN n % 2 = 0 THEN '${alice.id}'::uuid ELSE '${bob.id}'::uuid END,'Selector','Synthetic',2026
FROM generate_series(1,2000) n;
INSERT INTO public.scheduled_services(user_id,vehicle_id,type,scheduled_mileage)
SELECT v.user_id,v.id,'other',0 FROM public.vehicles v CROSS JOIN generate_series(1,250) n
WHERE v.id IN (${vehicles.map((id) => `'${id}'`).join(",")});
ANALYZE public.vehicles; ANALYZE public.maintenance_records; ANALYZE public.scheduled_services;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '${alice.id}';
${query(false, false)}
${query(true, false)}
${query(false, true)}
${query(true, true)}
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*),coalesce(sum(cost),0) FROM public.maintenance_records WHERE user_id=(select auth.uid());
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*),coalesce(sum(cost),0) FROM public.maintenance_records WHERE user_id=(select auth.uid()) AND vehicle_id='${vehicles[0]}';
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.maintenance_totals('${vehicles[0]}');
EXPLAIN (ANALYZE, BUFFERS) SELECT id,user_id,make,model,year,license_plate,vin,color,mileage,created_at,updated_at
FROM public.vehicles WHERE user_id='${alice.id}' ORDER BY id LIMIT 500;
EXPLAIN (ANALYZE, BUFFERS) SELECT id,user_id,vehicle_id,type,description,scheduled_date,scheduled_mileage,status,notes,completed_record_id,created_at,updated_at
FROM public.scheduled_services WHERE user_id='${alice.id}' AND status='pending' ORDER BY id LIMIT 500;
RESET ROLE;
DROP INDEX public.idx_maintenance_account_history;
DROP INDEX public.idx_maintenance_vehicle_history;
SET LOCAL ROLE authenticated;
${query(false, false)}
${query(true, false)}
ROLLBACK;
`)
  )
}
void main()
